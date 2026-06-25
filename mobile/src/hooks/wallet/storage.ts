import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionResponse, StellarNetwork } from '@app-types';
import {
  ACTIVE_WALLET_STORAGE_PREFIX,
  SESSION_CACHE_MAX_AGE_MS,
  SESSION_CACHE_STORAGE_PREFIX,
} from './constants';

type CachedWalletSession = {
  network: StellarNetwork;
  savedAt: number;
  session: SessionResponse;
  userKey: string;
};

export function getActiveWalletStorageKey(
  accountEmail: string,
  targetNetwork: StellarNetwork,
) {
  return `${ACTIVE_WALLET_STORAGE_PREFIX}:${accountEmail
    .trim()
    .toLowerCase()}:${targetNetwork}`;
}

export async function readStoredActiveWalletId(
  accountEmail: string,
  targetNetwork: StellarNetwork,
) {
  if (!accountEmail) {
    return null;
  }

  return AsyncStorage.getItem(
    getActiveWalletStorageKey(accountEmail, targetNetwork),
  );
}

export async function rememberActiveWalletId(
  accountEmail: string,
  targetNetwork: StellarNetwork,
  walletId: string,
) {
  if (!accountEmail || !walletId) {
    return;
  }

  await AsyncStorage.setItem(
    getActiveWalletStorageKey(accountEmail, targetNetwork),
    walletId,
  );
}

function getSessionCacheKey(userKey: string, network: StellarNetwork) {
  return `${SESSION_CACHE_STORAGE_PREFIX}:${encodeURIComponent(
    userKey,
  )}:${network}`;
}

export async function readCachedSession(
  userKey: string,
  network: StellarNetwork,
): Promise<CachedWalletSession | null> {
  const raw = await AsyncStorage.getItem(getSessionCacheKey(userKey, network));

  if (!raw) {
    return null;
  }

  try {
    const cached = JSON.parse(raw) as CachedWalletSession;

    if (
      cached.userKey !== userKey ||
      cached.network !== network ||
      !cached.session?.account ||
      Date.now() - Number(cached.savedAt || 0) > SESSION_CACHE_MAX_AGE_MS
    ) {
      await AsyncStorage.removeItem(getSessionCacheKey(userKey, network));
      return null;
    }

    return cached;
  } catch {
    await AsyncStorage.removeItem(getSessionCacheKey(userKey, network));
    return null;
  }
}

export async function writeCachedSession(
  session: SessionResponse,
  userKeyHint: string | null,
  network: StellarNetwork,
) {
  const cacheUserKey = userKeyHint || session.account.id;

  if (!cacheUserKey) {
    return;
  }

  const cached: CachedWalletSession = {
    network,
    savedAt: Date.now(),
    session,
    userKey: cacheUserKey,
  };

  await AsyncStorage.setItem(
    getSessionCacheKey(cacheUserKey, network),
    JSON.stringify(cached),
  );
}

export async function clearCachedSessions(userKey?: string | null) {
  const keys = await AsyncStorage.getAllKeys();
  const prefix = userKey
    ? `${SESSION_CACHE_STORAGE_PREFIX}:${encodeURIComponent(userKey)}:`
    : `${SESSION_CACHE_STORAGE_PREFIX}:`;
  const sessionKeys = keys.filter(key => key.startsWith(prefix));

  if (sessionKeys.length > 0) {
    await AsyncStorage.multiRemove(sessionKeys);
  }
}

export function getAssetsCacheKey(targetNetwork: StellarNetwork) {
  return `assets:${targetNetwork}`;
}

export function getTransactionsCacheKey(
  walletAddress: string,
  targetNetwork: StellarNetwork,
) {
  return `transactions:${targetNetwork}:${walletAddress}`;
}
