import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getTransactionIcon, getTransactionTitle } from '@hooks/useWallet';
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
  onPress,
  showAction = true,
  variant = 'wallet',
}: {
  asset: BalanceItem;
  disabled?: boolean;
  index: number;
  onAdd: (assetCode: string, assetIssuer?: string | null) => void;
  onSend: (assetCode: string) => void;
  onFaucet: (assetCode: string, assetIssuer?: string | null) => void;
  onPress?: (asset: BalanceItem) => void;
  showAction?: boolean;
  variant?: 'market' | 'wallet';
}) {
  const canUse = asset.isNative || asset.trusted;
  const needsTrustline = !asset.isNative && !asset.trusted;
  const supportsVndOrders = ['XLM', 'USDC'].includes(asset.assetCode);
  const balanceAmount = Number(asset.balance) || 0;
  const priceText = formatUsd(asset.priceUsd);
  const holdingValueText =
    balanceAmount > 0 && typeof asset.priceUsd === 'number'
      ? formatUsd(balanceAmount * asset.priceUsd)
      : null;
  const volumeText = formatCompactUsd(asset.volume7d);
  const ratingText =
    typeof asset.rating === 'number' && Number.isFinite(asset.rating)
      ? `Rating ${asset.rating.toLocaleString('en-US', {
          maximumFractionDigits: 1,
        })}`
      : null;
  const pressAction = onPress
    ? () => onPress(asset)
    : canUse
    ? () => onSend(asset.assetCode)
    : undefined;
  const buttonLabel = needsTrustline
    ? 'Enable'
    : asset.isNative && asset.network === 'testnet'
    ? 'Faucet'
    : !asset.isNative && supportsVndOrders
    ? 'Buy'
    : asset.isNative
    ? 'Deposit'
    : 'Details';
  const badgeLabel = needsTrustline
    ? 'Not enabled'
    : asset.demo
    ? 'Demo'
    : asset.trustLevel === 'verified'
    ? 'Verified'
    : 'Unverified';
  const badgeStyle =
    badgeLabel === 'Demo'
      ? modern.assetBadgeDemo
      : badgeLabel === 'Verified'
      ? modern.assetBadgeVerified
      : badgeLabel === 'Not enabled'
      ? modern.assetBadgeTrustline
      : modern.assetBadgeUnverified;
  const badgeTextStyle =
    badgeLabel === 'Demo'
      ? modern.assetBadgeTextDemo
      : badgeLabel === 'Verified'
      ? modern.assetBadgeTextVerified
      : badgeLabel === 'Not enabled'
      ? modern.assetBadgeTextTrustline
      : modern.assetBadgeTextUnverified;
  const subtitle =
    variant === 'market'
      ? [
          asset.displayName,
          priceText,
          volumeText ? `7d volume ${volumeText}` : null,
          !priceText && ratingText ? ratingText : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : asset.isNative
      ? ['Lumens', priceText || 'Native Stellar coin'].join(' · ')
      : asset.trusted
      ? [asset.displayName, asset.homeDomain || asset.trustLevel, priceText]
          .filter(Boolean)
          .join(' · ')
      : [asset.displayName, 'Not enabled'].filter(Boolean).join(' · ');
  const primaryRightText =
    variant === 'market'
      ? priceText || 'No price'
      : canUse
      ? formatTokenAmount(asset.balance, { compact: true })
      : 'Not enabled';
  const secondaryRightText =
    variant === 'market'
      ? ratingText || (canUse && balanceAmount > 0 ? 'Enabled' : 'Tap details')
      : holdingValueText
      ? `≈ ${holdingValueText}`
      : asset.assetCode;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 45).duration(280)}
      style={modern.assetModernRow}
    >
      <PressScale
        disabled={!pressAction}
        onPress={pressAction}
        style={modern.assetPressArea}
      >
        <TokenIcon assetCode={asset.assetCode} imageUrl={asset.image} />
        <View style={modern.assetModernBody}>
          <View style={modern.assetNameLine}>
            <Text numberOfLines={1} style={modern.assetModernName}>
              {asset.assetCode}
            </Text>
            <View
              style={[modern.assetBadge, badgeStyle]}
            >
              <Text
                style={[modern.assetBadgeText, badgeTextStyle]}
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
            {primaryRightText}
          </Text>
          <Text numberOfLines={1} style={modern.assetModernCode}>
            {secondaryRightText}
          </Text>
        </View>
      </PressScale>
      {showAction ? (
        <PressScale
          disabled={disabled}
          onPress={() => {
            if (needsTrustline) {
              onAdd(asset.assetCode, asset.assetIssuer);
            } else if (!asset.isNative && !supportsVndOrders && onPress) {
              onPress(asset);
            } else {
              onFaucet(asset.assetCode, asset.assetIssuer);
            }
          }}
          style={
            needsTrustline ? modern.assetAddButton : modern.assetFaucetButton
          }
        >
          <Text style={modern.assetButtonText}>{buttonLabel}</Text>
        </PressScale>
      ) : null}
    </Animated.View>
  );
}

function formatUsd(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  if (value > 0 && value < 0.01) {
    return `$${value.toPrecision(3)}`;
  }

  return `$${value.toLocaleString('en-US', {
    maximumFractionDigits: value >= 1 ? 2 : 6,
    minimumFractionDigits: value >= 1 ? 2 : 0,
  })}`;
}

function formatCompactUsd(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return `$${value.toLocaleString('en-US', {
    maximumFractionDigits: 1,
    notation: 'compact',
  })}`;
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
