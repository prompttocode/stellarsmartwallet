import type { Context, Hono } from 'hono';
import {
  assertAccountWallet,
  assertAmount,
  assertStellarAddress,
  buildPaymentTransaction,
  buildSubmittedTransactionItem,
  buildTrustlineTransaction,
  executeMainnetSwap,
  findIssuedBalance,
  friendbotFund,
  fundDemoAsset,
  getAccountBalances,
  getAccountHistory,
  getAssetForOperation,
  getIssuedAsset,
  getSupportedAsset,
  loadAccount,
  makeError,
  normalizeNetwork,
  quoteDemoSwap,
  quoteMainnetSwap,
  readJsonBody,
  requireAccountContext,
  shouldRequireMainnetAuth,
  submitPrivySignedTransaction,
  swapDemoAsset,
  ensureTrustline,
  type StellarNetwork,
  type WorkerBindings,
} from '../core';

async function handleStellarLookup(
  c: Context<WorkerBindings>,
  fallbackNetwork: StellarNetwork = 'testnet',
) {
  const network = normalizeNetwork(c.req.param('network'), fallbackNetwork);
  const address = String(c.req.param('address') || '').trim();
  assertStellarAddress(address);
  const balanceResult = await getAccountBalances(c.env, address, network);

  return c.json({
    ...balanceResult,
    transactions: await getAccountHistory(c.env, address, network),
  });
}

async function handleFund(
  c: Context<WorkerBindings>,
  fallbackNetwork: StellarNetwork = 'testnet',
) {
  const body = await readJsonBody(c);
  const network = normalizeNetwork(c.req.param('network'), fallbackNetwork);
  const address = String(body.address || '').trim();
  assertStellarAddress(address);

  await friendbotFund(c.env, address, network);

  const balanceResult = await getAccountBalances(c.env, address, network);

  return c.json({
    ...balanceResult,
    transactions: await getAccountHistory(c.env, address, network),
  });
}

async function handleTrustline(
  c: Context<WorkerBindings>,
  fallbackNetwork: StellarNetwork = 'testnet',
) {
  const body = await readJsonBody(c);
  const network = normalizeNetwork(c.req.param('network'), fallbackNetwork);
  const sourceWalletId = String(body.sourceWalletId || '').trim();
  const sourceAddress = String(body.sourceAddress || '').trim();
  const account = await requireAccountContext(c.env, c.req.header('authorization'), body, {
    network,
    requireAuth: shouldRequireMainnetAuth(network),
  });
  assertAccountWallet({
    account,
    address: sourceAddress,
    network,
    walletId: sourceWalletId,
  });
  const assetDefinition = await getSupportedAsset(c.env, {
    assetCode: body.assetCode,
    assetIssuer: body.assetIssuer,
    network,
  });

  if (assetDefinition.isNative) {
    throw makeError('XLM does not need a trustline', 400);
  }

  assertStellarAddress(sourceAddress, 'Wallet');
  const sourceAccount = await loadAccount(c.env, sourceAddress, network);

  if (!sourceAccount) {
    throw makeError(
      network === 'mainnet'
        ? 'Mainnet wallet is not active. Deposit real XLM first.'
        : 'Wallet does not exist on Stellar Testnet. Fund test XLM first.',
      400,
    );
  }

  const existingBalance = findIssuedBalance(
    sourceAccount,
    assetDefinition.assetCode,
    assetDefinition.assetIssuer,
  );

  if (existingBalance) {
    const balanceResult = await getAccountBalances(c.env, sourceAddress, network);

    return c.json({
      alreadyTrusted: true,
      balances: balanceResult.balances,
      network,
      transaction: null,
      transactions: await getAccountHistory(c.env, sourceAddress, network),
    });
  }

  const transaction = buildTrustlineTransaction({
    asset: getIssuedAsset(assetDefinition),
    env: c.env,
    network,
    sourceAccount,
  });
  const submitted = await submitPrivySignedTransaction({
    env: c.env,
    network,
    sourceAddress,
    transaction,
    walletId: sourceWalletId,
  });
  const balanceResult = await getAccountBalances(c.env, sourceAddress, network);

  return c.json({
    alreadyTrusted: false,
    balances: balanceResult.balances,
    network,
    transaction: buildSubmittedTransactionItem({
      amount: '0',
      assetCode: assetDefinition.assetCode,
      assetIssuer: assetDefinition.assetIssuer,
      direction: 'trustline',
      env: c.env,
      from: sourceAddress,
      network,
      operation: 'change_trust',
      submitted,
      to: assetDefinition.assetIssuer || '',
    }),
    transactions: await getAccountHistory(c.env, sourceAddress, network),
  });
}

async function handleFundAsset(
  c: Context<WorkerBindings>,
  fallbackNetwork: StellarNetwork = 'testnet',
) {
  const body = await readJsonBody(c);
  const network = normalizeNetwork(c.req.param('network'), fallbackNetwork);
  const destination = String(body.address || '').trim();
  assertStellarAddress(destination, 'Recipient wallet');
  const assetDefinition = await getSupportedAsset(c.env, {
    assetCode: body.assetCode,
    assetIssuer: body.assetIssuer,
    network,
  });
  const amount = assertAmount(body.amount || '100');
  const submitted = await fundDemoAsset({
    amount,
    assetCode: assetDefinition.assetCode,
    destination,
    env: c.env,
    network,
  });
  const balanceResult = await getAccountBalances(c.env, destination, network);

  return c.json({
    balances: balanceResult.balances,
    network,
    transaction: buildSubmittedTransactionItem({
      amount,
      assetCode: assetDefinition.assetCode,
      assetIssuer: assetDefinition.assetIssuer,
      direction: 'received',
      env: c.env,
      from: assetDefinition.assetIssuer || '',
      network,
      operation: 'payment',
      submitted,
      to: destination,
    }),
    transactions: await getAccountHistory(c.env, destination, network),
  });
}

async function handleSend(
  c: Context<WorkerBindings>,
  fallbackNetwork: StellarNetwork = 'testnet',
) {
  const body = await readJsonBody(c);
  const network = normalizeNetwork(c.req.param('network'), fallbackNetwork);
  const accountId = String(body.accountId || '').trim();
  const sourceWalletId = String(body.sourceWalletId || '').trim();
  const sourceAddress = String(body.sourceAddress || '').trim();
  const destination = String(body.destination || '').trim();
  const amount = assertAmount(body.amount);
  const account = await requireAccountContext(c.env, c.req.header('authorization'), body, {
    network,
    requireAuth: shouldRequireMainnetAuth(network),
  });
  const sourceWallet = assertAccountWallet({
    account,
    address: sourceAddress,
    network,
    walletId: sourceWalletId,
  });

  if (!sourceWallet.canSign) {
    throw makeError('This wallet cannot sign transactions', 403);
  }

  assertStellarAddress(sourceAddress, 'Source wallet');
  assertStellarAddress(destination, 'Recipient wallet');

  const sourceAccount = await loadAccount(c.env, sourceAddress, network);

  if (!sourceAccount) {
    throw makeError(
      network === 'mainnet'
        ? 'Source Mainnet wallet is not active. Deposit real XLM first.'
        : 'Source wallet does not exist on Stellar Testnet. Fund test XLM first.',
      400,
    );
  }

  const destinationAccount = await loadAccount(c.env, destination, network);
  const assetDefinition = await getSupportedAsset(c.env, {
    assetCode: body.assetCode,
    assetIssuer: body.assetIssuer,
    network,
  });
  const asset = assetDefinition.isNative ? null : getAssetForOperation(assetDefinition);

  if (!assetDefinition.isNative) {
    ensureTrustline(sourceAccount, assetDefinition, 'Source wallet');

    if (!destinationAccount) {
      throw makeError(
        `Recipient wallet is not active and cannot receive ${assetDefinition.assetCode}`,
        400,
      );
    }

    ensureTrustline(destinationAccount, assetDefinition, 'Recipient wallet');
  }

  const { operationType, transaction } = buildPaymentTransaction({
    amount,
    asset,
    destination,
    destinationAccount,
    env: c.env,
    network,
    sourceAccount,
  });
  const submitted = await submitPrivySignedTransaction({
    env: c.env,
    network,
    sourceAddress,
    transaction,
    walletId: sourceWalletId,
  });
  const refreshedSource = await getAccountBalances(c.env, sourceAddress, network);
  const refreshedDestination = await getAccountBalances(c.env, destination, network);
  const transactionItem = buildSubmittedTransactionItem({
    amount,
    assetCode: assetDefinition.assetCode,
    assetIssuer: assetDefinition.assetIssuer,
    direction: 'sent',
    env: c.env,
    from: sourceAddress,
    network,
    operation: operationType,
    submitted,
    to: destination,
  });

  return c.json({
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
    transactions: await getAccountHistory(c.env, sourceAddress, network),
  });
}

async function handleSwapQuote(
  c: Context<WorkerBindings>,
  fallbackNetwork: StellarNetwork = 'testnet',
) {
  const body = await readJsonBody(c);
  const network = normalizeNetwork(c.req.param('network'), fallbackNetwork);
  const sourceAddress = String(body.sourceAddress || '').trim();
  assertStellarAddress(sourceAddress, 'Swap wallet');

  if (network === 'testnet') {
    const result = await quoteDemoSwap(c.env, {
      amount: body.amount,
      fromAssetCode: body.fromAssetCode,
      toAssetCode: body.toAssetCode,
    });

    return c.json({
      destMin: result.toAmount,
      fromAmount: result.fromAmount,
      fromAssetCode: result.fromAssetCode,
      network,
      rate: result.rate,
      simulated: true,
      toAmount: result.toAmount,
      toAssetCode: result.toAssetCode,
    });
  }

  const result = await quoteMainnetSwap(c.env, {
    amount: body.amount,
    fromAssetCode: body.fromAssetCode,
    fromAssetIssuer: body.fromAssetIssuer,
    sourceAddress,
    toAssetCode: body.toAssetCode,
    toAssetIssuer: body.toAssetIssuer,
  });

  return c.json({
    ...result,
    network,
  });
}

async function handleSwapExecute(c: Context<WorkerBindings>, fallbackNetwork?: StellarNetwork) {
  const body = await readJsonBody(c);
  const network = normalizeNetwork(c.req.param('network'), fallbackNetwork || 'testnet');
  const accountId = String(body.accountId || '').trim();
  const sourceWalletId = String(body.sourceWalletId || '').trim();
  const sourceAddress = String(body.sourceAddress || '').trim();
  const account = await requireAccountContext(c.env, c.req.header('authorization'), body, {
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
      ? await executeMainnetSwap(c.env, {
          amount: body.amount,
          fromAssetCode: body.fromAssetCode,
          fromAssetIssuer: body.fromAssetIssuer,
          sourceAddress,
          sourceWalletId,
          toAssetCode: body.toAssetCode,
          toAssetIssuer: body.toAssetIssuer,
        })
      : await swapDemoAsset(c.env, {
          amount: body.amount,
          fromAssetCode: body.fromAssetCode,
          sourceAddress,
          sourceWalletId,
          toAssetCode: body.toAssetCode,
        });
  const refreshedSource = await getAccountBalances(c.env, sourceAddress, network);
  const transactionItem = buildSubmittedTransactionItem({
    amount: result.fromAmount,
    assetCode: result.fromAssetCode,
    assetIssuer: result.fromAssetIssuer,
    direction: 'sent',
    env: c.env,
    from: sourceAddress,
    network,
    operation: network === 'mainnet' ? 'path_payment_strict_send' : 'payment',
    submitted: result.submitted,
    to: result.payoutAddress,
  });

  return c.json({
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
    transactions: await getAccountHistory(c.env, sourceAddress, network),
  });
}

export function registerStellarRoutes(app: Hono<WorkerBindings>) {
  app.get('/api/stellar/:network/:address', c => handleStellarLookup(c));
  app.post('/api/stellar/:network/fund', c => handleFund(c));
  app.post('/api/stellar/:network/trustline', c => handleTrustline(c));
  app.post('/api/stellar/:network/fund-asset', c => handleFundAsset(c));
  app.post('/api/stellar/:network/send', c => handleSend(c));
  app.post('/api/stellar/:network/swap/quote', c => handleSwapQuote(c));
  app.post('/api/stellar/:network/swap/execute', c => handleSwapExecute(c));
  app.post('/api/stellar/:network/swap', c => handleSwapExecute(c));

  app.get('/api/stellar/:address', c => handleStellarLookup(c, 'testnet'));
  app.post('/api/stellar/fund', c => handleFund(c, 'testnet'));
  app.post('/api/stellar/trustline', c => handleTrustline(c, 'testnet'));
  app.post('/api/stellar/fund-asset', c => handleFundAsset(c, 'testnet'));
  app.post('/api/stellar/send', c => handleSend(c, 'testnet'));
  app.post('/api/stellar/swap/quote', c => handleSwapQuote(c, 'testnet'));
  app.post('/api/stellar/swap/execute', c => handleSwapExecute(c, 'testnet'));
  app.post('/api/stellar/swap', c => handleSwapExecute(c, 'testnet'));

}
