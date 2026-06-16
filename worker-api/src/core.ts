import { type Context } from 'hono';
import { PrivyClient } from '@privy-io/node';
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

export type Env = {
  ADMIN_BOOTSTRAP_PASSWORD?: string;
  ALLOWED_ORIGINS?: string;
  DB: D1Database;
  FRIENDBOT_URL: string;
  HORIZON_MAINNET_URL: string;
  HORIZON_TESTNET_URL: string;
  PAYMENT_API_BASE_URL: string;
  PAYMENT_CALLBACK_URL?: string;
  PAYMENT_PARTNER_APP_KEY?: string;
  PRIVY_APP_ID: string;
  PRIVY_APP_SECRET: string;
  WALLETCONNECT_PROJECT_ID?: string;
};

export type WorkerBindings = {
  Bindings: Env;
};

export type StellarNetwork = 'testnet' | 'mainnet';

export type WalletKind = 'privy' | 'watch_only' | 'imported_privy';

export type WalletRecord = {
  id: string;
  address: string;
  archived?: boolean;
  canSign: boolean;
  chainType?: string;
  displayName?: string;
  kind: WalletKind;
  network: StellarNetwork;
  publicKey: string;
};

export type AccountRecord = {
  id?: string;
  activeWalletId?: string | null;
  createdAt?: string;
  email: string;
  updatedAt?: string;
  wallet?: WalletRecord | null;
  wallets?: WalletRecord[];
};

export type KycStatus = 'not_started' | 'verified';

export type AccountKycRecord = {
  accountEmail: string;
  cccdHash?: string | null;
  cccdLast4?: string | null;
  createdAt?: string;
  dob?: string | null;
  fullName?: string | null;
  phone?: string | null;
  providerUserId: string;
  status: 'verified';
  updatedAt?: string;
};

export type KycSummary = {
  cccdLast4?: string;
  fullName?: string;
  phone?: string;
  providerUserId?: string;
  status: KycStatus;
  verifiedAt?: string;
};

export type AssetDefinition = {
  assetCode: string;
  assetIssuer: string | null;
  demo: boolean;
  displayName: string;
  homeDomain?: string | null;
  iconKey?: string;
  image?: string | null;
  isNative: boolean;
  network: StellarNetwork;
  priceUsd?: number | null;
  rating?: number | null;
  trustLevel: 'verified' | 'discovered' | 'unverified';
  volume7d?: number | null;
};

export type DemoIssuer = {
  assetCode?: string;
  fundedAt?: string;
  publicKey: string;
  secret: string;
  updatedAt?: string;
};

export const PRIVY_API_URL = 'https://api.privy.io/v1';
export const NATIVE_ASSET_CODE = 'XLM';
export const DEMO_NFT_ASSET_CODE = 'SOWNFT';
export const TESTNET_USDC_ISSUER =
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
export const MAINNET_USDC_ISSUER =
  'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const STELLAR_BASE_RESERVE_XLM = 0.5;
const TRUSTLINE_FEE_BUFFER_XLM = 0.0001;
const PAYMENT_FEE_BUFFER_XLM = 0.0001;
export const KNOWN_ASSET_CASES = new Map(
  ['AQUA', 'EURC', 'PYUSD', 'USDC', 'XLM'].map(code => [
    code.toLowerCase(),
    code,
  ]),
);

KNOWN_ASSET_CASES.set('yxlm', 'yXLM');
KNOWN_ASSET_CASES.set('yusdc', 'yUSDC');

export const MAINNET_ASSETS: AssetDefinition[] = [
  {
    assetCode: 'XLM',
    assetIssuer: null,
    demo: false,
    displayName: 'Lumens',
    homeDomain: 'stellar.org',
    iconKey: 'xlm',
    isNative: true,
    network: 'mainnet',
    trustLevel: 'verified',
  },
  {
    assetCode: 'USDC',
    assetIssuer: MAINNET_USDC_ISSUER,
    demo: false,
    displayName: 'USD Coin',
    homeDomain: 'circle.com',
    iconKey: 'usdc',
    isNative: false,
    network: 'mainnet',
    trustLevel: 'verified',
  },
  {
    assetCode: 'EURC',
    assetIssuer: 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2',
    demo: false,
    displayName: 'Euro Coin',
    homeDomain: 'circle.com',
    iconKey: 'eurc',
    isNative: false,
    network: 'mainnet',
    trustLevel: 'verified',
  },
  {
    assetCode: 'PYUSD',
    assetIssuer: 'GDQE7IXJ4HUHV6RQHIUPRJSEZE4DRS5WY577O2FY6YQ5LVWZ7JZTU2V5',
    demo: false,
    displayName: 'PayPal USD',
    homeDomain: 'paypal.com',
    iconKey: 'pyusd',
    isNative: false,
    network: 'mainnet',
    trustLevel: 'verified',
  },
  {
    assetCode: 'AQUA',
    assetIssuer: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA',
    demo: false,
    displayName: 'Aquarius',
    homeDomain: 'aqua.network',
    iconKey: 'aqua',
    isNative: false,
    network: 'mainnet',
    trustLevel: 'verified',
  },
  {
    assetCode: 'yXLM',
    assetIssuer: 'GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55',
    demo: false,
    displayName: 'Ultra Capital yXLM',
    homeDomain: 'ultracapital.xyz',
    iconKey: 'yxlm',
    isNative: false,
    network: 'mainnet',
    trustLevel: 'verified',
  },
  {
    assetCode: 'yUSDC',
    assetIssuer: 'GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF',
    demo: false,
    displayName: 'Ultra Capital yUSDC',
    homeDomain: 'ultracapital.xyz',
    iconKey: 'yusdc',
    isNative: false,
    network: 'mainnet',
    trustLevel: 'verified',
  },
];

export const stellarServers = new Map<string, Horizon.Server>();
export let cachedPrivyClientKey = '';
export let cachedPrivyClient: PrivyClient | null = null;

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function isEmailLike(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function normalizeNetwork(value: unknown, fallback: StellarNetwork = 'testnet') {
  const network = String(value || fallback).trim().toLowerCase();

  if (network === 'public' || network === 'pubnet') {
    return 'mainnet';
  }

  return network === 'mainnet' || network === 'testnet'
    ? (network as StellarNetwork)
    : fallback;
}

export function normalizeAssetCode(assetCode: unknown) {
  const value = String(assetCode || NATIVE_ASSET_CODE).trim();
  return KNOWN_ASSET_CASES.get(value.toLowerCase()) || value;
}

export function getNetworkConfig(env: Env, networkValue: unknown) {
  const network = normalizeNetwork(networkValue);

  if (network === 'mainnet') {
    return {
      explorerSlug: 'public',
      friendbotUrl: null,
      horizonUrl: env.HORIZON_MAINNET_URL,
      label: 'Stellar Mainnet',
      network,
      passphrase: Networks.PUBLIC,
      supportsFriendbot: false,
    };
  }

  return {
    explorerSlug: 'testnet',
    friendbotUrl: env.FRIENDBOT_URL,
    horizonUrl: env.HORIZON_TESTNET_URL,
    label: 'Stellar Testnet',
    network,
    passphrase: Networks.TESTNET,
    supportsFriendbot: true,
  };
}

export function listNetworks(env: Env) {
  return [
    getNetworkConfig(env, 'testnet'),
    getNetworkConfig(env, 'mainnet'),
  ].map(config => ({
    horizonUrl: config.horizonUrl,
    label: config.label,
    network: config.network,
    supportsFriendbot: config.supportsFriendbot,
  }));
}

export function getExplorerUrl(env: Env, network: StellarNetwork, type: string, id: string) {
  const config = getNetworkConfig(env, network);
  const safeType = type === 'account' ? 'account' : 'tx';

  return `https://stellar.expert/explorer/${config.explorerSlug}/${safeType}/${id}`;
}

export function getStellarServer(env: Env, networkValue: unknown) {
  const config = getNetworkConfig(env, networkValue);

  if (!stellarServers.has(config.network)) {
    stellarServers.set(config.network, new Horizon.Server(config.horizonUrl));
  }

  return stellarServers.get(config.network)!;
}

export function jsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function makeError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export function assertStellarAddress(address: unknown, field = 'Wallet address') {
  try {
    Keypair.fromPublicKey(String(address || '').trim());
  } catch {
    throw makeError(`${field} is not a valid Stellar address`, 400);
  }
}

export function assertAmount(amount: unknown, label = 'Amount') {
  const value = String(amount || '').trim();

  if (!/^\d+(\.\d{1,7})?$/.test(value) || Number(value) <= 0) {
    throw makeError(`${label} must be greater than 0 with up to 7 decimal places`, 400);
  }

  return value;
}

export function formatStellarAmount(amount: number) {
  const floored = Math.floor(amount * 10000000) / 10000000;

  if (!Number.isFinite(floored) || floored <= 0) {
    throw makeError('Swap output amount must be greater than 0', 400);
  }

  return floored.toFixed(7).replace(/\.?0+$/, '');
}

export function assertSecretKey(secret: unknown, field = 'Secret key') {
  try {
    return Keypair.fromSecret(String(secret || '').trim());
  } catch {
    throw makeError(`${field} is invalid`, 400);
  }
}

export function sanitizeWalletName(value: unknown, fallback: string) {
  const name = String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 42);

  return name || fallback;
}

export function getAllowedOrigin(origin: string, env: Env) {
  const configured = String(env.ALLOWED_ORIGINS || '*').trim();

  if (!configured || configured === '*') {
    return '*';
  }

  const allowed = configured
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  return allowed.includes(origin) ? origin : allowed[0] || null;
}

export function bytesToHex(bytesLike: Uint8Array | ArrayLike<number>) {
  return Array.from(bytesLike)
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBase64(hexValue: string) {
  const clean = hexValue.replace(/^0x/, '');
  const bytes = clean.match(/.{1,2}/g)?.map(byte => Number.parseInt(byte, 16)) || [];
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export function requirePrivyConfig(env: Env) {
  if (!env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET) {
    throw makeError('Missing PRIVY_APP_ID or PRIVY_APP_SECRET', 500);
  }
}

export function privyHeaders(env: Env) {
  requirePrivyConfig(env);

  return {
    Authorization: `Basic ${btoa(`${env.PRIVY_APP_ID}:${env.PRIVY_APP_SECRET}`)}`,
    'Content-Type': 'application/json',
    'privy-app-id': env.PRIVY_APP_ID,
  };
}

export async function privyRequest<T>(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${PRIVY_API_URL}${path}`, {
    ...init,
    headers: {
      ...privyHeaders(env),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? jsonParse<unknown>(text, text) : null;

  if (!response.ok) {
    const message =
      typeof body === 'object' && body
        ? String(
            (body as { message?: string; error?: string }).message ||
              (body as { message?: string; error?: string }).error ||
              `Privy returned error ${response.status}`,
          )
        : `Privy returned error ${response.status}`;
    throw makeError(message, response.status);
  }

  return body as T;
}

export function getPrivyClient(env: Env) {
  requirePrivyConfig(env);

  const key = `${env.PRIVY_APP_ID}:${env.PRIVY_APP_SECRET}`;

  if (!cachedPrivyClient || cachedPrivyClientKey !== key) {
    cachedPrivyClient = new PrivyClient({
      appId: env.PRIVY_APP_ID,
      appSecret: env.PRIVY_APP_SECRET,
    });
    cachedPrivyClientKey = key;
  }

  return cachedPrivyClient;
}

export function getEmailFromPrivyUser(user: unknown) {
  const currentUser = user as {
    email?: string;
    linked_accounts?: Array<{ address?: string; email?: string; type?: string }>;
    linkedAccounts?: Array<{ address?: string; email?: string; type?: string }>;
  } | null;

  if (!currentUser) {
    return '';
  }

  if (currentUser.email) {
    return normalizeEmail(currentUser.email);
  }

  const linkedAccounts = currentUser.linked_accounts || currentUser.linkedAccounts || [];
  const emailAccount =
    linkedAccounts.find(
      account => account.type === 'email' && (account.address || account.email),
    ) || linkedAccounts.find(account => account.address || account.email);

  return normalizeEmail(emailAccount?.address || emailAccount?.email);
}

export async function findPrivyUserByEmail(env: Env, email: string) {
  try {
    return await privyRequest<unknown>(env, '/users/email/address', {
      method: 'POST',
      body: JSON.stringify({ address: email }),
    });
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      return null;
    }

    throw error;
  }
}

export async function createPrivyUser(env: Env, email: string) {
  return privyRequest<{ id?: string }>(env, '/users', {
    method: 'POST',
    body: JSON.stringify({
      custom_metadata: {
        demo: 'stellar-wallet-cloudflare',
      },
      linked_accounts: [{ address: email, type: 'email' }],
    }),
  });
}

export async function createSignableStellarWallet(
  env: Env,
  email: string,
  displayName: string,
) {
  const safeEmail = email.replace(/[^a-z0-9_-]/gi, '_').slice(0, 32);

  return privyRequest<{
    address?: string;
    chain_type?: string;
    display_name?: string;
    id?: string;
    public_key?: string;
  }>(env, '/wallets', {
    method: 'POST',
    body: JSON.stringify({
      chain_type: 'stellar',
      display_name: displayName,
      external_id: `stellar_${safeEmail}_${Date.now()}`,
    }),
  });
}

export async function importStellarWallet({
  displayName,
  env,
  keypair,
  network,
}: {
  displayName: string;
  env: Env;
  keypair: Keypair;
  network: StellarNetwork;
}) {
  const wallets = (getPrivyClient(env) as any).wallets();

  return wallets.import({
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

export async function exportStellarWalletSecret(
  env: Env,
  walletId: string,
  expectedAddress: string,
) {
  const wallets = (getPrivyClient(env) as any).wallets();
  const remoteWallet = await wallets.get(walletId);

  if (String(remoteWallet?.address || '') !== expectedAddress) {
    throw makeError('Privy wallet does not match the selected Stellar wallet', 502);
  }

  const result = await wallets.exportPrivateKey(walletId, {});
  const exportedKey = String(
    result?.private_key ||
      result?.privateKey ||
      result?.data?.private_key ||
      result?.data?.privateKey ||
      '',
  ).trim();

  if (!exportedKey) {
    throw makeError('Privy did not return a wallet private key', 502);
  }

  let keypair: Keypair;

  if (exportedKey.startsWith('S')) {
    keypair = assertSecretKey(exportedKey, 'Exported Stellar secret key');
  } else {
    const cleanHex = exportedKey.replace(/^0x/i, '');

    if (!/^[0-9a-f]{64}$/i.test(cleanHex)) {
      throw makeError('Privy returned an unsupported Stellar key format', 502);
    }

    const seed = new Uint8Array(
      cleanHex.match(/.{2}/g)!.map(byte => Number.parseInt(byte, 16)),
    );
    keypair = Keypair.fromRawEd25519Seed(seed);
  }

  if (keypair.publicKey() !== expectedAddress) {
    throw makeError('Exported key does not match the selected Stellar wallet', 502);
  }

  return { secret: keypair.secret() };
}

export function normalizeWallet(
  wallet: {
    address?: string;
    chain_type?: string;
    display_name?: string;
    id?: string;
    public_key?: string;
  },
  overrides: Partial<WalletRecord> = {},
): WalletRecord {
  return {
    id: wallet.id || overrides.id || '',
    address: wallet.address || overrides.address || '',
    canSign: overrides.canSign !== undefined ? overrides.canSign : true,
    chainType: wallet.chain_type,
    displayName: wallet.display_name || overrides.displayName,
    kind: overrides.kind || 'privy',
    network: overrides.network || 'testnet',
    publicKey: wallet.public_key || wallet.address || overrides.publicKey || '',
    ...(overrides.archived !== undefined ? { archived: overrides.archived } : null),
  };
}

export function normalizeAccountWallets(
  account: AccountRecord,
  preferredNetwork: StellarNetwork = 'testnet',
): AccountRecord {
  const inputWallets = Array.isArray(account.wallets) ? [...account.wallets] : [];

  if (
    account.wallet?.id &&
    !inputWallets.some(
      wallet =>
        wallet.id === account.wallet?.id &&
        wallet.network === account.wallet?.network,
    )
  ) {
    inputWallets.unshift(account.wallet);
  }

  const wallets = inputWallets
    .filter(wallet => wallet.id && wallet.address)
    .filter(
      (wallet, index, allWallets) =>
        allWallets.findIndex(
          item =>
            item.id === wallet.id &&
            item.address === wallet.address &&
            item.network === wallet.network,
        ) === index,
    )
    .map((wallet, index) => ({
      ...wallet,
      archived: Boolean(wallet.archived),
      canSign: wallet.canSign !== false && wallet.kind !== 'watch_only',
      displayName: wallet.displayName || `Stellar Wallet ${index + 1}`,
      kind: wallet.kind || 'privy',
      network: normalizeNetwork(wallet.network),
    }));
  const visibleWallets = wallets.filter(wallet => !wallet.archived);
  const activeWallet =
    visibleWallets.find(
      wallet => wallet.id === account.activeWalletId && wallet.network === preferredNetwork,
    ) ||
    visibleWallets.find(
      wallet => wallet.id === account.wallet?.id && wallet.network === preferredNetwork,
    ) ||
    visibleWallets.find(wallet => wallet.network === preferredNetwork) ||
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

export function getVisibleWallets(account: AccountRecord, network?: StellarNetwork) {
  return (account.wallets || []).filter(
    wallet => !wallet.archived && (!network || wallet.network === network),
  );
}

export async function getAccountByEmail(env: Env, emailValue: unknown) {
  const email = normalizeEmail(emailValue);
  const row = await env.DB.prepare('SELECT data FROM accounts WHERE email = ? LIMIT 1')
    .bind(email)
    .first<{ data: string }>();

  return row?.data ? jsonParse<AccountRecord | null>(row.data, null) : null;
}

export async function saveAccount(env: Env, account: AccountRecord) {
  const now = nowIso();
  const email = normalizeEmail(account.email);
  const existing = await getAccountByEmail(env, email);
  const item: AccountRecord = {
    ...(existing || {}),
    ...account,
    createdAt: existing?.createdAt || account.createdAt || now,
    email,
    updatedAt: now,
  };

  await env.DB.prepare(
    `INSERT INTO accounts (email, account_id, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       account_id = excluded.account_id,
       data = excluded.data,
       updated_at = excluded.updated_at`,
  )
    .bind(
      item.email,
      item.id || null,
      JSON.stringify(item),
      item.createdAt || now,
      item.updatedAt || now,
    )
    .run();

  return item;
}

export async function getIssuer(env: Env, assetCode: string) {
  const row = await env.DB.prepare('SELECT data FROM issuers WHERE asset_code = ? LIMIT 1')
    .bind(assetCode)
    .first<{ data: string }>();

  return row?.data ? jsonParse<DemoIssuer | null>(row.data, null) : null;
}

export async function saveIssuer(env: Env, assetCode: string, issuer: DemoIssuer) {
  const item = {
    ...issuer,
    assetCode,
    updatedAt: nowIso(),
  };

  await env.DB.prepare(
    `INSERT INTO issuers (asset_code, data, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(asset_code) DO UPDATE SET
       data = excluded.data,
       updated_at = excluded.updated_at`,
  )
    .bind(assetCode, JSON.stringify(item), item.updatedAt)
    .run();

  return item;
}

function normalizeKycRow(row?: Record<string, unknown> | null): AccountKycRecord | null {
  if (!row) {
    return null;
  }

  const accountEmail = normalizeEmail(row.account_email);
  const providerUserId = String(row.provider_user_id || '').trim();
  const status = String(row.status || '').trim();

  if (!accountEmail || !providerUserId || status !== 'verified') {
    return null;
  }

  return {
    accountEmail,
    cccdHash: row.cccd_hash ? String(row.cccd_hash) : null,
    cccdLast4: row.cccd_last4 ? String(row.cccd_last4) : null,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    dob: row.dob ? String(row.dob) : null,
    fullName: row.full_name ? String(row.full_name) : null,
    phone: row.phone ? String(row.phone) : null,
    providerUserId,
    status: 'verified',
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function summarizeKyc(record?: AccountKycRecord | null): KycSummary {
  if (!record) {
    return { status: 'not_started' };
  }

  return {
    ...(record.cccdLast4 ? { cccdLast4: record.cccdLast4 } : null),
    ...(record.fullName ? { fullName: record.fullName } : null),
    ...(record.phone ? { phone: record.phone } : null),
    providerUserId: record.providerUserId,
    status: record.status,
    ...(record.updatedAt ? { verifiedAt: record.updatedAt } : null),
  };
}

export async function getKycForAccount(env: Env, emailValue: unknown) {
  const email = normalizeEmail(emailValue);

  if (!email || !env.DB) {
    return null;
  }

  const row = await env.DB.prepare(
    `SELECT *
     FROM account_kyc
     WHERE account_email = ?
     LIMIT 1`,
  )
    .bind(email)
    .first<Record<string, unknown>>();

  return normalizeKycRow(row);
}

export async function getKycSummaryForAccount(env: Env, emailValue: unknown) {
  return summarizeKyc(await getKycForAccount(env, emailValue));
}

export async function saveAccountKyc(
  env: Env,
  record: Omit<AccountKycRecord, 'createdAt' | 'status' | 'updatedAt'>,
) {
  const now = nowIso();
  const item: AccountKycRecord = {
    ...record,
    accountEmail: normalizeEmail(record.accountEmail),
    providerUserId: String(record.providerUserId || '').trim(),
    status: 'verified',
    updatedAt: now,
  };

  if (!isEmailLike(item.accountEmail)) {
    throw makeError('Invalid account email', 400);
  }

  if (!item.providerUserId) {
    throw makeError('Missing KYC provider user id', 502);
  }

  const existing = await getKycForAccount(env, item.accountEmail);

  await env.DB.prepare(
    `INSERT INTO account_kyc (
       account_email,
       provider_user_id,
       status,
       full_name,
       phone,
       cccd_last4,
       cccd_hash,
       dob,
       created_at,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_email) DO UPDATE SET
       provider_user_id = excluded.provider_user_id,
       status = excluded.status,
       full_name = excluded.full_name,
       phone = excluded.phone,
       cccd_last4 = excluded.cccd_last4,
       cccd_hash = excluded.cccd_hash,
       dob = excluded.dob,
       updated_at = excluded.updated_at`,
  )
    .bind(
      item.accountEmail,
      item.providerUserId,
      item.status,
      item.fullName || null,
      item.phone || null,
      item.cccdLast4 || null,
      item.cccdHash || null,
      item.dob || null,
      existing?.createdAt || now,
      now,
    )
    .run();

  return (await getKycForAccount(env, item.accountEmail)) || item;
}

export async function requireVerifiedKyc(env: Env, emailValue: unknown) {
  const kyc = await getKycForAccount(env, emailValue);

  if (!kyc || kyc.status !== 'verified' || !kyc.providerUserId) {
    throw makeError('KYC_REQUIRED', 403);
  }

  return kyc;
}

export async function saveContact(env: Env, contact: { funded: boolean; label: string; wallet: WalletRecord }) {
  const item = {
    id: contact.wallet.id,
    funded: Boolean(contact.funded),
    label: contact.label,
    updatedAt: nowIso(),
    wallet: contact.wallet,
  };

  await env.DB.prepare(
    `INSERT INTO contacts (id, data, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       data = excluded.data,
       updated_at = excluded.updated_at`,
  )
    .bind(item.id, JSON.stringify(item), item.updatedAt)
    .run();

  return item;
}

export async function ensureWalletForNetwork(
  env: Env,
  account: AccountRecord,
  networkValue: unknown,
) {
  const network = normalizeNetwork(networkValue);
  const normalizedAccount = normalizeAccountWallets(account, network);
  const existingWallet = getVisibleWallets(normalizedAccount, network).find(
    wallet => wallet.canSign,
  );

  if (existingWallet) {
    return saveAccount(
      env,
      normalizeAccountWallets(
        {
          ...normalizedAccount,
          activeWalletId: existingWallet.id,
          wallet: existingWallet,
        },
        network,
      ),
    );
  }

  const nextWalletNumber = (normalizedAccount.wallets || []).length + 1;
  const wallet = normalizeWallet(
    await createSignableStellarWallet(
      env,
      normalizedAccount.email,
      `Stellar ${network} ${nextWalletNumber}`,
    ),
    {
      canSign: true,
      kind: 'privy',
      network,
    },
  );

  return saveAccount(
    env,
    normalizeAccountWallets(
      {
        ...normalizedAccount,
        activeWalletId: wallet.id,
        wallet,
        wallets: [...(normalizedAccount.wallets || []), wallet],
      },
      network,
    ),
  );
}

export async function getOrCreateSessionAccountByEmail(
  env: Env,
  emailValue: unknown,
  networkValue: unknown,
  userId?: string,
) {
  const email = normalizeEmail(emailValue);
  const network = normalizeNetwork(networkValue);

  if (!isEmailLike(email)) {
    throw makeError('Invalid email', 400);
  }

  const localAccount = await getAccountByEmail(env, email);

  if (localAccount) {
    return ensureWalletForNetwork(
      env,
      {
        ...localAccount,
        ...(userId ? { id: userId } : null),
      },
      network,
    );
  }

  const user = userId
    ? { id: userId }
    : ((await findPrivyUserByEmail(env, email)) as { id?: string } | null) ||
      (await createPrivyUser(env, email));
  const wallet = normalizeWallet(
    await createSignableStellarWallet(env, email, `Stellar ${network} 1`),
    {
      canSign: true,
      kind: 'privy',
      network,
    },
  );

  return saveAccount(
    env,
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
}

export function getBearerToken(headerValue: string | undefined, body: Record<string, unknown>) {
  const match = String(headerValue || '').match(/^Bearer\s+(.+)$/i);

  return String(body.identityToken || match?.[1] || '').trim();
}

export async function requireAuthenticatedAccount(
  env: Env,
  authorizationHeader: string | undefined,
) {
  const identityToken = getBearerToken(authorizationHeader, {});

  if (!identityToken) {
    throw makeError('Privy session is required for this action', 401);
  }

  const user = await getPrivyClient(env).users().get({
    id_token: identityToken,
  });
  const email = getEmailFromPrivyUser(user);
  const userId = String((user as { id?: string })?.id || '');

  if (!isEmailLike(email)) {
    throw makeError('This Privy account does not have a valid email', 400);
  }

  const account = await getAccountByEmail(env, email);

  if (!account) {
    throw makeError('Wallet account not found', 404);
  }

  return saveAccount(env, {
    ...account,
    ...(userId ? { id: userId } : null),
  });
}

export async function requireAccountContext(
  env: Env,
  authorizationHeader: string | undefined,
  body: Record<string, unknown>,
  options: { network: StellarNetwork; requireAuth?: boolean },
) {
  const identityToken = getBearerToken(authorizationHeader, body);
  let tokenEmail = '';
  let userId = '';

  if (identityToken) {
    const user = await getPrivyClient(env).users().get({
      id_token: identityToken,
    });

    tokenEmail = getEmailFromPrivyUser(user);
    userId = String((user as { id?: string })?.id || '');
  }

  if (options.requireAuth && !tokenEmail) {
    throw makeError('Privy session is required for this action', 401);
  }

  const email = tokenEmail || normalizeEmail(body.email);

  if (!isEmailLike(email)) {
    throw makeError('Invalid email', 400);
  }

  const account = await getAccountByEmail(env, email);

  if (!account) {
    throw makeError('Wallet account not found', 404);
  }

  return saveAccount(
    env,
    normalizeAccountWallets(
      {
        ...account,
        ...(userId ? { id: userId } : null),
      },
      options.network,
    ),
  );
}

export async function requireDemoAccountByEmail(
  env: Env,
  emailValue: unknown,
  networkValue: unknown = 'testnet',
) {
  const email = normalizeEmail(emailValue);
  const network = normalizeNetwork(networkValue);

  if (!isEmailLike(email)) {
    throw makeError('Invalid email', 400);
  }

  const account = await getAccountByEmail(env, email);

  if (!account) {
    throw makeError('Demo account not found', 404);
  }

  return ensureWalletForNetwork(env, account, network);
}

export function assertAccountWallet({
  account,
  address,
  network,
  requireSigner = true,
  walletId,
}: {
  account: AccountRecord;
  address: string;
  network: StellarNetwork;
  requireSigner?: boolean;
  walletId: string;
}) {
  const wallet = (account.wallets || []).find(
    item =>
      item.id === walletId &&
      item.address === address &&
      item.network === network &&
      !item.archived,
  );

  if (!wallet) {
    throw makeError('Wallet does not belong to the signed-in account', 403);
  }

  if (requireSigner && !wallet.canSign) {
    throw makeError('Watch-only wallets cannot sign transactions', 403);
  }

  return wallet;
}

export function shouldRequireMainnetAuth(network: StellarNetwork) {
  return network === 'mainnet';
}

export function getTestnetAssetDefinitions() {
  return [
    {
      assetCode: NATIVE_ASSET_CODE,
      assetIssuer: null,
      demo: false,
      displayName: 'Lumens',
      homeDomain: 'stellar.org',
      iconKey: 'xlm',
      isNative: true,
      network: 'testnet' as StellarNetwork,
      trustLevel: 'verified' as const,
    },
    {
      assetCode: 'USDC',
      assetIssuer: TESTNET_USDC_ISSUER,
      demo: false,
      displayName: 'USD Coin Testnet',
      homeDomain: 'centre.io',
      iconKey: 'usdc',
      isNative: false,
      network: 'testnet' as StellarNetwork,
      trustLevel: 'verified' as const,
    },
  ];
}

export function getKnownAssetDefinitions(networkValue: unknown): AssetDefinition[] {
  const network = normalizeNetwork(networkValue);

  if (network === 'mainnet') {
    return MAINNET_ASSETS;
  }

  return getTestnetAssetDefinitions();
}

export function getIssuerKey(network: StellarNetwork, assetCode: string) {
  return `${network}:${normalizeAssetCode(assetCode)}`;
}

export async function getDemoIssuer(env: Env, assetCode: string) {
  const normalized = normalizeAssetCode(assetCode);

  return (
    (await getIssuer(env, getIssuerKey('testnet', normalized))) ||
    (await getIssuer(env, normalized))
  );
}

export async function loadAccount(env: Env, address: string, networkValue: unknown) {
  try {
    return await getStellarServer(env, networkValue).loadAccount(address);
  } catch (error) {
    const maybeStatus =
      (error as { response?: { status?: number }; status?: number })?.response?.status ||
      (error as { status?: number })?.status;

    if (maybeStatus === 404) {
      return null;
    }

    throw error;
  }
}

export async function friendbotFund(env: Env, address: string, networkValue: unknown) {
  const config = getNetworkConfig(env, networkValue);

  if (!config.supportsFriendbot || !config.friendbotUrl) {
    throw makeError(
      'Mainnet does not have Friendbot. Deposit real XLM to activate this wallet.',
      400,
    );
  }

  const response = await fetch(`${config.friendbotUrl}?addr=${address}`);
  const text = await response.text();

  if (!response.ok) {
    throw makeError(text || 'Friendbot could not fund test XLM', response.status);
  }

  return text;
}

export async function ensureDemoAssetIssuer(
  env: Env,
  assetCodeValue: unknown,
  networkValue: unknown = 'testnet',
) {
  const network = normalizeNetwork(networkValue);
  const assetCode = normalizeAssetCode(assetCodeValue);

  if (network !== 'testnet') {
    throw makeError('Demo issuers are only available on Testnet', 400);
  }

  if (assetCode === NATIVE_ASSET_CODE) {
    return null;
  }

  const existing = await getDemoIssuer(env, assetCode);

  if (existing?.publicKey && existing?.secret) {
    const account = await loadAccount(env, existing.publicKey, network);

    if (account) {
      return existing;
    }
  }

  const keypair = Keypair.random();
  await friendbotFund(env, keypair.publicKey(), network);

  const issuer = await saveIssuer(env, getIssuerKey(network, assetCode), {
    fundedAt: nowIso(),
    publicKey: keypair.publicKey(),
    secret: keypair.secret(),
  });

  await saveIssuer(env, assetCode, issuer);

  return issuer;
}

export function filterAssetsBySearch(assets: AssetDefinition[], search: unknown) {
  const query = String(search || '').trim().toLowerCase();

  if (!query) {
    return assets;
  }

  return assets.filter(asset =>
    [asset.assetCode, asset.displayName, asset.homeDomain, asset.assetIssuer]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(query)),
  );
}

function normalizeAssetLimit(value: unknown, fallback = 40) {
  const limit = Number(value || fallback);

  if (!Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(1, Math.min(100, Math.floor(limit)));
}

type StellarExpertAssetRecord = {
  asset?: string;
  domain?: string;
  home_domain?: string;
  price?: number;
  rating?: {
    average?: number;
  };
  score?: number;
  tomlInfo?: {
    anchorAsset?: string;
    code?: string;
    image?: string;
    issuer?: string;
    name?: string;
    orgLogo?: string;
    orgName?: string;
  };
  toml_info?: {
    anchorAsset?: string;
    code?: string;
    image?: string;
    issuer?: string;
    name?: string;
    orgLogo?: string;
    orgName?: string;
  };
  volume7d?: number;
};

function parseStellarExpertAssetId(assetId: string) {
  if (assetId === NATIVE_ASSET_CODE) {
    return {
      assetCode: NATIVE_ASSET_CODE,
      assetIssuer: null,
    };
  }

  const parts = assetId.split('-');
  const issuer = parts.find(part => part.startsWith('G')) || null;

  return {
    assetCode: parts[0] || '',
    assetIssuer: issuer,
  };
}

function mapStellarExpertAsset(record: StellarExpertAssetRecord): AssetDefinition | null {
  const toml = record.tomlInfo || record.toml_info || {};
  const parsed = parseStellarExpertAssetId(String(record.asset || ''));
  const assetCode = String(toml.code || parsed.assetCode || '').trim();
  const assetIssuer = toml.issuer || parsed.assetIssuer;

  if (!assetCode) {
    return null;
  }

  const isNative = assetCode === NATIVE_ASSET_CODE && !assetIssuer;
  const rating = Number(record.rating?.average ?? record.score ?? 0);

  return {
    assetCode,
    assetIssuer: isNative ? null : assetIssuer || null,
    demo: false,
    displayName:
      String(toml.name || toml.anchorAsset || toml.orgName || assetCode).trim() ||
      assetCode,
    homeDomain: record.domain || record.home_domain || null,
    iconKey: assetCode.toLowerCase(),
    image: toml.image || toml.orgLogo || null,
    isNative,
    network: 'mainnet',
    priceUsd: Number.isFinite(Number(record.price)) ? Number(record.price) : null,
    rating: Number.isFinite(rating) ? rating : null,
    trustLevel: isNative || rating >= 7 ? 'verified' : 'discovered',
    volume7d:
      Number.isFinite(Number(record.volume7d)) ? Number(record.volume7d) : null,
  };
}

async function fetchStellarExpertAssets(options: { limit: number; search?: unknown }) {
  const params = new URLSearchParams({
    limit: String(options.limit),
    order: 'desc',
    sort: 'rating',
  });
  const search = String(options.search || '').trim();

  if (search) {
    params.set('search', search);
  }

  const response = await fetch(
    `https://api.stellar.expert/explorer/public/asset?${params.toString()}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`StellarExpert returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    _embedded?: {
      records?: StellarExpertAssetRecord[];
    };
  };

  return (body._embedded?.records || [])
    .map(mapStellarExpertAsset)
    .filter((asset): asset is AssetDefinition => Boolean(asset));
}

export async function getSupportedAssets(env: Env, networkValue: unknown, options: { limit?: unknown; search?: unknown } = {}) {
  const network = normalizeNetwork(networkValue);
  const fallbackAssets = filterAssetsBySearch(
    getKnownAssetDefinitions(network),
    options.search,
  );

  if (network !== 'mainnet') {
    return fallbackAssets;
  }

  try {
    const assets = await fetchStellarExpertAssets({
      limit: normalizeAssetLimit(options.limit),
      search: options.search,
    });

    return assets.length > 0 ? assets : fallbackAssets;
  } catch {
    return fallbackAssets;
  }
}

export async function getSupportedAsset(
  env: Env,
  input: { assetCode?: unknown; assetIssuer?: unknown; network: StellarNetwork },
) {
  const normalized = normalizeAssetCode(input.assetCode);
  const assetIssuer = String(input.assetIssuer || '').trim();
  const knownAsset = getKnownAssetDefinitions(input.network).find(
    item =>
      item.assetCode === normalized &&
      (!assetIssuer || item.assetIssuer === assetIssuer),
  );

  if (knownAsset) {
    return knownAsset;
  }

  const assets = await getSupportedAssets(env, input.network);
  const asset = assets.find(
    item =>
      item.assetCode === normalized &&
      (!assetIssuer || item.assetIssuer === assetIssuer),
  );

  if (asset) {
    return asset;
  }

  if (input.network === 'mainnet' && normalized !== NATIVE_ASSET_CODE) {
    assertStellarAddress(assetIssuer, 'Issuer');

    return {
      assetCode: normalized,
      assetIssuer,
      demo: false,
      displayName: normalized,
      homeDomain: assetIssuer,
      iconKey: normalized.toLowerCase(),
      isNative: false,
      network: input.network,
      trustLevel: 'unverified' as const,
    };
  }

  throw makeError('Token is not supported', 400);
}

export function getNativeBalance(account: Awaited<ReturnType<typeof loadAccount>>) {
  if (!account) {
    return '0';
  }

  const balances = account.balances as Array<Record<string, any>>;

  return balances.find(balance => balance.asset_type === 'native')?.balance || '0';
}

export function getMinimumBalanceForSubentries(subentryCount: number) {
  return (2 + subentryCount) * STELLAR_BASE_RESERVE_XLM;
}

function formatStellarBalance(value: number) {
  return Math.max(0, value).toFixed(7);
}

export function getMinimumBalanceForAccount(
  account: Awaited<ReturnType<typeof loadAccount>>,
) {
  if (!account) {
    return 0;
  }

  const subentryCount = Number(account.subentry_count || 0);

  return getMinimumBalanceForSubentries(subentryCount);
}

export function getAvailableNativeBalance(
  account: Awaited<ReturnType<typeof loadAccount>>,
  feeBuffer = PAYMENT_FEE_BUFFER_XLM,
) {
  if (!account) {
    return 0;
  }

  const balance = Number(getNativeBalance(account));
  const minimumBalance = getMinimumBalanceForAccount(account);

  if (!Number.isFinite(balance)) {
    return 0;
  }

  return Math.max(0, balance - minimumBalance - feeBuffer);
}

export function getRequiredBalanceForNewTrustline(
  account: Awaited<ReturnType<typeof loadAccount>>,
) {
  const subentryCount = Number(account?.subentry_count || 0);

  return getMinimumBalanceForSubentries(subentryCount + 1) + TRUSTLINE_FEE_BUFFER_XLM;
}

export function assertCanAddTrustline(
  account: Awaited<ReturnType<typeof loadAccount>>,
  assetCode: string,
) {
  const available = Number(getNativeBalance(account));
  const required = getRequiredBalanceForNewTrustline(account);

  if (!Number.isFinite(available) || available < required) {
    throw makeError(
      `Not enough XLM to enable ${assetCode}. You have ${available.toFixed(
        7,
      )} XLM, but enabling this asset requires at least ${required.toFixed(
        4,
      )} XLM for Stellar reserve and network fee. Deposit more XLM first.`,
      400,
    );
  }
}

function getNestedValue(value: unknown, path: string[]) {
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, value);
}

function getHorizonResultCodes(error: unknown) {
  const candidates = [
    getNestedValue(error, ['response', 'data', 'extras', 'result_codes']),
    getNestedValue(error, ['response', 'extras', 'result_codes']),
    getNestedValue(error, ['extras', 'result_codes']),
    getNestedValue(error, ['data', 'extras', 'result_codes']),
  ];

  return candidates.find(
    item => item && typeof item === 'object',
  ) as
    | {
        transaction?: string;
        operations?: string[];
      }
    | undefined;
}

export function getStellarSubmissionErrorMessage(
  error: unknown,
  fallback = 'Stellar transaction failed.',
) {
  const resultCodes = getHorizonResultCodes(error);
  const operationCodes = resultCodes?.operations || [];
  const transactionCode = resultCodes?.transaction || '';
  const allCodes = [transactionCode, ...operationCodes].filter(Boolean);

  if (
    allCodes.includes('op_low_reserve') ||
    allCodes.includes('tx_insufficient_balance')
  ) {
    return 'Not enough XLM reserve to complete this Stellar transaction. Deposit more XLM first.';
  }

  if (allCodes.includes('op_no_issuer')) {
    return 'The token issuer does not exist on this Stellar network.';
  }

  if (allCodes.includes('op_already_exists')) {
    return 'This asset is already enabled for receiving.';
  }

  if (allCodes.includes('tx_bad_seq')) {
    return 'Stellar rejected this transaction because the wallet sequence changed. Refresh and try again.';
  }

  if (allCodes.length > 0) {
    return `${fallback} Code: ${allCodes.join(', ')}`;
  }

  const rawMessage = error instanceof Error ? error.message : String(error || '');

  if (/Request failed with status code 400/i.test(rawMessage)) {
    return fallback;
  }

  return rawMessage || fallback;
}

export function findIssuedBalance(
  account: Awaited<ReturnType<typeof loadAccount>>,
  assetCode: string,
  issuerAddress: string | null,
) {
  if (!account || !issuerAddress) {
    return null;
  }

  const balances = account.balances as Array<Record<string, any>>;

  return (
    balances.find(
      balance =>
        balance.asset_type !== 'native' &&
        balance.asset_code === assetCode &&
        balance.asset_issuer === issuerAddress,
    ) || null
  );
}

export function mergeKnownAndDiscoveredAssets(
  knownAssets: AssetDefinition[],
  account: Awaited<ReturnType<typeof loadAccount>>,
  network: StellarNetwork,
) {
  const merged = new Map<string, AssetDefinition>();

  for (const asset of knownAssets) {
    const key = asset.isNative
      ? `${network}:native`
      : `${network}:${asset.assetCode}:${asset.assetIssuer}`;
    merged.set(key, asset);
  }

  for (const balance of ((account?.balances || []) as Array<Record<string, any>>)) {
    const assetCode =
      balance.asset_type === 'native'
        ? NATIVE_ASSET_CODE
        : normalizeAssetCode(balance.asset_code);
    const assetIssuer = assetCode === NATIVE_ASSET_CODE ? null : balance.asset_issuer || null;
    const key =
      assetCode === NATIVE_ASSET_CODE
        ? `${network}:native`
        : `${network}:${assetCode}:${assetIssuer}`;

    if (!merged.has(key)) {
      merged.set(key, {
        assetCode,
        assetIssuer,
        demo: false,
        displayName: assetCode,
        homeDomain: assetIssuer,
        iconKey: assetCode.toLowerCase(),
        isNative: assetCode === NATIVE_ASSET_CODE,
        network,
        trustLevel: 'discovered',
      });
    }
  }

  return [...merged.values()];
}

export function getBalanceItems(
  account: Awaited<ReturnType<typeof loadAccount>>,
  assetDefinitions: AssetDefinition[],
) {
  return assetDefinitions.map(asset => {
    if (asset.isNative) {
      const balance = Number(getNativeBalance(account));
      const minimumBalance = getMinimumBalanceForAccount(account);
      const availableBalance = getAvailableNativeBalance(account);

      return {
        ...asset,
        availableBalance: formatStellarBalance(availableBalance),
        balance: getNativeBalance(account),
        exists: Boolean(account),
        minimumBalance: formatStellarBalance(minimumBalance),
        reservedBalance: formatStellarBalance(
          account && Number.isFinite(balance) ? Math.min(balance, minimumBalance) : 0,
        ),
        trusted: Boolean(account),
      };
    }

    const balance = findIssuedBalance(account, asset.assetCode, asset.assetIssuer);

    return {
      ...asset,
      availableBalance: balance?.balance || '0',
      balance: balance?.balance || '0',
      exists: Boolean(account),
      limit: balance?.limit || '0',
      trusted: Boolean(balance),
    };
  });
}

export async function getAccountBalances(env: Env, address: string, networkValue: unknown) {
  const network = normalizeNetwork(networkValue);
  const account = await loadAccount(env, address, network);
  const assets = mergeKnownAndDiscoveredAssets(
    await getSupportedAssets(env, network),
    account,
    network,
  );

  return {
    address,
    balances: getBalanceItems(account, assets),
    exists: Boolean(account),
    network,
    xlm: getNativeBalance(account),
  };
}

export function ensureTrustline(
  account: Awaited<ReturnType<typeof loadAccount>>,
  assetDefinition: AssetDefinition,
  field = 'Recipient wallet',
) {
  if (assetDefinition.isNative) {
    return;
  }

  if (!findIssuedBalance(account, assetDefinition.assetCode, assetDefinition.assetIssuer)) {
    throw makeError(
      `${field} has not added ${assetDefinition.assetCode}. Add the trustline first.`,
      400,
    );
  }
}

export function assertSufficientBalance(
  account: Awaited<ReturnType<typeof loadAccount>>,
  assetDefinition: AssetDefinition,
  amountValue: unknown,
) {
  const amount = Number(assertAmount(amountValue));

  if (assetDefinition.isNative) {
    const available = getAvailableNativeBalance(account);
    const minimumBalance = getMinimumBalanceForAccount(account);

    if (!Number.isFinite(available) || available < amount) {
      throw makeError(
        `Insufficient available XLM balance. You can send up to ${formatStellarBalance(
          available,
        )} XLM. Stellar keeps ${formatStellarBalance(
          minimumBalance,
        )} XLM reserved for this wallet.`,
        400,
      );
    }

    return;
  }

  const balance = Number(
    findIssuedBalance(
      account,
      assetDefinition.assetCode,
      assetDefinition.assetIssuer,
    )?.balance || 0,
  );

  if (!Number.isFinite(balance) || balance < amount) {
    throw makeError(
      `Insufficient ${assetDefinition.assetCode} balance`,
      400,
    );
  }

  const nativeBalance = Number(getNativeBalance(account));
  const requiredNativeBalance =
    getMinimumBalanceForAccount(account) + PAYMENT_FEE_BUFFER_XLM;

  if (!Number.isFinite(nativeBalance) || nativeBalance < requiredNativeBalance) {
    throw makeError(
      `Deposit a small amount of XLM to pay Stellar network fees before sending ${assetDefinition.assetCode}.`,
      400,
    );
  }
}

export function assertStellarMemo(value: unknown) {
  const memo = String(value || '').trim();

  if (!memo) {
    return '';
  }

  if (new TextEncoder().encode(memo).length > 28) {
    throw makeError('Stellar text memo must be at most 28 bytes', 400);
  }

  return memo;
}

export function getIssuedAsset(assetDefinition: AssetDefinition) {
  if (!assetDefinition.assetIssuer) {
    throw makeError('Issued token is missing an issuer', 400);
  }

  return new Asset(assetDefinition.assetCode, assetDefinition.assetIssuer);
}

export function getAssetForOperation(assetDefinition: AssetDefinition) {
  return assetDefinition.isNative ? Asset.native() : getIssuedAsset(assetDefinition);
}

export function buildPaymentTransaction({
  amount,
  asset,
  destination,
  destinationAccount,
  env,
  memo,
  network,
  sourceAccount,
}: {
  amount: string;
  asset: Asset | null;
  destination: string;
  destinationAccount: Awaited<ReturnType<typeof loadAccount>>;
  env: Env;
  memo?: string;
  network: StellarNetwork;
  sourceAccount: NonNullable<Awaited<ReturnType<typeof loadAccount>>>;
}) {
  const config = getNetworkConfig(env, network);
  const operation =
    !asset || asset.isNative()
      ? destinationAccount
        ? Operation.payment({
            amount,
            asset: Asset.native(),
            destination,
          })
        : Operation.createAccount({
            destination,
            startingBalance: amount,
          })
      : Operation.payment({
          amount,
          asset,
          destination,
        });
  const builder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(operation);
  const safeMemo = assertStellarMemo(memo);

  if (safeMemo) {
    builder.addMemo(Memo.text(safeMemo));
  }

  const transaction = builder.setTimeout(60).build();

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

export function buildTrustlineTransaction({
  asset,
  env,
  network,
  sourceAccount,
}: {
  asset: Asset;
  env: Env;
  network: StellarNetwork;
  sourceAccount: NonNullable<Awaited<ReturnType<typeof loadAccount>>>;
}) {
  const config = getNetworkConfig(env, network);

  return new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(60)
    .build();
}

export async function signStellarTransaction(
  env: Env,
  walletId: string,
  transaction: ReturnType<TransactionBuilder['build']>,
) {
  const hashHex = `0x${bytesToHex(transaction.hash() as Uint8Array)}`;
  const result = await privyRequest<{
    data?: { signature?: string };
    signature?: string;
  }>(env, `/wallets/${walletId}/raw_sign`, {
    method: 'POST',
    body: JSON.stringify({
      params: {
        hash: hashHex,
      },
    }),
  });
  const signature = result.data?.signature || result.signature;

  if (!signature) {
    throw makeError('Privy did not return a Stellar transaction signature', 502);
  }

  return signature.replace(/^0x/, '');
}

export function addPrivySignature(
  transaction: ReturnType<TransactionBuilder['build']>,
  sourceAddress: string,
  signatureHex: string,
) {
  transaction.addSignature(sourceAddress, hexToBase64(signatureHex));
}

export async function submitPrivySignedTransaction({
  env,
  network,
  sourceAddress,
  transaction,
  walletId,
}: {
  env: Env;
  network: StellarNetwork;
  sourceAddress: string;
  transaction: ReturnType<TransactionBuilder['build']>;
  walletId: string;
}) {
  const signatureHex = await signStellarTransaction(env, walletId, transaction);
  addPrivySignature(transaction, sourceAddress, signatureHex);

  try {
    return await getStellarServer(env, network).submitTransaction(transaction);
  } catch (error) {
    const status =
      Number(getNestedValue(error, ['response', 'status'])) ||
      Number((error as { status?: number })?.status) ||
      400;

    throw makeError(
      getStellarSubmissionErrorMessage(
        error,
        'Stellar could not submit this transaction.',
      ),
      status,
    );
  }
}

export function parsePathAsset(assetRecord: Record<string, any>) {
  if (assetRecord.asset_type === 'native') {
    return Asset.native();
  }

  return new Asset(assetRecord.asset_code, assetRecord.asset_issuer);
}

export async function quoteStellarSwap(
  env: Env,
  {
    amount,
    fromAssetCode,
    fromAssetIssuer,
    network,
    sourceAddress,
    toAssetCode,
    toAssetIssuer,
  }: {
    amount: unknown;
    fromAssetCode: unknown;
    fromAssetIssuer?: unknown;
    network: StellarNetwork;
    sourceAddress: string;
    toAssetCode: unknown;
    toAssetIssuer?: unknown;
  },
) {
  const sendAmount = assertAmount(amount);
  const sourceAccount = await loadAccount(env, sourceAddress, network);

  if (!sourceAccount) {
    throw makeError(
      `${network === 'mainnet' ? 'Mainnet' : 'Testnet'} wallet is not active. Deposit XLM before swapping.`,
      400,
    );
  }

  const fromDefinition = await getSupportedAsset(env, {
    assetCode: fromAssetCode,
    assetIssuer: fromAssetIssuer,
    network,
  });
  const toDefinition = await getSupportedAsset(env, {
    assetCode: toAssetCode,
    assetIssuer: toAssetIssuer,
    network,
  });

  if (fromDefinition.assetCode === toDefinition.assetCode) {
    throw makeError('Choose two different tokens to swap', 400);
  }

  ensureTrustline(sourceAccount, fromDefinition, 'Source wallet');
  assertSufficientBalance(sourceAccount, fromDefinition, sendAmount);

  const records = await getStellarServer(env, network)
    .strictSendPaths(
      getAssetForOperation(fromDefinition),
      sendAmount,
      [getAssetForOperation(toDefinition)],
    )
    .call();
  const bestPath = (records as any)?.records?.[0];

  if (!bestPath) {
    throw makeError('No swap path found on Stellar DEX', 400);
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

export async function executeStellarSwap(
  env: Env,
  {
    amount,
    fromAssetCode,
    fromAssetIssuer,
    network,
    sourceAddress,
    sourceWalletId,
    toAssetCode,
    toAssetIssuer,
  }: {
    amount: unknown;
    fromAssetCode: unknown;
    fromAssetIssuer?: unknown;
    network: StellarNetwork;
    sourceAddress: string;
    sourceWalletId: string;
    toAssetCode: unknown;
    toAssetIssuer?: unknown;
  },
) {
  if (!sourceWalletId) {
    throw makeError('Missing Privy wallet id for swap', 400);
  }

  const quote = await quoteStellarSwap(env, {
    amount,
    fromAssetCode,
    fromAssetIssuer,
    network,
    sourceAddress,
    toAssetCode,
    toAssetIssuer,
  });
  const sourceAccount = await loadAccount(env, sourceAddress, network);

  if (!sourceAccount) {
    throw makeError(
      `${network === 'mainnet' ? 'Mainnet' : 'Testnet'} wallet is not active. Deposit XLM first.`,
      400,
    );
  }

  const fromDefinition = await getSupportedAsset(env, {
    assetCode: fromAssetCode,
    assetIssuer: fromAssetIssuer,
    network,
  });
  const toDefinition = await getSupportedAsset(env, {
    assetCode: toAssetCode,
    assetIssuer: toAssetIssuer,
    network,
  });
  ensureTrustline(sourceAccount, toDefinition, 'Recipient wallet');
  const config = getNetworkConfig(env, network);
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(
      Operation.pathPaymentStrictSend({
        destAsset: getAssetForOperation(toDefinition),
        destination: sourceAddress,
        destMin: quote.destMin,
        path: quote.path.map(parsePathAsset),
        sendAmount: quote.fromAmount,
        sendAsset: getAssetForOperation(fromDefinition),
      }),
    )
    .setTimeout(60)
    .build();
  const submitted = await submitPrivySignedTransaction({
    env,
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

export async function fetchAccountOperations(
  env: Env,
  address: string,
  networkValue: unknown,
  limit = 30,
) {
  const config = getNetworkConfig(env, networkValue);
  const response = await fetch(
    `${config.horizonUrl}/accounts/${address}/operations?order=desc&limit=${limit}&join=transactions`,
  );

  if (response.status === 404) {
    return [];
  }

  const body = await response.json();

  if (!response.ok) {
    throw makeError(
      String((body as { detail?: string })?.detail || 'Could not load Stellar history'),
      response.status,
    );
  }

  return ((body as { _embedded?: { records?: unknown[] } })?._embedded?.records || []) as Array<
    Record<string, any>
  >;
}

export function normalizeOperationRecord(
  env: Env,
  address: string,
  operation: Record<string, any>,
  network: StellarNetwork,
) {
  const hash = operation.transaction_hash;

  if (!hash) {
    return null;
  }

  const isPayment = operation.type === 'payment';
  const isCreateAccount = operation.type === 'create_account';
  const isChangeTrust = operation.type === 'change_trust';
  const isPathPayment = String(operation.type || '').startsWith('path_payment');

  if (!isPayment && !isCreateAccount && !isChangeTrust && !isPathPayment) {
    return null;
  }

  const assetCode = isCreateAccount
    ? NATIVE_ASSET_CODE
    : operation.asset_type === 'native' || operation.source_asset_type === 'native'
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
    explorerUrl: getExplorerUrl(env, network, 'tx', hash),
    from,
    hash,
    ledger: Number(operation.transaction_attr?.ledger || operation.ledger || 0),
    network,
    operation: isPathPayment ? 'path_payment_strict_send' : operation.type,
    to,
  };
}

export async function getAccountHistory(
  env: Env,
  address: string,
  networkValue: unknown,
  limit = 30,
) {
  const network = normalizeNetwork(networkValue);
  const records = await fetchAccountOperations(env, address, network, limit);

  return records
    .map(operation => normalizeOperationRecord(env, address, operation, network))
    .filter(Boolean);
}

export function parseStellarXdr(env: Env, xdr: unknown, networkValue: unknown) {
  const config = getNetworkConfig(env, networkValue);

  try {
    return TransactionBuilder.fromXDR(String(xdr || '').trim(), config.passphrase);
  } catch {
    throw makeError(
      'Stellar XDR is invalid or uses the wrong network passphrase',
      400,
    );
  }
}

export function requireClassicTransaction(
  transaction: ReturnType<typeof parseStellarXdr>,
) {
  if (!('source' in transaction) || !('memo' in transaction) || !('sequence' in transaction)) {
    throw makeError('Fee-bump XDR is not supported by this signer yet', 400);
  }

  return transaction as ReturnType<TransactionBuilder['build']>;
}

const WALLETCONNECT_CLASSIC_OPERATION_TYPES = new Set([
  'changeTrust',
  'createAccount',
  'createPassiveSellOffer',
  'manageBuyOffer',
  'manageSellOffer',
  'pathPaymentStrictReceive',
  'pathPaymentStrictSend',
  'payment',
]);

function summarizeStellarAsset(asset: Record<string, any> | undefined) {
  if (!asset) {
    return null;
  }

  return {
    code: String(asset.code || NATIVE_ASSET_CODE),
    issuer: asset.issuer ? String(asset.issuer) : null,
  };
}

export function summarizeOperation(operation: Record<string, any>) {
  if (!WALLETCONNECT_CLASSIC_OPERATION_TYPES.has(operation.type)) {
    const label =
      operation.type === 'invokeHostFunction'
        ? 'Soroban contract calls'
        : `Operation ${operation.type || 'unknown'}`;

    throw makeError(`${label} are not supported by this WalletConnect signer`, 400);
  }

  const base = {
    source: operation.source ? String(operation.source) : null,
    type: String(operation.type),
  };

  switch (operation.type) {
    case 'payment':
      return {
        ...base,
        amount: String(operation.amount),
        asset: summarizeStellarAsset(operation.asset),
        destination: String(operation.destination),
      };
    case 'createAccount':
      return {
        ...base,
        destination: String(operation.destination),
        startingBalance: String(operation.startingBalance),
      };
    case 'changeTrust':
      return {
        ...base,
        asset: summarizeStellarAsset(operation.line),
        limit: String(operation.limit),
      };
    case 'pathPaymentStrictSend':
      return {
        ...base,
        destination: String(operation.destination),
        destinationAsset: summarizeStellarAsset(operation.destAsset),
        destinationMinimum: String(operation.destMin),
        path: (operation.path || []).map(summarizeStellarAsset),
        sendAmount: String(operation.sendAmount),
        sendAsset: summarizeStellarAsset(operation.sendAsset),
      };
    case 'pathPaymentStrictReceive':
      return {
        ...base,
        destination: String(operation.destination),
        destinationAmount: String(operation.destAmount),
        destinationAsset: summarizeStellarAsset(operation.destAsset),
        path: (operation.path || []).map(summarizeStellarAsset),
        sendAsset: summarizeStellarAsset(operation.sendAsset),
        sendMaximum: String(operation.sendMax),
      };
    case 'manageBuyOffer':
      return {
        ...base,
        buying: summarizeStellarAsset(operation.buying),
        buyAmount: String(operation.buyAmount),
        offerId: String(operation.offerId),
        price: String(operation.price),
        selling: summarizeStellarAsset(operation.selling),
      };
    case 'manageSellOffer':
    case 'createPassiveSellOffer':
      return {
        ...base,
        amount: String(operation.amount),
        buying: summarizeStellarAsset(operation.buying),
        offerId:
          operation.offerId === undefined ? null : String(operation.offerId),
        price: String(operation.price),
        selling: summarizeStellarAsset(operation.selling),
      };
    default:
      throw makeError('Unsupported Stellar operation', 400);
  }
}

export function reviewStellarXdr({
  env,
  network,
  sourceAddress,
  xdr,
}: {
  env: Env;
  network: StellarNetwork;
  sourceAddress?: string;
  xdr: unknown;
}) {
  const transaction = requireClassicTransaction(parseStellarXdr(env, xdr, network));

  if (sourceAddress && transaction.source !== sourceAddress) {
    throw makeError('XDR does not use the selected wallet as source', 403);
  }

  const operations = (
    (transaction.operations || []) as Array<Record<string, any>>
  ).map(summarizeOperation);
  const warnings: string[] = [];

  if (operations.length > 1) {
    warnings.push(`This transaction contains ${operations.length} operations.`);
  }

  if (Number(transaction.fee) > Number(BASE_FEE) * Math.max(1, operations.length) * 10) {
    warnings.push('This transaction uses a higher than usual Stellar network fee.');
  }

  return {
    fee: transaction.fee,
    memo: transaction.memo?.value
      ? transaction.memo.value.toString()
      : null,
    network,
    operationCount: operations.length,
    operations,
    sequence: transaction.sequence,
    source: transaction.source,
    warnings,
  };
}

export async function signStellarXdr({
  env,
  network,
  sourceAddress,
  submit = false,
  walletId,
  xdr,
}: {
  env: Env;
  network: StellarNetwork;
  sourceAddress: string;
  submit?: boolean;
  walletId: string;
  xdr: unknown;
}) {
  const transaction = requireClassicTransaction(parseStellarXdr(env, xdr, network));
  const review = reviewStellarXdr({
    env,
    network,
    sourceAddress,
    xdr,
  });
  const signatureHex = await signStellarTransaction(env, walletId, transaction);
  addPrivySignature(transaction, sourceAddress, signatureHex);

  if (!submit) {
    return {
      review,
      signedXdr: transaction.toEnvelope().toXDR('base64'),
      submitted: null,
    };
  }

  let submitted: Awaited<ReturnType<ReturnType<typeof getStellarServer>['submitTransaction']>>;

  try {
    submitted = await getStellarServer(env, network).submitTransaction(transaction);
  } catch (error) {
    const status =
      Number(getNestedValue(error, ['response', 'status'])) ||
      Number((error as { status?: number })?.status) ||
      400;

    throw makeError(
      getStellarSubmissionErrorMessage(
        error,
        'Stellar could not submit this transaction.',
      ),
      status,
    );
  }

  return {
    review,
    signedXdr: transaction.toEnvelope().toXDR('base64'),
    submitted,
  };
}

export async function buildAccountSession(
  env: Env,
  account: AccountRecord,
  preferredNetwork: StellarNetwork,
) {
  const normalizedAccount = await saveAccount(
    env,
    normalizeAccountWallets(account, preferredNetwork),
  );
  const visibleWallets = getVisibleWallets(normalizedAccount);
  const activeWallet = normalizedAccount.wallet;

  if (!activeWallet?.address) {
    throw makeError('Account does not have a Stellar wallet yet', 500);
  }

  const network = activeWallet.network || preferredNetwork;
  const balanceResult = await getAccountBalances(env, activeWallet.address, network);
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
    kyc: await getKycSummaryForAccount(env, normalizedAccount.email),
    network,
    transactions: await getAccountHistory(env, activeWallet.address, network),
    wallets: visibleWallets,
  };
}

export function buildSubmittedTransactionItem({
  amount,
  assetCode,
  assetIssuer,
  direction = 'sent',
  env,
  from,
  network,
  operation,
  submitted,
  to,
}: {
  amount: string;
  assetCode: string;
  assetIssuer?: string | null;
  direction?: string;
  env: Env;
  from: string;
  network: StellarNetwork;
  operation: string;
  submitted: { hash: string; ledger?: number };
  to: string;
}) {
  return {
    id: submitted.hash,
    amount,
    assetCode,
    assetIssuer: assetIssuer || null,
    createdAt: nowIso(),
    direction,
    explorerUrl: getExplorerUrl(env, network, 'tx', submitted.hash),
    from,
    hash: submitted.hash,
    ledger: submitted.ledger,
    network,
    operation,
    to,
  };
}

export async function readJsonBody(c: Context<WorkerBindings>) {
  try {
    return (await c.req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
