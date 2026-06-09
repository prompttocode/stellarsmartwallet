import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
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
  rampTimestampToMs,
} from '@utils/ramp';
import { formatTokenAmount, shortAddress } from '@utils/format';

function formatVnd(value: number | string | undefined) {
  const amount = Number(value || 0);

  return `${Math.round(amount).toLocaleString('vi-VN')} VND`;
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
  onFinish,
  wallet,
}: {
  onBack: () => void;
  onFinish: () => void | Promise<void>;
  wallet: WalletState;
}) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const [direction, setDirection] = useState<RampDirection>('buy');
  const [assetCode, setAssetCode] = useState<RampAssetCode>('XLM');
  const [amount, setAmount] = useState('10');
  const [quote, setQuote] = useState<RampQuote | null>(null);
  const [bankId, setBankId] = useState('970422');
  const [fullName, setFullName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [, setClock] = useState(Date.now());
  const order = wallet.activeRampOrder;
  const refreshRampOrderRef = useRef(wallet.refreshRampOrder);
  const orderReference = order?.code || order?.id || '';
  const terminal = isRampOrderTerminal(order);
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

  useEffect(() => {
    refreshRampOrderRef.current = wallet.refreshRampOrder;
  }, [wallet.refreshRampOrder]);

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

  async function finishOrder() {
    await wallet.clearRampOrder();
    await onFinish();
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

    return (
      <View style={styles.orderScreen}>
        <ScrollView
          contentContainerStyle={screenInsetStyle}
          showsVerticalScrollIndicator={false}
        >
          <ModernScreenHeader
            onBack={onBack}
            subtitle={`${wallet.isMainnet ? 'Mainnet' : 'Testnet'} · ${
              isSell ? 'Sell' : 'Buy'
            } ${order.asset_code}`}
            title="Payment order"
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
                label="Order"
                value={`${isSell ? 'Sell' : 'Buy'} ${formatTokenAmount(
                  String(order.amount),
                )} ${order.asset_code}`}
              />
              <InfoLine label="Order ID" value={String(order.id || '-')} />
              <InfoLine label="Payment code" value={order.code || '-'} />
              <InfoLine
                label="Network"
                value={
                  wallet.isMainnet
                    ? 'Mainnet · real value'
                    : 'Testnet · testing only'
                }
              />
              <InfoLine label="State" value={String(order.state)} />
              <InfoLine
                label="Processing state"
                value={String(order.processing_state)}
              />
            </View>
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
                    <Text style={styles.testPaymentTitle}>
                      Test without transferring VND
                    </Text>
                    <Text style={styles.testPaymentText}>
                      Confirm this payment in the dev environment only. This
                      action is unavailable for Mainnet orders.
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
                      Confirm test payment
                    </Text>
                  </PressScale>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={modern.sectionCard}>
              <SectionHeader title="Send crypto" />
              <Text style={modern.emptyModernText}>
                Send the exact asset and amount to the address below. The
                Stellar text memo must be exactly the order code.
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
                    <Text style={styles.testPaymentTitle}>
                      Test without sending crypto
                    </Text>
                    <Text style={styles.testPaymentText}>
                      Simulate the hot wallet receiving this asset and trigger
                      the dev VND payout flow. Your Testnet balance will not be
                      deducted.
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
                      Confirm test crypto receipt
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
                    ? 'Send with biometric'
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
            {!terminal ? (
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
            ) : (
              <PressScale
                onPress={wallet.clearRampOrder}
                style={modern.primaryModernButton}
              >
                <Text style={modern.modernButtonText}>
                  Create another order
                </Text>
              </PressScale>
            )}
          </View>
        </ScrollView>

        {terminal ? (
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
                    ? `${isSell ? 'Sell' : 'Buy'} ${formatTokenAmount(
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
                  disabled={wallet.isBusy}
                  onPress={finishOrder}
                  style={({ pressed }) => [
                    styles.resultPrimaryAction,
                    pressed ? styles.resultPrimaryActionPressed : null,
                    wallet.isBusy ? styles.resultActionDisabled : null,
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
    validSellForm &&
    Boolean(wallet.wallet) &&
    (direction === 'buy' || wallet.walletCanSign);

  return (
    <ScrollView
      contentContainerStyle={screenInsetStyle}
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader
        onBack={onBack}
        subtitle={
          wallet.isMainnet
            ? 'Orders and Stellar transfers on Mainnet use real money and assets.'
            : 'Integration environment using Stellar Testnet assets with no monetary value.'
        }
        title="Buy/Sell with VND"
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
                {item === 'buy' ? 'Buy crypto' : 'Sell crypto'}
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
          <Text style={modern.assetModernMeta}>
            Available: {formatTokenAmount(selectedBalance?.balance || '0')}{' '}
            {assetCode}
          </Text>
        ) : null}

        {direction === 'sell' ? (
          <>
            <SectionHeader title="VND payout account" />
            <TextInput
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={value => {
                setBankId(value.replace(/\D/g, ''));
                setQuote(null);
              }}
              placeholder="Bank BIN, e.g. 970422"
              placeholderTextColor="#A7B3BA"
              style={modern.modernInput}
              value={bankId}
            />
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
              Payout method: Bank account
            </Text>
          </>
        ) : null}

        {quote ? (
          <View style={modern.reviewModernBox}>
            <Text style={modern.reviewModernTitle}>Estimated order</Text>
            <InfoLine
              label="Rate"
              value={`${formatVnd(quote.rate)} / ${quote.asset_code}`}
            />
            <InfoLine label="Gross" value={formatVnd(quote.gross_vnd)} />
            <InfoLine label="Fee" value={formatVnd(quote.fee_vnd)} />
            <InfoLine
              label={direction === 'buy' ? 'You transfer' : 'Estimated payout'}
              value={formatVnd(quote.total_vnd)}
            />
            <Text style={modern.reviewModernText}>
              Final values come from the order response. This quote may change.
            </Text>
          </View>
        ) : null}

        <PressScale
          disabled={
            wallet.isBusy ||
            !providerConfigured ||
            Number(amount) <= 0 ||
            !validSellForm ||
            (Boolean(quote) && !canCreate)
          }
          onPress={quote ? createOrder : loadQuote}
          style={modern.primaryModernButton}
        >
          <Text style={modern.modernButtonText}>
            {quote
              ? canCreate
                ? `Create ${direction} order`
                : 'Complete required details'
              : 'Get VND quote'}
          </Text>
        </PressScale>
      </View>
    </ScrollView>
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
  orderScreen: {
    flex: 1,
  },
  resultActionDisabled: {
    opacity: 0.45,
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
