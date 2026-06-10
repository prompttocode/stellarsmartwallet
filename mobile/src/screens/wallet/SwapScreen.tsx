import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeBiometrics from 'react-native-biometrics';
import {
  AssetPickerModal,
  AssetSelectButton,
  getModernAssets,
  InfoLine,
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  modern,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import type { SwapResult } from '@app-types';
import type { WalletState } from '@hooks/useWallet';
import { formatTokenAmount } from '@utils/format';

export function SwapScreen({ wallet }: { wallet: WalletState }) {
  const screenInsetStyle = useSafeScreenInsetStyle();
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
            Alert.alert('Authentication failed', 'The swap was not submitted.');
            return;
          }
        } catch {
          Alert.alert('Biometric error', 'Please try again.');
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
            <Ionicons color="#0ABF73" name="checkmark" size={42} />
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
        contentContainerStyle={screenInsetStyle}
        showsVerticalScrollIndicator={false}
      >
        <ModernScreenHeader
          subtitle="Exchange XLM and USDC on Stellar. This does not withdraw VND to a bank."
          title="Swap tokens"
        />

        {!wallet.walletCanSign ? (
          <View style={modern.sectionCard}>
            <Text style={modern.emptyModernTitle}>Watch-only wallet</Text>
            <Text style={modern.emptyModernText}>
              This wallet cannot sign a Stellar path payment.
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

        <View style={modern.formCard}>
          <SectionHeader title="Exchange" />
          <View style={modern.swapField}>
            <AssetSelectButton
              asset={sellAsset}
              label="You pay"
              onPress={() => setPickerMode('sell')}
              valueLabel={`${formatTokenAmount(sellAsset?.balance || '0', {
                compact: true,
              })} ${sellCode}`}
            />
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={value => {
                setSellAmount(value);
                resetQuote();
              }}
              placeholder="0"
              placeholderTextColor="#A7B3BA"
              style={modern.swapAmountInput}
              value={sellAmount}
            />
          </View>

          <PressScale onPress={flipAssets} style={modern.swapMiddleButton}>
            <MaterialCommunityIcons
              color="#0F8EA3"
              name="swap-vertical"
              size={24}
            />
          </PressScale>

          <View style={modern.swapField}>
            <AssetSelectButton
              asset={buyAsset}
              label="You receive"
              onPress={() => setPickerMode('buy')}
              valueLabel={`${formatTokenAmount(buyAsset?.balance || '0', {
                compact: true,
              })} ${buyCode}`}
            />
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              numberOfLines={1}
              style={modern.swapAmountValue}
            >
              {quote ? formatTokenAmount(quote.toAmount) : 'Quote required'}
            </Text>
          </View>

          <View style={modern.rateCard}>
            <Text style={modern.swapLabel}>Exchange rate</Text>
            <Text style={modern.assetModernBalance}>
              {quote
                ? `1 ${sellCode} ≈ ${quote.rate.toFixed(7)} ${buyCode}`
                : 'Not loaded'}
            </Text>
          </View>

          {reviewing && quote ? (
            <View style={modern.reviewModernBox}>
              <Text style={modern.reviewModernTitle}>Review swap</Text>
              <InfoLine
                label="Network"
                value={
                  wallet.isMainnet
                    ? 'Mainnet · real assets'
                    : 'Testnet · testing only'
                }
              />
              <InfoLine
                label="Amount"
                value={`${formatTokenAmount(sellAmount)} ${sellCode}`}
              />
              <InfoLine
                label="Minimum receive"
                value={`≈ ${formatTokenAmount(quote.toAmount)} ${buyCode}`}
              />
              <InfoLine
                label="Destination"
                value={wallet.wallet?.address || 'Active wallet'}
              />
              <InfoLine label="Network fee" value="0.00001 XLM" />
              <Text style={modern.reviewModernText}>
                {wallet.isMainnet
                  ? 'Biometric confirmation is required before signing.'
                  : 'The transaction is submitted to Stellar Testnet and has no monetary value.'}
              </Text>
            </View>
          ) : null}

          <PressScale
            disabled={wallet.isBusy || !canSwap}
            onPress={reviewing ? handleSwap : startReview}
            style={modern.primaryModernButton}
          >
            <Text style={modern.modernButtonText}>
              {reviewing
                ? wallet.isMainnet
                  ? 'Confirm with biometric'
                  : 'Confirm swap'
                : 'Get Stellar quote'}
            </Text>
          </PressScale>
          <Text style={modern.emptyModernText}>
            Quotes and execution both use Stellar Horizon path payment data.
          </Text>
        </View>
      </ScrollView>

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
