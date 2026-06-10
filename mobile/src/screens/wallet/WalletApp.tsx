import React from 'react';
import { View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { modern } from '@components/wallet';
import { LoadingOverlay } from '@components/common/LoadingOverlay';
import { CurrencyProvider } from '@contexts/CurrencyContext';
import type { WalletState } from '@hooks/useWallet';
import { isRampOrderTerminal } from '@utils/ramp';

import { PortfolioScreen } from '@screens/wallet/PortfolioScreen';
import { ReceiveScreen } from '@screens/wallet/ReceiveScreen';
import { SendScreen } from '@screens/wallet/SendScreen';
import { SwapScreen } from '@screens/wallet/SwapScreen';
import { FaucetScreen } from '@screens/wallet/FaucetScreen';
import { RampScreen } from '@screens/wallet/RampScreen';
import { AccountScreen } from '@screens/wallet/AccountScreen';
import { AssetDetailScreen } from '@screens/wallet/AssetDetailScreen';
import { AssetSearchScreen } from '@screens/wallet/AssetSearchScreen';
import { TransactionDetailScreen } from '@screens/wallet/TransactionDetailScreen';
import { TransactionsScreen } from '@screens/wallet/TransactionsScreen';
import { ScanScreen } from '@screens/wallet/ScanScreen';
import type { BalanceItem, RampOrder } from '@app-types';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs({ wallet }: { wallet: WalletState }) {
  function getAssetParams(asset: BalanceItem) {
    return {
      asset,
      assetCode: asset.assetCode,
      assetIssuer: asset.assetIssuer || null,
    };
  }

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#111318',
        tabBarInactiveTintColor: '#9298A1',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#ECEEF1',
          paddingBottom: 24, // Assuming safe area inset
          paddingTop: 8,
          height: 80,
        },
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
            onGoToWithdraw={() =>
              navigation.navigate('Ramp', { direction: 'sell' })
            }
            onGoToFaucet={() => navigation.navigate('Faucet')}
            onGoToRamp={() => navigation.navigate('Ramp', { direction: 'buy' })}
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
        name="AccountTab"
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      >
        {() => <AccountScreen wallet={wallet} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export function WalletApp({ wallet }: { wallet: WalletState }) {
  const networkStatus = wallet.isMainnet
    ? 'MAINNET · Real assets'
    : 'TESTNET · Demo only';
  const statusText =
    wallet.busy ||
    (wallet.message ? `${networkStatus} · ${wallet.message}` : networkStatus);
  const shouldShowLoadingOverlay =
    wallet.isBusy && !isRampOrderTerminal(wallet.activeRampOrder);

  return (
    <CurrencyProvider>
      <View style={modern.screenFill}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MainTabs">
              {props => <MainTabs {...props} wallet={wallet} />}
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
                  onGoToRamp={() =>
                    navigation.navigate('Ramp', { direction: 'buy' })
                  }
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Ramp">
              {({ route, navigation }: any) => (
                <RampScreen
                  route={route}
                  wallet={wallet}
                  onBack={() => navigation.goBack()}
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
                  onGoToRamp={(direction = 'buy') =>
                    navigation.navigate('Ramp', { direction })
                  }
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
          </Stack.Navigator>
        </NavigationContainer>

        <LoadingOverlay visible={shouldShowLoadingOverlay} message={statusText} />
      </View>
    </CurrencyProvider>
  );
}
