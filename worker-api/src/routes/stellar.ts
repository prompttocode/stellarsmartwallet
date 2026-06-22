import type { Context, Hono } from 'hono';
import {
  assertAccountWallet,
  assertCanAddTrustline,
  assertAmount,
  assertSufficientBalance,
  assertStellarAddress,
  buildPaymentTransaction,
  buildSubmittedTransactionItem,
  buildTrustlineTransaction,
  bytesToHex,
  executeStellarSwap,
  findIssuedBalance,
  friendbotFund,
  getAccountBalances,
  getAccountHistory,
  getAssetForOperation,
  getIssuedAsset,
  getSupportedAsset,
  loadAccount,
  makeError,
  normalizeNetwork,
  parseStellarXdr,
  quoteStellarSwap,
  readJsonBody,
  requireClassicTransaction,
  requireAccountContext,
  shouldRequireMainnetAuth,
  submitPrivySignedTransaction,
  ensureTrustline,
  type StellarNetwork,
  type WorkerBindings,
} from '../core';

function maskStellarAddress(value: string) {
  return value.length > 12
    ? `${value.slice(0, 6)}...${value.slice(-6)}`
    : value;
}

function stellarPaymentLog(
  level: 'info' | 'error',
  event: string,
  details: Record<string, unknown>,
) {
  const entry = JSON.stringify({
    event,
    service: 'stellar-payment',
    timestamp: new Date().toISOString(),
    ...details,
  });

  if (level === 'error') {
    console.error(entry);
    return;
  }

  console.info(entry);
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

function assertTrustlineTransaction(
  transaction: ReturnType<typeof requireClassicTransaction>,
  sourceAddress: string,
  assetCode: string,
  assetIssuer?: string | null,
) {
  if (transaction.source !== sourceAddress) {
    throw makeError('Signed transaction does not use the selected wallet', 403);
  }

  const operations = (transaction.operations || []) as Array<Record<string, any>>;
  const operation = operations[0];
  const line = operation?.line as Record<string, any> | undefined;

  if (
    operations.length !== 1 ||
    operation?.type !== 'changeTrust' ||
    String(line?.code || '') !== assetCode ||
    String(line?.issuer || '') !== String(assetIssuer || '')
  ) {
    throw makeError('Signed transaction does not match the requested asset', 400);
  }
}

function isNativeOperationAsset(asset: Record<string, any> | undefined) {
  if (!asset) {
    return false;
  }

  if (typeof asset.isNative === 'function') {
    return asset.isNative();
  }

  return String(asset.code || '').toUpperCase() === 'XLM' && !asset.issuer;
}

function stellarAmountsEqual(left: unknown, right: unknown) {
  const leftAmount = Number(left);
  const rightAmount = Number(right);

  return (
    Number.isFinite(leftAmount) &&
    Number.isFinite(rightAmount) &&
    leftAmount.toFixed(7) === rightAmount.toFixed(7)
  );
}

function assertPaymentTransaction(
  transaction: ReturnType<typeof requireClassicTransaction>,
  {
    amount,
    assetCode,
    assetIssuer,
    destination,
    isNative,
    sourceAddress,
  }: {
    amount: string;
    assetCode: string;
    assetIssuer?: string | null;
    destination: string;
    isNative: boolean;
    sourceAddress: string;
  },
) {
  if (transaction.source !== sourceAddress) {
    throw makeError('Signed transaction does not use the selected wallet', 403);
  }

  const operations = (transaction.operations || []) as Array<Record<string, any>>;
  const operation = operations[0];

  if (operations.length !== 1 || !operation) {
    throw makeError('Signed transaction does not match the transfer request', 400);
  }

  if (isNative && operation.type === 'createAccount') {
    if (
      String(operation.destination || '') !== destination ||
      !stellarAmountsEqual(operation.startingBalance, amount)
    ) {
      throw makeError('Signed transaction does not match the transfer request', 400);
    }

    return;
  }

  const operationAsset = operation.asset as Record<string, any> | undefined;
  const matchesAsset = isNative
    ? isNativeOperationAsset(operationAsset)
    : String(operationAsset?.code || '') === assetCode &&
      String(operationAsset?.issuer || '') === String(assetIssuer || '');

  if (
    operation.type !== 'payment' ||
    String(operation.destination || '') !== destination ||
    !stellarAmountsEqual(operation.amount, amount) ||
    !matchesAsset
  ) {
    throw makeError('Signed transaction does not match the transfer request', 400);
  }
}

async function handleStellarLookup(
  c: Context<WorkerBindings>,
  fallbackNetwork: StellarNetwork = 'testnet',
) {
  const network = normalizeNetwork(c.req.param('network'), fallbackNetwork);
  const address = String(c.req.param('address') || '').trim();
  assertStellarAddress(address);
  const [balanceResult, transactions] = await Promise.all([
    getAccountBalances(c.env, address, network),
    getAccountHistory(c.env, address, network),
  ]);

  return c.json({
    ...balanceResult,
    transactions,
  });
}

async function handleStellarHistory(
  c: Context<WorkerBindings>,
  fallbackNetwork: StellarNetwork = 'testnet',
) {
  const network = normalizeNetwork(c.req.param('network'), fallbackNetwork);
  const address = String(c.req.param('address') || '').trim();
  const parsedLimit = Number(c.req.query('limit') || 30);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(100, Math.floor(parsedLimit)))
    : 30;

  assertStellarAddress(address);

  return c.json({
    address,
    network,
    transactions: await getAccountHistory(c.env, address, network, limit),
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

  const [balanceResult, transactions] = await Promise.all([
    getAccountBalances(c.env, address, network),
    getAccountHistory(c.env, address, network),
  ]);

  return c.json({
    ...balanceResult,
    transactions,
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
  const sourceWallet = assertAccountWallet({
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

  if (!sourceWallet.canSign) {
    throw makeError('This wallet cannot sign transactions', 403);
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
    const [balanceResult, transactions] = await Promise.all([
      getAccountBalances(c.env, sourceAddress, network),
      getAccountHistory(c.env, sourceAddress, network),
    ]);

    return c.json({
      alreadyTrusted: true,
      balances: balanceResult.balances,
      network,
      transaction: null,
      transactions,
    });
  }

  assertCanAddTrustline(sourceAccount, assetDefinition.assetCode);

  const preparedTransaction = buildTrustlineTransaction({
    asset: getIssuedAsset(assetDefinition),
    env: c.env,
    network,
    sourceAccount,
  });
  const clientSignatureHex = normalizeClientSignature(
    body.clientSignature || body.signature,
  );
  const transaction =
    clientSignatureHex && body.transactionXdr
      ? requireClassicTransaction(parseStellarXdr(c.env, body.transactionXdr, network))
      : preparedTransaction;

  if (clientSignatureHex && body.transactionXdr) {
    assertTrustlineTransaction(
      transaction,
      sourceAddress,
      assetDefinition.assetCode,
      assetDefinition.assetIssuer,
    );
  }

  const signingHash = `0x${bytesToHex(transaction.hash() as Uint8Array)}`;
  const expectedSigningHash = String(
    body.signingHash || body.hash || '',
  ).trim();

  if (
    clientSignatureHex &&
    expectedSigningHash &&
    expectedSigningHash.toLowerCase() !== signingHash.toLowerCase()
  ) {
    throw makeError('Transaction changed before signing. Please try again.', 409);
  }

  if (
    sourceWallet.kind !== 'imported_privy' &&
    !clientSignatureHex &&
    body.clientSigningSupported === true
  ) {
    return c.json(
      {
        alreadyTrusted: false,
        balances: [],
        hash: signingHash,
        network,
        requiresClientSignature: true,
        transaction: null,
        transactionXdr: transaction.toEnvelope().toXDR('base64'),
        transactions: [],
      },
      202,
    );
  }

  const submitted = await submitPrivySignedTransaction({
    clientSignatureHex: clientSignatureHex || undefined,
    env: c.env,
    network,
    sourceAddress,
    transaction,
    wallet: sourceWallet,
    walletId: sourceWalletId,
  });
  const [balanceResult, transactions] = await Promise.all([
    getAccountBalances(c.env, sourceAddress, network),
    getAccountHistory(c.env, sourceAddress, network),
  ]);

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
    transactions,
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

  if (network === 'mainnet' && assetDefinition.isNative && !destinationAccount) {
    throw makeError(
      'Recipient wallet is not active on Stellar Mainnet. Ask the recipient to activate their wallet before sending XLM.',
      400,
    );
  }

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
  assertSufficientBalance(sourceAccount, assetDefinition, amount);

  const { operationType, transaction: preparedTransaction } = buildPaymentTransaction({
    amount,
    asset,
    destination,
    destinationAccount,
    env: c.env,
    memo: String(body.memo || ''),
    network,
    sourceAccount,
  });
  const clientSignatureHex = normalizeClientSignature(
    body.clientSignature || body.signature,
  );
  const transaction =
    clientSignatureHex && body.transactionXdr
      ? requireClassicTransaction(parseStellarXdr(c.env, body.transactionXdr, network))
      : preparedTransaction;

  if (clientSignatureHex && body.transactionXdr) {
    assertPaymentTransaction(transaction, {
      amount,
      assetCode: assetDefinition.assetCode,
      assetIssuer: assetDefinition.assetIssuer,
      destination,
      isNative: assetDefinition.isNative,
      sourceAddress,
    });
  }

  const signingHash = `0x${bytesToHex(transaction.hash() as Uint8Array)}`;
  const expectedSigningHash = String(
    body.signingHash || body.hash || '',
  ).trim();

  if (
    clientSignatureHex &&
    expectedSigningHash &&
    expectedSigningHash.toLowerCase() !== signingHash.toLowerCase()
  ) {
    throw makeError('Transaction changed before signing. Please try again.', 409);
  }

  if (
    sourceWallet.kind !== 'imported_privy' &&
    !clientSignatureHex &&
    body.clientSigningSupported === true
  ) {
    return c.json(
      {
        accountId,
        assetCode: assetDefinition.assetCode,
        destinationBalances: [],
        destinationXlm: '0',
        hash: signingHash,
        ledger: 0,
        network,
        operation: operationType,
        requiresClientSignature: true,
        sourceBalances: [],
        sourceWalletId,
        sourceXlm: '0',
        transaction: null,
        transactionXdr: transaction.toEnvelope().toXDR('base64'),
        transactions: [],
      },
      202,
    );
  }

  const memo = String(body.memo || '');

  stellarPaymentLog('info', 'stellar_payment.submit_requested', {
    amount,
    assetCode: assetDefinition.assetCode,
    destination: maskStellarAddress(destination),
    memo: memo || null,
    network,
    sourceAddress: maskStellarAddress(sourceAddress),
  });

  let submitted: Awaited<ReturnType<typeof submitPrivySignedTransaction>>;

  try {
    submitted = await submitPrivySignedTransaction({
      clientSignatureHex: clientSignatureHex || undefined,
      env: c.env,
      network,
      sourceAddress,
      transaction,
      wallet: sourceWallet,
      walletId: sourceWalletId,
    });
  } catch (error) {
    stellarPaymentLog('error', 'stellar_payment.submit_failed', {
      amount,
      assetCode: assetDefinition.assetCode,
      destination: maskStellarAddress(destination),
      error: error instanceof Error ? error.message : String(error),
      memo: memo || null,
      network,
      sourceAddress: maskStellarAddress(sourceAddress),
    });
    throw error;
  }

  stellarPaymentLog('info', 'stellar_payment.submitted', {
    amount,
    assetCode: assetDefinition.assetCode,
    destination: maskStellarAddress(destination),
    hash: submitted.hash,
    ledger: submitted.ledger,
    memo: memo || null,
    network,
    sourceAddress: maskStellarAddress(sourceAddress),
  });

  const [refreshedSource, refreshedDestination, transactions] = await Promise.all([
    getAccountBalances(c.env, sourceAddress, network),
    getAccountBalances(c.env, destination, network),
    getAccountHistory(c.env, sourceAddress, network),
  ]);
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
    transactions,
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

  const result = await quoteStellarSwap(c.env, {
    amount: body.amount,
    fromAssetCode: body.fromAssetCode,
    fromAssetIssuer: body.fromAssetIssuer,
    network,
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
  const sourceWallet = assertAccountWallet({
    account,
    address: sourceAddress,
    network,
    walletId: sourceWalletId,
  });
  assertStellarAddress(sourceAddress, 'Swap wallet');
  const clientSignatureHex = normalizeClientSignature(
    body.clientSignature || body.signature,
  );

  const result = await executeStellarSwap(c.env, {
    amount: body.amount,
    clientSigningSupported: body.clientSigningSupported === true,
    clientSignatureHex,
    fromAssetCode: body.fromAssetCode,
    fromAssetIssuer: body.fromAssetIssuer,
    network,
    sourceAddress,
    sourceWallet,
    sourceWalletId,
    transactionXdr: body.transactionXdr,
    toAssetCode: body.toAssetCode,
    toAssetIssuer: body.toAssetIssuer,
  });

  const expectedSigningHash = String(
    body.signingHash || body.hash || '',
  ).trim();

  if (
    clientSignatureHex &&
    expectedSigningHash &&
    result.hash &&
    expectedSigningHash.toLowerCase() !== result.hash.toLowerCase()
  ) {
    throw makeError('Transaction changed before signing. Please try again.', 409);
  }

  if (result.requiresClientSignature) {
    return c.json(
      {
        accountId,
        balances: [],
        fromAmount: result.fromAmount,
        fromAssetCode: result.fromAssetCode,
        hash: result.hash,
        ledger: 0,
        network,
        rate: result.rate,
        requiresClientSignature: true,
        sourceWalletId,
        toAmount: result.toAmount,
        toAssetCode: result.toAssetCode,
        transaction: null,
        transactionXdr: result.transactionXdr,
        transactions: [],
      },
      202,
    );
  }

  if (!result.submitted) {
    throw makeError('Swap was not submitted', 500);
  }

  const [refreshedSource, transactions] = await Promise.all([
    getAccountBalances(c.env, sourceAddress, network),
    getAccountHistory(c.env, sourceAddress, network),
  ]);
  const transactionItem = buildSubmittedTransactionItem({
    amount: result.fromAmount,
    assetCode: result.fromAssetCode,
    assetIssuer: result.fromAssetIssuer,
    direction: 'sent',
    env: c.env,
    from: sourceAddress,
    network,
    operation: 'path_payment_strict_send',
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
    requiresClientSignature: false,
    sourceWalletId,
    toAmount: result.toAmount,
    toAssetCode: result.toAssetCode,
    transaction: transactionItem,
    transactions,
  });
}

export function registerStellarRoutes(app: Hono<WorkerBindings>) {
  app.get('/api/stellar/:network/:address/history', c =>
    handleStellarHistory(c),
  );
  app.get('/api/stellar/:network/:address', c => handleStellarLookup(c));
  app.post('/api/stellar/:network/fund', c => handleFund(c));
  app.post('/api/stellar/:network/trustline', c => handleTrustline(c));
  app.post('/api/stellar/:network/send', c => handleSend(c));
  app.post('/api/stellar/:network/swap/quote', c => handleSwapQuote(c));
  app.post('/api/stellar/:network/swap/execute', c => handleSwapExecute(c));
  app.post('/api/stellar/:network/swap', c => handleSwapExecute(c));

  app.get('/api/stellar/:address/history', c =>
    handleStellarHistory(c, 'testnet'),
  );
  app.get('/api/stellar/:address', c => handleStellarLookup(c, 'testnet'));
  app.post('/api/stellar/fund', c => handleFund(c, 'testnet'));
  app.post('/api/stellar/trustline', c => handleTrustline(c, 'testnet'));
  app.post('/api/stellar/send', c => handleSend(c, 'testnet'));
  app.post('/api/stellar/swap/quote', c => handleSwapQuote(c, 'testnet'));
  app.post('/api/stellar/swap/execute', c => handleSwapExecute(c, 'testnet'));
  app.post('/api/stellar/swap', c => handleSwapExecute(c, 'testnet'));

}
