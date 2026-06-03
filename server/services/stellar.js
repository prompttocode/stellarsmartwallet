/* eslint-env node */

const {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  NotFoundError,
  Operation,
  TransactionBuilder,
} = require('@stellar/stellar-sdk');
const { FRIENDBOT_URL, HORIZON_URL } = require('../config');
const { getIssuer, saveIssuer } = require('../db');
const { getPrivyClient } = require('./privy');

const stellar = new Horizon.Server(HORIZON_URL);
const NATIVE_ASSET_CODE = 'XLM';
const DEMO_ASSET_CODES = ['USDC', 'USDT'];
const DEMO_SWAP_RATES = {
  'USDC:XLM': 8.2,
  'USDC:USDT': 0.99,
  'USDT:USDC': 1.01,
  'USDT:XLM': 8.1,
  'XLM:USDC': 0.12,
  'XLM:USDT': 0.12,
};

function assertStellarAddress(address, field = 'Địa chỉ ví') {
  try {
    Keypair.fromPublicKey(address);
  } catch {
    const error = new Error(`${field} không phải địa chỉ Stellar hợp lệ`);
    error.status = 400;
    throw error;
  }
}

function assertAmount(amount) {
  const value = String(amount || '').trim();

  if (!/^\d+(\.\d{1,7})?$/.test(value) || Number(value) <= 0) {
    const error = new Error('Số XLM phải lớn hơn 0 và tối đa 7 số lẻ');
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

function normalizeAssetCode(assetCode) {
  return String(assetCode || NATIVE_ASSET_CODE)
    .trim()
    .toUpperCase();
}

function assertSupportedAssetCode(assetCode) {
  const normalized = normalizeAssetCode(assetCode);

  if (
    normalized !== NATIVE_ASSET_CODE &&
    !DEMO_ASSET_CODES.includes(normalized)
  ) {
    const error = new Error('Token chưa được hỗ trợ trong demo');
    error.status = 400;
    throw error;
  }

  return normalized;
}

function isNativeAsset(assetCode) {
  return normalizeAssetCode(assetCode) === NATIVE_ASSET_CODE;
}

function getDemoSwapRate(fromAssetCode, toAssetCode) {
  const from = assertSupportedAssetCode(fromAssetCode);
  const to = assertSupportedAssetCode(toAssetCode);

  if (from === to) {
    const error = new Error('Chọn 2 token khác nhau để swap');
    error.status = 400;
    throw error;
  }

  return DEMO_SWAP_RATES[`${from}:${to}`] || 1;
}

async function loadAccount(address) {
  try {
    return await stellar.loadAccount(address);
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

function getSupportedAssetDefinitions(issuers = {}) {
  return [
    {
      assetCode: NATIVE_ASSET_CODE,
      assetIssuer: null,
      displayName: 'XLM',
      demo: false,
      isNative: true,
    },
    ...DEMO_ASSET_CODES.map(assetCode => ({
      assetCode,
      assetIssuer: issuers[assetCode]?.publicKey || null,
      displayName: `${assetCode} demo`,
      demo: true,
      isNative: false,
    })),
  ];
}

function getIssuedAsset(assetCode, issuerAddress) {
  return new Asset(assertSupportedAssetCode(assetCode), issuerAddress);
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

function buildPaymentTransaction({
  amount,
  asset,
  destination,
  destinationAccount,
  sourceAccount,
}) {
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
    networkPassphrase: Networks.TESTNET,
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

function buildTrustlineTransaction({ asset, sourceAccount }) {
  return new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
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
  sourceAddress,
  transaction,
  walletId,
}) {
  const signatureHex = await signStellarTransaction(walletId, transaction);
  addPrivySignature(transaction, sourceAddress, signatureHex);

  return stellar.submitTransaction(transaction);
}

async function friendbotFund(address) {
  const response = await fetch(`${FRIENDBOT_URL}?addr=${address}`);
  const text = await response.text();

  if (!response.ok) {
    const error = new Error(text || 'Friendbot không nạp được test XLM');
    error.status = response.status;
    throw error;
  }

  return text;
}

async function ensureDemoAssetIssuer(assetCode) {
  const normalized = assertSupportedAssetCode(assetCode);

  if (isNativeAsset(normalized)) {
    return null;
  }

  const existing = getIssuer(normalized);

  if (existing?.publicKey && existing?.secret) {
    const account = await loadAccount(existing.publicKey);

    if (account) {
      return existing;
    }
  }

  const keypair = Keypair.random();
  await friendbotFund(keypair.publicKey());

  return saveIssuer(normalized, {
    publicKey: keypair.publicKey(),
    secret: keypair.secret(),
    fundedAt: new Date().toISOString(),
  });
}

async function ensureDemoAssetIssuers() {
  const issuers = {};

  for (const assetCode of DEMO_ASSET_CODES) {
    issuers[assetCode] = await ensureDemoAssetIssuer(assetCode);
  }

  return issuers;
}

async function getSupportedAssets() {
  const issuers = await ensureDemoAssetIssuers();

  return getSupportedAssetDefinitions(issuers);
}

async function getSupportedAsset(assetCode) {
  const normalized = assertSupportedAssetCode(assetCode);
  const assets = await getSupportedAssets();
  const asset = assets.find(item => item.assetCode === normalized);

  if (!asset) {
    const error = new Error('Token chưa được hỗ trợ trong demo');
    error.status = 400;
    throw error;
  }

  return asset;
}

async function getAccountBalances(address) {
  const account = await loadAccount(address);
  const assets = await getSupportedAssets();

  return {
    address,
    balances: getBalanceItems(account, assets),
    exists: Boolean(account),
    xlm: getNativeBalance(account),
  };
}

async function fundDemoAsset({ amount, assetCode, destination }) {
  const normalized = assertSupportedAssetCode(assetCode);
  const value = assertAmount(amount);
  const assetDefinition = await getSupportedAsset(normalized);

  if (assetDefinition.isNative) {
    const error = new Error('XLM test dùng endpoint nạp XLM riêng');
    error.status = 400;
    throw error;
  }

  const destinationAccount = await loadAccount(destination);

  if (!destinationAccount) {
    const error = new Error('Ví nhận chưa có trên Stellar Testnet');
    error.status = 400;
    throw error;
  }

  ensureTrustline(destinationAccount, assetDefinition, 'Ví nhận');

  const issuer = await ensureDemoAssetIssuer(normalized);
  const issuerAccount = await loadAccount(issuer.publicKey);
  const issuedAsset = getIssuedAsset(normalized, issuer.publicKey);
  const { transaction } = buildPaymentTransaction({
    amount: value,
    asset: issuedAsset,
    destination,
    destinationAccount,
    sourceAccount: issuerAccount,
  });

  transaction.sign(Keypair.fromSecret(issuer.secret));

  return stellar.submitTransaction(transaction);
}

async function swapDemoAsset({
  amount,
  fromAssetCode,
  sourceAddress,
  sourceWalletId,
  toAssetCode,
}) {
  const fromDefinition = await getSupportedAsset(fromAssetCode);
  const toDefinition = await getSupportedAsset(toAssetCode);
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

  const sourceAccount = await loadAccount(sourceAddress);

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
  const fromAsset = fromDefinition.isNative
    ? Asset.native()
    : getIssuedAsset(fromDefinition.assetCode, fromDefinition.assetIssuer);
  const toAsset = toDefinition.isNative
    ? Asset.native()
    : getIssuedAsset(toDefinition.assetCode, toDefinition.assetIssuer);
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
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
    rate,
    submitted,
    toAmount,
    toAssetCode: toDefinition.assetCode,
    toAssetIssuer: toDefinition.assetIssuer,
    payoutAddress: payoutIssuer.publicKey,
  };
}

async function fetchAccountOperations(address, limit = 30) {
  const response = await fetch(
    `${HORIZON_URL}/accounts/${address}/operations?order=desc&limit=${limit}&join=transactions`,
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

function normalizeOperationRecord(address, operation) {
  const hash = operation.transaction_hash;

  if (!hash) {
    return null;
  }

  const isPayment = operation.type === 'payment';
  const isCreateAccount = operation.type === 'create_account';
  const isChangeTrust = operation.type === 'change_trust';

  if (!isPayment && !isCreateAccount && !isChangeTrust) {
    return null;
  }

  const assetCode = isCreateAccount
    ? NATIVE_ASSET_CODE
    : operation.asset_type === 'native'
    ? NATIVE_ASSET_CODE
    : operation.asset_code || NATIVE_ASSET_CODE;
  const amount = isCreateAccount
    ? operation.starting_balance || '0'
    : isChangeTrust
    ? '0'
    : operation.amount || '0';
  const from = operation.from || operation.funder || operation.trustor || '';
  const to = operation.to || operation.account || operation.trustee || '';
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
      assetCode === NATIVE_ASSET_CODE ? null : operation.asset_issuer || null,
    createdAt: operation.created_at,
    direction,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${hash}`,
    from,
    hash,
    ledger: Number(operation.transaction_attr?.ledger || operation.ledger || 0),
    operation: operation.type,
    to,
  };
}

async function getAccountHistory(address, limit = 30) {
  const records = await fetchAccountOperations(address, limit);

  return records
    .map(operation => normalizeOperationRecord(address, operation))
    .filter(Boolean);
}

function getHorizonErrorMessage(error) {
  const resultCodes = error?.response?.data?.extras?.result_codes;

  if (resultCodes) {
    return `Stellar Testnet từ chối giao dịch: ${JSON.stringify(resultCodes)}`;
  }

  return error.message || 'Stellar Testnet trả lỗi không rõ';
}

module.exports = {
  assertAmount,
  assertStellarAddress,
  assertSupportedAssetCode,
  buildPaymentTransaction,
  buildTrustlineTransaction,
  DEMO_ASSET_CODES,
  ensureDemoAssetIssuer,
  ensureDemoAssetIssuers,
  ensureTrustline,
  friendbotFund,
  fundDemoAsset,
  getAccountBalances,
  getAccountHistory,
  getHorizonErrorMessage,
  getIssuedAsset,
  getNativeBalance,
  getSupportedAsset,
  getSupportedAssets,
  isNativeAsset,
  loadAccount,
  normalizeAssetCode,
  submitPrivySignedTransaction,
  signStellarTransaction,
  swapDemoAsset,
  stellar,
};
