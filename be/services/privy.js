/* eslint-env node */

const { PrivyClient } = require('@privy-io/node');
const {
  PRIVY_API_URL,
  PRIVY_APP_ID,
  PRIVY_APP_SECRET,
} = require('../config');
const { parseMaybeJson } = require('../utils/json');
const { normalizeEmail } = require('../utils/validation');

let privyClient;

function requirePrivyConfig() {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    const error = new Error(
      'Missing PRIVY_APP_ID or PRIVY_APP_SECRET in .env',
    );
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

function getPrivyClient() {
  requirePrivyConfig();

  if (!privyClient) {
    privyClient = new PrivyClient({
      appId: PRIVY_APP_ID,
      appSecret: PRIVY_APP_SECRET,
    });
  }

  return privyClient;
}

async function privyRequest(apiPath, options = {}) {
  const response = await fetch(`${PRIVY_API_URL}${apiPath}`, {
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

async function findPrivyUserByEmail(email) {
  try {
    return await privyRequest('/users/email/address', {
      method: 'POST',
      body: JSON.stringify({ address: email }),
    });
  } catch (error) {
    if (error.status === 404) {
      return null;
    }

    throw error;
  }
}

async function createPrivyUser(email) {
  return privyRequest('/users', {
    method: 'POST',
    body: JSON.stringify({
      linked_accounts: [{ type: 'email', address: email }],
      custom_metadata: {
        demo: 'stellar-wallet',
      },
    }),
  });
}

async function createSignableStellarWallet(email, displayName) {
  const safeEmail = email.replace(/[^a-z0-9_-]/gi, '_').slice(0, 32);

  return privyRequest('/wallets', {
    method: 'POST',
    body: JSON.stringify({
      chain_type: 'stellar',
      display_name: displayName || `Stellar wallet for ${email}`,
      external_id: `stellar_${safeEmail}_${Date.now()}`,
    }),
  });
}

async function importStellarWallet({ displayName, keypair, network }) {
  return getPrivyClient()
    .wallets()
    .import({
      display_name: displayName,
      external_id: `stellar_import_${network}_${Date.now()}`,
      wallet: {
        address: keypair.publicKey(),
        chain_type: 'stellar',
        entropy_type: 'private-key',
        private_key: keypair.rawSecretKey(),
      },
    });
}

async function exportStellarWalletSecret(walletId, type = 'private_key') {
  const wallets = getPrivyClient().wallets();
  const result =
    type === 'seed_phrase'
      ? await wallets.exportSeedPhrase(walletId, { export_type: 'client' })
      : await wallets.exportPrivateKey(walletId, { export_type: 'client' });

  return {
    secret:
      type === 'seed_phrase' ? result?.seed_phrase : result?.private_key,
  };
}

function getEmailFromPrivyUser(user) {
  const linkedAccounts = Array.isArray(user?.linked_accounts)
    ? user.linked_accounts
    : [];
  const emailAccount =
    linkedAccounts.find(
      account => account.type === 'email' && (account.address || account.email),
    ) ||
    linkedAccounts.find(
      account =>
        typeof account.email === 'string' || typeof account.address === 'string',
    );

  return normalizeEmail(emailAccount?.address || emailAccount?.email);
}

function getPrivyErrorMessage(body, status) {
  if (body && typeof body === 'object') {
    return body.message || body.error || `Privy returned error ${status}`;
  }

  return typeof body === 'string' && body.trim()
    ? body
    : `Privy returned error ${status}`;
}

function normalizeWallet(wallet, overrides = {}) {
  return {
    id: wallet.id,
    address: wallet.address,
    canSign: overrides.canSign !== undefined ? overrides.canSign : true,
    publicKey: wallet.public_key || wallet.address,
    chainType: wallet.chain_type,
    displayName: wallet.display_name,
    kind: overrides.kind || 'privy',
    network: overrides.network || 'testnet',
  };
}

module.exports = {
  createPrivyUser,
  createSignableStellarWallet,
  exportStellarWalletSecret,
  findPrivyUserByEmail,
  getEmailFromPrivyUser,
  getPrivyClient,
  importStellarWallet,
  normalizeWallet,
  privyRequest,
};
