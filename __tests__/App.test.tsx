/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');

  return {
    GestureHandlerRootView: View,
  };
});

jest.mock('react-native-toast-message', () => {
  const { View } = require('react-native');

  return View;
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => undefined),
  setItem: jest.fn(async () => undefined),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('react-native-biometrics', () =>
  jest.fn().mockImplementation(() => ({
    isSensorAvailable: jest.fn(async () => ({ available: false })),
    simplePrompt: jest.fn(async () => ({ success: true })),
  })),
);

jest.mock('react-native-draggable-flatlist', () => {
  const { FlatList } = require('react-native');

  return {
    __esModule: true,
    default: FlatList,
    ScaleDecorator: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('react-native-vision-camera', () => {
  const { View } = require('react-native');

  return {
    Camera: View,
    useCameraDevice: jest.fn(() => ({ id: 'test-camera' })),
    useCameraPermission: jest.fn(() => ({
      hasPermission: true,
      requestPermission: jest.fn(async () => true),
    })),
    useCodeScanner: jest.fn(() => ({})),
  };
});

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
  useLoginWithOAuth: () => ({
    login: jest.fn(async () => undefined),
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
