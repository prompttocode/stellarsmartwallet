import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useIdentityToken,
  useLoginWithEmail,
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
  FundAssetResult,
  Health,
  ReceiverResponse,
  SendResult,
  SessionResponse,
  SwapResult,
  TransactionItem,
  TrustlineResult,
  Wallet,
} from '../types';
import { getErrorMessage, isEmailLike } from '../utils/format';

type RunOptions = {
  showAlert?: boolean;
};

const DEMO_SESSION_EMAIL_STORAGE_KEY = 'lobstr-demo-session-email';

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
  const emailAccount = linkedAccounts.find(
    account => account.type === 'email' && (account.address || account.email),
  );

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
  await AsyncStorage.removeItem(DEMO_SESSION_EMAIL_STORAGE_KEY).catch(
    () => null,
  );
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
      const [result, assetResult] = await Promise.all([
        api<Health>('/api/health'),
        api<AssetsResponse>('/api/assets'),
      ]);

      setHealth(result);
      setAssets(assetResult.assets || []);
      setMessage('Sẵn sàng kết nối Privy và Stellar Testnet.');
    });
  }, [run]);

  useEffect(() => {
    checkServer();
  }, [checkServer]);

  const wallet = account?.wallet;
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
    ? `https://stellar.expert/explorer/testnet/account/${wallet.address}`
    : null;

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

  function applySession(
    session: SessionResponse,
    nextMessage = 'Ví Stellar Testnet đã sẵn sàng.',
  ) {
    const sessionWallets =
      session.wallets ||
      session.account.wallets ||
      (session.account.wallet ? [session.account.wallet] : []);
    const nextActiveWalletId =
      session.activeWalletId ||
      session.account.activeWalletId ||
      session.account.wallet?.id ||
      null;

    setAccount(session.account);
    setWallets(sessionWallets);
    setActiveWalletId(nextActiveWalletId);
    setBalances(session.balances || session.balance.balances || []);
    setTransactions(session.transactions);
    setMessage(nextMessage);
    rememberDemoSessionEmail(session.account.email);
  }

  const finishPrivySession = useCallback(
    async (existingIdentityToken?: string, fallbackEmail?: string) => {
      const identityToken =
        existingIdentityToken || (await getTokenWithRetry(getIdentityToken));
      const sessionEmail = String(fallbackEmail || '').trim().toLowerCase();

      if (!identityToken && !isEmailLike(sessionEmail)) {
        throw new Error(
          'Phiên Privy chưa sẵn sàng hoặc đã hết hạn. Hãy đăng xuất rồi đăng nhập lại.',
        );
      }

      const session = identityToken
        ? await api<SessionResponse>('/api/demo/auth-session', {
            method: 'POST',
            body: JSON.stringify({ identityToken }),
          })
        : await api<SessionResponse>('/api/demo/session', {
            method: 'POST',
            body: JSON.stringify({ email: sessionEmail }),
          });

      setEmail(session.account.email);
      applySession(session);
    },
    [getIdentityToken],
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
        () => finishPrivySession(undefined, getEmailFromPrivyUser(user)),
        { showAlert: false },
      );
    }
  }, [
    account,
    busy,
    finishPrivySession,
    isReady,
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

        if (!isEmailLike(storedEmail)) {
          return null;
        }

        await finishPrivySession(undefined, storedEmail);

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
          await finishPrivySession(identityToken);

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
          await finishPrivySession(identityToken);

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
      await finishPrivySession(undefined, targetEmail);
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
      const session = await api<SessionResponse>('/api/demo/session', {
        method: 'POST',
        body: JSON.stringify({ email: account.email }),
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
      const session = await api<SessionResponse>('/api/demo/wallets', {
        method: 'POST',
        body: JSON.stringify({ email: account.email }),
      });

      resetRecipientState();
      applySession(session, 'Đã tạo ví mới và nạp sẵn XLM test.');

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
        body: JSON.stringify({ email: account.email, walletId }),
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
        body: JSON.stringify({ email: account.email, walletId }),
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
      const result = await api<Balance>('/api/stellar/fund', {
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
      const result = await api<TrustlineResult>('/api/stellar/trustline', {
        method: 'POST',
        body: JSON.stringify({
          sourceWalletId: wallet.id,
          sourceAddress: wallet.address,
          assetCode,
        }),
      });

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
      const result = await api<FundAssetResult>('/api/stellar/fund-asset', {
        method: 'POST',
        body: JSON.stringify({
          address: wallet.address,
          amount: '100',
          assetCode,
        }),
      });

      setBalances(result.balances);
      setTransactions(result.transactions);
      setMessage(`Đã nạp 100 ${assetCode} demo.`);
    });
  }

  async function createDemoReceiver() {
    return run('Tạo người nhận', async () => {
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
      const result = await api<SendResult>('/api/stellar/send', {
        method: 'POST',
        body: JSON.stringify({
          accountId: account.id,
          assetCode: selectedAssetCode,
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

      setMessage(`Đã gửi ${amount} ${selectedAssetCode} lên Stellar Testnet.`);

      return result;
    });
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
      const result = await api<SwapResult>('/api/stellar/swap', {
        method: 'POST',
        body: JSON.stringify({
          accountId: account.id,
          amount: swapAmount,
          fromAssetCode,
          sourceAddress: wallet.address,
          sourceWalletId: wallet.id,
          toAssetCode,
        }),
      });

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

  function openUrl(url?: string | null) {
    if (url) {
      Linking.openURL(url);
    }
  }

  return {
    account,
    activeWalletId,
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
    fundDemoAsset,
    fundWallet,
    health,
    isBusy: busy !== null,
    isReady,
    loginState,
    logout,
    message,
    openUrl,
    privyError,
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
    transactions,
    verifyCodeAndLogin,
    visibleAssets,
    wallet,
    wallets,
    xlmBalance,
  };
}

export type WalletDemoState = ReturnType<typeof useWalletDemo>;
