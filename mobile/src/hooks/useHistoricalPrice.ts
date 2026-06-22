import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AssetItem, StellarNetwork } from '@app-types';

export type Timeframe = '7D';

export type ChartDataPoint = {
  timestamp: number;
  value: number;
};

type HistoricalPriceAsset = Pick<
  AssetItem,
  'assetCode' | 'assetIssuer' | 'isNative' | 'network'
>;

type CacheData = {
  assets: Record<string, ChartDataPoint[]>;
  timestamp: number;
};

type StellarExpertAssetRecord = {
  asset?: string;
  price7d?: [number, number][];
  tomlInfo?: {
    code?: string;
    issuer?: string;
  };
  toml_info?: {
    code?: string;
    issuer?: string;
  };
};

const CACHE_KEY = '@stellar_expert_chart_cache_v2';
const CACHE_DURATION = 15 * 60 * 1000;
const STELLAR_EXPERT_BASE_URL =
  'https://api.stellar.expert/explorer/public/asset';
const MAINNET_USDC_ISSUER =
  'GA5ZSEJYB37NLMQVSP5BHDQK32E6PYAQQL3OH6E55SIVTEPSHVLF67M';

let historicalPricesPromise: Promise<Record<string, ChartDataPoint[]>> | null =
  null;

function isCacheFresh(cache: CacheData) {
  return Date.now() - Number(cache.timestamp || 0) < CACHE_DURATION;
}

function parseRecordIdentity(record: StellarExpertAssetRecord) {
  const toml = record.tomlInfo || record.toml_info || {};
  const assetId = String(record.asset || '').trim();

  if (assetId === 'XLM') {
    return {
      assetCode: 'XLM',
      assetIssuer: null,
      isNative: true,
    };
  }

  const parts = assetId.split('-');
  const issuer = String(toml.issuer || parts.find(part => part.startsWith('G')) || '')
    .trim();
  const assetCode = String(toml.code || parts[0] || '').trim();

  if (!assetCode) {
    return null;
  }

  return {
    assetCode,
    assetIssuer: issuer || null,
    isNative: assetCode === 'XLM' && !issuer,
  };
}

function getChartKey(asset: HistoricalPriceAsset) {
  if (asset.isNative || (asset.assetCode === 'XLM' && !asset.assetIssuer)) {
    return 'mainnet:XLM:';
  }

  return `mainnet:${asset.assetCode.toUpperCase()}:${String(
    asset.assetIssuer || '',
  ).toUpperCase()}`;
}

function getRecordChartKey(record: StellarExpertAssetRecord) {
  const identity = parseRecordIdentity(record);

  if (!identity) {
    return null;
  }

  return getChartKey({
    assetCode: identity.assetCode,
    assetIssuer: identity.assetIssuer,
    isNative: identity.isNative,
    network: 'mainnet',
  });
}

function mapPrice7d(record: StellarExpertAssetRecord) {
  const price7d = record.price7d;

  if (!Array.isArray(price7d)) {
    return [];
  }

  return price7d
    .filter(
      item =>
        Array.isArray(item) &&
        Number.isFinite(Number(item[0])) &&
        Number.isFinite(Number(item[1])),
    )
    .map(([timestamp, value]) => ({
      timestamp: Number(timestamp) * 1000,
      value: Number(value),
    }));
}

function getReferenceAsset(asset: HistoricalPriceAsset): HistoricalPriceAsset | null {
  if (asset.network === 'mainnet') {
    return asset;
  }

  if (asset.assetCode === 'XLM' && !asset.assetIssuer) {
    return {
      assetCode: 'XLM',
      assetIssuer: null,
      isNative: true,
      network: 'mainnet',
    };
  }

  if (asset.assetCode === 'USDC') {
    return {
      assetCode: 'USDC',
      assetIssuer: MAINNET_USDC_ISSUER,
      isNative: false,
      network: 'mainnet',
    };
  }

  return null;
}

async function readCachedHistoricalPrices() {
  const cachedString = await AsyncStorage.getItem(CACHE_KEY);

  if (!cachedString) {
    return null;
  }

  try {
    const parsedCache = JSON.parse(cachedString) as CacheData;

    if (isCacheFresh(parsedCache)) {
      return parsedCache.assets || {};
    }
  } catch {
    await AsyncStorage.removeItem(CACHE_KEY).catch(() => null);
  }

  return null;
}

async function writeCachedHistoricalPrices(
  assets: Record<string, ChartDataPoint[]>,
) {
  await AsyncStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      assets,
      timestamp: Date.now(),
    } as CacheData),
  );
}

async function fetchStellarExpertRecords(params: URLSearchParams) {
  const response = await fetch(`${STELLAR_EXPERT_BASE_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch from Stellar Expert');
  }

  const json = (await response.json()) as {
    _embedded?: {
      records?: StellarExpertAssetRecord[];
    };
  };

  return Array.isArray(json._embedded?.records) ? json._embedded.records : [];
}

function mergeRecordCharts(
  current: Record<string, ChartDataPoint[]>,
  records: StellarExpertAssetRecord[],
) {
  const next = { ...current };

  for (const record of records) {
    const key = getRecordChartKey(record);
    const chart = mapPrice7d(record);

    if (key && chart.length > 0) {
      next[key] = chart;
    }
  }

  return next;
}

async function fetchTopHistoricalPrices() {
  const params = new URLSearchParams({
    limit: '50',
    order: 'desc',
    sort: 'rating',
  });
  const records = await fetchStellarExpertRecords(params);
  const assetsMap = mergeRecordCharts({}, records);

  await writeCachedHistoricalPrices(assetsMap);

  return assetsMap;
}

async function loadHistoricalPriceMap() {
  const cached = await readCachedHistoricalPrices();

  if (cached) {
    return cached;
  }

  if (!historicalPricesPromise) {
    historicalPricesPromise = fetchTopHistoricalPrices().finally(() => {
      historicalPricesPromise = null;
    });
  }

  return historicalPricesPromise;
}

async function findAssetChart(asset: HistoricalPriceAsset) {
  const assetId =
    asset.isNative || (asset.assetCode === 'XLM' && !asset.assetIssuer)
      ? 'XLM'
      : `${asset.assetCode}-${asset.assetIssuer}`;
  const searches = [assetId, asset.assetIssuer, asset.assetCode].filter(
    (value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index,
  );
  const targetKey = getChartKey(asset);

  for (const search of searches) {
    const records = await fetchStellarExpertRecords(
      new URLSearchParams({
        limit: '20',
        order: 'desc',
        search,
        sort: 'rating',
      }),
    );
    const matchedRecord = records.find(record => getRecordChartKey(record) === targetKey);

    if (matchedRecord) {
      return mapPrice7d(matchedRecord);
    }
  }

  return [];
}

export async function prefetchHistoricalPrices() {
  await loadHistoricalPriceMap();
}

export async function getHistoricalPriceData(asset: HistoricalPriceAsset) {
  const referenceAsset = getReferenceAsset(asset);

  if (!referenceAsset) {
    return [];
  }

  const key = getChartKey(referenceAsset);
  const assetsMap = await loadHistoricalPriceMap();
  const cachedChart = assetsMap[key];

  if (cachedChart?.length) {
    return cachedChart;
  }

  const fetchedChart = await findAssetChart(referenceAsset);

  if (fetchedChart.length > 0) {
    await writeCachedHistoricalPrices({
      ...assetsMap,
      [key]: fetchedChart,
    });
  }

  return fetchedChart;
}

export function useHistoricalPrice(
  asset: HistoricalPriceAsset,
  timeframe: Timeframe = '7D',
) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const assetKey = `${asset.network}:${asset.assetCode}:${
    asset.assetIssuer || ''
  }:${asset.isNative ? 'native' : 'issued'}`;

  useEffect(() => {
    let isMounted = true;

    async function loadPriceData() {
      setLoading(true);
      setError(null);

      try {
        const assetData = await getHistoricalPriceData(asset);

        if (isMounted) {
          setData(assetData);
        }
      } catch (err) {
        if (isMounted) {
          setData([]);
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadPriceData();

    return () => {
      isMounted = false;
    };
  }, [assetKey, timeframe]);

  return { data, error, loading };
}
