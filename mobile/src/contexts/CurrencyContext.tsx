import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheGet, cacheSet } from '@utils/localCache';

export type SupportedCurrency = 'USD' | 'VND' | 'EUR' | 'JPY' | 'GBP';

interface CurrencyContextValue {
  selectedCurrency: SupportedCurrency;
  setSelectedCurrency: (currency: SupportedCurrency) => void;
  rates: Record<string, number>;
  loading: boolean;
  convertFromUSD: (usdAmount: number) => number;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const STORAGE_KEY = '@privy_currency_preference';
const RATES_CACHE_KEY = 'currency-rates-usd';
const RATES_CACHE_TTL_MS = 60 * 60 * 1000;

const DEFAULT_CURRENCY: SupportedCurrency = 'USD';

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrencyState] = useState<SupportedCurrency>(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [loading, setLoading] = useState(true);

  // Load saved preference
  useEffect(() => {
    async function loadPreference() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          setSelectedCurrencyState(saved as SupportedCurrency);
        }
      } catch {
        // Best-effort; ignore preference load failures.
      }
    }
    loadPreference();
  }, []);

  // Fetch rates with cache
  useEffect(() => {
    let cancelled = false;

    async function loadRates() {
      const cached = await cacheGet<Record<string, number>>(
        RATES_CACHE_KEY,
        RATES_CACHE_TTL_MS,
      );

      if (cached && !cancelled) {
        setRates(cached);
        setLoading(false);
      }

      try {
        const res = await fetch(
          'https://api.coinbase.com/v2/exchange-rates?currency=USD',
        );
        const json = await res.json();

        if (json && json.data && json.data.rates) {
          const fetchedRates: Record<string, number> = {};
          for (const key in json.data.rates) {
            fetchedRates[key] = parseFloat(json.data.rates[key]);
          }

          if (!cancelled) {
            setRates(fetchedRates);
          }
          cacheSet(RATES_CACHE_KEY, fetchedRates).catch(() => null);
        }
      } catch {
        // Keep cached rates on network failure.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRates();

    return () => {
      cancelled = true;
    };
  }, []);

  const setSelectedCurrency = async (currency: SupportedCurrency) => {
    setSelectedCurrencyState(currency);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, currency);
    } catch {
      // Best-effort; ignore preference save failures.
    }
  };

  const convertFromUSD = (usdAmount: number): number => {
    if (selectedCurrency === 'USD' || !rates[selectedCurrency]) return usdAmount;
    return usdAmount * rates[selectedCurrency];
  };

  return (
    <CurrencyContext.Provider value={{ selectedCurrency, setSelectedCurrency, rates, loading, convertFromUSD }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrencyConfig() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrencyConfig must be used within a CurrencyProvider');
  }
  return context;
}
