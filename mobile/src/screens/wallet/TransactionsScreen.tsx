import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  SegmentedFilter,
  TransactionListItem,
  modern,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import type { WalletState } from '@hooks/useWallet';
import type { TransactionItem } from '@app-types';

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

export function TransactionsScreen({
  onGoToTransaction,
  wallet,
}: {
  onGoToTransaction: (id: string) => void;
  wallet: WalletState;
}) {
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const screenInsetStyle = useSafeScreenInsetStyle();
  const visibleTransactions = useMemo(
    () => filterTransactions(wallet.transactions, filter),
    [filter, wallet.transactions],
  );

  return (
    <ScrollView
      contentContainerStyle={screenInsetStyle}
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader
        subtitle="History is loaded directly from Stellar Horizon."
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
          visibleTransactions.map(transaction => {
            const asset = wallet.balances.find(item => item.assetCode === transaction.assetCode) ||
                          wallet.visibleAssets.find(item => item.assetCode === transaction.assetCode);
            return (
              <TransactionListItem
                key={transaction.id}
                onPress={() => onGoToTransaction(transaction.id)}
                transaction={transaction}
                imageUrl={asset?.image}
              />
            );
          })
        ) : (
          <View style={modern.emptyModern}>
            <Text style={modern.emptyModernTitle}>No transactions yet</Text>
            <Text style={modern.emptyModernText}>
              Deposits, sends, and swaps will appear here after they are
              submitted to Stellar.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
