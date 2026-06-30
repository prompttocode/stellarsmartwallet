import React, { useCallback, useState, useEffect } from 'react';
import {
  Alert,
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PressScale } from './ui/primitives';
import { getErrorMessage, shortAddress } from '@utils/format';
import type { WalletState } from '@hooks/useWallet';
import type { Wallet } from '@app-types';

const WALLET_ORDER_STORAGE_PREFIX = 'privy-wallet-order';
const WALLET_ACCENT = '#B8FF45';

function getWalletOrderStorageKey(email: string | undefined, network: string) {
  return `${WALLET_ORDER_STORAGE_PREFIX}:${email || 'local'}:${network}`;
}

function sortWalletsByStoredOrder(wallets: Wallet[], walletIds: string[]) {
  if (walletIds.length === 0) {
    return wallets;
  }

  const order = new Map(walletIds.map((id, index) => [id, index]));

  return [...wallets].sort((a, b) => {
    const aIndex = order.get(a.id);
    const bIndex = order.get(b.id);

    if (aIndex === undefined && bIndex === undefined) {
      return 0;
    }

    if (aIndex === undefined) {
      return 1;
    }

    if (bIndex === undefined) {
      return -1;
    }

    return aIndex - bIndex;
  });
}

async function readWalletOrder(key: string) {
  const raw = await AsyncStorage.getItem(key);

  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw);

  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === 'string')
    : [];
}

async function writeWalletOrder(key: string, wallets: Wallet[]) {
  await AsyncStorage.setItem(key, JSON.stringify(wallets.map(item => item.id)));
}

export function WalletManagerModal({
  visible,
  onClose,
  walletState,
}: {
  visible: boolean;
  onClose: () => void;
  walletState: WalletState;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [data, setData] = useState<Wallet[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [restoringWalletId, setRestoringWalletId] = useState<string | null>(
    null,
  );
  const [renamingWallet, setRenamingWallet] = useState<Wallet | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const isCreatingWallet = Boolean(walletState.busy?.startsWith('Creating'));
  const networkLabel = walletState.isMainnet ? 'Mainnet' : 'Testnet';
  const archivedWallets = (walletState.archivedWallets || []).filter(
    item => item.network === walletState.network,
  );
  const canArchiveVisibleWallet = data.length > 1 && !walletState.isBusy;
  const orderStorageKey = getWalletOrderStorageKey(
    walletState.account?.email,
    walletState.network,
  );

  // sync data from state when modal opens or state updates
  useEffect(() => {
    let cancelled = false;
    const list =
      walletState.wallets?.length > 0
        ? walletState.wallets
        : walletState.wallet
        ? [walletState.wallet]
        : [];
    const networkWallets = list.filter(
      item => item.network === walletState.network,
    );

    readWalletOrder(orderStorageKey)
      .then(walletIds => {
        if (!cancelled) {
          setData(sortWalletsByStoredOrder(networkWallets, walletIds));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(networkWallets);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    orderStorageKey,
    walletState.network,
    walletState.wallets,
    walletState.wallet,
    visible,
  ]);

  // Handle close edit mode
  useEffect(() => {
    if (!visible) {
      setIsEditing(false);
      setShowArchived(false);
      setArchivedLoading(false);
      setRestoringWalletId(null);
    }
  }, [visible]);

  useEffect(() => {
    setShowArchived(false);
    setArchivedLoading(false);
    setRestoringWalletId(null);
  }, [walletState.network]);

  const activeWalletId = walletState.activeWalletId;

  const refreshArchivedWallets = useCallback(async () => {
    if (!walletState.loadArchivedWallets) {
      return;
    }

    setArchivedLoading(true);

    try {
      await walletState.loadArchivedWallets();
    } catch (error) {
      walletState.showErrorDialog(
        getErrorMessage(error),
        'Archived wallets',
      );
    } finally {
      setArchivedLoading(false);
    }
  }, [walletState]);

  const handleRename = (item: Wallet) => {
    setRenamingWallet(item);
    setRenameValue(item.displayName || '');
  };

  const submitRename = () => {
    if (renamingWallet && renameValue && walletState.renameWallet) {
      walletState.renameWallet(renamingWallet.id, renameValue);
    }
    setRenamingWallet(null);
  };

  const handleAdd = () => {
    if (!isCreatingWallet && walletState.createWallet) {
      walletState.createWallet();
    }
  };

  const archiveItem = async (item: Wallet) => {
    if (!walletState.archiveWallet) {
      return;
    }

    const session = await walletState.archiveWallet(item.id);

    if (session && showArchived) {
      await refreshArchivedWallets();
    }
  };

  const confirmArchive = (item: Wallet) => {
    if (!canArchiveVisibleWallet) {
      return;
    }

    const displayName = item.displayName || 'this wallet';

    Alert.alert(
      'Archive wallet?',
      `${displayName} will only be hidden from the main wallet list. Its funds stay on-chain and you can restore it anytime from Archived wallets.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => {
            archiveItem(item).catch(error => {
              walletState.showErrorDialog(getErrorMessage(error));
            });
          },
        },
      ],
    );
  };

  const toggleArchived = () => {
    const nextVisible = !showArchived;
    setShowArchived(nextVisible);

    if (nextVisible) {
      refreshArchivedWallets().catch(() => null);
    }
  };

  const handleRestore = async (item: Wallet) => {
    if (!walletState.restoreWallet) {
      return;
    }

    setRestoringWalletId(item.id);

    try {
      const session = await walletState.restoreWallet(item.id);

      if (session) {
        await refreshArchivedWallets();
      }
    } finally {
      setRestoringWalletId(null);
    }
  };

  const renderArchivedWallets = () => {
    if (archivedLoading && archivedWallets.length === 0) {
      return (
        <View style={styles.archivedEmpty}>
          <ActivityIndicator color={WALLET_ACCENT} size="small" />
          <Text style={styles.archivedEmptyText}>
            Loading archived wallets...
          </Text>
        </View>
      );
    }

    if (archivedWallets.length === 0) {
      return (
        <View style={styles.archivedEmpty}>
          <Ionicons name="archive-outline" size={22} color="#6F7A72" />
          <Text style={styles.archivedEmptyText}>
            No archived {networkLabel} wallets.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.archivedScroll}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {archivedWallets.map(item => {
          const isRestoring = restoringWalletId === item.id;
          const displayName = item.displayName || `${networkLabel} wallet`;

          return (
            <View key={item.id} style={styles.archivedItem}>
              <View style={styles.archivedIcon}>
                <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.archivedBody}>
                <Text style={styles.archivedName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.archivedAddress} numberOfLines={1}>
                  {shortAddress(item.address)} · {networkLabel}
                </Text>
              </View>
              <TouchableOpacity
                disabled={walletState.isBusy || isRestoring}
                onPress={() => handleRestore(item)}
                style={[
                  styles.restoreButton,
                  (walletState.isBusy || isRestoring) &&
                    styles.restoreButtonDisabled,
                ]}
              >
                {isRestoring ? (
                  <ActivityIndicator color="#080B08" size="small" />
                ) : (
                  <Text style={styles.restoreButtonText}>Restore</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderItem = ({
    item,
    drag,
    isActive,
    getIndex,
  }: RenderItemParams<Wallet>) => {
    const isSelected = item.id === activeWalletId;
    const displayName =
      item.displayName ||
      `Stellar Wallet ${getIndex() !== undefined ? getIndex()! + 1 : ''}`;

    return (
      <ScaleDecorator>
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={isEditing ? drag : undefined}
          disabled={isActive}
          onPress={() => {
            if (!isEditing) {
              if (walletState.selectWallet) walletState.selectWallet(item.id);
              onClose();
            }
          }}
          style={[
            styles.item,
            isSelected && !isEditing ? styles.itemSelected : null,
          ]}
        >
          <View style={styles.iconBox}>
            <Ionicons name="wallet" size={24} color="#FFF" />
          </View>

          <View style={styles.itemBody}>
            <View style={styles.itemTitleRow}>
              <Text style={styles.itemName}>{displayName}</Text>
              {isSelected && !isEditing && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Active</Text>
                </View>
              )}
            </View>
            <Text style={styles.itemAddress}>{shortAddress(item.address)}</Text>
          </View>

          {isEditing ? (
            <View style={styles.editActions}>
              <TouchableOpacity
                disabled={!canArchiveVisibleWallet}
                onPress={() => confirmArchive(item)}
                style={[
                  styles.actionBtn,
                  styles.archiveActionBtn,
                  !canArchiveVisibleWallet && styles.actionBtnDisabled,
                ]}
              >
                <Ionicons
                  name="archive-outline"
                  size={20}
                  color={canArchiveVisibleWallet ? '#FF7A7A' : '#4A4F56'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRename(item)}
                style={styles.actionBtn}
              >
                <Ionicons name="pencil-outline" size={20} color="#8A9AA3" />
              </TouchableOpacity>
              <TouchableOpacity onPressIn={drag} style={styles.actionBtn}>
                <Ionicons name="menu" size={24} color="#8A9AA3" />
              </TouchableOpacity>
            </View>
          ) : (
            isSelected && (
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={WALLET_ACCENT}
              />
            )
          )}
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <GestureHandlerRootView style={styles.sheetContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setIsEditing(!isEditing)}
              style={styles.headerBtn}
            >
              <View style={styles.doneBtn}>
                <Text style={styles.headerBtnText}>
                  {isEditing ? 'Done' : 'Edit'}
                </Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.title}>{networkLabel} wallets</Text>
            <TouchableOpacity onPress={onClose} style={styles.headerBtnRight}>
              <View style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#FFF" />
              </View>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.listContainer,
              showArchived && styles.listContainerCompact,
            ]}
          >
            {data.length > 0 ? (
              <DraggableFlatList
                data={data}
                onDragEnd={({ data: nextData }) => {
                  setData(nextData);
                  writeWalletOrder(orderStorageKey, nextData).catch(() => null);
                }}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                scrollEnabled={!isEditing}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="wallet-outline" size={28} color="#8A9AA3" />
                <Text style={styles.emptyTitle}>No {networkLabel} wallet</Text>
                <Text style={styles.emptyText}>
                  Create a wallet for this network to keep balances separate.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={toggleArchived}
              style={styles.archivedToggle}
            >
              <View style={styles.archivedToggleIcon}>
                <Ionicons
                  name="archive-outline"
                  size={18}
                  color={WALLET_ACCENT}
                />
              </View>
              <View style={styles.archivedToggleBody}>
                <Text style={styles.archivedToggleTitle}>Archived wallets</Text>
                <Text style={styles.archivedToggleText}>
                  Restore hidden {networkLabel} wallets
                </Text>
              </View>
              {archivedLoading ? (
                <ActivityIndicator color={WALLET_ACCENT} size="small" />
              ) : (
                <Ionicons
                  name={showArchived ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#8A9AA3"
                />
              )}
            </TouchableOpacity>

            {showArchived ? (
              <View style={styles.archivedPanel}>{renderArchivedWallets()}</View>
            ) : null}

            <PressScale
              disabled={isCreatingWallet}
              onPress={handleAdd}
              style={styles.addButton}
            >
              {isCreatingWallet ? (
                <ActivityIndicator color="#080B08" size="small" />
              ) : null}
              <Text style={styles.addButtonText}>
                {isCreatingWallet
                  ? 'Creating wallet...'
                  : `Add ${networkLabel} Wallet`}
              </Text>
            </PressScale>
          </View>
        </GestureHandlerRootView>
      </View>

      {/* Custom Rename Prompt Modal for Android/iOS */}
      {renamingWallet && (
        <Modal transparent visible animationType="fade">
          <View style={styles.promptOverlay}>
            <View style={styles.promptBox}>
              <Text style={styles.promptTitle}>Rename wallet</Text>
              <Text style={styles.promptDesc}>
                Enter a new name for this wallet
              </Text>
              <TextInput
                style={styles.promptInput}
                value={renameValue}
                onChangeText={setRenameValue}
                autoFocus
                placeholder="Example: Savings Wallet"
                placeholderTextColor="#8A9AA3"
              />
              <View style={styles.promptActions}>
                <TouchableOpacity
                  style={styles.promptBtn}
                  onPress={() => setRenamingWallet(null)}
                >
                  <Text style={styles.promptBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.promptBtnPrimary}
                  onPress={submitRename}
                >
                  <Text style={styles.promptBtnPrimaryText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: Platform.OS === 'ios' ? 700 : 650,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 10,
  },
  headerBtn: { minWidth: 60, alignItems: 'flex-start' },
  headerBtnRight: { minWidth: 60, alignItems: 'flex-end' },
  doneBtn: {
    backgroundColor: '#161A16',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeBtn: {
    backgroundColor: '#161A16',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  title: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  listContainer: { maxHeight: 400 },
  listContainerCompact: { maxHeight: 230 },
  list: { paddingHorizontal: 20 },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: '#8A9AA3',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141714',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
  },
  itemSelected: {
    backgroundColor: 'rgba(184,255,69,0.08)',
    borderColor: WALLET_ACCENT,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#252A25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1, marginLeft: 16 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  tag: {
    backgroundColor: 'rgba(184,255,69,0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: { color: WALLET_ACCENT, fontSize: 10, fontWeight: '700' },
  itemAddress: { color: '#8A9AA3', fontSize: 14, marginTop: 4 },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionBtn: { padding: 4 },
  archiveActionBtn: {
    backgroundColor: 'rgba(255,122,122,0.1)',
    borderRadius: 12,
    padding: 8,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  footer: { paddingHorizontal: 24, paddingTop: 16, gap: 12 },
  archivedToggle: {
    alignItems: 'center',
    backgroundColor: '#101310',
    borderColor: 'rgba(184,255,69,0.16)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  archivedToggleIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(184,255,69,0.12)',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  archivedToggleBody: {
    flex: 1,
  },
  archivedToggleTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  archivedToggleText: {
    color: '#8A9AA3',
    fontSize: 12,
    marginTop: 2,
  },
  archivedPanel: {
    backgroundColor: '#070907',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  archivedScroll: {
    maxHeight: 190,
  },
  archivedEmpty: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    minHeight: 92,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  archivedEmptyText: {
    color: '#8A9AA3',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  archivedItem: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  archivedIcon: {
    alignItems: 'center',
    backgroundColor: '#1B201B',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  archivedBody: {
    flex: 1,
  },
  archivedName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  archivedAddress: {
    color: '#8A9AA3',
    fontSize: 12,
    marginTop: 3,
  },
  restoreButton: {
    alignItems: 'center',
    backgroundColor: WALLET_ACCENT,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 84,
    paddingHorizontal: 12,
  },
  restoreButtonDisabled: {
    opacity: 0.6,
  },
  restoreButtonText: {
    color: '#080B08',
    fontSize: 12,
    fontWeight: '800',
  },
  addButton: {
    backgroundColor: WALLET_ACCENT,
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#080B08', fontSize: 16, fontWeight: '700' },
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptBox: {
    width: '80%',
    backgroundColor: '#101210',
    borderRadius: 16,
    padding: 20,
    borderColor: 'rgba(184,255,69,0.18)',
    borderWidth: 1,
  },
  promptTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  promptDesc: { color: '#8A9AA3', fontSize: 14, marginBottom: 16 },
  promptInput: {
    backgroundColor: '#050605',
    color: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  promptActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  promptBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  promptBtnText: { color: '#8A9AA3', fontSize: 16, fontWeight: '600' },
  promptBtnPrimary: {
    backgroundColor: WALLET_ACCENT,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  promptBtnPrimaryText: { color: '#080B08', fontSize: 16, fontWeight: '700' },
});
