import type { KycSummary, StellarNetwork } from '@app-types';

export const LEGACY_LOCAL_SESSION_STORAGE_KEYS = [
  'lobstr-demo-session-email',
  'lobstr-demo-session-network',
];

export const ACTIVE_WALLET_STORAGE_PREFIX = 'privy-wallet-active-wallet-v1';
export const PREFERRED_NETWORK_STORAGE_KEY = 'privy-wallet-preferred-network';
export const RAMP_ORDER_STORAGE_PREFIX = 'privy-ramp-order';
export const SESSION_CACHE_STORAGE_PREFIX = 'privy-wallet-session-cache-v1';
export const SESSION_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const MARKET_PRICE_REFRESH_MS = 60_000;
export const ASSETS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const TRANSACTIONS_CACHE_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_NETWORK: StellarNetwork = 'mainnet';
export const DEFAULT_KYC: KycSummary = { status: 'not_started' };
export const TRUSTLINE_ENABLE_TIMEOUT_MS = 30_000;
export const TRUSTLINE_SIGN_TIMEOUT_MS = 15_000;
export const IMPORT_WALLET_TIMEOUT_MS = 8_000;
export const PRIVY_SECURITY_SESSION_TIMEOUT_MS = 8_000;
