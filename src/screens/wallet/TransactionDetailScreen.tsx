import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  ModernScreenHeader,
  SectionHeader,
  modern,
  TokenIcon,
  PressScale,
  useSafeScreenInsetStyle,
} from '../../components/wallet/ModernWalletUI';
import { formatDate } from '../../utils/format';
import type { WalletDemoState } from '../../hooks/useWalletDemo';
import type { TransactionItem } from '../../types';

export function TransactionDetailScreen({
  onBack,
  transaction,
  wallet
}: {
  onBack: () => void;
  transaction: TransactionItem;
  wallet: WalletDemoState;
}) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const isReceived = transaction.direction === 'received';
  const isTrustline = transaction.operation === 'change_trust';
  const amountPrefix = isTrustline ? '' : isReceived ? '+' : '-';
  const amountText = isTrustline
    ? 'Trustline'
    : `${amountPrefix}${transaction.amount} ${transaction.assetCode}`;

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
        <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 16 }}>
           <TokenIcon assetCode={transaction.assetCode} size={64} imageUrl={imageUrl} />
           <Text style={[modern.heroAmount, { color: '#132A35', fontSize: 36, marginTop: 12 }]}>
             {amountText}
           </Text>
           <Text style={modern.successModernTitle}>
             {isTrustline ? 'Added Trustline' : isReceived ? 'Received' : 'Sent'}
           </Text>
        </View>

        <SectionHeader title="Details" />
        <View style={modern.infoRow}>
          <Text style={modern.infoLabel}>Trạng thái</Text>
          <Text style={[modern.infoRowValue, { color: '#0ABF73', fontWeight: 'bold' }]}>Thành công</Text>
        </View>
        <View style={modern.infoRow}>
          <Text style={modern.infoLabel}>Thời gian</Text>
          <Text style={modern.infoRowValue}>{formatDate(transaction.createdAt)}</Text>
        </View>
        {!isTrustline && (
          <>
            <View style={modern.infoBlock}>
              <Text style={modern.infoLabel}>Từ ví (Sender)</Text>
              <Text selectable style={modern.infoValue}>{transaction.from}</Text>
            </View>
            <View style={modern.infoBlock}>
              <Text style={modern.infoLabel}>Đến ví (Recipient)</Text>
              <Text selectable style={modern.infoValue}>{transaction.to}</Text>
            </View>
          </>
        )}
        <View style={modern.infoBlock}>
          <Text style={modern.infoLabel}>Mã Hash</Text>
          <Text selectable style={modern.infoValue}>{transaction.hash}</Text>
        </View>

        <PressScale
          onPress={() => wallet.openUrl(transaction.explorerUrl)}
          style={modern.secondaryModernButton}
        >
          <Text style={[modern.modernButtonText, modern.secondaryModernButtonText]}>
            Xem trên Stellar Expert
          </Text>
        </PressScale>
      </View>
    </ScrollView>
  );
}
