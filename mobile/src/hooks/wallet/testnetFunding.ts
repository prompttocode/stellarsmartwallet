import { api } from '@api/client';
import type { SwapResult } from '@app-types';
import { TRUSTLINE_SIGN_TIMEOUT_MS } from './constants';
import { isPrivyHash, withTimeout } from './privy';

export async function executeTestnetUsdcSwap({
  accountId,
  email,
  headers,
  signRawHash,
  sourceAddress,
  sourceWalletId,
  usdcIssuer,
}: {
  accountId: string;
  email: string;
  headers: Record<string, string> | undefined;
  signRawHash: (input: {
    address: string;
    chainType: 'stellar';
    hash: `0x${string}`;
  }) => Promise<{ signature: string }>;
  sourceAddress: string;
  sourceWalletId: string;
  usdcIssuer: string;
}): Promise<SwapResult> {
  const endpoint = '/api/stellar/testnet/swap/execute';
  const swapBody = {
    accountId,
    amount: '10',
    clientSigningSupported: true,
    email,
    fromAssetCode: 'XLM',
    fromAssetIssuer: null,
    sourceAddress,
    sourceWalletId,
    toAssetCode: 'USDC',
    toAssetIssuer: usdcIssuer,
  };
  let result = await api<SwapResult>(endpoint, {
    headers,
    method: 'POST',
    body: JSON.stringify(swapBody),
  });

  if (result.requiresClientSignature) {
    if (!isPrivyHash(result.hash) || !result.transactionXdr) {
      throw new Error('Could not prepare Testnet USDC funding. Please try again.');
    }

    const signedSwap = await withTimeout(
      signRawHash({
        address: sourceAddress,
        chainType: 'stellar',
        hash: result.hash,
      }),
      TRUSTLINE_SIGN_TIMEOUT_MS,
      'Wallet signing timed out. Please try again.',
    );

    result = await api<SwapResult>(endpoint, {
      headers,
      method: 'POST',
      body: JSON.stringify({
        ...swapBody,
        clientSignature: signedSwap.signature,
        signingHash: result.hash,
        transactionXdr: result.transactionXdr,
      }),
    });
  }

  return result;
}
