import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBiometrics from 'react-native-biometrics';
import {
  useIdentityToken,
  useLoginWithEmail,
  useLoginWithOAuth,
  usePrivy,
} from '@privy-io/expo';
import { useCreateWallet as useCreateExtendedWallet } from '@privy-io/expo/extended-chains';
import { api } from '@api/client';
import { API_BASE_URL, PRIVY_WEB_EXPORT_CLIENT_ID } from '@config';
import type {
  AssetItem,
  AssetsResponse,
  Balance,
  BalanceItem,
  CollectibleItem,
  CollectiblesResponse,
  Contact,
  WalletAccount,
  FundNftResult,
  Health,
  KycApiResponse,
  KycSummary,
  RampApiResponse,
  RampAssetCode,
  RampDirection,
  RampOrder,
  RampOrderHistoryResponse,
  RampPaymentInfo,
  RampProvider,
  RampProvidersResponse,
  RampQuote,
  ReceiverResponse,
  SendResult,
  SessionResponse,
  StellarNetwork,
  StellarNetworkInfo,
  SwapQuoteResult,
  SwapResult,
  TransactionItem,
  TransactionHistoryResponse,
  TrustlineResult,
  Wallet,
  WalletConnectConfig,
} from '@app-types';
import { formatTokenAmount, getErrorMessage, isEmailLike } from '@utils/format';
import { isRampOrderTerminal } from '@utils/ramp';

type RunOptions = {
  showAlert?: boolean;
};

type ErrorDialogState = {
  message: string;
  title: string;
};

const LEGACY_LOCAL_SESSION_STORAGE_KEYS = [
  'lobstr-demo-session-email',
  'lobstr-demo-session-network',
];
const PREFERRED_NETWORK_STORAGE_KEY = 'privy-wallet-preferred-network';
const RAMP_ORDER_STORAGE_PREFIX = 'privy-ramp-order';
const SESSION_CACHE_STORAGE_PREFIX = 'privy-wallet-session-cache-v1';
const SESSION_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MARKET_PRICE_REFRESH_MS = 60_000;
const DEFAULT_NETWORK: StellarNetwork = 'mainnet';
const DEFAULT_KYC: KycSummary = { status: 'not_started' };

type CachedWalletSession = {
  network: StellarNetwork;
  savedAt: number;
  session: SessionResponse;
  userKey: string;
};

type ApplySessionOptions = {
  cache?: boolean;
  source?: 'cache' | 'server';
};

type FinishPrivySessionOptions = {
  cache?: boolean;
  message?: string;
  privyUser?: unknown;
};

type ClientStellarWalletPayload = {
  address: string;
  chain_type: string;
  id: string;
  public_key: string;
};

type SessionStatusResponse = {
  email: string;
  exists: boolean;
  hasNetworkWallet: boolean;
  network: StellarNetwork;
  walletCount: number;
};

type SessionBootstrapWalletRequest = {
  key: string;
  promise: Promise<ClientStellarWalletPayload | undefined>;
};

function getAssetIdentity(asset: AssetItem) {
  return asset.isNative
    ? `${asset.network}:native`
    : `${asset.network}:${asset.assetCode}:${asset.assetIssuer || ''}`;
}

function hasMarketPrice(asset: AssetItem) {
  return (
    typeof asset.priceUsd === 'number' &&
    Number.isFinite(asset.priceUsd) &&
    asset.priceUsd > 0
  );
}

function mergeAssetMarketData(
  nextAssets: AssetItem[],
  previousAssets: AssetItem[],
) {
  const previousByIdentity = new Map(
    previousAssets.map(asset => [getAssetIdentity(asset), asset]),
  );

  return nextAssets.map(asset => {
    const previous = previousByIdentity.get(getAssetIdentity(asset));

    return {
      ...asset,
      image: asset.image || previous?.image || null,
      priceUsd: hasMarketPrice(asset)
        ? asset.priceUsd
        : previous?.priceUsd ?? null,
      rating: asset.rating ?? previous?.rating ?? null,
      volume7d: asset.volume7d ?? previous?.volume7d ?? null,
    };
  });
}

function applyReferenceMarketPrices(
  testnetAssets: AssetItem[],
  mainnetAssets: AssetItem[],
) {
  const nativeReference = mainnetAssets.find(
    asset => asset.isNative && hasMarketPrice(asset),
  );
  const referencesByCode = new Map<string, AssetItem>();

  for (const asset of mainnetAssets) {
    if (!hasMarketPrice(asset) || referencesByCode.has(asset.assetCode)) {
      continue;
    }

    referencesByCode.set(asset.assetCode, asset);
  }

  return testnetAssets.map(asset => {
    const reference = asset.isNative
      ? nativeReference
      : referencesByCode.get(asset.assetCode);

    if (!reference) {
      return asset;
    }

    return {
      ...asset,
      image: asset.image || reference.image || null,
      priceUsd: reference.priceUsd ?? asset.priceUsd ?? null,
      rating: asset.rating ?? reference.rating ?? null,
      volume7d: reference.volume7d ?? asset.volume7d ?? null,
    };
  });
}

function mergePopulatedFields<T extends object>(
  previous?: T,
  next?: T,
): T | undefined {
  if (!previous && !next) {
    return undefined;
  }

  const result = { ...(previous || {}) } as T;

  for (const [key, value] of Object.entries(next || {})) {
    if (value !== undefined && value !== null && value !== '') {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

type PrivyLinkedEmailAccount = {
  type?: string;
  address?: string;
  chain_type?: string;
  chainType?: string;
  email?: string;
  wallet_client_type?: string;
  walletClientType?: string;
};

type PrivyUserLike = {
  id?: string;
  email?: string;
  linked_accounts?: PrivyLinkedEmailAccount[];
  linkedAccounts?: PrivyLinkedEmailAccount[];
};

function getPrivyUserKey(userValue: unknown) {
  const currentUser = userValue as PrivyUserLike | null;

  return currentUser?.id || null;
}

function getEmailFromPrivyUser(userValue: unknown) {
  const currentUser = userValue as PrivyUserLike | null;

  if (!currentUser) {
    return '';
  }

  if (currentUser.email) {
    return currentUser.email.trim().toLowerCase();
  }

  const linkedAccounts =
    currentUser.linked_accounts || currentUser.linkedAccounts || [];
  const emailAccount =
    linkedAccounts.find(
      account => account.type === 'email' && (account.address || account.email),
    ) || linkedAccounts.find(account => account.address || account.email);

  return (emailAccount?.address || emailAccount?.email || '')
    .trim()
    .toLowerCase();
}

function hasLinkedStellarEmbeddedWallet(userValue: unknown) {
  const currentUser = userValue as PrivyUserLike | null;
  const linkedAccounts =
    currentUser?.linked_accounts || currentUser?.linkedAccounts || [];

  return linkedAccounts.some(account => {
    const type = String(account.type || '').toLowerCase();
    const chainType = String(
      account.chain_type || account.chainType || '',
    ).toLowerCase();
    const walletClientType = String(
      account.wallet_client_type || account.walletClientType || '',
    ).toLowerCase();
    const address = String(account.address || '').trim();

    return (
      type === 'wallet' &&
      (chainType === 'stellar' || address.startsWith('G')) &&
      (!walletClientType || walletClientType === 'privy')
    );
  });
}

function walletRecordToClientPayload(
  walletValue: Wallet | null | undefined,
): ClientStellarWalletPayload | undefined {
  if (
    !walletValue ||
    walletValue.kind !== 'privy' ||
    !walletValue.id ||
    !walletValue.address
  ) {
    return undefined;
  }

  return {
    address: walletValue.address,
    chain_type: walletValue.chainType || 'stellar',
    id: walletValue.id,
    public_key: walletValue.publicKey || walletValue.address,
  };
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTokenWithRetry(getToken: () => Promise<string | null>) {
  for (const delay of [0, 300, 700, 1200, 2000]) {
    if (delay > 0) {
      await wait(delay);
    }

    const token = await getToken().catch(() => null);

    if (token) {
      return token;
    }
  }

  return null;
}

function getSessionCacheKey(userKey: string, network: StellarNetwork) {
  return `${SESSION_CACHE_STORAGE_PREFIX}:${encodeURIComponent(
    userKey,
  )}:${network}`;
}

async function readCachedSession(
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

async function writeCachedSession(
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

async function clearCachedSessions(userKey?: string | null) {
  const keys = await AsyncStorage.getAllKeys();
  const prefix = userKey
    ? `${SESSION_CACHE_STORAGE_PREFIX}:${encodeURIComponent(userKey)}:`
    : `${SESSION_CACHE_STORAGE_PREFIX}:`;
  const sessionKeys = keys.filter(key => key.startsWith(prefix));

  if (sessionKeys.length > 0) {
    await AsyncStorage.multiRemove(sessionKeys);
  }
}

export function getBalanceForAsset(balances: BalanceItem[], assetCode: string) {
  return balances.find(balance => balance.assetCode === assetCode) || null;
}

export function getBalanceAmount(balances: BalanceItem[], assetCode: string) {
  return getBalanceForAsset(balances, assetCode)?.balance || '0';
}

function isStellarNetwork(value: unknown): value is StellarNetwork {
  return value === 'mainnet' || value === 'testnet';
}

export function getTransactionTitle(transaction: TransactionItem) {
  if (transaction.operation === 'change_trust') {
    return `Added ${transaction.assetCode} trustline`;
  }

  const verb = transaction.direction === 'received' ? 'Received' : 'Sent';

  return `${verb} ${transaction.assetCode}`;
}

export function getTransactionIcon(transaction: TransactionItem) {
  if (transaction.operation === 'change_trust') {
    return '+';
  }

  return transaction.direction === 'received' ? '↓' : '↑';
}

export function useWallet() {
  const [health, setHealth] = useState<Health | null>(null);
  const [network, setNetwork] = useState<StellarNetwork>(DEFAULT_NETWORK);
  const [preferredNetworkLoaded, setPreferredNetworkLoaded] = useState(false);
  const [networks, setNetworks] = useState<StellarNetworkInfo[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [assetPricesUpdatedAt, setAssetPricesUpdatedAt] = useState<
    number | null
  >(null);
  const [collectibles, setCollectibles] = useState<CollectibleItem[]>([]);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [kyc, setKyc] = useState<KycSummary>(DEFAULT_KYC);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [recipient, setRecipient] = useState('');
  const [recipientContact, setRecipientContact] = useState<Contact | null>(
    null,
  );
  const [recipientBalances, setRecipientBalances] = useState<BalanceItem[]>([]);
  const [amount, setAmount] = useState('1');
  const [selectedAssetCode, setSelectedAssetCode] = useState('XLM');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [errorDialog, setErrorDialog] = useState<ErrorDialogState | null>(
    null,
  );
  const [message, setMessage] = useState(
    'Enter your email to receive a Privy login code.',
  );
  const [rampProviders, setRampProviders] = useState<RampProvider[]>([]);
  const [activeRampOrder, setActiveRampOrder] = useState<RampOrder | null>(
    null,
  );
  const [rampOrderHistory, setRampOrderHistory] = useState<RampOrder[]>([]);
  const [walletConnectConfig, setWalletConnectConfig] =
    useState<WalletConnectConfig | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [privySessionReady, setPrivySessionReady] = useState(false);
  const [serverSessionReady, setServerSessionReady] = useState(false);
  const [sessionSyncing, setSessionSyncing] = useState(false);
  const [restoreAttemptedForUser, setRestoreAttemptedForUser] = useState<
    string | null
  >(null);
  const {
    user,
    isReady,
    error: privyError,
    logout: logoutPrivy,
  } = usePrivy();
  const { getIdentityToken } = useIdentityToken();
  const getIdentityTokenRef = useRef(getIdentityToken);
  const sessionBootstrapWalletRef =
    useRef<SessionBootstrapWalletRequest | null>(null);
  const {
    sendCode,
    loginWithCode,
    state: loginState,
  } = useLoginWithEmail({
    onSendCodeSuccess: () => {
      setCodeSent(true);
      setMessage('Privy sent a verification code to your email.');
    },
  });
  const { login: loginWithOAuth, state: oauthState } = useLoginWithOAuth();
  const { createWallet: createPrivyExtendedWallet } =
    useCreateExtendedWallet();

  const setPreferredNetwork = useCallback((nextNetwork: StellarNetwork) => {
    setNetwork(nextNetwork);
    AsyncStorage.setItem(PREFERRED_NETWORK_STORAGE_KEY, nextNetwork).catch(
      () => null,
    );
  }, []);

  const dismissErrorDialog = useCallback(() => {
    setErrorDialog(null);
  }, []);

  const showErrorDialog = useCallback((messageText: string, title = 'Error') => {
    setErrorDialog({
      message: messageText,
      title,
    });
  }, []);

  const run = useCallback(
    async <T>(
      label: string,
      action: () => Promise<T>,
      options: RunOptions = {},
    ) => {
      try {
        setBusy(label);
        if (options.showAlert !== false) {
          setErrorDialog(null);
        }

        return await action();
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        setMessage(errorMessage);

        if (options.showAlert !== false) {
          setBusy(null);
          setErrorDialog({
            message: errorMessage,
            title: 'Error',
          });
        }

        return null;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const checkServer = useCallback(async () => {
    try {
      const [
        result,
        networkResult,
        assetResult,
        rampResult,
        walletConnectResult,
      ] = await Promise.all([
        api<Health>('/api/health'),
        api<{ networks: StellarNetworkInfo[] }>('/api/networks'),
        api<AssetsResponse>(`/api/assets?network=${network}`),
        api<RampProvidersResponse>('/api/ramp/providers'),
        api<WalletConnectConfig>('/api/walletconnect/config'),
      ]);

      setHealth(result);
      setNetworks(networkResult.networks || result.networks || []);
      const nextAssets = assetResult.assets || [];
      setAssets(current => mergeAssetMarketData(nextAssets, current));
      setAssetPricesUpdatedAt(
        nextAssets.some(hasMarketPrice) ? Date.now() : null,
      );
      setRampProviders(rampResult.providers || []);
      setWalletConnectConfig(walletConnectResult);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }, [network]);

  useEffect(() => {
    if (preferredNetworkLoaded) {
      checkServer();
    }
  }, [checkServer, preferredNetworkLoaded]);

  useEffect(() => {
    AsyncStorage.multiRemove(LEGACY_LOCAL_SESSION_STORAGE_KEYS).catch(
      () => null,
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(PREFERRED_NETWORK_STORAGE_KEY)
      .then(value => {
        if (!cancelled && isStellarNetwork(value)) {
          setNetwork(value);
        }
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) {
          setPreferredNetworkLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isMainnet = network === 'mainnet';
  const accountWallets = account?.wallets || [];
  const allWallets =
    wallets.length > 0
      ? wallets
      : accountWallets.length > 0
      ? accountWallets
      : account?.wallet
      ? [account.wallet]
      : [];
  const networkWallets = allWallets.filter(item => item.network === network);
  const wallet =
    networkWallets.find(item => item.id === activeWalletId) ||
    networkWallets[0] ||
    null;
  const activeNetworkWalletId = wallet?.id || activeWalletId;
  const userKey = getPrivyUserKey(user);

  useEffect(() => {
    getIdentityTokenRef.current = getIdentityToken;
  }, [getIdentityToken]);
  const visibleAssets = assets.length > 0 ? assets : balances;
  const selectedBalance = getBalanceForAsset(balances, selectedAssetCode);
  const selectedAsset =
    visibleAssets.find(asset => asset.assetCode === selectedAssetCode) ||
    selectedBalance;
  const xlmBalance = getBalanceAmount(balances, 'XLM');
  const recipientSelectedBalance = getBalanceForAsset(
    recipientBalances,
    selectedAssetCode,
  );
  const explorerAddressUrl = wallet
    ? `https://stellar.expert/explorer/${
        network === 'mainnet' ? 'public' : 'testnet'
      }/account/${wallet.address}`
    : null;
  const walletCanSign = Boolean(wallet?.canSign && serverSessionReady);
  const walletSessionSyncing = Boolean(account && !serverSessionReady);
  const walletActive = Boolean(wallet && balances.some(item => item.exists));
  const rampOrderStorageKey =
    account && wallet
      ? `${RAMP_ORDER_STORAGE_PREFIX}:${account.id || account.email}:${
          wallet.id
        }:${network}`
      : null;

  const fetchTransactionHistory = useCallback(
    async (walletAddress: string, targetNetwork: StellarNetwork = network) => {
      const address = walletAddress.trim();

      if (!address) {
        return [];
      }

      const result = await api<TransactionHistoryResponse>(
        `/api/stellar/${targetNetwork}/${address}/history`,
      );

      return result.transactions || [];
    },
    [network],
  );

  const refreshAssetPrices = useCallback(async () => {
    try {
      const result = await api<AssetsResponse>(
        `/api/assets?network=${network}&limit=100`,
      );
      let nextAssets = result.assets || [];

      if (network === 'mainnet') {
        const fetchedIdentities = new Set(nextAssets.map(getAssetIdentity));
        const missingBalances = balances.filter(
          balance =>
            Number(balance.balance) > 0 &&
            !fetchedIdentities.has(getAssetIdentity(balance)),
        );
        const discoveredAssets = await Promise.all(
          missingBalances.map(async balance => {
            const search = balance.assetIssuer || balance.assetCode;

            try {
              const searchResult = await api<AssetsResponse>(
                `/api/assets?network=mainnet&limit=20&search=${encodeURIComponent(
                  search,
                )}`,
              );

              return (
                searchResult.assets?.find(
                  asset =>
                    getAssetIdentity(asset) === getAssetIdentity(balance),
                ) || null
              );
            } catch {
              return null;
            }
          }),
        );
        const byIdentity = new Map(
          nextAssets.map(asset => [getAssetIdentity(asset), asset]),
        );

        for (const discovered of discoveredAssets) {
          if (discovered) {
            byIdentity.set(getAssetIdentity(discovered), discovered);
          }
        }

        nextAssets = [...byIdentity.values()];
      } else {
        try {
          const referenceResult = await api<AssetsResponse>(
            '/api/assets?network=mainnet&limit=100',
          );

          nextAssets = applyReferenceMarketPrices(
            nextAssets,
            referenceResult.assets || [],
          );
        } catch {
          // Testnet can still work without reference prices.
        }
      }

      const receivedMarketPrices = nextAssets.some(hasMarketPrice);

      setAssets(current => {
        if (
          network === 'mainnet' &&
          !receivedMarketPrices &&
          current.some(hasMarketPrice)
        ) {
          return current;
        }

        return mergeAssetMarketData(nextAssets, current);
      });
      if (receivedMarketPrices) {
        setAssetPricesUpdatedAt(Date.now());
      }

      return nextAssets;
    } catch {
      return null;
    }
  }, [balances, network]);

  useEffect(() => {
    refreshAssetPrices();
    const timer = setInterval(refreshAssetPrices, MARKET_PRICE_REFRESH_MS);

    return () => clearInterval(timer);
  }, [network, refreshAssetPrices]);

  useEffect(() => {
    let cancelled = false;

    setActiveRampOrder(null);

    if (!rampOrderStorageKey) {
      return () => {
        cancelled = true;
      };
    }

    AsyncStorage.getItem(rampOrderStorageKey)
      .then(value => {
        if (!cancelled && value) {
          setActiveRampOrder(JSON.parse(value) as RampOrder);
        }
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [rampOrderStorageKey]);

  function resetRecipientState() {
    setRecipient('');
    setRecipientContact(null);
    setRecipientBalances([]);
  }

  async function loadCollectibles(
    walletAddress: string | undefined,
    targetNetwork: StellarNetwork,
  ) {
    if (!walletAddress) {
      setCollectibles([]);
      return [];
    }

    const result = await api<CollectiblesResponse>(
      `/api/collectibles?network=${targetNetwork}&address=${walletAddress}`,
    );

    setCollectibles(result.collectibles || []);

    return result.collectibles || [];
  }

  function clearWalletSession(nextMessage?: string) {
    setAccount(null);
    setKyc(DEFAULT_KYC);
    setWallets([]);
    setActiveWalletId(null);
    setBalances([]);
    setCollectibles([]);
    resetRecipientState();
    setTransactions([]);
    setActiveRampOrder(null);
    setRampOrderHistory([]);
    setCode('');
    setCodeSent(false);
    setServerSessionReady(false);
    setSessionSyncing(false);
    sessionBootstrapWalletRef.current = null;
    setRestoreAttemptedForUser(null);

    if (nextMessage) {
      setMessage(nextMessage);
    }
  }

  const applySession = useCallback(
    (
      session: SessionResponse,
      nextMessage = 'Your Stellar wallet is ready.',
      options: ApplySessionOptions = {},
    ) => {
      const sessionWallets =
        session.wallets ||
        session.account.wallets ||
        (session.account.wallet ? [session.account.wallet] : []);
      const nextActiveWalletId =
        session.activeWalletId ||
        session.account.activeWalletId ||
        session.account.wallet?.id ||
        null;

      const sessionNetwork =
        session.network || session.account.wallet?.network || network;

      setPreferredNetwork(sessionNetwork);
      setEmail(session.account.email);
      setAccount(session.account);
      setKyc(session.kyc || DEFAULT_KYC);
      setWallets(sessionWallets);
      setActiveWalletId(nextActiveWalletId);
      setBalances(session.balances || session.balance.balances || []);
      setTransactions(session.transactions || []);
      setServerSessionReady(options.source !== 'cache');
      setMessage(nextMessage);

      if (options.source !== 'cache' && options.cache !== false) {
        writeCachedSession(session, userKey, sessionNetwork).catch(() => null);
      }
    },
    [network, setPreferredNetwork, userKey],
  );

  useEffect(() => {
    if (!wallet?.address) {
      setCollectibles([]);
      return;
    }

    let cancelled = false;

    api<CollectiblesResponse>(
      `/api/collectibles?network=${network}&address=${wallet.address}`,
    )
      .then(result => {
        if (!cancelled) {
          setCollectibles(result.collectibles || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCollectibles([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [network, wallet?.address]);

  useEffect(() => {
    const address = wallet?.address;

    if (!address) {
      setTransactions([]);
      return;
    }

    let cancelled = false;

    fetchTransactionHistory(address, network)
      .then(nextTransactions => {
        if (!cancelled) {
          setTransactions(nextTransactions);
        }
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [fetchTransactionHistory, network, wallet?.address]);

  const refreshPrivySecuritySession = useCallback(async () => {
    if (!isReady || !userKey) {
      setPrivySessionReady(false);
      return false;
    }

    const identityToken = await getTokenWithRetry(getIdentityTokenRef.current);
    const hasToken = Boolean(identityToken);

    setPrivySessionReady(hasToken);

    return hasToken;
  }, [isReady, userKey]);

  useEffect(() => {
    let cancelled = false;

    async function probePrivyToken() {
      if (!isReady || !userKey) {
        setPrivySessionReady(false);
        return;
      }

      const identityToken = await getTokenWithRetry(
        getIdentityTokenRef.current,
      );

      if (!cancelled) {
        setPrivySessionReady(Boolean(identityToken));
      }
    }

    probePrivyToken();

    return () => {
      cancelled = true;
    };
  }, [isReady, userKey]);

  async function getAuthHeaders(required = false) {
    if (!required) {
      return undefined;
    }

    const identityToken = await getTokenWithRetry(getIdentityToken);
    setPrivySessionReady(Boolean(identityToken));

    if (!identityToken && required) {
      throw new Error(
        'Privy session is not ready. Sign out and sign in again before using this security action.',
      );
    }

    return identityToken
      ? {
          Authorization: `Bearer ${identityToken}`,
        }
      : undefined;
  }

  async function createClientStellarWalletPayload(): Promise<ClientStellarWalletPayload> {
    const createdWallet = await createPrivyExtendedWallet({
      chainType: 'stellar',
    });

    return {
      address: createdWallet.wallet.address,
      chain_type: createdWallet.wallet.chain_type,
      id: createdWallet.wallet.id,
      public_key:
        createdWallet.wallet.public_key || createdWallet.wallet.address,
    };
  }

  async function getSessionBootstrapWallet(
    identityToken: string,
    sessionNetwork: StellarNetwork,
    privyUserValue: unknown,
  ) {
    const bootstrapUserKey =
      getPrivyUserKey(privyUserValue) ||
      userKey ||
      getEmailFromPrivyUser(privyUserValue) ||
      'unknown';
    const bootstrapKey = `${bootstrapUserKey}:${sessionNetwork}`;

    if (sessionBootstrapWalletRef.current?.key === bootstrapKey) {
      return sessionBootstrapWalletRef.current.promise;
    }

    const promise = (async () => {
      if (hasLinkedStellarEmbeddedWallet(privyUserValue)) {
        return undefined;
      }

      const status = await api<SessionStatusResponse>('/api/session/status', {
        method: 'POST',
        body: JSON.stringify({
          identityToken,
          network: sessionNetwork,
        }),
      });

      if (status.hasNetworkWallet) {
        return undefined;
      }

      return createClientStellarWalletPayload();
    })().catch(error => {
      if (sessionBootstrapWalletRef.current?.key === bootstrapKey) {
        sessionBootstrapWalletRef.current = null;
      }

      throw error;
    });

    sessionBootstrapWalletRef.current = {
      key: bootstrapKey,
      promise,
    };

    return promise;
  }

  function requireFreshServerSession() {
    if (serverSessionReady) {
      return;
    }

    throw new Error(
      sessionSyncing
        ? 'Your wallet session is still syncing with the server. Wait a moment, then try again.'
        : 'Your saved wallet is visible, but the server session is not synced yet. Refresh the wallet or sign in again before using this action.',
    );
  }

  async function refreshKycStatus() {
    return run(
      'Refreshing KYC status',
      async () => {
        requireFreshServerSession();
        const headers = await getAuthHeaders(true);
        const result = await api<KycApiResponse>('/api/kyc/status', {
          headers,
        });
        const nextKyc = result.data || DEFAULT_KYC;

        setKyc(nextKyc);

        return nextKyc;
      },
      { showAlert: false },
    );
  }

  async function submitKycIdCard({
    imageBackBase64,
    imageFrontBase64,
    phone,
  }: {
    imageBackBase64: string;
    imageFrontBase64: string;
    phone?: string;
  }) {
    if (!account) {
      throw new Error('Sign in before verifying your identity.');
    }

    return run('Submitting KYC', async () => {
      requireFreshServerSession();
      const headers = await getAuthHeaders(true);
      const result = await api<KycApiResponse>('/api/kyc/id-card', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageBackBase64,
          imageFrontBase64,
          phone,
        }),
      });
      const nextKyc = result.data || DEFAULT_KYC;

      setKyc(nextKyc);
      setMessage('Identity verification completed.');

      return nextKyc;
    });
  }

  useEffect(() => {
    let cancelled = false;
    const accountEmail = account?.email;
    const walletAddress = wallet?.address;
    const walletId = wallet?.id;

    if (!accountEmail || !walletAddress || !walletId) {
      setRampOrderHistory(current => (current.length > 0 ? [] : current));
      return () => {
        cancelled = true;
      };
    }

    const historyAccountEmail = accountEmail;
    const historyWalletAddress = walletAddress;
    const historyWalletId = walletId;

    async function loadRampOrderHistory() {
      try {
        const identityToken = await getTokenWithRetry(
          getIdentityTokenRef.current,
        );
        const params = new URLSearchParams({
          email: historyAccountEmail,
          limit: '50',
          network,
          sourceAddress: historyWalletAddress,
          sourceWalletId: historyWalletId,
        });
        const result = await api<RampOrderHistoryResponse>(
          `/api/ramp/orders?${params.toString()}`,
          {
            headers: identityToken
              ? { Authorization: `Bearer ${identityToken}` }
              : undefined,
          },
        );

        if (!cancelled) {
          setRampOrderHistory(result.data.orders || []);
        }
      } catch {
        if (!cancelled) {
          setRampOrderHistory([]);
        }
      }
    }

    loadRampOrderHistory();

    return () => {
      cancelled = true;
    };
  }, [account?.email, network, wallet?.address, wallet?.id]);

  async function requireBiometric(promptMessage: string) {
    const rnBiometrics = new ReactNativeBiometrics();
    const { available } = await rnBiometrics.isSensorAvailable();

    if (!available) {
      return true;
    }

    const { success } = await rnBiometrics.simplePrompt({
      cancelButtonText: 'Cancel',
      promptMessage,
    });

    if (!success) {
      throw new Error('Biometric authentication failed.');
    }

    return true;
  }

  const finishPrivySession = useCallback(
    async (
      existingIdentityToken?: string,
      fallbackEmail?: string,
      sessionNetwork: StellarNetwork = network,
      options: FinishPrivySessionOptions = {},
    ) => {
      const identityToken =
        existingIdentityToken || (await getTokenWithRetry(getIdentityToken));
      const sessionEmail = String(fallbackEmail || '')
        .trim()
        .toLowerCase();

      if (!identityToken && !isEmailLike(sessionEmail)) {
        throw new Error(
          'Privy session is not ready or has expired. Please sign out and sign in again.',
        );
      }

      const bootstrapWallet = identityToken
        ? await getSessionBootstrapWallet(
            identityToken,
            sessionNetwork,
            options.privyUser || user,
          )
        : undefined;
      const session = identityToken
        ? await api<SessionResponse>('/api/session', {
            method: 'POST',
            body: JSON.stringify({
              identityToken,
              network: sessionNetwork,
              wallet: bootstrapWallet,
            }),
          })
        : await api<SessionResponse>('/api/session', {
            method: 'POST',
            body: JSON.stringify({
              email: sessionEmail,
              network: sessionNetwork,
            }),
          });

      applySession(session, options.message, {
        cache: options.cache,
        source: 'server',
      });
    },
    [applySession, getIdentityToken, network, user],
  );

  useEffect(() => {
    if (
      isReady &&
      user &&
      userKey &&
      !account &&
      restoreAttemptedForUser !== userKey
    ) {
      const restoreUserKey = userKey;

      setRestoreAttemptedForUser(restoreUserKey);
      let cancelled = false;

      async function restoreSession() {
        setSessionSyncing(true);

        const cached = await readCachedSession(restoreUserKey, network).catch(
          () => null,
        );

        if (cancelled) {
          return;
        }

        if (cached) {
          applySession(
            cached.session,
            'Wallet restored from this device. Syncing latest balances...',
            {
              cache: false,
              source: 'cache',
            },
          );
        } else {
          setMessage('Restoring your wallet session...');
        }

        try {
          await finishPrivySession(
            undefined,
            getEmailFromPrivyUser(user),
            network,
            { privyUser: user },
          );
        } catch (error) {
          if (!cancelled) {
            const errorMessage = getErrorMessage(error);
            setMessage(
              cached
                ? `Showing saved wallet state. Server sync failed: ${errorMessage}`
                : errorMessage,
            );
          }
        } finally {
          if (!cancelled) {
            setSessionSyncing(false);
          }
        }
      }

      restoreSession();

      return () => {
        cancelled = true;
      };
    }
  }, [
    finishPrivySession,
    applySession,
    isReady,
    network,
    restoreAttemptedForUser,
    user,
    userKey,
  ]);

  async function sendEmailCode() {
    return run('Sending Privy code', async () => {
      const targetEmail = email.trim().toLowerCase();

      if (!isEmailLike(targetEmail)) {
        throw new Error(
          'Enter a valid email to receive your Privy login code.',
        );
      }

      const currentPrivyEmail = getEmailFromPrivyUser(user);

      if (user && currentPrivyEmail === targetEmail) {
        const identityToken = await getTokenWithRetry(getIdentityToken);

        if (identityToken) {
          setEmail(targetEmail);
          setCode('');
          setCodeSent(false);
          await finishPrivySession(identityToken, undefined, network, {
            privyUser: user,
          });

          return true;
        }

        await signOutAndClearWalletSession();
      } else if (user) {
        await signOutAndClearWalletSession();
      }

      setEmail(targetEmail);
      setCode('');
      await sendCode({ email: targetEmail });

      return true;
    });
  }

  async function verifyCodeAndLogin() {
    await run('Verifying Privy code', async () => {
      const verificationCode = code.replace(/\D/g, '').slice(0, 6);

      if (verificationCode.length < 6) {
        throw new Error('Enter the 6-digit code Privy sent to your email.');
      }

      const targetEmail = email.trim().toLowerCase();
      const currentPrivyEmail = getEmailFromPrivyUser(user);

      if (user && currentPrivyEmail === targetEmail) {
        const identityToken = await getTokenWithRetry(getIdentityToken);

        if (identityToken) {
          setCode('');
          setCodeSent(false);
          await finishPrivySession(identityToken, undefined, network, {
            privyUser: user,
          });

          return;
        }

        await signOutAndClearWalletSession();
      } else if (user) {
        await signOutAndClearWalletSession();
      }

      const loginUser = await loginWithCode({
        email: targetEmail,
        code: verificationCode,
      });
      setCode('');
      setCodeSent(false);
      await finishPrivySession(undefined, targetEmail, network, {
        privyUser: loginUser || user,
      });
    });
  }

  async function loginWithGoogle() {
    await run('Sign in with Google', async () => {
      if (user) {
        await signOutAndClearWalletSession();
      }

      const oauthUser = await loginWithOAuth({
        provider: 'google',
        redirectUri: '/',
      });
      const identityToken = await getTokenWithRetry(getIdentityToken);
      const oauthEmail = getEmailFromPrivyUser(oauthUser);

      setCode('');
      setCodeSent(false);
      await finishPrivySession(identityToken || undefined, oauthEmail, network, {
        privyUser: oauthUser || user,
      });

      return true;
    });
  }

  function resetLoginCode() {
    setCode('');
    setCodeSent(false);
    setMessage('Enter your email to receive a Privy login code.');
  }

  async function signOutAndClearWalletSession(nextMessage?: string) {
    const cacheUserKey = userKey;

    await logoutPrivy();
    await clearCachedSessions(cacheUserKey).catch(() => null);
    clearWalletSession(nextMessage);
  }

  async function refreshSession() {
    if (!account) {
      return;
    }

    await run('Refreshing wallet', async () => {
      setSessionSyncing(true);

      try {
        const session = await api<SessionResponse>('/api/session', {
          method: 'POST',
          body: JSON.stringify({ email: account.email, network }),
        });
        applySession(session);
        const sessionWalletAddress = session.account.wallet?.address;

        if (sessionWalletAddress) {
          const nextTransactions = await fetchTransactionHistory(
            sessionWalletAddress,
            session.network || network,
          );
          setTransactions(nextTransactions);
        }

        setMessage('Balances and transaction history refreshed.');
      } finally {
        setSessionSyncing(false);
      }
    });
  }

  async function createWallet() {
    if (!account) {
      return null;
    }

    return run(
      isMainnet ? 'Creating Mainnet wallet' : 'Creating Testnet wallet',
      async () => {
        requireFreshServerSession();
        const headers = await getAuthHeaders(true);
        const createdWallet = await createClientStellarWalletPayload();
        const session = await api<SessionResponse>('/api/wallets', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            fund: !isMainnet,
            network,
            wallet: createdWallet,
          }),
        });

        resetRecipientState();
        applySession(
          session,
          isMainnet
            ? 'Mainnet wallet created. Deposit XLM to activate it.'
            : 'Wallet created and funded with test XLM.',
        );

        return session;
      },
    );
  }

  async function selectWallet(walletId: string) {
    if (!account || !walletId) {
      return null;
    }

    if (walletId === activeWalletId) {
      setMessage('This wallet is already selected.');
      return null;
    }

    return run('Switching wallet', async () => {
      requireFreshServerSession();
      const headers = await getAuthHeaders(true);
      const session = await api<SessionResponse>('/api/wallets/select', {
        method: 'POST',
        headers,
        body: JSON.stringify({ network, walletId }),
      });

      resetRecipientState();
      applySession(session, 'Active wallet switched.');

      return session;
    });
  }

  async function renameWallet(walletId: string, displayName: string) {
    if (!account || !walletId) {
      return null;
    }

    return run('Renaming wallet', async () => {
      requireFreshServerSession();
      const headers = await getAuthHeaders(true);
      const session = await api<SessionResponse>('/api/wallets/rename', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          displayName,
          network,
          walletId,
        }),
      });

      applySession(session, 'Wallet renamed.');

      return session;
    });
  }

  async function archiveWallet(walletId: string) {
    if (!account || !walletId) {
      return null;
    }

    return run('Archiving wallet', async () => {
      requireFreshServerSession();
      const headers = await getAuthHeaders(true);
      const session = await api<SessionResponse>('/api/wallets/archive', {
        method: 'POST',
        headers,
        body: JSON.stringify({ network, walletId }),
      });

      resetRecipientState();
      applySession(session, 'Wallet archived from the list.');

      return session;
    });
  }

  async function fundWallet() {
    if (!wallet) {
      return;
    }

    await run('Funding test XLM', async () => {
      requireFreshServerSession();
      if (isMainnet) {
        throw new Error(
          'Mainnet does not have Friendbot. Open Receive for your QR/address and deposit real XLM.',
        );
      }

      const result = await api<Balance>(`/api/stellar/${network}/fund`, {
        method: 'POST',
        body: JSON.stringify({ address: wallet.address }),
      });

      setBalances(result.balances || []);
      setTransactions(current => result.transactions || current);
      await loadCollectibles(wallet.address, network);
      setMessage('Test XLM funded from Stellar Testnet Friendbot.');
    });
  }

  async function ensureWalletTrustline(
    assetCode: string,
    assetIssuer?: string | null,
    options: { confirmMainnet?: boolean } = {},
  ) {
    if (!account || !wallet) {
      throw new Error('Create or select a wallet first.');
    }
    requireFreshServerSession();

    const assetDefinition =
      visibleAssets.find(
        asset =>
          asset.assetCode === assetCode &&
          (!assetIssuer || asset.assetIssuer === assetIssuer),
      ) || visibleAssets.find(asset => asset.assetCode === assetCode);

    if (!assetDefinition) {
      throw new Error(`${assetCode} is not available on Stellar ${network}.`);
    }

    if (assetDefinition.isNative) {
      return {
        alreadyTrusted: true,
        balances,
        network,
        transaction: null,
        transactions,
      } satisfies TrustlineResult;
    }

    const existingBalance = balances.find(
      balance =>
        balance.assetCode === assetDefinition.assetCode &&
        (balance.assetIssuer || null) === (assetDefinition.assetIssuer || null),
    );

    if (existingBalance?.trusted) {
      return {
        alreadyTrusted: true,
        balances,
        network,
        transaction: null,
        transactions,
      } satisfies TrustlineResult;
    }

    if (isMainnet && !walletActive) {
      throw new Error(
        'Deposit real XLM into this Mainnet wallet before enabling token receiving.',
      );
    }

    if (isMainnet && options.confirmMainnet) {
      await requireBiometric(
        `Confirm to enable receiving ${assetDefinition.assetCode} on Mainnet`,
      );
    }

    const headers = await getAuthHeaders(isMainnet);
    const result = await api<TrustlineResult>(
      `/api/stellar/${network}/trustline`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          accountId: account.id,
          assetCode: assetDefinition.assetCode,
          assetIssuer: assetIssuer || assetDefinition.assetIssuer || null,
          email: account.email,
          sourceAddress: wallet.address,
          sourceWalletId: wallet.id,
        }),
      },
    );

    setBalances(result.balances);
    setTransactions(result.transactions);
    await loadCollectibles(wallet.address, network);

    return result;
  }

  async function addTrustline(assetCode: string, assetIssuer?: string | null) {
    if (!wallet) {
      return;
    }

    await run(`Enabling ${assetCode}`, async () => {
      const result = await ensureWalletTrustline(assetCode, assetIssuer, {
        confirmMainnet: true,
      });

      setMessage(
        result.alreadyTrusted
          ? `${assetCode} receiving is already enabled.`
          : `${assetCode} receiving enabled.`,
      );
    });
  }

  async function fundTestUsdc() {
    if (!account || !wallet) {
      return null;
    }

    return run('Getting Testnet USDC', async () => {
      requireFreshServerSession();
      if (isMainnet) {
        throw new Error('Testnet USDC funding is not available on Mainnet.');
      }

      if (!walletActive) {
        throw new Error('Get Testnet XLM from Friendbot first.');
      }

      const usdc = visibleAssets.find(asset => asset.assetCode === 'USDC');

      if (!usdc?.assetIssuer) {
        throw new Error('Testnet USDC issuer is not configured.');
      }

      await ensureWalletTrustline('USDC', usdc.assetIssuer);

      const result = await api<SwapResult>(
        '/api/stellar/testnet/swap/execute',
        {
          method: 'POST',
          body: JSON.stringify({
            accountId: account.id,
            amount: '10',
            email: account.email,
            fromAssetCode: 'XLM',
            fromAssetIssuer: null,
            sourceAddress: wallet.address,
            sourceWalletId: wallet.id,
            toAssetCode: 'USDC',
            toAssetIssuer: usdc.assetIssuer,
          }),
        },
      );

      setBalances(result.balances);
      setTransactions(result.transactions);
      setMessage(
        `Swapped 10 Testnet XLM for ${formatTokenAmount(
          result.toAmount,
        )} USDC through Stellar.`,
      );

      return result;
    });
  }

  async function refreshCollectibles() {
    if (!wallet) {
      setCollectibles([]);
      return [];
    }

    return run(
      'Refreshing collectibles',
      () => loadCollectibles(wallet.address, network),
      { showAlert: false },
    );
  }

  async function claimDemoNft() {
    if (!account || !wallet) {
      return null;
    }

    return run('Claiming demo NFT', async () => {
      requireFreshServerSession();
      if (isMainnet) {
        throw new Error(
          'Demo NFT claiming is only available on Stellar Testnet.',
        );
      }

      const result = await api<FundNftResult>(
        `/api/stellar/${network}/fund-nft`,
        {
          method: 'POST',
          body: JSON.stringify({
            accountId: account.id,
            email: account.email,
            sourceAddress: wallet.address,
            sourceWalletId: wallet.id,
          }),
        },
      );

      setBalances(result.balances);
      setCollectibles(result.collectibles);
      setTransactions(result.transactions);
      setMessage(
        result.alreadyClaimed
          ? 'Demo NFT already claimed.'
          : 'Demo NFT claimed on Stellar Testnet.',
      );

      return result;
    });
  }

  async function createTestReceiver() {
    return run('Creating receiver', async () => {
      if (isMainnet) {
        throw new Error(
          'Mainnet cannot create demo receivers. Enter a real wallet address.',
        );
      }

      const result = await api<ReceiverResponse>('/api/demo/receiver', {
        method: 'POST',
        body: JSON.stringify({ label: 'Test receiver' }),
      });

      setRecipientContact(result.contact);
      setRecipient(result.contact.wallet.address);
      setRecipientBalances(result.balance.balances || []);
      setMessage('Test receiver created and funded with Stellar Testnet XLM.');

      return result;
    });
  }

  async function sendAsset() {
    if (!account || !wallet) {
      return null;
    }

    const destination = recipient.trim();

    if (!destination) {
      Alert.alert(
        'Missing recipient',
        'Enter a recipient wallet address or create a test receiver.',
      );
      return null;
    }

    return run(`Sending ${selectedAssetCode}`, async () => {
      requireFreshServerSession();
      if (!isMainnet && selectedAssetCode !== 'XLM') {
        await ensureWalletTrustline(
          selectedAssetCode,
          selectedAsset?.assetIssuer || null,
        );
      }

      const headers = await getAuthHeaders(isMainnet);
      const result = await api<SendResult>(`/api/stellar/${network}/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          accountId: account.id,
          assetCode: selectedAssetCode,
          assetIssuer: selectedAsset?.assetIssuer || null,
          email: account.email,
          sourceWalletId: wallet.id,
          sourceAddress: wallet.address,
          destination,
          amount,
        }),
      });

      setBalances(result.sourceBalances);
      setTransactions(result.transactions);

      if (recipientContact?.wallet.address === destination) {
        setRecipientBalances(result.destinationBalances);
      }

      setMessage(
        `Sent ${formatTokenAmount(
          amount,
        )} ${selectedAssetCode} on Stellar ${network}.`,
      );

      return result;
    });
  }

  async function quoteSwap({
    amount: swapAmount,
    fromAssetCode,
    toAssetCode,
  }: {
    amount: string;
    fromAssetCode: string;
    toAssetCode: string;
  }) {
    if (!wallet) {
      return null;
    }

    return run(`Quote ${fromAssetCode}`, async () => {
      const fromAsset = visibleAssets.find(
        asset => asset.assetCode === fromAssetCode,
      );
      const toAsset = visibleAssets.find(
        asset => asset.assetCode === toAssetCode,
      );

      return api<SwapQuoteResult>(`/api/stellar/${network}/swap/quote`, {
        method: 'POST',
        body: JSON.stringify({
          amount: swapAmount,
          fromAssetCode,
          fromAssetIssuer: fromAsset?.assetIssuer || null,
          sourceAddress: wallet.address,
          toAssetCode,
          toAssetIssuer: toAsset?.assetIssuer || null,
        }),
      });
    });
  }

  async function searchAssets(query: string, options?: { limit?: number }) {
    const params = new URLSearchParams({
      limit: String(options?.limit || 40),
      network,
    });
    const search = query.trim();

    if (search) {
      params.set('search', search);
    }

    try {
      const result = await api<AssetsResponse>(
        `/api/assets?${params.toString()}`,
      );

      return result.assets || [];
    } catch {
      return [];
    }
  }

  async function swapAsset({
    amount: swapAmount,
    fromAssetCode,
    toAssetCode,
  }: {
    amount: string;
    fromAssetCode: string;
    toAssetCode: string;
  }) {
    if (!account || !wallet) {
      return null;
    }

    return run(`Swap ${fromAssetCode}`, async () => {
      requireFreshServerSession();
      const headers = await getAuthHeaders(isMainnet);
      const fromAsset = visibleAssets.find(
        asset => asset.assetCode === fromAssetCode,
      );
      const toAsset = visibleAssets.find(
        asset => asset.assetCode === toAssetCode,
      );
      const requestedAmount = Number(String(swapAmount).replace(',', '.'));

      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        throw new Error('Enter a valid swap amount.');
      }

      if (!fromAsset || !toAsset) {
        throw new Error('Selected swap asset is not available.');
      }

      const fromBalance = balances.find(
        balance =>
          balance.assetCode === fromAssetCode &&
          (balance.assetIssuer || null) ===
            (fromAsset.assetIssuer || null),
      );
      const availableBalance = Number(
        fromBalance?.availableBalance || fromBalance?.balance || 0,
      );

      if (requestedAmount > availableBalance) {
        if (fromAsset.isNative) {
          throw new Error(
            `You can swap up to ${formatTokenAmount(
              String(availableBalance),
            )} XLM. Stellar keeps ${
              formatTokenAmount(
                fromBalance?.reservedBalance ||
                  fromBalance?.minimumBalance ||
                  '0',
              )
            } XLM reserved for the account minimum balance and network fees.`,
          );
        }

        throw new Error(
          `You can swap up to ${formatTokenAmount(
            String(availableBalance),
          )} ${fromAssetCode}.`,
        );
      }

      await ensureWalletTrustline(toAssetCode, toAsset?.assetIssuer || null);

      const result = await api<SwapResult>(
        `/api/stellar/${network}/swap/execute`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            accountId: account.id,
            amount: swapAmount,
            email: account.email,
            fromAssetCode,
            fromAssetIssuer: fromAsset?.assetIssuer || null,
            sourceAddress: wallet.address,
            sourceWalletId: wallet.id,
            toAssetCode,
            toAssetIssuer: toAsset?.assetIssuer || null,
          }),
        },
      );

      setBalances(result.balances);
      setTransactions(result.transactions);
      setMessage(
        `Swapped ${formatTokenAmount(result.fromAmount)} ${
          result.fromAssetCode
        } to ${formatTokenAmount(result.toAmount)} ${result.toAssetCode}.`,
      );

      return result;
    });
  }

  async function persistRampOrder(order: RampOrder | null) {
    setActiveRampOrder(order);

    if (!rampOrderStorageKey) {
      return;
    }

    if (!order || isRampOrderTerminal(order)) {
      await AsyncStorage.removeItem(rampOrderStorageKey);
      return;
    }

    await AsyncStorage.setItem(rampOrderStorageKey, JSON.stringify(order));
  }

  function mergeRampOrderDetails(
    previous: RampOrder | null,
    next: RampOrder,
  ): RampOrder {
    if (!previous) {
      return next;
    }

    const mergedBody = mergePopulatedFields(previous.body, next.body);

    return {
      ...previous,
      ...next,
      body: mergedBody
        ? {
            ...mergedBody,
            bankInfo: mergePopulatedFields(
              previous.body?.bankInfo,
              next.body?.bankInfo,
            ),
          }
        : undefined,
      pay_data: mergePopulatedFields(previous.pay_data, next.pay_data),
      payment_info: mergePopulatedFields(
        previous.payment_info,
        next.payment_info,
      ),
      sell_transaction_hash:
        next.sell_transaction_hash || previous.sell_transaction_hash,
      transaction_hash: next.transaction_hash || previous.transaction_hash,
    };
  }

  function upsertRampOrderHistory(order: RampOrder) {
    const reference = order.code || order.id;

    setRampOrderHistory(current => [
      order,
      ...current.filter(item => (item.code || item.id) !== reference),
    ]);
  }

  async function refreshRampOrderHistory(options: { silent?: boolean } = {}) {
    if (!account || !wallet) {
      setRampOrderHistory([]);
      return [];
    }

    const load = async () => {
      const headers = await getAuthHeaders(isMainnet);
      const params = new URLSearchParams({
        email: account.email,
        limit: '50',
        network,
        sourceAddress: wallet.address,
        sourceWalletId: wallet.id,
      });
      const result = await api<RampOrderHistoryResponse>(
        `/api/ramp/orders?${params.toString()}`,
        { headers },
      );
      const orders = result.data.orders || [];

      setRampOrderHistory(orders);

      return orders;
    };

    if (options.silent) {
      try {
        return await load();
      } catch {
        return [];
      }
    }

    return run('Refreshing order history', load);
  }

  async function openRampOrder(order: RampOrder) {
    await persistRampOrder(order);
    upsertRampOrderHistory(order);

    return order;
  }

  async function quoteRamp({
    amount: rampAmount,
    assetCode,
    direction,
  }: {
    amount: string;
    assetCode: RampAssetCode;
    direction: RampDirection;
  }) {
    return run(
      `Quote ${direction}`,
      async () => {
        const result = await api<RampApiResponse<RampQuote>>(
          '/api/ramp/quote',
          {
            method: 'POST',
            body: JSON.stringify({
              amount: rampAmount,
              assetCode,
              direction,
            }),
          },
        );

        return result.data;
      },
      { showAlert: false },
    );
  }

  async function createRampOrder({
    amount: rampAmount,
    assetCode,
    direction,
    paymentInfo,
  }: {
    amount: string;
    assetCode: RampAssetCode;
    direction: RampDirection;
    paymentInfo?: RampPaymentInfo;
  }) {
    if (!account || !wallet) {
      return null;
    }

    return run(`Creating ${direction} order`, async () => {
      requireFreshServerSession();
      if (kyc.status !== 'verified') {
        throw new Error('KYC_REQUIRED');
      }

      if (!wallet.canSign && direction === 'sell') {
        throw new Error('A watch-only wallet cannot send assets.');
      }

      const asset = visibleAssets.find(item => item.assetCode === assetCode);

      if (direction === 'sell') {
        const balance = balances.find(
          item =>
            item.assetCode === assetCode &&
            (item.assetIssuer || null) === (asset?.assetIssuer || null),
        );
        const availableBalance = Number(
          balance?.availableBalance || balance?.balance || 0,
        );

        if (Number(rampAmount) > availableBalance) {
          throw new Error(
            `You can withdraw up to ${formatTokenAmount(
              String(availableBalance),
            )} ${assetCode}. Stellar keeps reserve and network fees aside.`,
          );
        }
      }

      if (direction === 'buy' && assetCode === 'USDC') {
        await ensureWalletTrustline(assetCode, asset?.assetIssuer || null, {
          confirmMainnet: true,
        });
      }

      const headers = await getAuthHeaders(true);
      const endpoint =
        direction === 'buy'
          ? '/api/ramp/orders/deposit'
          : '/api/ramp/orders/withdrawal';
      const result = await api<RampApiResponse<RampOrder>>(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: rampAmount,
          assetCode,
          email: account.email,
          network,
          paymentInfo,
          sourceAddress: wallet.address,
          sourceWalletId: wallet.id,
        }),
      });

      await persistRampOrder(result.data);
      upsertRampOrderHistory(result.data);
      setMessage(
        direction === 'buy'
          ? `Buy order ${result.data.code} created. Transfer the exact VND amount shown.`
          : `Withdrawal ${result.data.code} created. Send crypto with the payment code as memo.`,
      );

      return result.data;
    });
  }

  async function fetchRampOrder(orderReference: string) {
    const params = new URLSearchParams();

    if (account && wallet) {
      params.set('email', account.email);
      params.set('network', network);
      params.set('sourceAddress', wallet.address);
      params.set('sourceWalletId', wallet.id);
    }

    if (activeRampOrder?.asset_code) {
      params.set('assetCode', activeRampOrder.asset_code);
    }

    if (activeRampOrder?.order_type) {
      params.set('direction', activeRampOrder.order_type);
    }

    const query = params.toString();
    const result = await api<RampApiResponse<RampOrder>>(
      `/api/ramp/orders/${encodeURIComponent(orderReference)}${
        query ? `?${query}` : ''
      }`,
    );
    const nextOrder = mergeRampOrderDetails(activeRampOrder, result.data);
    const completedNow =
      Number(activeRampOrder?.state) !== 3 && Number(nextOrder.state) === 3;

    await persistRampOrder(nextOrder);
    upsertRampOrderHistory(nextOrder);

    if (completedNow && account) {
      const session = await api<SessionResponse>('/api/session', {
        method: 'POST',
        body: JSON.stringify({ email: account.email, network }),
      });
      applySession(session, `Order ${nextOrder.code} completed.`);
    }

    return nextOrder;
  }

  async function refreshRampOrder(
    orderReference = activeRampOrder?.code || activeRampOrder?.id || '',
    options: { silent?: boolean } = {},
  ) {
    if (!orderReference) {
      return null;
    }

    if (options.silent) {
      try {
        return await fetchRampOrder(orderReference);
      } catch {
        return null;
      }
    }

    return run('Refreshing order', () => fetchRampOrder(orderReference));
  }

  async function cancelRampOrder(
    orderReference = activeRampOrder?.code || activeRampOrder?.id || '',
  ) {
    if (!orderReference) {
      return null;
    }

    return run('Cancelling order', async () => {
      requireFreshServerSession();
      await api(
        `/api/ramp/orders/${encodeURIComponent(orderReference)}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'User requested cancellation' }),
        },
      );

      const nextOrder = {
        ...activeRampOrder,
        state: 5,
      } as RampOrder;

      await persistRampOrder(nextOrder);
      upsertRampOrderHistory(nextOrder);
      setMessage(`Order ${nextOrder.code || orderReference} cancelled.`);

      return nextOrder;
    });
  }

  async function bypassRampOrderPayment(
    orderReference = activeRampOrder?.code || activeRampOrder?.id || '',
  ) {
    if (!account || !wallet || !orderReference) {
      return null;
    }

    if (isMainnet) {
      Alert.alert(
        'Testnet only',
        'Payment bypass cannot be used for Mainnet orders.',
      );
      return null;
    }

    return run('Confirming test payment', async () => {
      requireFreshServerSession();
      const headers = await getAuthHeaders(true);
      const result = await api<RampApiResponse<RampOrder>>(
        `/api/ramp/orders/${encodeURIComponent(orderReference)}/bypass-payment`,
        {
          body: JSON.stringify({
            email: account.email,
            network,
            sourceAddress: wallet.address,
            sourceWalletId: wallet.id,
          }),
          headers,
          method: 'POST',
        },
      );
      const nextOrder = mergeRampOrderDetails(activeRampOrder, result.data);

      await persistRampOrder(nextOrder);
      upsertRampOrderHistory(nextOrder);
      setMessage(
        `Test payment confirmed for order ${nextOrder.code || orderReference}.`,
      );

      return nextOrder;
    });
  }

  async function bypassRampSellPayment(
    orderReference = activeRampOrder?.code || activeRampOrder?.id || '',
  ) {
    if (!account || !wallet || !orderReference) {
      return null;
    }

    if (isMainnet) {
      Alert.alert(
        'Testnet only',
        'Withdrawal bypass cannot be used for Mainnet orders.',
      );
      return null;
    }

    return run('Confirming test crypto receipt', async () => {
      requireFreshServerSession();
      const headers = await getAuthHeaders(true);
      const result = await api<RampApiResponse<RampOrder>>(
        `/api/ramp/orders/${encodeURIComponent(
          orderReference,
        )}/bypass-sell-payment`,
        {
          body: JSON.stringify({
            email: account.email,
            network,
            sourceAddress: wallet.address,
            sourceWalletId: wallet.id,
          }),
          headers,
          method: 'POST',
        },
      );
      const nextOrder = mergeRampOrderDetails(activeRampOrder, result.data);

      await persistRampOrder(nextOrder);
      upsertRampOrderHistory(nextOrder);
      setMessage(
        `Test crypto receipt confirmed for order ${
          nextOrder.code || orderReference
        }.`,
      );

      return nextOrder;
    });
  }

  async function sendRampOrderPayment(order = activeRampOrder) {
    if (!account || !wallet || !order) {
      return null;
    }

    return run(`Sending ${order.asset_code}`, async () => {
      requireFreshServerSession();
      if (order.order_type !== 'sell') {
        throw new Error('Only withdrawals require an on-chain transfer.');
      }

      if (isRampOrderTerminal(order)) {
        throw new Error('This order is already closed.');
      }

      const destination = String(order.pay_data?.address || '').trim();

      if (!destination) {
        throw new Error(
          'The payment service did not provide a deposit address.',
        );
      }

      if (isMainnet) {
        await requireBiometric(
          `Confirm sending ${order.amount} ${order.asset_code} on Mainnet`,
        );
      }

      const asset = visibleAssets.find(
        item => item.assetCode === order.asset_code,
      );
      const headers = await getAuthHeaders(isMainnet);
      const result = await api<SendResult>(`/api/stellar/${network}/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          accountId: account.id,
          amount: String(order.amount),
          assetCode: order.asset_code,
          assetIssuer: asset?.assetIssuer || null,
          destination,
          email: account.email,
          memo: order.code,
          sourceAddress: wallet.address,
          sourceWalletId: wallet.id,
        }),
      });
      const nextOrder = {
        ...order,
        sell_transaction_hash: result.hash,
      };

      setBalances(result.sourceBalances);
      setTransactions(result.transactions);
      await persistRampOrder(nextOrder);
      upsertRampOrderHistory(nextOrder);
      setMessage(
        `Sent ${formatTokenAmount(String(order.amount))} ${
          order.asset_code
        } for order ${order.code}.`,
      );

      return result;
    });
  }

  async function clearRampOrder() {
    await persistRampOrder(null);
  }

  async function logout() {
    await signOutAndClearWalletSession('Signed out.');
  }

  async function switchNetwork(nextNetwork: StellarNetwork) {
    if (nextNetwork === network) {
      setMessage(
        nextNetwork === 'mainnet'
          ? 'You are already on Stellar Mainnet.'
          : 'You are already on Stellar Testnet.',
      );
      return null;
    }

    return run('Switching network', async () => {
      setPreferredNetwork(nextNetwork);
      setSelectedAssetCode('XLM');
      resetRecipientState();

      const assetResult = await api<AssetsResponse>(
        `/api/assets?network=${nextNetwork}`,
      );
      const nextAssets = assetResult.assets || [];
      setAssets(current => mergeAssetMarketData(nextAssets, current));
      setAssetPricesUpdatedAt(
        nextAssets.some(hasMarketPrice) ? Date.now() : null,
      );

      if (!account) {
        setBalances([]);
        setCollectibles([]);
        setTransactions([]);
        setMessage(
          nextNetwork === 'mainnet'
            ? 'Switched to Mainnet. Sign in to create a mainnet wallet.'
            : 'Switched to Testnet.',
        );
        return null;
      }

      const hasTargetNetworkWallet = (account.wallets || []).some(
        item =>
          item.network === nextNetwork && !item.archived && item.canSign,
      );
      const bootstrapWallet = hasTargetNetworkWallet
        ? undefined
        : hasLinkedStellarEmbeddedWallet(user)
        ? walletRecordToClientPayload(wallet)
        : await createClientStellarWalletPayload();
      const identityToken = bootstrapWallet
        ? await getTokenWithRetry(getIdentityToken)
        : null;

      if (bootstrapWallet && !identityToken) {
        throw new Error(
          'Privy session is not ready. Sign out and sign in again before creating a wallet on this network.',
        );
      }

      const session = await api<SessionResponse>('/api/session', {
        method: 'POST',
        body: JSON.stringify(
          identityToken
            ? {
                identityToken,
                network: nextNetwork,
                wallet: bootstrapWallet,
              }
            : {
                email: account.email,
                network: nextNetwork,
              },
        ),
      });
      applySession(
        session,
        nextNetwork === 'mainnet'
          ? 'Switched to Mainnet. Deposit real XLM to activate this wallet.'
          : 'Switched to Testnet.',
      );
      await loadCollectibles(session.account.wallet?.address, nextNetwork);

      return session;
    });
  }

  async function importWallet(secret: string, displayName?: string) {
    if (!account) {
      return null;
    }

    return run('Importing wallet', async () => {
      requireFreshServerSession();
      const headers = await getAuthHeaders(true);
      await requireBiometric('Confirm to import this Stellar wallet');
      const session = await api<SessionResponse>('/api/wallets/import', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          displayName,
          email: account.email,
          network,
          secret,
        }),
      });

      applySession(session, 'Wallet imported into Privy.');

      return session;
    });
  }

  async function addWatchOnlyWallet(address: string, displayName?: string) {
    if (!account) {
      return null;
    }

    return run('Adding watch-only wallet', async () => {
      requireFreshServerSession();
      const headers = await getAuthHeaders(isMainnet);
      const session = await api<SessionResponse>('/api/wallets/watch-only', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          address,
          displayName,
          email: account.email,
          network,
        }),
      });

      applySession(session, 'Watch-only wallet added.');

      return session;
    });
  }

  async function createWalletExportUrl(returnUrl?: string) {
    if (!account || !wallet) {
      return null;
    }

    return run('Opening secure export', async () => {
      requireFreshServerSession();
      if (wallet.kind === 'imported_privy') {
        throw new Error(
          'This wallet was imported from your own Stellar secret key. Use the original S... key you imported instead of Privy recovery export.',
        );
      }

      if (wallet.kind !== 'privy') {
        throw new Error(
          'Recovery export is only available for Privy-managed wallets.',
        );
      }

      await requireBiometric('Confirm to open the secure recovery export');

      const params = new URLSearchParams({
        address: wallet.address,
        clientId: PRIVY_WEB_EXPORT_CLIENT_ID,
        email: account.email,
        network,
        t: `${Date.now()}`,
      });

      if (returnUrl) {
        params.set('returnUrl', returnUrl);
      }

      setMessage(
        'Privy will show the recovery key on its secure page. Store it offline and never share it.',
      );

      return `${API_BASE_URL}/wallet-export?${params.toString()}`;
    });
  }

  function openUrl(url?: string | null) {
    if (url) {
      Linking.openURL(url);
    }
  }

  return {
    account,
    activeRampOrder,
    activeWalletId: activeNetworkWalletId,
    assetPricesUpdatedAt,
    addWatchOnlyWallet,
    addTrustline,
    amount,
    archiveWallet,
    assets,
    balances,
    bypassRampOrderPayment,
    bypassRampSellPayment,
    busy,
    claimDemoNft,
    code,
    codeSent,
    collectibles,
    cancelRampOrder,
    clearRampOrder,
    createRampOrder,
    createTestReceiver,
    createWallet,
    email,
    errorDialog,
    explorerAddressUrl,
    createWalletExportUrl,
    fundTestUsdc,
    fundWallet,
    health,
    isBusy: busy !== null,
    isMainnet,
    isReady,
    importWallet,
    kyc,
    loginWithGoogle,
    loginState,
    logout,
    message,
    network,
    networks,
    openUrl,
    oauthState,
    openRampOrder,
    privySessionReady,
    privyError,
    quoteSwap,
    quoteRamp,
    rampOrderHistory,
    rampProviders,
    recipient,
    recipientContact,
    recipientSelectedBalance,
    refreshKycStatus,
    refreshPrivySecuritySession,
    refreshAssetPrices,
    refreshRampOrder,
    refreshRampOrderHistory,
    refreshCollectibles,
    refreshSession,
    renameWallet,
    resetLoginCode,
    selectedAsset,
    selectedAssetCode,
    selectedBalance,
    serverSessionReady,
    sendAsset,
    sendRampOrderPayment,
    sendEmailCode,
    submitKycIdCard,
    selectWallet,
    setAmount,
    setCode,
    setEmail,
    setMessage,
    setRecipient,
    setSelectedAssetCode,
    searchAssets,
    sessionSyncing,
    swapAsset,
    switchNetwork,
    dismissErrorDialog,
    transactions,
    verifyCodeAndLogin,
    visibleAssets,
    wallet,
    walletActive,
    walletCanSign,
    walletConnectConfig,
    walletSessionSyncing,
    wallets: networkWallets,
    showErrorDialog,
    xlmBalance,
  };
}

export type WalletState = ReturnType<typeof useWallet>;
