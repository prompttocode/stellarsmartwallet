/* eslint-env node */
require('dotenv').config();

const cors = require('cors');
const express = require('express');
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

const app = express();

const PORT = Number(process.env.PORT || 8787);
const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const PRIVY_API_URL = 'https://api.privy.io/v1';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const FRIENDBOT_URL = 'https://friendbot.stellar.org';

const stellar = new Horizon.Server(HORIZON_URL);

app.use(cors());
app.use(express.json());

function requirePrivyConfig() {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    const error = new Error('Thiếu PRIVY_APP_ID hoặc PRIVY_APP_SECRET trong .env');
    error.status = 500;
    throw error;
  }
}

function privyHeaders() {
  requirePrivyConfig();

  const token = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString(
    'base64',
  );

  return {
    Authorization: `Basic ${token}`,
    'Content-Type': 'application/json',
    'privy-app-id': PRIVY_APP_ID,
  };
}

async function privyRequest(path, options = {}) {
  const response = await fetch(`${PRIVY_API_URL}${path}`, {
    ...options,
    headers: {
      ...privyHeaders(),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? parseMaybeJson(text) : null;

  if (!response.ok) {
    const error = new Error(getPrivyErrorMessage(body, response.status));
    error.status = response.status;
    error.details = body;
    throw error;
  }

  return body;
}

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getPrivyErrorMessage(body, status) {
  if (body && typeof body === 'object') {
    return body.message || body.error || `Privy trả lỗi ${status}`;
  }

  return typeof body === 'string' && body.trim()
    ? body
    : `Privy trả lỗi ${status}`;
}

function normalizeWallet(wallet) {
  return {
    id: wallet.id,
    address: wallet.address,
    publicKey: wallet.public_key || wallet.address,
    chainType: wallet.chain_type,
    displayName: wallet.display_name,
  };
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

function assertAmount(amount) {
  const value = String(amount || '').trim();

  if (!/^\d+(\.\d{1,7})?$/.test(value) || Number(value) <= 0) {
    const error = new Error('Số XLM phải lớn hơn 0 và tối đa 7 số lẻ');
    error.status = 400;
    throw error;
  }

  return value;
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

async function signStellarTransaction(walletId, transaction) {
  const hashHex = `0x${transaction.hash().toString('hex')}`;
  const result = await privyRequest(`/wallets/${walletId}/rpc`, {
    method: 'POST',
    body: JSON.stringify({
      method: 'raw_sign',
      params: {
        hash: hashHex,
      },
    }),
  });

  const signature =
    result?.data?.signature || result?.signature || result?.result?.signature;

  if (!signature || typeof signature !== 'string') {
    const error = new Error('Privy không trả về chữ ký giao dịch Stellar');
    error.status = 502;
    error.details = result;
    throw error;
  }

  return signature.replace(/^0x/, '');
}

function getHorizonErrorMessage(error) {
  const resultCodes = error?.response?.data?.extras?.result_codes;

  if (resultCodes) {
    return `Stellar Testnet từ chối giao dịch: ${JSON.stringify(resultCodes)}`;
  }

  return error.message || 'Stellar Testnet trả lỗi không rõ';
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    privyAppId: PRIVY_APP_ID || null,
    network: 'Stellar Testnet',
    horizonUrl: HORIZON_URL,
  });
});

app.get('/api/wallets', async (req, res, next) => {
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

app.post('/api/wallets', async (req, res, next) => {
  try {
    const role = String(req.body?.role || 'sender').replace(/[^a-z0-9_-]/gi, '');
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

app.get('/api/stellar/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    assertStellarAddress(address);

    const account = await loadAccount(address);

    res.json({
      address,
      exists: Boolean(account),
      xlm: getNativeBalance(account),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/stellar/fund', async (req, res, next) => {
  try {
    const address = String(req.body?.address || '').trim();
    assertStellarAddress(address);

    const response = await fetch(`${FRIENDBOT_URL}?addr=${address}`);
    const text = await response.text();
    const body = text ? parseMaybeJson(text) : null;

    if (!response.ok) {
      const error = new Error(
        typeof body === 'string'
          ? body
          : body?.detail || 'Friendbot không nạp được test XLM',
      );
      error.status = response.status;
      error.details = body;
      throw error;
    }

    const account = await loadAccount(address);

    res.json({
      address,
      xlm: getNativeBalance(account),
      friendbot: body,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/stellar/send', async (req, res, next) => {
  try {
    const sourceWalletId = String(req.body?.sourceWalletId || '').trim();
    const sourceAddress = String(req.body?.sourceAddress || '').trim();
    const destination = String(req.body?.destination || '').trim();
    const amount = assertAmount(req.body?.amount);

    if (!sourceWalletId) {
      const error = new Error('Thiếu Privy wallet id của ví gửi');
      error.status = 400;
      throw error;
    }

    assertStellarAddress(sourceAddress, 'Ví gửi');
    assertStellarAddress(destination, 'Ví nhận');

    const sourceAccount = await loadAccount(sourceAddress);

    if (!sourceAccount) {
      const error = new Error('Ví gửi chưa có trên Stellar Testnet. Hãy nạp test XLM trước.');
      error.status = 400;
      throw error;
    }

    const destinationAccount = await loadAccount(destination);
    const operation = destinationAccount
      ? Operation.payment({
          destination,
          asset: Asset.native(),
          amount,
        })
      : Operation.createAccount({
          destination,
          startingBalance: amount,
        });

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(60)
      .build();

    const signatureHex = await signStellarTransaction(
      sourceWalletId,
      transaction,
    );

    transaction.addSignature(
      sourceAddress,
      Buffer.from(signatureHex, 'hex').toString('base64'),
    );

    const submitted = await stellar.submitTransaction(transaction);
    const refreshedSource = await loadAccount(sourceAddress);
    const refreshedDestination = await loadAccount(destination);

    res.json({
      hash: submitted.hash,
      ledger: submitted.ledger,
      sourceXlm: getNativeBalance(refreshedSource),
      destinationXlm: getNativeBalance(refreshedDestination),
      operation: destinationAccount ? 'payment' : 'create_account',
    });
  } catch (error) {
    if (error?.response?.data?.extras?.result_codes) {
      error.message = getHorizonErrorMessage(error);
      error.status = 400;
    }

    next(error);
  }
});

app.use((error, req, res, _next) => {
  const status = error.status || 500;

  res.status(status).json({
    error: error.message || 'Có lỗi không rõ',
    details: error.details || error.response?.data || null,
  });
});

app.listen(PORT, () => {
  console.log(`Privy Stellar demo server: http://localhost:${PORT}`);
});
