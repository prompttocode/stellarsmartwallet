import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  AssetListItem,
  ModernScreenHeader,
  getModernAssets,
  modern,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import type { AssetItem, BalanceItem } from '@app-types';
import type { WalletState } from '@hooks/useWallet';

export function AssetSearchScreen({
  onBack,
  onGoToAssetDetail,
  onGoToFaucet,
  onGoToRamp,
  onGoToSend,
  wallet,
}: {
  onBack: () => void;
  onGoToAssetDetail: (asset: BalanceItem) => void;
  onGoToFaucet: () => void;
  onGoToRamp: () => void;
  onGoToSend: (assetCode?: string) => void;
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
    if (!trimmedQuery) {
      setRemoteAssets([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setIsSearching(true);
      setError(null);
      searchAssetsRef.current(trimmedQuery)
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
    () => getModernAssets(wallet.balances, remoteAssets),
    [remoteAssets, wallet.balances],
  );

  function handleSecondaryAction(assetCode: string) {
    if (wallet.isMainnet) {
      onGoToFaucet();
      return;
    }

    if (assetCode === 'XLM') {
      wallet.fundWallet();
      return;
    }

    onGoToRamp();
  }

  const emptyText = !trimmedQuery
    ? 'Search by asset code, name, issuer, or domain.'
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
        title="Search assets"
        subtitle={
          wallet.isMainnet
            ? 'Find Stellar Mainnet assets from the remote asset API.'
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
          Results come from the API for the selected network. Your Home asset
          list stays clean.
        </Text>
      </View>

      <View style={modern.sectionCard}>
        {assets.length > 0 ? (
          assets.map((asset, index) => (
            <AssetListItem
              asset={asset}
              disabled={wallet.isBusy}
              index={index}
              key={`${asset.assetCode}:${asset.assetIssuer || 'native'}`}
              onAdd={wallet.addTrustline}
              onFaucet={handleSecondaryAction}
              onPress={onGoToAssetDetail}
              onSend={onGoToSend}
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
