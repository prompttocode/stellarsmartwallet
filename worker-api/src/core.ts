import { type Context } from 'hono';
import { PrivyClient } from '@privy-io/node';
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

export type Env = {
  ALLOWED_ORIGINS?: string;
  DB: D1Database;
  FRIENDBOT_URL: string;
  HORIZON_MAINNET_URL: string;
  HORIZON_TESTNET_URL: string;
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

export type AssetDefinition = {
  assetCode: string;
  assetIssuer: string | null;
  demo: boolean;
  displayName: string;
  homeDomain?: string | null;
  iconKey?: string;
  isNative: boolean;
  network: StellarNetwork;
  trustLevel: 'verified' | 'discovered' | 'unverified';
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
export const DEMO_ASSET_CODES = ['USDC', 'USDT'];
export const DEMO_NFT_ASSET_CODE = 'SOWNFT';
export const DEMO_SWAP_RATES: Record<string, number> = {
  'USDC:XLM': 8.2,
  'USDC:USDT': 0.99,
  'USDT:USDC': 1.01,
  'USDT:XLM': 8.1,
  'XLM:USDC': 0.12,
  'XLM:USDT': 0.12,
};
export const KNOWN_ASSET_CASES = new Map(
  ['AQUA', 'EURC', 'PYUSD', 'USDC', 'USDT', 'XLM'].map(code => [
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
    assetIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
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
  type: 'private_key' | 'seed_phrase' = 'private_key',
) {
  const wallets = (getPrivyClient(env) as any).wallets();
  const result =
    type === 'seed_phrase'
      ? await wallets.exportSeedPhrase(walletId, { export_type: 'client' })
      : await wallets.exportPrivateKey(walletId, { export_type: 'client' });

  return {
    secret:
      type === 'seed_phrase' ? result?.seed_phrase : result?.private_key,
  };
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

export function getTestnetAssetDefinitions(issuers: Record<string, DemoIssuer | null> = {}) {
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
    ...DEMO_ASSET_CODES.map(assetCode => ({
      assetCode,
      assetIssuer: issuers[assetCode]?.publicKey || null,
      demo: true,
      displayName: `${assetCode} demo`,
      homeDomain: 'demo.local',
      iconKey: assetCode.toLowerCase(),
      isNative: false,
      network: 'testnet' as StellarNetwork,
      trustLevel: 'verified' as const,
    })),
  ];
}

export function getKnownAssetDefinitions(
  networkValue: unknown,
  issuers: Record<string, DemoIssuer | null> = {},
): AssetDefinition[] {
  const network = normalizeNetwork(networkValue);

  if (network === 'mainnet') {
    return MAINNET_ASSETS;
  }

  return getTestnetAssetDefinitions(issuers);
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

export async function ensureDemoAssetIssuers(env: Env, networkValue: unknown) {
  const network = normalizeNetwork(networkValue);
  const issuers: Record<string, DemoIssuer | null> = {};

  if (network !== 'testnet') {
    return issuers;
  }

  for (const assetCode of DEMO_ASSET_CODES) {
    issuers[assetCode] = await ensureDemoAssetIssuer(env, assetCode, network);
  }

  return issuers;
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

export async function getSupportedAssets(env: Env, networkValue: unknown, options: { search?: unknown } = {}) {
  const network = normalizeNetwork(networkValue);

  if (network === 'mainnet') {
    return filterAssetsBySearch(getKnownAssetDefinitions(network), options.search);
  }

  const issuers = await ensureDemoAssetIssuers(env, network);

  return filterAssetsBySearch(getKnownAssetDefinitions(network, issuers), options.search);
}

export async function getSupportedAsset(
  env: Env,
  input: { assetCode?: unknown; assetIssuer?: unknown; network: StellarNetwork },
) {
  const normalized = normalizeAssetCode(input.assetCode);
  const assetIssuer = String(input.assetIssuer || '').trim();
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

export function getDemoSwapRate(fromAssetCode: unknown, toAssetCode: unknown) {
  const from = normalizeAssetCode(fromAssetCode);
  const to = normalizeAssetCode(toAssetCode);

  if (from === to) {
    throw makeError('Choose two different tokens to swap', 400);
  }

  if (
    !getKnownAssetDefinitions('testnet').some(asset => asset.assetCode === from) ||
    !getKnownAssetDefinitions('testnet').some(asset => asset.assetCode === to)
  ) {
    throw makeError('Token is not supported', 400);
  }

  return DEMO_SWAP_RATES[`${from}:${to}`] || 1;
}

export function getNativeBalance(account: Awaited<ReturnType<typeof loadAccount>>) {
  if (!account) {
    return '0';
  }

  const balances = account.balances as Array<Record<string, any>>;

  return balances.find(balance => balance.asset_type === 'native')?.balance || '0';
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
      return {
        ...asset,
        balance: getNativeBalance(account),
        exists: Boolean(account),
        trusted: Boolean(account),
      };
    }

    const balance = findIssuedBalance(account, asset.assetCode, asset.assetIssuer);

    return {
      ...asset,
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
  network,
  sourceAccount,
}: {
  amount: string;
  asset: Asset | null;
  destination: string;
  destinationAccount: Awaited<ReturnType<typeof loadAccount>>;
  env: Env;
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

  return getStellarServer(env, network).submitTransaction(transaction);
}

export async function fundDemoAsset({
  amount,
  assetCode,
  destination,
  env,
  network,
}: {
  amount: unknown;
  assetCode: unknown;
  destination: string;
  env: Env;
  network: StellarNetwork;
}) {
  const value = assertAmount(amount || '100');
  const assetDefinition = await getSupportedAsset(env, {
    assetCode,
    network,
  });

  if (network !== 'testnet') {
    throw makeError('Mainnet does not support demo token funding', 400);
  }

  if (assetDefinition.isNative) {
    throw makeError('Test XLM uses the dedicated XLM funding endpoint', 400);
  }

  const destinationAccount = await loadAccount(env, destination, network);

  if (!destinationAccount) {
    throw makeError('Recipient wallet does not exist on Stellar Testnet', 400);
  }

  ensureTrustline(destinationAccount, assetDefinition, 'Recipient wallet');

  const issuer = await ensureDemoAssetIssuer(env, assetDefinition.assetCode, network);

  if (!issuer) {
    throw makeError('Demo issuer is not available', 500);
  }

  const issuerAccount = await loadAccount(env, issuer.publicKey, network);

  if (!issuerAccount) {
    throw makeError('Demo issuer is not active', 500);
  }

  const { transaction } = buildPaymentTransaction({
    amount: value,
    asset: getIssuedAsset(assetDefinition),
    destination,
    destinationAccount,
    env,
    network,
    sourceAccount: issuerAccount,
  });

  transaction.sign(Keypair.fromSecret(issuer.secret));

  return getStellarServer(env, network).submitTransaction(transaction);
}

export async function quoteDemoSwap(
  env: Env,
  {
    amount,
    fromAssetCode,
    toAssetCode,
  }: {
    amount: unknown;
    fromAssetCode: unknown;
    toAssetCode: unknown;
  },
) {
  const fromDefinition = await getSupportedAsset(env, {
    assetCode: fromAssetCode,
    network: 'testnet',
  });
  const toDefinition = await getSupportedAsset(env, {
    assetCode: toAssetCode,
    network: 'testnet',
  });
  const fromAmount = assertAmount(amount);
  const rate = getDemoSwapRate(fromDefinition.assetCode, toDefinition.assetCode);
  const toAmount = formatStellarAmount(Number(fromAmount) * rate);

  return {
    destMin: toAmount,
    fromAmount,
    fromAssetCode: fromDefinition.assetCode,
    fromAssetIssuer: fromDefinition.assetIssuer,
    rate,
    simulated: true,
    toAmount,
    toAssetCode: toDefinition.assetCode,
    toAssetIssuer: toDefinition.assetIssuer,
  };
}

export async function swapDemoAsset(
  env: Env,
  {
    amount,
    fromAssetCode,
    sourceAddress,
    sourceWalletId,
    toAssetCode,
  }: {
    amount: unknown;
    fromAssetCode: unknown;
    sourceAddress: string;
    sourceWalletId: string;
    toAssetCode: unknown;
  },
) {
  if (!sourceWalletId) {
    throw makeError('Missing Privy wallet id for swap', 400);
  }

  const fromDefinition = await getSupportedAsset(env, {
    assetCode: fromAssetCode,
    network: 'testnet',
  });
  const toDefinition = await getSupportedAsset(env, {
    assetCode: toAssetCode,
    network: 'testnet',
  });
  const fromAmount = assertAmount(amount);
  const rate = getDemoSwapRate(fromDefinition.assetCode, toDefinition.assetCode);
  const toAmount = formatStellarAmount(Number(fromAmount) * rate);
  const sourceAccount = await loadAccount(env, sourceAddress, 'testnet');

  if (!sourceAccount) {
    throw makeError(
      'Wallet does not exist on Stellar Testnet. Fund test XLM first.',
      400,
    );
  }

  ensureTrustline(sourceAccount, fromDefinition, 'Source wallet');
  ensureTrustline(sourceAccount, toDefinition, 'Recipient wallet');

  const payoutIssuer = toDefinition.isNative
    ? await ensureDemoAssetIssuer(
        env,
        fromDefinition.isNative ? DEMO_ASSET_CODES[0] : fromDefinition.assetCode,
      )
    : await ensureDemoAssetIssuer(env, toDefinition.assetCode);

  if (!payoutIssuer) {
    throw makeError('Demo payout issuer is not available', 500);
  }

  const collectorAddress = fromDefinition.isNative
    ? payoutIssuer.publicKey
    : fromDefinition.assetIssuer;
  const config = getNetworkConfig(env, 'testnet');
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(
      Operation.payment({
        amount: fromAmount,
        asset: getAssetForOperation(fromDefinition),
        destination: collectorAddress || payoutIssuer.publicKey,
      }),
    )
    .addOperation(
      Operation.payment({
        amount: toAmount,
        asset: getAssetForOperation(toDefinition),
        destination: sourceAddress,
        source: payoutIssuer.publicKey,
      }),
    )
    .setTimeout(60)
    .build();

  transaction.sign(Keypair.fromSecret(payoutIssuer.secret));

  const submitted = await submitPrivySignedTransaction({
    env,
    network: 'testnet',
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

export function parsePathAsset(assetRecord: Record<string, any>) {
  if (assetRecord.asset_type === 'native') {
    return Asset.native();
  }

  return new Asset(assetRecord.asset_code, assetRecord.asset_issuer);
}

export async function quoteMainnetSwap(
  env: Env,
  {
    amount,
    fromAssetCode,
    fromAssetIssuer,
    sourceAddress,
    toAssetCode,
    toAssetIssuer,
  }: {
    amount: unknown;
    fromAssetCode: unknown;
    fromAssetIssuer?: unknown;
    sourceAddress: string;
    toAssetCode: unknown;
    toAssetIssuer?: unknown;
  },
) {
  const network: StellarNetwork = 'mainnet';
  const sendAmount = assertAmount(amount);
  const sourceAccount = await loadAccount(env, sourceAddress, network);

  if (!sourceAccount) {
    throw makeError(
      'Mainnet wallet is not active. Deposit real XLM before swapping.',
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
  ensureTrustline(sourceAccount, toDefinition, 'Recipient wallet');

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

export async function executeMainnetSwap(
  env: Env,
  {
    amount,
    fromAssetCode,
    fromAssetIssuer,
    sourceAddress,
    sourceWalletId,
    toAssetCode,
    toAssetIssuer,
  }: {
    amount: unknown;
    fromAssetCode: unknown;
    fromAssetIssuer?: unknown;
    sourceAddress: string;
    sourceWalletId: string;
    toAssetCode: unknown;
    toAssetIssuer?: unknown;
  },
) {
  if (!sourceWalletId) {
    throw makeError('Missing Privy wallet id for swap', 400);
  }

  const network: StellarNetwork = 'mainnet';
  const quote = await quoteMainnetSwap(env, {
    amount,
    fromAssetCode,
    fromAssetIssuer,
    sourceAddress,
    toAssetCode,
    toAssetIssuer,
  });
  const sourceAccount = await loadAccount(env, sourceAddress, network);

  if (!sourceAccount) {
    throw makeError('Mainnet wallet is not active. Deposit real XLM first.', 400);
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

export function summarizeOperation(operation: Record<string, any>) {
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

  return {
    fee: transaction.fee,
    memo: transaction.memo?.value || null,
    network,
    operationCount: transaction.operations?.length || 0,
    operations: ((transaction.operations || []) as Array<Record<string, any>>).map(
      summarizeOperation,
    ),
    sequence: transaction.sequence,
    source: transaction.source,
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

  const submitted = await getStellarServer(env, network).submitTransaction(transaction);

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
