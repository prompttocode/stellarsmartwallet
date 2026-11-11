import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { PrivyProvider } from '@privy-io/expo';
import { PRIVY_APP_ID, PRIVY_CLIENT_ID } from '@config';
import { WalletScreen } from '@screens/WalletScreen';
import { initializeRemoteFeatureFlags } from './src/services/remoteConfig';

function App() {
  const [featureFlagsReady, setFeatureFlagsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    initializeRemoteFeatureFlags().finally(() => {
      if (mounted) {
        setFeatureFlagsReady(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!featureFlagsReady) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#AAFF33" size="large" />
      </View>
    );
  }

  return (
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
      <WalletScreen />
    </PrivyProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: '#000000',
    flex: 1,
    justifyContent: 'center',
  },
});

export default App;
