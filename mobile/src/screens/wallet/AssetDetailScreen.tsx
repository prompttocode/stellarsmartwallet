import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
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

function MetadataRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <View style={modern.infoRow}>
      <Text style={modern.infoLabel}>{label}</Text>
      <Text numberOfLines={2} selectable style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
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
  const canUse = asset.isNative || asset.trusted;
  const needsTrustline = !asset.isNative && !asset.trusted;
  const supportsVndOrders = ['XLM', 'USDC'].includes(asset.assetCode);
  const badgeLabel = needsTrustline
    ? 'Enable asset'
    : asset.demo
    ? 'Demo'
    : asset.trustLevel === 'verified'
    ? 'Verified'
    : 'Unverified';
  const explorerNetwork = wallet.network === 'mainnet' ? 'public' : 'testnet';
  const assetExplorerUrl =
    !asset.isNative && asset.assetIssuer
      ? `https://stellar.expert/explorer/${explorerNetwork}/asset/${asset.assetCode}-${asset.assetIssuer}`
      : wallet.explorerAddressUrl;
  const canOpenExplorer =
    Boolean(assetExplorerUrl) &&
    (!asset.isNative || !wallet.isMainnet || wallet.walletActive);

  function enableAsset() {
    wallet.addTrustline(asset.assetCode, asset.assetIssuer || undefined);
  }

  return (
    <ScrollView
      contentContainerStyle={screenInsetStyle}
      style={{ backgroundColor: '#000000' }}
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader
        onBack={onBack}
        title={asset.assetCode}
        subtitle={`${asset.displayName} on ${
          wallet.isMainnet ? 'Mainnet' : 'Testnet'
        }`}
      />

      <View style={modern.sectionCard}>
        <View style={styles.hero}>
          <TokenIcon
            assetCode={asset.assetCode}
            imageUrl={asset.image}
            size={70}
          />
          <View style={styles.heroCopy}>
            <View style={styles.titleLine}>
              <Text numberOfLines={1} style={styles.assetCode}>
                {asset.assetCode}
              </Text>
              <View
                style={[
                  modern.assetBadge,
                  badgeLabel === 'Demo'
                    ? modern.assetBadgeDemo
                    : badgeLabel === 'Verified'
                    ? modern.assetBadgeVerified
                    : badgeLabel === 'Enable asset'
                    ? modern.assetBadgeTrustline
                    : modern.assetBadgeUnverified,
                ]}
              >
                <Text
                  style={[
                    modern.assetBadgeText,
                    badgeLabel === 'Demo'
                      ? modern.assetBadgeTextDemo
                      : badgeLabel === 'Verified'
                      ? modern.assetBadgeTextVerified
                      : badgeLabel === 'Enable asset'
                      ? modern.assetBadgeTextTrustline
                      : modern.assetBadgeTextUnverified,
                  ]}
                >
                  {badgeLabel}
                </Text>
              </View>
            </View>
            <Text numberOfLines={2} style={styles.assetName}>
              {asset.displayName}
            </Text>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <Text style={modern.infoLabel}>Balance</Text>
          <Text style={styles.balanceValue}>
            {canUse
              ? `${formatTokenAmount(asset.balance, { compact: true })} ${
                  asset.assetCode
                }`
              : 'Not enabled'}
          </Text>
          <Text style={styles.balanceMeta}>
            {needsTrustline
              ? 'Enable this asset before you can receive or hold it.'
              : asset.limit
              ? `Trustline limit ${asset.limit}`
              : 'Ready for wallet actions.'}
          </Text>
        </View>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Asset info" />
        <MetadataRow
          label="Network"
          value={wallet.isMainnet ? 'Mainnet' : 'Testnet'}
        />
        <MetadataRow
          label="Issuer"
          value={asset.isNative ? 'Native Stellar asset' : asset.assetIssuer}
        />
        <MetadataRow
          label="Issuer short"
          value={shortAddress(asset.assetIssuer || undefined)}
        />
        <MetadataRow label="Home domain" value={asset.homeDomain} />
        <MetadataRow label="Price" value={formatUsd(asset.priceUsd)} />
        <MetadataRow
          label="Rating"
          value={
            typeof asset.rating === 'number'
              ? asset.rating.toLocaleString('en-US')
              : null
          }
        />
        <MetadataRow label="Volume 7d" value={formatCompact(asset.volume7d)} />
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Actions" />
        {needsTrustline ? (
          <PressScale
            disabled={wallet.isBusy}
            onPress={enableAsset}
            style={modern.primaryModernButton}
          >
            <Text style={modern.modernButtonText}>Enable asset</Text>
          </PressScale>
        ) : (
          <>
            <PressScale
              disabled={wallet.isBusy}
              onPress={() => onGoToSend(asset.assetCode)}
              style={modern.primaryModernButton}
            >
              <Text style={modern.modernButtonText}>
                Send {asset.assetCode}
              </Text>
            </PressScale>
            <PressScale
              disabled={wallet.isBusy}
              onPress={onGoToReceive}
              style={modern.secondaryModernButton}
            >
              <Text
                style={[
                  modern.modernButtonText,
                  modern.secondaryModernButtonText,
                ]}
              >
                Receive
              </Text>
            </PressScale>
            {supportsVndOrders ? (
              <>
                <PressScale
                  disabled={wallet.isBusy}
                  onPress={() => onGoToRamp('buy')}
                  style={modern.secondaryModernButton}
                >
                  <Text
                    style={[
                      modern.modernButtonText,
                      modern.secondaryModernButtonText,
                    ]}
                  >
                    Buy with VND
                  </Text>
                </PressScale>
                <PressScale
                  disabled={wallet.isBusy}
                  onPress={() => onGoToRamp('sell')}
                  style={modern.secondaryModernButton}
                >
                  <Text
                    style={[
                      modern.modernButtonText,
                      modern.secondaryModernButtonText,
                    ]}
                  >
                    Withdraw to bank
                  </Text>
                </PressScale>
              </>
            ) : null}
          </>
        )}
        <ExplorerLink disabled={!canOpenExplorer} onPress={() => wallet.openUrl(assetExplorerUrl)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  assetCode: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontSize: 30,
    fontWeight: '900',
  },
  assetName: {
    color: '#7E909A',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  balanceCard: {
    backgroundColor: '#111318',
    borderRadius: 22,
    gap: 6,
    padding: 16,
  },
  balanceMeta: {
    color: '#7E909A',
    fontSize: 13,
    lineHeight: 18,
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  explorerButton: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  explorerText: {
    color: '#B8FF45',
    fontSize: 13,
    fontWeight: '900',
  },
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  infoValue: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
    marginLeft: 12,
    textAlign: 'right',
  },
  titleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
