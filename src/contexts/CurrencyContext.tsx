import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      } catch (e) {
        console.error('Failed to load currency preference', e);
      }
    }
    loadPreference();
  }, []);

  // Fetch rates
  useEffect(() => {
    async function fetchRates() {
      try {
        const res = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD');
        const json = await res.json();
        
        if (json && json.data && json.data.rates) {
          const fetchedRates: Record<string, number> = {};
          for (const key in json.data.rates) {
            fetchedRates[key] = parseFloat(json.data.rates[key]);
          }
          setRates(fetchedRates);
        }
      } catch (e) {
        console.error('Failed to fetch exchange rates', e);
      } finally {
        setLoading(false);
      }
    }
    fetchRates();
  }, []);

  const setSelectedCurrency = async (currency: SupportedCurrency) => {
    setSelectedCurrencyState(currency);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, currency);
    } catch (e) {
      console.error('Failed to save currency preference', e);
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
