import React from 'react';
import { PrivyProvider } from '@privy-io/expo';
import { PRIVY_APP_ID, PRIVY_CLIENT_ID } from './src/config';
import { WalletScreen } from './src/screens/WalletScreen';

function App() {
  return (
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
      <WalletScreen />
    </PrivyProvider>
  );
}

export default App;
