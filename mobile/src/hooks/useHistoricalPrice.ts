import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Timeframe = '7D';

export type ChartDataPoint = {
  timestamp: number;
  value: number;
};

const CACHE_KEY = '@stellar_expert_chart_cache';
const CACHE_DURATION = 15 * 60 * 1000;
const STELLAR_EXPERT_ASSET_URL =
  'https://api.stellar.expert/explorer/public/asset?limit=50&sort=rating&order=desc';

type CacheData = {
  timestamp: number;
  assets: Record<string, ChartDataPoint[]>;
};

type StellarExpertAssetRecord = {
  asset?: string;
  price7d?: [number, number][];
  toml_info?: {
    code?: string;
  };
};

let historicalPricesPromise: Promise<Record<string, ChartDataPoint[]>> | null =
  null;

function isCacheFresh(cache: CacheData) {
  return Date.now() - Number(cache.timestamp || 0) < CACHE_DURATION;
}

function getRecordCode(record: StellarExpertAssetRecord) {
  return (
    record.toml_info?.code ||
    String(record.asset || '')
      .split('-')[0]
      .trim()
  );
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

async function fetchHistoricalPrices() {
  const response = await fetch(STELLAR_EXPERT_ASSET_URL, {
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
  const records = Array.isArray(json._embedded?.records)
    ? json._embedded.records
    : [];
  const assetsMap: Record<string, ChartDataPoint[]> = {};

  for (const record of records) {
    const code = getRecordCode(record);
    const price7d = record.price7d;

    if (code && Array.isArray(price7d)) {
      assetsMap[code.toUpperCase()] = price7d.map(([timestamp, value]) => ({
        timestamp: timestamp * 1000,
        value,
      }));
    }
  }

  await AsyncStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      assets: assetsMap,
      timestamp: Date.now(),
    } as CacheData),
  );

  return assetsMap;
}

async function loadHistoricalPriceMap() {
  const cached = await readCachedHistoricalPrices();

  if (cached) {
    return cached;
  }

  if (!historicalPricesPromise) {
    historicalPricesPromise = fetchHistoricalPrices().finally(() => {
      historicalPricesPromise = null;
    });
  }

  return historicalPricesPromise;
}

export async function prefetchHistoricalPrices() {
  await loadHistoricalPriceMap();
}

export async function getHistoricalPriceData(assetCode: string) {
  const assetsMap = await loadHistoricalPriceMap();

  return assetsMap[assetCode.toUpperCase()] || [];
}

export function useHistoricalPrice(
  assetCode: string,
  timeframe: Timeframe = '7D',
) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPriceData() {
      setLoading(true);
      setError(null);

      try {
        const assetData = await getHistoricalPriceData(assetCode);

        if (isMounted) {
          setData(assetData);
        }
      } catch (err) {
        if (isMounted) {
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
  }, [assetCode, timeframe]);

  return { data, error, loading };
}
