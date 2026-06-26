import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeBiometrics from 'react-native-biometrics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AssetPickerModal,
  getModernAssets,
  ModernScreenHeader,
  PressScale,
  SuccessLottie,
  TokenIcon,
  modern,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import type { SwapResult } from '@app-types';
import { AppBottomSheet } from '../../components/ui/AppBottomSheet';
import type { WalletState } from '@hooks/useWallet';
import {
  formatEstimatedStellarFee,
  formatStellarFee,
  formatTokenAmount,
  shortAddress,
} from '@utils/format';
import {
  getAvailableAmount,
  validateStellarAmount,
} from '@utils/walletValidation';

function formatSwapBalance(value?: string | null) {
  return formatTokenAmount(value || '0', {
    compact: true,
    maxFractionDigits: 4,
  });
}

function formatMaxSwapAmount(value?: number | string | null) {
  const raw = String(value ?? '0').trim().replace(',', '.');
  const match = raw.match(/^(\d+)(?:\.(\d+))?$/);

  if (match) {
    const whole = match[1].replace(/^0+(?=\d)/, '') || '0';
    const fraction = (match[2] || '').slice(0, 7).replace(/0+$/, '');

    if (whole === '0' && !fraction) {
      return '0';
    }

    return fraction ? `${whole}.${fraction}` : whole;
  }

  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount <= 0) {
    return '0';
  }

  const truncated = Math.floor(amount * 10_000_000) / 10_000_000;

  return truncated.toFixed(7).replace(/\.?0+$/, '');
}

function shortHash(value?: string | null) {
  if (!value) {
    return 'Not available';
  }

  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function SwapSuccessDetailRow({
  isLast,
  label,
  onCopy,
  value,
}: {
  isLast?: boolean;
  label: string;
  onCopy?: () => void;
  value: string;
}) {
  return (
    <View
      style={[
        successStyles.detailRow,
        isLast ? successStyles.detailRowLast : null,
      ]}
    >
      <Text style={successStyles.detailLabel}>{label}</Text>
      <Pressable
        disabled={!onCopy}
        onPress={onCopy}
        style={successStyles.detailValueWrap}
      >
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.76}
          numberOfLines={1}
          style={successStyles.detailValue}
        >
          {value}
        </Text>
        {onCopy ? (
          <Ionicons color="#B8F3FF" name="copy-outline" size={14} />
        ) : null}
      </Pressable>
    </View>
  );
}

export function SwapScreen({ wallet }: { wallet: WalletState }) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const insets = useSafeAreaInsets();
  const initialBuy =
    wallet.visibleAssets.find(
      asset => asset.assetCode !== wallet.selectedAssetCode,
    )?.assetCode || 'USDC';
  const [sellCode, setSellCode] = useState(wallet.selectedAssetCode);
  const [buyCode, setBuyCode] = useState(initialBuy);
  const [sellAmount, setSellAmount] = useState('10');
  const [pickerMode, setPickerMode] = useState<'sell' | 'buy' | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSwap, setLastSwap] = useState<SwapResult | null>(null);
  const [quote, setQuote] = useState<null | {
    destMin: string;
    feeEstimateXlm?: string | null;
    rate: number;
    toAmount: string;
  }>(null);
  const assets = getModernAssets(
    wallet.balances,
    wallet.visibleAssets.filter(asset =>
      ['XLM', 'USDC'].includes(asset.assetCode),
    ),
  );
  const sellAsset = useMemo(
    () => assets.find(asset => asset.assetCode === sellCode),
    [assets, sellCode],
  );
  const buyAsset = useMemo(
    () => assets.find(asset => asset.assetCode === buyCode),
    [assets, buyCode],
  );
  const sellBalance = useMemo(
    () =>
      wallet.balances.find(
        balance =>
          balance.assetCode === sellCode &&
          (balance.assetIssuer || null) === (sellAsset?.assetIssuer || null),
      ),
    [sellAsset?.assetIssuer, sellCode, wallet.balances],
  );
  const amountValidation = validateStellarAmount(sellAmount, 'Swap amount');
  const requestedSellAmount = amountValidation.amount;
  const amountValid = amountValidation.valid;
  const availableSellAmount = getAvailableAmount(
    sellBalance,
    sellAsset?.balance,
  );
  const maxSwapAmount = formatMaxSwapAmount(
    sellBalance?.availableBalance || sellBalance?.balance || sellAsset?.balance,
  );
  const exceedsSellBalance =
    amountValid &&
    Number.isFinite(availableSellAmount) &&
    requestedSellAmount > availableSellAmount;
  const swapAmountWarning = exceedsSellBalance
    ? sellAsset?.isNative
      ? `You can swap up to ${formatTokenAmount(
          String(availableSellAmount),
        )} XLM. Stellar keeps ${formatTokenAmount(
          sellBalance?.reservedBalance || sellBalance?.minimumBalance || '0',
        )} XLM reserved for account minimum balance and network fees.`
      : `You can swap up to ${formatTokenAmount(
          String(availableSellAmount),
        )} ${sellCode}.`
    : sellAmount.trim() && !amountValid
    ? amountValidation.message || 'Enter a valid swap amount.'
    : null;
  const canSwap =
    sellCode !== buyCode &&
    amountValid &&
    !exceedsSellBalance &&
    wallet.walletCanSign &&
    (!wallet.isMainnet || wallet.walletActive);
  const quoteAmountLabel = quote
    ? formatTokenAmount(quote.toAmount)
    : quoteLoading
    ? '0'
    : '0';
  const minimumReceived = quote?.destMin || quote?.toAmount || '0';
  const rateLabel = quote
    ? `1 ${sellCode} = ${formatTokenAmount(quote.rate, {
        maxFractionDigits: 7,
      })} ${buyCode}`
    : 'Not loaded';
  const slippageLimitPercent = quote
    ? (() => {
        const quotedAmount = Number(quote.toAmount);
        const minimumAmount = Number(quote.destMin);

        if (
          !Number.isFinite(quotedAmount) ||
          quotedAmount <= 0 ||
          !Number.isFinite(minimumAmount)
        ) {
          return 0.5;
        }

        return Math.max(0, (1 - minimumAmount / quotedAmount) * 100);
      })()
    : 0.5;
  const slippageLimitLabel = `${slippageLimitPercent.toFixed(2)}%`;

  function resetQuote() {
    setQuoteLoading(false);
    setReviewVisible(false);
    setQuote(null);
  }

  function flipAssets() {
    setSellCode(buyCode);
    setBuyCode(sellCode);
    resetQuote();
  }

  function selectPickerAsset(assetCode: string) {
    if (pickerMode === 'sell') {
      setSellCode(assetCode);
    } else if (pickerMode === 'buy') {
      setBuyCode(assetCode);
    }

    resetQuote();
    setPickerMode(null);
  }

  async function searchPickerAssets(query: string) {
    const result = await wallet.searchAssets(query);

    return getModernAssets(
      wallet.balances,
      result.filter(asset => ['XLM', 'USDC'].includes(asset.assetCode)),
    );
  }

  async function startReview() {
    if (swapAmountWarning) {
      wallet.showErrorDialog(swapAmountWarning, 'Swap unavailable');
      return;
    }

    setQuoteLoading(true);

    try {
      const result = await wallet.quoteSwap({
        amount: amountValidation.valid
          ? amountValidation.normalized
          : sellAmount,
        fromAssetCode: sellCode,
        toAssetCode: buyCode,
      });

      if (result) {
        setQuote({
          destMin: result.destMin,
          feeEstimateXlm: result.feeEstimateXlm,
          rate: result.rate,
          toAmount: result.toAmount,
        });
        setReviewVisible(true);
      }
    } finally {
      setQuoteLoading(false);
    }
  }

  async function handleSwap() {
    if (submitting) {
      return;
    }

    setReviewVisible(false);
    setSubmitting(true);

    try {
      if (wallet.isMainnet) {
        const rnBiometrics = new ReactNativeBiometrics();
        const { available } = await rnBiometrics.isSensorAvailable();

        if (available) {
          const { success } = await rnBiometrics.simplePrompt({
            cancelButtonText: 'Cancel',
            promptMessage: 'Confirm this real Mainnet swap',
          });

          if (!success) {
            wallet.showErrorDialog(
              'The swap was not submitted.',
              'Authentication failed',
            );
            return;
          }
        }
      }

      const result = await wallet.swapAsset({
        amount: amountValidation.valid
          ? amountValidation.normalized
          : sellAmount,
        fromAssetCode: sellCode,
        toAssetCode: buyCode,
      });

      if (result) {
        setLastSwap(result);
        resetQuote();
      }
    } catch {
      wallet.showErrorDialog('Please try again.', 'Swap error');
    } finally {
      setSubmitting(false);
    }
  }

  if (lastSwap) {
    const networkName = wallet.isMainnet
      ? 'Stellar Mainnet'
      : 'Stellar Testnet';
    const swapSummary = `${formatTokenAmount(lastSwap.fromAmount)} ${
      lastSwap.fromAssetCode
    } → ${formatTokenAmount(lastSwap.toAmount)} ${lastSwap.toAssetCode}`;
    const swapPair = `${lastSwap.fromAssetCode} → ${lastSwap.toAssetCode}`;
    const rateText = `1 ${lastSwap.fromAssetCode} = ${formatTokenAmount(
      lastSwap.rate,
      { maxFractionDigits: 7 },
    )} ${lastSwap.toAssetCode}`;
    const walletAddress =
      lastSwap.transaction.to ||
      lastSwap.transaction.from ||
      wallet.wallet?.address;

    return (
      <View style={[successStyles.root, { paddingTop: insets.top + 8 }]}>
        <View style={successStyles.header}>
          <View style={successStyles.headerIconPlaceholder} />
          <Text style={successStyles.headerTitle}>Swap complete</Text>
          <View style={successStyles.headerIconPlaceholder} />
        </View>

        <ScrollView
          contentContainerStyle={[
            successStyles.content,
            { paddingBottom: insets.bottom + 104 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <SuccessLottie size={96} style={successStyles.statusAnimation} />
          <Text style={successStyles.statusText}>Swap completed</Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}
            style={successStyles.amountText}
          >
            {swapSummary}
          </Text>

          <View style={successStyles.completedBadge}>
            <View style={successStyles.completedDot} />
            <Text style={successStyles.completedText}>COMPLETED</Text>
          </View>

          <View style={successStyles.detailsCard}>
            <SwapSuccessDetailRow label="Pair" value={swapPair} />
            <SwapSuccessDetailRow
              label="Received"
              value={`${formatTokenAmount(lastSwap.toAmount)} ${
                lastSwap.toAssetCode
              }`}
            />
            <SwapSuccessDetailRow label="Network" value={networkName} />
            <SwapSuccessDetailRow
              label="Wallet"
              value={shortAddress(walletAddress)}
            />
            <SwapSuccessDetailRow
              label="Transaction ID"
              onCopy={() => Clipboard.setString(lastSwap.hash)}
              value={shortHash(lastSwap.hash)}
            />
            <SwapSuccessDetailRow label="Rate" value={rateText} />
            <SwapSuccessDetailRow
              isLast
              label="Network Fee"
              value={formatStellarFee(lastSwap.transaction.feeChargedXlm)}
            />
          </View>
        </ScrollView>

        <View
          style={[
            successStyles.bottomAction,
            { paddingBottom: insets.bottom + 10 },
          ]}
        >
          <PressScale
            onPress={() => setLastSwap(null)}
            style={successStyles.doneButton}
          >
            <Text style={successStyles.doneButtonText}>DONE</Text>
          </PressScale>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ backgroundColor: '#000000' }}
        contentContainerStyle={screenInsetStyle}
        showsVerticalScrollIndicator={false}
      >
        <ModernScreenHeader subtitle="" title="Swap tokens" />

        {!wallet.walletCanSign ? (
          <View style={modern.sectionCard}>
            <Text style={modern.emptyModernTitle}>
              {wallet.walletSessionSyncing
                ? 'Wallet session syncing'
                : 'Watch-only wallet'}
            </Text>
            <Text style={modern.emptyModernText}>
              {wallet.walletSessionSyncing
                ? 'Your saved wallet is visible. Swap will be available when the secure server session finishes syncing.'
                : 'This wallet cannot sign a Stellar path payment.'}
            </Text>
          </View>
        ) : null}

        {wallet.isMainnet && !wallet.walletActive ? (
          <View style={modern.sectionCard}>
            <Text style={modern.emptyModernTitle}>Wallet inactive</Text>
            <Text style={modern.emptyModernText}>
              Deposit real XLM before swapping on Mainnet.
            </Text>
          </View>
        ) : null}

        <View style={[modern.formCard, modern.swapFormCard]}>
          <View style={modern.swapBox}>
            <View style={modern.swapField}>
              <View style={modern.swapFieldTop}>
                <Text style={modern.swapLabel}>You Pay</Text>
                <View style={modern.swapBalanceRow}>
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                    numberOfLines={1}
                    style={modern.swapBalanceText}
                  >
                    {formatSwapBalance(maxSwapAmount)}
                  </Text>
                  <PressScale
                    onPress={() => {
                      setSellAmount(maxSwapAmount);
                      resetQuote();
                    }}
                  >
                    <Text style={modern.swapMaxText}>MAX</Text>
                  </PressScale>
                </View>
              </View>

              <View style={modern.swapAssetRow}>
                <PressScale
                  onPress={() => setPickerMode('sell')}
                  style={modern.swapTokenPill}
                >
                  {sellAsset ? (
                    <TokenIcon
                      assetCode={sellAsset.assetCode}
                      imageUrl={sellAsset.image}
                      size={34}
                    />
                  ) : null}
                  <Text style={modern.swapTokenText}>
                    {sellAsset ? sellAsset.assetCode : 'Select'}
                  </Text>
                  <Ionicons color="#AEB8B2" name="chevron-down" size={16} />
                </PressScale>

                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={value => {
                    setSellAmount(value);
                    resetQuote();
                  }}
                  placeholder="0"
                  placeholderTextColor="#6F7472"
                  returnKeyType="done"
                  style={modern.swapAmountInput}
                  value={sellAmount}
                />
              </View>
            </View>

            <PressScale onPress={flipAssets} style={modern.swapMiddleButton}>
              <MaterialCommunityIcons
                color="#D7DED8"
                name="swap-vertical"
                size={26}
              />
            </PressScale>

            <View style={[modern.swapField, modern.swapReceiveField]}>
              <View style={modern.swapFieldTop}>
                <Text style={modern.swapLabel}>You Receive</Text>
              </View>

              <View style={modern.swapAssetRow}>
                <PressScale
                  onPress={() => setPickerMode('buy')}
                  style={modern.swapTokenPill}
                >
                  {buyAsset ? (
                    <TokenIcon
                      assetCode={buyAsset.assetCode}
                      imageUrl={buyAsset.image}
                      size={34}
                    />
                  ) : null}
                  <Text style={modern.swapTokenText}>
                    {buyAsset ? buyAsset.assetCode : 'Select'}
                  </Text>
                  <Ionicons color="#AEB8B2" name="chevron-down" size={16} />
                </PressScale>

                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  numberOfLines={1}
                  style={modern.swapAmountValue}
                >
                  {quoteAmountLabel}
                </Text>
              </View>
            </View>
          </View>

          <View style={modern.rateCard}>
            <Text style={modern.swapLabel}>Exchange rate</Text>
            <Text style={modern.assetModernBalance}>
              {quote
                ? `1 ${sellCode} ≈ ${quote.rate.toFixed(7)} ${buyCode}`
                : 'Not loaded'}
            </Text>
          </View>

          {swapAmountWarning ? (
            <Text style={swapStyles.warningText}>{swapAmountWarning}</Text>
          ) : null}
          <PressScale
            disabled={wallet.isBusy || quoteLoading || submitting || !canSwap}
            onPress={quote ? () => setReviewVisible(true) : startReview}
            style={modern.primaryModernButton}
          >
            <Text style={modern.modernButtonText}>
              {quoteLoading ? 'Loading quote...' : 'Review swap'}
            </Text>
          </PressScale>
          <Text style={modern.emptyModernText}>
            Quotes and execution both use Stellar Horizon path payment data.
          </Text>
        </View>
      </ScrollView>

      <AppBottomSheet
        visible={reviewVisible && Boolean(quote)}
        onClose={() => setReviewVisible(false)}
        contentContainerStyle={{ paddingHorizontal: 10 }}
        snapPoints={['50%', '90%']}
      >
        <View style={modern.swapConfirmHeader}>
          <Text style={modern.swapConfirmTitle}>Confirm Swap</Text>
        </View>

        <View style={modern.swapConfirmAmounts}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            style={modern.swapConfirmAmount}
          >
            {formatTokenAmount(sellAmount)}
          </Text>
              <View style={modern.swapConfirmTokenBadge}>
                {sellAsset ? (
                  <TokenIcon
                    assetCode={sellAsset.assetCode}
                    imageUrl={sellAsset.image}
                    size={14}
                  />
                ) : null}
                <Text style={modern.swapConfirmTokenText}>{sellCode}</Text>
              </View>

              <View style={modern.swapConfirmArrowCircle}>
                <Ionicons color="#B8FF45" name="arrow-down" size={22} />
              </View>

              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                numberOfLines={1}
                style={modern.swapConfirmReceiveAmount}
              >
                {formatTokenAmount(quote?.toAmount || '0')}
              </Text>
              <View style={modern.swapConfirmTokenBadge}>
                {buyAsset ? (
                  <TokenIcon
                    assetCode={buyAsset.assetCode}
                    imageUrl={buyAsset.image}
                    size={14}
                  />
                ) : null}
                <Text style={modern.swapConfirmTokenText}>{buyCode}</Text>
              </View>
            </View>

            <View style={modern.swapConfirmDetails}>
              <View style={modern.swapConfirmDetailRow}>
                <Text style={modern.swapConfirmDetailLabel}>Rate</Text>
                <Text style={modern.swapConfirmDetailValue}>{rateLabel}</Text>
              </View>
              <View style={modern.swapConfirmDetailRow}>
                <Text style={modern.swapConfirmDetailLabel}>
                  Minimum Received
                </Text>
                <Text style={modern.swapConfirmDetailValue}>
                  {formatTokenAmount(minimumReceived)} {buyCode}
                </Text>
              </View>
              <View style={modern.swapConfirmDetailRow}>
                <Text style={modern.swapConfirmDetailLabel}>Slippage Limit</Text>
                <Text style={modern.swapConfirmDetailValue}>
                  {slippageLimitLabel}
                </Text>
              </View>
              <View style={modern.swapConfirmDetailRow}>
                <Text style={modern.swapConfirmDetailLabel}>Network Fee</Text>
                <Text style={modern.swapConfirmDetailValue}>
                  {formatEstimatedStellarFee(quote?.feeEstimateXlm)}
                </Text>
              </View>
              <View style={modern.swapConfirmDetailRow}>
                <View style={modern.swapConfirmRouteLabel}>
                  <Text style={modern.swapConfirmDetailLabel}>Route</Text>
                  <Ionicons
                    color="#8C948D"
                    name="information-circle-outline"
                    size={13}
                  />
                </View>
                <Text style={modern.swapConfirmDetailValue}>Stellar DEX</Text>
              </View>
            </View>

            <Text style={modern.swapConfirmNote}>
              Output is estimated. You will receive at least{' '}
              {formatTokenAmount(minimumReceived)} {buyCode} or the transaction
              will revert.
            </Text>

            <PressScale
              disabled={wallet.isBusy || quoteLoading || submitting || !canSwap}
              onPress={handleSwap}
              style={modern.swapConfirmButton}
            >
              <Text style={modern.swapConfirmButtonText}>
                {submitting ? 'SWAPPING...' : 'CONFIRM SWAP'}
              </Text>
            </PressScale>
      </AppBottomSheet>

      <AssetPickerModal
        assets={assets}
        disabledAssetCodes={pickerMode === 'sell' ? [buyCode] : [sellCode]}
        onClose={() => setPickerMode(null)}
        onRemoteSearch={searchPickerAssets}
        onSelect={asset => selectPickerAsset(asset.assetCode)}
        selectedAssetCode={pickerMode === 'sell' ? sellCode : buyCode}
        title={
          pickerMode === 'sell'
            ? 'Select asset to pay'
            : 'Select asset to receive'
        }
        visible={pickerMode !== null}
      />
    </>
  );
}

const successStyles = StyleSheet.create({
  amountText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 8,
    textAlign: 'center',
  },
  bottomAction: {
    backgroundColor: 'rgba(16,19,17,0.98)',
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
  },
  completedBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(184,255,0,0.08)',
    borderColor: 'rgba(184,255,0,0.85)',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  completedDot: {
    backgroundColor: '#B8FF00',
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  completedText: {
    color: '#B8FF00',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 28,
  },
  detailLabel: {
    color: '#AEB7AD',
    fontSize: 12,
    fontWeight: '700',
  },
  detailRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingVertical: 4,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailValue: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  detailValueWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'flex-end',
    marginLeft: 16,
    minWidth: 0,
  },
  detailsCard: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  doneButton: {
    alignItems: 'center',
    backgroundColor: '#B8FF00',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 54,
  },
  doneButtonText: {
    color: '#071421',
    fontSize: 14,
    fontWeight: '900',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerIconPlaceholder: {
    height: 36,
    width: 36,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  root: {
    backgroundColor: '#101311',
    flex: 1,
  },
  statusAnimation: {
    alignSelf: 'center',
    marginBottom: -2,
  },
  statusText: {
    color: '#AEB7AD',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'center',
  },
});

const swapStyles = StyleSheet.create({
  warningText: {
    color: '#FFB86B',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
    textAlign: 'center',
  },
});
