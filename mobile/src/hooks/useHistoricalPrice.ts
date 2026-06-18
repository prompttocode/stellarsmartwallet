import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Timeframe = '7D';

export type ChartDataPoint = {
  timestamp: number;
  value: number;
};

const CACHE_KEY = '@stellar_expert_chart_cache';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

type CacheData = {
  timestamp: number;
  assets: Record<string, ChartDataPoint[]>;
};

export function useHistoricalPrice(assetCode: string, timeframe: Timeframe = '7D') {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchAllPrices() {
      setLoading(true);
      setError(null);

      try {
        // 1. Check Cache
        const cachedString = await AsyncStorage.getItem(CACHE_KEY);
        let assetsMap: Record<string, ChartDataPoint[]> = {};
        let needsFetch = true;

        if (cachedString) {
          try {
            const parsedCache: CacheData = JSON.parse(cachedString);
            if (Date.now() - parsedCache.timestamp < CACHE_DURATION) {
              assetsMap = parsedCache.assets;
              needsFetch = false;
            }
          } catch (e) {
            // cache invalid
          }
        }

        // 2. Fetch if needed (Fetch 1 time for all top 50 coins)
        if (needsFetch) {
          const url = `https://api.stellar.expert/explorer/public/asset?limit=50&sort=rating&order=desc`;
          const response = await fetch(url, {
            headers: { Accept: 'application/json' },
          });

          if (!response.ok) throw new Error('Failed to fetch from Stellar Expert');

          const json = await response.json();
          const records = json._embedded?.records || [];

          assetsMap = {};
          for (const record of records) {
            const code = record.toml_info?.code || record.asset.split('-')[0];
            const price7d = record.price7d as [number, number][] | undefined;
            
            if (code && price7d && Array.isArray(price7d)) {
              assetsMap[code.toUpperCase()] = price7d.map(([ts, val]) => ({
                // Stellar expert returns timestamp in seconds, we need milliseconds
                timestamp: ts * 1000,
                value: val,
              }));
            }
          }

          // Save to cache
          await AsyncStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              timestamp: Date.now(),
              assets: assetsMap,
            } as CacheData)
          );
        }

        // 3. Extract the requested asset
        if (isMounted) {
          const assetData = assetsMap[assetCode.toUpperCase()] || [];
          setData(assetData);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    }

    fetchAllPrices();

    return () => {
      isMounted = false;
    };
  }, [assetCode]);

  return { data, loading, error };
}
