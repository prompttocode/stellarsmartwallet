import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  AssetListItem,
  ModernScreenHeader,
  SectionHeader,
  modern,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import type { AssetItem, BalanceItem } from '@app-types';
import type { WalletState } from '@hooks/useWallet';

function getAssetKey(asset: AssetItem) {
  return asset.isNative
    ? `${asset.network}:native`
    : `${asset.network}:${asset.assetCode}:${asset.assetIssuer || ''}`;
}

function mergeMarketAssets(
  marketAssets: AssetItem[],
  balances: BalanceItem[],
) {
  return marketAssets.map(asset => {
    const balance = balances.find(item => getAssetKey(item) === getAssetKey(asset));

    return {
      ...asset,
      ...balance,
      image: asset.image || balance?.image || null,
      priceUsd: asset.priceUsd ?? balance?.priceUsd ?? null,
      rating: asset.rating ?? balance?.rating ?? null,
      volume7d: asset.volume7d ?? balance?.volume7d ?? null,
      balance: balance?.balance || '0',
      exists: balance?.exists || false,
      trusted: balance?.trusted ?? asset.isNative,
    };
  });
}

export function AssetSearchScreen({
  onBack,
  onGoToAssetDetail,
  wallet,
}: {
  onBack: () => void;
  onGoToAssetDetail: (asset: BalanceItem) => void;
  wallet: WalletState;
}) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const [query, setQuery] = useState('');
  const [remoteAssets, setRemoteAssets] = useState<AssetItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchAssetsRef = useRef(wallet.searchAssets);
  const trimmedQuery = query.trim();

  useEffect(() => {
    searchAssetsRef.current = wallet.searchAssets;
  }, [wallet.searchAssets]);

  useEffect(() => {
    setRemoteAssets([]);
    setQuery('');
    setError(null);
  }, [wallet.network]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setIsSearching(true);
      setError(null);
      searchAssetsRef
        .current(trimmedQuery, { limit: trimmedQuery ? 40 : 100 })
        .then(result => {
          if (!cancelled) {
            setRemoteAssets(result);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRemoteAssets([]);
            setError('Could not search assets right now.');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsSearching(false);
          }
        });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery, wallet.network]);

  const assets = useMemo(
    () => mergeMarketAssets(remoteAssets, wallet.balances),
    [remoteAssets, wallet.balances],
  );

  const emptyText = !trimmedQuery
    ? isSearching
      ? 'Loading top assets from the remote API...'
      : 'No market assets returned by the API.'
    : isSearching
    ? 'Searching assets...'
    : error || 'No assets found from API.';

  return (
    <ScrollView
      contentContainerStyle={screenInsetStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader
        onBack={onBack}
        title="Asset market"
        subtitle={
          wallet.isMainnet
            ? 'Find Stellar Mainnet assets, prices, and issuers.'
            : 'Find Testnet assets supported by this app.'
        }
      />

      <View style={modern.sectionCard}>
        <View style={styles.searchBox}>
          <Ionicons color="#8A9AA3" name="search" size={22} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onChangeText={setQuery}
            placeholder="Search asset code, name or issuer..."
            placeholderTextColor="#A7B3BA"
            style={styles.searchInput}
            value={query}
          />
        </View>
        <Text style={styles.searchHint}>
          Results come from the selected network API. Tap an asset for details,
          actions, and enable status.
        </Text>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader
          title={trimmedQuery ? 'Search results' : 'Top market assets'}
        />
        {assets.length > 0 ? (
          assets.map((asset, index) => (
            <AssetListItem
              asset={asset}
              disabled={wallet.isBusy}
              index={index}
              key={`${asset.assetCode}:${asset.assetIssuer || 'native'}`}
              onAdd={wallet.addTrustline}
              onFaucet={() => undefined}
              onPress={onGoToAssetDetail}
              onSend={() => undefined}
              showAction={false}
              variant="market"
            />
          ))
        ) : (
          <View style={modern.emptyModern}>
            <Ionicons
              color={error ? '#D84C5F' : '#8A9AA3'}
              name={error ? 'warning-outline' : 'search-outline'}
              size={28}
            />
            <Text style={modern.emptyModernTitle}>
              {error ? 'Search failed' : 'Asset search'}
            </Text>
            <Text style={modern.emptyModernText}>{emptyText}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#F4F8FA',
    borderColor: '#E2EBEF',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 16,
  },
  searchHint: {
    color: '#7E909A',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  searchInput: {
    color: '#24495A',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    paddingVertical: 12,
  },
});
