import React from 'react';
import { Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CurrencyProvider } from '@contexts/CurrencyContext';
import { WalletConnectProvider } from '@contexts/WalletConnectContext';
import { WalletConnectOverlays } from '@components/wallet/WalletConnectOverlays.ios';
import type { BalanceItem } from '@app-types';
import type { WalletState } from '@hooks/useWallet.ios';
import { AssetDetailScreen } from './AssetDetailScreen.ios';
import { AssetSearchScreen } from './AssetSearchScreen';
import { PortfolioScreen } from './PortfolioScreen.ios';
import { ReceiveScreen } from './ReceiveScreen.ios';
import { ScanScreen } from './ScanScreen';
import { SendScreen } from './SendScreen.ios';
import { SettingsScreen } from './SettingsScreen.ios';
import { TransactionDetailScreen } from './TransactionDetailScreen.ios';
import { TransactionsScreen } from './TransactionsScreen.ios';
import { WalletConnectScreen } from './WalletConnectScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs({ wallet }: { wallet: WalletState }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#B8FF45',
        tabBarInactiveTintColor: '#8995A3',
        tabBarStyle: {
          backgroundColor: '#050607',
          borderTopColor: '#171A1F',
          height: 78,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '800' },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="home-outline" size={size} />
          ),
          tabBarLabel: 'Home',
        }}
      >
        {({ navigation }: any) => (
          <PortfolioScreen
            onGoToAssetDetail={(asset: BalanceItem) =>
              navigation.navigate('AssetDetail', {
                asset,
                assetCode: asset.assetCode,
                assetIssuer: asset.assetIssuer || null,
              })
            }
            onGoToAssetSearch={() => navigation.navigate('AssetSearch')}
            onGoToHistory={() => navigation.navigate('ActivityTab')}
            onGoToReceive={() => navigation.navigate('Receive')}
            onGoToScan={() => navigation.navigate('Scan')}
            onGoToSend={(assetCode?: string) => {
              if (assetCode) wallet.setSelectedAssetCode(assetCode);
              navigation.navigate('Send');
            }}
            onGoToTransaction={(id: string) =>
              navigation.navigate('TransactionDetail', { id })
            }
            onGoToWallets={() => undefined}
            wallet={wallet}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="ActivityTab"
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons color={color} name="history" size={size} />
          ),
          tabBarLabel: 'Activity',
        }}
      >
        {({ navigation }: any) => (
          <TransactionsScreen
            onGoToTransaction={(id: string) =>
              navigation.navigate('TransactionDetail', { id })
            }
            wallet={wallet}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="SettingsTab"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="settings-outline" size={size} />
          ),
          tabBarLabel: 'Settings',
        }}
      >
        {({ navigation }: any) => (
          <SettingsScreen
            onOpenWalletConnect={() => navigation.navigate('WalletConnect')}
            wallet={wallet}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export function WalletApp({ wallet }: { wallet: WalletState }) {
  return (
    <CurrencyProvider>
      <WalletConnectProvider wallet={wallet}>
        <View style={{ backgroundColor: '#000000', flex: 1 }}>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Main">
                {() => <MainTabs wallet={wallet} />}
              </Stack.Screen>
              <Stack.Screen name="Receive">
                {({ navigation }: any) => (
                  <ReceiveScreen
                    onBack={() => navigation.goBack()}
                    wallet={wallet}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Send">
                {({ navigation }: any) => (
                  <SendScreen
                    onBack={() => navigation.goBack()}
                    onGoToScan={() => navigation.navigate('Scan')}
                    wallet={wallet}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="AssetSearch">
                {({ navigation }: any) => (
                  <AssetSearchScreen
                    onBack={() => navigation.goBack()}
                    onGoToAssetDetail={(asset: BalanceItem) =>
                      navigation.navigate('AssetDetail', {
                        asset,
                        assetCode: asset.assetCode,
                        assetIssuer: asset.assetIssuer || null,
                      })
                    }
                    wallet={wallet as never}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="AssetDetail">
                {({ navigation, route }: any) => (
                  <AssetDetailScreen
                    onBack={() => navigation.goBack()}
                    onGoToReceive={() => navigation.navigate('Receive')}
                    onGoToSend={(assetCode?: string) => {
                      if (assetCode) wallet.setSelectedAssetCode(assetCode);
                      navigation.navigate('Send');
                    }}
                    route={route}
                    wallet={wallet}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="TransactionDetail">
                {({ navigation, route }: any) => {
                  const transaction = wallet.transactions.find(
                    item => item.id === route.params?.id,
                  );

                  if (!transaction) {
                    return (
                      <View
                        style={{
                          alignItems: 'center',
                          flex: 1,
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#FFFFFF' }}>
                          Transaction not found.
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <TransactionDetailScreen
                      onBack={() => navigation.goBack()}
                      transaction={transaction}
                      wallet={wallet}
                    />
                  );
                }}
              </Stack.Screen>
              <Stack.Screen name="Scan">
                {({ navigation }: any) => (
                  <ScanScreen navigation={navigation} />
                )}
              </Stack.Screen>
              <Stack.Screen name="WalletConnect">
                {({ navigation }: any) => (
                  <WalletConnectScreen
                    onBack={() => navigation.goBack()}
                    onScan={() => navigation.navigate('Scan')}
                    wallet={wallet as never}
                  />
                )}
              </Stack.Screen>
            </Stack.Navigator>
          </NavigationContainer>
          <WalletConnectOverlays wallet={wallet} />
        </View>
      </WalletConnectProvider>
    </CurrencyProvider>
  );
}
