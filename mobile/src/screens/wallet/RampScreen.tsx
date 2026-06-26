import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppPopup } from '@components/common/AppPopup';
import { BANK_OPTIONS } from '@constants/banks';
import {
  ExplorerLink,
  ModernInfoLine,
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  SuccessLottie,
  TokenIcon,
  modern,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import type {
  RampAssetCode,
  RampDirection,
  RampOrder,
  RampPaymentInfo,
  RampPaymentMethod,
  RampQuote,
} from '@app-types';
import type { WalletState } from '@hooks/useWallet';
import {
  getRampOrderStatus,
  isRampOrderTerminal,
  RAMP_PROCESSING_LABELS,
  RAMP_STATE_LABELS,
  rampTimestampToMs,
} from '@utils/ramp';
import { formatTokenAmount, shortAddress } from '@utils/format';
import { validateStellarAmount } from '@utils/walletValidation';

const MIN_RAMP_PAYOUT_VND = 2000;
const WITHDRAW_AUTO_SEND_DELAY_MS = 10000;
const WITHDRAW_AUTO_SEND_STORAGE_PREFIX = 'privy-ramp-withdraw-auto-send';

function hasSubmittedWithdrawCrypto(order?: RampOrder | null) {
  return Boolean(
    order &&
      order.order_type === 'sell' &&
      (order.sell_transaction_hash ||
        order.transaction_hash ||
        Number(order.processing_state) === 14 ||
        Number(order.processing_state) === 16),
  );
}

function formatVnd(value: number | string | undefined) {
  const amount = Number(value || 0);

  return `${Math.round(amount).toLocaleString('vi-VN')} VND`;
}

function parseNumericAmount(value?: string | number | null) {
  const amount = Number(value || 0);

  return Number.isFinite(amount) ? amount : 0;
}

function formatCountdown(expiredAt?: number | null) {
  if (!expiredAt) {
    return 'No expiry supplied';
  }

  const remaining = Math.max(0, expiredAt - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return remaining > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')} remaining`
    : 'Expired';
}

function TransferPriorityCopyCard({
  label,
  onPress,
  value,
}: {
  label: string;
  onPress: () => void;
  value: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`Copy ${label}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.transferPriorityCard,
        pressed ? styles.transferPriorityCardPressed : null,
      ]}
    >
      <View style={styles.transferPriorityCopy}>
        <Text style={styles.transferPriorityLabel}>{label}</Text>
        <Text numberOfLines={2} style={styles.transferPriorityValue}>
          {value}
        </Text>
      </View>
      <View style={styles.transferPriorityCopyIcon}>
        <Ionicons color="#101400" name="copy-outline" size={17} />
      </View>
    </Pressable>
  );
}

export function RampScreen({
  onBack,
  onOpenKyc,
  route,
  wallet,
}: {
  onBack: () => void;
  onOpenKyc: () => void;
  route?: {
    params?: {
      amount?: string;
      assetCode?: RampAssetCode;
      autoCreate?: boolean;
      direction?: RampDirection;
      source?: 'history';
    };
  };
  wallet: WalletState;
}) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const { showPopup } = useAppPopup();
  const [direction, setDirection] = useState<RampDirection>(
    route?.params?.direction === 'sell' ? 'sell' : 'buy',
  );
  const [assetCode, setAssetCode] = useState<RampAssetCode>(
    route?.params?.assetCode || 'XLM',
  );
  const [amount, setAmount] = useState(route?.params?.amount || '10');
  const [quote, setQuote] = useState<RampQuote | null>(null);
  const [quoteSheetVisible, setQuoteSheetVisible] = useState(false);
  const [orderQueueVisible, setOrderQueueVisible] = useState(false);
  const [orderOpenedFromQueue, setOrderOpenedFromQueue] = useState(false);
  const [withdrawAutoSendDeadline, setWithdrawAutoSendDeadline] = useState<
    number | null
  >(null);
  const [withdrawAutoSendReference, setWithdrawAutoSendReference] = useState<
    string | null
  >(null);
  const [bankId, setBankId] = useState('970422');
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [savedPaymentPickerVisible, setSavedPaymentPickerVisible] =
    useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [fullName, setFullName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [dismissedResultKey, setDismissedResultKey] = useState<string | null>(
    null,
  );
  const [bankTransferMarkedReference, setBankTransferMarkedReference] =
    useState<string | null>(null);
  const [bankTransferCheckingReference, setBankTransferCheckingReference] =
    useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const autoCreateAttemptedRef = useRef<string | null>(null);
  const appliedDefaultPaymentMethodRef = useRef<string | null>(null);
  const withdrawAutoSendStartedRef = useRef<string | null>(null);
  const rawOrder = wallet.activeRampOrder;
  const openedFromHistory = route?.params?.source === 'history';
  const rawOrderReference = rawOrder?.code || rawOrder?.id || '';
  const routeWantsNewOrder =
    !openedFromHistory &&
    Boolean(
      route?.params?.amount ||
        route?.params?.assetCode ||
        route?.params?.autoCreate ||
        route?.params?.direction,
    );
  const ignoredInitialClosedOrderRef = useRef<string | null>(
    routeWantsNewOrder ? rawOrderReference || null : null,
  );
  const ignoringInitialClosedOrder = Boolean(
    ignoredInitialClosedOrderRef.current &&
      rawOrderReference === ignoredInitialClosedOrderRef.current,
  );
  const order = ignoringInitialClosedOrder ? null : rawOrder;
  const refreshRampOrderRef = useRef(wallet.refreshRampOrder);
  const cancelRampOrderRef = useRef(wallet.cancelRampOrder);
  const sendRampOrderPaymentRef = useRef(wallet.sendRampOrderPayment);
  const orderReference = order?.code || order?.id || '';
  const terminal = isRampOrderTerminal(order);
  const resultKey =
    terminal && order
      ? `${order.id || order.code}:${order.state}:${order.processing_state}`
      : null;
  const showResult = Boolean(
    resultKey && !openedFromHistory && dismissedResultKey !== resultKey,
  );
  const providerConfigured = wallet.rampProviders.some(
    provider => provider.id === 'seerbot-vnd' && provider.configured,
  );
  const selectedAsset = wallet.visibleAssets.find(
    asset => asset.assetCode === assetCode,
  );
  const selectedBalance = wallet.balances.find(
    balance =>
      balance.assetCode === assetCode &&
      (balance.assetIssuer || null) === (selectedAsset?.assetIssuer || null),
  );
  const selectedAvailableBalance =
    selectedBalance?.availableBalance || selectedBalance?.balance || '0';
  const selectedReservedBalance =
    selectedBalance?.reservedBalance || selectedBalance?.minimumBalance || null;
  const amountValidation = validateStellarAmount(amount, 'Amount');
  const amountInvalid = Boolean(amount.trim()) && !amountValidation.valid;
  const exceedsWithdrawAvailable =
    direction === 'sell' &&
    amountValidation.valid &&
    amountValidation.amount > parseNumericAmount(selectedAvailableBalance);
  const quoteTotalVnd = Number(quote?.total_vnd || 0);
  const rampPayoutTooSmall =
    direction === 'sell' &&
    Boolean(quote) &&
    quoteTotalVnd > 0 &&
    quoteTotalVnd < MIN_RAMP_PAYOUT_VND;
  const rampAmountWarning = amountInvalid
    ? amountValidation.message
    : rampPayoutTooSmall
    ? `Withdrawal payout must be at least ${formatVnd(
        MIN_RAMP_PAYOUT_VND,
      )}. Increase the crypto amount.`
    : null;
  const selectedBank =
    BANK_OPTIONS.find(bank => bank.bin === bankId) || BANK_OPTIONS[0];
  const normalizedBankSearch = bankSearch.trim().toLowerCase();
  const filteredBanks = BANK_OPTIONS.filter(bank =>
    `${bank.name} ${bank.bin}`.toLowerCase().includes(normalizedBankSearch),
  );
  const defaultPaymentMethod = useMemo(
    () => wallet.paymentMethods.find(method => method.isDefault) || null,
    [wallet.paymentMethods],
  );
  const pendingRampOrders = useMemo(
    () => wallet.rampOrderHistory.filter(item => !isRampOrderTerminal(item)),
    [wallet.rampOrderHistory],
  );
  const pendingRampOrderReferences = useMemo(
    () =>
      pendingRampOrders
        .map(item => item.code || item.id)
        .filter(Boolean)
        .join('|'),
    [pendingRampOrders],
  );
  const withdrawAutoSendStorageKey = useMemo(() => {
    if (!wallet.account || !wallet.activeWalletId) {
      return null;
    }

    return `${WITHDRAW_AUTO_SEND_STORAGE_PREFIX}:${
      wallet.account.id || wallet.account.email
    }:${wallet.activeWalletId}:${wallet.network}`;
  }, [
    wallet.account?.email,
    wallet.account?.id,
    wallet.activeWalletId,
    wallet.network,
  ]);

  function closeBankPicker() {
    setBankPickerVisible(false);
    setBankSearch('');
  }

  function closeSavedPaymentPicker() {
    setSavedPaymentPickerVisible(false);
  }

  function clearQuote() {
    setQuote(null);
    setQuoteSheetVisible(false);
  }

  function persistWithdrawAutoSend(
    nextReference: string | null,
    nextDeadline: number | null,
  ) {
    if (!withdrawAutoSendStorageKey) {
      return;
    }

    if (!nextReference || !nextDeadline) {
      AsyncStorage.removeItem(withdrawAutoSendStorageKey).catch(() => null);
      return;
    }

    AsyncStorage.setItem(
      withdrawAutoSendStorageKey,
      JSON.stringify({
        deadline: nextDeadline,
        reference: nextReference,
      }),
    ).catch(() => null);
  }

  function applyPaymentMethod(method: RampPaymentMethod) {
    appliedDefaultPaymentMethodRef.current = method.id;
    setBankId(method.bankId);
    setFullName(method.fullName);
    setAccountNumber(method.accountNumber);
    clearQuote();
    closeSavedPaymentPicker();
  }

  useEffect(() => {
    if (direction !== 'sell' || order || !defaultPaymentMethod) {
      return;
    }

    if (appliedDefaultPaymentMethodRef.current === defaultPaymentMethod.id) {
      return;
    }

    if (fullName.trim() || accountNumber.trim()) {
      return;
    }

    if (bankId !== '970422' && bankId !== defaultPaymentMethod.bankId) {
      return;
    }

    appliedDefaultPaymentMethodRef.current = defaultPaymentMethod.id;
    setBankId(defaultPaymentMethod.bankId);
    setFullName(defaultPaymentMethod.fullName);
    setAccountNumber(defaultPaymentMethod.accountNumber);
    clearQuote();
  }, [accountNumber, bankId, defaultPaymentMethod, direction, fullName, order]);

  useEffect(() => {
    refreshRampOrderRef.current = wallet.refreshRampOrder;
  }, [wallet.refreshRampOrder]);

  useEffect(() => {
    cancelRampOrderRef.current = wallet.cancelRampOrder;
  }, [wallet.cancelRampOrder]);

  useEffect(() => {
    sendRampOrderPaymentRef.current = wallet.sendRampOrderPayment;
  }, [wallet.sendRampOrderPayment]);

  useEffect(() => {
    let cancelled = false;

    setWithdrawAutoSendDeadline(null);
    setWithdrawAutoSendReference(null);
    withdrawAutoSendStartedRef.current = null;

    if (!withdrawAutoSendStorageKey) {
      return () => {
        cancelled = true;
      };
    }

    AsyncStorage.getItem(withdrawAutoSendStorageKey)
      .then(value => {
        if (cancelled || !value) {
          return;
        }

        const parsed = JSON.parse(value) as {
          deadline?: number;
          reference?: string;
        };

        if (!parsed.reference || !Number.isFinite(Number(parsed.deadline))) {
          AsyncStorage.removeItem(withdrawAutoSendStorageKey).catch(() => null);
          return;
        }

        if (rawOrderReference === parsed.reference) {
          ignoredInitialClosedOrderRef.current = null;
        }
        cancelRampOrderRef
          .current(parsed.reference)
          .then(result => {
            if (result) {
              AsyncStorage.removeItem(withdrawAutoSendStorageKey).catch(
                () => null,
              );
            }
          })
          .catch(() => null);
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [rawOrderReference, withdrawAutoSendStorageKey]);

  useEffect(() => {
    if (ignoringInitialClosedOrder) {
      wallet.clearRampOrder().catch(() => null);
    }
  }, [ignoringInitialClosedOrder, wallet]);

  useEffect(() => {
    if (!order && route?.params) {
      if (route.params.direction) {
        setDirection(route.params.direction);
      }

      if (route.params.assetCode) {
        setAssetCode(route.params.assetCode);
      }

      if (route.params.amount) {
        setAmount(route.params.amount);
      }

      clearQuote();
    }
  }, [
    order,
    route?.params?.amount,
    route?.params?.assetCode,
    route?.params?.direction,
  ]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (
      !order ||
      !withdrawAutoSendDeadline ||
      !withdrawAutoSendReference ||
      orderReference !== withdrawAutoSendReference
    ) {
      return;
    }

    if (terminal || hasSubmittedWithdrawCrypto(order)) {
      setWithdrawAutoSendDeadline(null);
      setWithdrawAutoSendReference(null);
      withdrawAutoSendStartedRef.current = null;
      return;
    }

    if (
      clock < withdrawAutoSendDeadline ||
      withdrawAutoSendStartedRef.current === withdrawAutoSendReference
    ) {
      return;
    }

    withdrawAutoSendStartedRef.current = withdrawAutoSendReference;
    sendRampOrderPaymentRef
      .current(order)
      .then(result => {
        if (result) {
          clearWithdrawAutoSend();
        } else {
          withdrawAutoSendStartedRef.current = null;
        }
      })
      .catch(() => {
        withdrawAutoSendStartedRef.current = null;
      });
  }, [
    clock,
    order,
    orderReference,
    terminal,
    withdrawAutoSendDeadline,
    withdrawAutoSendReference,
  ]);

  useEffect(() => {
    if (
      !order ||
      !withdrawAutoSendDeadline ||
      !withdrawAutoSendReference ||
      orderReference !== withdrawAutoSendReference ||
      terminal ||
      hasSubmittedWithdrawCrypto(order) ||
      withdrawAutoSendStartedRef.current === withdrawAutoSendReference
    ) {
      return;
    }

    const cancelAutoSendOrder = () => {
      const reference = withdrawAutoSendReference;

      setWithdrawAutoSendDeadline(null);
      setWithdrawAutoSendReference(null);
      withdrawAutoSendStartedRef.current = null;
      cancelRampOrderRef
        .current(reference)
        .then(result => {
          if (result) {
            persistWithdrawAutoSend(null, null);
          }
        })
        .catch(() => null);
    };

    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (nextState === 'inactive' || nextState === 'background') {
          cancelAutoSendOrder();
        }
      },
    );
    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        cancelAutoSendOrder();
        return false;
      },
    );

    return () => {
      appStateSubscription.remove();
      backSubscription.remove();
    };
  }, [
    order,
    orderReference,
    terminal,
    withdrawAutoSendDeadline,
    withdrawAutoSendReference,
  ]);

  useEffect(() => {
    if (
      order &&
      withdrawAutoSendReference === orderReference &&
      (terminal || hasSubmittedWithdrawCrypto(order))
    ) {
      clearWithdrawAutoSend();
      return;
    }
  }, [order, orderReference, terminal, withdrawAutoSendReference]);

  useEffect(() => {
    if (!orderReference || terminal) {
      return;
    }

    refreshRampOrderRef.current(orderReference, { silent: true });
    const timer = setInterval(() => {
      refreshRampOrderRef.current(orderReference, { silent: true });
    }, 3000);

    return () => clearInterval(timer);
  }, [orderReference, terminal]);

  useEffect(() => {
    if (order || pendingRampOrders.length === 0) {
      return;
    }

    const refreshPendingOrders = () => {
      pendingRampOrders.forEach(pendingOrder => {
        const pendingReference = pendingOrder.code || pendingOrder.id;

        if (!pendingReference) {
          return;
        }

        refreshRampOrderRef.current(pendingReference, {
          baseOrder: pendingOrder,
          silent: true,
          updateActive: false,
        });
      });
    };

    refreshPendingOrders();
    const timer = setInterval(refreshPendingOrders, 5000);

    return () => clearInterval(timer);
  }, [order, pendingRampOrderReferences, pendingRampOrders]);

  const paymentInfo = useMemo<RampPaymentInfo>(
    () => ({
      accountNumber: accountNumber.trim(),
      accountType: 0,
      bankId: bankId.trim(),
      fullName: fullName.trim().toUpperCase(),
    }),
    [accountNumber, bankId, fullName],
  );

  function resetQuote(next?: {
    assetCode?: RampAssetCode;
    direction?: RampDirection;
  }) {
    if (next?.assetCode) {
      setAssetCode(next.assetCode);
    }

    if (next?.direction) {
      setDirection(next.direction);
    }

    clearQuote();
  }

  function clearWithdrawAutoSend() {
    setWithdrawAutoSendDeadline(null);
    setWithdrawAutoSendReference(null);
    withdrawAutoSendStartedRef.current = null;
    persistWithdrawAutoSend(null, null);
  }

  function scheduleWithdrawAutoSend(nextOrder: RampOrder) {
    const nextReference = nextOrder.code || nextOrder.id;

    if (!nextReference) {
      return;
    }

    withdrawAutoSendStartedRef.current = null;
    setWithdrawAutoSendReference(nextReference);
    const nextDeadline = Date.now() + WITHDRAW_AUTO_SEND_DELAY_MS;
    setWithdrawAutoSendDeadline(nextDeadline);
    persistWithdrawAutoSend(nextReference, nextDeadline);
  }

  function createAnotherOrder() {
    clearQuote();
    setOrderOpenedFromQueue(false);
    setOrderQueueVisible(false);
    wallet.clearRampOrder().catch(() => null);
  }

  function openPendingOrder(pendingOrder: RampOrder) {
    ignoredInitialClosedOrderRef.current = null;
    setOrderOpenedFromQueue(true);
    setOrderQueueVisible(false);
    wallet.openRampOrder(pendingOrder).catch(() => null);
  }

  function closeOrderDetail() {
    if (orderOpenedFromQueue) {
      setOrderOpenedFromQueue(false);
      setOrderQueueVisible(true);
      wallet.clearRampOrder().catch(() => null);
      return;
    }

    onBack();
  }

  async function cancelCurrentOrder(currentReference: string) {
    clearWithdrawAutoSend();
    await wallet.cancelRampOrder(currentReference);
  }

  function renderPendingOrderRow(pendingOrder: RampOrder) {
    const pendingReference = pendingOrder.code || pendingOrder.id || '';
    const pendingExpiredAt = rampTimestampToMs(pendingOrder.expired_at);

    return (
      <Pressable
        accessibilityRole="button"
        key={`${pendingReference}:${pendingOrder.state}:${pendingOrder.processing_state}`}
        onPress={() => openPendingOrder(pendingOrder)}
        style={({ pressed }) => [
          styles.pendingOrderRow,
          pressed ? styles.pendingOrderRowPressed : null,
        ]}
      >
        <View style={styles.pendingOrderIcon}>
          <Ionicons
            color="#B8FF45"
            name={
              pendingOrder.order_type === 'sell'
                ? 'arrow-up-outline'
                : 'arrow-down-outline'
            }
            size={18}
          />
        </View>
        <View style={styles.pendingOrderBody}>
          <Text style={styles.pendingOrderTitle}>
            {pendingOrder.order_type === 'sell' ? 'Withdraw' : 'Buy'}{' '}
            {formatTokenAmount(String(pendingOrder.amount))}{' '}
            {pendingOrder.asset_code}
          </Text>
          <Text numberOfLines={1} style={styles.pendingOrderMeta}>
            {pendingOrder.code || pendingOrder.id} ·{' '}
            {pendingExpiredAt
              ? formatCountdown(pendingExpiredAt)
              : 'No expiry supplied'}
          </Text>
        </View>
        <View style={styles.pendingOrderRight}>
          <Text numberOfLines={1} style={styles.pendingOrderStatus}>
            {getRampOrderStatus(pendingOrder)}
          </Text>
          <Ionicons color="#8A9099" name="chevron-forward" size={17} />
        </View>
      </Pressable>
    );
  }

  async function loadQuote() {
    if (!amountValidation.valid) {
      showPopup({
        message: amountValidation.message || 'Enter a valid amount.',
        title: 'Invalid amount',
        variant: 'warning',
      });
      return;
    }

    const result = await wallet.quoteRamp({
      amount: amountValidation.normalized,
      assetCode,
      direction,
    });

    if (result) {
      setQuote(result);
      setQuoteSheetVisible(true);
    }
  }

  async function createOrderWithValues({
    orderAmount,
    orderAssetCode,
    orderDirection,
  }: {
    orderAmount: string;
    orderAssetCode: RampAssetCode;
    orderDirection: RampDirection;
  }) {
    if (wallet.kyc.status !== 'verified') {
      showPopup({
        actions: [
          { style: 'cancel', text: 'Not now' },
          { onPress: onOpenKyc, text: 'Verify now' },
        ],
        message:
          'Please verify your identity before buying or withdrawing with VND.',
        title: 'You are not verified',
        variant: 'warning',
      });
      return;
    }

    const result = await wallet.createRampOrder({
      amount: orderAmount,
      assetCode: orderAssetCode,
      direction: orderDirection,
      paymentInfo: orderDirection === 'sell' ? paymentInfo : undefined,
    });

    if (result) {
      clearQuote();

      if (
        orderDirection === 'sell' &&
        result.pay_data?.address &&
        !result.sell_transaction_hash &&
        !result.transaction_hash &&
        !isRampOrderTerminal(result)
      ) {
        scheduleWithdrawAutoSend(result);
      } else {
        clearWithdrawAutoSend();
      }
    }
  }

  async function createOrder() {
    if (rampPayoutTooSmall) {
      showPopup({
        message:
          rampAmountWarning ||
          `Withdrawal payout must be at least ${formatVnd(
            MIN_RAMP_PAYOUT_VND,
          )}.`,
        title: 'Withdrawal too small',
        variant: 'warning',
      });
      return;
    }

    await createOrderWithValues({
      orderAmount: amountValidation.valid
        ? amountValidation.normalized
        : amount,
      orderAssetCode: assetCode,
      orderDirection: direction,
    });
  }

  useEffect(() => {
    if (
      !route?.params?.autoCreate ||
      order ||
      ignoringInitialClosedOrder ||
      wallet.isBusy ||
      !wallet.serverSessionReady ||
      !providerConfigured
    ) {
      return;
    }

    const orderAmount = route.params.amount || amount;
    const orderAssetCode = route.params.assetCode || assetCode;
    const orderDirection = route.params.direction || direction;
    const autoCreateKey = `${orderDirection}:${orderAssetCode}:${orderAmount}`;
    if (autoCreateAttemptedRef.current === autoCreateKey) {
      return;
    }

    autoCreateAttemptedRef.current = autoCreateKey;
    createOrderWithValues({
      orderAmount,
      orderAssetCode,
      orderDirection,
    }).catch(() => {
      autoCreateAttemptedRef.current = null;
    });
  }, [
    amount,
    assetCode,
    direction,
    ignoringInitialClosedOrder,
    order,
    providerConfigured,
    route?.params?.amount,
    route?.params?.assetCode,
    route?.params?.autoCreate,
    route?.params?.direction,
    wallet.serverSessionReady,
    wallet.isBusy,
  ]);

  function copyTransferValue(label: string, value?: string | number | null) {
    const text = String(value ?? '').trim();

    if (!text || text === '-' || /^waiting/i.test(text)) {
      return;
    }

    Clipboard.setString(text);
    showPopup({
      message: `${label} copied to clipboard.`,
      title: 'Copied',
      variant: 'success',
    });
  }

  async function savePaymentQr(qrUrl?: string | null, orderCode?: string) {
    if (!qrUrl) {
      return;
    }

    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true, [
        'photo',
      ]);

      if (!permission.granted) {
        showPopup({
          message: 'Allow photo library access to save the payment QR.',
          title: 'Permission needed',
          variant: 'warning',
        });
        return;
      }

      if (!FileSystem.cacheDirectory) {
        throw new Error('Cache directory is unavailable.');
      }

      const safeOrderCode = String(orderCode || Date.now()).replace(
        /[^a-zA-Z0-9_-]/g,
        '',
      );
      const fileUri = `${FileSystem.cacheDirectory}payment-qr-${safeOrderCode}.png`;
      const download = await FileSystem.downloadAsync(qrUrl, fileUri);

      await MediaLibrary.saveToLibraryAsync(download.uri);
      showPopup({
        message: 'Payment QR saved to your Photos/Gallery.',
        title: 'Saved',
        variant: 'success',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not save payment QR.';

      showPopup({
        message,
        title: 'Save failed',
        variant: 'danger',
      });
    }
  }

  async function markBankTransferSubmitted(reference: string) {
    if (!reference) {
      return;
    }

    if (bankTransferCheckingReference === reference) {
      return;
    }

    setBankTransferMarkedReference(reference);
    setBankTransferCheckingReference(reference);

    const latestOrder = await wallet
      .refreshRampOrder(reference, {
        silent: true,
      })
      .finally(() => {
        setBankTransferCheckingReference(current =>
          current === reference ? null : current,
        );
      });

    if (!latestOrder) {
      showPopup({
        message:
          'Your transfer is noted here, but the provider could not be checked right now. Keep this order open and try again in a moment.',
        title: 'Transfer noted',
        variant: 'warning',
      });
      return;
    }

    const latestCompleted = Number(latestOrder.state) === 3;
    const latestPaymentConfirmed =
      Number(latestOrder.processing_state) === 11 || latestCompleted;

    showPopup({
      message: latestCompleted
        ? 'The provider confirmed this order. Your wallet balance will refresh automatically.'
        : latestPaymentConfirmed
        ? 'The provider has detected the VND payment and is processing the order.'
        : 'The app checked the provider again. The order is still waiting for bank/provider confirmation.',
      title: latestCompleted
        ? 'Payment confirmed'
        : latestPaymentConfirmed
        ? 'Transfer confirmed'
        : 'Transfer noted',
      variant: latestPaymentConfirmed ? 'success' : 'info',
    });
  }

  if (order) {
    const bankInfo = order.body?.bankInfo;
    const isSell = order.order_type === 'sell';
    const transferAmount = formatVnd(bankInfo?.vaAmount);
    const transferBankName = bankInfo?.bankName || 'Waiting for provider';
    const transferAccountName = bankInfo?.bankAccountName || '-';
    const transferAccountNumber = bankInfo?.bankAccountNumber || '-';
    const transferContent = bankInfo?.transferContent || order.code;
    const canBypassTestPayment =
      !wallet.isMainnet &&
      !isSell &&
      Number(order.state) === 1 &&
      Number(order.processing_state) === 10;
    const canBypassTestSellPayment = !wallet.isMainnet && isSell && !terminal;
    const canMarkBankTransfer = !isSell && !terminal && !canBypassTestPayment;
    const bankTransferMarked =
      canMarkBankTransfer && bankTransferMarkedReference === orderReference;
    const bankTransferChecking =
      canMarkBankTransfer && bankTransferCheckingReference === orderReference;
    const expiredAt = rampTimestampToMs(order.expired_at);
    const transactionHash =
      order.sell_transaction_hash || order.transaction_hash || '';
    const explorerUrl = transactionHash
      ? `https://stellar.expert/explorer/${
          wallet.isMainnet ? 'public' : 'testnet'
        }/tx/${transactionHash}`
      : null;
    const isCompleted = Number(order.state) === 3;
    const isFailedOrCancelled =
      Number(order.state) === 4 || Number(order.state) === 5;

    const stateLabel =
      RAMP_STATE_LABELS[Number(order.state)] || 'Unknown status';
    const processingLabel =
      RAMP_PROCESSING_LABELS[Number(order.processing_state)] ||
      'Waiting for provider';
    const orderAction = isSell ? 'Withdraw' : 'Buy';
    const cryptoTransferSubmitted = hasSubmittedWithdrawCrypto(order);
    const canCancelOrder = !terminal && !cryptoTransferSubmitted;
    const waitingForAutoSend =
      canCancelOrder &&
      isSell &&
      withdrawAutoSendReference === orderReference &&
      Boolean(withdrawAutoSendDeadline) &&
      withdrawAutoSendStartedRef.current !== orderReference;
    const autoSendSecondsRemaining =
      waitingForAutoSend && withdrawAutoSendDeadline
        ? Math.max(0, Math.ceil((withdrawAutoSendDeadline - clock) / 1000))
        : 0;
    const autoSendInProgress =
      canCancelOrder &&
      isSell &&
      withdrawAutoSendReference === orderReference &&
      withdrawAutoSendStartedRef.current === orderReference;

    return (
      <View style={styles.orderScreen}>
        <ScrollView
          contentContainerStyle={screenInsetStyle}
          style={{ backgroundColor: '#000000' }}
          showsVerticalScrollIndicator={false}
        >
          <ModernScreenHeader
            onBack={waitingForAutoSend ? undefined : closeOrderDetail}
            subtitle={`${wallet.isMainnet ? 'Mainnet' : 'Testnet'} · ${
              isSell ? 'Withdraw to bank' : 'Buy with VND'
            } ${order.asset_code}`}
            title={`${orderAction} order`}
          />

          <View style={modern.sectionCard}>
            <View style={styles.statusHeader}>
              {isCompleted ? (
                <SuccessLottie size={52} style={styles.statusSuccessAnimation} />
              ) : (
                <View style={styles.statusIcon}>
                  <Ionicons
                    color={isFailedOrCancelled ? '#D84C5F' : '#F59E0B'}
                    name={isFailedOrCancelled ? 'close-circle' : 'time'}
                    size={30}
                  />
                </View>
              )}
              <View style={modern.assetModernBody}>
                <Text style={modern.assetModernName}>
                  {getRampOrderStatus(order)}
                </Text>
                <Text selectable style={modern.assetModernMeta}>
                  {order.code} · {formatCountdown(expiredAt)}
                </Text>
              </View>
            </View>
            <View style={modern.reviewModernBox}>
              <ModernInfoLine
                label={isSell ? 'You withdraw' : 'You buy'}
                value={`${formatTokenAmount(String(order.amount))} ${
                  order.asset_code
                }`}
              />
              <ModernInfoLine
                label="Network"
                value={
                  wallet.isMainnet
                    ? 'Mainnet · real value'
                    : 'Testnet · testing only'
                }
              />
            </View>
          </View>

          <View style={modern.sectionCard}>
            <SectionHeader title="Order details" />
            <ModernInfoLine label="Status" value={stateLabel} />
            <ModernInfoLine label="Current step" value={processingLabel} />
            <ModernInfoLine label="Order ID" value={String(order.id || '-')} />
            <ModernInfoLine label="Payment code" value={order.code || '-'} />
          </View>

          {!isSell ? (
            <View style={modern.sectionCard}>
              <SectionHeader
                action={
                  order.body?.qr_link ? (
                    <PressScale
                      onPress={() =>
                        savePaymentQr(order.body?.qr_link, order.code)
                      }
                      style={styles.saveQrInlineButton}
                    >
                      <Ionicons
                        color="#B8FF45"
                        name="download-outline"
                        size={14}
                      />
                      <Text style={styles.saveQrInlineText}>Save QR</Text>
                    </PressScale>
                  ) : null
                }
                title="Transfer VND"
              />
              <Text style={styles.transferExactHint}>
                Transfer exact amount and content before the countdown expires.
              </Text>
              {order.body?.qr_link ? (
                <View style={styles.remoteQrCard}>
                  <Image
                    resizeMode="contain"
                    source={{ uri: order.body.qr_link }}
                    style={styles.remoteQr}
                  />
                </View>
              ) : null}
              <View style={styles.transferPriorityStack}>
                <TransferPriorityCopyCard
                  label="Amount"
                  onPress={() => copyTransferValue('Amount', transferAmount)}
                  value={transferAmount}
                />
                <TransferPriorityCopyCard
                  label="Account number"
                  onPress={() =>
                    copyTransferValue('Account number', transferAccountNumber)
                  }
                  value={transferAccountNumber}
                />
                <TransferPriorityCopyCard
                  label="Transfer content"
                  onPress={() =>
                    copyTransferValue('Transfer content', transferContent)
                  }
                  value={transferContent}
                />
                <TransferPriorityCopyCard
                  label="Bank"
                  onPress={() => copyTransferValue('Bank', transferBankName)}
                  value={transferBankName}
                />
                <TransferPriorityCopyCard
                  label="Account name"
                  onPress={() =>
                    copyTransferValue('Account name', transferAccountName)
                  }
                  value={transferAccountName}
                />
              </View>
              {canMarkBankTransfer ? (
                <View
                  style={[
                    styles.bankTransferConfirmBox,
                    bankTransferMarked
                      ? styles.bankTransferConfirmBoxMarked
                      : null,
                  ]}
                >
                  <View style={styles.bankTransferConfirmCopy}>
                    <Text style={styles.bankTransferConfirmTitle}>
                      {bankTransferMarked
                        ? 'Transfer marked'
                        : 'After sending VND'}
                    </Text>
                    <Text style={styles.bankTransferConfirmText}>
                      {bankTransferMarked
                        ? 'The app will keep checking provider confirmation for this order.'
                        : 'Tap after you have sent the exact amount and content.'}
                    </Text>
                  </View>
                  <PressScale
                    disabled={wallet.isBusy || bankTransferChecking}
                    onPress={() => markBankTransferSubmitted(orderReference)}
                    style={styles.bankTransferConfirmButton}
                  >
                    <Ionicons
                      color="#101400"
                      name={
                        bankTransferChecking
                          ? 'time'
                          : bankTransferMarked
                          ? 'refresh'
                          : 'checkmark-circle'
                      }
                      size={17}
                    />
                    <Text
                      adjustsFontSizeToFit
                      numberOfLines={1}
                      style={styles.bankTransferConfirmButtonText}
                    >
                      {bankTransferChecking
                        ? 'Checking...'
                        : bankTransferMarked
                        ? 'Check again'
                        : "I've transferred"}
                    </Text>
                  </PressScale>
                </View>
              ) : null}
              {canBypassTestPayment ? (
                <View style={styles.testPaymentBox}>
                  <View style={styles.testPaymentCopy}>
                    <Text style={styles.testPaymentTitle}>Testnet only</Text>
                    <Text style={styles.testPaymentText}>
                      Confirm the VND payment without a real bank transfer. This
                      action is unavailable on Mainnet.
                    </Text>
                  </View>
                  <PressScale
                    disabled={wallet.isBusy}
                    onPress={() =>
                      wallet.bypassRampOrderPayment(orderReference)
                    }
                    style={modern.secondaryModernButton}
                  >
                    <Text
                      style={[
                        modern.modernButtonText,
                        modern.secondaryModernButtonText,
                      ]}
                    >
                      Confirm test buy
                    </Text>
                  </PressScale>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={modern.sectionCard}>
              <SectionHeader title="Complete withdrawal" />
              <Text style={modern.emptyModernText}>
                {waitingForAutoSend
                  ? `Crypto will be sent automatically in ${autoSendSecondsRemaining}s unless you cancel this order.`
                  : 'The app opens the crypto signing step automatically after this withdrawal order is created.'}
              </Text>
              <View style={modern.reviewModernBox}>
                <ModernInfoLine
                  label="Amount"
                  value={`${formatTokenAmount(String(order.amount))} ${
                    order.asset_code
                  }`}
                />
                <ModernInfoLine
                  label="Address"
                  value={
                    order.pay_data?.address
                      ? shortAddress(order.pay_data.address)
                      : 'Waiting for provider'
                  }
                />
                <ModernInfoLine label="Memo" value={order.code} />
                <ModernInfoLine
                  label="Bank payout"
                  value={
                    order.payment_info?.bank_account_no ||
                    order.payment_info?.account_number ||
                    paymentInfo.accountNumber ||
                    '-'
                  }
                />
              </View>
              <Text selectable style={modern.infoValue}>
                {order.pay_data?.address || ''}
              </Text>
              {canBypassTestSellPayment ? (
                <View style={styles.testPaymentBox}>
                  <View style={styles.testPaymentCopy}>
                    <Text style={styles.testPaymentTitle}>Testnet only</Text>
                    <Text style={styles.testPaymentText}>
                      Confirm crypto receipt without sending Testnet assets.
                      This triggers the provider's test withdrawal flow.
                    </Text>
                  </View>
                  <PressScale
                    disabled={wallet.isBusy}
                    onPress={() => wallet.bypassRampSellPayment(orderReference)}
                    style={modern.secondaryModernButton}
                  >
                    <Text
                      style={[
                        modern.modernButtonText,
                        modern.secondaryModernButtonText,
                      ]}
                    >
                      Confirm test withdrawal
                    </Text>
                  </PressScale>
                </View>
              ) : null}
            </View>
          )}

          <View style={modern.sectionCard}>
            <SectionHeader title="Order actions" />
            <View style={styles.orderActionsStack}>
              {!waitingForAutoSend && !autoSendInProgress ? (
                <PressScale
                  onPress={createAnotherOrder}
                  style={modern.primaryModernButton}
                >
                  <Text style={modern.modernButtonText}>
                    Create another order
                  </Text>
                </PressScale>
              ) : null}
              {waitingForAutoSend ? (
                <PressScale
                  disabled={wallet.isBusy}
                  onPress={() => cancelCurrentOrder(orderReference)}
                  style={styles.autoSendCancelButton}
                >
                  <Ionicons color="#FFFFFF" name="warning-outline" size={19} />
                  <Text style={styles.autoSendCancelButtonText}>
                    Cancel order · sending in {autoSendSecondsRemaining}s
                  </Text>
                </PressScale>
              ) : autoSendInProgress ? (
                <View style={styles.orderLockedBox}>
                  <Ionicons color="#B8FF45" name="sync-outline" size={18} />
                  <Text style={styles.orderLockedText}>
                    Sending crypto transfer. This order can no longer be
                    cancelled in the app.
                  </Text>
                </View>
              ) : !terminal && cryptoTransferSubmitted ? (
                <View style={styles.orderLockedBox}>
                  <Ionicons
                    color="#24495A"
                    name="lock-closed-outline"
                    size={18}
                  />
                  <Text style={styles.orderLockedText}>
                    Crypto transfer submitted. This order can no longer be
                    cancelled in the app.
                  </Text>
                </View>
              ) : null}
            </View>
            {explorerUrl ? (
              <View style={styles.orderExplorerWrap}>
                <ExplorerLink onPress={() => wallet.openUrl(explorerUrl)} />
              </View>
            ) : null}
          </View>
        </ScrollView>

        {showResult ? (
          <View style={styles.resultOverlay}>
            <View accessibilityViewIsModal style={styles.resultModal}>
              <View style={styles.resultContent}>
                {isCompleted ? (
                  <SuccessLottie
                    size={86}
                    style={styles.resultSuccessAnimation}
                  />
                ) : (
                  <View
                    style={[
                      styles.resultIcon,
                      Number(order.state) === 5
                        ? styles.resultIconCancelled
                        : styles.resultIconFailure,
                    ]}
                  >
                    <Ionicons
                      color={Number(order.state) === 5 ? '#A1B0C8' : '#FF5252'}
                      name={Number(order.state) === 5 ? 'remove' : 'close'}
                      size={25}
                    />
                  </View>
                )}
                <Text style={styles.resultTitle}>
                  {isCompleted
                    ? 'Order completed'
                    : Number(order.state) === 5
                    ? 'Order cancelled'
                    : 'Order failed'}
                </Text>
                <Text style={styles.resultText}>
                  {isCompleted
                    ? `${isSell ? 'Withdraw' : 'Buy'} ${formatTokenAmount(
                        String(order.amount),
                      )} ${order.asset_code} completed successfully.`
                    : Number(order.state) === 5
                    ? 'This payment order was cancelled.'
                    : 'The payment provider could not complete this order.'}
                </Text>
                <View style={styles.resultOrderBadge}>
                  <Text style={styles.resultOrderLabel}>ORDER</Text>
                  <Text selectable style={styles.resultOrderId}>
                    #{String(order.id || '-')}
                  </Text>
                </View>
              </View>

              <View style={styles.resultActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (resultKey) {
                      setDismissedResultKey(resultKey);
                    }
                    wallet.clearRampOrder().catch(() => null);
                  }}
                  style={({ pressed }) => [
                    styles.resultPrimaryAction,
                    pressed ? styles.resultPrimaryActionPressed : null,
                  ]}
                >
                  <Text style={styles.resultPrimaryActionText}>Done</Text>
                </Pressable>
                {explorerUrl ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => wallet.openUrl(explorerUrl)}
                    style={({ pressed }) => [
                      styles.resultSecondaryAction,
                      pressed ? styles.resultSecondaryActionPressed : null,
                    ]}
                  >
                    <Text style={styles.resultSecondaryActionText}>
                      View transaction
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  const validSellForm =
    direction === 'buy' ||
    (/^\d{6}$/.test(paymentInfo.bankId) &&
      /^[A-Z0-9 ]{2,100}$/.test(paymentInfo.fullName) &&
      /^\d{4,30}$/.test(paymentInfo.accountNumber));
  const canCreate =
    providerConfigured &&
    wallet.serverSessionReady &&
    Boolean(quote) &&
    (direction === 'buy' || quoteTotalVnd >= MIN_RAMP_PAYOUT_VND) &&
    !exceedsWithdrawAvailable &&
    !amountInvalid &&
    validSellForm &&
    Boolean(wallet.wallet) &&
    (direction === 'buy' || wallet.walletCanSign);
  const quotedAssetAmount = formatTokenAmount(
    amountValidation.valid ? amountValidation.normalized : amount,
  );

  function handlePrimaryRampAction() {
    if (!quote) {
      loadQuote().catch(() => null);
      return;
    }

    setQuoteSheetVisible(true);
  }

  if (orderQueueVisible && !order) {
    return (
      <ScrollView
        contentContainerStyle={screenInsetStyle}
        style={{ backgroundColor: '#000000' }}
        showsVerticalScrollIndicator={false}
      >
        <ModernScreenHeader
          onBack={() => setOrderQueueVisible(false)}
          subtitle="Orders waiting for provider confirmation."
          title="Pending cash orders"
        />

        <View style={modern.sectionCard}>
          {pendingRampOrders.length > 0 ? (
            <View style={styles.pendingOrderList}>
              {pendingRampOrders.map(renderPendingOrderRow)}
            </View>
          ) : (
            <View style={modern.emptyModern}>
              <Ionicons color="#8A9099" name="time-outline" size={28} />
              <Text style={modern.emptyModernTitle}>No pending orders</Text>
              <Text style={modern.emptyModernText}>
                Buy and withdraw orders waiting for completion will appear here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={screenInsetStyle}
        style={{ backgroundColor: '#000000' }}
        showsVerticalScrollIndicator={false}
      >
        <ModernScreenHeader
          action={
            pendingRampOrders.length > 0 ? (
              <PressScale
                onPress={() => setOrderQueueVisible(true)}
                style={styles.orderQueueButton}
              >
                <Ionicons color="#FFFFFF" name="time-outline" size={20} />
                <View style={styles.orderQueueBadge}>
                  <Text style={styles.orderQueueBadgeText}>
                    {pendingRampOrders.length > 9
                      ? '9+'
                      : pendingRampOrders.length}
                  </Text>
                </View>
              </PressScale>
            ) : null
          }
          onBack={onBack}
          subtitle={
            wallet.isMainnet
              ? 'Buy crypto with VND or withdraw VND to your bank account.'
              : 'Test the same buy and withdrawal flow with Testnet assets.'
          }
          title="Buy & withdraw"
        />

        {!providerConfigured ? (
          <View style={modern.sectionCard}>
            <Text style={modern.emptyModernTitle}>
              Buy and withdraw unavailable
            </Text>
            <Text style={modern.emptyModernText}>
              VND buy and withdrawal are temporarily unavailable. Please try
              again later.
            </Text>
          </View>
        ) : null}

        <View style={modern.formCard}>
          <View style={modern.segmented}>
            {(['buy', 'sell'] as RampDirection[]).map(item => (
              <Pressable
                key={item}
                onPress={() => resetQuote({ direction: item })}
                style={[
                  modern.segmentItem,
                  direction === item ? modern.segmentItemActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    direction === item ? styles.segmentTextActive : null,
                  ]}
                >
                  {item === 'buy' ? 'Buy with VND' : 'Withdraw to bank'}
                </Text>
              </Pressable>
            ))}
          </View>

          <SectionHeader title="Asset and amount" />
          <View style={styles.assetChoices}>
            {(['XLM', 'USDC'] as RampAssetCode[]).map(code => {
              const selected = code === assetCode;

              return (
                <Pressable
                  key={code}
                  onPress={() => resetQuote({ assetCode: code })}
                  style={[
                    styles.assetChoice,
                    selected ? styles.assetChoiceActive : null,
                  ]}
                >
                  <TokenIcon assetCode={code} />
                  <Text
                    style={[
                      styles.assetChoiceText,
                      selected ? styles.assetChoiceTextActive : null,
                    ]}
                  >
                    {code}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={value => {
              setAmount(value);
              clearQuote();
            }}
            placeholder="Crypto amount"
            placeholderTextColor="#A7B3BA"
            style={modern.modernInput}
            value={amount}
          />
          {direction === 'sell' ? (
            <View style={styles.availableBox}>
              <Text style={modern.assetModernMeta}>
                Balance: {formatTokenAmount(selectedBalance?.balance || '0')}{' '}
                {assetCode}
              </Text>
              <Text style={styles.availableText}>
                Available to withdraw:{' '}
                {formatTokenAmount(selectedAvailableBalance)} {assetCode}
              </Text>
              {assetCode === 'XLM' && selectedReservedBalance ? (
                <Text style={modern.assetModernMeta}>
                  Reserved by Stellar:{' '}
                  {formatTokenAmount(selectedReservedBalance)} XLM
                </Text>
              ) : null}
              {exceedsWithdrawAvailable ? (
                <View style={styles.feeWarning}>
                  <Ionicons color="#A25C00" name="warning-outline" size={18} />
                  <Text style={styles.feeWarningText}>
                    Enter {formatTokenAmount(selectedAvailableBalance)}{' '}
                    {assetCode} or less. Stellar keeps reserve and network fees
                    aside.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {direction === 'sell' ? (
            <>
              <View style={styles.bankHeaderRow}>
                <SectionHeader title="Bank account" />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    wallet
                      .loadPaymentMethods({ silent: true })
                      .catch(() => null);
                    setSavedPaymentPickerVisible(true);
                  }}
                  style={({ pressed }) => [
                    styles.savedBankButton,
                    pressed ? styles.savedBankButtonPressed : null,
                  ]}
                >
                  <Ionicons color="#B8FF45" name="card-outline" size={16} />
                  <Text style={styles.savedBankButtonText}>
                    Saved {wallet.paymentMethods.length || ''}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setBankPickerVisible(true)}
                style={({ pressed }) => [
                  styles.selectedBankField,
                  pressed ? styles.selectedBankFieldPressed : null,
                ]}
              >
                <View style={styles.bankLogoBox}>
                  <Image
                    resizeMode="contain"
                    source={selectedBank.image}
                    style={styles.bankLogo}
                  />
                </View>
                <View style={styles.bankOptionCopy}>
                  <Text style={styles.bankFieldLabel}>Bank</Text>
                  <Text style={styles.bankName}>{selectedBank.name}</Text>
                  <Text style={styles.bankBin}>BIN {selectedBank.bin}</Text>
                </View>
                <Ionicons color="#64747D" name="chevron-down" size={20} />
              </Pressable>
              <TextInput
                autoCapitalize="characters"
                onChangeText={value => {
                  setFullName(value);
                  clearQuote();
                }}
                placeholder="Account holder name without accents"
                placeholderTextColor="#A7B3BA"
                style={modern.modernInput}
                value={fullName}
              />
              <TextInput
                keyboardType="number-pad"
                onChangeText={value => {
                  setAccountNumber(value.replace(/\D/g, ''));
                  clearQuote();
                }}
                placeholder="Account number"
                placeholderTextColor="#A7B3BA"
                style={modern.modernInput}
                value={accountNumber}
              />
              <Text style={modern.assetModernMeta}>
                VND will be sent to this bank account after the crypto transfer
                is confirmed.
              </Text>
            </>
          ) : null}

          {rampAmountWarning ? (
            <View style={styles.feeWarning}>
              <Ionicons color="#A25C00" name="warning-outline" size={18} />
              <Text style={styles.feeWarningText}>{rampAmountWarning}</Text>
            </View>
          ) : null}

          <PressScale
            disabled={
              wallet.isBusy ||
              !providerConfigured ||
              !amountValidation.valid ||
              exceedsWithdrawAvailable ||
              rampPayoutTooSmall ||
              !validSellForm ||
              (Boolean(quote) && !canCreate)
            }
            onPress={handlePrimaryRampAction}
            style={modern.primaryModernButton}
          >
            <Text style={modern.modernButtonText}>
              {quote
                ? !wallet.serverSessionReady
                  ? 'Syncing wallet session'
                  : canCreate
                  ? 'Review VND quote'
                  : exceedsWithdrawAvailable
                  ? 'Amount exceeds available balance'
                  : rampPayoutTooSmall ||
                    (direction === 'sell' && Number(quote.total_vnd) <= 0)
                  ? 'Withdrawal amount is too small'
                  : 'Complete required details'
                : amountInvalid
                ? 'Enter valid amount'
                : 'Get VND quote'}
            </Text>
          </PressScale>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setQuoteSheetVisible(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={quoteSheetVisible && Boolean(quote)}
      >
        <View style={modern.swapConfirmOverlay}>
          <Pressable
            onPress={() => setQuoteSheetVisible(false)}
            style={modern.swapConfirmBackdrop}
          />
          <View style={[modern.swapConfirmSheet, styles.quoteSheet]}>
            <View style={modern.swapConfirmHandle} />
            <View style={modern.swapConfirmHeader}>
              <Text style={modern.swapConfirmTitle}>
                {direction === 'buy' ? 'Confirm buy' : 'Confirm withdrawal'}
              </Text>
              <View style={modern.swapConfirmCloseSlot}>
                <PressScale
                  onPress={() => setQuoteSheetVisible(false)}
                  style={modern.swapConfirmClose}
                >
                  <Ionicons color="#FFFFFF" name="close" size={18} />
                </PressScale>
              </View>
            </View>

            {quote ? (
              <>
                <View style={modern.swapConfirmAmounts}>
                  {direction === 'buy' ? (
                    <>
                      <Text
                        adjustsFontSizeToFit
                        minimumFontScale={0.72}
                        numberOfLines={1}
                        style={modern.swapConfirmAmount}
                      >
                        {formatVnd(quote.total_vnd)}
                      </Text>
                      <View style={modern.swapConfirmTokenBadge}>
                        <Text style={modern.swapConfirmTokenText}>
                          VND PAYMENT
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text
                        adjustsFontSizeToFit
                        minimumFontScale={0.72}
                        numberOfLines={1}
                        style={modern.swapConfirmAmount}
                      >
                        {quotedAssetAmount}
                      </Text>
                      <View style={modern.swapConfirmTokenBadge}>
                        <TokenIcon
                          assetCode={assetCode}
                          imageUrl={selectedAsset?.image}
                          size={14}
                        />
                        <Text style={modern.swapConfirmTokenText}>
                          {assetCode}
                        </Text>
                      </View>
                    </>
                  )}

                  <View style={modern.swapConfirmArrowCircle}>
                    <Ionicons color="#B8FF45" name="arrow-down" size={22} />
                  </View>

                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                    numberOfLines={1}
                    style={modern.swapConfirmReceiveAmount}
                  >
                    {direction === 'buy'
                      ? quotedAssetAmount
                      : formatVnd(quote.total_vnd)}
                  </Text>
                  <View style={modern.swapConfirmTokenBadge}>
                    {direction === 'buy' ? (
                      <>
                        <TokenIcon
                          assetCode={assetCode}
                          imageUrl={selectedAsset?.image}
                          size={14}
                        />
                        <Text style={modern.swapConfirmTokenText}>
                          {assetCode}
                        </Text>
                      </>
                    ) : (
                      <Text style={modern.swapConfirmTokenText}>VND PAYOUT</Text>
                    )}
                  </View>
                </View>

                <View style={modern.swapConfirmDetails}>
                  <View style={modern.swapConfirmDetailRow}>
                    <Text style={modern.swapConfirmDetailLabel}>Rate</Text>
                    <Text style={modern.swapConfirmDetailValue}>
                      {formatVnd(quote.rate)} / {quote.asset_code}
                    </Text>
                  </View>
                  <View style={modern.swapConfirmDetailRow}>
                    <Text style={modern.swapConfirmDetailLabel}>Gross</Text>
                    <Text style={modern.swapConfirmDetailValue}>
                      {formatVnd(quote.gross_vnd)}
                    </Text>
                  </View>
                  <View style={modern.swapConfirmDetailRow}>
                    <Text style={modern.swapConfirmDetailLabel}>Fee</Text>
                    <Text style={modern.swapConfirmDetailValue}>
                      {formatVnd(quote.fee_vnd)}
                    </Text>
                  </View>
                  {direction === 'buy' ? (
                    <View style={modern.swapConfirmDetailRow}>
                      <Text style={modern.swapConfirmDetailLabel}>
                        You transfer
                      </Text>
                      <Text style={modern.swapConfirmDetailValue}>
                        {formatVnd(quote.total_vnd)}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View style={modern.swapConfirmDetailRow}>
                        <Text style={modern.swapConfirmDetailLabel}>Bank</Text>
                        <Text style={modern.swapConfirmDetailValue}>
                          {selectedBank.name}
                        </Text>
                      </View>
                      <View style={modern.swapConfirmDetailRow}>
                        <Text style={modern.swapConfirmDetailLabel}>
                          Account
                        </Text>
                        <Text style={modern.swapConfirmDetailValue}>
                          {paymentInfo.accountNumber}
                        </Text>
                      </View>
                      <View style={modern.swapConfirmDetailRow}>
                        <Text style={modern.swapConfirmDetailLabel}>Name</Text>
                        <Text style={modern.swapConfirmDetailValue}>
                          {paymentInfo.fullName}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {quote.gross_vnd > 0 &&
                quote.fee_vnd / quote.gross_vnd >= 0.5 ? (
                  <View style={styles.feeWarning}>
                    <Ionicons
                      color="#A25C00"
                      name="warning-outline"
                      size={18}
                    />
                    <Text style={styles.feeWarningText}>
                      {direction === 'buy'
                        ? 'The fee uses a large part of this buy. Increase the crypto amount for a better quote.'
                        : 'The fee uses a large part of this withdrawal. Increase the crypto amount for a better payout.'}
                    </Text>
                  </View>
                ) : null}

                {rampAmountWarning ? (
                  <View style={styles.feeWarning}>
                    <Ionicons
                      color="#A25C00"
                      name="warning-outline"
                      size={18}
                    />
                    <Text style={styles.feeWarningText}>
                      {rampAmountWarning}
                    </Text>
                  </View>
                ) : null}

                <Text style={modern.swapConfirmNote}>
                  {direction === 'buy'
                    ? 'Final values come from the order response. After you create the order, transfer the exact VND amount and content shown.'
                    : 'Final values come from the order response. After you confirm, the app opens the crypto signing step automatically.'}
                </Text>

                <PressScale
                  disabled={wallet.isBusy || !canCreate}
                  onPress={createOrder}
                  style={modern.swapConfirmButton}
                >
                  <Text style={modern.swapConfirmButtonText}>
                    {wallet.isBusy
                      ? 'CREATING...'
                      : direction === 'buy'
                      ? 'CREATE BUY ORDER'
                      : 'CREATE WITHDRAWAL'}
                  </Text>
                </PressScale>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={closeBankPicker}
        transparent
        visible={bankPickerVisible}
      >
        <View style={styles.bankSheetOverlay}>
          <Pressable
            accessibilityLabel="Close bank picker"
            onPress={closeBankPicker}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.bankSheet}>
            <View style={styles.bankSheetHandle} />
            <View style={styles.bankSheetHeader}>
              <View>
                <Text style={styles.bankSheetTitle}>Select bank</Text>
                <Text style={styles.bankSheetSubtitle}>
                  Choose where you want to receive VND
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={closeBankPicker}
                style={styles.bankSheetClose}
              >
                <Ionicons color="#4B555C" name="close" size={21} />
              </Pressable>
            </View>

            <View style={styles.bankSearchBox}>
              <Ionicons color="#84939B" name="search" size={19} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setBankSearch}
                placeholder="Search bank name or BIN"
                placeholderTextColor="#9AA6AD"
                style={styles.bankSearchInput}
                value={bankSearch}
              />
              {bankSearch ? (
                <Pressable
                  accessibilityLabel="Clear bank search"
                  onPress={() => setBankSearch('')}
                >
                  <Ionicons color="#84939B" name="close-circle" size={19} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              contentContainerStyle={styles.bankList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredBanks.map(bank => {
                const selected = bankId === bank.bin;

                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={bank.bin}
                    onPress={() => {
                      setBankId(bank.bin);
                      clearQuote();
                      closeBankPicker();
                    }}
                    style={({ pressed }) => [
                      styles.bankOption,
                      selected ? styles.bankOptionSelected : null,
                      pressed ? styles.bankOptionPressed : null,
                    ]}
                  >
                    <View style={styles.bankLogoBox}>
                      <Image
                        resizeMode="contain"
                        source={bank.image}
                        style={styles.bankLogo}
                      />
                    </View>
                    <View style={styles.bankOptionCopy}>
                      <Text style={styles.bankName}>{bank.name}</Text>
                      <Text style={styles.bankBin}>BIN {bank.bin}</Text>
                    </View>
                    <View
                      style={[
                        styles.bankCheck,
                        selected ? styles.bankCheckSelected : null,
                      ]}
                    >
                      {selected ? (
                        <Ionicons color="#FFFFFF" name="checkmark" size={15} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}

              {filteredBanks.length === 0 ? (
                <View style={styles.bankEmpty}>
                  <Ionicons color="#9AA6AD" name="search-outline" size={25} />
                  <Text style={styles.bankEmptyTitle}>No bank found</Text>
                  <Text style={styles.bankEmptyText}>
                    Try searching with another name or BIN.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={closeSavedPaymentPicker}
        transparent
        visible={savedPaymentPickerVisible}
      >
        <View style={styles.bankSheetOverlay}>
          <Pressable
            accessibilityLabel="Close saved payment methods"
            onPress={closeSavedPaymentPicker}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.bankSheet}>
            <View style={styles.bankSheetHandle} />
            <View style={styles.bankSheetHeader}>
              <View>
                <Text style={styles.bankSheetTitle}>Saved payment methods</Text>
                <Text style={styles.bankSheetSubtitle}>
                  Choose a saved bank account for this withdrawal.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={closeSavedPaymentPicker}
                style={styles.bankSheetClose}
              >
                <Ionicons color="#4B555C" name="close" size={21} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.bankList}
              showsVerticalScrollIndicator={false}
            >
              {wallet.paymentMethods.map(method => {
                const bank =
                  BANK_OPTIONS.find(item => item.bin === method.bankId) ||
                  BANK_OPTIONS[0];
                const selected =
                  bankId === method.bankId &&
                  accountNumber === method.accountNumber;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={method.id}
                    onPress={() => applyPaymentMethod(method)}
                    style={({ pressed }) => [
                      styles.bankOption,
                      selected ? styles.bankOptionSelected : null,
                      pressed ? styles.bankOptionPressed : null,
                    ]}
                  >
                    <View style={styles.bankLogoBox}>
                      <Image
                        resizeMode="contain"
                        source={bank.image}
                        style={styles.bankLogo}
                      />
                    </View>
                    <View style={styles.bankOptionCopy}>
                      <View style={styles.savedMethodTitleRow}>
                        <Text style={styles.bankName}>{method.bankName}</Text>
                        {method.isDefault ? (
                          <Text style={styles.savedDefaultBadge}>Default</Text>
                        ) : null}
                      </View>
                      <Text style={styles.bankBin}>
                        •••• {method.accountNumber.slice(-4)} ·{' '}
                        {method.fullName}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.bankCheck,
                        selected ? styles.bankCheckSelected : null,
                      ]}
                    >
                      {selected ? (
                        <Ionicons color="#FFFFFF" name="checkmark" size={15} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}

              {wallet.paymentMethods.length === 0 ? (
                <View style={styles.bankEmpty}>
                  <Ionicons color="#9AA6AD" name="card-outline" size={25} />
                  <Text style={styles.bankEmptyTitle}>No saved bank yet</Text>
                  <Text style={styles.bankEmptyText}>
                    Add payment methods from Settings first.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  assetChoice: {
    alignItems: 'center',
    backgroundColor: '#1E232B',
    borderColor: '#2A303A',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 64,
  },
  assetChoiceActive: {
    backgroundColor: 'rgba(184, 255, 69, 0.15)',
    borderColor: '#B8FF45',
  },
  assetChoiceText: {
    color: '#8A9099',
    fontSize: 16,
    fontWeight: '900',
  },
  assetChoiceTextActive: {
    color: '#087C4D',
  },
  assetChoices: {
    flexDirection: 'row',
    gap: 10,
  },
  availableBox: {
    gap: 7,
  },
  availableText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  autoSendCancelButton: {
    alignItems: 'center',
    backgroundColor: '#D84C5F',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 16,
  },
  autoSendCancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  bankBin: {
    color: '#8A969D',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  bankCheck: {
    alignItems: 'center',
    borderColor: '#CBD5DA',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  bankCheckSelected: {
    backgroundColor: '#0ABF73',
    borderColor: '#B8FF45',
  },
  bankEmpty: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  bankEmptyText: {
    color: '#8A969D',
    fontSize: 13,
    marginTop: 5,
    textAlign: 'center',
  },
  bankEmptyTitle: {
    color: '#27343B',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
  },
  bankFieldLabel: {
    color: '#8A969D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  bankHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bankList: {
    gap: 10,
    paddingBottom: 10,
  },
  bankLogo: {
    height: 36,
    width: 72,
  },
  bankLogoBox: {
    alignItems: 'center',
    backgroundColor: '#111318',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 82,
  },
  bankName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  bankOption: {
    alignItems: 'center',
    backgroundColor: '#1E222B',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bankOptionCopy: {
    flex: 1,
  },
  bankOptionPressed: {
    opacity: 0.75,
  },
  bankOptionSelected: {
    backgroundColor: '#000000',
    borderColor: '#0ABF73',
  },
  transferExactHint: {
    color: '#B8FF45',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    textAlign: 'center',
  },
  bankTransferConfirmBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  bankTransferConfirmBoxMarked: {
    backgroundColor: 'rgba(184,255,69,0.08)',
    borderColor: 'rgba(184,255,69,0.22)',
  },
  bankTransferConfirmButton: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 138,
    paddingHorizontal: 12,
  },
  bankTransferConfirmButtonText: {
    color: '#101400',
    fontSize: 12,
    fontWeight: '900',
  },
  bankTransferConfirmCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  bankTransferConfirmText: {
    color: '#8A9099',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  bankTransferConfirmTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  transferPriorityStack: {
    gap: 7,
  },
  transferPriorityCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(184,255,69,0.09)',
    borderColor: 'rgba(184,255,69,0.22)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  transferPriorityCardPressed: {
    opacity: 0.76,
  },
  transferPriorityCopy: {
    flex: 1,
    minWidth: 0,
  },
  transferPriorityLabel: {
    color: '#A1B0C8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  transferPriorityValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  transferPriorityCopyIcon: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    shadowColor: '#B8FF45',
    shadowOpacity: 0.18,
    shadowRadius: 7,
    width: 30,
  },
  saveQrInlineButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(184,255,69,0.1)',
    borderColor: 'rgba(184,255,69,0.2)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  saveQrInlineText: {
    color: '#B8FF45',
    fontSize: 11,
    fontWeight: '900',
  },
  bankSearchBox: {
    alignItems: 'center',
    backgroundColor: '#1E232B',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 9,
    marginBottom: 16,
    minHeight: 52,
    paddingHorizontal: 15,
  },
  bankSearchInput: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  bankSheet: {
    backgroundColor: '#111318',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '78%',
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  bankSheetClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  bankSheetHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    height: 4,
    marginBottom: 17,
    width: 42,
  },
  bankSheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  bankSheetOverlay: {
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'flex-end',
  },
  bankSheetSubtitle: {
    color: '#8A9099',
    fontSize: 13,
    marginTop: 3,
  },
  bankSheetTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  selectedBankField: {
    alignItems: 'center',
    backgroundColor: '#1E222B',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedBankFieldPressed: {
    backgroundColor: '#282C35',
  },
  savedBankButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(184,255,69,0.12)',
    borderColor: 'rgba(184,255,69,0.22)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  savedBankButtonPressed: {
    opacity: 0.78,
  },
  savedBankButtonText: {
    color: '#B8FF45',
    fontSize: 12,
    fontWeight: '900',
  },
  savedDefaultBadge: {
    backgroundColor: 'rgba(184,255,69,0.14)',
    borderRadius: 8,
    color: '#B8FF45',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  savedMethodTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  remoteQr: {
    height: 220,
    width: 220,
  },
  remoteQrCard: {
    alignItems: 'center',
    backgroundColor: '#111318',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    borderWidth: 1,
    padding: 10,
  },
  feeWarning: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  feeWarningText: {
    color: '#FFA500',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  orderScreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  orderActionsStack: {
    gap: 10,
  },
  orderLockedBox: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(184, 255, 69, 0.1)',
    borderColor: 'rgba(184, 255, 69, 0.2)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 13,
  },
  orderLockedText: {
    color: '#B8FF45',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  orderExplorerWrap: {
    alignItems: 'center',
    paddingTop: 4,
  },
  orderQueueBadge: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -4,
    top: -5,
  },
  orderQueueBadgeText: {
    color: '#101400',
    fontSize: 9,
    fontWeight: '900',
  },
  orderQueueButton: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    position: 'relative',
    width: 40,
  },
  pendingOrderBody: {
    flex: 1,
    minWidth: 0,
  },
  pendingOrderIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(184,255,69,0.12)',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  pendingOrderList: {
    gap: 9,
  },
  pendingOrderMeta: {
    color: '#8A9099',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  pendingOrderRight: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    maxWidth: 130,
  },
  pendingOrderRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pendingOrderRowPressed: {
    backgroundColor: 'rgba(184,255,69,0.08)',
    borderColor: 'rgba(184,255,69,0.24)',
  },
  pendingOrderStatus: {
    color: '#B8FF45',
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'right',
  },
  pendingOrderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  quoteSheet: {
    paddingBottom: 28,
  },
  resultActions: {
    gap: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
    width: '100%',
  },
  resultContent: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingHorizontal: 26,
    paddingTop: 28,
  },
  resultIcon: {
    alignItems: 'center',
    borderRadius: 27,
    height: 54,
    justifyContent: 'center',
    marginBottom: 18,
    width: 54,
  },
  resultIconCancelled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  resultIconFailure: {
    backgroundColor: 'rgba(255,82,82,0.15)',
  },
  resultModal: {
    backgroundColor: '#111318',
    borderRadius: 28,
    maxWidth: 334,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { height: 18, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 36,
    width: '100%',
  },
  resultSuccessAnimation: {
    marginBottom: 2,
    marginTop: -8,
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(9, 14, 24, 0.46)',
    elevation: 20,
    justifyContent: 'center',
    padding: 24,
    zIndex: 20,
  },
  resultOrderBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 7,
    marginTop: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultOrderId: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  resultOrderLabel: {
    color: '#8A9099',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  resultPrimaryAction: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 54,
    width: '100%',
  },
  resultPrimaryActionPressed: {
    backgroundColor: '#292D34',
    transform: [{ scale: 0.985 }],
  },
  resultPrimaryActionText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  resultSecondaryAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 50,
    width: '100%',
  },
  resultSecondaryActionPressed: {
    backgroundColor: '#E8E9EC',
  },
  resultSecondaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  resultText: {
    color: '#8A9099',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  resultTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.35,
    textAlign: 'center',
  },
  segmentText: {
    color: '#8A9099',
    fontSize: 13,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#B8FF45',
  },
  statusHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  statusIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(184, 255, 69, 0.15)',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  statusSuccessAnimation: {
    marginHorizontal: -2,
  },
  testPaymentBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  testPaymentCopy: {
    gap: 4,
  },
  testPaymentText: {
    color: '#8A9099',
    fontSize: 12,
    lineHeight: 17,
  },
  testPaymentTitle: {
    color: '#B8FF45',
    fontSize: 14,
    fontWeight: '900',
  },
});
