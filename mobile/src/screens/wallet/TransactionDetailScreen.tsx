import React from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressScale, TokenIcon } from '@components/wallet';
import {
  formatDate,
  formatStellarFee,
  formatTokenAmount,
  shortAddress,
} from '@utils/format';
import type { TransactionItem } from '@app-types';
import type { WalletState } from '@hooks/useWallet';

function DetailRow({
  isLast,
  label,
  value,
  withCopyIcon,
}: {
  isLast?: boolean;
  label: string;
  value: string;
  withCopyIcon?: boolean;
}) {
  if (!value) {
    return null;
  }

  return (
    <View style={[styles.detailRow, isLast ? styles.detailRowLast : null]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueWrap}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          numberOfLines={1}
          style={styles.detailValue}
        >
          {value}
        </Text>
        {withCopyIcon ? (
          <Ionicons color="#8C948D" name="copy-outline" size={12} />
        ) : null}
      </View>
    </View>
  );
}

function getTransactionType(transaction: TransactionItem) {
  if (transaction.operation === 'change_trust') {
    return 'Add Trustline';
  }

  if (transaction.operation === 'create_account') {
    return 'Create Account';
  }

  if (transaction.operation === 'path_payment_strict_send') {
    return 'Swap Payment';
  }

  return transaction.direction === 'received' ? 'Receive Token' : 'Send Token';
}

export function TransactionDetailScreen({
  onBack,
  transaction,
  wallet,
}: {
  onBack: () => void;
  transaction: TransactionItem;
  wallet: WalletState;
}) {
  const insets = useSafeAreaInsets();
  const isReceived = transaction.direction === 'received';
  const isTrustline = transaction.operation === 'change_trust';
  const amountPrefix = isTrustline ? '' : isReceived ? '+' : '-';
  const amountText = isTrustline
    ? 'Trustline'
    : `${amountPrefix}${formatTokenAmount(transaction.amount, {
        compact: true,
      })} ${transaction.assetCode}`;
  const statusText = isTrustline
    ? 'Trustline added'
    : isReceived
      ? 'Transfer received'
      : 'Transfer sent';
  const networkName =
    (transaction.network || wallet.network) === 'mainnet'
      ? 'Stellar Mainnet'
      : 'Stellar Testnet';
  const asset =
    wallet.balances.find(item => item.assetCode === transaction.assetCode) ||
    wallet.visibleAssets.find(item => item.assetCode === transaction.assetCode);
  const detailRows = [
    {
      label: 'Date & Time',
      value: formatDate(transaction.createdAt),
    },
    {
      label: 'Type',
      value: getTransactionType(transaction),
    },
    !isTrustline
      ? {
          label: 'From',
          value: shortAddress(transaction.from),
        }
      : null,
    !isTrustline
      ? {
          label: 'To',
          value: shortAddress(transaction.to),
          withCopyIcon: true,
        }
      : null,
    {
      label: 'Network',
      value: networkName,
    },
    {
      label: 'Network Fee',
      value: formatStellarFee(transaction.feeChargedXlm),
    },
    {
      label: 'Transaction ID',
      value: shortAddress(transaction.hash),
      withCopyIcon: true,
    },
  ].filter(
    (row): row is { label: string; value: string; withCopyIcon?: boolean } =>
      Boolean(row?.value),
  );

  async function shareTransaction() {
    await Share.share({
      message: transaction.explorerUrl,
      url: transaction.explorerUrl,
    });
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <PressScale onPress={onBack} style={styles.headerIconButton}>
          <Ionicons color="#FFFFFF" name="arrow-back" size={20} />
        </PressScale>
        <Text style={styles.headerTitle}>Transaction Details</Text>
        <PressScale onPress={shareTransaction} style={styles.headerIconButton}>
          <Ionicons color="#FFFFFF" name="share-social-outline" size={18} />
        </PressScale>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 104 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusIcon}>
          <TokenIcon
            assetCode={transaction.assetCode}
            imageUrl={asset?.image}
            size={34}
          />
        </View>
        <Text style={styles.statusText}>{statusText}</Text>

        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          numberOfLines={1}
          style={styles.amountText}
        >
          {amountText}
        </Text>

        <View style={styles.completedBadge}>
          <View style={styles.completedDot} />
          <Text style={styles.completedText}>COMPLETED</Text>
        </View>

        <View style={styles.detailsCard}>
          {detailRows.map((row, index) => (
            <DetailRow
              key={row.label}
              label={row.label}
              value={row.value}
              withCopyIcon={row.withCopyIcon}
              isLast={index === detailRows.length - 1}
            />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 10 }]}>
        <PressScale
          onPress={() => wallet.openUrl(transaction.explorerUrl)}
          style={styles.expertButton}
        >
          <Text style={styles.expertButtonText}>View on Stellar Expert</Text>
          <Ionicons color="#071421" name="open-outline" size={14} />
        </PressScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  amountText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 8,
    textAlign: 'center',
  },
  bottomAction: {
    backgroundColor: 'rgba(16,19,17,0.98)',
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
  },
  completedBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(184,255,0,0.08)',
    borderColor: 'rgba(184,255,0,0.85)',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  completedDot: {
    backgroundColor: '#B8FF00',
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  completedText: {
    color: '#B8FF00',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 28,
  },
  detailLabel: {
    color: '#AEB7AD',
    fontSize: 12,
    fontWeight: '700',
  },
  detailRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingVertical: 4,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailValue: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  detailValueWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'flex-end',
    marginLeft: 16,
    minWidth: 0,
  },
  detailsCard: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  expertButton: {
    alignItems: 'center',
    backgroundColor: '#B8FF00',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 54,
  },
  expertButtonText: {
    color: '#071421',
    fontSize: 14,
    fontWeight: '900',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerIconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  root: {
    backgroundColor: '#101311',
    flex: 1,
  },
  statusIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  statusText: {
    color: '#AEB7AD',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'center',
  },
});
