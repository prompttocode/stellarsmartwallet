import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PressScale } from './ui/primitives';
import { shortAddress } from '@utils/format';
import type { WalletState } from '@hooks/useWallet';
import type { Wallet } from '@app-types';

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
  const [renamingWallet, setRenamingWallet] = useState<Wallet | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const isCreatingWallet = Boolean(
    walletState.busy?.startsWith('Creating'),
  );
  const networkLabel = walletState.isMainnet ? 'Mainnet' : 'Testnet';

  // sync data from state when modal opens or state updates
  useEffect(() => {
    const list =
      walletState.wallets?.length > 0
        ? walletState.wallets
        : walletState.wallet
        ? [walletState.wallet]
        : [];
    setData(list.filter(item => item.network === walletState.network));
  }, [walletState.network, walletState.wallets, walletState.wallet, visible]);

  // Handle close edit mode
  useEffect(() => {
    if (!visible) {
      setIsEditing(false);
    }
  }, [visible]);

  const activeWalletId = walletState.activeWalletId;

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
              <Ionicons name="checkmark-circle" size={24} color="#0F8EA3" />
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

          <View style={styles.listContainer}>
            {data.length > 0 ? (
              <DraggableFlatList
                data={data}
                onDragEnd={({ data: nextData }) => setData(nextData)}
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
            <PressScale
              disabled={isCreatingWallet}
              onPress={handleAdd}
              style={styles.addButton}
            >
              {isCreatingWallet ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : null}
              <Text style={styles.addButtonText}>
                {isCreatingWallet ? 'Creating wallet...' : `Add ${networkLabel} Wallet`}
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
              <Text style={styles.promptDesc}>Enter a new name for this wallet</Text>
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
    backgroundColor: '#131A22',
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
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeBtn: {
    backgroundColor: '#1E293B',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  title: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  listContainer: { maxHeight: 400 },
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
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  itemSelected: { borderColor: '#0F8EA3', borderWidth: 1 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1, marginLeft: 16 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  tag: {
    backgroundColor: '#0F8EA3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  itemAddress: { color: '#8A9AA3', fontSize: 14, marginTop: 4 },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionBtn: { padding: 4 },
  footer: { paddingHorizontal: 24, paddingTop: 16 },
  addButton: {
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptBox: {
    width: '80%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
  },
  promptTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  promptDesc: { color: '#8A9AA3', fontSize: 14, marginBottom: 16 },
  promptInput: {
    backgroundColor: '#0F172A',
    color: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  promptActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  promptBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  promptBtnText: { color: '#8A9AA3', fontSize: 16, fontWeight: '600' },
  promptBtnPrimary: {
    backgroundColor: '#0F8EA3',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  promptBtnPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
