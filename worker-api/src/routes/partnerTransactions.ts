import { Hono } from 'hono';
import { assertStellarAddress, makeError, type WorkerBindings } from '../core';

type TransactionRow = {
  id: number;
  walletAddress: string;
  network: string;
  operationId: string;
  transactionHash: string;
  direction: string;
  operation: string;
  assetCode: string;
  assetIssuer: string | null;
  amount: string;
  fromAddress: string | null;
  toAddress: string | null;
  ledger: number | null;
  createdAt: string;
  syncedAt: string;
};

function positiveInteger(value: string, name: string, max = Number.MAX_SAFE_INTEGER) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) {
    throw makeError(`Invalid ${name}`, 400);
  }
  return Number(value);
}

function timestamp(value: string, name: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw makeError(`Invalid ${name}; use a UTC ISO timestamp`, 400);
  }
  const normalized = new Date(value).toISOString();
  if (normalized.replace('.000Z', 'Z') !== value.replace('.000Z', 'Z')) {
    throw makeError(`Invalid ${name}`, 400);
  }
  return normalized;
}

export function registerPartnerTransactionRoutes(app: Hono<WorkerBindings>) {
  app.get('/api/partner/transactions', async c => {
    c.header('Cache-Control', 'no-store');
    const expected = c.env.PARTNER_TRANSACTIONS_API_KEY?.trim();
    if (!expected) {
      throw makeError('Partner transaction access is not configured', 503);
    }
    const supplied = c.req.header('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1] || '';
    const digest = (value: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    const [suppliedDigest, expectedDigest] = await Promise.all([digest(supplied), digest(expected)]);
    if (!crypto.subtle.timingSafeEqual(suppliedDigest, expectedDigest)) {
      throw makeError('Invalid partner transaction API key', 401);
    }

    const limit = positiveInteger(c.req.query('limit') ?? '50', 'limit (1–100)', 100);
    const cursor = c.req.query('cursor');
    const network = c.req.query('network');
    const wallet = c.req.query('wallet');
    const from = c.req.query('from');
    const to = c.req.query('to');
    const conditions: string[] = [];
    const values: (string | number)[] = [];
    if (cursor !== undefined) {
      conditions.push('rowid < ?');
      values.push(positiveInteger(cursor, 'cursor'));
    }
    if (network !== undefined) {
      if (network !== 'mainnet' && network !== 'testnet') {
        throw makeError('Invalid network', 400);
      }
      conditions.push('network = ?');
      values.push(network);
    }
    if (wallet !== undefined) {
      assertStellarAddress(wallet, 'wallet');
      conditions.push('wallet_address = ?');
      values.push(wallet);
    }
    const fromTime = from !== undefined ? timestamp(from, 'from') : undefined;
    const toTime = to !== undefined ? timestamp(to, 'to') : undefined;
    if (fromTime && toTime && fromTime >= toTime) {
      throw makeError('from must be earlier than to', 400);
    }
    if (fromTime) {
      conditions.push('julianday(created_at) >= julianday(?)');
      values.push(fromTime);
    }
    if (toTime) {
      conditions.push('julianday(created_at) < julianday(?)');
      values.push(toTime);
    }

    // Explicit public-field projection: never expose account email, KYC or raw JSON.
    const result = await c.env.DB.prepare(`
      SELECT rowid AS id, wallet_address AS walletAddress, network,
        operation_id AS operationId, transaction_hash AS transactionHash,
        direction, operation, asset_code AS assetCode, asset_issuer AS assetIssuer,
        amount, from_address AS fromAddress, to_address AS toAddress, ledger,
        created_at AS createdAt, synced_at AS syncedAt
      FROM account_transactions
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY rowid DESC LIMIT ?
    `).bind(...values, limit + 1).all<TransactionRow>();
    const rows = result.results || [];
    const page = rows.slice(0, limit);
    return c.json({
      data: page.map(row => ({ ...row, id: String(row.id) })),
      nextCursor: rows.length > limit ? String(page[page.length - 1].id) : null,
      limit,
    });
  });
}
