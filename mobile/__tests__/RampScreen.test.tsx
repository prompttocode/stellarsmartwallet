import React from 'react';
import { Modal, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { useAppPopup } from '../src/components/common/AppPopup';
import type { WalletState } from '../src/hooks/useWallet';
import { RampScreen } from '../src/screens/wallet/RampScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-media-library', () => ({}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../src/components/common/AppPopup', () => ({
  useAppPopup: jest.fn(),
}));
jest.mock('../src/components/wallet', () => {
  const { Pressable: Button, View } = require('react-native');
  return {
    PressScale: Button,
    TokenIcon: View,
    ModernScreenHeader: View,
    modern: {},
    useSafeScreenInsetStyle: () => ({}),
  };
});

const showPopup = jest.fn();
let activeRenderer: ReturnType<typeof ReactTestRenderer.create> | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(async () => activeRenderer?.unmount());
  activeRenderer = undefined;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAppPopup).mockReturnValue({
    hidePopup: jest.fn(),
    showPopup,
  });
});

async function renderRamp(direction: 'buy' | 'sell', verified = false) {
  const wallet = {
    activeRampOrder: null,
    rampProviders: [
      { type: 'fiat', configured: true, supports: ['buy', 'sell'] },
    ],
    visibleAssets: [{ assetCode: 'XLM', isNative: true }],
    balances: [{ assetCode: 'XLM', balance: '100' }],
    paymentMethods: [
      {
        id: 'bank-1',
        isDefault: true,
        bankId: '970422',
        fullName: 'TEST USER',
        accountNumber: '123456789',
      },
    ],
    rampOrderHistory: [],
    kyc: { status: verified ? 'verified' : 'none' },
    isMainnet: true,
    network: 'mainnet',
    serverSessionReady: true,
    isBusy: false,
    wallet: { address: 'GTEST' },
    walletCanSign: true,
    quoteRamp: jest.fn().mockResolvedValue({
      asset_code: 'XLM',
      rate: 7650,
      gross_vnd: 38250,
      fee_vnd: 5000,
      total_vnd: 43250,
    }),
    createRampOrder: jest.fn().mockResolvedValue(null),
  } as unknown as WalletState;
  const onOpenKyc = jest.fn();
  let renderer!: ReturnType<typeof ReactTestRenderer.create>;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <RampScreen
        onBack={jest.fn()}
        onOpenKyc={onOpenKyc}
        route={{ params: { direction, amount: '5' } }}
        wallet={wallet}
      />,
    );
    activeRenderer = renderer;
  });
  async function press(label: string) {
    const text = renderer.root
      .findAllByType(Text)
      .find(node => node.props.children === label);
    if (!text) {
      throw new Error(`Missing button: ${label}`);
    }
    let button = text.parent;
    while (button && typeof button.props.onPress !== 'function') {
      button = button.parent;
    }
    expect(button).not.toBeNull();
    expect(button?.props.disabled).not.toBe(true);
    await ReactTestRenderer.act(async () => button!.props.onPress());
  }
  await press('Get VND quote');
  expect(
    renderer.root.findAllByType(Modal).filter(node => node.props.visible),
  ).toHaveLength(1);
  return { renderer, wallet, onOpenKyc, press };
}

test.each(['buy', 'sell'] as const)(
  'closes every sheet before requesting verification for %s',
  async direction => {
    const { renderer, wallet, onOpenKyc, press } = await renderRamp(direction);
    await press(direction === 'buy' ? 'CREATE BUY ORDER' : 'CREATE WITHDRAWAL');
    expect(
      renderer.root.findAllByType(Modal).every(node => !node.props.visible),
    ).toBe(true);
    expect(wallet.createRampOrder).not.toHaveBeenCalled();
    const popup = showPopup.mock.calls[0][0];
    expect(popup.title).toBe('You are not verified');
    popup.actions[1].onPress();
    expect(onOpenKyc).toHaveBeenCalledTimes(1);
    // Cancelling verification can reopen the existing quote without fetching again.
    await press('Review VND quote');
    expect(
      renderer.root.findAllByType(Modal).filter(node => node.props.visible),
    ).toHaveLength(1);
    expect(wallet.quoteRamp).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(async () => renderer.unmount());
  },
);

test.each(['buy', 'sell'] as const)(
  'preserves order creation for verified %s users',
  async direction => {
    const { renderer, wallet, press } = await renderRamp(direction, true);
    await press(direction === 'buy' ? 'CREATE BUY ORDER' : 'CREATE WITHDRAWAL');
    expect(showPopup).not.toHaveBeenCalled();
    expect(wallet.createRampOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '5',
        assetCode: 'XLM',
        direction,
      }),
    );
    await ReactTestRenderer.act(async () => renderer.unmount());
  },
);
