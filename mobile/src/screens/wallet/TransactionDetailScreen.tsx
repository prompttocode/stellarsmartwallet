import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ModernScreenHeader,
  SectionHeader,
  modern,
  TokenIcon,
  PressScale,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import { formatDate, formatTokenAmount } from '@utils/format';
import type { WalletState } from '@hooks/useWallet';
import type { TransactionItem } from '@app-types';

export function TransactionDetailScreen({
  onBack,
  transaction,
  wallet
}: {
  onBack: () => void;
  transaction: TransactionItem;
  wallet: WalletState;
}) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const isReceived = transaction.direction === 'received';
  const isTrustline = transaction.operation === 'change_trust';
  const amountPrefix = isTrustline ? '' : isReceived ? '+' : '-';
  const amountText = isTrustline
    ? 'Trustline'
    : `${amountPrefix}${formatTokenAmount(transaction.amount, {
        compact: true,
      })} ${transaction.assetCode}`;

  const asset = wallet.balances.find(item => item.assetCode === transaction.assetCode) ||
                wallet.visibleAssets.find(item => item.assetCode === transaction.assetCode);
  const imageUrl = asset?.image;

  return (
    <ScrollView
      contentContainerStyle={screenInsetStyle}
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader title="Transaction Details" onBack={onBack} />
      <View style={modern.sectionCard}>
        <View style={styles.summary}>
           <TokenIcon assetCode={transaction.assetCode} size={64} imageUrl={imageUrl} />
           <Text
             adjustsFontSizeToFit
             minimumFontScale={0.7}
             numberOfLines={1}
             style={[modern.heroAmount, styles.summaryAmount]}
           >
             {amountText}
           </Text>
           <Text style={modern.successModernTitle}>
             {isTrustline ? 'Added Trustline' : isReceived ? 'Received' : 'Sent'}
           </Text>
        </View>

        <SectionHeader title="Details" />
        <View style={modern.infoRow}>
          <Text style={modern.infoLabel}>Status</Text>
          <Text style={[modern.infoRowValue, styles.statusSuccess]}>
            Success
          </Text>
        </View>
        <View style={modern.infoRow}>
          <Text style={modern.infoLabel}>Time</Text>
          <Text style={modern.infoRowValue}>{formatDate(transaction.createdAt)}</Text>
        </View>
        {!isTrustline && (
          <>
            <View style={modern.infoBlock}>
              <Text style={modern.infoLabel}>Sender</Text>
              <Text selectable style={modern.infoValue}>{transaction.from}</Text>
            </View>
            <View style={modern.infoBlock}>
              <Text style={modern.infoLabel}>Recipient</Text>
              <Text selectable style={modern.infoValue}>{transaction.to}</Text>
            </View>
          </>
        )}
        <View style={modern.infoBlock}>
          <Text style={modern.infoLabel}>Hash</Text>
          <Text selectable style={modern.infoValue}>{transaction.hash}</Text>
        </View>

        <PressScale
          onPress={() => wallet.openUrl(transaction.explorerUrl)}
          style={modern.secondaryModernButton}
        >
          <Text style={[modern.modernButtonText, modern.secondaryModernButtonText]}>
            Open on Stellar Expert
          </Text>
        </PressScale>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  statusSuccess: {
    color: '#0ABF73',
    fontWeight: 'bold',
  },
  summary: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  summaryAmount: {
    color: '#132A35',
    fontSize: 36,
    marginTop: 12,
  },
});
