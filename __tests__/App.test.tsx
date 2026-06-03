/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@privy-io/expo', () => ({
  PrivyProvider: ({ children }: { children: React.ReactNode }) => children,
  useIdentityToken: () => ({
    getIdentityToken: jest.fn(async () => 'test-identity-token'),
  }),
  useLoginWithEmail: () => ({
    sendCode: jest.fn(async () => ({ success: true })),
    loginWithCode: jest.fn(async () => undefined),
    state: { status: 'initial' },
  }),
  usePrivy: () => ({
    user: null,
    isReady: true,
    error: null,
    logout: jest.fn(async () => undefined),
  }),
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock(
  'react-native-vector-icons/MaterialCommunityIcons',
  () => 'MaterialCommunityIcons',
);

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const fadeBuilder = {
    delay: () => fadeBuilder,
    duration: () => fadeBuilder,
  };

  return {
    __esModule: true,
    default: { View },
    FadeInDown: fadeBuilder,
    interpolate: (_value: number, _input: number[], output: number[]) =>
      output[output.length - 1],
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (value: number) => ({ value }),
    withSpring: (value: number) => value,
    withTiming: (value: number) => value,
  };
});

import App from '../App';

test('renders correctly', async () => {
  jest.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = String(input);
    const body = url.endsWith('/api/assets')
      ? {
          assets: [
            {
              assetCode: 'XLM',
              assetIssuer: null,
              demo: false,
              displayName: 'XLM',
              isNative: true,
            },
          ],
        }
      : {
          ok: true,
          privyAppId: 'test-app-id',
          network: 'Stellar Testnet',
          horizonUrl: 'https://horizon-testnet.stellar.org',
        };

    return {
      ok: true,
      text: async () => JSON.stringify(body),
    } as Response;
  });

  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
