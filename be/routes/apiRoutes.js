/* eslint-env node */

const express = require('express');
const { PRIVY_APP_ID, WALLETCONNECT_PROJECT_ID } = require('../config');
const {
  getAccountByEmail,
  saveAccount,
  saveContact,
} = require('../db');
const { getExplorerUrl, listNetworks, normalizeNetwork } = require('../services/networks');
const {
  createPrivyUser,
  createSignableStellarWallet,
  exportStellarWalletSecret,
  findPrivyUserByEmail,
  getEmailFromPrivyUser,
  getPrivyClient,
  importStellarWallet,
  normalizeWallet,
  privyRequest,
} = require('../services/privy');
const { getDisabledRampResponse, getRampProviders } = require('../services/ramp');
const {
  assertAmount,
  assertSecretKey,
  assertStellarAddress,
  buildPaymentTransaction,
  buildTrustlineTransaction,
  ensureTrustline,
  executeMainnetSwap,
  friendbotFund,
  fundDemoAsset,
  getAccountBalances,
  getAccountHistory,
  getAssetForOperation,
  getHorizonErrorMessage,
  getIssuedAsset,
  getSupportedAsset,
  getSupportedAssets,
  loadAccount,
  quoteDemoSwap,
  quoteMainnetSwap,
  reviewStellarXdr,
  signStellarXdr,
  submitPrivySignedTransaction,
  swapDemoAsset,
} = require('../services/stellar');
const { isEmailLike, normalizeEmail } = require('../utils/validation');

const router = express.Router();

function normalizeWalletForAccount(wallet, index = 0) {
  if (!wallet?.id || !wallet?.address) {
    return null;
  }

  const kind = wallet.kind || 'privy';

  return {
    ...wallet,
    archived: Boolean(wallet.archived),
    canSign: wallet.canSign !== false && kind !== 'watch_only',
    displayName: wallet.displayName || `Stellar Wallet ${index + 1}`,
    kind,
    network: normalizeNetwork(wallet.network),
  };
}

function normalizeAccountWallets(account, preferredNetwork) {
  const inputWallets = Array.isArray(account.wallets)
    ? [...account.wallets]
    : [];

  if (
    account.wallet?.id &&
    !inputWallets.some(
      wallet =>
        wallet.id === account.wallet.id &&
        normalizeNetwork(wallet.network) === normalizeNetwork(account.wallet.network),
    )
  ) {
    inputWallets.unshift(account.wallet);
  }

  const wallets = inputWallets
    .map((wallet, index) => normalizeWalletForAccount(wallet, index))
    .filter(Boolean)
    .filter(
      (wallet, index, allWallets) =>
        allWallets.findIndex(
          item =>
            item.id === wallet.id &&
            item.network === wallet.network &&
            item.address === wallet.address,
        ) === index,
    );
  const visibleWallets = wallets.filter(wallet => !wallet.archived);
  const requestedNetwork = preferredNetwork
    ? normalizeNetwork(preferredNetwork)
    : normalizeNetwork(account.wallet?.network);
  const activeWallet =
    visibleWallets.find(
      wallet =>
        wallet.id === account.activeWalletId &&
        wallet.network === requestedNetwork,
    ) ||
    visibleWallets.find(
      wallet =>
        wallet.id === account.wallet?.id &&
        wallet.network === requestedNetwork,
    ) ||
    visibleWallets.find(wallet => wallet.network === requestedNetwork) ||
    visibleWallets[0] ||
    wallets[0] ||
    null;

  return {
    ...account,
    activeWalletId: activeWallet?.id || null,
    wallet: activeWallet,
    wallets,
  };
}

function getVisibleWallets(account, network) {
  return (account.wallets || []).filter(
    wallet =>
      !wallet.archived &&
      (!network || wallet.network === normalizeNetwork(network)),
  );
}

function sanitizeWalletName(value, fallback) {
  const name = String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 42);

  return name || fallback;
}

function getBearerToken(req) {
  const authorization = String(req.headers?.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return String(req.body?.identityToken || match?.[1] || '').trim();
}

async function getPrivyUserFromRequest(req) {
  const identityToken = getBearerToken(req);

  if (!identityToken) {
    return null;
  }

  return getPrivyClient().users().get({
    id_token: identityToken,
  });
}

async function requireAccountContext(req, options = {}) {
  const requireAuth = Boolean(options.requireAuth);
  const user = await getPrivyUserFromRequest(req).catch(error => {
    if (requireAuth) {
      error.status = error.status || 401;
      throw error;
    }

    return null;
  });
  const tokenEmail = getEmailFromPrivyUser(user);
  const bodyEmail = normalizeEmail(req.body?.email || req.query?.email);
  const email = tokenEmail || bodyEmail;

  if (requireAuth && !tokenEmail) {
    const error = new Error(
      'Privy session is not ready. Sign out and sign in again before using this security action.',
    );
    error.status = 401;
    throw error;
  }

  if (!isEmailLike(email)) {
    const error = new Error('Invalid email');
    error.status = 400;
    throw error;
  }

  const account = await getAccountByEmail(email);

  if (!account) {
    const error = new Error('Wallet account not found');
    error.status = 404;
    throw error;
  }

  return await saveAccount(
    normalizeAccountWallets(
      {
        ...account,
        ...(user?.id ? { id: user.id } : null),
      },
      options.network,
    ),
  );
}

function assertAccountWallet({
  account,
  address,
  requireSigner = true,
  walletId,
  network = 'testnet',
}) {
  const normalizedNetwork = normalizeNetwork(network);
  const wallet = (account.wallets || []).find(
    item =>
      item.id === walletId &&
      item.address === address &&
      item.network === normalizedNetwork &&
      !item.archived,
  );

  if (!wallet) {
    const error = new Error('Wallet does not belong to the signed-in account');
    error.status = 403;
    throw error;
  }

  if (requireSigner && !wallet.canSign) {
    const error = new Error('Watch-only wallets cannot sign transactions');
    error.status = 403;
    throw error;
  }

  return wallet;
}

async function requireDemoAccountByEmail(emailValue, network = 'testnet') {
  const email = normalizeEmail(emailValue);

  if (!isEmailLike(email)) {
    const error = new Error('Invalid email');
    error.status = 400;
    throw error;
  }

  const account = await getAccountByEmail(email);

  if (!account) {
    const error = new Error('Demo account not found');
    error.status = 404;
    throw error;
  }

  return ensureSignableDemoAccount(account, network);
}

async function ensureWalletForNetwork(account, network = 'testnet') {
  const normalizedAccount = normalizeAccountWallets(account, network);
  const normalizedNetwork = normalizeNetwork(network);
  const existingWallet = getVisibleWallets(normalizedAccount, normalizedNetwork)
    .find(wallet => wallet.canSign);

  if (existingWallet) {
    return await saveAccount(
      normalizeAccountWallets(
        {
          ...normalizedAccount,
          activeWalletId: existingWallet.id,
          wallet: existingWallet,
        },
        normalizedNetwork,
      ),
    );
  }

  const nextWalletNumber = (normalizedAccount.wallets || []).length + 1;
  const wallet = normalizeWallet(
    await createSignableStellarWallet(
      normalizedAccount.email,
      `Stellar ${normalizedNetwork} ${nextWalletNumber}`,
    ),
    {
      canSign: true,
      kind: 'privy',
      network: normalizedNetwork,
    },
  );

  return await saveAccount(
    normalizeAccountWallets(
      {
        ...normalizedAccount,
        activeWalletId: wallet.id,
        wallet,
        wallets: [...(normalizedAccount.wallets || []), wallet],
      },
      normalizedNetwork,
    ),
  );
}

async function getOrCreateSessionAccountByEmail(
  emailValue,
  network = 'testnet',
  userId,
) {
  const email = normalizeEmail(emailValue);

  if (!isEmailLike(email)) {
    const error = new Error('Invalid email');
    error.status = 400;
    throw error;
  }

  const localAccount = await getAccountByEmail(email);

  if (localAccount) {
    return ensureWalletForNetwork(
      {
        ...localAccount,
        ...(userId ? { id: userId } : null),
      },
      network,
    );
  }

  const user = userId
    ? { id: userId }
    : (await findPrivyUserByEmail(email)) || (await createPrivyUser(email));
  const wallet = normalizeWallet(
    await createSignableStellarWallet(email, `Stellar ${network} 1`),
    {
      canSign: true,
      kind: 'privy',
      network,
    },
  );

  return await saveAccount(
    normalizeAccountWallets(
      {
        id: user.id,
        email,
        wallet,
        wallets: [wallet],
      },
      network,
    ),
  );
}

async function ensureSignableDemoAccount(account, network = 'testnet') {
  return ensureWalletForNetwork(account, network);
}

async function buildAccountSession(account, preferredNetwork) {
  const normalizedAccount = await saveAccount(
    normalizeAccountWallets(account, preferredNetwork),
  );
  const visibleWallets = getVisibleWallets(normalizedAccount);
  const activeWallet = normalizedAccount.wallet;

  if (!activeWallet?.address) {
    const error = new Error('Account does not have a Stellar wallet yet');
    error.status = 500;
    throw error;
  }

  const network = activeWallet.network || normalizeNetwork(preferredNetwork);
  const balanceResult = await getAccountBalances(activeWallet.address, network);
  const sessionAccount = {
    ...normalizedAccount,
    activeWalletId: activeWallet.id,
    wallet: activeWallet,
    wallets: visibleWallets,
  };

  return {
    account: sessionAccount,
    activeWalletId: activeWallet.id,
    balance: {
      address: activeWallet.address,
      exists: balanceResult.exists,
      network,
      xlm: balanceResult.xlm,
    },
    balances: balanceResult.balances,
    network,
    transactions: await getAccountHistory(activeWallet.address, network),
    wallets: visibleWallets,
  };
}

function buildSubmittedTransactionItem({
  amount,
  assetCode,
  assetIssuer,
  direction = 'sent',
  from,
  network = 'testnet',
  operation,
  submitted,
  to,
}) {
  return {
    id: submitted.hash,
    amount,
    assetCode,
    assetIssuer: assetIssuer || null,
    createdAt: new Date().toISOString(),
    direction,
    explorerUrl: getExplorerUrl(network, 'tx', submitted.hash),
    from,
    hash: submitted.hash,
    ledger: submitted.ledger,
    network,
    operation,
    to,
  };
}

function getNetworkFromRequest(req, fallback = 'testnet') {
  return normalizeNetwork(req.params?.network || req.body?.network || fallback);
}

function shouldRequireMainnetAuth(network) {
  return normalizeNetwork(network) === 'mainnet';
}

async function handleStellarLookup(req, res, next, fallbackNetwork = 'testnet') {
  try {
    const network = getNetworkFromRequest(req, fallbackNetwork);
    const address = String(req.params?.address || '').trim();
    assertStellarAddress(address);

    const balanceResult = await getAccountBalances(address, network);

    res.json({
      ...balanceResult,
      transactions: await getAccountHistory(address, network),
    });
  } catch (error) {
    next(error);
  }
}

async function handleFund(req, res, next, fallbackNetwork = 'testnet') {
  try {
    const network = getNetworkFromRequest(req, fallbackNetwork);
    const address = String(req.body?.address || '').trim();
    assertStellarAddress(address);

    await friendbotFund(address, network);
    const balanceResult = await getAccountBalances(address, network);

    res.json({
      address,
      balances: balanceResult.balances,
      exists: balanceResult.exists,
      network,
      transactions: await getAccountHistory(address, network),
      xlm: balanceResult.xlm,
    });
  } catch (error) {
    next(error);
  }
}

async function handleTrustline(req, res, next, fallbackNetwork = 'testnet') {
  const network = getNetworkFromRequest(req, fallbackNetwork);

  try {
    const sourceWalletId = String(req.body?.sourceWalletId || '').trim();
    const sourceAddress = String(req.body?.sourceAddress || '').trim();
    const account = await requireAccountContext(req, {
      network,
      requireAuth: shouldRequireMainnetAuth(network),
    });
    assertAccountWallet({
      account,
      address: sourceAddress,
      network,
      walletId: sourceWalletId,
    });

    const assetDefinition = await getSupportedAsset({
      assetCode: req.body?.assetCode,
      assetIssuer: req.body?.assetIssuer,
      network,
    });

    if (assetDefinition.isNative) {
      const error = new Error('XLM does not need a trustline');
      error.status = 400;
      throw error;
    }

    assertStellarAddress(sourceAddress, 'Wallet');

    const sourceAccount = await loadAccount(sourceAddress, network);

    if (!sourceAccount) {
      const error = new Error(
        network === 'mainnet'
          ? 'Mainnet wallet is not active. Deposit real XLM first.'
          : 'Wallet does not exist on Stellar Testnet. Fund test XLM first.',
      );
      error.status = 400;
      throw error;
    }

    const existingBalance = sourceAccount.balances.find(
      balance =>
        balance.asset_code === assetDefinition.assetCode &&
        balance.asset_issuer === assetDefinition.assetIssuer,
    );

    if (existingBalance) {
      const balanceResult = await getAccountBalances(sourceAddress, network);

      res.json({
        alreadyTrusted: true,
        balances: balanceResult.balances,
        network,
        transaction: null,
        transactions: await getAccountHistory(sourceAddress, network),
      });
      return;
    }

    const issuedAsset = getIssuedAsset(assetDefinition);
    const transaction = buildTrustlineTransaction({
      asset: issuedAsset,
      network,
      sourceAccount,
    });
    const submitted = await submitPrivySignedTransaction({
      network,
      sourceAddress,
      transaction,
      walletId: sourceWalletId,
    });
    const balanceResult = await getAccountBalances(sourceAddress, network);

    res.json({
      alreadyTrusted: false,
      balances: balanceResult.balances,
      network,
      transaction: buildSubmittedTransactionItem({
        amount: '0',
        assetCode: assetDefinition.assetCode,
        assetIssuer: assetDefinition.assetIssuer,
        direction: 'trustline',
        from: sourceAddress,
        network,
        operation: 'change_trust',
        submitted,
        to: assetDefinition.assetIssuer,
      }),
      transactions: await getAccountHistory(sourceAddress, network),
    });
  } catch (error) {
    if (error?.response?.data?.extras?.result_codes) {
      error.message = getHorizonErrorMessage(error, network);
      error.status = 400;
    }

    next(error);
  }
}

async function handleFundAsset(req, res, next, fallbackNetwork = 'testnet') {
  const network = getNetworkFromRequest(req, fallbackNetwork);

  try {
    const destination = String(req.body?.address || '').trim();
    const assetDefinition = await getSupportedAsset({
      assetCode: req.body?.assetCode,
      assetIssuer: req.body?.assetIssuer,
      network,
    });
    const amount = assertAmount(req.body?.amount || '100');

    assertStellarAddress(destination, 'Recipient wallet');

    const submitted = await fundDemoAsset({
      amount,
      assetCode: assetDefinition.assetCode,
      destination,
      network,
    });
    const balanceResult = await getAccountBalances(destination, network);

    res.json({
      balances: balanceResult.balances,
      network,
      transaction: buildSubmittedTransactionItem({
        amount,
        assetCode: assetDefinition.assetCode,
        assetIssuer: assetDefinition.assetIssuer,
        direction: 'received',
        from: assetDefinition.assetIssuer,
        network,
        operation: 'payment',
        submitted,
        to: destination,
      }),
      transactions: await getAccountHistory(destination, network),
    });
  } catch (error) {
    if (error?.response?.data?.extras?.result_codes) {
      error.message = getHorizonErrorMessage(error, network);
      error.status = 400;
    }

    next(error);
  }
}

async function handleSend(req, res, next, fallbackNetwork = 'testnet') {
  const network = getNetworkFromRequest(req, fallbackNetwork);

  try {
    const accountId = String(req.body?.accountId || '').trim();
    const sourceWalletId = String(req.body?.sourceWalletId || '').trim();
    const sourceAddress = String(req.body?.sourceAddress || '').trim();
    const destination = String(req.body?.destination || '').trim();
    const amount = assertAmount(req.body?.amount);
    const account = await requireAccountContext(req, {
      network,
      requireAuth: shouldRequireMainnetAuth(network),
    });
    const sourceWallet = assertAccountWallet({
      account,
      address: sourceAddress,
      network,
      walletId: sourceWalletId,
    });
    const assetDefinition = await getSupportedAsset({
      assetCode: req.body?.assetCode,
      assetIssuer: req.body?.assetIssuer,
      network,
    });

    if (!sourceWallet.canSign) {
      const error = new Error('This wallet cannot sign transactions');
      error.status = 403;
      throw error;
    }

    assertStellarAddress(sourceAddress, 'Source wallet');
    assertStellarAddress(destination, 'Recipient wallet');

    const sourceAccount = await loadAccount(sourceAddress, network);

    if (!sourceAccount) {
      const error = new Error(
        network === 'mainnet'
          ? 'Source Mainnet wallet is not active. Deposit real XLM first.'
          : 'Source wallet does not exist on Stellar Testnet. Fund test XLM first.',
      );
      error.status = 400;
      throw error;
    }

    const destinationAccount = await loadAccount(destination, network);
    const asset = assetDefinition.isNative
      ? null
      : getAssetForOperation(assetDefinition);

    if (!assetDefinition.isNative) {
      ensureTrustline(sourceAccount, assetDefinition, 'Source wallet');

      if (!destinationAccount) {
        const error = new Error(
          `Recipient wallet is not active and cannot receive ${assetDefinition.assetCode}`,
        );
        error.status = 400;
        throw error;
      }

      ensureTrustline(destinationAccount, assetDefinition, 'Recipient wallet');
    }

    const { operationType, transaction } = buildPaymentTransaction({
      amount,
      asset,
      destination,
      destinationAccount,
      network,
      sourceAccount,
    });
    const submitted = await submitPrivySignedTransaction({
      network,
      sourceAddress,
      transaction,
      walletId: sourceWalletId,
    });
    const refreshedSource = await getAccountBalances(sourceAddress, network);
    const refreshedDestination = await getAccountBalances(destination, network);
    const transactionItem = buildSubmittedTransactionItem({
      amount,
      assetCode: assetDefinition.assetCode,
      assetIssuer: assetDefinition.assetIssuer,
      direction: 'sent',
      from: sourceAddress,
      network,
      operation: operationType,
      submitted,
      to: destination,
    });

    res.json({
      accountId,
      assetCode: assetDefinition.assetCode,
      destinationBalances: refreshedDestination.balances,
      destinationXlm: refreshedDestination.xlm,
      hash: submitted.hash,
      ledger: submitted.ledger,
      network,
      operation: operationType,
      sourceBalances: refreshedSource.balances,
      sourceWalletId,
      sourceXlm: refreshedSource.xlm,
      transaction: transactionItem,
      transactions: await getAccountHistory(sourceAddress, network),
    });
  } catch (error) {
    if (error?.response?.data?.extras?.result_codes) {
      error.message = getHorizonErrorMessage(error, network);
      error.status = 400;
    }

    next(error);
  }
}

async function handleSwapQuote(req, res, next, fallbackNetwork = 'testnet') {
  const network = getNetworkFromRequest(req, fallbackNetwork);

  try {
    const sourceAddress = String(req.body?.sourceAddress || '').trim();

    assertStellarAddress(sourceAddress, 'Swap wallet');

    if (network === 'testnet') {
      const result = await quoteDemoSwap({
        amount: req.body?.amount,
        fromAssetCode: req.body?.fromAssetCode,
        toAssetCode: req.body?.toAssetCode,
      });

      res.json({
        destMin: result.toAmount,
        fromAmount: result.fromAmount,
        fromAssetCode: result.fromAssetCode,
        network,
        rate: result.rate,
        simulated: true,
        toAmount: result.toAmount,
        toAssetCode: result.toAssetCode,
      });
      return;
    }

    const result = await quoteMainnetSwap({
      amount: req.body?.amount,
      fromAssetCode: req.body?.fromAssetCode,
      fromAssetIssuer: req.body?.fromAssetIssuer,
      sourceAddress,
      toAssetCode: req.body?.toAssetCode,
      toAssetIssuer: req.body?.toAssetIssuer,
    });

    res.json({
      ...result,
      network,
    });
  } catch (error) {
    if (error?.response?.data?.extras?.result_codes) {
      error.message = getHorizonErrorMessage(error, network);
      error.status = 400;
    }

    next(error);
  }
}

async function handleSwapExecute(req, res, next, fallbackNetwork = 'testnet') {
  const network = getNetworkFromRequest(req, fallbackNetwork);

  try {
    const accountId = String(req.body?.accountId || '').trim();
    const sourceWalletId = String(req.body?.sourceWalletId || '').trim();
    const sourceAddress = String(req.body?.sourceAddress || '').trim();
    const account = await requireAccountContext(req, {
      network,
      requireAuth: shouldRequireMainnetAuth(network),
    });
    assertAccountWallet({
      account,
      address: sourceAddress,
      network,
      walletId: sourceWalletId,
    });

    assertStellarAddress(sourceAddress, 'Swap wallet');

    const result =
      network === 'mainnet'
        ? await executeMainnetSwap({
            amount: req.body?.amount,
            fromAssetCode: req.body?.fromAssetCode,
            fromAssetIssuer: req.body?.fromAssetIssuer,
            sourceAddress,
            sourceWalletId,
            toAssetCode: req.body?.toAssetCode,
            toAssetIssuer: req.body?.toAssetIssuer,
          })
        : await swapDemoAsset({
            amount: req.body?.amount,
            fromAssetCode: req.body?.fromAssetCode,
            sourceAddress,
            sourceWalletId,
            toAssetCode: req.body?.toAssetCode,
          });
    const refreshedSource = await getAccountBalances(sourceAddress, network);
    const transactionItem = buildSubmittedTransactionItem({
      amount: result.fromAmount,
      assetCode: result.fromAssetCode,
      assetIssuer: result.fromAssetIssuer,
      direction: 'sent',
      from: sourceAddress,
      network,
      operation: network === 'mainnet' ? 'path_payment_strict_send' : 'payment',
      submitted: result.submitted,
      to: result.payoutAddress,
    });

    res.json({
      accountId,
      balances: refreshedSource.balances,
      fromAmount: result.fromAmount,
      fromAssetCode: result.fromAssetCode,
      hash: result.submitted.hash,
      ledger: result.submitted.ledger,
      network,
      rate: result.rate,
      sourceWalletId,
      toAmount: result.toAmount,
      toAssetCode: result.toAssetCode,
      transaction: transactionItem,
      transactions: await getAccountHistory(sourceAddress, network),
    });
  } catch (error) {
    if (error?.response?.data?.extras?.result_codes) {
      error.message = getHorizonErrorMessage(error, network);
      error.status = 400;
    }

    next(error);
  }
}

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    privyAppId: PRIVY_APP_ID || null,
    network: 'Stellar Testnet + Mainnet',
    networks: listNetworks(),
    walletConnectConfigured: Boolean(WALLETCONNECT_PROJECT_ID),
  });
});

router.get('/networks', (req, res) => {
  res.json({
    networks: listNetworks(),
  });
});

router.get('/wallets', async (req, res, next) => {
  try {
    const result = await privyRequest('/wallets?chain_type=stellar&limit=20');
    const wallets = Array.isArray(result?.data) ? result.data : [];

    res.json({
      wallets: wallets.map(wallet => normalizeWallet(wallet)),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/assets', async (req, res, next) => {
  try {
    const network = normalizeNetwork(req.query?.network);

    res.json({
      assets: await getSupportedAssets(network, {
        limit: req.query?.limit,
        search: req.query?.search,
      }),
      network,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/session', async (req, res, next) => {
  try {
    const network = normalizeNetwork(req.body?.network);
    const identityToken = String(req.body?.identityToken || '').trim();

    if (identityToken) {
      const user = await getPrivyClient().users().get({
        id_token: identityToken,
      });
      const account = await getOrCreateSessionAccountByEmail(
        getEmailFromPrivyUser(user),
        network,
        user.id,
      );

      res.json(await buildAccountSession(account, network));
      return;
    }

    const account = await getOrCreateSessionAccountByEmail(
      req.body?.email,
      network,
    );
    res.json(await buildAccountSession(account, network));
  } catch (error) {
    next(error);
  }
});

router.post('/wallets', async (req, res, next) => {
  try {
    if (!req.body?.email && !req.body?.accountId) {
      const role = String(req.body?.role || 'sender').replace(
        /[^a-z0-9_-]/gi,
        '',
      );
      const result = await privyRequest('/wallets', {
        method: 'POST',
        body: JSON.stringify({
          chain_type: 'stellar',
          display_name: req.body?.displayName || `Stellar ${role}`,
          external_id: `stellar_${role}_${Date.now()}`,
        }),
      });

      res.status(201).json({
        wallet: normalizeWallet(result),
      });
      return;
    }

    const network = normalizeNetwork(req.body?.network);
    const account = await requireAccountContext(req, {
      network,
      requireAuth: shouldRequireMainnetAuth(network),
    });
    const nextWalletNumber = (account.wallets || []).length + 1;
    const displayName = sanitizeWalletName(
      req.body?.displayName,
      `Stellar ${network} ${nextWalletNumber}`,
    );
    const wallet = normalizeWallet(
      await createSignableStellarWallet(account.email, displayName),
      {
        canSign: true,
        kind: 'privy',
        network,
      },
    );
    const nextWallet = {
      ...wallet,
      archived: false,
      displayName,
    };

    if (network === 'testnet' && req.body?.fund !== false) {
      await friendbotFund(nextWallet.address, network);
    }

    const nextAccount = await saveAccount(
      normalizeAccountWallets(
        {
          ...account,
          activeWalletId: nextWallet.id,
          wallet: nextWallet,
          wallets: [...(account.wallets || []), nextWallet],
        },
        network,
      ),
    );

    res.status(201).json(await buildAccountSession(nextAccount, network));
  } catch (error) {
    next(error);
  }
});

router.post('/wallets/import', async (req, res, next) => {
  try {
    const network = normalizeNetwork(req.body?.network);
    const account = await requireAccountContext(req, {
      network,
      requireAuth: true,
    });
    const keypair = assertSecretKey(req.body?.secret, 'Stellar secret key');
    const displayName = sanitizeWalletName(
      req.body?.displayName,
      `Imported ${network} wallet`,
    );
    const imported = await importStellarWallet({
      displayName,
      keypair,
      network,
    });
    const wallet = normalizeWallet(imported, {
      canSign: true,
      kind: 'imported_privy',
      network,
    });
    const nextAccount = await saveAccount(
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

    res.status(201).json(await buildAccountSession(nextAccount, network));
  } catch (error) {
    if (!error.status) {
      error.status = 502;
      error.message =
        'Privy cannot import Stellar keys with this SDK yet. Use watch-only or create a new Privy wallet.';
    }

    next(error);
  }
});

router.post('/wallets/watch-only', async (req, res, next) => {
  try {
    const network = normalizeNetwork(req.body?.network);
    const account = await requireAccountContext(req, {
      network,
      requireAuth: shouldRequireMainnetAuth(network),
    });
    const address = String(req.body?.address || '').trim();
    assertStellarAddress(address);

    const wallet = normalizeWallet(
      {
        address,
        chain_type: 'stellar',
        display_name: sanitizeWalletName(
          req.body?.displayName,
          `Watch ${address.slice(0, 6)}`,
        ),
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

    res.status(201).json(await buildAccountSession(nextAccount, network));
  } catch (error) {
    next(error);
  }
});

router.post('/wallets/export', async (req, res, next) => {
  try {
    const network = normalizeNetwork(req.body?.network);
    const sourceWalletId = String(req.body?.walletId || '').trim();
    const confirmation = String(req.body?.confirmation || '').trim();
    const exportType = req.body?.type === 'seed_phrase'
      ? 'seed_phrase'
      : 'private_key';
    const account = await requireAccountContext(req, {
      network,
      requireAuth: true,
    });
    const wallet = (account.wallets || []).find(
      item => item.id === sourceWalletId && item.network === network,
    );

    if (!wallet) {
      const error = new Error('Wallet not found for export');
      error.status = 404;
      throw error;
    }

    assertAccountWallet({
      account,
      address: wallet.address,
      network,
      walletId: sourceWalletId,
    });

    if (confirmation !== 'EXPORT') {
      const error = new Error('Enter EXPORT to confirm secret export');
      error.status = 400;
      throw error;
    }

    const result = await exportStellarWalletSecret(sourceWalletId, exportType);

    res.json({
      network,
      secret: result.secret,
      type: exportType,
    });
  } catch (error) {
    if (!error.status) {
      error.status = 502;
      error.message = 'Privy could not export the secret for this wallet.';
    }

    next(error);
  }
});

router.post('/demo/account', async (req, res, next) => {
  try {
    const network = normalizeNetwork(req.body?.network);
    const email =
      String(req.body?.email || '').trim() ||
      `stellar-demo-${Date.now()}@example.com`;

    const user =
      (await findPrivyUserByEmail(email)) || (await createPrivyUser(email));
    const wallet = normalizeWallet(
      await createSignableStellarWallet(email, `Stellar ${network} 1`),
      {
        canSign: true,
        kind: 'privy',
        network,
      },
    );
    const account = await saveAccount(
      normalizeAccountWallets(
        {
          id: user.id,
          email,
          wallet,
          wallets: [wallet],
        },
        network,
      ),
    );

    res.status(201).json({
      account,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/demo/session', async (req, res, next) => {
  try {
    const network = normalizeNetwork(req.body?.network);
    const email = normalizeEmail(req.body?.email);

    const account = await getOrCreateSessionAccountByEmail(email, network);

    res.json(await buildAccountSession(account, network));
  } catch (error) {
    next(error);
  }
});

router.post('/demo/auth-session', async (req, res, next) => {
  try {
    const network = normalizeNetwork(req.body?.network);
    const identityToken = String(req.body?.identityToken || '').trim();

    if (!identityToken) {
      const error = new Error('Missing Privy login token');
      error.status = 401;
      throw error;
    }

    const user = await getPrivyClient().users().get({
      id_token: identityToken,
    });
    const email = getEmailFromPrivyUser(user);

    if (!isEmailLike(email)) {
      const error = new Error('This Privy account does not have a valid email');
      error.status = 400;
      throw error;
    }

    const account = await getOrCreateSessionAccountByEmail(
      email,
      network,
      user.id,
    );

    res.json(await buildAccountSession(account, network));
  } catch (error) {
    if (!error.status) {
      error.status = 401;
    }

    next(error);
  }
});

router.post('/demo/wallets', async (req, res, next) => {
  try {
    const network = normalizeNetwork(req.body?.network);
    const account = await requireDemoAccountByEmail(req.body?.email, network);
    const nextWalletNumber = (account.wallets || []).length + 1;
    const displayName = sanitizeWalletName(
      req.body?.displayName,
      `Stellar ${network} ${nextWalletNumber}`,
    );
    const wallet = normalizeWallet(
      await createSignableStellarWallet(account.email, displayName),
      {
        canSign: true,
        kind: 'privy',
        network,
      },
    );
    const nextWallet = {
      ...wallet,
      archived: false,
      displayName,
    };

    if (network === 'testnet' && req.body?.fund !== false) {
      await friendbotFund(nextWallet.address, network);
    }

    const nextAccount = await saveAccount(
      normalizeAccountWallets(
        {
          ...account,
          activeWalletId: nextWallet.id,
          wallet: nextWallet,
          wallets: [...(account.wallets || []), nextWallet],
        },
        network,
      ),
    );

    res.status(201).json(await buildAccountSession(nextAccount, network));
  } catch (error) {
    next(error);
  }
});

router.post('/demo/wallets/select', async (req, res, next) => {
  try {
    const network = normalizeNetwork(req.body?.network);
    const account = await requireDemoAccountByEmail(req.body?.email, network);
    const walletId = String(req.body?.walletId || '').trim();
    const targetWallet = getVisibleWallets(account).find(
      wallet => wallet.id === walletId,
    );

    if (!targetWallet) {
      const error = new Error('Active wallet not found');
      error.status = 404;
      throw error;
    }

    const nextAccount = await saveAccount(
      normalizeAccountWallets(
        {
          ...account,
          activeWalletId: targetWallet.id,
          wallet: targetWallet,
        },
        targetWallet.network,
      ),
    );

    res.json(await buildAccountSession(nextAccount, targetWallet.network));
  } catch (error) {
    next(error);
  }
});

router.post('/demo/wallets/rename', async (req, res, next) => {
  try {
    const network = normalizeNetwork(req.body?.network);
    const account = await requireDemoAccountByEmail(req.body?.email, network);
    const walletId = String(req.body?.walletId || '').trim();
    const targetWallet = getVisibleWallets(account).find(
      wallet => wallet.id === walletId,
    );

    if (!targetWallet) {
      const error = new Error('Wallet not found for rename');
      error.status = 404;
      throw error;
    }

    const displayName = sanitizeWalletName(
      req.body?.displayName,
      targetWallet.displayName,
    );
    const wallets = (account.wallets || []).map(wallet =>
      wallet.id === walletId ? { ...wallet, displayName } : wallet,
    );
    const nextAccount = await saveAccount(
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

    res.json(await buildAccountSession(nextAccount, targetWallet.network));
  } catch (error) {
    next(error);
  }
});

router.post('/demo/wallets/archive', async (req, res, next) => {
  try {
    const network = normalizeNetwork(req.body?.network);
    const account = await requireDemoAccountByEmail(req.body?.email, network);
    const walletId = String(req.body?.walletId || '').trim();
    const visibleWallets = getVisibleWallets(account);
    const targetWallet = visibleWallets.find(wallet => wallet.id === walletId);

    if (!targetWallet) {
      const error = new Error('Wallet not found for archive');
      error.status = 404;
      throw error;
    }

    if (visibleWallets.length <= 1) {
      const error = new Error('Cannot archive the last wallet in the account');
      error.status = 400;
      throw error;
    }

    const remainingWallets = visibleWallets.filter(
      wallet => wallet.id !== walletId,
    );
    const activeWallet =
      remainingWallets.find(wallet => wallet.network === targetWallet.network) ||
      remainingWallets[0];
    const wallets = (account.wallets || []).map(wallet =>
      wallet.id === walletId
        ? { ...wallet, archived: true, archivedAt: new Date().toISOString() }
        : wallet,
    );
    const nextAccount = await saveAccount(
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

    res.json(await buildAccountSession(nextAccount, activeWallet.network));
  } catch (error) {
    next(error);
  }
});

router.post('/demo/receiver', async (req, res, next) => {
  try {
    const network = 'testnet';
    const result = await privyRequest('/wallets', {
      method: 'POST',
      body: JSON.stringify({
        chain_type: 'stellar',
        display_name: req.body?.displayName || 'Demo recipient',
        external_id: `stellar_recipient_${Date.now()}`,
      }),
    });
    const wallet = normalizeWallet(result, {
      canSign: true,
      kind: 'privy',
      network,
    });
    await friendbotFund(wallet.address, network);

    const assets = await getSupportedAssets(network);

    for (const assetDefinition of assets.filter(asset => !asset.isNative)) {
      const sourceAccount = await loadAccount(wallet.address, network);
      const issuedAsset = getIssuedAsset(assetDefinition);
      const transaction = buildTrustlineTransaction({
        asset: issuedAsset,
        network,
        sourceAccount,
      });

      await submitPrivySignedTransaction({
        network,
        sourceAddress: wallet.address,
        transaction,
        walletId: wallet.id,
      });
    }

    const contact = await saveContact({
      label: req.body?.label || 'Demo recipient',
      wallet,
      funded: true,
    });
    const balanceResult = await getAccountBalances(wallet.address, network);

    res.status(201).json({
      contact,
      balance: {
        address: wallet.address,
        balances: balanceResult.balances,
        exists: balanceResult.exists,
        network,
        xlm: balanceResult.xlm,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/stellar/:network/:address', handleStellarLookup);
router.post('/stellar/:network/fund', handleFund);
router.post('/stellar/:network/trustline', handleTrustline);
router.post('/stellar/:network/fund-asset', handleFundAsset);
router.post('/stellar/:network/send', handleSend);
router.post('/stellar/:network/swap/quote', handleSwapQuote);
router.post('/stellar/:network/swap/execute', handleSwapExecute);
router.post('/stellar/:network/swap', handleSwapExecute);

router.get('/stellar/:address', (req, res, next) =>
  handleStellarLookup(req, res, next, 'testnet'),
);
router.post('/stellar/fund', (req, res, next) =>
  handleFund(req, res, next, 'testnet'),
);
router.post('/stellar/trustline', (req, res, next) =>
  handleTrustline(req, res, next, 'testnet'),
);
router.post('/stellar/fund-asset', (req, res, next) =>
  handleFundAsset(req, res, next, 'testnet'),
);
router.post('/stellar/send', (req, res, next) =>
  handleSend(req, res, next, 'testnet'),
);
router.post('/stellar/swap/quote', (req, res, next) =>
  handleSwapQuote(req, res, next, 'testnet'),
);
router.post('/stellar/swap/execute', (req, res, next) =>
  handleSwapExecute(req, res, next, 'testnet'),
);
router.post('/stellar/swap', (req, res, next) =>
  handleSwapExecute(req, res, next, 'testnet'),
);

router.get('/ramp/providers', (req, res) => {
  res.json({
    providers: getRampProviders(),
  });
});

router.post('/ramp/quote', (req, res, next) => {
  try {
    getDisabledRampResponse();
  } catch (error) {
    next(error);
  }
});

router.post('/ramp/checkout', (req, res, next) => {
  try {
    getDisabledRampResponse();
  } catch (error) {
    next(error);
  }
});

router.get('/walletconnect/config', (req, res) => {
  res.json({
    configured: Boolean(WALLETCONNECT_PROJECT_ID),
    projectId: WALLETCONNECT_PROJECT_ID || null,
    relays: ['wss://relay.walletconnect.com'],
  });
});

router.post('/walletconnect/stellar/review-xdr', async (req, res, next) => {
  try {
    const network = normalizeNetwork(req.body?.network);
    const sourceAddress = String(req.body?.sourceAddress || '').trim();

    if (sourceAddress) {
      assertStellarAddress(sourceAddress, 'Signing wallet');
    }

    res.json(
      reviewStellarXdr({
        network,
        sourceAddress,
        xdr: req.body?.xdr,
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.post('/walletconnect/stellar/sign-xdr', async (req, res, next) => {
  const network = normalizeNetwork(req.body?.network);

  try {
    const sourceWalletId = String(req.body?.sourceWalletId || '').trim();
    const sourceAddress = String(req.body?.sourceAddress || '').trim();
    const account = await requireAccountContext(req, {
      network,
      requireAuth: true,
    });
    assertAccountWallet({
      account,
      address: sourceAddress,
      network,
      walletId: sourceWalletId,
    });
    const result = await signStellarXdr({
      network,
      sourceAddress,
      submit: Boolean(req.body?.submit),
      walletId: sourceWalletId,
      xdr: req.body?.xdr,
    });

    res.json({
      ...result,
      transaction: result.submitted
        ? buildSubmittedTransactionItem({
            amount: '0',
            assetCode: 'XLM',
            direction: 'sent',
            from: sourceAddress,
            network,
            operation: 'payment',
            submitted: result.submitted,
            to: sourceAddress,
          })
        : null,
    });
  } catch (error) {
    if (error?.response?.data?.extras?.result_codes) {
      error.message = getHorizonErrorMessage(error, network);
      error.status = 400;
    }

    next(error);
  }
});

module.exports = router;
