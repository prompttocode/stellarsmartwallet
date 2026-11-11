import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import type { BalanceItem } from '../src/types';
import type { WalletState } from '../src/hooks/useWallet';
import { useHistoricalPrice } from '../src/hooks/useHistoricalPrice';
import { AssetDetailScreen } from '../src/screens/wallet/AssetDetailScreen';
import { setSwapEnabled, setVndEnabled } from '../src/config';

jest.mock('../src/hooks/useHistoricalPrice', () => ({
  useHistoricalPrice: jest.fn(() => ({
    data: [],
    loading: false,
    error: null,
  })),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../src/components/common/Skeleton', () => {
  const { View } = require('react-native');
  return { SkeletonBlock: View, SkeletonLine: View };
});
jest.mock('../src/components/wallet', () => {
  const { Pressable, View } = require('react-native');
  return {
    PressScale: Pressable,
    TokenIcon: View,
    useSafeScreenInsetStyle: () => ({}),
  };
});
jest.mock('react-native-wagmi-charts', () => {
  const { View } = require('react-native');
  return {
    LineChart: Object.assign(View, {
      Provider: View,
      Path: View,
      Gradient: View,
      CursorCrosshair: View,
      Tooltip: View,
      PriceText: View,
      DatetimeText: View,
    }),
  };
});

beforeEach(() => setVndEnabled(true));
afterEach(() => {
  setSwapEnabled(false);
  setVndEnabled(false);
});

async function renderAsset(network: 'testnet' | 'mainnet') {
  const asset: BalanceItem = {
    assetCode: 'USDC',
    assetIssuer: 'GUSDC',
    balance: '10',
    demo: network === 'testnet',
    displayName: network === 'testnet' ? 'USD Coin Testnet' : 'USD Coin',
    exists: true,
    isNative: false,
    network,
    priceUsd: 1,
    trusted: true,
    trustLevel: 'verified',
  };
  const wallet = {
    balances: [asset],
    visibleAssets: [asset],
    network,
    isMainnet: network === 'mainnet',
    isBusy: false,
    isFavoriteAsset: () => false,
    fundTestUsdc: jest.fn(),
  } as unknown as WalletState;
  let renderer!: ReturnType<typeof ReactTestRenderer.create>;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <AssetDetailScreen
        onBack={jest.fn()}
        onGoToReceive={jest.fn()}
        onGoToRamp={jest.fn()}
        onGoToSend={jest.fn()}
        route={{ params: { asset } }}
        wallet={wallet}
      />,
    );
  });
  return { renderer, wallet };
}

test('shows a Testnet chart empty state without duplicating the funding button', async () => {
  const { renderer, wallet } = await renderAsset('testnet');
  const labels = renderer.root
    .findAllByType(Text)
    .map(node => node.props.children);
  expect(labels.filter(label => label === 'Get Testnet USDC')).toHaveLength(1);
  expect(labels).toContain('No public market chart for this Testnet asset');
  expect(labels).toContain(
    'Mainnet price reference · Testnet assets have no real-world value',
  );
  expect(wallet.fundTestUsdc).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('keeps the Mainnet buy action and chart empty state unchanged', async () => {
  const { renderer } = await renderAsset('mainnet');
  const rendered = JSON.stringify(renderer.toJSON());
  expect(rendered).toContain('Buy ');
  expect(rendered).toContain('No public market chart for this asset');
  expect(rendered).not.toContain('Get Testnet');
  expect(rendered).not.toContain('Mainnet price reference');
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test.each([
  [true, true],
  [true, false],
  [false, true],
  [false, false],
])('Mainnet buy follows VND=%s independently of Swap=%s', async (vnd, swap) => {
  setSwapEnabled(swap);
  setVndEnabled(vnd);
  const { renderer } = await renderAsset('mainnet');
  const rendered = JSON.stringify(renderer.toJSON());
  expect(rendered.includes('Buy ')).toBe(vnd);
  expect(rendered.includes('Receive ')).toBe(!vnd);
  await ReactTestRenderer.act(async () => renderer.unmount());
});

test('still renders available reference chart data for Testnet USDC', async () => {
  jest.mocked(useHistoricalPrice).mockReturnValueOnce({
    data: [
      { timestamp: 1_700_000_000_000, value: 1 },
      { timestamp: 1_700_000_060_000, value: 1.001 },
    ],
    loading: false,
    error: null,
  });
  const { renderer } = await renderAsset('testnet');
  const labels = renderer.root
    .findAllByType(Text)
    .map(node => node.props.children);
  expect(labels.filter(label => label === 'Get Testnet USDC')).toHaveLength(1);
  expect(labels).not.toContain('No public market chart for this Testnet asset');
  expect(labels).toContain(
    'Mainnet price reference · Testnet assets have no real-world value',
  );
  await ReactTestRenderer.act(async () => renderer.unmount());
});
