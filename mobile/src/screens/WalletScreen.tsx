import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useWallet } from '@hooks/useWallet';
import { prefetchHistoricalPrices } from '@hooks/useHistoricalPrice';
import { styles } from '@styles/walletStyles';
import { AppPopupProvider } from '@components/common/AppPopup';
import { AppSplashScreen } from '@components/common/AppSplashScreen';
import { ErrorPopup } from '@components/common/ErrorPopup';
import { LoginScreen } from '@screens/auth/LoginScreen';
import { WalletApp } from '@screens/wallet/WalletApp';

const STARTUP_SPLASH_MAX_MS = 3000;

export function WalletScreen() {
  const wallet = useWallet();
  const [splashTimedOut, setSplashTimedOut] = useState(false);
  const isLoggedIn = Boolean(wallet.account);
  const isRestoringWithoutWallet = wallet.sessionSyncing && !wallet.account;
  const shouldShowStartupSplash =
    isRestoringWithoutWallet || (!splashTimedOut && !wallet.isReady);

  useEffect(() => {
    prefetchHistoricalPrices().catch(() => null);
  }, []);

  useEffect(() => {
    const maxTimer = setTimeout(
      () => setSplashTimedOut(true),
      STARTUP_SPLASH_MAX_MS,
    );

    return () => clearTimeout(maxTimer);
  }, []);

  const content = shouldShowStartupSplash ? (
    <AppSplashScreen
      network={wallet.network}
      durationMs={STARTUP_SPLASH_MAX_MS}
    />
  ) : isLoggedIn ? (
    <WalletApp wallet={wallet} />
  ) : (
    <LoginScreen wallet={wallet} />
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppPopupProvider>
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
        </AppPopupProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
