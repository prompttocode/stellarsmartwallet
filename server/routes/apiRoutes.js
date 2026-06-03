/* eslint-env node */

const express = require('express');
const { HORIZON_URL, PRIVY_APP_ID } = require('../config');
const {
  getAccountByEmail,
  saveAccount,
  saveContact,
} = require('../db');
const {
  createPrivyUser,
  createSignableStellarWallet,
  findPrivyUserByEmail,
  getEmailFromPrivyUser,
  getPrivyClient,
  normalizeWallet,
  privyRequest,
} = require('../services/privy');
const {
  assertAmount,
  assertStellarAddress,
  buildPaymentTransaction,
  buildTrustlineTransaction,
  ensureTrustline,
  friendbotFund,
  fundDemoAsset,
  getAccountBalances,
  getAccountHistory,
  getHorizonErrorMessage,
  getIssuedAsset,
  getSupportedAsset,
  getSupportedAssets,
  loadAccount,
  submitPrivySignedTransaction,
  swapDemoAsset,
} = require('../services/stellar');
const { isEmailLike, normalizeEmail } = require('../utils/validation');

const router = express.Router();

function normalizeWalletForAccount(wallet, index = 0) {
  if (!wallet?.id || !wallet?.address) {
    return null;
  }

  return {
    ...wallet,
    archived: Boolean(wallet.archived),
    displayName: wallet.displayName || `Stellar Wallet ${index + 1}`,
  };
}

function normalizeAccountWallets(account) {
  const inputWallets = Array.isArray(account.wallets)
    ? [...account.wallets]
    : [];

  if (
    account.wallet?.id &&
    !inputWallets.some(wallet => wallet.id === account.wallet.id)
  ) {
    inputWallets.unshift(account.wallet);
  }

  const wallets = inputWallets
    .map((wallet, index) => normalizeWalletForAccount(wallet, index))
    .filter(Boolean)
    .filter(
      (wallet, index, allWallets) =>
        allWallets.findIndex(item => item.id === wallet.id) === index,
    );
  const visibleWallets = wallets.filter(wallet => !wallet.archived);
  const activeWallet =
    visibleWallets.find(wallet => wallet.id === account.activeWalletId) ||
    visibleWallets.find(wallet => wallet.id === account.wallet?.id) ||
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

function getVisibleWallets(account) {
  return (account.wallets || []).filter(wallet => !wallet.archived);
}

function sanitizeWalletName(value, fallback) {
  const name = String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 42);

  return name || fallback;
}

async function requireDemoAccountByEmail(emailValue) {
  const email = normalizeEmail(emailValue);

  if (!isEmailLike(email)) {
    const error = new Error('Email không hợp lệ');
    error.status = 400;
    throw error;
  }

  const account = getAccountByEmail(email);

  if (!account) {
    const error = new Error('Không tìm thấy tài khoản demo');
    error.status = 404;
    throw error;
  }

  return ensureSignableDemoAccount(account);
}

async function ensureSignableDemoAccount(account) {
  if (account?.wallet?.id && account?.wallet?.address) {
    return saveAccount(normalizeAccountWallets(account));
  }

  const wallet = await createSignableStellarWallet(
    account.email,
    'Stellar Wallet 1',
  );

  return saveAccount(normalizeAccountWallets({
    ...account,
    wallet: normalizeWallet(wallet),
  }));
}

async function buildAccountSession(account) {
  const normalizedAccount = saveAccount(normalizeAccountWallets(account));
  const visibleWallets = getVisibleWallets(normalizedAccount);
  const activeWallet = normalizedAccount.wallet;

  if (!activeWallet?.address) {
    const error = new Error('Tài khoản demo chưa có ví Stellar');
    error.status = 500;
    throw error;
  }

  const balanceResult = await getAccountBalances(activeWallet.address);
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
      xlm: balanceResult.xlm,
    },
    balances: balanceResult.balances,
    transactions: await getAccountHistory(activeWallet.address),
    wallets: visibleWallets,
  };
}

function buildSubmittedTransactionItem({
  amount,
  assetCode,
  assetIssuer,
  direction = 'sent',
  from,
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
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${submitted.hash}`,
    from,
    hash: submitted.hash,
    ledger: submitted.ledger,
    operation,
    to,
  };
}

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    privyAppId: PRIVY_APP_ID || null,
    network: 'Stellar Testnet',
    horizonUrl: HORIZON_URL,
  });
});

router.get('/wallets', async (req, res, next) => {
  try {
    const result = await privyRequest('/wallets?chain_type=stellar&limit=20');
    const wallets = Array.isArray(result?.data) ? result.data : [];

    res.json({
      wallets: wallets.map(normalizeWallet),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/assets', async (req, res, next) => {
  try {
    res.json({
      assets: await getSupportedAssets(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/wallets', async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
});

router.post('/demo/account', async (req, res, next) => {
  try {
    const email =
      String(req.body?.email || '').trim() ||
      `stellar-demo-${Date.now()}@example.com`;

    const user =
      (await findPrivyUserByEmail(email)) || (await createPrivyUser(email));
    const wallet = await createSignableStellarWallet(email, 'Stellar Wallet 1');
    const account = saveAccount(normalizeAccountWallets({
      id: user.id,
      email,
      wallet: normalizeWallet(wallet),
    }));

    res.status(201).json({
      account,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/demo/session', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!isEmailLike(email)) {
      const error = new Error('Email không hợp lệ');
      error.status = 400;
      throw error;
    }

    const localAccount = getAccountByEmail(email);

    if (localAccount) {
      const account = await ensureSignableDemoAccount(localAccount);
      res.json(await buildAccountSession(account));
      return;
    }

    const existingUser = await findPrivyUserByEmail(email);
    const user = existingUser || (await createPrivyUser(email));
    const wallet = await createSignableStellarWallet(email, 'Stellar Wallet 1');
    const account = saveAccount(normalizeAccountWallets({
      id: user.id,
      email,
      wallet: normalizeWallet(wallet),
    }));

    res
      .status(existingUser ? 200 : 201)
      .json(await buildAccountSession(account));
  } catch (error) {
    next(error);
  }
});

router.post('/demo/auth-session', async (req, res, next) => {
  try {
    const identityToken = String(req.body?.identityToken || '').trim();

    if (!identityToken) {
      const error = new Error('Thiếu token đăng nhập Privy');
      error.status = 401;
      throw error;
    }

    const user = await getPrivyClient().users().get({
      id_token: identityToken,
    });
    const email = getEmailFromPrivyUser(user);

    if (!isEmailLike(email)) {
      const error = new Error('Tài khoản Privy này chưa có email hợp lệ');
      error.status = 400;
      throw error;
    }

    const localAccount = getAccountByEmail(email);

    if (localAccount) {
      const account = await ensureSignableDemoAccount({
        ...localAccount,
        id: user.id,
      });
      res.json(await buildAccountSession(account));
      return;
    }

    const wallet = await createSignableStellarWallet(email, 'Stellar Wallet 1');
    const account = saveAccount(normalizeAccountWallets({
      id: user.id,
      email,
      wallet: normalizeWallet(wallet),
    }));

    res.status(201).json(await buildAccountSession(account));
  } catch (error) {
    if (!error.status) {
      error.status = 401;
    }

    next(error);
  }
});

router.post('/demo/wallets', async (req, res, next) => {
  try {
    const account = await requireDemoAccountByEmail(req.body?.email);
    const nextWalletNumber = (account.wallets || []).length + 1;
    const displayName = sanitizeWalletName(
      req.body?.displayName,
      `Stellar Wallet ${nextWalletNumber}`,
    );
    const wallet = normalizeWallet(
      await createSignableStellarWallet(account.email, displayName),
    );
    const nextWallet = {
      ...wallet,
      archived: false,
      displayName,
    };

    await friendbotFund(nextWallet.address);

    const nextAccount = saveAccount(
      normalizeAccountWallets({
        ...account,
        activeWalletId: nextWallet.id,
        wallet: nextWallet,
        wallets: [...(account.wallets || []), nextWallet],
      }),
    );

    res.status(201).json(await buildAccountSession(nextAccount));
  } catch (error) {
    next(error);
  }
});

router.post('/demo/wallets/select', async (req, res, next) => {
  try {
    const account = await requireDemoAccountByEmail(req.body?.email);
    const walletId = String(req.body?.walletId || '').trim();
    const targetWallet = getVisibleWallets(account).find(
      wallet => wallet.id === walletId,
    );

    if (!targetWallet) {
      const error = new Error('Không tìm thấy ví đang hoạt động');
      error.status = 404;
      throw error;
    }

    const nextAccount = saveAccount(
      normalizeAccountWallets({
        ...account,
        activeWalletId: targetWallet.id,
        wallet: targetWallet,
      }),
    );

    res.json(await buildAccountSession(nextAccount));
  } catch (error) {
    next(error);
  }
});

router.post('/demo/wallets/rename', async (req, res, next) => {
  try {
    const account = await requireDemoAccountByEmail(req.body?.email);
    const walletId = String(req.body?.walletId || '').trim();
    const targetWallet = getVisibleWallets(account).find(
      wallet => wallet.id === walletId,
    );

    if (!targetWallet) {
      const error = new Error('Không tìm thấy ví để đổi tên');
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
    const nextAccount = saveAccount(
      normalizeAccountWallets({
        ...account,
        wallet:
          account.wallet?.id === walletId
            ? { ...account.wallet, displayName }
            : account.wallet,
        wallets,
      }),
    );

    res.json(await buildAccountSession(nextAccount));
  } catch (error) {
    next(error);
  }
});

router.post('/demo/wallets/archive', async (req, res, next) => {
  try {
    const account = await requireDemoAccountByEmail(req.body?.email);
    const walletId = String(req.body?.walletId || '').trim();
    const visibleWallets = getVisibleWallets(account);
    const targetWallet = visibleWallets.find(wallet => wallet.id === walletId);

    if (!targetWallet) {
      const error = new Error('Không tìm thấy ví để ẩn');
      error.status = 404;
      throw error;
    }

    if (visibleWallets.length <= 1) {
      const error = new Error('Không thể ẩn ví cuối cùng trong tài khoản');
      error.status = 400;
      throw error;
    }

    const remainingWallets = visibleWallets.filter(
      wallet => wallet.id !== walletId,
    );
    const activeWalletId =
      account.activeWalletId === walletId || account.wallet?.id === walletId
        ? remainingWallets[0].id
        : account.activeWalletId;
    const activeWallet =
      remainingWallets.find(wallet => wallet.id === activeWalletId) ||
      remainingWallets[0];
    const wallets = (account.wallets || []).map(wallet =>
      wallet.id === walletId
        ? { ...wallet, archived: true, archivedAt: new Date().toISOString() }
        : wallet,
    );
    const nextAccount = saveAccount(
      normalizeAccountWallets({
        ...account,
        activeWalletId: activeWallet.id,
        wallet: activeWallet,
        wallets,
      }),
    );

    res.json(await buildAccountSession(nextAccount));
  } catch (error) {
    next(error);
  }
});

router.post('/demo/receiver', async (req, res, next) => {
  try {
    const result = await privyRequest('/wallets', {
      method: 'POST',
      body: JSON.stringify({
        chain_type: 'stellar',
        display_name: req.body?.displayName || 'Demo recipient',
        external_id: `stellar_recipient_${Date.now()}`,
      }),
    });
    const wallet = normalizeWallet(result);
    await friendbotFund(wallet.address);

    const assets = await getSupportedAssets();

    for (const assetDefinition of assets.filter(asset => !asset.isNative)) {
      const sourceAccount = await loadAccount(wallet.address);
      const issuedAsset = getIssuedAsset(
        assetDefinition.assetCode,
        assetDefinition.assetIssuer,
      );
      const transaction = buildTrustlineTransaction({
        asset: issuedAsset,
        sourceAccount,
      });

      await submitPrivySignedTransaction({
        sourceAddress: wallet.address,
        transaction,
        walletId: wallet.id,
      });
    }

    const contact = saveContact({
      label: req.body?.label || 'Người nhận demo',
      wallet,
      funded: true,
    });
    const balanceResult = await getAccountBalances(wallet.address);

    res.status(201).json({
      contact,
      balance: {
        address: wallet.address,
        balances: balanceResult.balances,
        exists: balanceResult.exists,
        xlm: balanceResult.xlm,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/stellar/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    assertStellarAddress(address);

    const balanceResult = await getAccountBalances(address);

    res.json({
      ...balanceResult,
      transactions: await getAccountHistory(address),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/stellar/fund', async (req, res, next) => {
  try {
    const address = String(req.body?.address || '').trim();
    assertStellarAddress(address);

    await friendbotFund(address);
    const balanceResult = await getAccountBalances(address);

    res.json({
      address,
      balances: balanceResult.balances,
      exists: balanceResult.exists,
      transactions: await getAccountHistory(address),
      xlm: balanceResult.xlm,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/stellar/trustline', async (req, res, next) => {
  try {
    const sourceWalletId = String(req.body?.sourceWalletId || '').trim();
    const sourceAddress = String(req.body?.sourceAddress || '').trim();
    const assetDefinition = await getSupportedAsset(req.body?.assetCode);

    if (assetDefinition.isNative) {
      const error = new Error('XLM không cần add trustline');
      error.status = 400;
      throw error;
    }

    if (!sourceWalletId) {
      const error = new Error('Thiếu Privy wallet id của ví');
      error.status = 400;
      throw error;
    }

    assertStellarAddress(sourceAddress, 'Ví');

    const sourceAccount = await loadAccount(sourceAddress);

    if (!sourceAccount) {
      const error = new Error(
        'Ví chưa có trên Stellar Testnet. Hãy nạp test XLM trước.',
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
      const balanceResult = await getAccountBalances(sourceAddress);

      res.json({
        alreadyTrusted: true,
        balances: balanceResult.balances,
        transaction: null,
        transactions: await getAccountHistory(sourceAddress),
      });
      return;
    }

    const issuedAsset = getIssuedAsset(
      assetDefinition.assetCode,
      assetDefinition.assetIssuer,
    );
    const transaction = buildTrustlineTransaction({
      asset: issuedAsset,
      sourceAccount,
    });
    const submitted = await submitPrivySignedTransaction({
      sourceAddress,
      transaction,
      walletId: sourceWalletId,
    });
    const balanceResult = await getAccountBalances(sourceAddress);

    res.json({
      alreadyTrusted: false,
      balances: balanceResult.balances,
      transaction: buildSubmittedTransactionItem({
        amount: '0',
        assetCode: assetDefinition.assetCode,
        assetIssuer: assetDefinition.assetIssuer,
        direction: 'trustline',
        from: sourceAddress,
        operation: 'change_trust',
        submitted,
        to: assetDefinition.assetIssuer,
      }),
      transactions: await getAccountHistory(sourceAddress),
    });
  } catch (error) {
    if (error?.response?.data?.extras?.result_codes) {
      error.message = getHorizonErrorMessage(error);
      error.status = 400;
    }

    next(error);
  }
});

router.post('/stellar/fund-asset', async (req, res, next) => {
  try {
    const destination = String(req.body?.address || '').trim();
    const assetDefinition = await getSupportedAsset(req.body?.assetCode);
    const amount = assertAmount(req.body?.amount || '100');

    assertStellarAddress(destination, 'Ví nhận');

    const submitted = await fundDemoAsset({
      amount,
      assetCode: assetDefinition.assetCode,
      destination,
    });
    const balanceResult = await getAccountBalances(destination);

    res.json({
      balances: balanceResult.balances,
      transaction: buildSubmittedTransactionItem({
        amount,
        assetCode: assetDefinition.assetCode,
        assetIssuer: assetDefinition.assetIssuer,
        direction: 'received',
        from: assetDefinition.assetIssuer,
        operation: 'payment',
        submitted,
        to: destination,
      }),
      transactions: await getAccountHistory(destination),
    });
  } catch (error) {
    if (error?.response?.data?.extras?.result_codes) {
      error.message = getHorizonErrorMessage(error);
      error.status = 400;
    }

    next(error);
  }
});

router.post('/stellar/send', async (req, res, next) => {
  try {
    const accountId = String(req.body?.accountId || '').trim();
    const sourceWalletId = String(req.body?.sourceWalletId || '').trim();
    const sourceAddress = String(req.body?.sourceAddress || '').trim();
    const destination = String(req.body?.destination || '').trim();
    const amount = assertAmount(req.body?.amount);
    const assetDefinition = await getSupportedAsset(req.body?.assetCode);

    if (!sourceWalletId) {
      const error = new Error('Thiếu Privy wallet id của ví gửi');
      error.status = 400;
      throw error;
    }

    assertStellarAddress(sourceAddress, 'Ví gửi');
    assertStellarAddress(destination, 'Ví nhận');

    const sourceAccount = await loadAccount(sourceAddress);

    if (!sourceAccount) {
      const error = new Error(
        'Ví gửi chưa có trên Stellar Testnet. Hãy nạp test XLM trước.',
      );
      error.status = 400;
      throw error;
    }

    const destinationAccount = await loadAccount(destination);
    const asset = assetDefinition.isNative
      ? null
      : getIssuedAsset(assetDefinition.assetCode, assetDefinition.assetIssuer);

    if (!assetDefinition.isNative) {
      ensureTrustline(sourceAccount, assetDefinition, 'Ví gửi');

      if (!destinationAccount) {
        const error = new Error(
          `Ví nhận chưa có trên Stellar Testnet, chưa thể nhận ${assetDefinition.assetCode}`,
        );
        error.status = 400;
        throw error;
      }

      ensureTrustline(destinationAccount, assetDefinition, 'Ví nhận');
    }

    const { operationType, transaction } = buildPaymentTransaction({
      amount,
      asset,
      destination,
      destinationAccount,
      sourceAccount,
    });
    const submitted = await submitPrivySignedTransaction({
      sourceAddress,
      transaction,
      walletId: sourceWalletId,
    });
    const refreshedSource = await getAccountBalances(sourceAddress);
    const refreshedDestination = await getAccountBalances(destination);
    const transactionItem = buildSubmittedTransactionItem({
      amount,
      assetCode: assetDefinition.assetCode,
      assetIssuer: assetDefinition.assetIssuer,
      direction: 'sent',
      from: sourceAddress,
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
      operation: operationType,
      sourceBalances: refreshedSource.balances,
      sourceWalletId,
      sourceXlm: refreshedSource.xlm,
      transaction: transactionItem,
      transactions: await getAccountHistory(sourceAddress),
    });
  } catch (error) {
    if (error?.response?.data?.extras?.result_codes) {
      error.message = getHorizonErrorMessage(error);
      error.status = 400;
    }

    next(error);
  }
});

router.post('/stellar/swap', async (req, res, next) => {
  try {
    const accountId = String(req.body?.accountId || '').trim();
    const sourceWalletId = String(req.body?.sourceWalletId || '').trim();
    const sourceAddress = String(req.body?.sourceAddress || '').trim();

    assertStellarAddress(sourceAddress, 'Ví swap');

    const result = await swapDemoAsset({
      amount: req.body?.amount,
      fromAssetCode: req.body?.fromAssetCode,
      sourceAddress,
      sourceWalletId,
      toAssetCode: req.body?.toAssetCode,
    });
    const refreshedSource = await getAccountBalances(sourceAddress);
    const transactionItem = buildSubmittedTransactionItem({
      amount: result.fromAmount,
      assetCode: result.fromAssetCode,
      assetIssuer: result.fromAssetIssuer,
      direction: 'sent',
      from: sourceAddress,
      operation: 'payment',
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
      rate: result.rate,
      sourceWalletId,
      toAmount: result.toAmount,
      toAssetCode: result.toAssetCode,
      transaction: transactionItem,
      transactions: await getAccountHistory(sourceAddress),
    });
  } catch (error) {
    if (error?.response?.data?.extras?.result_codes) {
      error.message = getHorizonErrorMessage(error);
      error.status = 400;
    }

    next(error);
  }
});

module.exports = router;
