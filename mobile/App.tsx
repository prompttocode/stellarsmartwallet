import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PrivyProvider } from '@privy-io/expo';
import { PRIVY_APP_ID, PRIVY_CLIENT_ID } from '@config';
import { WalletScreen } from '@screens/WalletScreen';

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
        <BottomSheetModalProvider>
          <WalletScreen />
        </BottomSheetModalProvider>
      </PrivyProvider>
    </GestureHandlerRootView>
  );
}

export default App;
