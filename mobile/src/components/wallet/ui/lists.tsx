import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  getTransactionIcon,
  getTransactionTitle,
} from '@hooks/useWallet';
import type { AssetItem, BalanceItem, TransactionItem } from '@app-types';
import { formatDate, formatTokenAmount, shortAddress } from '@utils/format';
import { modern } from '../modernStyles';
import { PressScale } from './primitives';
import { TokenIcon } from './token';

export function AssetListItem({
  asset,
  disabled,
  index,
  onAdd,
  onSend,
  onFaucet,
}: {
  asset: BalanceItem;
  disabled?: boolean;
  index: number;
  onAdd: (assetCode: string) => void;
  onSend: (assetCode: string) => void;
  onFaucet: (assetCode: string) => void;
}) {
  const canUse = asset.isNative || asset.trusted;
  const buttonLabel = canUse
    ? asset.network === 'mainnet'
      ? 'Deposit'
      : 'Faucet'
    : 'Add';
  const buttonAction = canUse ? onFaucet : onAdd;
  const badgeLabel = !canUse
    ? 'Trustline needed'
    : asset.demo
    ? 'Demo'
    : asset.trustLevel === 'verified'
    ? 'Verified'
    : 'Unverified';
  const subtitle = asset.isNative
    ? 'Lumens · Native Stellar coin'
    : asset.trusted
    ? `${asset.displayName} · ${asset.homeDomain || asset.trustLevel}`
    : `${asset.displayName} · add trustline first`;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 45).duration(280)}
      style={modern.assetModernRow}
    >
      <PressScale
        disabled={!canUse}
        onPress={() => canUse && onSend(asset.assetCode)}
        style={modern.assetPressArea}
      >
        <TokenIcon assetCode={asset.assetCode} imageUrl={asset.image} />
        <View style={modern.assetModernBody}>
          <View style={modern.assetNameLine}>
            <Text numberOfLines={1} style={modern.assetModernName}>
              {asset.assetCode}
            </Text>
            <View
              style={[
                modern.assetBadge,
                badgeLabel === 'Demo'
                  ? modern.assetBadgeDemo
                  : badgeLabel === 'Verified'
                  ? modern.assetBadgeVerified
                  : badgeLabel === 'Trustline needed'
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
                    : badgeLabel === 'Trustline needed'
                    ? modern.assetBadgeTextTrustline
                    : modern.assetBadgeTextUnverified,
                ]}
              >
                {badgeLabel}
              </Text>
            </View>
          </View>
          <Text numberOfLines={1} style={modern.assetModernMeta}>
            {subtitle}
          </Text>
        </View>
        <View style={modern.assetModernRight}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            numberOfLines={1}
            style={modern.assetModernBalance}
          >
            {canUse ? formatTokenAmount(asset.balance, { compact: true }) : 'Not added'}
          </Text>
          <Text style={modern.assetModernCode}>{asset.assetCode}</Text>
        </View>
      </PressScale>
      <PressScale
        disabled={disabled}
        onPress={() => buttonAction(asset.assetCode)}
        style={canUse ? modern.assetFaucetButton : modern.assetAddButton}
      >
        <Text style={modern.assetButtonText}>{buttonLabel}</Text>
      </PressScale>
    </Animated.View>
  );
}

export function TokenPillSelector({
  assets,
  onSelect,
  selectedAssetCode,
}: {
  assets: AssetItem[];
  onSelect: (assetCode: string) => void;
  selectedAssetCode: string;
}) {
  return (
    <View style={modern.tokenPills}>
      {assets.map(asset => {
        const selected = asset.assetCode === selectedAssetCode;

        return (
          <PressScale
            key={`${asset.assetCode}:${asset.assetIssuer || 'native'}`}
            onPress={() => onSelect(asset.assetCode)}
            style={[modern.tokenPill, selected ? modern.tokenPillActive : null]}
          >
            <Text
              style={[
                modern.tokenPillText,
                selected ? modern.tokenPillTextActive : null,
              ]}
            >
              {asset.assetCode}
            </Text>
          </PressScale>
        );
      })}
    </View>
  );
}

export function TransactionListItem({
  onPress,
  transaction,
  imageUrl,
}: {
  onPress: () => void;
  transaction: TransactionItem;
  imageUrl?: string | null;
}) {
  const isReceived = transaction.direction === 'received';
  const isTrustline = transaction.operation === 'change_trust';
  const amountPrefix = isTrustline ? '' : isReceived ? '+' : '-';
  const amountText = isTrustline
    ? 'Trustline'
    : `${amountPrefix}${formatTokenAmount(transaction.amount, {
        compact: true,
      })} ${transaction.assetCode}`;

  return (
    <PressScale onPress={onPress} style={modern.txModernRow}>
      <TokenIcon
        assetCode={transaction.assetCode}
        size={42}
        imageUrl={imageUrl}
      />
      <View style={modern.txModernBody}>
        <Text numberOfLines={1} style={modern.txModernTitle}>
          {getTransactionTitle(transaction)}
        </Text>
        <Text numberOfLines={1} style={modern.txModernMeta}>
          {getTransactionIcon(transaction)}{' '}
          {isReceived
            ? shortAddress(transaction.from)
            : shortAddress(transaction.to)}{' '}
          · {formatDate(transaction.createdAt)}
        </Text>
      </View>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.76}
        numberOfLines={1}
        style={[
          modern.txModernAmount,
          isReceived || isTrustline
            ? modern.txAmountPositive
            : modern.txAmountNegative,
        ]}
      >
        {amountText}
      </Text>
    </PressScale>
  );
}

export function SegmentedFilter<T extends string>({
  active,
  onChange,
  options,
}: {
  active: T;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
}) {
  return (
    <View style={modern.segmented}>
      {options.map(option => {
        const selected = option.value === active;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              modern.segmentItem,
              selected ? modern.segmentItemActive : null,
              pressed && !selected ? modern.segmentItemPressed : null,
            ]}
          >
            <Text
              style={[
                modern.segmentText,
                selected ? modern.segmentTextActive : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
