import React, { useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
import type { RampOrder, TransactionItem } from '@app-types';
import { getRampOrderStatus, rampTimestampToMs } from '@utils/ramp';
import { formatTokenAmount } from '@utils/format';

type TransactionFilter = 'all' | 'received' | 'sent';
type HistoryKind = 'orders' | 'stellar';
type ActivityListItem =
  | {
      id: string;
      kind: 'transaction';
      transaction: TransactionItem;
    }
  | {
      id: string;
      kind: 'order';
      order: RampOrder;
    };

const filters: { label: string; value: TransactionFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Sent', value: 'sent' },
  { label: 'Received', value: 'received' },
];

const historyKinds: { label: string; value: HistoryKind }[] = [
  { label: 'Transfers', value: 'stellar' },
  { label: 'Cash orders', value: 'orders' },
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

function formatOrderDate(order: RampOrder) {
  const timestamp = rampTimestampToMs(order.created_at);

  if (!timestamp) {
    return 'Date unavailable';
  }

  return new Date(timestamp).toLocaleString('en-US', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function FiatOrderRow({
  onPress,
  order,
}: {
  onPress: () => void;
  order: RampOrder;
}) {
  const terminal = [3, 4, 5].includes(Number(order.state));
  const completed = Number(order.state) === 3;

  return (
    <PressScale onPress={onPress} style={styles.orderRow}>
      <View
        style={[
          styles.orderIcon,
          completed
            ? styles.orderIconCompleted
            : terminal
            ? styles.orderIconClosed
            : null,
        ]}
      >
        <Ionicons
          color={completed ? '#0ABF73' : terminal ? '#D84C5F' : '#3867D6'}
          name={completed ? 'checkmark' : terminal ? 'close' : 'time-outline'}
          size={22}
        />
      </View>
      <View style={styles.orderBody}>
        <Text style={styles.orderTitle}>
          {order.order_type === 'sell' ? 'Withdraw' : 'Buy'}{' '}
          {formatTokenAmount(String(order.amount))} {order.asset_code}
        </Text>
        <Text numberOfLines={1} style={styles.orderMeta}>
          {order.code} · {formatOrderDate(order)}
        </Text>
      </View>
      <View style={styles.orderRight}>
        <Text
          numberOfLines={2}
          style={[
            styles.orderStatus,
            completed
              ? styles.orderStatusCompleted
              : terminal
              ? styles.orderStatusClosed
              : null,
          ]}
        >
          {getRampOrderStatus(order)}
        </Text>
        <Ionicons color="#A1ADB5" name="chevron-forward" size={18} />
      </View>
    </PressScale>
  );
}

export function TransactionsScreen({
  onGoToRampOrder,
  onGoToTransaction,
  wallet,
}: {
  onGoToRampOrder: (order: RampOrder) => void;
  onGoToTransaction: (id: string) => void;
  wallet: WalletState;
}) {
  const [historyKind, setHistoryKind] = useState<HistoryKind>('stellar');
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
  const activityData = useMemo<ActivityListItem[]>(() => {
    if (historyKind === 'stellar') {
      return visibleTransactions.map(transaction => ({
        id: transaction.id,
        kind: 'transaction',
        transaction,
      }));
    }

    return wallet.rampOrderHistory.map(order => ({
      id: `${order.code || order.id}:${order.state}:${order.processing_state}`,
      kind: 'order',
      order,
    }));
  }, [historyKind, visibleTransactions, wallet.rampOrderHistory]);

  function renderHeader() {
    return (
      <>
        <ModernScreenHeader
          subtitle="Review crypto transfers, swaps, buys, and bank withdrawals."
          title="Activity"
        />

        <View style={modern.sectionCard}>
          <SegmentedFilter
            active={historyKind}
            onChange={setHistoryKind}
            options={historyKinds}
          />
        </View>

        <View style={modern.sectionCard}>
          <SectionHeader
            action={
              <PressScale
                onPress={
                  historyKind === 'stellar'
                    ? wallet.refreshSession
                    : wallet.refreshRampOrderHistory
                }
              >
                <Text style={modern.sectionActionText}>↻</Text>
              </PressScale>
            }
            title={historyKind === 'stellar' ? 'Transfers' : 'Cash orders'}
          />
          {historyKind === 'stellar' ? (
            <SegmentedFilter
              active={filter}
              onChange={setFilter}
              options={filters}
            />
          ) : null}
        </View>
      </>
    );
  }

  function renderEmpty() {
    return historyKind === 'stellar' ? (
      <View style={[modern.emptyModern, styles.emptyWrap]}>
        <Text style={modern.emptyModernTitle}>No transactions yet</Text>
        <Text style={modern.emptyModernText}>
          Deposits, sends, and swaps appear here after they are submitted to
          Stellar.
        </Text>
      </View>
    ) : (
      <View style={[modern.emptyModern, styles.emptyWrap]}>
        <Text style={modern.emptyModernTitle}>No VND orders yet</Text>
        <Text style={modern.emptyModernText}>
          Buy and withdraw orders created for this wallet and network will
          appear here.
        </Text>
      </View>
    );
  }

  function renderItem({ item }: ListRenderItemInfo<ActivityListItem>) {
    if (item.kind === 'transaction') {
      return (
        <View style={styles.listRowWrap}>
          <TransactionListItem
            onPress={() => onGoToTransaction(item.transaction.id)}
            transaction={item.transaction}
            imageUrl={assetImagesByCode.get(item.transaction.assetCode)}
          />
        </View>
      );
    }

    return (
      <View style={styles.listRowWrap}>
        <FiatOrderRow
          onPress={() => onGoToRampOrder(item.order)}
          order={item.order}
        />
      </View>
    );
  }

  return (
    <FlatList
      data={activityData}
      style={{ backgroundColor: '#000000' }}
      contentContainerStyle={screenInsetStyle}
      keyExtractor={item => item.id}
      ListEmptyComponent={renderEmpty}
      ListHeaderComponent={renderHeader}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
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
  orderBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  orderIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  orderIconClosed: {
    backgroundColor: 'rgba(255,69,90,0.15)',
  },
  orderIconCompleted: {
    backgroundColor: 'rgba(184,255,69,0.15)',
  },
  orderMeta: {
    color: '#A1B0C8',
    fontSize: 12,
  },
  orderRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    maxWidth: 116,
  },
  orderRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
  },
  orderStatus: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  orderStatusClosed: {
    color: '#FF455A',
  },
  orderStatusCompleted: {
    color: '#B8FF45',
  },
  orderTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
