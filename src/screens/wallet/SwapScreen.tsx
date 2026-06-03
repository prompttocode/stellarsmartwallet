import React, { useMemo, useState, useEffect } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeBiometrics from 'react-native-biometrics';
import Toast from 'react-native-toast-message';
import {
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  TokenPillSelector,
  modern,
} from '../../components/wallet/ModernWalletUI';
import type { WalletDemoState } from '../../hooks/useWalletDemo';
import type { SwapResult } from '../../types';

const ASSET_ID_MAP: Record<string, string> = {
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

export function SwapScreen({ wallet }: { wallet: WalletDemoState }) {
  const initialBuy =
    wallet.visibleAssets.find(asset => asset.assetCode !== wallet.selectedAssetCode)
      ?.assetCode || 'USDC';
  const [sellCode, setSellCode] = useState(wallet.selectedAssetCode);
  const [buyCode, setBuyCode] = useState(initialBuy);
  const [sellAmount, setSellAmount] = useState('10');
  const [reviewing, setReviewing] = useState(false);
  const [lastSwap, setLastSwap] = useState<SwapResult | null>(null);
  
  // Real rates state
  const [prices, setPrices] = useState<Record<string, number>>({ XLM: 0.12, USDC: 1.0, USDT: 1.0 });
  const [loadingRates, setLoadingRates] = useState(true);

  useEffect(() => {
    fetchRealRates().then((p) => {
      setPrices(p);
      setLoadingRates(false);
    });
  }, []);

  const rate = useMemo(() => {
    if (sellCode === buyCode) return 1;
    const fromPrice = prices[sellCode] || 1;
    const toPrice = prices[buyCode] || 1;
    return fromPrice / toPrice;
  }, [sellCode, buyCode, prices]);

  const canSwap = sellCode !== buyCode && Number(sellAmount) > 0 && !loadingRates;
  const buyAmount = useMemo(() => {
    const amount = Number(sellAmount.replace(',', '.')) || 0;

    return (amount * rate).toFixed(6);
  }, [rate, sellAmount]);

  function flipAssets() {
    setSellCode(buyCode);
    setBuyCode(sellCode);
  }

  async function handleSwap() {
    const rnBiometrics = new ReactNativeBiometrics();
    const { available } = await rnBiometrics.isSensorAvailable();

    if (available) {
      try {
        const { success } = await rnBiometrics.simplePrompt({
          promptMessage: 'Xác thực để hoán đổi token',
          cancelButtonText: 'Hủy'
        });
        
        if (!success) {
          Toast.show({ type: 'error', text1: 'Xác thực thất bại' });
          return;
        }
      } catch (e) {
        Toast.show({ type: 'error', text1: 'Lỗi xác thực sinh trắc học' });
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
      Toast.show({ type: 'success', text1: 'Hoán đổi thành công!' });
    } else {
      Toast.show({ type: 'error', text1: 'Hoán đổi thất bại', text2: wallet.message });
    }
  }

  if (lastSwap) {
    return (
      <ScrollView
        contentContainerStyle={modern.screenInset}
        showsVerticalScrollIndicator={false}
      >
        <ModernScreenHeader
          subtitle="Giao dịch đã được gửi lên Stellar Testnet."
          title="Swap completed"
        />
        <View style={modern.sectionCard}>
          <View style={modern.successOrb}>
            <Ionicons color="#0ABF73" name="checkmark" size={42} />
          </View>
          <Text style={modern.successModernTitle}>Swap completed</Text>
          <Text style={modern.successModernText}>
            {lastSwap.fromAmount} {lastSwap.fromAssetCode} →{' '}
            {lastSwap.toAmount} {lastSwap.toAssetCode}
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
    <ScrollView
      contentContainerStyle={modern.screenInset}
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader
        subtitle="Hoán đổi token nhanh chóng với tỷ giá thời gian thực từ thị trường."
        title="Swap"
      />

      <View style={modern.formCard}>
        <SectionHeader title="Exchange" />
        <View style={modern.swapField}>
          <View style={modern.swapFieldTop}>
            <Text style={modern.swapLabel}>You pay</Text>
            <Text style={modern.swapLabel}>{sellCode}</Text>
          </View>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={value => {
              setSellAmount(value);
              setReviewing(false);
            }}
            placeholder="0"
            placeholderTextColor="#A7B3BA"
            style={modern.swapAmountInput}
            value={sellAmount}
          />
          <TokenPillSelector
            assets={wallet.visibleAssets}
            onSelect={value => {
              setSellCode(value);
              setReviewing(false);
            }}
            selectedAssetCode={sellCode}
          />
        </View>

        <PressScale onPress={flipAssets} style={modern.swapMiddleButton}>
          <MaterialCommunityIcons color="#0F8EA3" name="swap-vertical" size={24} />
        </PressScale>

        <View style={modern.swapField}>
          <View style={modern.swapFieldTop}>
            <Text style={modern.swapLabel}>You receive</Text>
            <Text style={modern.swapLabel}>{buyCode}</Text>
          </View>
          <Text style={modern.swapAmountValue}>{buyAmount}</Text>
          <TokenPillSelector
            assets={wallet.visibleAssets}
            onSelect={value => {
              setBuyCode(value);
              setReviewing(false);
            }}
            selectedAssetCode={buyCode}
          />
        </View>

        <View style={modern.rateCard}>
          <Text style={modern.swapLabel}>Exchange rate {loadingRates ? '(Loading...)' : ''}</Text>
          <Text style={modern.assetModernBalance}>
            1 {sellCode} ≈ {rate.toFixed(4)} {buyCode}
          </Text>
        </View>

        {reviewing ? (
          <View style={modern.reviewModernBox}>
            <Text style={modern.reviewModernTitle}>Review swap</Text>
            <Text style={modern.reviewModernText}>
              Swap {sellAmount || '0'} {sellCode} để nhận khoảng {buyAmount}{' '}
              {buyCode}.
            </Text>
          </View>
        ) : null}

        <PressScale
          disabled={wallet.isBusy || !canSwap}
          onPress={reviewing ? handleSwap : () => setReviewing(true)}
          style={modern.primaryModernButton}
        >
          <Text style={modern.modernButtonText}>
            {wallet.busy || (reviewing ? 'Confirm swap' : 'Review swap')}
          </Text>
        </PressScale>

        <Text style={modern.emptyModernText}>
          Tỷ giá được cập nhật trực tiếp từ thị trường (CoinGecko API). Giao dịch sẽ được xử lý trên mạng lưới thử nghiệm Stellar Testnet.
        </Text>
      </View>
    </ScrollView>
  );
}
