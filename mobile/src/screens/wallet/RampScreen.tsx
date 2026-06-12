import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  InfoLine,
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  TokenIcon,
  modern,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import type {
  RampAssetCode,
  RampDirection,
  RampPaymentInfo,
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

const BANK_OPTIONS = [
  {
    bin: '970422',
    image: require('@assets/banks/mb.png'),
    name: 'MB Bank',
  },
  {
    bin: '970436',
    image: require('@assets/banks/vietcombank.png'),
    name: 'Vietcombank',
  },
] as const;

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

export function RampScreen({
  onBack,
  route,
  wallet,
}: {
  onBack: () => void;
  route?: { params?: { direction?: RampDirection; source?: 'history' } };
  wallet: WalletState;
}) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const [direction, setDirection] = useState<RampDirection>(
    route?.params?.direction === 'sell' ? 'sell' : 'buy',
  );
  const [assetCode, setAssetCode] = useState<RampAssetCode>('XLM');
  const [amount, setAmount] = useState('10');
  const [quote, setQuote] = useState<RampQuote | null>(null);
  const [bankId, setBankId] = useState('970422');
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [fullName, setFullName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [dismissedResultKey, setDismissedResultKey] = useState<string | null>(
    null,
  );
  const [, setClock] = useState(Date.now());
  const order = wallet.activeRampOrder;
  const openedFromHistory = route?.params?.source === 'history';
  const refreshRampOrderRef = useRef(wallet.refreshRampOrder);
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
  const exceedsWithdrawAvailable =
    direction === 'sell' &&
    parseNumericAmount(amount) > 0 &&
    parseNumericAmount(amount) > parseNumericAmount(selectedAvailableBalance);
  const selectedBank =
    BANK_OPTIONS.find(bank => bank.bin === bankId) || BANK_OPTIONS[0];
  const normalizedBankSearch = bankSearch.trim().toLowerCase();
  const filteredBanks = BANK_OPTIONS.filter(bank =>
    `${bank.name} ${bank.bin}`.toLowerCase().includes(normalizedBankSearch),
  );

  function closeBankPicker() {
    setBankPickerVisible(false);
    setBankSearch('');
  }

  useEffect(() => {
    refreshRampOrderRef.current = wallet.refreshRampOrder;
  }, [wallet.refreshRampOrder]);

  useEffect(() => {
    if (!order && route?.params?.direction) {
      setDirection(route.params.direction);
      setQuote(null);
    }
  }, [order, route?.params?.direction]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);

    return () => clearInterval(timer);
  }, []);

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

    setQuote(null);
  }

  async function loadQuote() {
    const result = await wallet.quoteRamp({
      amount,
      assetCode,
      direction,
    });

    if (result) {
      setQuote(result);
    }
  }

  async function createOrder() {
    const result = await wallet.createRampOrder({
      amount,
      assetCode,
      direction,
      paymentInfo: direction === 'sell' ? paymentInfo : undefined,
    });

    if (result) {
      setQuote(null);
    }
  }

  if (order) {
    const bankInfo = order.body?.bankInfo;
    const isSell = order.order_type === 'sell';
    const canBypassTestPayment =
      !wallet.isMainnet &&
      !isSell &&
      Number(order.state) === 1 &&
      Number(order.processing_state) === 10;
    const canBypassTestSellPayment =
      !wallet.isMainnet &&
      isSell &&
      Number(order.state) === 1 &&
      Number(order.processing_state) === 10 &&
      !order.sell_transaction_hash;
    const expiredAt = rampTimestampToMs(order.expired_at);
    const transactionHash =
      order.sell_transaction_hash || order.transaction_hash || '';
    const explorerUrl = transactionHash
      ? `https://stellar.expert/explorer/${
          wallet.isMainnet ? 'public' : 'testnet'
        }/tx/${transactionHash}`
      : null;
    const completed = Number(order.state) === 3;
    const stateLabel =
      RAMP_STATE_LABELS[Number(order.state)] || 'Unknown status';
    const processingLabel =
      RAMP_PROCESSING_LABELS[Number(order.processing_state)] ||
      'Waiting for provider';
    const orderAction = isSell ? 'Withdraw' : 'Buy';
    const cryptoTransferSubmitted =
      isSell &&
      (Boolean(order.sell_transaction_hash || order.transaction_hash) ||
        Number(order.processing_state) === 14 ||
        Number(order.processing_state) === 16);
    const canCancelOrder = !terminal && !cryptoTransferSubmitted;

    return (
      <View style={styles.orderScreen}>
        <ScrollView
          contentContainerStyle={screenInsetStyle}
          showsVerticalScrollIndicator={false}
        >
          <ModernScreenHeader
            onBack={onBack}
            subtitle={`${wallet.isMainnet ? 'Mainnet' : 'Testnet'} · ${
              isSell ? 'Withdraw to bank' : 'Buy with VND'
            } ${order.asset_code}`}
            title={`${orderAction} order`}
          />

          <View style={modern.sectionCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusIcon}>
                <Ionicons
                  color={terminal ? '#24495A' : '#0ABF73'}
                  name={terminal ? 'checkmark-circle' : 'time'}
                  size={30}
                />
              </View>
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
              <InfoLine
                label={isSell ? 'You withdraw' : 'You buy'}
                value={`${formatTokenAmount(String(order.amount))} ${
                  order.asset_code
                }`}
              />
              <InfoLine
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
            <InfoLine label="Status" value={stateLabel} />
            <InfoLine label="Current step" value={processingLabel} />
            <InfoLine label="Order ID" value={String(order.id || '-')} />
            <InfoLine label="Payment code" value={order.code || '-'} />
          </View>

          {!isSell ? (
            <View style={modern.sectionCard}>
              <SectionHeader title="Transfer VND" />
              <Text style={modern.emptyModernText}>
                Transfer the exact amount with the exact content before the
                countdown expires.
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
              <View style={modern.reviewModernBox}>
                <InfoLine
                  label="Amount"
                  value={formatVnd(bankInfo?.vaAmount)}
                />
                <InfoLine
                  label="Bank"
                  value={bankInfo?.bankName || 'Waiting for provider'}
                />
                <InfoLine
                  label="Account name"
                  value={bankInfo?.bankAccountName || '-'}
                />
                <InfoLine
                  label="Account number"
                  value={bankInfo?.bankAccountNumber || '-'}
                />
                <InfoLine
                  label="Transfer content"
                  value={bankInfo?.transferContent || order.code}
                />
              </View>
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
                Send the exact crypto amount below to receive VND in your bank
                account. The Stellar memo must match the payment code.
              </Text>
              <View style={modern.reviewModernBox}>
                <InfoLine
                  label="Amount"
                  value={`${formatTokenAmount(String(order.amount))} ${
                    order.asset_code
                  }`}
                />
                <InfoLine
                  label="Address"
                  value={
                    order.pay_data?.address
                      ? shortAddress(order.pay_data.address)
                      : 'Waiting for provider'
                  }
                />
                <InfoLine label="Memo" value={order.code} />
                <InfoLine
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
              <PressScale
                disabled={
                  wallet.isBusy ||
                  terminal ||
                  Boolean(order.sell_transaction_hash) ||
                  !order.pay_data?.address
                }
                onPress={() => wallet.sendRampOrderPayment(order)}
                style={modern.primaryModernButton}
              >
                <Text style={modern.modernButtonText}>
                  {order.sell_transaction_hash
                    ? 'Crypto transfer submitted'
                    : wallet.isMainnet
                    ? 'Send crypto now'
                    : 'Send crypto now'}
                </Text>
              </PressScale>
            </View>
          )}

          <View style={modern.sectionCard}>
            <SectionHeader title="Order actions" />
            <View style={modern.walletButtons}>
              <PressScale
                disabled={wallet.isBusy}
                onPress={() => wallet.refreshRampOrder(orderReference)}
                style={modern.primaryModernButton}
              >
                <Text style={modern.modernButtonText}>Refresh</Text>
              </PressScale>
              {explorerUrl ? (
                <PressScale
                  onPress={() => wallet.openUrl(explorerUrl)}
                  style={modern.secondaryModernButton}
                >
                  <Text
                    style={[
                      modern.modernButtonText,
                      modern.secondaryModernButtonText,
                    ]}
                  >
                    Explorer
                  </Text>
                </PressScale>
              ) : null}
            </View>
            {canCancelOrder ? (
              <PressScale
                disabled={wallet.isBusy}
                onPress={() => wallet.cancelRampOrder(orderReference)}
                style={modern.secondaryModernButton}
              >
                <Text
                  style={[
                    modern.modernButtonText,
                    modern.secondaryModernButtonText,
                  ]}
                >
                  Cancel order
                </Text>
              </PressScale>
            ) : terminal ? (
              <PressScale
                onPress={wallet.clearRampOrder}
                style={modern.primaryModernButton}
              >
                <Text style={modern.modernButtonText}>
                  Create another order
                </Text>
              </PressScale>
            ) : cryptoTransferSubmitted ? (
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
        </ScrollView>

        {showResult ? (
          <View style={styles.resultOverlay}>
            <View accessibilityViewIsModal style={styles.resultModal}>
              <View style={styles.resultContent}>
                <View
                  style={[
                    styles.resultIcon,
                    completed
                      ? styles.resultIconSuccess
                      : Number(order.state) === 5
                      ? styles.resultIconCancelled
                      : styles.resultIconFailure,
                  ]}
                >
                  <Ionicons
                    color={
                      completed
                        ? '#168A58'
                        : Number(order.state) === 5
                        ? '#6B7280'
                        : '#C43D45'
                    }
                    name={
                      completed
                        ? 'checkmark'
                        : Number(order.state) === 5
                        ? 'remove'
                        : 'close'
                    }
                    size={25}
                  />
                </View>
                <Text style={styles.resultTitle}>
                  {completed
                    ? 'Order completed'
                    : Number(order.state) === 5
                    ? 'Order cancelled'
                    : 'Order failed'}
                </Text>
                <Text style={styles.resultText}>
                  {completed
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
                    <Ionicons
                      color="#30343B"
                      name="arrow-up-outline"
                      size={17}
                    />
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
    Boolean(quote) &&
    (direction === 'buy' || Number(quote?.total_vnd || 0) > 0) &&
    !exceedsWithdrawAvailable &&
    validSellForm &&
    Boolean(wallet.wallet) &&
    (direction === 'buy' || wallet.walletCanSign);

  return (
    <>
      <ScrollView
        contentContainerStyle={screenInsetStyle}
        showsVerticalScrollIndicator={false}
      >
        <ModernScreenHeader
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
            <Text style={modern.emptyModernTitle}>Provider unavailable</Text>
            <Text style={modern.emptyModernText}>
              The Payment API partner key is not configured on the Worker.
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
              setQuote(null);
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
              <SectionHeader title="Bank account" />
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
                  setQuote(null);
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
                  setQuote(null);
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

          {quote ? (
            <View style={styles.quoteCard}>
              <Text style={styles.quoteEyebrow}>
                {direction === 'buy' ? 'ESTIMATED PAYMENT' : 'ESTIMATED PAYOUT'}
              </Text>
              <Text style={styles.quoteAmount}>
                {formatVnd(quote.total_vnd)}
              </Text>
              <InfoLine
                label="Rate"
                value={`${formatVnd(quote.rate)} / ${quote.asset_code}`}
              />
              <InfoLine label="Gross" value={formatVnd(quote.gross_vnd)} />
              <InfoLine label="Fee" value={formatVnd(quote.fee_vnd)} />
              <InfoLine
                label={
                  direction === 'buy' ? 'You transfer' : 'Estimated payout'
                }
                value={formatVnd(quote.total_vnd)}
              />
              {direction === 'sell' &&
              quote.gross_vnd > 0 &&
              quote.fee_vnd / quote.gross_vnd >= 0.5 ? (
                <View style={styles.feeWarning}>
                  <Ionicons color="#A25C00" name="warning-outline" size={18} />
                  <Text style={styles.feeWarningText}>
                    The fee uses a large part of this withdrawal. Increase the
                    crypto amount for a better payout.
                  </Text>
                </View>
              ) : null}
              <Text style={modern.reviewModernText}>
                Final values come from the order response. This quote may
                change.
              </Text>
            </View>
          ) : null}

          <PressScale
            disabled={
              wallet.isBusy ||
              !providerConfigured ||
              Number(amount) <= 0 ||
              exceedsWithdrawAvailable ||
              !validSellForm ||
              (Boolean(quote) && !canCreate)
            }
            onPress={quote ? createOrder : loadQuote}
            style={modern.primaryModernButton}
          >
            <Text style={modern.modernButtonText}>
              {quote
                ? canCreate
                  ? direction === 'buy'
                    ? 'Create buy order'
                    : 'Create withdrawal'
                  : exceedsWithdrawAvailable
                  ? 'Amount exceeds available balance'
                  : direction === 'sell' && Number(quote.total_vnd) <= 0
                  ? 'Withdrawal amount is too small'
                  : 'Complete required details'
                : 'Get VND quote'}
            </Text>
          </PressScale>
        </View>
      </ScrollView>

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
                      setQuote(null);
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
    </>
  );
}

const styles = StyleSheet.create({
  assetChoice: {
    alignItems: 'center',
    backgroundColor: '#F4F8FA',
    borderColor: '#E2EBEF',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 64,
  },
  assetChoiceActive: {
    backgroundColor: '#E7F9F1',
    borderColor: '#0ABF73',
  },
  assetChoiceText: {
    color: '#7E909A',
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
    color: '#132235',
    fontSize: 13,
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
    borderColor: '#0ABF73',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 82,
  },
  bankName: {
    color: '#132235',
    fontSize: 14,
    fontWeight: '900',
  },
  bankOption: {
    alignItems: 'center',
    backgroundColor: '#F4F7F8',
    borderColor: '#E0E7EA',
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
    backgroundColor: '#ECFAF5',
    borderColor: '#0ABF73',
  },
  bankSearchBox: {
    alignItems: 'center',
    backgroundColor: '#F1F4F5',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 9,
    marginBottom: 16,
    minHeight: 52,
    paddingHorizontal: 15,
  },
  bankSearchInput: {
    color: '#18252C',
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  bankSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '78%',
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  bankSheetClose: {
    alignItems: 'center',
    backgroundColor: '#F1F3F4',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  bankSheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#D5DBDE',
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
    backgroundColor: 'rgba(9, 14, 24, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  bankSheetSubtitle: {
    color: '#849097',
    fontSize: 13,
    marginTop: 3,
  },
  bankSheetTitle: {
    color: '#142129',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  selectedBankField: {
    alignItems: 'center',
    backgroundColor: '#F4F7F8',
    borderColor: '#E0E7EA',
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedBankFieldPressed: {
    backgroundColor: '#EAF0F2',
  },
  remoteQr: {
    height: 220,
    width: 220,
  },
  remoteQrCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DFE9ED',
    borderRadius: 24,
    borderWidth: 1,
    padding: 10,
  },
  feeWarning: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF7E8',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  feeWarningText: {
    color: '#855114',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  orderScreen: {
    flex: 1,
  },
  orderLockedBox: {
    alignItems: 'flex-start',
    backgroundColor: '#EFF6F8',
    borderColor: '#D9E7EC',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 13,
  },
  orderLockedText: {
    color: '#24495A',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  quoteAmount: {
    color: '#111318',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginBottom: 4,
  },
  quoteCard: {
    backgroundColor: '#F5F6F8',
    borderRadius: 22,
    gap: 9,
    padding: 16,
  },
  quoteEyebrow: {
    color: '#7B818A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
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
    backgroundColor: '#F0F1F3',
  },
  resultIconFailure: {
    backgroundColor: '#FBECEE',
  },
  resultIconSuccess: {
    backgroundColor: '#E9F7F0',
  },
  resultModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    maxWidth: 334,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { height: 18, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 36,
    width: '100%',
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
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 7,
    marginTop: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultOrderId: {
    color: '#262A30',
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
    backgroundColor: '#101318',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resultSecondaryAction: {
    alignItems: 'center',
    backgroundColor: '#F2F3F5',
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
    color: '#30343B',
    fontSize: 15,
    fontWeight: '600',
  },
  resultText: {
    color: '#737982',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  resultTitle: {
    color: '#15181D',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.35,
    textAlign: 'center',
  },
  segmentText: {
    color: '#7E909A',
    fontSize: 13,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#24495A',
  },
  statusHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  statusIcon: {
    alignItems: 'center',
    backgroundColor: '#E7F9F1',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  testPaymentBox: {
    backgroundColor: '#F4F8FF',
    borderColor: '#DDE8FF',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  testPaymentCopy: {
    gap: 4,
  },
  testPaymentText: {
    color: '#71839B',
    fontSize: 12,
    lineHeight: 17,
  },
  testPaymentTitle: {
    color: '#24495A',
    fontSize: 14,
    fontWeight: '900',
  },
});
