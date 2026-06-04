import React from 'react';
import { KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { useWalletDemo } from '../hooks/useWalletDemo';
import { styles } from '../styles/walletStyles';
import { LoginScreen } from './auth/LoginScreen';
import { WalletApp } from './wallet/WalletApp';

export function WalletScreen() {
  const wallet = useWalletDemo();
  const isLoggedIn = Boolean(wallet.account);

  if (isLoggedIn) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar
            backgroundColor="transparent"
            barStyle="light-content"
            translucent
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardView}
          >
            <WalletApp wallet={wallet} />
          </KeyboardAvoidingView>
          <Toast />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar
          backgroundColor="transparent"
          barStyle="light-content"
          translucent
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <LoginScreen wallet={wallet} />
        </KeyboardAvoidingView>

        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
