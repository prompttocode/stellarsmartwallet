import WalletKitClient from '@reown/walletkit';
import { Core } from '@walletconnect/core';
import { API_BASE_URL } from '@config';

let walletKitPromise: Promise<WalletKitClient> | null = null;
let walletKitProjectId: string | null = null;

export function getWalletKit(projectId: string) {
  if (walletKitPromise && walletKitProjectId === projectId) {
    return walletKitPromise;
  }

  walletKitProjectId = projectId;
  walletKitPromise = WalletKitClient.init({
    core: new Core({
      projectId,
      telemetryEnabled: false,
    }),
    metadata: {
      description: 'A Privy-secured Stellar wallet',
      icons: [],
      name: 'Privy Stellar Wallet',
      redirect: {
        native: 'privy://',
      },
      url: API_BASE_URL,
    },
    signConfig: {
      disableRequestQueue: false,
    },
  });

  return walletKitPromise;
}
