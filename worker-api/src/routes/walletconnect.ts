import type { Hono } from 'hono';
import {
  assertAccountWallet,
  assertStellarAddress,
  buildSubmittedTransactionItem,
  NATIVE_ASSET_CODE,
  normalizeNetwork,
  readJsonBody,
  requireAccountContext,
  reviewStellarXdr,
  signStellarXdr,
  type WorkerBindings,
} from '../core';

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

    if (sourceAddress) {
      assertStellarAddress(sourceAddress, 'Signing wallet');
    }

    return c.json(
      reviewStellarXdr({
        env: c.env,
        network,
        sourceAddress,
        xdr: body.xdr,
      }),
    );
  });

  app.post('/api/walletconnect/stellar/sign-xdr', async c => {
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const sourceWalletId = String(body.sourceWalletId || '').trim();
    const sourceAddress = String(body.sourceAddress || '').trim();
    const account = await requireAccountContext(c.env, c.req.header('authorization'), body, {
      network,
      requireAuth: true,
    });

    assertStellarAddress(sourceAddress, 'Signing wallet');
    assertAccountWallet({
      account,
      address: sourceAddress,
      network,
      walletId: sourceWalletId,
    });

    const result = await signStellarXdr({
      env: c.env,
      network,
      sourceAddress,
      submit: Boolean(body.submit),
      walletId: sourceWalletId,
      xdr: body.xdr,
    });

    return c.json({
      ...result,
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
