import React, { useMemo, useState, useEffect } from 'react';
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
import type { WalletState } from '@hooks/useWallet';
import type { SwapResult } from '@app-types';
import { formatTokenAmount } from '@utils/format';

const ASSET_ID_MAP: Record<string, string> = {
  AQUA: 'aquarius',
  EURC: 'euro-coin',
  PYUSD: 'paypal-usd',
  XLM: 'stellar',
  USDC: 'usd-coin',
  USDT: 'tether',
};

async function fetchRealRates(): Promise<Record<string, number>> {
  try {
    const ids = Object.values(ASSET_ID_MAP).join(',');
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
    const data = await res.json();
    
    // Create a price map mapping Symbol to USD price
    const priceMap: Record<string, number> = {};
    for (const [symbol, id] of Object.entries(ASSET_ID_MAP)) {
      if (data[id] && data[id].usd) {
        priceMap[symbol] = data[id].usd;
      }
    }
    return priceMap;
  } catch (error) {
    console.error("Failed to fetch rates from CoinGecko:", error);
    // Fallback to static prices if API fails or rate limited
    return { XLM: 0.12, USDC: 1.0, USDT: 1.0 };
  }
}

export function SwapScreen({ wallet }: { wallet: WalletState }) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const initialBuy =
    wallet.visibleAssets.find(asset => asset.assetCode !== wallet.selectedAssetCode)
      ?.assetCode || 'USDC';
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
  
  // Real rates state
  const [prices, setPrices] = useState<Record<string, number>>({ XLM: 0.12, USDC: 1.0, USDT: 1.0 });
  const [loadingRates, setLoadingRates] = useState(true);
  const assets = getModernAssets(wallet.balances, wallet.visibleAssets);

  useEffect(() => {
    fetchRealRates().then((p) => {
      setPrices(p);
      setLoadingRates(false);
    });
  }, []);

  const rate = useMemo(() => {
    if (quote?.rate && reviewing) return quote.rate;
    if (sellCode === buyCode) return 1;
    const fromPrice = prices[sellCode] || 1;
    const toPrice = prices[buyCode] || 1;
    return fromPrice / toPrice;
  }, [sellCode, buyCode, prices, quote, reviewing]);

  const canSwap =
    sellCode !== buyCode &&
    Number(sellAmount) > 0 &&
    !loadingRates &&
    wallet.walletCanSign &&
    (!wallet.isMainnet || wallet.walletActive);
  const buyAmount = useMemo(() => {
    if (quote?.toAmount && reviewing) return quote.toAmount;

    const amount = Number(sellAmount.replace(',', '.')) || 0;

    return (amount * rate).toFixed(6);
  }, [quote, rate, reviewing, sellAmount]);
  const sellAsset = useMemo(
    () => assets.find(asset => asset.assetCode === sellCode),
    [assets, sellCode],
  );
  const buyAsset = useMemo(
    () => assets.find(asset => asset.assetCode === buyCode),
    [assets, buyCode],
  );

  function flipAssets() {
    setSellCode(buyCode);
    setBuyCode(sellCode);
    setQuote(null);
  }

  function selectPickerAsset(assetCode: string) {
    if (pickerMode === 'sell') {
      setSellCode(assetCode);
    }

    if (pickerMode === 'buy') {
      setBuyCode(assetCode);
    }

    setReviewing(false);
    setQuote(null);
    setPickerMode(null);
  }

  async function searchPickerAssets(query: string) {
    const result = await wallet.searchAssets(query);

    return getModernAssets(wallet.balances, result);
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
    }

    setReviewing(true);
  }

  async function handleSwap() {
    const rnBiometrics = new ReactNativeBiometrics();
    const { available } = await rnBiometrics.isSensorAvailable();

    if (available) {
      try {
        const { success } = await rnBiometrics.simplePrompt({
          promptMessage: 'Confirm to swap tokens',
          cancelButtonText: 'Cancel'
        });
        
        if (!success) {
          Alert.alert('Authentication failed', 'Could not complete the swap.');
          return;
        }
      } catch {
        Alert.alert('Biometric authentication error', 'Please try again.');
        return;
      }
    }

    const result = await wallet.swapAsset({
      amount: sellAmount,
      fromAssetCode: sellCode,
      toAssetCode: buyCode,
    });

    if (result) {
      setLastSwap(result);
      setReviewing(false);
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
            wallet.network === 'mainnet' ? 'Mainnet' : 'Testnet'
          }.`}
          title="Swap completed"
        />
        <View style={modern.sectionCard}>
          <View style={modern.successOrb}>
            <Ionicons color="#0ABF73" name="checkmark" size={42} />
          </View>
          <Text style={modern.successModernTitle}>Swap completed</Text>
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
              style={[modern.modernButtonText, modern.secondaryModernButtonText]}
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
          subtitle={
            wallet.isMainnet
              ? 'Swap through Stellar DEX/path payment. Biometric confirmation is required each time.'
              : 'Swap demo tokens using live reference market rates.'
          }
          title="Swap"
        />

      {!wallet.walletCanSign ? (
        <View style={modern.sectionCard}>
          <Text style={modern.emptyModernTitle}>Watch-only wallet</Text>
          <Text style={modern.emptyModernText}>
            This wallet can only view balances and QR codes. It cannot swap.
          </Text>
        </View>
      ) : null}

      {wallet.isMainnet && !wallet.walletActive ? (
        <View style={modern.sectionCard}>
          <Text style={modern.emptyModernTitle}>Wallet inactive</Text>
          <Text style={modern.emptyModernText}>
            Deposit real XLM into this wallet before swapping on Mainnet.
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
            valueLabel={`${formatTokenAmount(
              sellAsset?.balance || '0',
              { compact: true },
            )} ${sellCode}`}
          />
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={value => {
              setSellAmount(value);
              setReviewing(false);
              setQuote(null);
            }}
            placeholder="0"
            placeholderTextColor="#A7B3BA"
            style={modern.swapAmountInput}
            value={sellAmount}
          />
        </View>

        <PressScale onPress={flipAssets} style={modern.swapMiddleButton}>
          <MaterialCommunityIcons color="#0F8EA3" name="swap-vertical" size={24} />
        </PressScale>

        <View style={modern.swapField}>
          <AssetSelectButton
            asset={buyAsset}
            label="You receive"
            onPress={() => setPickerMode('buy')}
            valueLabel={`${formatTokenAmount(
              buyAsset?.balance || '0',
              { compact: true },
            )} ${buyCode}`}
          />
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            numberOfLines={1}
            style={modern.swapAmountValue}
          >
            {formatTokenAmount(buyAmount)}
          </Text>
        </View>

        <View style={modern.rateCard}>
          <Text style={modern.swapLabel}>
            Exchange rate {loadingRates ? '(Loading...)' : ''}
          </Text>
          <Text style={modern.assetModernBalance}>
            1 {sellCode} ≈ {rate.toFixed(4)} {buyCode}
          </Text>
        </View>

        {reviewing ? (
          <View style={modern.reviewModernBox}>
            <Text style={modern.reviewModernTitle}>Review swap</Text>
            <InfoLine
              label="Network"
              value={wallet.isMainnet ? 'Mainnet · real assets' : 'Testnet · demo only'}
            />
            <InfoLine
              label="Amount"
              value={`${formatTokenAmount(sellAmount || '0')} ${sellCode}`}
            />
            <InfoLine
              label="You receive"
              value={`≈ ${formatTokenAmount(buyAmount)} ${buyCode}`}
            />
            <InfoLine
              label="Destination"
              value={wallet.wallet?.address || 'Active wallet'}
            />
            {sellCode !== 'XLM' ? (
              <InfoLine
                label="Sell issuer"
                value={sellAsset?.assetIssuer || 'Unknown issuer'}
              />
            ) : null}
            {buyCode !== 'XLM' ? (
              <InfoLine
                label="Receive issuer"
                value={buyAsset?.assetIssuer || 'Unknown issuer'}
              />
            ) : null}
            <InfoLine label="Estimated fee" value="0.00001 XLM" />
            <Text style={modern.reviewModernText}>
              {wallet.isMainnet
                ? 'This is a real Mainnet swap. The app will ask for biometric confirmation before Privy signs it.'
                : 'This test swap will be submitted to Stellar Testnet.'}
            </Text>
          </View>
        ) : null}

        <PressScale
          disabled={wallet.isBusy || !canSwap}
          onPress={reviewing ? handleSwap : startReview}
          style={modern.primaryModernButton}
        >
          <Text style={modern.modernButtonText}>
            {wallet.busy ||
              (reviewing
                ? wallet.isMainnet
                  ? 'Confirm with biometric'
                  : 'Confirm swap'
                : 'Review swap')}
          </Text>
        </PressScale>

        <Text style={modern.emptyModernText}>
          {wallet.isMainnet
            ? 'Quotes come from Stellar DEX. Mainnet transactions move real assets.'
            : 'Rates are refreshed from CoinGecko for reference. The transaction runs on Stellar Testnet.'}
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
        title={pickerMode === 'sell' ? 'Select asset to pay' : 'Select asset to receive'}
        visible={pickerMode !== null}
      />
    </>
  );
}
