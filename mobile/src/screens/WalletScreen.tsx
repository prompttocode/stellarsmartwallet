import React from 'react';
import { KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useWallet } from '@hooks/useWallet';
import { styles } from '@styles/walletStyles';
import { ErrorPopup } from '@components/common/ErrorPopup';
import { LoginScreen } from '@screens/auth/LoginScreen';
import { WalletApp } from '@screens/wallet/WalletApp';

export function WalletScreen() {
  const wallet = useWallet();
  const isLoggedIn = Boolean(wallet.account);
  const content = isLoggedIn ? (
    <WalletApp wallet={wallet} />
  ) : (
    <LoginScreen wallet={wallet} />
  );

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
          {content}
        </KeyboardAvoidingView>
        <ErrorPopup
          message={wallet.errorDialog?.message}
          onDismiss={wallet.dismissErrorDialog}
          title={wallet.errorDialog?.title}
          visible={Boolean(wallet.errorDialog)}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
