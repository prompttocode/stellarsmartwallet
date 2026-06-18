import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeBiometrics from 'react-native-biometrics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AssetPickerModal,
  getModernAssets,
  ModernScreenHeader,
  PressScale,
  TokenIcon,
  modern,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import type { SwapResult } from '@app-types';
import type { WalletState } from '@hooks/useWallet';
import { formatTokenAmount } from '@utils/format';

function formatSwapBalance(value?: string | null) {
  return formatTokenAmount(value || '0', {
    compact: true,
    maxFractionDigits: 4,
  });
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
  const [reviewing, setReviewing] = useState(false);
  const [lastSwap, setLastSwap] = useState<SwapResult | null>(null);
  const [quote, setQuote] = useState<null | {
    destMin: string;
    rate: number;
    toAmount: string;
  }>(null);
  const assets = getModernAssets(
    wallet.balances,
    wallet.visibleAssets.filter(asset =>
      ['XLM', 'USDC'].includes(asset.assetCode),
    ),
  );
  const canSwap =
    sellCode !== buyCode &&
    Number(sellAmount) > 0 &&
    wallet.walletCanSign &&
    (!wallet.isMainnet || wallet.walletActive);
  const sellAsset = useMemo(
    () => assets.find(asset => asset.assetCode === sellCode),
    [assets, sellCode],
  );
  const buyAsset = useMemo(
    () => assets.find(asset => asset.assetCode === buyCode),
    [assets, buyCode],
  );
  const quoteAmountLabel = quote
    ? formatTokenAmount(quote.toAmount)
    : reviewing
    ? '0'
    : '0';
  const minimumReceived = quote?.destMin || quote?.toAmount || '0';
  const rateLabel = quote
    ? `1 ${sellCode} = ${formatTokenAmount(quote.rate, {
        maxFractionDigits: 7,
      })} ${buyCode}`
    : 'Not loaded';

  function resetQuote() {
    setReviewing(false);
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
    const result = await wallet.quoteSwap({
      amount: sellAmount,
      fromAssetCode: sellCode,
      toAssetCode: buyCode,
    });

    if (result) {
      setQuote({
        destMin: result.destMin,
        rate: result.rate,
        toAmount: result.toAmount,
      });
      setReviewing(true);
    }
  }

  async function handleSwap() {
    if (wallet.isMainnet) {
      const rnBiometrics = new ReactNativeBiometrics();
      const { available } = await rnBiometrics.isSensorAvailable();

      if (available) {
        try {
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
        } catch {
          wallet.showErrorDialog('Please try again.', 'Biometric error');
          return;
        }
      }
    }

    const result = await wallet.swapAsset({
      amount: sellAmount,
      fromAssetCode: sellCode,
      toAssetCode: buyCode,
    });

    if (result) {
      setLastSwap(result);
      resetQuote();
    }
  }

  if (lastSwap) {
    return (
      <ScrollView
        style={{ backgroundColor: '#000000' }}
        contentContainerStyle={screenInsetStyle}
        showsVerticalScrollIndicator={false}
      >
        <ModernScreenHeader
          subtitle={`Transaction submitted to Stellar ${
            wallet.isMainnet ? 'Mainnet' : 'Testnet'
          }.`}
          title="Swap complete"
        />
        <View style={modern.sectionCard}>
          <View style={modern.successOrb}>
            <Ionicons color="#B8FF45" name="checkmark" size={42} />
          </View>
          <Text style={modern.successModernTitle}>Swap complete</Text>
          <Text style={modern.successModernText}>
            {formatTokenAmount(lastSwap.fromAmount)} {lastSwap.fromAssetCode} →{' '}
            {formatTokenAmount(lastSwap.toAmount)} {lastSwap.toAssetCode}
          </Text>
          <PressScale
            onPress={() => wallet.openUrl(lastSwap.transaction.explorerUrl)}
            style={modern.primaryModernButton}
          >
            <Text style={modern.modernButtonText}>Open Stellar Expert</Text>
          </PressScale>
          <PressScale
            onPress={() => setLastSwap(null)}
            style={modern.secondaryModernButton}
          >
            <Text
              style={[
                modern.modernButtonText,
                modern.secondaryModernButtonText,
              ]}
            >
              Swap again
            </Text>
          </PressScale>
        </View>
      </ScrollView>
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
                    {formatSwapBalance(sellAsset?.balance)}
                  </Text>
                  <PressScale
                    onPress={() => {
                      setSellAmount(sellAsset?.balance || '0');
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

          <PressScale
            disabled={wallet.isBusy || !canSwap}
            onPress={quote ? () => setReviewing(true) : startReview}
            style={modern.primaryModernButton}
          >
            <Text style={modern.modernButtonText}>
              {quote ? 'Review swap' : 'Review swap'}
            </Text>
          </PressScale>
          <Text style={modern.emptyModernText}>
            Quotes and execution both use Stellar Horizon path payment data.
          </Text>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setReviewing(false)}
        statusBarTranslucent
        transparent
        visible={reviewing && Boolean(quote)}
      >
        <View style={modern.swapConfirmOverlay}>
          <Pressable
            onPress={() => setReviewing(false)}
            style={modern.swapConfirmBackdrop}
          />
          <View
            style={[
              modern.swapConfirmSheet,
              { paddingBottom: Math.max(insets.bottom, 14) + 14 },
            ]}
          >
            <View style={modern.swapConfirmHandle} />
            <View style={modern.swapConfirmHeader}>
              <Text style={modern.swapConfirmTitle}>Confirm Swap</Text>
              <View style={modern.swapConfirmCloseSlot}>
                <PressScale
                  onPress={() => setReviewing(false)}
                  style={modern.swapConfirmClose}
                >
                  <Ionicons color="#FFFFFF" name="close" size={18} />
                </PressScale>
              </View>
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
                <Text style={modern.swapConfirmDetailLabel}>Price Impact</Text>
                <Text
                  style={[
                    modern.swapConfirmDetailValue,
                    modern.swapConfirmPositiveValue,
                  ]}
                >
                  &lt; 0.01%
                </Text>
              </View>
              <View style={modern.swapConfirmDetailRow}>
                <Text style={modern.swapConfirmDetailLabel}>Network Fee</Text>
                <Text style={modern.swapConfirmDetailValue}>0.00001 XLM</Text>
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
              disabled={wallet.isBusy || !canSwap}
              onPress={handleSwap}
              style={modern.swapConfirmButton}
            >
              <Text style={modern.swapConfirmButtonText}>CONFIRM SWAP</Text>
            </PressScale>
          </View>
        </View>
      </Modal>

      <AssetPickerModal
        assets={assets}
        disabledAssetCodes={pickerMode === 'sell' ? [buyCode] : [sellCode]}
        onAddTrustline={wallet.addTrustline}
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
