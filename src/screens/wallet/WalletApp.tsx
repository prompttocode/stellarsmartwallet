import React, { useEffect } from 'react';
import { StatusBar, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { StatusDot } from '../../components/WalletPrimitives';
import { modern } from '../../components/wallet/ModernWalletUI';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { CurrencyProvider } from '../../contexts/CurrencyContext';
import type { WalletDemoState } from '../../hooks/useWalletDemo';

import { PortfolioScreen } from './PortfolioScreen';
import { ReceiveScreen } from './ReceiveScreen';
import { SendScreen } from './SendScreen';
import { SwapScreen } from './SwapScreen';
import { TopUpScreen } from './TopUpScreen';
import { AccountScreen } from './AccountScreen';
import { TransactionDetailScreen } from './TransactionDetailScreen';
import { ScanScreen } from './ScanScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs({ wallet }: { wallet: WalletDemoState }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3E8FA0',
        tabBarInactiveTintColor: '#8A9AA3',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E8EB',
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
            onGoToSwap={() => navigation.navigate('SwapTab')}
            onGoToTopUp={() => navigation.navigate('TopUp')}
            onGoToWallets={() => navigation.navigate('AccountTab')}
            onGoToTransaction={(id: string) => navigation.navigate('TransactionDetail', { id })}
            onGoToScan={() => navigation.navigate('Scan')}
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
          tabBarLabel: 'Account',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      >
        {() => <AccountScreen wallet={wallet} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export function WalletApp({ wallet }: { wallet: WalletDemoState }) {
  const statusText = wallet.busy || wallet.message;

  return (
    <CurrencyProvider>
      <View style={modern.screenFill}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MainTabs">
              {(props) => <MainTabs {...props} wallet={wallet} />}
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
            <Stack.Screen name="TopUp">
              {({ navigation }: any) => (
                <TopUpScreen
                  wallet={wallet}
                  onBack={() => navigation.goBack()}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="TransactionDetail">
              {({ route, navigation }: any) => {
                const tx = wallet.transactions.find((t) => t.id === route.params?.id);
                if (!tx) return null;
                return (
                  <TransactionDetailScreen
                    wallet={wallet}
                    transaction={tx}
                    onBack={() => navigation.goBack()}
                  />
                )
              }}
            </Stack.Screen>
            <Stack.Screen name="Scan" component={ScanScreen} />
          </Stack.Navigator>
        </NavigationContainer>

        <View style={modern.appStatus}>
          <StatusDot active={Boolean(wallet.health?.ok)} />
          <Text numberOfLines={1} style={modern.statusText}>
            {statusText}
          </Text>
        </View>
        <LoadingOverlay visible={wallet.isBusy} message={statusText} />
      </View>
    </CurrencyProvider>
  );
}
