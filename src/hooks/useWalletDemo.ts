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
import { api } from '../api/client';
import type {
  AssetItem,
  AssetsResponse,
  Balance,
  BalanceItem,
  Contact,
  DemoAccount,
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
} from '../types';
import { getErrorMessage, isEmailLike } from '../utils/format';

type RunOptions = {
  showAlert?: boolean;
};

const DEMO_SESSION_EMAIL_STORAGE_KEY = 'lobstr-demo-session-email';
const DEMO_SESSION_NETWORK_STORAGE_KEY = 'lobstr-demo-session-network';

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

function rememberDemoSessionEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (isEmailLike(normalizedEmail)) {
    AsyncStorage.setItem(
      DEMO_SESSION_EMAIL_STORAGE_KEY,
      normalizedEmail,
    ).catch(() => null);
  }
}

async function getRememberedDemoSessionEmail() {
  const storedEmail = await AsyncStorage.getItem(
    DEMO_SESSION_EMAIL_STORAGE_KEY,
  );

  return String(storedEmail || '').trim().toLowerCase();
}

async function forgetDemoSessionEmail() {
  await Promise.all([
    AsyncStorage.removeItem(DEMO_SESSION_EMAIL_STORAGE_KEY),
    AsyncStorage.removeItem(DEMO_SESSION_NETWORK_STORAGE_KEY),
  ]).catch(() => null);
}

function rememberDemoSessionNetwork(network: StellarNetwork) {
  AsyncStorage.setItem(DEMO_SESSION_NETWORK_STORAGE_KEY, network).catch(
    () => null,
  );
}

async function getRememberedDemoSessionNetwork() {
  const storedNetwork = await AsyncStorage.getItem(
    DEMO_SESSION_NETWORK_STORAGE_KEY,
  );

  return storedNetwork === 'mainnet' ? 'mainnet' : 'testnet';
}

export function getBalanceForAsset(balances: BalanceItem[], assetCode: string) {
  return balances.find(balance => balance.assetCode === assetCode) || null;
}

export function getBalanceAmount(balances: BalanceItem[], assetCode: string) {
  return getBalanceForAsset(balances, assetCode)?.balance || '0';
}

export function getTransactionTitle(transaction: TransactionItem) {
  if (transaction.operation === 'change_trust') {
    return `Thêm trustline ${transaction.assetCode}`;
  }

  const verb = transaction.direction === 'received' ? 'Nhận' : 'Gửi';

  return `${verb} ${transaction.amount} ${transaction.assetCode}`;
}

export function getTransactionIcon(transaction: TransactionItem) {
  if (transaction.operation === 'change_trust') {
    return '+';
  }

  return transaction.direction === 'received' ? '↓' : '↑';
}

export function useWalletDemo() {
  const [health, setHealth] = useState<Health | null>(null);
  const [network, setNetwork] = useState<StellarNetwork>('testnet');
  const [networks, setNetworks] = useState<StellarNetworkInfo[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [account, setAccount] = useState<DemoAccount | null>(null);
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
    'Nhập email thật để Privy gửi mã đăng nhập.',
  );
  const [rampProviders, setRampProviders] = useState<RampProvider[]>([]);
  const [walletConnectConfig, setWalletConnectConfig] =
    useState<WalletConnectConfig | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [restoreAttemptedForUser, setRestoreAttemptedForUser] = useState<
    string | null
  >(null);
  const [restoreAttemptedForSavedSession, setRestoreAttemptedForSavedSession] =
    useState(false);
  const { user, isReady, error: privyError, logout: logoutPrivy } = usePrivy();
  const { getIdentityToken } = useIdentityToken();
  const {
    sendCode,
    loginWithCode,
    state: loginState,
  } = useLoginWithEmail({
    onSendCodeSuccess: () => {
      setCodeSent(true);
      setMessage('Privy đã gửi mã xác minh về email. Nhập mã đó để đăng nhập.');
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
          Alert.alert('Có lỗi', errorMessage);
        }

        return null;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const checkServer = useCallback(async () => {
    await run('Kiểm tra máy chủ', async () => {
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
          ? 'Sẵn sàng Stellar Mainnet. Giao dịch cần biometric.'
          : 'Sẵn sàng kết nối Privy và Stellar Testnet.',
      );
    });
  }, [network, run]);

  useEffect(() => {
    checkServer();
  }, [checkServer]);

  const wallet = account?.wallet;
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
    nextMessage = 'Ví Stellar đã sẵn sàng.',
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
    rememberDemoSessionEmail(session.account.email);
    rememberDemoSessionNetwork(sessionNetwork);
  }, [network]);

  async function getAuthHeaders(required = false) {
    const identityToken = await getTokenWithRetry(getIdentityToken);

    if (!identityToken && required) {
      throw new Error(
        'Cần đăng nhập Privy lại trước khi ký giao dịch mainnet.',
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
      cancelButtonText: 'Hủy',
      promptMessage,
    });

    if (!success) {
      throw new Error('Xác thực sinh trắc học thất bại.');
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
          'Phiên Privy chưa sẵn sàng hoặc đã hết hạn. Hãy đăng xuất rồi đăng nhập lại.',
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
        'Khôi phục phiên',
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

  useEffect(() => {
    if (
      !isReady ||
      user ||
      account ||
      busy ||
      restoreAttemptedForSavedSession
    ) {
      return;
    }

    setRestoreAttemptedForSavedSession(true);
    run(
      'Khôi phục phiên',
      async () => {
        const storedEmail = await getRememberedDemoSessionEmail();
        const storedNetwork = await getRememberedDemoSessionNetwork();

        if (!isEmailLike(storedEmail)) {
          return null;
        }

        await finishPrivySession(undefined, storedEmail, storedNetwork);

        return true;
      },
      { showAlert: false },
    );
  }, [
    account,
    busy,
    finishPrivySession,
    isReady,
    restoreAttemptedForSavedSession,
    run,
    user,
  ]);

  async function sendEmailCode() {
    return run('Gửi mã Privy', async () => {
      const targetEmail = email.trim().toLowerCase();

      if (!isEmailLike(targetEmail)) {
        throw new Error('Nhập email thật để nhận mã đăng nhập từ Privy.');
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
        await forgetDemoSessionEmail();
        clearWalletSession();
      } else if (user) {
        await logoutPrivy();
        await forgetDemoSessionEmail();
        clearWalletSession();
      }

      setEmail(targetEmail);
      setCode('');
      await sendCode({ email: targetEmail });

      return true;
    });
  }

  async function verifyCodeAndLogin() {
    await run('Xác minh Privy', async () => {
      const verificationCode = code.replace(/\D/g, '').slice(0, 6);

      if (verificationCode.length < 6) {
        throw new Error('Nhập đủ 6 số Privy đã gửi về email.');
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
        await forgetDemoSessionEmail();
        clearWalletSession();
      } else if (user) {
        await logoutPrivy();
        await forgetDemoSessionEmail();
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
    await run('Đăng nhập Google', async () => {
      if (user) {
        await logoutPrivy();
        await forgetDemoSessionEmail();
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
    setMessage('Nhập email thật để Privy gửi mã đăng nhập.');
  }

  async function refreshSession() {
    if (!account) {
      return;
    }

    await run('Làm mới ví', async () => {
      const session = await api<SessionResponse>('/api/session', {
        method: 'POST',
        body: JSON.stringify({ email: account.email, network }),
      });
      applySession(session);
      setMessage('Đã làm mới số dư và lịch sử giao dịch.');
    });
  }

  async function createWallet() {
    if (!account) {
      return null;
    }

    return run('Tạo ví mới', async () => {
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
          ? 'Đã tạo ví mainnet. Hãy deposit XLM để active.'
          : 'Đã tạo ví mới và nạp sẵn XLM test.',
      );

      return session;
    });
  }

  async function selectWallet(walletId: string) {
    if (!account || !walletId) {
      return null;
    }

    if (walletId === activeWalletId) {
      setMessage('Ví này đang được chọn.');
      return null;
    }

    return run('Đổi ví', async () => {
      const session = await api<SessionResponse>('/api/demo/wallets/select', {
        method: 'POST',
        body: JSON.stringify({ email: account.email, network, walletId }),
      });

      resetRecipientState();
      applySession(session, 'Đã chuyển ví đang dùng.');

      return session;
    });
  }

  async function renameWallet(walletId: string, displayName: string) {
    if (!account || !walletId) {
      return null;
    }

    return run('Đổi tên ví', async () => {
      const session = await api<SessionResponse>('/api/demo/wallets/rename', {
        method: 'POST',
        body: JSON.stringify({
          displayName,
          email: account.email,
          network,
          walletId,
        }),
      });

      applySession(session, 'Đã đổi tên ví.');

      return session;
    });
  }

  async function archiveWallet(walletId: string) {
    if (!account || !walletId) {
      return null;
    }

    return run('Ẩn ví', async () => {
      const session = await api<SessionResponse>('/api/demo/wallets/archive', {
        method: 'POST',
        body: JSON.stringify({ email: account.email, network, walletId }),
      });

      resetRecipientState();
      applySession(session, 'Đã ẩn ví khỏi danh sách.');

      return session;
    });
  }

  async function fundWallet() {
    if (!wallet) {
      return;
    }

    await run('Nạp test XLM', async () => {
      if (isMainnet) {
        throw new Error(
          'Mainnet không có Friendbot. Vào Receive để lấy QR/address rồi deposit XLM thật.',
        );
      }

      const result = await api<Balance>(`/api/stellar/${network}/fund`, {
        method: 'POST',
        body: JSON.stringify({ address: wallet.address }),
      });

      setBalances(result.balances || []);
      setTransactions(current => result.transactions || current);
      setMessage('Đã nạp test XLM từ Friendbot của Stellar Testnet.');
    });
  }

  async function addTrustline(assetCode: string) {
    if (!wallet) {
      return;
    }

    await run(`Thêm ${assetCode}`, async () => {
      if (isMainnet) {
        await requireBiometric('Xác thực để thêm trustline mainnet');
      }

      const headers = await getAuthHeaders(isMainnet);
      const result = await api<TrustlineResult>(
        `/api/stellar/${network}/trustline`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            accountId: account?.id,
            assetCode,
            assetIssuer:
              visibleAssets.find(asset => asset.assetCode === assetCode)
                ?.assetIssuer || null,
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
          ? `Ví đã có trustline ${assetCode}.`
          : `Đã thêm trustline ${assetCode}.`,
      );
    });
  }

  async function fundDemoAsset(assetCode: string) {
    if (!wallet) {
      return;
    }

    await run(`Nạp ${assetCode}`, async () => {
      if (isMainnet) {
        throw new Error(
          'Mainnet không hỗ trợ token demo. Hãy deposit on-chain hoặc dùng send/withdraw.',
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
      setMessage(`Đã nạp 100 ${assetCode} demo.`);
    });
  }

  async function createDemoReceiver() {
    return run('Tạo người nhận', async () => {
      if (isMainnet) {
        throw new Error('Mainnet không tạo ví nhận demo. Hãy nhập ví thật.');
      }

      const result = await api<ReceiverResponse>('/api/demo/receiver', {
        method: 'POST',
        body: JSON.stringify({ label: 'Người nhận demo' }),
      });

      setRecipientContact(result.contact);
      setRecipient(result.contact.wallet.address);
      setRecipientBalances(result.balance.balances || []);
      setMessage(
        'Đã tạo người nhận demo, nạp sẵn XLM test và add trustline USDC/USDT.',
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
        'Thiếu ví nhận',
        'Hãy nhập địa chỉ ví nhận hoặc tạo người nhận demo.',
      );
      return null;
    }

    return run(`Gửi ${selectedAssetCode}`, async () => {
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

      setMessage(`Đã gửi ${amount} ${selectedAssetCode} lên Stellar ${network}.`);

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
        `Đã swap ${result.fromAmount} ${result.fromAssetCode} sang ${result.toAmount} ${result.toAssetCode}.`,
      );

      return result;
    });
  }

  async function logout() {
    await logoutPrivy();
    await forgetDemoSessionEmail();
    clearWalletSession('Đã thoát ví demo.');
  }

  async function switchNetwork(nextNetwork: StellarNetwork) {
    if (nextNetwork === network) {
      setMessage(
        nextNetwork === 'mainnet'
          ? 'Bạn đang ở Stellar Mainnet.'
          : 'Bạn đang ở Stellar Testnet.',
      );
      return null;
    }

    return run('Đổi mạng', async () => {
      setNetwork(nextNetwork);
      rememberDemoSessionNetwork(nextNetwork);
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
            ? 'Đã chuyển Mainnet. Đăng nhập để tạo ví mainnet.'
            : 'Đã chuyển Testnet.',
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
          ? 'Đã chuyển Mainnet. Ví cần deposit XLM thật để active.'
          : 'Đã chuyển Testnet.',
      );

      return session;
    });
  }

  async function importWallet(secret: string, displayName?: string) {
    if (!account) {
      return null;
    }

    return run('Import ví', async () => {
      await requireBiometric('Xác thực để import ví Stellar');
      const headers = await getAuthHeaders(true);
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

      applySession(session, 'Đã import ví vào Privy.');

      return session;
    });
  }

  async function addWatchOnlyWallet(address: string, displayName?: string) {
    if (!account) {
      return null;
    }

    return run('Thêm watch-only', async () => {
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

      applySession(session, 'Đã thêm ví watch-only.');

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
      await requireBiometric('Xác thực để export secret ví');
      const headers = await getAuthHeaders(true);
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

      setMessage('Secret chỉ hiển thị một lần. Không chia sẻ cho ai.');

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
    createDemoReceiver,
    createWallet,
    email,
    explorerAddressUrl,
    exportWalletSecret,
    fundDemoAsset,
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
    privyError,
    quoteSwap,
    rampProviders,
    recipient,
    recipientContact,
    recipientSelectedBalance,
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

export type WalletDemoState = ReturnType<typeof useWalletDemo>;
