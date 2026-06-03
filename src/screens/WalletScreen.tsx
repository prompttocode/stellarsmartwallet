import React from 'react';
import { KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { useWalletDemo } from '../hooks/useWalletDemo';
import { styles } from '../styles/walletStyles';
import { LoginScreen } from './wallet/LoginScreen';
import { WalletApp } from './wallet/WalletApp';

export function WalletScreen() {
  const wallet = useWalletDemo();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar
          backgroundColor={wallet.account ? '#3E8FA0' : '#0F8EA3'}
          barStyle="light-content"
        />
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardView}
          >
            {wallet.account ? (
              <WalletApp wallet={wallet} />
            ) : (
              <LoginScreen wallet={wallet} />
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
      <Toast />
    </GestureHandlerRootView>
  );
}
