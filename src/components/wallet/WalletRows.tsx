import React from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  getTransactionIcon,
  getTransactionTitle,
} from '../../hooks/useWalletDemo';
import { styles } from '../../styles/walletStyles';
import type { AssetItem, BalanceItem, TransactionItem } from '../../types';
import { formatDate, shortAddress } from '../../utils/format';

export function TokenBadge({ assetCode }: { assetCode: string }) {
  return (
    <View style={styles.assetBadge}>
      <Text style={styles.assetBadgeText}>{assetCode.slice(0, 1)}</Text>
    </View>
  );
}

export function TokenSelector({
  assets,
  onSelect,
  selectedAssetCode,
}: {
  assets: AssetItem[];
  onSelect: (assetCode: string) => void;
  selectedAssetCode: string;
}) {
  return (
    <View style={styles.assetTabs}>
      {assets.map(asset => {
        const selected = asset.assetCode === selectedAssetCode;

        return (
          <Pressable
            key={asset.assetCode}
            onPress={() => onSelect(asset.assetCode)}
            style={[styles.assetTab, selected ? styles.assetTabSelected : null]}
          >
            <Text
              style={[
                styles.assetTabText,
                selected ? styles.assetTabTextSelected : null,
              ]}
            >
              {asset.assetCode}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AssetRow({
  asset,
  disabled,
  onAddTrustline,
  onFundDemo,
  onSend,
}: {
  asset: BalanceItem;
  disabled?: boolean;
  onAddTrustline: (assetCode: string) => void;
  onFundDemo: (assetCode: string) => void;
  onSend: (assetCode: string) => void;
}) {
  const canAddTrustline = !asset.isNative && !asset.trusted;
  const canFundDemo = !asset.isNative && asset.trusted;
  const statusText = asset.isNative
    ? 'Coin gốc của Stellar'
    : asset.trusted
      ? 'Token demo đã thêm'
      : 'Chưa thêm vào ví';

  return (
    <View style={styles.assetRow}>
      <TokenBadge assetCode={asset.assetCode} />
      <View style={styles.assetCopy}>
        <Text style={styles.assetCode}>{asset.assetCode}</Text>
        <Text style={styles.assetMeta}>{asset.displayName || statusText}</Text>
        <Text style={styles.assetMeta}>{statusText}</Text>
      </View>
      <View style={styles.assetRight}>
        <Text style={styles.assetBalance}>
          {asset.trusted || asset.isNative ? asset.balance : 'Chưa thêm'}
        </Text>
        {canAddTrustline ? (
          <Pressable
            disabled={disabled}
            onPress={() => onAddTrustline(asset.assetCode)}
            style={styles.inlineButton}
          >
            <Text style={styles.inlineButtonText}>Thêm token</Text>
          </Pressable>
        ) : null}
        {canFundDemo ? (
          <Pressable
            disabled={disabled}
            onPress={() => onFundDemo(asset.assetCode)}
            style={styles.inlineButton}
          >
            <Text style={styles.inlineButtonText}>Nạp demo</Text>
          </Pressable>
        ) : null}
        {(asset.isNative || asset.trusted) && Number(asset.balance) > 0 ? (
          <Pressable
            disabled={disabled}
            onPress={() => onSend(asset.assetCode)}
            style={styles.inlineGhostButton}
          >
            <Text style={styles.inlineGhostButtonText}>Gửi</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function TransactionRow({
  onPress,
  transaction,
}: {
  onPress: () => void;
  transaction: TransactionItem;
}) {
  const isReceived = transaction.direction === 'received';
  const isTrustline = transaction.operation === 'change_trust';
  const amountPrefix = isTrustline ? '' : isReceived ? '+' : '-';
  const amountText = isTrustline
    ? 'Trustline'
    : `${amountPrefix}${transaction.amount} ${transaction.assetCode}`;

  return (
    <Pressable onPress={onPress} style={styles.transactionRow}>
      <View
        style={[
          styles.txIcon,
          isReceived ? styles.txIconReceived : null,
          isTrustline ? styles.txIconTrustline : null,
        ]}
      >
        <Text style={styles.txIconText}>{getTransactionIcon(transaction)}</Text>
      </View>
      <View style={styles.txBody}>
        <Text style={styles.txTitle}>{getTransactionTitle(transaction)}</Text>
        <Text style={styles.txMeta}>
          {isReceived ? shortAddress(transaction.from) : shortAddress(transaction.to)}
        </Text>
        <Text style={styles.txHash}>{formatDate(transaction.createdAt)}</Text>
      </View>
      <Text style={styles.txLedger}>{amountText}</Text>
    </Pressable>
  );
}
