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

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  const frame = { height: 844, width: 390, x: 0, y: 0 };
  const insets = { bottom: 0, left: 0, right: 0, top: 0 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaFrameContext: ReactModule.createContext(frame),
    SafeAreaInsetsContext: ReactModule.createContext(insets),
    SafeAreaProvider: View,
    SafeAreaView: View,
    useSafeAreaFrame: () => frame,
    useSafeAreaInsets: () => insets,
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  multiRemove: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
  setItem: jest.fn(async () => undefined),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '1',
}));

jest.mock('expo-camera', () => ({
  scanFromURLAsync: jest.fn(async () => []),
}));

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  cacheDirectory: 'file:///tmp/',
  deleteAsync: jest.fn(async () => undefined),
  downloadAsync: jest.fn(async (_url: string, uri: string) => ({ uri })),
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 1 })),
  readAsStringAsync: jest.fn(async () => 'test-base64'),
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `privy://${path}`),
}));

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  saveToLibraryAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(async () => ({ type: 'dismiss' })),
  WebBrowserPresentationStyle: { FORM_SHEET: 'formSheet' },
}));

jest.mock('react-native-biometrics', () =>
  jest.fn().mockImplementation(() => ({
    isSensorAvailable: jest.fn(async () => ({ available: false })),
    simplePrompt: jest.fn(async () => ({ success: true })),
  })),
);

jest.mock('react-native-compressor', () => ({
  Image: {
    compress: jest.fn(async (uri: string) => uri),
  },
}));

jest.mock('react-native-wagmi-charts', () => {
  const ReactModule = require('react');
  const { Text, View } = require('react-native');
  const Container = ({ children }: { children?: React.ReactNode }) =>
    ReactModule.createElement(View, null, children);
  const Label = () => ReactModule.createElement(Text, null, '0');

  return {
    LineChart: {
      CursorCrosshair: Container,
      DatetimeText: Label,
      Gradient: Container,
      Path: Container,
      PriceText: Label,
      Provider: Container,
      Tooltip: Container,
    },
  };
});

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
  useOAuthTokens: () => undefined,
  usePrivy: () => ({
    user: null,
    isReady: true,
    error: null,
    logout: jest.fn(async () => undefined),
  }),
}));

jest.mock('@privy-io/expo/extended-chains', () => ({
  useCreateWallet: () => ({
    createWallet: jest.fn(async () => ({
      wallet: {
        address: 'GTEST',
        chain_type: 'stellar',
        id: 'test-wallet',
        public_key: 'GTEST',
      },
    })),
  }),
  useSignRawHash: () => ({
    signRawHash: jest.fn(async () => ({ signature: 'test-signature' })),
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
    default: {
      View,
      createAnimatedComponent: (component: unknown) => component,
    },
    FadeInDown: fadeBuilder,
    interpolate: (_value: number, _input: number[], output: number[]) =>
      output[output.length - 1],
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (value: number) => ({ value }),
    withSpring: (value: number) => value,
    withTiming: (value: number) => value,
  };
});

jest.mock('@screens/wallet/WalletApp', () => {
  const ReactModule = require('react');
  const { Text } = require('react-native');

  return {
    WalletApp: ({ wallet }: { wallet: { isReviewMode: boolean } }) =>
      ReactModule.createElement(
        Text,
        null,
        wallet.isReviewMode ? 'Review mode' : 'Wallet',
      ),
  };
});

import App from '../App';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../src/config';
import type { WalletState } from '../src/hooks/useWallet';
import { LoginScreen } from '../src/screens/auth/LoginScreen';
import * as WebBrowser from 'expo-web-browser';

test('renders correctly', async () => {
  const fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async input => {
      const url = String(input);
      const body = url.endsWith('/api/session')
        ? {
            account: {
              email: 'app-review@getstellar.shop',
              id: 'review-account',
              wallet: {
                address: 'GTESTREVIEW',
                canSign: true,
                chainType: 'stellar',
                id: 'review-wallet',
                kind: 'privy',
                network: 'testnet',
                publicKey: 'GTESTREVIEW',
              },
            },
            activeWalletId: 'review-wallet',
            balance: {
              address: 'GTESTREVIEW',
              balances: [],
              exists: true,
              network: 'testnet',
              transactions: [],
              xlm: '10000',
            },
            balances: [],
            network: 'testnet',
            transactions: [],
          }
        : url.includes('/api/assets?')
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
        : url.endsWith('/api/networks')
        ? {
            networks: [
              {
                horizonUrl: 'https://horizon-testnet.stellar.org',
                label: 'Testnet',
                network: 'testnet',
                supportsFriendbot: true,
              },
            ],
          }
        : url.endsWith('/api/ramp/providers')
        ? { providers: [] }
        : url.endsWith('/api/collectibles') ||
          url.includes('/api/collectibles?')
        ? { collectibles: [] }
        : url.endsWith('/api/walletconnect/config')
        ? { configured: false, projectId: null, relays: [] }
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

  let renderer!: ReturnType<typeof ReactTestRenderer.create>;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(JSON.stringify(renderer.toJSON())).toContain('Explore Testnet');

  const reviewLabel = renderer.root.findByProps({
    children: 'Explore Testnet',
  });
  let reviewButton = reviewLabel.parent;

  while (reviewButton && typeof reviewButton.props.onPress !== 'function') {
    reviewButton = reviewButton.parent;
  }

  expect(typeof reviewButton?.props.onPress).toBe('function');

  await ReactTestRenderer.act(async () => {
    await reviewButton?.props.onPress();
    await Promise.resolve();
  });

  const reviewSessionRequest = fetchSpy.mock.calls.find(([input]) =>
    String(input).endsWith('/api/session'),
  );
  const reviewSessionBody = JSON.parse(
    String((reviewSessionRequest?.[1] as RequestInit | undefined)?.body),
  );

  expect(reviewSessionBody).toEqual({
    email: 'app-review@getstellar.shop',
    network: 'testnet',
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('Review mode');

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

function createLoginWallet(
  overrides: Record<string, unknown> = {},
): WalletState {
  return {
    account: null,
    busy: null,
    codeSent: false,
    isBusy: false,
    isReady: true,
    loginWithApple: jest.fn(async () => true),
    loginWithGoogle: jest.fn(async () => true),
    sessionSyncing: false,
    showErrorDialog: jest.fn(),
    startReviewMode: jest.fn(async () => true),
    ...overrides,
  } as unknown as WalletState;
}

test('offers Sign in with Apple at the same login level as Google', async () => {
  const wallet = createLoginWallet();
  let renderer!: ReturnType<typeof ReactTestRenderer.create>;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<LoginScreen wallet={wallet} />);
  });

  const appleButton = renderer.root.findByProps({
    accessibilityLabel: 'Continue with Apple',
  });

  await ReactTestRenderer.act(async () => {
    await appleButton.props.onPress();
  });

  expect(wallet.loginWithApple).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findByProps({
      accessibilityLabel: 'Continue with Google',
    }),
  ).toBeTruthy();
});

test('opens both legal labels in the browser sheet and reports failures', async () => {
  const wallet = createLoginWallet();
  const openBrowser = jest.mocked(WebBrowser.openBrowserAsync);
  let renderer!: ReturnType<typeof ReactTestRenderer.create>;

  openBrowser.mockResolvedValue({ type: 'dismiss' } as never);

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<LoginScreen wallet={wallet} />);
  });

  await ReactTestRenderer.act(async () => {
    await renderer.root.findByProps({
      accessibilityLabel: 'Open Terms of Service',
    }).props.onPress();
    await renderer.root.findByProps({
      accessibilityLabel: 'Open Privacy Policy',
    }).props.onPress();
  });

  expect(openBrowser).toHaveBeenNthCalledWith(
    1,
    TERMS_OF_SERVICE_URL,
    expect.objectContaining({ presentationStyle: 'formSheet' }),
  );
  expect(openBrowser).toHaveBeenNthCalledWith(
    2,
    PRIVACY_POLICY_URL,
    expect.objectContaining({ presentationStyle: 'formSheet' }),
  );

  openBrowser.mockRejectedValueOnce(new Error('offline'));

  await ReactTestRenderer.act(async () => {
    await renderer.root.findByProps({
      accessibilityLabel: 'Open Privacy Policy',
    }).props.onPress();
  });

  expect(wallet.showErrorDialog).toHaveBeenCalledWith(
    expect.stringContaining('Unable to open Privacy Policy'),
    'Could not open link',
  );
});
