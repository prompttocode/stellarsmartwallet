import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { setSwapEnabled, setVndEnabled } from '../src/config';
import type { WalletState } from '../src/hooks/useWallet';
import { TransactionsScreen } from '../src/screens/wallet/TransactionsScreen';

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../src/components/wallet', () => {
  const { Pressable, Text: Label, View } = require('react-native');
  return {
    modern: {},
    PressScale: Pressable,
    SectionHeader: View,
    TransactionListItem: View,
    ModernScreenHeader: ({ subtitle }: { subtitle: string }) => (
      <Label>{subtitle}</Label>
    ),
    SegmentedFilter: ({ options }: { options: { label: string }[] }) => (
      <Label>{options.map(option => option.label).join(',')}</Label>
    ),
    useSafeScreenInsetStyle: () => ({}),
  };
});

afterEach(() => {
  setSwapEnabled(false);
  setVndEnabled(false);
});

test.each([
  [true, true],
  [true, false],
  [false, true],
  [false, false],
])(
  'activity separates Swap=%s from VND=%s without hiding on-chain history',
  async (swap, vnd) => {
    setSwapEnabled(swap);
    setVndEnabled(vnd);
    const wallet = {
      isMainnet: true,
      transactions: [],
      visibleAssets: [],
      balances: [],
      rampOrderHistory: [],
    } as unknown as WalletState;
    let renderer!: ReturnType<typeof ReactTestRenderer.create>;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <TransactionsScreen
          wallet={wallet}
          onGoToRampOrder={jest.fn()}
          onGoToTransaction={jest.fn()}
        />,
      );
    });
    const labels = renderer.root
      .findAllByType(Text)
      .map(node => node.props.children);
    expect(labels).toContain('No transactions yet');
    expect(
      labels.some(
        label => typeof label === 'string' && label.includes('swaps'),
      ),
    ).toBe(swap);
    expect(
      labels.some(
        label =>
          typeof label === 'string' && label.includes('bank withdrawals'),
      ),
    ).toBe(vnd);
    expect(labels).toContain(
      swap
        ? 'Deposits, sends, and swaps appear here after they are submitted to Stellar.'
        : 'Deposits and sends appear here after they are submitted to Stellar.',
    );
    await ReactTestRenderer.act(async () => renderer.unmount());
  },
);
