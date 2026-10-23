import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppPopupProvider } from '@components/common/AppPopup';
import { AppSplashScreen } from '@components/common/AppSplashScreen';
import { ErrorPopup } from '@components/common/ErrorPopup';
import { prefetchHistoricalPrices } from '@hooks/useHistoricalPrice';
import { useWallet } from '@hooks/useWallet.ios';
import { LoginScreen } from '@screens/auth/LoginScreen';
import { WalletApp } from '@screens/wallet/WalletApp.ios';
import { styles } from '@styles/walletStyles';

const STARTUP_SPLASH_MAX_MS = 3000;

export function WalletScreen() {
  const wallet = useWallet();
  const [splashTimedOut, setSplashTimedOut] = useState(false);
  const shouldShowStartupSplash =
    (wallet.sessionSyncing && !wallet.account) ||
    (!splashTimedOut && !wallet.isReady);

  useEffect(() => {
    if (wallet.account) {
      prefetchHistoricalPrices().catch(() => null);
    }
  }, [wallet.account]);

  useEffect(() => {
    const timer = setTimeout(() => setSplashTimedOut(true), STARTUP_SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppPopupProvider>
          <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
          <KeyboardAvoidingView behavior="padding" style={styles.keyboardView}>
            {shouldShowStartupSplash ? (
              <AppSplashScreen network={wallet.network} durationMs={STARTUP_SPLASH_MAX_MS} />
            ) : wallet.account ? (
              <WalletApp wallet={wallet} />
            ) : (
              <LoginScreen wallet={wallet as never} />
            )}
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
