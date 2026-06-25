import type { Hono } from 'hono';
import {
  assertAccountWallet,
  assertStellarAddress,
  buildSubmittedTransactionItem,
  makeError,
  NATIVE_ASSET_CODE,
  normalizeNetwork,
  readJsonBody,
  requireAccountContext,
  reviewStellarXdr,
  signStellarXdr,
  type WorkerBindings,
} from '../core';

function maskAddress(value: string) {
  return value.length > 12
    ? `${value.slice(0, 6)}...${value.slice(-6)}`
    : value;
}

function walletConnectLog(
  level: 'error' | 'info' | 'warn',
  event: string,
  details: Record<string, unknown>,
) {
  const entry = JSON.stringify({
    event,
    service: 'walletconnect',
    timestamp: new Date().toISOString(),
    ...details,
  });

  if (level === 'error') {
    console.error(entry);
  } else if (level === 'warn') {
    console.warn(entry);
  } else {
    console.info(entry);
  }
}

function normalizeClientSignature(value: unknown) {
  const signature = String(value || '').trim();

  if (!signature) {
    return null;
  }

  if (!/^(0x)?[0-9a-fA-F]+$/.test(signature)) {
    throw makeError('Invalid Stellar signature format', 400);
  }

  const signatureHex = signature.replace(/^0x/i, '');

  if (signatureHex.length !== 128) {
    throw makeError('Invalid Stellar signature format', 400);
  }

  return signatureHex;
}

export function registerWalletConnectRoutes(app: Hono<WorkerBindings>) {
  app.get('/api/walletconnect/config', c =>
    c.json({
      configured: Boolean(c.env.WALLETCONNECT_PROJECT_ID),
      projectId: c.env.WALLETCONNECT_PROJECT_ID || null,
      relays: ['wss://relay.walletconnect.com'],
    }),
  );

  app.post('/api/walletconnect/stellar/review-xdr', async c => {
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const sourceAddress = String(body.sourceAddress || '').trim();
    const method = String(body.method || '').trim();
    const peerName = String(body.peerName || '').trim();
    const topic = String(body.topic || '').trim();

    if (sourceAddress) {
      assertStellarAddress(sourceAddress, 'Signing wallet');
    }

    try {
      const review = reviewStellarXdr({
        env: c.env,
        network,
        sourceAddress,
        xdr: body.xdr,
      });

      walletConnectLog('info', 'walletconnect.xdr_reviewed', {
        method: method || null,
        network,
        operationCount: review.operationCount,
        peerName: peerName || null,
        sourceAddress: sourceAddress ? maskAddress(sourceAddress) : null,
        topic: topic || null,
      });

      return c.json(review);
    } catch (error) {
      walletConnectLog('warn', 'walletconnect.xdr_review_rejected', {
        error: error instanceof Error ? error.message : String(error),
        method: method || null,
        network,
        peerName: peerName || null,
        sourceAddress: sourceAddress ? maskAddress(sourceAddress) : null,
        topic: topic || null,
      });
      throw error;
    }
  });

  app.post('/api/walletconnect/stellar/sign-xdr', async c => {
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const sourceWalletId = String(body.sourceWalletId || '').trim();
    const sourceAddress = String(body.sourceAddress || '').trim();
    const method = String(body.method || '').trim();
    const peerName = String(body.peerName || '').trim();
    const topic = String(body.topic || '').trim();
    const account = await requireAccountContext(c.env, c.req.header('authorization'), body, {
      network,
      requireAuth: true,
    });
    const clientSignatureHex = normalizeClientSignature(
      body.clientSignature || body.signature,
    );
    const expectedSigningHash = String(
      body.signingHash || body.hash || '',
    ).trim();

    assertStellarAddress(sourceAddress, 'Signing wallet');
    const sourceWallet = assertAccountWallet({
      account,
      address: sourceAddress,
      network,
      walletId: sourceWalletId,
    });

    let result: Awaited<ReturnType<typeof signStellarXdr>>;

    try {
      result = await signStellarXdr({
        env: c.env,
        network,
        clientSigningSupported: body.clientSigningSupported === true,
        clientSignatureHex,
        sourceAddress,
        submit: Boolean(body.submit),
        wallet: sourceWallet,
        walletId: sourceWalletId,
        xdr: clientSignatureHex && body.transactionXdr
          ? body.transactionXdr
          : body.xdr,
      });
    } catch (error) {
      walletConnectLog('error', 'walletconnect.sign_failed', {
        error: error instanceof Error ? error.message : String(error),
        method: method || null,
        network,
        peerName: peerName || null,
        sourceAddress: maskAddress(sourceAddress),
        submit: Boolean(body.submit),
        topic: topic || null,
      });
      throw error;
    }

    if (
      clientSignatureHex &&
      expectedSigningHash &&
      result.signingHash &&
      expectedSigningHash.toLowerCase() !== result.signingHash.toLowerCase()
    ) {
      throw makeError('Transaction changed before signing. Please try again.', 409);
    }

    if (result.requiresClientSignature) {
      walletConnectLog('info', 'walletconnect.sign_challenge_created', {
        method: method || null,
        network,
        operationCount: result.review.operationCount,
        peerName: peerName || null,
        sourceAddress: maskAddress(sourceAddress),
        submit: Boolean(body.submit),
        topic: topic || null,
      });

      return c.json(
        {
          ...result,
          hash: null,
          transaction: null,
        },
        202,
      );
    }

    walletConnectLog('info', 'walletconnect.signed', {
      hash: result.submitted?.hash || null,
      method: method || null,
      network,
      operationCount: result.review.operationCount,
      peerName: peerName || null,
      sourceAddress: maskAddress(sourceAddress),
      submit: Boolean(body.submit),
      topic: topic || null,
    });

    return c.json({
      ...result,
      hash: result.submitted?.hash || null,
      transaction: result.submitted
        ? buildSubmittedTransactionItem({
            amount: '0',
            assetCode: NATIVE_ASSET_CODE,
            direction: 'sent',
            env: c.env,
            from: sourceAddress,
            network,
            operation: 'payment',
            submitted: result.submitted,
            to: sourceAddress,
          })
        : null,
    });
  });

}
