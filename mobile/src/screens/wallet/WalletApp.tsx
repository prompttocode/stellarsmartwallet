import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';

import { modern } from '@components/wallet';
import { NonBlockingProgressBanner } from '@components/common/NonBlockingProgressBanner';
import { CurrencyProvider } from '@contexts/CurrencyContext';
import { WalletConnectProvider } from '@contexts/WalletConnectContext';
import { WalletConnectOverlays } from '@components/wallet/WalletConnectOverlays';
import { WalletTutorialOverlay } from '@components/wallet/WalletTutorialOverlay';
import type { WalletState } from '@hooks/useWallet';
import { isRampOrderTerminal } from '@utils/ramp';

import { PortfolioScreen } from '@screens/wallet/PortfolioScreen';
import { ReceiveScreen } from '@screens/wallet/ReceiveScreen';
import { SendScreen } from '@screens/wallet/SendScreen';
import { SwapScreen } from '@screens/wallet/SwapScreen';
import { FaucetScreen } from '@screens/wallet/FaucetScreen';
import { RampScreen } from '@screens/wallet/RampScreen';
import { SettingsScreen } from '@screens/wallet/SettingsScreen';
import { KycScreen } from '@screens/wallet/KycScreen';
import { AssetDetailScreen } from '@screens/wallet/AssetDetailScreen';
import { AssetSearchScreen } from '@screens/wallet/AssetSearchScreen';
import { TransactionDetailScreen } from '@screens/wallet/TransactionDetailScreen';
import { TransactionsScreen } from '@screens/wallet/TransactionsScreen';
import { ScanScreen } from '@screens/wallet/ScanScreen';
import { WalletConnectScreen } from '@screens/wallet/WalletConnectScreen';
import type {
  BalanceItem,
  RampAssetCode,
  RampDirection,
  RampOrder,
} from '@app-types';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const WALLET_TUTORIAL_STORAGE_VERSION = 'v1';

function getWalletTutorialStorageKey(accountKey: string) {
  return `wallet-tutorial-seen:${WALLET_TUTORIAL_STORAGE_VERSION}:${accountKey}`;
}

async function clearClosedRampOrder(wallet: WalletState) {
  if (isRampOrderTerminal(wallet.activeRampOrder)) {
    await wallet.clearRampOrder();
  }
}

type RampNavigationPreset = {
  amount?: string;
  assetCode?: RampAssetCode;
  autoCreate?: boolean;
  direction?: RampDirection;
};

const GLOBAL_LOADING_BUSY_EXACT = new Set([
  'Verifying Privy code',
  'Sign in with Google',
  'Submitting KYC',
  'Funding test XLM',
  'Getting Testnet USDC',
  'Claiming demo NFT',
  'Creating receiver',
  'Confirming test payment',
  'Confirming test crypto receipt',
  'Opening secure export',
]);

const GLOBAL_LOADING_BUSY_PREFIXES = [
  'Creating Mainnet wallet',
  'Creating Testnet wallet',
  'Creating buy order',
  'Creating sell order',
  'Enabling ',
  'Sending ',
  'Swap ',
];

function shouldUseGlobalLoadingBanner(busy: string | null) {
  if (!busy) {
    return false;
  }

  return (
    GLOBAL_LOADING_BUSY_EXACT.has(busy) ||
    GLOBAL_LOADING_BUSY_PREFIXES.some(prefix => busy.startsWith(prefix))
  );
}

function getCompletedStatusText(label: string) {
  if (label.startsWith('Sending ')) {
    return `Sent ${label.replace('Sending ', '')}`;
  }

  if (label.startsWith('Swap ')) {
    return 'Swap complete';
  }

  if (label.startsWith('Enabling ')) {
    return `Enabled ${label.replace('Enabling ', '')}`;
  }

  if (label.startsWith('Creating buy order')) {
    return 'Buy order created';
  }

  if (label.startsWith('Creating sell order')) {
    return 'Sell order created';
  }

  const exactMessages: Record<string, string> = {
    'Claiming demo NFT': 'NFT claimed',
    'Confirming test crypto receipt': 'Crypto receipt confirmed',
    'Confirming test payment': 'Payment confirmed',
    'Creating receiver': 'Receiver created',
    'Funding test XLM': 'Funded test XLM',
    'Getting Testnet USDC': 'Got Testnet USDC',
    'Opening secure export': 'Secure export ready',
    'Sign in with Google': 'Signed in',
    'Submitting KYC': 'KYC submitted',
    'Verifying Privy code': 'Verified',
  };

  return exactMessages[label] || 'Completed';
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const tabWidth = barWidth > 0 ? barWidth / state.routes.length : 0;
  const indicatorX = useSharedValue(0);

  useEffect(() => {
    indicatorX.value = withSpring(state.index * tabWidth, {
      damping: 200,
      stiffness: 160,
    });
  }, [indicatorX, state.index, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View
      style={modern.tabBar}
      onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
    >
      {tabWidth > 0 && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              width: tabWidth,
              alignItems: 'center',
            },
            indicatorStyle,
          ]}
        >
          <View style={modern.tabIndicator} />
        </Animated.View>
      )}
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate({
              name: route.name,
              params: undefined,
              merge: true,
            });
          }
        };

        return (
          <Pressable key={route.key} onPress={onPress} style={modern.tabPress}>
            <View style={modern.tabItem}>
              <View
                style={[
                  modern.tabIconWrap,
                  isFocused && modern.tabIconWrapActive,
                ]}
              >
                {options.tabBarIcon &&
                  options.tabBarIcon({
                    focused: isFocused,
                    color: isFocused ? '#B8FF45' : '#8A9AA3',
                    size: 24,
                  })}
              </View>
              <Text
                numberOfLines={1}
                style={[modern.tabText, isFocused && modern.tabTextActive]}
              >
                {label as string}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function MainTabs({
  onOpenTutorial,
  wallet,
}: {
  onOpenTutorial: () => void;
  wallet: WalletState;
}) {
  function getAssetParams(asset: BalanceItem) {
    return {
      asset,
      assetCode: asset.assetCode,
      assetIssuer: asset.assetIssuer || null,
    };
  }

  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      >
        {({ navigation }: any) => (
          <PortfolioScreen
            wallet={wallet}
            onGoToReceive={() => navigation.navigate('Receive')}
            onGoToSend={(assetCode?: string) => {
              if (assetCode) wallet.setSelectedAssetCode(assetCode);
              navigation.navigate('Send');
            }}
            onGoToWithdraw={async () => {
              await clearClosedRampOrder(wallet);
              navigation.navigate('Ramp', { direction: 'sell' });
            }}
            onGoToFaucet={() => navigation.navigate('Faucet')}
            onGoToRamp={async (preset: RampNavigationPreset = {}) => {
              await clearClosedRampOrder(wallet);
              navigation.navigate('Ramp', {
                amount: preset.amount,
                assetCode: preset.assetCode,
                autoCreate: preset.autoCreate,
                direction: preset.direction || 'buy',
              });
            }}
            onGoToAssetSearch={() => navigation.navigate('AssetSearch')}
            onGoToAssetDetail={(asset: BalanceItem) =>
              navigation.navigate('AssetDetail', getAssetParams(asset))
            }
            onGoToWallets={() => navigation.navigate('AccountTab')}
            onGoToTransaction={(id: string) =>
              navigation.navigate('TransactionDetail', { id })
            }
            onGoToHistory={() => navigation.navigate('HistoryTab')}
            onGoToScan={() => navigation.navigate('Scan')}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="HistoryTab"
        options={{
          tabBarLabel: 'Activity',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="history" size={size} color={color} />
          ),
        }}
      >
        {({ navigation }: any) => (
          <TransactionsScreen
            wallet={wallet}
            onGoToRampOrder={(order: RampOrder) => {
              wallet.openRampOrder(order).catch(() => null);
              navigation.navigate('Ramp', { source: 'history' });
            }}
            onGoToTransaction={(id: string) =>
              navigation.navigate('TransactionDetail', { id })
            }
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="SwapTab"
        options={{
          tabBarLabel: 'Swap',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="swap-horizontal"
              size={size}
              color={color}
            />
          ),
        }}
      >
        {() => <SwapScreen wallet={wallet} />}
      </Tab.Screen>

      <Tab.Screen
        name="SettingsTab"
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      >
        {({ navigation }: any) => (
          <SettingsScreen
            onOpenKyc={() => navigation.navigate('Kyc')}
            onOpenTutorial={onOpenTutorial}
            onOpenWalletConnect={() => navigation.navigate('WalletConnect')}
            wallet={wallet}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export function WalletApp({ wallet }: { wallet: WalletState }) {
  const statusText = wallet.busy || 'Loading...';
  const [completedStatusText, setCompletedStatusText] = useState<string | null>(
    null,
  );
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const previousGlobalBusyRef = useRef<string | null>(null);
  const checkedTutorialKeyRef = useRef<string | null>(null);
  const tutorialAccountKey =
    wallet.account?.id || wallet.account?.email || null;
  const tutorialStorageKey = tutorialAccountKey
    ? getWalletTutorialStorageKey(tutorialAccountKey)
    : null;
  const shouldShowLoadingBanner =
    shouldUseGlobalLoadingBanner(wallet.busy) &&
    !wallet.errorDialog &&
    !isRampOrderTerminal(wallet.activeRampOrder);
  const shouldShowSuccessBanner =
    !shouldShowLoadingBanner && Boolean(completedStatusText);
  const tutorialCanOpen =
    Boolean(wallet.account && wallet.wallet) &&
    !wallet.busy &&
    !wallet.errorDialog &&
    !wallet.sessionSyncing &&
    !shouldShowLoadingBanner &&
    !shouldShowSuccessBanner &&
    !isRampOrderTerminal(wallet.activeRampOrder);
  const shouldShowTutorial = tutorialVisible && tutorialCanOpen;

  function openTutorial() {
    setTutorialVisible(true);
  }

  function closeTutorial() {
    setTutorialVisible(false);

    if (tutorialStorageKey) {
      AsyncStorage.setItem(tutorialStorageKey, '1').catch(() => null);
    }
  }

  useEffect(() => {
    const activeGlobalBusy = shouldUseGlobalLoadingBanner(wallet.busy)
      ? wallet.busy
      : null;

    if (activeGlobalBusy) {
      previousGlobalBusyRef.current = activeGlobalBusy;
      setCompletedStatusText(null);
      return undefined;
    }

    const completedLabel = previousGlobalBusyRef.current;
    previousGlobalBusyRef.current = null;

    if (!completedLabel || wallet.errorDialog) {
      setCompletedStatusText(null);
      return undefined;
    }

    setCompletedStatusText(getCompletedStatusText(completedLabel));
    const timer = setTimeout(() => setCompletedStatusText(null), 1200);

    return () => clearTimeout(timer);
  }, [wallet.busy, wallet.errorDialog]);

  useEffect(() => {
    if (!tutorialCanOpen || !tutorialStorageKey) {
      return undefined;
    }

    if (checkedTutorialKeyRef.current === tutorialStorageKey) {
      return undefined;
    }

    checkedTutorialKeyRef.current = tutorialStorageKey;
    let cancelled = false;

    AsyncStorage.getItem(tutorialStorageKey)
      .then(value => {
        if (!cancelled && value !== '1') {
          setTutorialVisible(true);
        }
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [tutorialCanOpen, tutorialStorageKey]);

  return (
    <CurrencyProvider>
      <WalletConnectProvider wallet={wallet}>
        <View style={modern.screenFill}>
          <NavigationContainer>
            <Stack.Navigator
              screenOptions={{ headerShown: false, animation: 'default' }}
            >
              <Stack.Screen name="MainTabs">
                {props => (
                  <MainTabs
                    {...props}
                    onOpenTutorial={openTutorial}
                    wallet={wallet}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Send">
                {({ route, navigation }: any) => (
                  <SendScreen
                    wallet={wallet}
                    route={route}
                    onBack={() => navigation.goBack()}
                    onGoToScan={() => navigation.navigate('Scan')}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Receive">
                {({ navigation }: any) => (
                  <ReceiveScreen
                    wallet={wallet}
                    onBack={() => navigation.goBack()}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Faucet">
                {({ navigation }: any) => (
                  <FaucetScreen
                    wallet={wallet}
                    onBack={() => navigation.goBack()}
                    onGoToRamp={async () => {
                      await clearClosedRampOrder(wallet);
                      navigation.navigate('Ramp', { direction: 'buy' });
                    }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Ramp">
                {({ route, navigation }: any) => (
                  <RampScreen
                    onOpenKyc={() => navigation.navigate('Kyc')}
                    route={route}
                    wallet={wallet}
                    onBack={() => {
                      if (
                        route?.params?.source === 'history' &&
                        isRampOrderTerminal(wallet.activeRampOrder)
                      ) {
                        wallet.clearRampOrder().catch(() => null);
                      }

                      navigation.goBack();
                    }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="AssetSearch">
                {({ navigation }: any) => (
                  <AssetSearchScreen
                    wallet={wallet}
                    onBack={() => navigation.goBack()}
                    onGoToAssetDetail={(asset: BalanceItem) =>
                      navigation.navigate('AssetDetail', {
                        asset,
                        assetCode: asset.assetCode,
                        assetIssuer: asset.assetIssuer || null,
                      })
                    }
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="AssetDetail">
                {({ route, navigation }: any) => (
                  <AssetDetailScreen
                    wallet={wallet}
                    route={route}
                    onBack={() => navigation.goBack()}
                    onGoToReceive={() => navigation.navigate('Receive')}
                    onGoToRamp={async (direction = 'buy') => {
                      await clearClosedRampOrder(wallet);
                      navigation.navigate('Ramp', { direction });
                    }}
                    onGoToSend={(assetCode?: string) => {
                      if (assetCode) wallet.setSelectedAssetCode(assetCode);
                      navigation.navigate('Send');
                    }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="TransactionDetail">
                {({ route, navigation }: any) => {
                  const tx = wallet.transactions.find(
                    t => t.id === route.params?.id,
                  );
                  if (!tx) return null;
                  return (
                    <TransactionDetailScreen
                      wallet={wallet}
                      transaction={tx}
                      onBack={() => navigation.goBack()}
                    />
                  );
                }}
              </Stack.Screen>
              <Stack.Screen name="Scan" component={ScanScreen} />
              <Stack.Screen name="WalletConnect">
                {({ navigation }: any) => (
                  <WalletConnectScreen
                    onBack={() => navigation.goBack()}
                    onScan={() => navigation.navigate('Scan')}
                    wallet={wallet}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Kyc">
                {({ navigation }: any) => (
                  <KycScreen
                    onBack={() => navigation.goBack()}
                    wallet={wallet}
                  />
                )}
              </Stack.Screen>
            </Stack.Navigator>
          </NavigationContainer>

          <NonBlockingProgressBanner
            message={
              shouldShowLoadingBanner ? statusText : completedStatusText || ''
            }
            variant={shouldShowLoadingBanner ? 'loading' : 'success'}
            visible={shouldShowLoadingBanner || shouldShowSuccessBanner}
          />
          <WalletTutorialOverlay
            network={wallet.network}
            onClose={closeTutorial}
            visible={shouldShowTutorial}
          />
          <WalletConnectOverlays wallet={wallet} />
        </View>
      </WalletConnectProvider>
    </CurrencyProvider>
  );
}
