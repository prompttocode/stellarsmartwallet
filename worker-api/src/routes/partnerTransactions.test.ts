import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { registerPartnerTransactionRoutes } from './partnerTransactions';
import type { WorkerBindings } from '../core';

const originalCrypto = crypto;

function setup(rows: { id: number; transactionHash: string }[] = [], key: string | undefined = 'test-read-key') {
  // Node's WebCrypto does not implement the Workers timingSafeEqual extension.
  vi.stubGlobal('crypto', {
    subtle: {
      digest: originalCrypto.subtle.digest.bind(originalCrypto.subtle),
      timingSafeEqual: (left: ArrayBuffer, right: ArrayBuffer) =>
        new Uint8Array(left).every((byte, index) => byte === new Uint8Array(right)[index]),
    },
  });
  const all = vi.fn().mockResolvedValue({ results: rows });
  const bind = vi.fn().mockReturnValue({ all });
  const prepare = vi.fn().mockReturnValue({ bind });
  const env = { DB: { prepare }, PARTNER_TRANSACTIONS_API_KEY: key };
  const app = new Hono<WorkerBindings>();
  app.onError((error, c) => c.json({ error: error.message },
    ((error as Error & { status?: number }).status || 500) as 400));
  registerPartnerTransactionRoutes(app);
  const request = (query = '', authorization = 'Bearer test-read-key') =>
    app.request(`/api/partner/transactions${query}`, {
      headers: { Authorization: authorization },
    }, env as never);
  return { request, prepare, bind };
}

afterEach(() => vi.unstubAllGlobals());

describe('partner transaction read API', () => {
  it('rejects missing and incorrect keys before querying the DB', async () => {
    const { request, prepare } = setup();
    for (const authorization of ['', 'Bearer wrong', 'Bearer test-payment-key']) {
      expect((await request('', authorization)).status).toBe(401);
    }
    expect(prepare).not.toHaveBeenCalled();
  });

  it('fails closed when the dedicated key is not configured', async () => {
    const { request, prepare } = setup([], '');
    expect((await request()).status).toBe(503);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('limits pages and returns a cursor while selecting only public columns', async () => {
    const { request, prepare, bind } = setup([
      { id: 10, transactionHash: 'hash-a' }, { id: 9, transactionHash: 'hash-b' },
    ]);
    const response = await request('?limit=1&network=testnet&cursor=12');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      data: [{ id: '10', transactionHash: 'hash-a' }], nextCursor: '10', limit: 1,
    });
    expect(bind).toHaveBeenCalledWith(12, 'testnet', 2);
    const sql = prepare.mock.calls[0][0];
    expect(sql).toContain('rowid < ?');
    expect(sql).not.toMatch(/account_email|\bdata\b|SELECT\s+\*/i);
  });

  it('returns an empty final page and binds date boundaries', async () => {
    const { request, bind } = setup();
    const response = await request('?from=2026-09-01T00:00:00Z&to=2026-09-08T00:00:00Z');
    expect(await response.json()).toEqual({ data: [], nextCursor: null, limit: 50 });
    expect(bind).toHaveBeenCalledWith('2026-09-01T00:00:00.000Z', '2026-09-08T00:00:00.000Z', 51);
  });

  it('rejects invalid pagination, filters and calendar dates', async () => {
    const { request, prepare } = setup();
    for (const query of ['limit=101', 'limit=-1', 'cursor=0', 'cursor=9007199254740992',
      'network=invalid', 'wallet=invalid', 'from=bad', 'from=2026-02-30T00:00:00Z',
      'from=2026-09-08T00:00:00Z&to=2026-09-01T00:00:00Z']) {
      expect((await request(`?${query}`)).status, query).toBe(400);
    }
    expect(prepare).not.toHaveBeenCalled();
  });
});
