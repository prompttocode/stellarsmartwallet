import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBiometrics from 'react-native-biometrics';
import {
  useIdentityToken,
  useLoginWithEmail,
  useLoginWithOAuth,
  usePrivy,
} from '@privy-io/expo';
import { api } from '@api/client';
import type {
  AssetItem,
  AssetsResponse,
  Balance,
  BalanceItem,
  Contact,
  WalletAccount,
  ExportWalletResult,
  FundAssetResult,
  Health,
  RampProvider,
  RampProvidersResponse,
  ReceiverResponse,
  SendResult,
  SessionResponse,
  StellarNetwork,
  StellarNetworkInfo,
  SwapQuoteResult,
  SwapResult,
  TransactionItem,
  TrustlineResult,
  Wallet,
  WalletConnectConfig,
} from '@app-types';
import { formatTokenAmount, getErrorMessage, isEmailLike } from '@utils/format';

type RunOptions = {
  showAlert?: boolean;
};

const LEGACY_LOCAL_SESSION_STORAGE_KEYS = [
  'lobstr-demo-session-email',
  'lobstr-demo-session-network',
];

type PrivyLinkedEmailAccount = {
  type?: string;
  address?: string;
  email?: string;
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

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTokenWithRetry(
  getToken: () => Promise<string | null>,
) {
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
  const [network, setNetwork] = useState<StellarNetwork>('testnet');
  const [networks, setNetworks] = useState<StellarNetworkInfo[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [account, setAccount] = useState<WalletAccount | null>(null);
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
  const [message, setMessage] = useState(
    'Enter your email to receive a Privy login code.',
  );
  const [rampProviders, setRampProviders] = useState<RampProvider[]>([]);
  const [walletConnectConfig, setWalletConnectConfig] =
    useState<WalletConnectConfig | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [privySessionReady, setPrivySessionReady] = useState(false);
  const [restoreAttemptedForUser, setRestoreAttemptedForUser] = useState<
    string | null
  >(null);
  const { user, isReady, error: privyError, logout: logoutPrivy } = usePrivy();
  const { getIdentityToken } = useIdentityToken();
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

  const run = useCallback(
    async <T,>(
      label: string,
      action: () => Promise<T>,
      options: RunOptions = {},
    ) => {
      try {
        setBusy(label);
        return await action();
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        setMessage(errorMessage);

        if (options.showAlert !== false) {
          Alert.alert('Error', errorMessage);
        }

        return null;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const checkServer = useCallback(async () => {
    await run('Checking server', async () => {
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
      setAssets(assetResult.assets || []);
      setRampProviders(rampResult.providers || []);
      setWalletConnectConfig(walletConnectResult);
      setMessage(
        network === 'mainnet'
          ? 'Stellar Mainnet is ready. Transactions require biometric confirmation.'
          : 'Privy and Stellar Testnet are ready.',
      );
    });
  }, [network, run]);

  useEffect(() => {
    checkServer();
  }, [checkServer]);

  useEffect(() => {
    AsyncStorage.multiRemove(LEGACY_LOCAL_SESSION_STORAGE_KEYS).catch(() => null);
  }, []);

  const accountWallets = account?.wallets || [];
  const wallet =
    wallets.find(item => item.id === activeWalletId && item.network === network) ||
    accountWallets.find(
      item => item.id === activeWalletId && item.network === network,
    ) ||
    account?.wallet;
  const isMainnet = network === 'mainnet';
  const userKey = getPrivyUserKey(user);
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
  const walletCanSign = Boolean(wallet?.canSign);
  const walletActive = Boolean(wallet && balances.some(item => item.exists));

  function resetRecipientState() {
    setRecipient('');
    setRecipientContact(null);
    setRecipientBalances([]);
  }

  function clearWalletSession(nextMessage?: string) {
    setAccount(null);
    setWallets([]);
    setActiveWalletId(null);
    setBalances([]);
    resetRecipientState();
    setTransactions([]);
    setCode('');
    setCodeSent(false);
    setRestoreAttemptedForUser(null);

    if (nextMessage) {
      setMessage(nextMessage);
    }
  }

  const applySession = useCallback((
    session: SessionResponse,
    nextMessage = 'Your Stellar wallet is ready.',
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

    setNetwork(sessionNetwork);
    setAccount(session.account);
    setWallets(sessionWallets);
    setActiveWalletId(nextActiveWalletId);
    setBalances(session.balances || session.balance.balances || []);
    setTransactions(session.transactions);
    setMessage(nextMessage);
  }, [network]);

  const refreshPrivySecuritySession = useCallback(async () => {
    if (!isReady || !user) {
      setPrivySessionReady(false);
      return false;
    }

    const identityToken = await getTokenWithRetry(getIdentityToken);
    const hasToken = Boolean(identityToken);

    setPrivySessionReady(hasToken);

    return hasToken;
  }, [getIdentityToken, isReady, user]);

  useEffect(() => {
    let cancelled = false;

    async function probePrivyToken() {
      if (!isReady || !user) {
        setPrivySessionReady(false);
        return;
      }

      const identityToken = await getTokenWithRetry(getIdentityToken);

      if (!cancelled) {
        setPrivySessionReady(Boolean(identityToken));
      }
    }

    probePrivyToken();

    return () => {
      cancelled = true;
    };
  }, [getIdentityToken, isReady, user, userKey]);

  async function getAuthHeaders(required = false) {
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
    ) => {
      const identityToken =
        existingIdentityToken || (await getTokenWithRetry(getIdentityToken));
      const sessionEmail = String(fallbackEmail || '').trim().toLowerCase();

      if (!identityToken && !isEmailLike(sessionEmail)) {
        throw new Error(
          'Privy session is not ready or has expired. Please sign out and sign in again.',
        );
      }

      const session = identityToken
        ? await api<SessionResponse>('/api/session', {
            method: 'POST',
            body: JSON.stringify({
              identityToken,
              network: sessionNetwork,
            }),
          })
        : await api<SessionResponse>('/api/session', {
            method: 'POST',
            body: JSON.stringify({
              email: sessionEmail,
              network: sessionNetwork,
            }),
          });

      setEmail(session.account.email);
      applySession(session);
    },
    [applySession, getIdentityToken, network],
  );

  useEffect(() => {
    if (
      isReady &&
      user &&
      userKey &&
      !account &&
      !busy &&
      restoreAttemptedForUser !== userKey
    ) {
      setRestoreAttemptedForUser(userKey);
      run(
        'Restoring session',
        () => finishPrivySession(undefined, getEmailFromPrivyUser(user), network),
        { showAlert: false },
      );
    }
  }, [
    account,
    busy,
    finishPrivySession,
    isReady,
    network,
    restoreAttemptedForUser,
    run,
    user,
    userKey,
  ]);

  async function sendEmailCode() {
    return run('Sending Privy code', async () => {
      const targetEmail = email.trim().toLowerCase();

      if (!isEmailLike(targetEmail)) {
        throw new Error('Enter a valid email to receive your Privy login code.');
      }

      const currentPrivyEmail = getEmailFromPrivyUser(user);

      if (user && currentPrivyEmail === targetEmail) {
        const identityToken = await getTokenWithRetry(getIdentityToken);

        if (identityToken) {
          setEmail(targetEmail);
          setCode('');
          setCodeSent(false);
          await finishPrivySession(identityToken, undefined, network);

          return true;
        }

        await logoutPrivy();
        clearWalletSession();
      } else if (user) {
        await logoutPrivy();
        clearWalletSession();
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
          await finishPrivySession(identityToken, undefined, network);

          return;
        }

        await logoutPrivy();
        clearWalletSession();
      } else if (user) {
        await logoutPrivy();
        clearWalletSession();
      }

      await loginWithCode({
        email: targetEmail,
        code: verificationCode,
      });
      setCode('');
      setCodeSent(false);
      await finishPrivySession(undefined, targetEmail, network);
    });
  }

  async function loginWithGoogle() {
    await run('Sign in with Google', async () => {
      if (user) {
        await logoutPrivy();
        clearWalletSession();
      }

      const oauthUser = await loginWithOAuth({
        provider: 'google',
        redirectUri: '/',
      });
      const identityToken = await getTokenWithRetry(getIdentityToken);
      const oauthEmail = getEmailFromPrivyUser(oauthUser);

      setCode('');
      setCodeSent(false);
      await finishPrivySession(identityToken || undefined, oauthEmail, network);

      return true;
    });
  }

  function resetLoginCode() {
    setCode('');
    setCodeSent(false);
    setMessage('Enter your email to receive a Privy login code.');
  }

  async function refreshSession() {
    if (!account) {
      return;
    }

    await run('Refreshing wallet', async () => {
      const session = await api<SessionResponse>('/api/session', {
        method: 'POST',
        body: JSON.stringify({ email: account.email, network }),
      });
      applySession(session);
      setMessage('Balances and transaction history refreshed.');
    });
  }

  async function createWallet() {
    if (!account) {
      return null;
    }

    return run('Creating wallet', async () => {
      const headers = await getAuthHeaders(isMainnet);
      const session = await api<SessionResponse>('/api/wallets', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: account.email,
          fund: !isMainnet,
          network,
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
    });
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
      const session = await api<SessionResponse>('/api/demo/wallets/select', {
        method: 'POST',
        body: JSON.stringify({ email: account.email, network, walletId }),
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
      const session = await api<SessionResponse>('/api/demo/wallets/rename', {
        method: 'POST',
        body: JSON.stringify({
          displayName,
          email: account.email,
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
      const session = await api<SessionResponse>('/api/demo/wallets/archive', {
        method: 'POST',
        body: JSON.stringify({ email: account.email, network, walletId }),
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
      setMessage('Test XLM funded from Stellar Testnet Friendbot.');
    });
  }

  async function addTrustline(assetCode: string, assetIssuer?: string | null) {
    if (!wallet) {
      return;
    }

    await run(`Adding ${assetCode}`, async () => {
      if (isMainnet) {
        await requireBiometric('Confirm to add a Mainnet trustline');
      }

      const assetDefinition =
        visibleAssets.find(
          asset =>
            asset.assetCode === assetCode &&
            (!assetIssuer || asset.assetIssuer === assetIssuer),
        ) || visibleAssets.find(asset => asset.assetCode === assetCode);
      const headers = await getAuthHeaders(isMainnet);
      const result = await api<TrustlineResult>(
        `/api/stellar/${network}/trustline`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            accountId: account?.id,
            assetCode,
            assetIssuer: assetIssuer || assetDefinition?.assetIssuer || null,
            email: account?.email,
            sourceAddress: wallet.address,
            sourceWalletId: wallet.id,
          }),
        },
      );

      setBalances(result.balances);
      setTransactions(result.transactions);
      setMessage(
        result.alreadyTrusted
          ? `Wallet already has a ${assetCode} trustline.`
          : `${assetCode} trustline added.`,
      );
    });
  }

  async function fundTestAsset(assetCode: string) {
    if (!wallet) {
      return;
    }

    await run(`Funding ${assetCode}`, async () => {
      if (isMainnet) {
        throw new Error(
          'Mainnet does not support demo token funding. Deposit on-chain or use send/withdraw.',
        );
      }

      const result = await api<FundAssetResult>(
        `/api/stellar/${network}/fund-asset`,
        {
          method: 'POST',
          body: JSON.stringify({
            address: wallet.address,
            amount: '100',
            assetCode,
          }),
        },
      );

      setBalances(result.balances);
      setTransactions(result.transactions);
      setMessage(`Funded 100 demo ${assetCode}.`);
    });
  }

  async function createTestReceiver() {
    return run('Creating receiver', async () => {
      if (isMainnet) {
        throw new Error('Mainnet cannot create demo receivers. Enter a real wallet address.');
      }

      const result = await api<ReceiverResponse>('/api/demo/receiver', {
        method: 'POST',
        body: JSON.stringify({ label: 'Test receiver' }),
      });

      setRecipientContact(result.contact);
      setRecipient(result.contact.wallet.address);
      setRecipientBalances(result.balance.balances || []);
      setMessage(
        'Test receiver created, funded with test XLM, and prepared for USDC/USDT.',
      );

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
        `Sent ${formatTokenAmount(amount)} ${selectedAssetCode} on Stellar ${network}.`,
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

    return run(
      `Quote ${fromAssetCode}`,
      async () => {
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
      },
      { showAlert: false },
    );
  }

  async function searchAssets(query: string) {
    const params = new URLSearchParams({
      limit: '40',
      network,
    });
    const search = query.trim();

    if (search) {
      params.set('search', search);
    }

    try {
      const result = await api<AssetsResponse>(`/api/assets?${params.toString()}`);

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
      const headers = await getAuthHeaders(isMainnet);
      const fromAsset = visibleAssets.find(
        asset => asset.assetCode === fromAssetCode,
      );
      const toAsset = visibleAssets.find(
        asset => asset.assetCode === toAssetCode,
      );
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
        `Swapped ${formatTokenAmount(result.fromAmount)} ${result.fromAssetCode} to ${formatTokenAmount(result.toAmount)} ${result.toAssetCode}.`,
      );

      return result;
    });
  }

  async function logout() {
    await logoutPrivy();
    clearWalletSession('Signed out.');
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
      setNetwork(nextNetwork);
      setSelectedAssetCode('XLM');
      resetRecipientState();

      const assetResult = await api<AssetsResponse>(
        `/api/assets?network=${nextNetwork}`,
      );
      setAssets(assetResult.assets || []);

      if (!account) {
        setBalances([]);
        setTransactions([]);
        setMessage(
          nextNetwork === 'mainnet'
            ? 'Switched to Mainnet. Sign in to create a mainnet wallet.'
            : 'Switched to Testnet.',
        );
        return null;
      }

      const session = await api<SessionResponse>('/api/session', {
        method: 'POST',
        body: JSON.stringify({
          email: account.email,
          network: nextNetwork,
        }),
      });
      applySession(
        session,
        nextNetwork === 'mainnet'
          ? 'Switched to Mainnet. Deposit real XLM to activate this wallet.'
          : 'Switched to Testnet.',
      );

      return session;
    });
  }

  async function importWallet(secret: string, displayName?: string) {
    if (!account) {
      return null;
    }

    return run('Importing wallet', async () => {
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

  async function exportWalletSecret(
    type: 'private_key' | 'seed_phrase',
    confirmation: string,
  ) {
    if (!account || !wallet) {
      return null;
    }

    return run('Export secret', async () => {
      const headers = await getAuthHeaders(true);
      await requireBiometric('Confirm to export this wallet secret');
      const result = await api<ExportWalletResult>('/api/wallets/export', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          confirmation,
          email: account.email,
          network,
          type,
          walletId: wallet.id,
        }),
      });

      setMessage('The secret is shown once. Do not share it with anyone.');

      return result;
    });
  }

  function openUrl(url?: string | null) {
    if (url) {
      Linking.openURL(url);
    }
  }

  return {
    account,
    activeWalletId,
    addWatchOnlyWallet,
    addTrustline,
    amount,
    archiveWallet,
    assets,
    balances,
    busy,
    code,
    codeSent,
    createTestReceiver,
    createWallet,
    email,
    explorerAddressUrl,
    exportWalletSecret,
    fundTestAsset,
    fundWallet,
    health,
    isBusy: busy !== null,
    isMainnet,
    isReady,
    importWallet,
    loginWithGoogle,
    loginState,
    logout,
    message,
    network,
    networks,
    openUrl,
    oauthState,
    privySessionReady,
    privyError,
    quoteSwap,
    rampProviders,
    recipient,
    recipientContact,
    recipientSelectedBalance,
    refreshPrivySecuritySession,
    refreshSession,
    renameWallet,
    resetLoginCode,
    selectedAsset,
    selectedAssetCode,
    selectedBalance,
    sendAsset,
    sendEmailCode,
    selectWallet,
    setAmount,
    setCode,
    setEmail,
    setMessage,
    setRecipient,
    setSelectedAssetCode,
    searchAssets,
    swapAsset,
    switchNetwork,
    transactions,
    verifyCodeAndLogin,
    visibleAssets,
    wallet,
    walletActive,
    walletCanSign,
    walletConnectConfig,
    wallets,
    xlmBalance,
  };
}

export type WalletState = ReturnType<typeof useWallet>;
