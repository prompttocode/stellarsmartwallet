import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  SegmentedFilter,
  TransactionListItem,
  modern,
} from '../../components/wallet/ModernWalletUI';
import type { WalletDemoState } from '../../hooks/useWalletDemo';
import type { TransactionItem } from '../../types';

type TransactionFilter = 'all' | 'received' | 'sent';

const filters: { label: string; value: TransactionFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Sent', value: 'sent' },
  { label: 'Received', value: 'received' },
];

function filterTransactions(
  transactions: TransactionItem[],
  filter: TransactionFilter,
) {
  if (filter === 'all') {
    return transactions;
  }

  return transactions.filter(transaction => transaction.direction === filter);
}

export function TransactionsScreen({ wallet }: { wallet: WalletDemoState }) {
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const visibleTransactions = useMemo(
    () => filterTransactions(wallet.transactions, filter),
    [filter, wallet.transactions],
  );

  return (
    <ScrollView
      contentContainerStyle={modern.screenInset}
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader
        subtitle="Lịch sử lấy trực tiếp từ Stellar Horizon."
        title="History"
      />

      <View style={modern.sectionCard}>
        <SectionHeader
          action={
            <PressScale onPress={wallet.refreshSession}>
              <Text style={modern.sectionActionText}>↻</Text>
            </PressScale>
          }
          title="Transactions"
        />
        <SegmentedFilter
          active={filter}
          onChange={setFilter}
          options={filters}
        />
        {visibleTransactions.length > 0 ? (
          visibleTransactions.map(transaction => (
            <TransactionListItem
              key={transaction.id}
              onPress={() => wallet.openUrl(transaction.explorerUrl)}
              transaction={transaction}
            />
          ))
        ) : (
          <View style={modern.emptyModern}>
            <Text style={modern.emptyModernTitle}>Chưa có giao dịch</Text>
            <Text style={modern.emptyModernText}>
              Khi bạn nạp, gửi hoặc swap token test, lịch sử sẽ hiện ở đây.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
