import React, { useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import {
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  SegmentedFilter,
  TransactionListItem,
  modern,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import type { TransactionItem } from '@app-types';
import type { WalletState } from '@hooks/useWallet.ios';

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
  const assetImagesByCode = useMemo(() => {
    const byCode = new Map<string, string | null | undefined>();

    for (const asset of [...wallet.visibleAssets, ...wallet.balances]) {
      if (!byCode.has(asset.assetCode) || asset.image) {
        byCode.set(asset.assetCode, asset.image);
      }
    }

    return byCode;
  }, [wallet.balances, wallet.visibleAssets]);

  function renderHeader() {
    return (
      <>
        <ModernScreenHeader
          subtitle={
            wallet.isMainnet
              ? 'Review on-chain deposits and direct transfers.'
              : 'Review Testnet transfers using test assets only.'
          }
          title="Activity"
        />
        <View style={modern.sectionCard}>
          <SectionHeader
            action={
              <PressScale
                onPress={() =>
                  wallet.refreshSession({ showAlert: false, showBusy: false })
                }
              >
                <Text style={modern.sectionActionText}>↻</Text>
              </PressScale>
            }
            title="Transfers"
          />
          <SegmentedFilter
            active={filter}
            onChange={setFilter}
            options={filters}
          />
        </View>
      </>
    );
  }

  function renderItem({ item }: ListRenderItemInfo<TransactionItem>) {
    return (
      <View style={styles.listRowWrap}>
        <TransactionListItem
          imageUrl={assetImagesByCode.get(item.assetCode)}
          onPress={() => onGoToTransaction(item.id)}
          transaction={item}
        />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={screenInsetStyle}
      data={visibleTransactions}
      keyExtractor={item => item.id}
      ListEmptyComponent={
        <View style={[modern.emptyModern, styles.emptyWrap]}>
          <Text style={modern.emptyModernTitle}>No transactions yet</Text>
          <Text style={modern.emptyModernText}>
            Deposits and sends appear here after they are submitted to Stellar.
          </Text>
        </View>
      }
      ListHeaderComponent={renderHeader}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      style={styles.root}
    />
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    marginHorizontal: 36,
    marginTop: 4,
  },
  listRowWrap: {
    marginHorizontal: 36,
  },
  root: {
    backgroundColor: '#000000',
  },
});
