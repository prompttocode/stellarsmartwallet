import type { Context, Hono } from 'hono';
import { Keypair } from '@stellar/stellar-sdk';
import {
  assertAccountWallet,
  assertSecretKey,
  assertStellarAddress,
  buildAccountSession,
  buildTrustlineTransaction,
  completeStellarWalletSecretExport,
  createPrivyUser,
  createSignableStellarWallet,
  decodeWalletExportChallenge,
  encryptWalletSecret,
  findPrivyUserByEmail,
  friendbotFund,
  getAccountBalances,
  getAccountByEmail,
  getAccountHistory,
  getEmailFromPrivyUser,
  getIssuedAsset,
  getOrCreateSessionAccountByEmail,
  getPrivyClient,
  getStellarServer,
  getSupportedAssets,
  getVisibleWallets,
  isEmailLike,
  listNetworks,
  loadAccount,
  makeError,
  normalizeAccountWallets,
  normalizeAssetCode,
  normalizeEmail,
  normalizeNetwork,
  normalizeWallet,
  nowIso,
  prepareStellarWalletSecretExport,
  privyRequest,
  readJsonBody,
  requireAccountContext,
  sanitizeWalletName,
  saveAccount,
  saveContact,
  shouldRequireMainnetAuth,
  type Env,
  type StellarNetwork,
  type WorkerBindings,
} from '../core';

type ClientStellarWalletInput = {
  address?: string;
  chain_type?: string;
  display_name?: string;
  id?: string;
  public_key?: string;
};

type StoredFavoriteAssetRow = {
  account_email: string;
  asset_code: string;
  asset_issuer: string;
  created_at: string;
  display_name: string;
  home_domain: string | null;
  id: string;
  image: string | null;
  network: StellarNetwork;
  updated_at: string;
};

type FavoriteAssetInput = {
  assetCode: string;
  assetIssuer: string;
  displayName: string;
  homeDomain: string | null;
  image: string | null;
  network: StellarNetwork;
};

function getClientStellarWalletInput(value: unknown) {
  const wallet = value as ClientStellarWalletInput | undefined;

  return wallet?.id && wallet.address ? wallet : undefined;
}

function requireFavoriteAssetsDb(env: Env) {
  if (!env.DB) {
    throw makeError('Favorite asset storage is not configured', 500);
  }

  return env.DB;
}

function optionalText(value: unknown) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeFavoriteAssetInput(value: Record<string, unknown>): FavoriteAssetInput {
  const network = normalizeNetwork(value.network);
  const assetCode = normalizeAssetCode(value.assetCode || value.asset_code).trim();
  const assetIssuer = String(value.assetIssuer ?? value.asset_issuer ?? '').trim();
  const isNative = assetCode === 'XLM' && !assetIssuer;

  if (!/^[A-Za-z0-9]{1,12}$/.test(assetCode)) {
    throw makeError('Asset code must be 1-12 alphanumeric characters', 400);
  }

  if (assetIssuer) {
    assertStellarAddress(assetIssuer, 'Asset issuer');
  }

  if (!isNative && !assetIssuer) {
    throw makeError('Asset issuer is required for issued assets', 400);
  }

  return {
    assetCode,
    assetIssuer: isNative ? '' : assetIssuer,
    displayName:
      String(value.displayName || value.display_name || assetCode)
        .trim()
        .slice(0, 80) || assetCode,
    homeDomain: optionalText(value.homeDomain ?? value.home_domain),
    image: optionalText(value.image),
    network,
  };
}

function serializeFavoriteAsset(row: StoredFavoriteAssetRow) {
  const isNative = row.asset_code === 'XLM' && !row.asset_issuer;

  return {
    assetCode: row.asset_code,
    assetIssuer: row.asset_issuer || null,
    createdAt: row.created_at,
    demo: row.network === 'testnet',
    displayName: row.display_name || row.asset_code,
    homeDomain: row.home_domain || null,
    id: row.id,
    image: row.image || null,
    isNative,
    network: row.network,
    trustLevel: isNative ? 'verified' : row.home_domain ? 'verified' : 'discovered',
    updatedAt: row.updated_at,
  };
}

async function getFavoriteAssetAccount(
  c: Context<WorkerBindings>,
  value: Record<string, unknown>,
) {
  const network = normalizeNetwork(value.network);
  const account = await requireAccountContext(c.env, c.req.header('authorization'), value, {
    network,
    requireAuth: true,
  });

  return { account, network };
}

async function listFavoriteAssets(env: Env, accountEmail: string, network: StellarNetwork) {
  const { results } = await requireFavoriteAssetsDb(env)
    .prepare(
      `SELECT *
       FROM account_favorite_assets
       WHERE account_email = ? AND network = ?
       ORDER BY updated_at DESC`,
    )
    .bind(accountEmail, network)
    .all<StoredFavoriteAssetRow>();

  return (results || []).map(serializeFavoriteAsset);
}

async function findFavoriteAssetById(env: Env, accountEmail: string, id: string) {
  const row = await requireFavoriteAssetsDb(env)
    .prepare(
      `SELECT *
       FROM account_favorite_assets
       WHERE account_email = ? AND id = ?
       LIMIT 1`,
    )
    .bind(accountEmail, id)
    .first<StoredFavoriteAssetRow>();

  return row ? serializeFavoriteAsset(row) : null;
}

async function findFavoriteAssetByIdentity(
  env: Env,
  accountEmail: string,
  input: FavoriteAssetInput,
) {
  const row = await requireFavoriteAssetsDb(env)
    .prepare(
      `SELECT *
       FROM account_favorite_assets
       WHERE account_email = ? AND network = ? AND asset_code = ? AND asset_issuer = ?
       LIMIT 1`,
    )
    .bind(accountEmail, input.network, input.assetCode, input.assetIssuer)
    .first<StoredFavoriteAssetRow>();

  return row ? serializeFavoriteAsset(row) : null;
}

async function upsertFavoriteAsset(
  env: Env,
  accountEmail: string,
  input: FavoriteAssetInput,
) {
  const existing = await findFavoriteAssetByIdentity(env, accountEmail, input);
  const now = nowIso();
  const id = existing?.id || crypto.randomUUID();

  await requireFavoriteAssetsDb(env)
    .prepare(
      `INSERT INTO account_favorite_assets (
         id,
         account_email,
         network,
         asset_code,
         asset_issuer,
         display_name,
         home_domain,
         image,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_email, network, asset_code, asset_issuer) DO UPDATE SET
         display_name = excluded.display_name,
         home_domain = excluded.home_domain,
         image = excluded.image,
         updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      accountEmail,
      input.network,
      input.assetCode,
      input.assetIssuer,
      input.displayName,
      input.homeDomain,
      input.image,
      existing?.createdAt || now,
      now,
    )
    .run();

  return findFavoriteAssetById(env, accountEmail, id);
}

async function getVerifiedClientStellarWallet(
  c: Context<WorkerBindings>,
  wallet: ClientStellarWalletInput | undefined,
) {
  if (!wallet) {
    return undefined;
  }

  const remoteWallet = await (getPrivyClient(c.env) as any)
    .wallets()
    .get(wallet.id);
  const remoteAddress = String(remoteWallet?.address || '').trim();
  const clientAddress = String(wallet.address || '').trim();

  if (remoteAddress.toLowerCase() !== clientAddress.toLowerCase()) {
    throw makeError('Privy wallet does not match the client wallet', 400);
  }

  if (String(remoteWallet?.chain_type || '').toLowerCase() !== 'stellar') {
    throw makeError('Only Stellar wallets can be added here', 400);
  }

  return remoteWallet as Parameters<typeof normalizeWallet>[0];
}

type SessionTimingEntry = {
  durationMs: number;
  name: string;
};

function createSessionTiming(path: string) {
  const startedAt = performance.now();
  const entries: SessionTimingEntry[] = [];

  function record(name: string, durationMs: number) {
    entries.push({
      durationMs,
      name,
    });
  }

  async function time<T>(name: string, task: () => Promise<T>) {
    const stepStartedAt = performance.now();

    try {
      return await task();
    } finally {
      record(name, performance.now() - stepStartedAt);
    }
  }

  function getTotalDurationMs() {
    return performance.now() - startedAt;
  }

  function getServerTimingHeader() {
    return [
      ...entries,
      {
        durationMs: getTotalDurationMs(),
        name: 'total',
      },
    ]
      .map(
        entry =>
          `${entry.name.replace(/[^A-Za-z0-9_-]/g, '_')};dur=${Math.max(
            0,
            entry.durationMs,
          ).toFixed(1)}`,
      )
      .join(', ');
  }

  function log(extra: Record<string, unknown> = {}) {
    const timings = entries.reduce<Record<string, number>>((result, entry) => {
      result[entry.name] = Number(entry.durationMs.toFixed(1));
      return result;
    }, {});

    console.log(
      JSON.stringify({
        event: 'api.session.timing',
        path,
        service: 'privy-stellar-api',
        timings,
        totalMs: Number(getTotalDurationMs().toFixed(1)),
        ...extra,
      }),
    );
  }

  return {
    getServerTimingHeader,
    log,
    record,
    time,
  };
}

export function registerBaseRoutes(app: Hono<WorkerBindings>) {
  app.get('/api/health', c =>
    c.json({
      ok: true,
      network: 'Stellar Testnet + Mainnet',
      networks: listNetworks(c.env),
      privyAppId: c.env.PRIVY_APP_ID || null,
      runtime: 'cloudflare-workers',
      walletConnectConfigured: Boolean(c.env.WALLETCONNECT_PROJECT_ID),
    }),
  );

  app.get('/api/networks', c =>
    c.json({
      networks: listNetworks(c.env),
    }),
  );

  app.get('/api/assets', async c => {
    const network = normalizeNetwork(c.req.query('network'));
    const assets = await getSupportedAssets(c.env, network, {
      limit: c.req.query('limit'),
      search: c.req.query('search'),
    });

    return c.json({
      assets,
      network,
    });
  });

  app.get('/api/assets/favorites', async c => {
    const { account, network } = await getFavoriteAssetAccount(c, {
      email: c.req.query('email'),
      network: c.req.query('network'),
    });

    return c.json({
      success: true,
      data: {
        assets: await listFavoriteAssets(c.env, account.email, network),
      },
    });
  });

  app.post('/api/assets/favorites', async c => {
    const body = await readJsonBody(c);
    const input = normalizeFavoriteAssetInput(body);
    const { account } = await getFavoriteAssetAccount(c, {
      ...body,
      network: input.network,
    });
    const asset = await upsertFavoriteAsset(c.env, account.email, input);

    return c.json({
      success: true,
      data: { asset },
    });
  });

  app.delete('/api/assets/favorites/:id', async c => {
    const id = String(c.req.param('id') || '').trim();
    const { account } = await getFavoriteAssetAccount(c, {
      email: c.req.query('email'),
      network: c.req.query('network'),
    });

    if (!id) {
      throw makeError('Favorite asset id is required', 400);
    }

    const existing = await findFavoriteAssetById(c.env, account.email, id);

    if (!existing) {
      throw makeError('Favorite asset not found', 404);
    }

    await requireFavoriteAssetsDb(c.env)
      .prepare(
        `DELETE FROM account_favorite_assets
         WHERE account_email = ? AND id = ?`,
      )
      .bind(account.email, id)
      .run();

    return c.json({
      success: true,
      data: { deleted: true },
    });
  });

  app.get('/api/wallets', async c => {
    const result = await privyRequest<{ data?: unknown[] }>(
      c.env,
      '/wallets?chain_type=stellar&limit=20',
    );
    const wallets = Array.isArray(result?.data) ? result.data : [];

    return c.json({
      wallets: wallets.map(wallet =>
        normalizeWallet(wallet as Parameters<typeof normalizeWallet>[0]),
      ),
    });
  });

  app.post('/api/session', async c => {
    const timing = createSessionTiming('/api/session');
    const body = await timing.time('body', () => readJsonBody(c));
    const network = normalizeNetwork(body.network);
    const identityToken = String(body.identityToken || '').trim();
    const clientWallet = getClientStellarWalletInput(body.wallet);
    const requestedActiveWalletId = String(
      body.activeWalletId || body.sourceWalletId || '',
    ).trim();

    if (identityToken) {
      const user = await timing.time('privy_user', () =>
        getPrivyClient(c.env).users().get({
          id_token: identityToken,
        }),
      );
      const email = getEmailFromPrivyUser(user);

      if (!isEmailLike(email)) {
        throw makeError('This Privy account does not have a valid email', 400);
      }

      const verifiedClientWallet = await timing.time(
        'privy_wallet',
        () => getVerifiedClientStellarWallet(c, clientWallet),
      );
      const account = await timing.time('account', () =>
        getOrCreateSessionAccountByEmail(
          c.env,
          email,
          network,
          String((user as { id?: string })?.id || ''),
          verifiedClientWallet,
        ),
      );
      const sessionAccount = requestedActiveWalletId
        ? { ...account, activeWalletId: requestedActiveWalletId }
        : account;
      const session = await timing.time('session', () =>
        buildAccountSession(c.env, sessionAccount, network, timing.record, {
          includeHistory: false,
        }),
      );

      c.header('Server-Timing', timing.getServerTimingHeader());
      timing.log({
        hasEmail: true,
        identityToken: true,
        network,
        walletCount: session.wallets.length,
      });
      return c.json(session);
    }

    const email = normalizeEmail(body.email);
    const account = await timing.time('account', () =>
      getOrCreateSessionAccountByEmail(c.env, email, network),
    );
    const sessionAccount = requestedActiveWalletId
      ? { ...account, activeWalletId: requestedActiveWalletId }
      : account;
    const session = await timing.time('session', () =>
      buildAccountSession(c.env, sessionAccount, network, timing.record, {
        includeHistory: false,
      }),
    );

    c.header('Server-Timing', timing.getServerTimingHeader());
    timing.log({
      hasEmail: Boolean(email),
      identityToken: false,
      network,
      walletCount: session.wallets.length,
    });
    return c.json(session);
  });

  app.post('/api/session/status', async c => {
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const identityToken = String(body.identityToken || '').trim();
    let email = normalizeEmail(body.email);

    if (identityToken) {
      const user = await getPrivyClient(c.env).users().get({
        id_token: identityToken,
      });

      email = getEmailFromPrivyUser(user);
    }

    if (!isEmailLike(email)) {
      throw makeError('This Privy account does not have a valid email', 400);
    }

    const account = await getAccountByEmail(c.env, email);
    const networkWallets = account ? getVisibleWallets(account, network) : [];

    return c.json({
      email,
      exists: Boolean(account),
      hasNetworkWallet: networkWallets.some(wallet => wallet.canSign),
      network,
      walletCount: networkWallets.length,
    });
  });

  app.post('/api/demo/session', async c => {
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const account = await getOrCreateSessionAccountByEmail(c.env, body.email, network);

    return c.json(await buildAccountSession(c.env, account, network));
  });

  app.post('/api/demo/auth-session', async c => {
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const identityToken = String(body.identityToken || '').trim();

    if (!identityToken) {
      throw makeError('Missing Privy login token', 401);
    }

    const user = await getPrivyClient(c.env).users().get({
      id_token: identityToken,
    });
    const email = getEmailFromPrivyUser(user);

    if (!isEmailLike(email)) {
      throw makeError('This Privy account does not have a valid email', 400);
    }

    const account = await getOrCreateSessionAccountByEmail(
      c.env,
      email,
      network,
      String((user as { id?: string })?.id || ''),
    );

    return c.json(await buildAccountSession(c.env, account, network));
  });

  app.post('/api/demo/account', async c => {
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const email =
      normalizeEmail(body.email) || `stellar-demo-${Date.now()}@example.com`;

    if (!isEmailLike(email)) {
      throw makeError('Invalid email', 400);
    }

    const user =
      ((await findPrivyUserByEmail(c.env, email)) as { id?: string } | null) ||
      (await createPrivyUser(c.env, email));
    const wallet = normalizeWallet(
      await createSignableStellarWallet(c.env, email, `Stellar ${network} 1`),
      {
        canSign: true,
        kind: 'privy',
        network,
      },
    );
    const account = await saveAccount(
      c.env,
      normalizeAccountWallets(
        {
          id: user?.id,
          email,
          wallet,
          wallets: [wallet],
        },
        network,
      ),
    );

    return c.json({ account }, 201);
  });

  app.post('/api/wallets', async c => {
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const account = await requireAccountContext(c.env, c.req.header('authorization'), body, {
      network,
      requireAuth: true,
    });
    const nextWalletNumber = (account.wallets || []).length + 1;
    const displayName =
      String(body.displayName || '').trim().slice(0, 42) ||
      `Stellar ${network} ${nextWalletNumber}`;
    const clientWallet = getClientStellarWalletInput(body.wallet);
    const verifiedClientWallet = clientWallet
      ? await getVerifiedClientStellarWallet(c, clientWallet)
      : undefined;
    const walletSource =
      verifiedClientWallet ||
      (await createSignableStellarWallet(c.env, account.email, displayName));

    const wallet = normalizeWallet(walletSource, {
      archived: false,
      canSign: true,
      displayName,
      kind: 'privy',
      network,
    });

    if (network === 'testnet' && body.fund !== false) {
      await friendbotFund(c.env, wallet.address, network);
    }

    const nextAccount = await saveAccount(
      c.env,
      normalizeAccountWallets(
        {
          ...account,
          activeWalletId: wallet.id,
          wallet,
          wallets: [...(account.wallets || []), wallet],
        },
        network,
      ),
    );

    return c.json(await buildAccountSession(c.env, nextAccount, network), 201);
  });

  app.post('/api/wallets/import', async c => {
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const account = await requireAccountContext(c.env, c.req.header('authorization'), body, {
      network,
      requireAuth: true,
    });

    const keypair = assertSecretKey(body.secret, 'Stellar secret key');
    const importedAddress = keypair.publicKey();
    const duplicateWallet = (account.wallets || []).find(
      wallet =>
        wallet.network === network &&
        wallet.address.toUpperCase() === importedAddress.toUpperCase(),
    );

    if (duplicateWallet) {
      throw makeError(
        `${importedAddress.slice(0, 6)}...${importedAddress.slice(
          -6,
        )} is already in this account on Stellar ${network}.`,
        409,
      );
    }

    const displayName = sanitizeWalletName(body.displayName, `Imported ${network} wallet`);
    const wallet = normalizeWallet(
      {
        address: importedAddress,
        chain_type: 'stellar',
        display_name: displayName,
        id: `stellar_import_${network}_${Date.now()}`,
        public_key: importedAddress,
      },
      {
        canSign: true,
        encryptedSecret: await encryptWalletSecret(c.env, keypair.secret()),
        kind: 'imported_privy',
        network,
      },
    );
    const nextAccount = await saveAccount(
      c.env,
      normalizeAccountWallets(
        {
          ...account,
          activeWalletId: wallet.id,
          wallet,
          wallets: [...(account.wallets || []), wallet],
        },
        network,
      ),
    );

    return c.json(await buildAccountSession(c.env, nextAccount, network), 201);
  });

  app.post('/api/wallets/watch-only', async c => {
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const account = await requireAccountContext(c.env, c.req.header('authorization'), body, {
      network,
      requireAuth: shouldRequireMainnetAuth(network),
    });
    const address = String(body.address || '').trim();
    assertStellarAddress(address);
    const displayName =
      String(body.displayName || '').trim().slice(0, 42) || `Watch ${address.slice(0, 6)}`;
    const wallet = normalizeWallet(
      {
        address,
        chain_type: 'stellar',
        display_name: displayName,
        id: `watch_${network}_${address}`,
        public_key: address,
      },
      {
        canSign: false,
        kind: 'watch_only',
        network,
      },
    );
    const nextAccount = await saveAccount(
      c.env,
      normalizeAccountWallets(
        {
          ...account,
          activeWalletId: wallet.id,
          wallet,
          wallets: [
            ...(account.wallets || []).filter(
              item => !(item.id === wallet.id && item.network === network),
            ),
            wallet,
          ],
        },
        network,
      ),
    );

    return c.json(await buildAccountSession(c.env, nextAccount, network), 201);
  });

  app.post('/api/wallets/export/prepare', async c => {
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const sourceWalletId = String(body.walletId || '').trim();
    const confirmation = String(body.confirmation || '').trim();
    const account = await requireAccountContext(c.env, c.req.header('authorization'), body, {
      network,
      requireAuth: true,
    });
    const wallet = (account.wallets || []).find(
      item => item.id === sourceWalletId && item.network === network,
    );

    if (!wallet) {
      throw makeError('Wallet not found for export', 404);
    }

    assertAccountWallet({
      account,
      address: wallet.address,
      network,
      walletId: sourceWalletId,
    });

    if (confirmation !== 'EXPORT') {
      throw makeError('Enter EXPORT to confirm secret export', 400);
    }

    return c.json(
      await prepareStellarWalletSecretExport(
        c.env,
        sourceWalletId,
        wallet.address,
        network,
      ),
    );
  });

  app.post('/api/wallets/export', async c => {
    const body = await readJsonBody(c);
    const challengeText = String(body.challenge || '').trim();
    const signature = String(body.signature || '').trim();

    if (!challengeText) {
      throw makeError('Missing wallet export challenge', 400);
    }

    if (!signature) {
      throw makeError('Missing wallet export authorization signature', 400);
    }

    const challenge = decodeWalletExportChallenge(challengeText);
    const network = normalizeNetwork(challenge.network);
    const account = await requireAccountContext(c.env, c.req.header('authorization'), body, {
      network,
      requireAuth: true,
    });
    const wallet = (account.wallets || []).find(
      item => item.id === challenge.walletId && item.network === network,
    );

    if (!wallet) {
      throw makeError('Wallet not found for export', 404);
    }

    assertAccountWallet({
      account,
      address: wallet.address,
      network,
      walletId: challenge.walletId,
    });

    if (challenge.requestExpiry <= Date.now()) {
      throw makeError('Wallet export challenge expired. Try again.', 400);
    }

    let result: Awaited<ReturnType<typeof completeStellarWalletSecretExport>>;

    try {
      result = await completeStellarWalletSecretExport(
        c.env,
        challenge,
        signature,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const lowerMessage = message.toLowerCase();

      console.error('Privy wallet export failed', {
        challengeWalletId: challenge.walletId,
        message,
        network,
      });

      if (lowerMessage.includes('wallet must have an owner')) {
        throw makeError(
          'This wallet was created before recovery key export was enabled. Create or import a new wallet to use backup recovery key.',
          400,
        );
      }

      if (lowerMessage.includes('invalid jwt token')) {
        throw makeError(
          `Privy rejected the export authorization token: ${message}`,
          401,
        );
      }

      if (
        lowerMessage.includes('no valid authorization keys') ||
        lowerMessage.includes('user signing keys')
      ) {
        throw makeError(
          'Privy could not issue a valid user authorization key for export. Check that wallet export and user authorization keys are enabled for this Privy app.',
          401,
        );
      }

      if (lowerMessage.includes('wallet export is not supported')) {
        throw makeError(
          'Wallet export is not enabled for this Privy app.',
          400,
        );
      }

      throw error;
    }

    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');

    return c.json({
      address: wallet.address,
      network,
      secret: result.secret,
      type: 'private_key' as const,
    });
  });

  const selectWallet = async (c: Context<WorkerBindings>) => {
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const account = await requireAccountContext(
      c.env,
      c.req.header('authorization'),
      body,
      {
        network,
        requireAuth: true,
      },
    );
    const walletId = String(body.walletId || '').trim();
    const targetWallet = getVisibleWallets(account).find(
      wallet => wallet.id === walletId,
    );

    if (!targetWallet) {
      throw makeError('Active wallet not found', 404);
    }

    const nextAccount = await saveAccount(
      c.env,
      normalizeAccountWallets(
        {
          ...account,
          activeWalletId: targetWallet.id,
          wallet: targetWallet,
        },
        targetWallet.network,
      ),
    );

    return c.json(
      await buildAccountSession(c.env, nextAccount, targetWallet.network),
    );
  };

  const renameWallet = async (c: Context<WorkerBindings>) => {
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const account = await requireAccountContext(
      c.env,
      c.req.header('authorization'),
      body,
      {
        network,
        requireAuth: true,
      },
    );
    const walletId = String(body.walletId || '').trim();
    const targetWallet = getVisibleWallets(account).find(
      wallet => wallet.id === walletId,
    );

    if (!targetWallet) {
      throw makeError('Wallet not found for rename', 404);
    }

    const displayName = sanitizeWalletName(
      body.displayName,
      targetWallet.displayName || 'Wallet',
    );
    const wallets = (account.wallets || []).map(wallet =>
      wallet.id === walletId ? { ...wallet, displayName } : wallet,
    );
    const nextAccount = await saveAccount(
      c.env,
      normalizeAccountWallets(
        {
          ...account,
          wallet:
            account.wallet?.id === walletId
              ? { ...account.wallet, displayName }
              : account.wallet,
          wallets,
        },
        targetWallet.network,
      ),
    );

    return c.json(
      await buildAccountSession(c.env, nextAccount, targetWallet.network),
    );
  };

  const archiveWallet = async (c: Context<WorkerBindings>) => {
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const account = await requireAccountContext(
      c.env,
      c.req.header('authorization'),
      body,
      {
        network,
        requireAuth: true,
      },
    );
    const walletId = String(body.walletId || '').trim();
    const visibleWallets = getVisibleWallets(account);
    const targetWallet = visibleWallets.find(wallet => wallet.id === walletId);

    if (!targetWallet) {
      throw makeError('Wallet not found for archive', 404);
    }

    if (visibleWallets.length <= 1) {
      throw makeError('Cannot archive the last wallet in the account', 400);
    }

    const remainingWallets = visibleWallets.filter(
      wallet => wallet.id !== walletId,
    );
    const activeWallet =
      remainingWallets.find(wallet => wallet.network === targetWallet.network) ||
      remainingWallets[0];
    const wallets = (account.wallets || []).map(wallet =>
      wallet.id === walletId
        ? { ...wallet, archived: true, archivedAt: nowIso() }
        : wallet,
    );
    const nextAccount = await saveAccount(
      c.env,
      normalizeAccountWallets(
        {
          ...account,
          activeWalletId: activeWallet.id,
          wallet: activeWallet,
          wallets,
        },
        activeWallet.network,
      ),
    );

    return c.json(
      await buildAccountSession(c.env, nextAccount, activeWallet.network),
    );
  };

  app.post('/api/wallets/select', selectWallet);
  app.post('/api/wallets/rename', renameWallet);
  app.post('/api/wallets/archive', archiveWallet);

  app.post('/api/demo/receiver', async c => {
    const body = await readJsonBody(c);
    const network: StellarNetwork = 'testnet';
    const receiverKeypair = Keypair.random();
    const receiverAddress = receiverKeypair.publicKey();
    const wallet = normalizeWallet(
      {
        address: receiverAddress,
        display_name: String(body.displayName || 'Demo recipient'),
        id: `demo-receiver-${receiverAddress}`,
        public_key: receiverAddress,
      },
      {
        canSign: false,
        kind: 'watch_only',
        network,
      },
    );

    await friendbotFund(c.env, wallet.address, network);

    const assets = await getSupportedAssets(c.env, network);

    for (const assetDefinition of assets.filter(asset => !asset.isNative)) {
      const sourceAccount = await loadAccount(c.env, wallet.address, network);

      if (!sourceAccount) {
        throw makeError('Demo receiver is not active yet', 500);
      }

      const transaction = buildTrustlineTransaction({
        asset: getIssuedAsset(assetDefinition),
        env: c.env,
        network,
        sourceAccount,
      });

      transaction.sign(receiverKeypair);
      await getStellarServer(c.env, network).submitTransaction(transaction);
    }

    const contact = await saveContact(c.env, {
      funded: true,
      label: String(body.label || 'Demo recipient'),
      wallet,
    });
    const balance = await getAccountBalances(c.env, wallet.address, network);

    return c.json(
      {
        balance,
        contact,
      },
      201,
    );
  });

}
