import React, { useMemo, useState } from 'react';

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-wagmi-charts';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useHistoricalPrice, Timeframe } from '../../hooks/useHistoricalPrice';
import {
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  TokenIcon,
  modern,
  useSafeScreenInsetStyle,
  ExplorerLink,
} from '@components/wallet';
import type { AssetItem, BalanceItem } from '@app-types';
import type { WalletState } from '@hooks/useWallet';
import { formatTokenAmount, shortAddress } from '@utils/format';

type AssetRouteParams = {
  asset?: AssetItem | BalanceItem;
  assetCode?: string;
  assetIssuer?: string | null;
};

function hasBalance(asset: AssetItem | BalanceItem): asset is BalanceItem {
  return 'balance' in asset;
}

function formatUsd(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  if (value < 0.01) {
    return `$${value.toPrecision(3)}`;
  }

  return `$${value.toLocaleString('en-US', {
    maximumFractionDigits: 4,
    minimumFractionDigits: 2,
  })}`;
}

function formatCompact(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return value.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    notation: 'compact',
  });
}

function makeFallbackAsset(
  params: AssetRouteParams,
  network: WalletState['network'],
): BalanceItem {
  const assetCode = params.assetCode || params.asset?.assetCode || 'XLM';
  const assetIssuer = params.assetIssuer ?? params.asset?.assetIssuer ?? null;
  const isNative = assetCode === 'XLM' && !assetIssuer;

  return {
    assetCode,
    assetIssuer,
    balance: '0',
    demo: network === 'testnet',
    displayName: params.asset?.displayName || assetCode,
    exists: false,
    homeDomain: params.asset?.homeDomain,
    iconKey: params.asset?.iconKey,
    image: params.asset?.image,
    isNative,
    network,
    priceUsd: params.asset?.priceUsd,
    rating: params.asset?.rating,
    trustLevel: params.asset?.trustLevel || 'unverified',
    trusted: isNative,
    volume7d: params.asset?.volume7d,
  };
}

function mergeRouteAsset(
  params: AssetRouteParams,
  wallet: WalletState,
): BalanceItem {
  const routeAsset = params.asset;
  const assetCode = params.assetCode || routeAsset?.assetCode;
  const assetIssuer = params.assetIssuer ?? routeAsset?.assetIssuer ?? null;
  const balanceAsset = wallet.balances.find(
    item =>
      item.assetCode === assetCode &&
      (item.assetIssuer || null) === (assetIssuer || null),
  );

  if (balanceAsset) {
    return {
      ...routeAsset,
      ...balanceAsset,
      image: routeAsset?.image || balanceAsset.image,
      priceUsd: routeAsset?.priceUsd ?? balanceAsset.priceUsd,
      rating: routeAsset?.rating ?? balanceAsset.rating,
      volume7d: routeAsset?.volume7d ?? balanceAsset.volume7d,
    };
  }

  if (routeAsset && hasBalance(routeAsset)) {
    return routeAsset;
  }

  if (routeAsset) {
    return {
      ...routeAsset,
      balance: '0',
      exists: false,
      trusted: routeAsset.isNative,
    };
  }

  const visibleAsset = wallet.visibleAssets.find(
    item =>
      item.assetCode === assetCode &&
      (item.assetIssuer || null) === (assetIssuer || null),
  );

  if (visibleAsset) {
    return {
      ...visibleAsset,
      balance: '0',
      exists: false,
      trusted: visibleAsset.isNative,
    };
  }

  return makeFallbackAsset(params, wallet.network);
}



export function AssetDetailScreen({
  onBack,
  onGoToReceive,
  onGoToRamp,
  onGoToSend,
  route,
  wallet,
}: {
  onBack: () => void;
  onGoToReceive: () => void;
  onGoToRamp: (direction?: 'buy' | 'sell') => void;
  onGoToSend: (assetCode?: string) => void;
  route: { params?: AssetRouteParams };
  wallet: WalletState;
}) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const asset = useMemo(
    () => mergeRouteAsset(route.params || {}, wallet),
    [route.params, wallet],
  );
  
  const [timeframe, setTimeframe] = useState<Timeframe>('7D');
  const { data: chartData, loading: chartLoading } = useHistoricalPrice(asset.assetCode, timeframe);
  
  const needsTrustline = !asset.isNative && !asset.trusted;

  const currentPrice = asset.priceUsd ? `$${asset.priceUsd.toPrecision(4)}` : '$0.00';
  const balanceValue = Number(asset.balance);
  const balanceUsd = asset.priceUsd ? formatUsd(balanceValue * asset.priceUsd) : '$0.00';
  
  // Calculate price change if we have chart data
  let priceChangeStr = '+0.00%';
  let isPositive = true;
  if (chartData.length > 0) {
    const startPrice = chartData[0].value;
    const endPrice = chartData[chartData.length - 1].value;
    const change = ((endPrice - startPrice) / startPrice) * 100;
    isPositive = change >= 0;
    priceChangeStr = `${isPositive ? '+' : ''}${change.toFixed(2)}%`;
  }

  return (
    <View style={[screenInsetStyle, { flex: 1, backgroundColor: '#0A0A0A' }]}>
      {/* Custom Header */}
      <View style={styles.headerRow}>
        <PressScale onPress={onBack} style={styles.headerIconBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </PressScale>
        <View style={styles.headerRight}>
          <PressScale style={styles.headerIconBtn}>
            <Ionicons name="star-outline" size={22} color="#FFFFFF" />
          </PressScale>
          <PressScale style={styles.headerIconBtn}>
            <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
          </PressScale>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Asset Header Info */}
        <View style={styles.assetHeaderInfo}>
          <View style={styles.assetTitleRow}>
            <TokenIcon assetCode={asset.assetCode} imageUrl={asset.image} size={40} />
            <View style={styles.assetNameCol}>
              <Text style={styles.assetName}>{asset.displayName}</Text>
              <Text style={styles.assetSymbol}>{asset.assetCode}</Text>
            </View>
          </View>
          
          <Text style={styles.currentPrice}>{currentPrice}</Text>
          <Text style={[styles.priceChange, { color: isPositive ? '#B8FF45' : '#FF453A' }]}>
            <Ionicons name={isPositive ? "arrow-up" : "arrow-down"} size={12} /> {priceChangeStr}
          </Text>
        </View>

        {/* Chart Section */}
        <View style={styles.chartContainer}>
          {chartData.length > 0 ? (
            <LineChart.Provider data={chartData}>
              <LineChart width={400} height={200}>
                <LineChart.Path color="#B8FF45">
                  <LineChart.Gradient color="#B8FF45" />
                </LineChart.Path>
                <LineChart.CursorCrosshair color="#B8FF45" />
              </LineChart>
            </LineChart.Provider>
          ) : (
            <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#555' }}>{chartLoading ? 'Loading chart...' : 'No chart data'}</Text>
            </View>
          )}
        </View>

        {/* Timeframe Selector Removed - Stellar Expert only provides 7D data */}

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Your Balance</Text>
          <Text style={styles.balanceAmount}>{formatTokenAmount(asset.balance)} {asset.assetCode}</Text>
          <Text style={styles.balanceUsd}>{balanceUsd}</Text>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action */}
      <View style={styles.bottomActionContainer}>
        {needsTrustline ? (
          <PressScale 
            style={styles.buyButton} 
            onPress={() => wallet.addTrustline(asset.assetCode, asset.assetIssuer || undefined)}
            disabled={wallet.isBusy}
          >
            <Text style={styles.buyButtonText}>Enable Asset</Text>
          </PressScale>
        ) : (
          <PressScale style={styles.buyButton} onPress={() => onGoToRamp('buy')}>
            <Text style={styles.buyButtonText}>Buy {asset.assetCode}</Text>
          </PressScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  assetHeaderInfo: {
    paddingHorizontal: 24,
    marginTop: 10,
  },
  assetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  assetNameCol: {
    justifyContent: 'center',
  },
  assetName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  assetSymbol: {
    color: '#8A8A8E',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  currentPrice: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  priceChange: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  chartContainer: {
    marginTop: 30,
    height: 200,
    width: '100%',
  },
  timeframeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 30,
    paddingHorizontal: 20,
  },
  timeframeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  timeframeBtnActive: {
    borderColor: '#B8FF45',
    backgroundColor: 'rgba(184, 255, 69, 0.1)',
  },
  timeframeText: {
    color: '#8A8A8E',
    fontSize: 12,
    fontWeight: '700',
  },
  timeframeTextActive: {
    color: '#B8FF45',
  },
  balanceCard: {
    backgroundColor: '#1C1C1E',
    marginHorizontal: 20,
    marginTop: 40,
    borderRadius: 20,
    padding: 24,
  },
  balanceLabel: {
    color: '#8A8A8E',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  balanceUsd: {
    color: '#8A8A8E',
    fontSize: 15,
    fontWeight: '500',
  },
  bottomActionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40, // for safe area
    backgroundColor: '#0A0A0A',
  },
  buyButton: {
    backgroundColor: '#B8FF45',
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#B8FF45',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  buyButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '800',
  },
});

