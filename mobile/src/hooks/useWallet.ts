import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBiometrics from 'react-native-biometrics';
import {
  useIdentityToken,
  useLoginWithEmail,
  useLoginWithOAuth,
  usePrivy,
} from '@privy-io/expo';
import {
  useCreateWallet as useCreateExtendedWallet,
  useSignRawHash,
} from '@privy-io/expo/extended-chains';
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
  FavoriteAsset,
  FavoriteAssetsResponse,
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
  RampPaymentMethod,
  RampPaymentMethodsResponse,
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
import { cacheGet, cacheSet } from '@utils/localCache';
import { isRampOrderTerminal } from '@utils/ramp';
import {
  getAvailableAmount,
  getImportSecretPublicAddress,
  getXlmTrustlineReserveWarning,
  isLikelyStellarPublicKey,
  validateImportSecret,
  validateStellarAmount,
  validateWatchOnlyAddress,
} from '@utils/walletValidation';
import {
  AssetIdentityInput,
  applyReferenceMarketPrices,
  getAssetIdentity,
  hasMarketPrice,
  mergeAssetMarketData,
} from './wallet/assets';
import {
  ASSETS_CACHE_TTL_MS,
  DEFAULT_KYC,
  DEFAULT_NETWORK,
  IMPORT_WALLET_TIMEOUT_MS,
  LEGACY_LOCAL_SESSION_STORAGE_KEYS,
  MARKET_PRICE_REFRESH_MS,
  PREFERRED_NETWORK_STORAGE_KEY,
  PRIVY_SECURITY_SESSION_TIMEOUT_MS,
  RAMP_ORDER_STORAGE_PREFIX,
  TRANSACTIONS_CACHE_TTL_MS,
  TRUSTLINE_ENABLE_TIMEOUT_MS,
  TRUSTLINE_SIGN_TIMEOUT_MS,
} from './wallet/constants';
import {
  ClientStellarWalletPayload,
  getEmailFromPrivyUser,
  getPrivyUserKey,
  getTokenWithRetry,
  hasLinkedStellarEmbeddedWallet,
  isPrivyHash,
  walletRecordToClientPayload,
  withTimeout,
} from './wallet/privy';
import {
  clearCachedSessions,
  getActiveWalletStorageKey,
  getAssetsCacheKey,
  getTransactionsCacheKey,
  readCachedSession,
  readStoredActiveWalletId,
  rememberActiveWalletId,
  writeCachedSession,
} from './wallet/storage';
import { isStellarNetwork, mergePopulatedFields } from './wallet/utils';
import { useWalletErrors, type RunOptions } from './wallet/walletErrors';

type ApplySessionOptions = {
  cache?: boolean;
  source?: 'cache' | 'server';
};

type FinishPrivySessionOptions = {
  cache?: boolean;
  message?: string;
  privyUser?: unknown;
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

export function getBalanceForAsset(balances: BalanceItem[], assetCode: string) {
  return balances.find(balance => balance.assetCode === assetCode) || null;
}

export function getBalanceAmount(balances: BalanceItem[], assetCode: string) {
  return getBalanceForAsset(balances, assetCode)?.balance || '0';
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
  const {
    busy,
    dismissErrorDialog,
    errorDialog,
    message,
    run,
    setErrorDialog,
    setMessage,
    showErrorDialog,
  } = useWalletErrors('Enter your email to receive a Privy login code.');
  const [rampProviders, setRampProviders] = useState<RampProvider[]>([]);
  const [activeRampOrder, setActiveRampOrder] = useState<RampOrder | null>(
    null,
  );
  const [rampOrderHistory, setRampOrderHistory] = useState<RampOrder[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<RampPaymentMethod[]>([]);
  const [favoriteAssets, setFavoriteAssets] = useState<FavoriteAsset[]>([]);
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
  const { signRawHash } = useSignRawHash();

  const setPreferredNetwork = useCallback((nextNetwork: StellarNetwork) => {
    setNetwork(nextNetwork);
    AsyncStorage.setItem(PREFERRED_NETWORK_STORAGE_KEY, nextNetwork).catch(
      () => null,
    );
  }, []);

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
      cacheSet(getAssetsCacheKey(network), nextAssets).catch(() => null);
      setRampProviders(rampResult.providers || []);
      setWalletConnectConfig(walletConnectResult);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }, [network]);

  useEffect(() => {
    let cancelled = false;

    cacheGet<AssetItem[]>(getAssetsCacheKey(network), ASSETS_CACHE_TTL_MS)
      .then(cachedAssets => {
        if (cancelled || !cachedAssets || cachedAssets.length === 0) {
          return;
        }

        setAssets(current =>
          current.length > 0
            ? mergeAssetMarketData(cachedAssets, current)
            : cachedAssets,
        );

        if (cachedAssets.some(hasMarketPrice)) {
          setAssetPricesUpdatedAt(prev => prev ?? Date.now());
        }
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
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
  const networkWalletIds = networkWallets.map(item => item.id).join('|');
  const wallet =
    networkWallets.find(item => item.id === activeWalletId) ||
    networkWallets[0] ||
    null;
  const activeNetworkWalletId = wallet?.id || activeWalletId;
  const userKey = getPrivyUserKey(user);

  useEffect(() => {
    getIdentityTokenRef.current = getIdentityToken;
  }, [getIdentityToken]);

  useEffect(() => {
    if (!account?.email || networkWallets.length === 0) {
      return;
    }

    let cancelled = false;

    readStoredActiveWalletId(account.email, network)
      .then(storedWalletId => {
        if (cancelled || !storedWalletId) {
          return;
        }

        const storedWalletExists = networkWallets.some(
          item => item.id === storedWalletId,
        );

        if (!storedWalletExists) {
          AsyncStorage.removeItem(
            getActiveWalletStorageKey(account.email, network),
          ).catch(() => null);
          return;
        }

        if (storedWalletId !== activeWalletId) {
          setActiveWalletId(storedWalletId);
        }
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [account?.email, activeWalletId, network, networkWalletIds]);

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
      const transactionList = result.transactions || [];

      cacheSet(
        getTransactionsCacheKey(address, targetNetwork),
        transactionList,
      ).catch(() => null);

      return transactionList;
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

      cacheSet(getAssetsCacheKey(network), nextAssets).catch(() => null);

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
    setPaymentMethods([]);
    setFavoriteAssets([]);
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

    cacheGet<TransactionItem[]>(
      getTransactionsCacheKey(address, network),
      TRANSACTIONS_CACHE_TTL_MS,
    )
      .then(cachedTransactions => {
        if (
          cancelled ||
          !cachedTransactions ||
          cachedTransactions.length === 0
        ) {
          return;
        }

        setTransactions(current =>
          current.length > 0 ? current : cachedTransactions,
        );
      })
      .catch(() => null);

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
  }, [fetchTransactionHistory, network, serverSessionReady, wallet?.address]);

  useEffect(() => {
    const address = wallet?.address;

    if (!address) {
      return;
    }

    let currentAppState = AppState.currentState;
    let cancelled = false;

    const subscription = AppState.addEventListener('change', nextAppState => {
      const returningToForeground =
        currentAppState.match(/inactive|background/) &&
        nextAppState === 'active';

      currentAppState = nextAppState;

      if (!returningToForeground || cancelled) {
        return;
      }

      fetchTransactionHistory(address, network)
        .then(nextTransactions => {
          if (!cancelled) {
            setTransactions(nextTransactions);
          }
        })
        .catch(() => null);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [fetchTransactionHistory, network, wallet?.address]);

  useEffect(() => {
    if (!account || !serverSessionReady) {
      setPaymentMethods([]);
      setFavoriteAssets([]);
      return;
    }

    loadPaymentMethods({ silent: true }).catch(() => null);
    loadFavoriteAssets({ silent: true }).catch(() => null);
  }, [account?.email, network, serverSessionReady]);

  const refreshPrivySecuritySession = useCallback(async () => {
    if (!isReady || !userKey) {
      setPrivySessionReady(false);
      return false;
    }

    const identityToken = await withTimeout(
      getTokenWithRetry(getIdentityTokenRef.current),
      PRIVY_SECURITY_SESSION_TIMEOUT_MS,
      'Privy session check timed out.',
    ).catch(() => null);
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

  async function refreshSession(options: RunOptions = {}) {
    if (!account) {
      return;
    }

    await run('Refreshing wallet', async () => {
      setSessionSyncing(true);

      try {
        const session = await api<SessionResponse>('/api/session', {
          method: 'POST',
          body: JSON.stringify({
            activeWalletId: activeNetworkWalletId,
            email: account.email,
            network,
            sourceAddress: wallet?.address,
            sourceWalletId: wallet?.id,
          }),
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
    }, options);
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
      await rememberActiveWalletId(account.email, network, walletId);

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

    const reserveWarning = getTrustlineReserveWarningForAsset(
      assetDefinition.assetCode,
      assetDefinition.assetIssuer,
    );

    if (reserveWarning) {
      throw new Error(reserveWarning);
    }

    if (isMainnet && options.confirmMainnet) {
      await requireBiometric(
        `Confirm to enable receiving ${assetDefinition.assetCode} on Mainnet`,
      );
    }

    const headers = await getAuthHeaders(isMainnet);
    const trustlineBody = {
      accountId: account.id,
      assetCode: assetDefinition.assetCode,
      assetIssuer: assetIssuer || assetDefinition.assetIssuer || null,
      clientSigningSupported: true,
      email: account.email,
      sourceAddress: wallet.address,
      sourceWalletId: wallet.id,
    };
    let result = await api<TrustlineResult>(
      `/api/stellar/${network}/trustline`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(trustlineBody),
      },
    );

    if (result.requiresClientSignature) {
      if (!isPrivyHash(result.hash)) {
        throw new Error('Could not prepare this asset update. Please try again.');
      }

      if (!result.transactionXdr) {
        throw new Error('Could not prepare this asset update. Please try again.');
      }

      const signedTrustline = await withTimeout(
        signRawHash({
          address: wallet.address,
          chainType: 'stellar',
          hash: result.hash,
        }),
        TRUSTLINE_SIGN_TIMEOUT_MS,
        'Wallet signing timed out. Please try again.',
      );

      result = await api<TrustlineResult>(
        `/api/stellar/${network}/trustline`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...trustlineBody,
            clientSignature: signedTrustline.signature,
            signingHash: result.hash,
            transactionXdr: result.transactionXdr,
          }),
        },
      );
    }

    setBalances(result.balances);
    setTransactions(result.transactions);
    await loadCollectibles(wallet.address, network);

    return result;
  }

  function getTrustlineReserveWarningForAsset(
    assetCode: string,
    assetIssuer?: string | null,
  ) {
    const assetDefinition =
      visibleAssets.find(
        asset =>
          asset.assetCode === assetCode &&
          (!assetIssuer || asset.assetIssuer === assetIssuer),
      ) || visibleAssets.find(asset => asset.assetCode === assetCode);

    if (!assetDefinition || assetDefinition.isNative) {
      return null;
    }

    const existingBalance = balances.find(
      balance =>
        balance.assetCode === assetDefinition.assetCode &&
        (balance.assetIssuer || null) ===
          (assetDefinition.assetIssuer || null),
    );

    if (existingBalance?.trusted) {
      return null;
    }

    const xlmBalance = balances.find(balance => balance.assetCode === 'XLM');

    return getXlmTrustlineReserveWarning(
      xlmBalance,
      balances,
      assetDefinition.assetCode,
    );
  }

  async function addTrustline(assetCode: string, assetIssuer?: string | null) {
    if (!wallet) {
      return;
    }

    const reserveWarning = getTrustlineReserveWarningForAsset(
      assetCode,
      assetIssuer,
    );

    if (reserveWarning) {
      setMessage(reserveWarning);
      showErrorDialog(reserveWarning, 'Not enough XLM');
      return;
    }

    await run(`Enabling ${assetCode}`, async () => {
      const result = await withTimeout(
        ensureWalletTrustline(assetCode, assetIssuer, {
          confirmMainnet: true,
        }),
        TRUSTLINE_ENABLE_TIMEOUT_MS,
        `Enabling ${assetCode} timed out. Please try again.`,
      );

      if (!result) {
        throw new Error(`Could not enable ${assetCode}. Please try again.`);
      }

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

      const fundNftBody = {
        accountId: account.id,
        clientSigningSupported: true,
        email: account.email,
        sourceAddress: wallet.address,
        sourceWalletId: wallet.id,
      };
      let result = await api<FundNftResult>(
        `/api/stellar/${network}/fund-nft`,
        {
          method: 'POST',
          body: JSON.stringify(fundNftBody),
        },
      );

      if (result.requiresClientSignature) {
        if (!isPrivyHash(result.hash)) {
          throw new Error('Could not prepare this NFT claim. Please try again.');
        }

        if (!result.transactionXdr) {
          throw new Error('Could not prepare this NFT claim. Please try again.');
        }

        const signedClaim = await withTimeout(
          signRawHash({
            address: wallet.address,
            chainType: 'stellar',
            hash: result.hash,
          }),
          TRUSTLINE_SIGN_TIMEOUT_MS,
          'Wallet signing timed out. Please try again.',
        );

        result = await api<FundNftResult>(
          `/api/stellar/${network}/fund-nft`,
          {
            method: 'POST',
            body: JSON.stringify({
              ...fundNftBody,
              clientSignature: signedClaim.signature,
              signingHash: result.hash,
              transactionXdr: result.transactionXdr,
            }),
          },
        );
      }

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

    const destination = recipient.trim().toUpperCase();
    const amountCheck = validateStellarAmount(amount);

    if (!destination) {
      setErrorDialog({
        message: 'Enter a recipient wallet address or create a test receiver.',
        title: 'Missing recipient',
      });
      return null;
    }

    if (!isLikelyStellarPublicKey(destination)) {
      setErrorDialog({
        message: 'Enter a valid Stellar recipient address that starts with G.',
        title: 'Invalid recipient',
      });
      return null;
    }

    if (!amountCheck.valid) {
      setErrorDialog({
        message: amountCheck.message || 'Enter a valid amount.',
        title: 'Invalid amount',
      });
      return null;
    }

    const availableBalance = getAvailableAmount(selectedBalance);

    if (amountCheck.amount > availableBalance) {
      setErrorDialog({
        message: selectedAsset?.isNative
          ? `You can send up to ${formatTokenAmount(
              String(availableBalance),
            )} XLM. Stellar keeps ${
              formatTokenAmount(
                selectedBalance?.reservedBalance ||
                  selectedBalance?.minimumBalance ||
                  '0',
              )
            } XLM reserved for the account minimum balance and network fees.`
          : `You can send up to ${formatTokenAmount(
              String(availableBalance),
            )} ${selectedAssetCode}.`,
        title: 'Insufficient balance',
      });
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
      const sendBody = {
        accountId: account.id,
        amount: amountCheck.normalized,
        assetCode: selectedAssetCode,
        assetIssuer: selectedAsset?.assetIssuer || null,
        clientSigningSupported: true,
        destination,
        email: account.email,
        sourceAddress: wallet.address,
        sourceWalletId: wallet.id,
      };
      let result = await api<SendResult>(`/api/stellar/${network}/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify(sendBody),
      });

      if (result.requiresClientSignature) {
        if (!isPrivyHash(result.hash)) {
          throw new Error('Could not prepare this transfer. Please try again.');
        }

        if (!result.transactionXdr) {
          throw new Error('Could not prepare this transfer. Please try again.');
        }

        const signedTransfer = await withTimeout(
          signRawHash({
            address: wallet.address,
            chainType: 'stellar',
            hash: result.hash,
          }),
          TRUSTLINE_SIGN_TIMEOUT_MS,
          'Wallet signing timed out. Please try again.',
        );

        result = await api<SendResult>(`/api/stellar/${network}/send`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...sendBody,
            clientSignature: signedTransfer.signature,
            signingHash: result.hash,
            transactionXdr: result.transactionXdr,
          }),
        });
      }

      setBalances(result.sourceBalances);
      setTransactions(result.transactions);

      if (recipientContact?.wallet.address === destination) {
        setRecipientBalances(result.destinationBalances);
      }

      setMessage(
        `Sent ${formatTokenAmount(
          amountCheck.normalized,
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
      const amountCheck = validateStellarAmount(swapAmount, 'Swap amount');
      const requestedAmount = amountCheck.amount;

      if (!amountCheck.valid) {
        throw new Error(amountCheck.message || 'Enter a valid swap amount.');
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

      return api<SwapQuoteResult>(`/api/stellar/${network}/swap/quote`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amountCheck.normalized,
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
      const amountCheck = validateStellarAmount(swapAmount, 'Swap amount');
      const requestedAmount = amountCheck.amount;

      if (!amountCheck.valid) {
        throw new Error(amountCheck.message || 'Enter a valid swap amount.');
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

      const swapBody = {
        accountId: account.id,
        amount: amountCheck.normalized,
        clientSigningSupported: true,
        email: account.email,
        fromAssetCode,
        fromAssetIssuer: fromAsset?.assetIssuer || null,
        sourceAddress: wallet.address,
        sourceWalletId: wallet.id,
        toAssetCode,
        toAssetIssuer: toAsset?.assetIssuer || null,
      };
      let result = await api<SwapResult>(
        `/api/stellar/${network}/swap/execute`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(swapBody),
        },
      );

      if (result.requiresClientSignature) {
        if (!isPrivyHash(result.hash)) {
          throw new Error('Could not prepare this swap. Please try again.');
        }

        if (!result.transactionXdr) {
          throw new Error('Could not prepare this swap. Please try again.');
        }

        const signedSwap = await withTimeout(
          signRawHash({
            address: wallet.address,
            chainType: 'stellar',
            hash: result.hash,
          }),
          TRUSTLINE_SIGN_TIMEOUT_MS,
          'Wallet signing timed out. Please try again.',
        );

        result = await api<SwapResult>(
          `/api/stellar/${network}/swap/execute`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              ...swapBody,
              clientSignature: signedSwap.signature,
              signingHash: result.hash,
              transactionXdr: result.transactionXdr,
            }),
          },
        );
      }

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

    setRampOrderHistory(current => {
      const existingIndex = current.findIndex(
        item => (item.code || item.id) === reference,
      );

      if (existingIndex < 0) {
        return [order, ...current];
      }

      const next = [...current];
      next[existingIndex] = mergeRampOrderDetails(
        next[existingIndex],
        order,
      );
      return next;
    });
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

  async function loadFavoriteAssets(options: { silent?: boolean } = {}) {
    if (!account) {
      setFavoriteAssets([]);
      return [];
    }

    const load = async () => {
      const headers = await getAuthHeaders(true);
      const params = new URLSearchParams({
        email: account.email,
        network,
      });
      const result = await api<FavoriteAssetsResponse>(
        `/api/assets/favorites?${params.toString()}`,
        { headers },
      );
      const assets = result.data.assets || [];

      setFavoriteAssets(assets);

      return assets;
    };

    if (options.silent) {
      try {
        return await load();
      } catch {
        return [];
      }
    }

    return run('Loading favorite assets', load);
  }

  function findFavoriteAsset(asset: AssetIdentityInput) {
    const identity = getAssetIdentity(asset);

    return (
      favoriteAssets.find(item => getAssetIdentity(item) === identity) || null
    );
  }

  function isFavoriteAsset(asset: AssetIdentityInput) {
    return Boolean(findFavoriteAsset(asset));
  }

  async function toggleFavoriteAsset(asset: AssetItem) {
    if (!account) {
      setMessage('Sign in before saving favorite assets.');
      return null;
    }

    const existing = findFavoriteAsset(asset);

    if (existing) {
      return run(
        'Updating favorites',
        async () => {
          requireFreshServerSession();
          const headers = await getAuthHeaders(true);
          const params = new URLSearchParams({
            email: account.email,
            network,
          });

          await api<FavoriteAssetsResponse>(
            `/api/assets/favorites/${encodeURIComponent(
              existing.id,
            )}?${params.toString()}`,
            {
              method: 'DELETE',
              headers,
            },
          );

          setFavoriteAssets(current =>
            current.filter(item => item.id !== existing.id),
          );
          setMessage(`${asset.assetCode} removed from favorites.`);

          return false;
        },
        { showAlert: false },
      );
    }

    return run(
      'Updating favorites',
      async () => {
        requireFreshServerSession();
        const headers = await getAuthHeaders(true);
        const result = await api<FavoriteAssetsResponse>(
          '/api/assets/favorites',
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              assetCode: asset.assetCode,
              assetIssuer: asset.isNative ? null : asset.assetIssuer,
              displayName: asset.displayName || asset.assetCode,
              email: account.email,
              homeDomain: asset.homeDomain || null,
              image: asset.image || null,
              network,
            }),
          },
        );
        const savedAsset = result.data.asset;

        if (!savedAsset) {
          throw new Error('Could not save favorite asset. Please try again.');
        }

        setFavoriteAssets(current => [
          savedAsset,
          ...current.filter(
            item => getAssetIdentity(item) !== getAssetIdentity(savedAsset),
          ),
        ]);
        setMessage(`${asset.assetCode} added to favorites.`);

        return true;
      },
      { showAlert: false },
    );
  }

  async function loadPaymentMethods(options: { silent?: boolean } = {}) {
    if (!account) {
      setPaymentMethods([]);
      return [];
    }

    const load = async () => {
      const headers = await getAuthHeaders(true);
      const params = new URLSearchParams({
        email: account.email,
        network,
      });
      const result = await api<RampPaymentMethodsResponse>(
        `/api/ramp/payment-methods?${params.toString()}`,
        { headers },
      );
      const methods = result.data.methods || [];

      setPaymentMethods(methods);

      return methods;
    };

    if (options.silent) {
      try {
        return await load();
      } catch {
        return [];
      }
    }

    return run('Loading payment methods', load);
  }

  async function savePaymentMethod(
    method: Pick<
      RampPaymentMethod,
      'accountNumber' | 'accountType' | 'bankId' | 'bankName' | 'fullName'
    > & { isDefault?: boolean },
  ) {
    if (!account) {
      return null;
    }

    return run('Saving payment method', async () => {
      requireFreshServerSession();
      const headers = await getAuthHeaders(true);
      const result = await api<RampPaymentMethodsResponse>(
        '/api/ramp/payment-methods',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...method,
            email: account.email,
            network,
          }),
        },
      );

      await loadPaymentMethods({ silent: true });

      return result.data.method || null;
    });
  }

  async function updatePaymentMethod(
    id: string,
    method: Pick<
      RampPaymentMethod,
      'accountNumber' | 'accountType' | 'bankId' | 'bankName' | 'fullName'
    > & { isDefault?: boolean },
  ) {
    if (!account || !id) {
      return null;
    }

    return run('Updating payment method', async () => {
      requireFreshServerSession();
      const headers = await getAuthHeaders(true);
      const result = await api<RampPaymentMethodsResponse>(
        `/api/ramp/payment-methods/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            ...method,
            email: account.email,
            network,
          }),
        },
      );

      await loadPaymentMethods({ silent: true });

      return result.data.method || null;
    });
  }

  async function deletePaymentMethod(id: string) {
    if (!account || !id) {
      return false;
    }

    return run('Deleting payment method', async () => {
      requireFreshServerSession();
      const headers = await getAuthHeaders(true);
      const params = new URLSearchParams({
        email: account.email,
        network,
      });

      await api<RampPaymentMethodsResponse>(
        `/api/ramp/payment-methods/${encodeURIComponent(
          id,
        )}?${params.toString()}`,
        {
          method: 'DELETE',
          headers,
        },
      );

      await loadPaymentMethods({ silent: true });

      return true;
    });
  }

  async function setDefaultPaymentMethod(id: string) {
    if (!account || !id) {
      return null;
    }

    return run('Setting default payment method', async () => {
      requireFreshServerSession();
      const headers = await getAuthHeaders(true);
      const result = await api<RampPaymentMethodsResponse>(
        `/api/ramp/payment-methods/${encodeURIComponent(id)}/default`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: account.email,
            network,
          }),
        },
      );

      await loadPaymentMethods({ silent: true });

      return result.data.method || null;
    });
  }

  async function openRampOrder(order: RampOrder) {
    await persistRampOrder(order);

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
        const amountCheck = validateStellarAmount(rampAmount, 'Ramp amount');

        if (!amountCheck.valid) {
          throw new Error(amountCheck.message || 'Enter a valid ramp amount.');
        }

        const result = await api<RampApiResponse<RampQuote>>(
          '/api/ramp/quote',
          {
            method: 'POST',
            body: JSON.stringify({
              amount: amountCheck.normalized,
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

    const amountCheck = validateStellarAmount(rampAmount, 'Ramp amount');

    if (!amountCheck.valid) {
      setErrorDialog({
        message: amountCheck.message || 'Enter a valid ramp amount.',
        title: 'Invalid amount',
      });
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

        if (amountCheck.amount > availableBalance) {
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
          amount: amountCheck.normalized,
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

  async function fetchRampOrder(
    orderReference: string,
    options: { baseOrder?: RampOrder | null; updateActive?: boolean } = {},
  ) {
    const params = new URLSearchParams();
    const baseOrder =
      options.baseOrder ||
      rampOrderHistory.find(item => (item.code || item.id) === orderReference) ||
      (activeRampOrder?.code === orderReference ||
      activeRampOrder?.id === orderReference
        ? activeRampOrder
        : null);
    const updateActive =
      options.updateActive ??
      Boolean(
        activeRampOrder &&
          (activeRampOrder.code === orderReference ||
            activeRampOrder.id === orderReference),
      );

    if (account && wallet) {
      params.set('email', account.email);
      params.set('network', network);
      params.set('sourceAddress', wallet.address);
      params.set('sourceWalletId', wallet.id);
    }

    if (baseOrder?.asset_code) {
      params.set('assetCode', baseOrder.asset_code);
    }

    if (baseOrder?.order_type) {
      params.set('direction', baseOrder.order_type);
    }

    const query = params.toString();
    const result = await api<RampApiResponse<RampOrder>>(
      `/api/ramp/orders/${encodeURIComponent(orderReference)}${
        query ? `?${query}` : ''
      }`,
    );
    const nextOrder = mergeRampOrderDetails(baseOrder, result.data);
    const completedNow =
      Number(baseOrder?.state) !== 3 && Number(nextOrder.state) === 3;

    if (updateActive) {
      await persistRampOrder(nextOrder);
    }
    upsertRampOrderHistory(nextOrder);

    if (completedNow && account) {
      const session = await api<SessionResponse>('/api/session', {
        method: 'POST',
        body: JSON.stringify({
          activeWalletId: activeNetworkWalletId,
          email: account.email,
          network,
          sourceAddress: wallet?.address,
          sourceWalletId: wallet?.id,
        }),
      });
      applySession(session, `Order ${nextOrder.code} completed.`);
    }

    return nextOrder;
  }

  async function refreshRampOrder(
    orderReference = activeRampOrder?.code || activeRampOrder?.id || '',
    options: {
      baseOrder?: RampOrder | null;
      silent?: boolean;
      updateActive?: boolean;
    } = {},
  ) {
    if (!orderReference) {
      return null;
    }

    if (options.silent) {
      try {
        return await fetchRampOrder(orderReference, {
          baseOrder: options.baseOrder,
          updateActive: options.updateActive,
        });
      } catch {
        return null;
      }
    }

    return run('Refreshing order', () =>
      fetchRampOrder(orderReference, {
        baseOrder: options.baseOrder,
        updateActive: options.updateActive,
      }),
    );
  }

  async function cancelRampOrder(
    orderReference = activeRampOrder?.code || activeRampOrder?.id || '',
  ) {
    if (!orderReference) {
      return null;
    }

    return run('Cancelling order', async () => {
      requireFreshServerSession();
      const baseOrder =
        rampOrderHistory.find(item => (item.code || item.id) === orderReference) ||
        (activeRampOrder?.code === orderReference ||
        activeRampOrder?.id === orderReference
          ? activeRampOrder
          : null);
      await api(
        `/api/ramp/orders/${encodeURIComponent(orderReference)}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'User requested cancellation' }),
        },
      );

      const nextOrder = {
        ...baseOrder,
        state: 5,
        code: baseOrder?.code || orderReference,
        id: baseOrder?.id || orderReference,
      } as RampOrder;

      if (
        activeRampOrder?.code === orderReference ||
        activeRampOrder?.id === orderReference
      ) {
        await persistRampOrder(nextOrder);
      }
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
      setErrorDialog({
        message: 'Payment bypass cannot be used for Mainnet orders.',
        title: 'Testnet only',
      });
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
      setErrorDialog({
        message: 'Withdrawal bypass cannot be used for Mainnet orders.',
        title: 'Testnet only',
      });
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

    return run(
      `Sending ${order.asset_code}`,
      async () => {
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
        const sendBody = {
          accountId: account.id,
          amount: String(order.amount),
          assetCode: order.asset_code,
          assetIssuer: asset?.assetIssuer || null,
          clientSigningSupported: true,
          destination,
          email: account.email,
          memo: order.code,
          sourceAddress: wallet.address,
          sourceWalletId: wallet.id,
        };
        let result = await api<SendResult>(`/api/stellar/${network}/send`, {
          method: 'POST',
          headers,
          body: JSON.stringify(sendBody),
        });

        if (result.requiresClientSignature) {
          if (!isPrivyHash(result.hash)) {
            throw new Error(
              'Could not prepare this withdrawal transfer. Please try again.',
            );
          }

          if (!result.transactionXdr) {
            throw new Error(
              'Could not prepare this withdrawal transfer. Please try again.',
            );
          }

          const signedTransfer = await withTimeout(
            signRawHash({
              address: wallet.address,
              chainType: 'stellar',
              hash: result.hash,
            }),
            TRUSTLINE_SIGN_TIMEOUT_MS,
            'Wallet signing timed out. Please try again.',
          );

          result = await api<SendResult>(`/api/stellar/${network}/send`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              ...sendBody,
              clientSignature: signedTransfer.signature,
              signingHash: result.hash,
              transactionXdr: result.transactionXdr,
            }),
          });
        }
        const nextOrder = {
          ...order,
          sell_transaction_hash: result.hash,
        };

        setBalances(result.sourceBalances);
        setTransactions(result.transactions);
        await persistRampOrder(nextOrder);
        upsertRampOrderHistory(nextOrder);

        return result;
      },
      { showBusy: false },
    );
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
      const storedTargetWalletId = await readStoredActiveWalletId(
        account.email,
        nextNetwork,
      );
      const requestedActiveWalletId =
        storedTargetWalletId &&
        (account.wallets || []).some(
          item =>
            item.id === storedTargetWalletId &&
            item.network === nextNetwork &&
            !item.archived,
        )
          ? storedTargetWalletId
          : undefined;
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
                activeWalletId: requestedActiveWalletId,
                identityToken,
                network: nextNetwork,
                wallet: bootstrapWallet,
              }
            : {
                activeWalletId: requestedActiveWalletId,
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
      if (requestedActiveWalletId) {
        setActiveWalletId(requestedActiveWalletId);
      }
      await loadCollectibles(session.account.wallet?.address, nextNetwork);

      return session;
    });
  }

  async function importWallet(
    secret: string,
    displayName?: string,
    options: RunOptions = {},
  ) {
    if (!account) {
      return null;
    }

    const normalizedSecret = secret.trim();
    const secretError = validateImportSecret(normalizedSecret);
    const importedAddress = getImportSecretPublicAddress(normalizedSecret);

    if (secretError) {
      setErrorDialog({
        message: secretError,
        title: 'Invalid import key',
      });
      return null;
    }

    if (!importedAddress) {
      setErrorDialog({
        message:
          'This import key could not be decoded. Check that you pasted the full Privy 64-hex key or Stellar S... key.',
        title: 'Invalid import key',
      });
      return null;
    }

    const duplicateWallet = (account.wallets || []).find(
      item =>
        item.network === network &&
        item.address.toUpperCase() === importedAddress.toUpperCase(),
    );

    if (duplicateWallet?.kind === 'privy') {
      setErrorDialog({
        message: `${importedAddress} is already a Privy-managed wallet in this account on Stellar ${network}.`,
        title: 'Wallet already exists',
      });
      return null;
    }

    return run(
      'Importing wallet',
      async () => {
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
            secret: normalizedSecret,
          }),
          timeoutMs: IMPORT_WALLET_TIMEOUT_MS,
        });

        applySession(
          session,
          duplicateWallet
            ? 'Imported wallet signing key updated.'
            : 'Wallet imported into Privy.',
        );

        return session;
      },
      options,
    );
  }

  async function addWatchOnlyWallet(address: string, displayName?: string) {
    if (!account) {
      return null;
    }

    const normalizedAddress = address.trim().toUpperCase();
    const addressError = validateWatchOnlyAddress(normalizedAddress);

    if (addressError) {
      setErrorDialog({
        message: addressError,
        title: 'Invalid address',
      });
      return null;
    }

    return run('Adding watch-only wallet', async () => {
      requireFreshServerSession();
      const headers = await getAuthHeaders(isMainnet);
      const session = await api<SessionResponse>('/api/wallets/watch-only', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          address: normalizedAddress,
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
    deletePaymentMethod,
    email,
    isRestoringSession:
      Boolean(user) && (!account || sessionSyncing),
    errorDialog,
    explorerAddressUrl,
    createWalletExportUrl,
    favoriteAssets,
    fundTestUsdc,
    fundWallet,
    health,
    isFavoriteAsset,
    isBusy: busy !== null,
    isMainnet,
    isReady,
    importWallet,
    kyc,
    loginWithGoogle,
    loginState,
    loadFavoriteAssets,
    loadPaymentMethods,
    logout,
    message,
    network,
    networks,
    openUrl,
    oauthState,
    openRampOrder,
    paymentMethods,
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
    savePaymentMethod,
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
    setDefaultPaymentMethod,
    setEmail,
    setMessage,
    setRecipient,
    setSelectedAssetCode,
    searchAssets,
    sessionSyncing,
    swapAsset,
    switchNetwork,
    toggleFavoriteAsset,
    dismissErrorDialog,
    transactions,
    updatePaymentMethod,
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
