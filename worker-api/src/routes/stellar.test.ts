import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const { requireAccountContext } = vi.hoisted(() => ({
  requireAccountContext: vi.fn(),
}));

vi.mock('../core', () => ({
  assertAccountWallet: vi.fn(),
  assertStellarAddress: vi.fn(),
  makeError: (message: string, status = 500) => {
    const error = new Error(message) as Error & { status: number };
    error.status = status;
    return error;
  },
  normalizeNetwork: (value: unknown) =>
    value === 'mainnet' ? 'mainnet' : 'testnet',
  readJsonBody: (context: { req: { json: () => Promise<unknown> } }) =>
    context.req.json(),
  requireAccountContext,
}));

vi.mock('../exchangeEligibility', () => ({
  assertExchangeEligibility: vi.fn(),
}));

import { registerStellarRoutes } from './stellar';

function createApp() {
  const app = new Hono();

  app.onError((error, c) =>
    c.json(
      { error: error.message },
      ((error as Error & { status?: number }).status || 500) as 400,
    ),
  );
  registerStellarRoutes(app as never);

  return app;
}

describe('Stellar swap authentication', () => {
  beforeEach(() => {
    requireAccountContext.mockReset();
    requireAccountContext.mockRejectedValue(
      Object.assign(new Error('Privy session is required for this action'), {
        status: 401,
      }),
    );
  });

  for (const route of ['quote', 'execute']) {
    it(`requires a Privy session for Testnet ${route}`, async () => {
      const app = createApp();
      const response = await app.request(
        `/api/stellar/testnet/swap/${route}`,
        {
          body: JSON.stringify({
            sourceAddress: 'GTESTWALLET',
            sourceWalletId: 'wallet-1',
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
      );

      expect(response.status).toBe(401);
      expect(requireAccountContext).toHaveBeenCalledWith(
        undefined,
        undefined,
        expect.any(Object),
        expect.objectContaining({ network: 'testnet', requireAuth: true }),
      );
    });
  }
});
