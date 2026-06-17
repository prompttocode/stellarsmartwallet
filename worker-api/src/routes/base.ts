import type { Context, Hono } from 'hono';
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
  getAccountHistory,
  getEmailFromPrivyUser,
  getIssuedAsset,
  getOrCreateSessionAccountByEmail,
  getPrivyClient,
  getSupportedAssets,
  getVisibleWallets,
  isEmailLike,
  listNetworks,
  loadAccount,
  makeError,
  normalizeAccountWallets,
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
  submitPrivySignedTransaction,
  type StellarNetwork,
  type WorkerBindings,
} from '../core';

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
    const body = await readJsonBody(c);
    const network = normalizeNetwork(body.network);
    const identityToken = String(body.identityToken || '').trim();

    if (identityToken) {
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
    }

    const account = await getOrCreateSessionAccountByEmail(c.env, body.email, network);

    return c.json(await buildAccountSession(c.env, account, network));
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
    const wallet = normalizeWallet(
      await createSignableStellarWallet(c.env, account.email, displayName),
      {
        archived: false,
        canSign: true,
        displayName,
        kind: 'privy',
        network,
      },
    );

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
    const ownerUserId = String(account.id || '').trim();

    if (!ownerUserId) {
      throw makeError('Signed-in Privy user is missing an id', 401);
    }

    const keypair = assertSecretKey(body.secret, 'Stellar secret key');
    const displayName = sanitizeWalletName(body.displayName, `Imported ${network} wallet`);
    const wallet = normalizeWallet(
      {
        address: keypair.publicKey(),
        chain_type: 'stellar',
        display_name: displayName,
        id: `stellar_import_${network}_${Date.now()}`,
        public_key: keypair.publicKey(),
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
    const wallet = normalizeWallet(
      await createSignableStellarWallet(
        c.env,
        `receiver-${Date.now()}@demo.local`,
        String(body.displayName || 'Demo recipient'),
      ),
      {
        canSign: true,
        kind: 'privy',
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

      await submitPrivySignedTransaction({
        env: c.env,
        network,
        sourceAddress: wallet.address,
        transaction,
        walletId: wallet.id,
      });
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
