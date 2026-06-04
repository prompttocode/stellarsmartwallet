/* eslint-env node */

const {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  NotFoundError,
  Operation,
  TransactionBuilder,
} = require('@stellar/stellar-sdk');
const { saveIssuer } = require('../db');
const {
  DEMO_ASSET_CODES,
  getDemoIssuer,
  getIssuerKey,
  getKnownAssetDefinitions,
  mergeKnownAndDiscoveredAssets,
  NATIVE_ASSET_CODE,
  normalizeAssetCode,
} = require('./assets');
const {
  getExplorerUrl,
  getNetworkConfig,
  normalizeNetwork,
} = require('./networks');
const { getPrivyClient } = require('./privy');

const DEMO_SWAP_RATES = {
  'USDC:XLM': 8.2,
  'USDC:USDT': 0.99,
  'USDT:USDC': 1.01,
  'USDT:XLM': 8.1,
  'XLM:USDC': 0.12,
  'XLM:USDT': 0.12,
};
const servers = new Map();

function getStellarServer(network = 'testnet') {
  const config = getNetworkConfig(network);

  if (!servers.has(config.network)) {
    servers.set(config.network, new Horizon.Server(config.horizonUrl));
  }

  return servers.get(config.network);
}

function assertStellarAddress(address, field = 'Địa chỉ ví') {
  try {
    Keypair.fromPublicKey(address);
  } catch {
    const error = new Error(`${field} không phải địa chỉ Stellar hợp lệ`);
    error.status = 400;
    throw error;
  }
}

function assertSecretKey(secret, field = 'Secret key') {
  try {
    return Keypair.fromSecret(String(secret || '').trim());
  } catch {
    const error = new Error(`${field} không hợp lệ`);
    error.status = 400;
    throw error;
  }
}

function assertAmount(amount, label = 'Số lượng') {
  const value = String(amount || '').trim();

  if (!/^\d+(\.\d{1,7})?$/.test(value) || Number(value) <= 0) {
    const error = new Error(`${label} phải lớn hơn 0 và tối đa 7 số lẻ`);
    error.status = 400;
    throw error;
  }

  return value;
}

function formatStellarAmount(amount) {
  const floored = Math.floor(amount * 10000000) / 10000000;

  if (!Number.isFinite(floored) || floored <= 0) {
    const error = new Error('Số token nhận sau swap phải lớn hơn 0');
    error.status = 400;
    throw error;
  }

  return floored.toFixed(7).replace(/\.?0+$/, '');
}

function isNativeAsset(assetCode) {
  return normalizeAssetCode(assetCode) === NATIVE_ASSET_CODE;
}

function assertSupportedAssetCode(assetCode, network = 'testnet') {
  const normalized = normalizeAssetCode(assetCode);
  const supported = getKnownAssetDefinitions(network).some(
    asset => asset.assetCode === normalized,
  );

  if (!supported) {
    const error = new Error('Token chưa được hỗ trợ');
    error.status = 400;
    throw error;
  }

  return normalized;
}

function getDemoSwapRate(fromAssetCode, toAssetCode) {
  const from = assertSupportedAssetCode(fromAssetCode, 'testnet');
  const to = assertSupportedAssetCode(toAssetCode, 'testnet');

  if (from === to) {
    const error = new Error('Chọn 2 token khác nhau để swap');
    error.status = 400;
    throw error;
  }

  return DEMO_SWAP_RATES[`${from}:${to}`] || 1;
}

async function loadAccount(address, network = 'testnet') {
  try {
    return await getStellarServer(network).loadAccount(address);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return null;
    }

    throw error;
  }
}

function getNativeBalance(account) {
  if (!account) {
    return '0';
  }

  return (
    account.balances.find(balance => balance.asset_type === 'native')
      ?.balance || '0'
  );
}

function findIssuedBalance(account, assetCode, issuerAddress) {
  if (!account || !issuerAddress) {
    return null;
  }

  return (
    account.balances.find(
      balance =>
        balance.asset_code === assetCode &&
        balance.asset_issuer === issuerAddress,
    ) || null
  );
}

function getBalanceItems(account, assetDefinitions) {
  return assetDefinitions.map(asset => {
    if (asset.isNative) {
      return {
        ...asset,
        balance: getNativeBalance(account),
        exists: Boolean(account),
        trusted: Boolean(account),
      };
    }

    const balance = findIssuedBalance(
      account,
      asset.assetCode,
      asset.assetIssuer,
    );

    return {
      ...asset,
      balance: balance?.balance || '0',
      exists: Boolean(account),
      limit: balance?.limit || '0',
      trusted: Boolean(balance),
    };
  });
}

function ensureTrustline(account, assetDefinition, field = 'Ví nhận') {
  if (assetDefinition.isNative) {
    return;
  }

  if (
    !findIssuedBalance(
      account,
      assetDefinition.assetCode,
      assetDefinition.assetIssuer,
    )
  ) {
    const error = new Error(
      `${field} chưa thêm token ${assetDefinition.assetCode}. Hãy add trustline trước.`,
    );
    error.status = 400;
    throw error;
  }
}

function getIssuedAsset(assetCodeOrDefinition, issuerAddress) {
  const assetDefinition =
    typeof assetCodeOrDefinition === 'object'
      ? assetCodeOrDefinition
      : {
          assetCode: normalizeAssetCode(assetCodeOrDefinition),
          assetIssuer: issuerAddress,
        };

  if (!assetDefinition.assetIssuer) {
    const error = new Error('Token issued thiếu issuer');
    error.status = 400;
    throw error;
  }

  return new Asset(assetDefinition.assetCode, assetDefinition.assetIssuer);
}

function getAssetForOperation(assetDefinition) {
  return assetDefinition.isNative
    ? Asset.native()
    : getIssuedAsset(assetDefinition);
}

function buildPaymentTransaction({
  amount,
  asset,
  destination,
  destinationAccount,
  network = 'testnet',
  sourceAccount,
}) {
  const config = getNetworkConfig(network);
  const operation =
    !asset || asset.isNative()
      ? destinationAccount
        ? Operation.payment({
            destination,
            asset: Asset.native(),
            amount,
          })
        : Operation.createAccount({
            destination,
            startingBalance: amount,
          })
      : Operation.payment({
          destination,
          asset,
          amount,
        });

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(operation)
    .setTimeout(60)
    .build();

  return {
    operationType:
      !asset || asset.isNative()
        ? destinationAccount
          ? 'payment'
          : 'create_account'
        : 'payment',
    transaction,
  };
}

function buildTrustlineTransaction({
  asset,
  network = 'testnet',
  sourceAccount,
}) {
  const config = getNetworkConfig(network);

  return new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(60)
    .build();
}

async function signStellarTransaction(walletId, transaction) {
  const hashHex = `0x${transaction.hash().toString('hex')}`;
  const result = await getPrivyClient()
    .wallets()
    .rawSign(walletId, {
      params: {
        hash: hashHex,
      },
    });

  const signature = result?.signature;

  if (!signature || typeof signature !== 'string') {
    const error = new Error('Privy không trả về chữ ký giao dịch Stellar');
    error.status = 502;
    error.details = result;
    throw error;
  }

  return signature.replace(/^0x/, '');
}

function addPrivySignature(transaction, sourceAddress, signatureHex) {
  transaction.addSignature(
    sourceAddress,
    Buffer.from(signatureHex, 'hex').toString('base64'),
  );
}

async function submitPrivySignedTransaction({
  network = 'testnet',
  sourceAddress,
  transaction,
  walletId,
}) {
  const signatureHex = await signStellarTransaction(walletId, transaction);
  addPrivySignature(transaction, sourceAddress, signatureHex);

  return getStellarServer(network).submitTransaction(transaction);
}

async function friendbotFund(address, network = 'testnet') {
  const config = getNetworkConfig(network);

  if (!config.supportsFriendbot || !config.friendbotUrl) {
    const error = new Error(
      'Mainnet không có Friendbot. Hãy deposit XLM thật để active ví.',
    );
    error.status = 400;
    throw error;
  }

  const response = await fetch(`${config.friendbotUrl}?addr=${address}`);
  const text = await response.text();

  if (!response.ok) {
    const error = new Error(text || 'Friendbot không nạp được test XLM');
    error.status = response.status;
    throw error;
  }

  return text;
}

async function ensureDemoAssetIssuer(assetCode, network = 'testnet') {
  const normalizedNetwork = normalizeNetwork(network);
  const normalized = assertSupportedAssetCode(assetCode, normalizedNetwork);

  if (normalizedNetwork !== 'testnet') {
    const error = new Error('Demo issuer chỉ dùng cho Testnet');
    error.status = 400;
    throw error;
  }

  if (isNativeAsset(normalized)) {
    return null;
  }

  const existing = await getDemoIssuer(normalized);

  if (existing?.publicKey && existing?.secret) {
    const account = await loadAccount(existing.publicKey, normalizedNetwork);

    if (account) {
      return existing;
    }
  }

  const keypair = Keypair.random();
  await friendbotFund(keypair.publicKey(), normalizedNetwork);

  const issuer = await saveIssuer(getIssuerKey(normalizedNetwork, normalized), {
    publicKey: keypair.publicKey(),
    secret: keypair.secret(),
    fundedAt: new Date().toISOString(),
  });

  await saveIssuer(normalized, issuer);

  return issuer;
}

async function ensureDemoAssetIssuers(network = 'testnet') {
  const issuers = {};

  if (normalizeNetwork(network) !== 'testnet') {
    return issuers;
  }

  for (const assetCode of DEMO_ASSET_CODES) {
    issuers[assetCode] = await ensureDemoAssetIssuer(assetCode, network);
  }

  return issuers;
}

async function getSupportedAssets(network = 'testnet') {
  const normalizedNetwork = normalizeNetwork(network);
  const issuers = await ensureDemoAssetIssuers(normalizedNetwork);

  return getKnownAssetDefinitions(normalizedNetwork, issuers);
}

async function getSupportedAsset({
  assetCode,
  assetIssuer,
  network = 'testnet',
}) {
  const normalizedNetwork = normalizeNetwork(network);
  const normalized = normalizeAssetCode(assetCode);
  const assets = await getSupportedAssets(normalizedNetwork);
  const asset = assets.find(
    item =>
      item.assetCode === normalized &&
      (!assetIssuer || item.assetIssuer === assetIssuer),
  );

  if (asset) {
    return asset;
  }

  if (normalizedNetwork === 'mainnet' && normalized !== NATIVE_ASSET_CODE) {
    assertStellarAddress(assetIssuer, 'Issuer');

    return {
      assetCode: normalized,
      assetIssuer,
      demo: false,
      displayName: normalized,
      homeDomain: assetIssuer,
      iconKey: normalized.toLowerCase(),
      isNative: false,
      network: normalizedNetwork,
      trustLevel: 'unverified',
    };
  }

  const error = new Error('Token chưa được hỗ trợ');
  error.status = 400;
  throw error;
}

async function getAccountBalances(address, network = 'testnet') {
  const normalizedNetwork = normalizeNetwork(network);
  const account = await loadAccount(address, normalizedNetwork);
  const assets = mergeKnownAndDiscoveredAssets(
    await getSupportedAssets(normalizedNetwork),
    account,
    normalizedNetwork,
  );

  return {
    address,
    balances: getBalanceItems(account, assets),
    exists: Boolean(account),
    network: normalizedNetwork,
    xlm: getNativeBalance(account),
  };
}

async function fundDemoAsset({
  amount,
  assetCode,
  destination,
  network = 'testnet',
}) {
  const normalizedNetwork = normalizeNetwork(network);
  const normalized = assertSupportedAssetCode(assetCode, normalizedNetwork);
  const value = assertAmount(amount);
  const assetDefinition = await getSupportedAsset({
    assetCode: normalized,
    network: normalizedNetwork,
  });

  if (normalizedNetwork !== 'testnet') {
    const error = new Error('Mainnet không hỗ trợ nạp token demo');
    error.status = 400;
    throw error;
  }

  if (assetDefinition.isNative) {
    const error = new Error('XLM test dùng endpoint nạp XLM riêng');
    error.status = 400;
    throw error;
  }

  const destinationAccount = await loadAccount(destination, normalizedNetwork);

  if (!destinationAccount) {
    const error = new Error('Ví nhận chưa có trên Stellar Testnet');
    error.status = 400;
    throw error;
  }

  ensureTrustline(destinationAccount, assetDefinition, 'Ví nhận');

  const issuer = await ensureDemoAssetIssuer(normalized, normalizedNetwork);
  const issuerAccount = await loadAccount(issuer.publicKey, normalizedNetwork);
  const issuedAsset = getIssuedAsset(normalized, issuer.publicKey);
  const { transaction } = buildPaymentTransaction({
    amount: value,
    asset: issuedAsset,
    destination,
    destinationAccount,
    network: normalizedNetwork,
    sourceAccount: issuerAccount,
  });

  transaction.sign(Keypair.fromSecret(issuer.secret));

  return getStellarServer(normalizedNetwork).submitTransaction(transaction);
}

async function swapDemoAsset({
  amount,
  fromAssetCode,
  sourceAddress,
  sourceWalletId,
  toAssetCode,
}) {
  const fromDefinition = await getSupportedAsset({
    assetCode: fromAssetCode,
    network: 'testnet',
  });
  const toDefinition = await getSupportedAsset({
    assetCode: toAssetCode,
    network: 'testnet',
  });
  const fromAmount = assertAmount(amount);
  const rate = getDemoSwapRate(
    fromDefinition.assetCode,
    toDefinition.assetCode,
  );
  const toAmount = formatStellarAmount(Number(fromAmount) * rate);

  if (!sourceWalletId) {
    const error = new Error('Thiếu Privy wallet id của ví swap');
    error.status = 400;
    throw error;
  }

  const sourceAccount = await loadAccount(sourceAddress, 'testnet');

  if (!sourceAccount) {
    const error = new Error(
      'Ví chưa có trên Stellar Testnet. Hãy nạp test XLM trước.',
    );
    error.status = 400;
    throw error;
  }

  ensureTrustline(sourceAccount, fromDefinition, 'Ví gửi');
  ensureTrustline(sourceAccount, toDefinition, 'Ví nhận');

  const payoutIssuer = toDefinition.isNative
    ? await ensureDemoAssetIssuer(
        fromDefinition.isNative ? DEMO_ASSET_CODES[0] : fromDefinition.assetCode,
      )
    : await ensureDemoAssetIssuer(toDefinition.assetCode);
  const collectorAddress = fromDefinition.isNative
    ? payoutIssuer.publicKey
    : fromDefinition.assetIssuer;
  const fromAsset = getAssetForOperation(fromDefinition);
  const toAsset = getAssetForOperation(toDefinition);
  const config = getNetworkConfig('testnet');
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(
      Operation.payment({
        destination: collectorAddress,
        asset: fromAsset,
        amount: fromAmount,
      }),
    )
    .addOperation(
      Operation.payment({
        source: payoutIssuer.publicKey,
        destination: sourceAddress,
        asset: toAsset,
        amount: toAmount,
      }),
    )
    .setTimeout(60)
    .build();

  transaction.sign(Keypair.fromSecret(payoutIssuer.secret));

  const submitted = await submitPrivySignedTransaction({
    sourceAddress,
    transaction,
    walletId: sourceWalletId,
  });

  return {
    fromAmount,
    fromAssetCode: fromDefinition.assetCode,
    fromAssetIssuer: fromDefinition.assetIssuer,
    payoutAddress: payoutIssuer.publicKey,
    rate,
    submitted,
    toAmount,
    toAssetCode: toDefinition.assetCode,
    toAssetIssuer: toDefinition.assetIssuer,
  };
}

async function quoteDemoSwap({ amount, fromAssetCode, toAssetCode }) {
  const fromDefinition = await getSupportedAsset({
    assetCode: fromAssetCode,
    network: 'testnet',
  });
  const toDefinition = await getSupportedAsset({
    assetCode: toAssetCode,
    network: 'testnet',
  });
  const fromAmount = assertAmount(amount);
  const rate = getDemoSwapRate(
    fromDefinition.assetCode,
    toDefinition.assetCode,
  );

  return {
    destMin: formatStellarAmount(Number(fromAmount) * rate),
    fromAmount,
    fromAssetCode: fromDefinition.assetCode,
    fromAssetIssuer: fromDefinition.assetIssuer,
    rate,
    simulated: true,
    toAmount: formatStellarAmount(Number(fromAmount) * rate),
    toAssetCode: toDefinition.assetCode,
    toAssetIssuer: toDefinition.assetIssuer,
  };
}

function parsePathAsset(assetRecord) {
  if (assetRecord.asset_type === 'native') {
    return Asset.native();
  }

  return new Asset(assetRecord.asset_code, assetRecord.asset_issuer);
}

async function quoteMainnetSwap({
  amount,
  fromAssetCode,
  fromAssetIssuer,
  sourceAddress,
  toAssetCode,
  toAssetIssuer,
}) {
  const network = 'mainnet';
  const sendAmount = assertAmount(amount);
  const sourceAccount = await loadAccount(sourceAddress, network);

  if (!sourceAccount) {
    const error = new Error(
      'Ví mainnet chưa active. Hãy deposit XLM thật trước khi swap.',
    );
    error.status = 400;
    throw error;
  }

  const fromDefinition = await getSupportedAsset({
    assetCode: fromAssetCode,
    assetIssuer: fromAssetIssuer,
    network,
  });
  const toDefinition = await getSupportedAsset({
    assetCode: toAssetCode,
    assetIssuer: toAssetIssuer,
    network,
  });

  if (fromDefinition.assetCode === toDefinition.assetCode) {
    const error = new Error('Chọn 2 token khác nhau để swap');
    error.status = 400;
    throw error;
  }

  ensureTrustline(sourceAccount, fromDefinition, 'Ví gửi');
  ensureTrustline(sourceAccount, toDefinition, 'Ví nhận');

  const records = await getStellarServer(network)
    .strictSendPaths(
      getAssetForOperation(fromDefinition),
      sendAmount,
      [getAssetForOperation(toDefinition)],
    )
    .call();
  const bestPath = records?.records?.[0];

  if (!bestPath) {
    const error = new Error('Không tìm thấy path swap trên Stellar DEX');
    error.status = 400;
    throw error;
  }

  const destinationAmount = bestPath.destination_amount;
  const destMin = formatStellarAmount(Number(destinationAmount) * 0.995);

  return {
    destMin,
    fromAmount: sendAmount,
    fromAssetCode: fromDefinition.assetCode,
    fromAssetIssuer: fromDefinition.assetIssuer,
    path: bestPath.path || [],
    rate: Number(destinationAmount) / Number(sendAmount),
    toAmount: destinationAmount,
    toAssetCode: toDefinition.assetCode,
    toAssetIssuer: toDefinition.assetIssuer,
  };
}

async function executeMainnetSwap({
  amount,
  fromAssetCode,
  fromAssetIssuer,
  sourceAddress,
  sourceWalletId,
  toAssetCode,
  toAssetIssuer,
}) {
  if (!sourceWalletId) {
    const error = new Error('Thiếu Privy wallet id của ví swap');
    error.status = 400;
    throw error;
  }

  const network = 'mainnet';
  const quote = await quoteMainnetSwap({
    amount,
    fromAssetCode,
    fromAssetIssuer,
    sourceAddress,
    toAssetCode,
    toAssetIssuer,
  });
  const sourceAccount = await loadAccount(sourceAddress, network);
  const fromDefinition = await getSupportedAsset({
    assetCode: fromAssetCode,
    assetIssuer: fromAssetIssuer,
    network,
  });
  const toDefinition = await getSupportedAsset({
    assetCode: toAssetCode,
    assetIssuer: toAssetIssuer,
    network,
  });
  const config = getNetworkConfig(network);
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(
      Operation.pathPaymentStrictSend({
        destination: sourceAddress,
        destAsset: getAssetForOperation(toDefinition),
        destMin: quote.destMin,
        path: quote.path.map(parsePathAsset),
        sendAmount: quote.fromAmount,
        sendAsset: getAssetForOperation(fromDefinition),
      }),
    )
    .setTimeout(60)
    .build();
  const submitted = await submitPrivySignedTransaction({
    network,
    sourceAddress,
    transaction,
    walletId: sourceWalletId,
  });

  return {
    ...quote,
    payoutAddress: sourceAddress,
    submitted,
  };
}

function parseStellarXdr(xdr, network = 'testnet') {
  const config = getNetworkConfig(network);

  try {
    return TransactionBuilder.fromXDR(String(xdr || '').trim(), config.passphrase);
  } catch {
    const error = new Error('XDR Stellar không hợp lệ hoặc sai network passphrase');
    error.status = 400;
    throw error;
  }
}

function summarizeOperation(operation) {
  return {
    amount: operation.amount || operation.startingBalance || null,
    assetCode:
      operation.asset?.code ||
      operation.sendAsset?.code ||
      operation.destAsset?.code ||
      NATIVE_ASSET_CODE,
    destination:
      operation.destination ||
      operation.destAsset?.issuer ||
      operation.asset?.issuer ||
      null,
    type: operation.type,
  };
}

function reviewStellarXdr({ network = 'testnet', sourceAddress, xdr }) {
  const transaction = parseStellarXdr(xdr, network);

  if (sourceAddress && transaction.source !== sourceAddress) {
    const error = new Error('XDR không dùng đúng source ví đang chọn');
    error.status = 403;
    throw error;
  }

  return {
    fee: transaction.fee,
    memo: transaction.memo?.value || null,
    network: normalizeNetwork(network),
    operationCount: transaction.operations?.length || 0,
    operations: (transaction.operations || []).map(summarizeOperation),
    sequence: transaction.sequence,
    source: transaction.source,
  };
}

async function signStellarXdr({
  network = 'testnet',
  sourceAddress,
  submit = false,
  walletId,
  xdr,
}) {
  const transaction = parseStellarXdr(xdr, network);
  const review = reviewStellarXdr({ network, sourceAddress, xdr });
  const signatureHex = await signStellarTransaction(walletId, transaction);
  addPrivySignature(transaction, sourceAddress, signatureHex);

  if (!submit) {
    return {
      review,
      signedXdr: transaction.toEnvelope().toXDR('base64'),
      submitted: null,
    };
  }

  const submitted = await getStellarServer(network).submitTransaction(transaction);

  return {
    review,
    signedXdr: transaction.toEnvelope().toXDR('base64'),
    submitted,
  };
}

async function fetchAccountOperations(address, network = 'testnet', limit = 30) {
  const config = getNetworkConfig(network);
  const response = await fetch(
    `${config.horizonUrl}/accounts/${address}/operations?order=desc&limit=${limit}&join=transactions`,
  );

  if (response.status === 404) {
    return [];
  }

  const body = await response.json();

  if (!response.ok) {
    const error = new Error(body?.detail || 'Không lấy được lịch sử Stellar');
    error.status = response.status;
    error.details = body;
    throw error;
  }

  return body?._embedded?.records || [];
}

function normalizeOperationRecord(address, operation, network = 'testnet') {
  const hash = operation.transaction_hash;

  if (!hash) {
    return null;
  }

  const isPayment = operation.type === 'payment';
  const isCreateAccount = operation.type === 'create_account';
  const isChangeTrust = operation.type === 'change_trust';
  const isPathPayment = operation.type?.startsWith('path_payment');

  if (!isPayment && !isCreateAccount && !isChangeTrust && !isPathPayment) {
    return null;
  }

  const assetCode = isCreateAccount
    ? NATIVE_ASSET_CODE
    : operation.asset_type === 'native' ||
      operation.source_asset_type === 'native'
    ? NATIVE_ASSET_CODE
    : operation.asset_code ||
      operation.source_asset_code ||
      operation.destination_asset_code ||
      NATIVE_ASSET_CODE;
  const amount = isCreateAccount
    ? operation.starting_balance || '0'
    : isChangeTrust
    ? '0'
    : operation.amount ||
      operation.source_amount ||
      operation.destination_amount ||
      '0';
  const from =
    operation.from ||
    operation.funder ||
    operation.source_account ||
    operation.trustor ||
    '';
  const to =
    operation.to ||
    operation.account ||
    operation.destination ||
    operation.trustee ||
    '';
  const direction = isChangeTrust
    ? 'trustline'
    : to === address || operation.account === address
    ? 'received'
    : from === address || operation.funder === address
    ? 'sent'
    : 'other';

  return {
    id: operation.id,
    amount,
    assetCode,
    assetIssuer:
      assetCode === NATIVE_ASSET_CODE
        ? null
        : operation.asset_issuer ||
          operation.source_asset_issuer ||
          operation.destination_asset_issuer ||
          null,
    createdAt: operation.created_at,
    direction,
    explorerUrl: getExplorerUrl(network, 'tx', hash),
    from,
    hash,
    ledger: Number(operation.transaction_attr?.ledger || operation.ledger || 0),
    network,
    operation: isPathPayment ? 'path_payment_strict_send' : operation.type,
    to,
  };
}

async function getAccountHistory(address, network = 'testnet', limit = 30) {
  const records = await fetchAccountOperations(address, network, limit);

  return records
    .map(operation => normalizeOperationRecord(address, operation, network))
    .filter(Boolean);
}

function getHorizonErrorMessage(error, network = 'testnet') {
  const resultCodes = error?.response?.data?.extras?.result_codes;
  const config = getNetworkConfig(network);

  if (resultCodes) {
    return `${config.label} từ chối giao dịch: ${JSON.stringify(resultCodes)}`;
  }

  return error.message || `${config.label} trả lỗi không rõ`;
}

module.exports = {
  assertAmount,
  assertSecretKey,
  assertStellarAddress,
  assertSupportedAssetCode,
  buildPaymentTransaction,
  buildTrustlineTransaction,
  DEMO_ASSET_CODES,
  ensureDemoAssetIssuer,
  ensureDemoAssetIssuers,
  ensureTrustline,
  executeMainnetSwap,
  friendbotFund,
  fundDemoAsset,
  getAccountBalances,
  getAccountHistory,
  getAssetForOperation,
  getHorizonErrorMessage,
  getIssuedAsset,
  getNativeBalance,
  getStellarServer,
  getSupportedAsset,
  getSupportedAssets,
  isNativeAsset,
  loadAccount,
  normalizeAssetCode,
  quoteDemoSwap,
  quoteMainnetSwap,
  reviewStellarXdr,
  signStellarXdr,
  submitPrivySignedTransaction,
  swapDemoAsset,
};
