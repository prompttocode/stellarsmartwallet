import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AssetItem, BalanceItem } from '@app-types';
import { formatTokenAmount, shortAddress } from '@utils/format';
import { modern } from '../modernStyles';
import { PressScale } from './primitives';
import { TokenIcon } from './token';

type AssetFilter = 'all' | 'available' | 'needsTrustline';

const filters: { label: string; value: AssetFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Available', value: 'available' },
  { label: 'Needs trustline', value: 'needsTrustline' },
];

function getPickerAssetKey(asset: AssetItem) {
  return asset.isNative
    ? `${asset.network}:native`
    : `${asset.network}:${asset.assetCode}:${asset.assetIssuer || ''}`;
}

function canUseAsset(asset: BalanceItem) {
  return asset.isNative || asset.trusted;
}

function getAssetPriceText(asset: BalanceItem) {
  if (typeof asset.priceUsd === 'number' && Number.isFinite(asset.priceUsd)) {
    return `≈ $${asset.priceUsd.toLocaleString('en-US', {
      maximumFractionDigits: asset.priceUsd >= 1 ? 2 : 6,
      minimumFractionDigits: asset.priceUsd >= 1 ? 2 : 0,
    })}`;
  }

  if (['EURC', 'PYUSD', 'USDC', 'USDT', 'yUSDC'].includes(asset.assetCode)) {
    return '≈ $1.00';
  }

  if (asset.assetCode === 'XLM') {
    return '≈ $0.12';
  }

  return null;
}

function getAssetSearchText(asset: BalanceItem) {
  return [
    asset.assetCode,
    asset.displayName,
    asset.homeDomain,
    asset.assetIssuer,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function mergeAssets(
  localAssets: BalanceItem[],
  remoteAssets: BalanceItem[],
) {
  const merged = new Map<string, BalanceItem>();

  for (const asset of localAssets) {
    merged.set(getPickerAssetKey(asset), asset);
  }

  for (const asset of remoteAssets) {
    const key = getPickerAssetKey(asset);
    const local = merged.get(key);

    merged.set(key, {
      ...asset,
      ...local,
      image: asset.image || local?.image || null,
      priceUsd: asset.priceUsd ?? local?.priceUsd ?? null,
      rating: asset.rating ?? local?.rating ?? null,
      volume7d: asset.volume7d ?? local?.volume7d ?? null,
    });
  }

  return [...merged.values()];
}

export function AssetSelectButton({
  asset,
  label,
  onPress,
  valueLabel,
}: {
  asset?: BalanceItem | null;
  label: string;
  onPress: () => void;
  valueLabel?: string;
}) {
  const priceText = asset ? getAssetPriceText(asset) : null;

  return (
    <PressScale onPress={onPress} style={modern.assetSelectButton}>
      {asset ? (
        <TokenIcon
          assetCode={asset.assetCode}
          imageUrl={asset.image}
          size={42}
        />
      ) : (
        <View style={modern.assetSelectEmptyIcon}>
          <Ionicons color="#7E8BA3" name="help" size={20} />
        </View>
      )}
      <View style={modern.assetSelectCopy}>
        <Text style={modern.assetSelectLabel}>{label}</Text>
        <Text numberOfLines={1} style={modern.assetSelectTitle}>
          {asset ? asset.assetCode : 'Select asset'}
        </Text>
        <Text numberOfLines={1} style={modern.assetSelectMeta}>
          {asset
            ? `${asset.displayName} · Balance ${formatTokenAmount(asset.balance, {
                compact: true,
              })}`
            : 'Search by token, issuer, or domain'}
        </Text>
      </View>
      <View style={modern.assetSelectRight}>
        {valueLabel ? (
          <Text numberOfLines={1} style={modern.assetSelectValue}>
            {valueLabel}
          </Text>
        ) : null}
        {priceText ? (
          <Text numberOfLines={1} style={modern.assetSelectPrice}>
            {priceText}
          </Text>
        ) : null}
        <Ionicons color="#8A9AA3" name="chevron-down" size={18} />
      </View>
    </PressScale>
  );
}

export function AssetPickerModal({
  assets,
  disabledAssetCodes = [],
  onAddTrustline,
  onClose,
  onRemoteSearch,
  onSelect,
  selectableOnlyTrusted = true,
  selectedAssetCode,
  title = 'Select asset',
  visible,
}: {
  assets: BalanceItem[];
  disabledAssetCodes?: string[];
  onAddTrustline?: (assetCode: string, assetIssuer?: string | null) => void;
  onClose: () => void;
  onRemoteSearch?: (query: string) => Promise<BalanceItem[]>;
  onSelect: (asset: BalanceItem) => void;
  selectableOnlyTrusted?: boolean;
  selectedAssetCode?: string;
  title?: string;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<AssetFilter>('all');
  const [query, setQuery] = useState('');
  const [remoteAssets, setRemoteAssets] = useState<BalanceItem[]>([]);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const trimmedQuery = query.trim();
  const useRemoteResults = Boolean(onRemoteSearch && trimmedQuery.length >= 2);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setActiveFilter('all');
      setRemoteAssets([]);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !onRemoteSearch || trimmedQuery.length < 2) {
      setRemoteAssets([]);
      setRemoteBusy(false);
      return;
    }

    let cancelled = false;
    setRemoteBusy(true);

    const timer = setTimeout(() => {
      onRemoteSearch(trimmedQuery)
        .then(result => {
          if (!cancelled) {
            setRemoteAssets(result);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRemoteAssets([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setRemoteBusy(false);
          }
        });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [onRemoteSearch, trimmedQuery, visible]);

  const disabledCodes = useMemo(
    () => new Set(disabledAssetCodes),
    [disabledAssetCodes],
  );
  const visibleAssets = useMemo(() => {
    const sourceAssets = useRemoteResults
      ? mergeAssets(assets, remoteAssets)
      : assets;
    const search = trimmedQuery.toLowerCase();

    return sourceAssets.filter(asset => {
      const available = canUseAsset(asset);
      const matchesSearch =
        useRemoteResults || !search || getAssetSearchText(asset).includes(search);
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'available' && available) ||
        (activeFilter === 'needsTrustline' && !available);

      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, assets, remoteAssets, trimmedQuery, useRemoteResults]);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={modern.assetPickerOverlay}>
        <View
          style={[
            modern.assetPickerSheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={modern.assetPickerHeader}>
            <View>
              <Text style={modern.assetPickerTitle}>{title}</Text>
              <Text style={modern.assetPickerSubtitle}>
                {useRemoteResults
                  ? 'Searching Stellar Expert'
                  : `${assets.length} assets loaded`}
              </Text>
            </View>
            <PressScale onPress={onClose} style={modern.assetPickerClose}>
              <Ionicons color="#24495A" name="close" size={20} />
            </PressScale>
          </View>

          <View style={modern.assetPickerSearch}>
            <Ionicons color="#8A9AA3" name="search" size={18} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search token, issuer, or domain"
              placeholderTextColor="#A7B3BA"
              style={modern.assetPickerSearchInput}
              value={query}
            />
          </View>

          <View style={modern.assetPickerFilters}>
            {filters.map(filter => {
              const selected = filter.value === activeFilter;

              return (
                <PressScale
                  key={filter.value}
                  onPress={() => setActiveFilter(filter.value)}
                  style={[
                    modern.assetPickerFilter,
                    selected ? modern.assetPickerFilterActive : null,
                  ]}
                >
                  <Text
                    style={[
                      modern.assetPickerFilterText,
                      selected ? modern.assetPickerFilterTextActive : null,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </PressScale>
              );
            })}
          </View>

          <FlatList
            data={visibleAssets}
            keyExtractor={getPickerAssetKey}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={modern.assetPickerEmpty}>
                <Text style={modern.emptyModernTitle}>
                  {remoteBusy ? 'Searching assets' : 'No assets found'}
                </Text>
                <Text style={modern.emptyModernText}>
                  Try another token name, issuer, or home domain.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const available = canUseAsset(item);
              const disabled =
                disabledCodes.has(item.assetCode) ||
                (selectableOnlyTrusted && !available);
              const selected = item.assetCode === selectedAssetCode;
              const priceText = getAssetPriceText(item);
              const assetName = item.displayName || item.assetCode;
              const assetMeta =
                item.homeDomain || shortAddress(item.assetIssuer || undefined);
              const selectItem = () => {
                onSelect(item);
                onClose();
              };

              return (
                <View
                  style={[
                    modern.assetPickerRow,
                    selected ? modern.assetPickerRowSelected : null,
                    disabled ? modern.assetPickerRowDisabled : null,
                  ]}
                >
                  <Pressable
                    disabled={disabled}
                    onPress={selectItem}
                    style={modern.assetPickerPressArea}
                  >
                    <TokenIcon
                      assetCode={item.assetCode}
                      imageUrl={item.image}
                      size={44}
                    />
                    <View style={modern.assetPickerBody}>
                      <View style={modern.assetPickerTitleRow}>
                        <Text numberOfLines={1} style={modern.assetPickerCode}>
                          {item.assetCode}
                        </Text>
                        <View
                          style={[
                            modern.assetBadge,
                            available
                              ? modern.assetBadgeVerified
                              : modern.assetBadgeTrustline,
                          ]}
                        >
                          <Text
                            style={[
                              modern.assetBadgeText,
                              available
                                ? modern.assetBadgeTextVerified
                                : modern.assetBadgeTextTrustline,
                            ]}
                          >
                            {available ? 'Available' : 'Trustline'}
                          </Text>
                        </View>
                      </View>
                      <Text numberOfLines={1} style={modern.assetPickerName}>
                        {assetName}
                      </Text>
                      <Text numberOfLines={1} style={modern.assetPickerMeta}>
                        {assetMeta}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={modern.assetPickerTrailing}>
                    <Pressable
                      disabled={disabled}
                      onPress={selectItem}
                      style={modern.assetPickerValueArea}
                    >
                      <Text numberOfLines={1} style={modern.assetPickerBalance}>
                        {formatTokenAmount(item.balance, { compact: true })}
                      </Text>
                      {priceText ? (
                        <Text numberOfLines={1} style={modern.assetPickerPrice}>
                          {priceText}
                        </Text>
                      ) : null}
                      {selected ? (
                        <Ionicons
                          color="#0ABF73"
                          name="checkmark-circle"
                          size={18}
                        />
                      ) : null}
                    </Pressable>
                    {!available && onAddTrustline ? (
                      <PressScale
                        onPress={() =>
                          onAddTrustline(item.assetCode, item.assetIssuer)
                        }
                        style={modern.assetPickerAddButton}
                      >
                        <Text style={modern.assetPickerAddText}>Add</Text>
                      </PressScale>
                    ) : null}
                  </View>
                </View>
              );
            }}
            showsVerticalScrollIndicator={false}
            style={modern.assetPickerList}
          />
        </View>
      </View>
    </Modal>
  );
}
