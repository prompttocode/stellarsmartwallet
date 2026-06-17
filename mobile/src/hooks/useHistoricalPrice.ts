import { useState, useEffect } from 'react';

const ASSET_TO_CG_ID: Record<string, string> = {
  XLM: 'stellar',
  USDC: 'usd-coin',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
};

export type Timeframe = '1H' | '1D' | '1W' | '1M' | 'YTD' | 'ALL';

export type ChartDataPoint = {
  timestamp: number;
  value: number;
};

export function useHistoricalPrice(assetCode: string, timeframe: Timeframe) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchPrice() {
      const id = ASSET_TO_CG_ID[assetCode.toUpperCase()];
      if (!id) {
        // Fallback dummy data if not supported
        if (isMounted) {
          setData([
            { timestamp: Date.now() - 86400000, value: 1 },
            { timestamp: Date.now(), value: 1 },
          ]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let days = '1';
        switch (timeframe) {
          case '1H': days = '1'; break; // We'll slice the 1H data from 1D
          case '1D': days = '1'; break;
          case '1W': days = '7'; break;
          case '1M': days = '30'; break;
          case 'YTD': {
            const start = new Date(new Date().getFullYear(), 0, 1);
            const diffTime = Math.abs(Date.now() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            days = diffDays.toString();
            break;
          }
          case 'ALL': days = 'max'; break;
        }

        const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch');
        
        const json = await response.json();
        let prices = json.prices as [number, number][];

        if (timeframe === '1H' && prices.length > 0) {
          // 1D returns data every 5 mins, so 1 hour is 12 points
          prices = prices.slice(-12);
        }

        const formattedData: ChartDataPoint[] = prices.map(([timestamp, value]) => ({
          timestamp,
          value,
        }));

        if (isMounted) {
          setData(formattedData);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    }

    fetchPrice();

    return () => {
      isMounted = false;
    };
  }, [assetCode, timeframe]);

  return { data, loading, error };
}
