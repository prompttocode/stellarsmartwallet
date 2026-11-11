import AsyncStorage from '@react-native-async-storage/async-storage';
import { getHistoricalPriceData } from '../src/hooks/useHistoricalPrice';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

// The same issuer is configured by the backend and returned by Stellar Expert.
const MAINNET_USDC = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const TESTNET_USDC = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const expectedChart = [
  { timestamp: 1_700_000_000_000, value: 1 },
  { timestamp: 1_700_000_060_000, value: 0.9993 },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      _embedded: {
        records: [{
          asset: `USDC-${MAINNET_USDC}-1`,
          tomlInfo: { code: 'USDC', issuer: MAINNET_USDC },
          price7d: [[1_700_000_000, 1], [1_700_000_060, 0.9993]],
        }],
      },
    }),
  } as Response);
});

afterEach(() => jest.restoreAllMocks());

test('Testnet USDC uses the correct Mainnet reference chart without changing its issuer', async () => {
  const asset = {
    assetCode: 'USDC',
    assetIssuer: TESTNET_USDC,
    isNative: false,
    network: 'testnet' as const,
  };
  await expect(getHistoricalPriceData(asset)).resolves.toEqual(expectedChart);
  expect(asset.assetIssuer).toBe(TESTNET_USDC);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    expect.any(String),
    expect.stringContaining(MAINNET_USDC),
  );
});

test('Mainnet USDC still uses its own chart', async () => {
  await expect(getHistoricalPriceData({
    assetCode: 'USDC',
    assetIssuer: MAINNET_USDC,
    isNative: false,
    network: 'mainnet',
  })).resolves.toEqual(expectedChart);
  expect(fetch).toHaveBeenCalledTimes(1);
});
