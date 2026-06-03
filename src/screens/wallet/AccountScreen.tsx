import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  modern,
} from '../../components/wallet/ModernWalletUI';
import type { WalletDemoState } from '../../hooks/useWalletDemo';
import { shortAddress } from '../../utils/format';
import {
  SupportedCurrency,
  useCurrencyConfig,
} from '../../contexts/CurrencyContext';
import type { ExportWalletResult } from '../../types';

const CURRENCIES: { code: SupportedCurrency; name: string; symbol: string }[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
];

type ToolMode = 'import' | 'watch' | 'export-key' | 'export-seed' | null;

export function AccountScreen({ wallet }: { wallet: WalletDemoState }) {
  const { selectedCurrency, setSelectedCurrency } = useCurrencyConfig();
  const [isCurrencyModalVisible, setIsCurrencyModalVisible] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>(null);
  const [toolValue, setToolValue] = useState('');
  const [toolName, setToolName] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [exportResult, setExportResult] = useState<ExportWalletResult | null>(
    null,
  );

  const activeWallet =
    wallet.wallets.find(item => item.id === wallet.activeWalletId) ||
    wallet.wallet;
  const canOpenExplorer =
    Boolean(wallet.explorerAddressUrl) &&
    (!wallet.isMainnet || wallet.walletActive);

  function closeToolModal() {
    setToolMode(null);
    setToolValue('');
    setToolName('');
    setConfirmation('');
  }

  async function submitTool() {
    if (toolMode === 'import') {
      const result = await wallet.importWallet(toolValue, toolName);

      if (result) {
        closeToolModal();
      }

      return;
    }

    if (toolMode === 'watch') {
      const result = await wallet.addWatchOnlyWallet(toolValue, toolName);

      if (result) {
        closeToolModal();
      }

      return;
    }

    if (toolMode === 'export-key' || toolMode === 'export-seed') {
      const result = await wallet.exportWalletSecret(
        toolMode === 'export-seed' ? 'seed_phrase' : 'private_key',
        confirmation,
      );

      if (result?.secret) {
        closeToolModal();
        setExportResult(result);
      }
    }
  }

  async function copySecret() {
    if (!exportResult?.secret) {
      return;
    }

    await Clipboard.setStringAsync(exportResult.secret);
    Alert.alert('Đã copy', 'Secret đã copy vào clipboard. Xóa clipboard sau khi dùng xong.');
  }

  function renderToolModal() {
    const isExport = toolMode === 'export-key' || toolMode === 'export-seed';
    const title =
      toolMode === 'import'
        ? 'Import wallet'
        : toolMode === 'watch'
        ? 'Add watch-only'
        : toolMode === 'export-seed'
        ? 'Export seed phrase'
        : 'Export private key';

    if (!toolMode) {
      return null;
    }

    return (
      <Modal transparent visible animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{title}</Text>
            {isExport ? (
              <>
                <Text style={styles.modalDesc}>
                  Secret sẽ chỉ hiển thị một lần. Ai có secret có thể lấy toàn
                  bộ tiền trong ví. Nhập EXPORT để xác nhận.
                </Text>
                <TextInput
                  autoCapitalize="characters"
                  onChangeText={setConfirmation}
                  placeholder="EXPORT"
                  placeholderTextColor="#8A9AA3"
                  style={styles.promptInput}
                  value={confirmation}
                />
              </>
            ) : (
              <>
                <Text style={styles.modalDesc}>
                  {toolMode === 'import'
                    ? 'Nhập Stellar secret key. App gửi lên server để import vào Privy, không lưu local.'
                    : 'Nhập public address để theo dõi balance/QR mà không ký giao dịch.'}
                </Text>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setToolName}
                  placeholder="Tên ví (optional)"
                  placeholderTextColor="#8A9AA3"
                  style={styles.promptInput}
                  value={toolName}
                />
                <TextInput
                  autoCapitalize="characters"
                  multiline
                  onChangeText={setToolValue}
                  placeholder={toolMode === 'import' ? 'S...' : 'G...'}
                  placeholderTextColor="#8A9AA3"
                  style={[styles.promptInput, styles.secretInput]}
                  value={toolValue}
                />
              </>
            )}
            <View style={styles.promptActions}>
              <TouchableOpacity style={styles.promptBtn} onPress={closeToolModal}>
                <Text style={styles.promptBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.promptBtnPrimary}
                onPress={submitTool}
              >
                <Text style={styles.promptBtnPrimaryText}>
                  {isExport ? 'Export' : 'Lưu'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={modern.screenInset}
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader
        title="Account"
        subtitle="Quản lý tài khoản, ví, bảo mật và kết nối dApp."
      />

      <View style={modern.sectionCard}>
        <SectionHeader title="Your Profile" />
        <View style={modern.infoRow}>
          <Text style={modern.infoLabel}>Email</Text>
          <Text style={modern.infoRowValue}>{wallet.account?.email}</Text>
        </View>
        <View style={modern.infoRow}>
          <Text style={modern.infoLabel}>Privy ID</Text>
          <Text style={modern.infoRowValue}>
            {shortAddress(wallet.account?.id)}
          </Text>
        </View>
        <View style={modern.infoRow}>
          <Text style={modern.infoLabel}>Network</Text>
          <Text style={modern.infoRowValue}>
            {wallet.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
          </Text>
        </View>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Settings" />
        <PressScale
          onPress={() => setIsCurrencyModalVisible(true)}
          style={[modern.infoRow, styles.settingsRow]}
        >
          <Text style={modern.infoLabel}>Display Currency</Text>
          <View style={styles.inlineValue}>
            <Text style={modern.infoRowValue}>{selectedCurrency}</Text>
            <Ionicons color="#8A9AA3" name="chevron-forward" size={20} />
          </View>
        </PressScale>
        <PressScale
          onPress={() =>
            wallet.switchNetwork(
              wallet.network === 'mainnet' ? 'testnet' : 'mainnet',
            )
          }
          style={[modern.infoRow, styles.settingsRow]}
        >
          <Text style={modern.infoLabel}>Switch network</Text>
          <View style={styles.inlineValue}>
            <Text style={modern.infoRowValue}>
              {wallet.network === 'mainnet' ? 'Testnet' : 'Mainnet'}
            </Text>
            <Ionicons color="#8A9AA3" name="swap-horizontal" size={20} />
          </View>
        </PressScale>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Active Wallet" />
        {activeWallet ? (
          <View style={modern.activeWalletCard}>
            <View style={modern.walletOrb}>
              <Ionicons
                color="#0F8EA3"
                name={activeWallet.canSign ? 'wallet' : 'eye-outline'}
                size={28}
              />
            </View>
            <Text style={modern.activeWalletName}>
              {activeWallet.displayName || 'Stellar Wallet'}
            </Text>
            <Text selectable style={modern.activeWalletAddress}>
              {activeWallet.address}
            </Text>
            <View style={styles.badgeRow}>
              <View style={modern.walletBadge}>
                <Text style={modern.walletBadgeText}>
                  {activeWallet.kind === 'watch_only'
                    ? 'Watch-only'
                    : activeWallet.kind === 'imported_privy'
                    ? 'Imported via Privy'
                    : 'Managed by Privy'}
                </Text>
              </View>
              <View style={modern.walletBadge}>
                <Text style={modern.walletBadgeText}>
                  {activeWallet.network}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={modern.emptyModern}>
            <Text style={modern.emptyModernTitle}>Chưa có ví</Text>
            <Text style={modern.emptyModernText}>
              Tạo ví đầu tiên để bắt đầu dùng Stellar.
            </Text>
          </View>
        )}

        <PressScale
          disabled={wallet.isBusy || !canOpenExplorer}
          onPress={() => wallet.openUrl(wallet.explorerAddressUrl)}
          style={modern.secondaryModernButton}
        >
          <Text
            style={[modern.modernButtonText, modern.secondaryModernButtonText]}
          >
            Mở trên Stellar Expert
          </Text>
        </PressScale>
        {wallet.isMainnet && !wallet.walletActive ? (
          <Text style={modern.emptyModernText}>
            Explorer sẽ mở được sau khi ví nhận XLM mainnet đầu tiên.
          </Text>
        ) : null}
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Wallet tools" />
        <View style={styles.toolGrid}>
          <PressScale
            disabled={wallet.isBusy}
            onPress={() => setToolMode('import')}
            style={styles.toolButton}
          >
            <Ionicons color="#0F8EA3" name="download-outline" size={22} />
            <Text style={styles.toolText}>Import</Text>
          </PressScale>
          <PressScale
            disabled={wallet.isBusy}
            onPress={() => setToolMode('watch')}
            style={styles.toolButton}
          >
            <Ionicons color="#0F8EA3" name="eye-outline" size={22} />
            <Text style={styles.toolText}>Watch-only</Text>
          </PressScale>
          <PressScale
            disabled={wallet.isBusy || !wallet.walletCanSign}
            onPress={() => setToolMode('export-key')}
            style={styles.toolButton}
          >
            <Ionicons color="#0F8EA3" name="key-outline" size={22} />
            <Text style={styles.toolText}>Export key</Text>
          </PressScale>
          <PressScale
            disabled={wallet.isBusy || !wallet.walletCanSign}
            onPress={() => setToolMode('export-seed')}
            style={styles.toolButton}
          >
            <Ionicons color="#0F8EA3" name="lock-closed-outline" size={22} />
            <Text style={styles.toolText}>Seed phrase</Text>
          </PressScale>
        </View>
        <Text style={modern.emptyModernText}>
          Mainnet transaction và export đều yêu cầu biometric. Watch-only không
          thể ký giao dịch.
        </Text>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="WalletConnect" />
        <View style={modern.infoRow}>
          <Text style={modern.infoLabel}>Status</Text>
          <Text style={modern.infoRowValue}>
            {wallet.walletConnectConfig?.configured
              ? 'Configured'
              : 'Missing projectId'}
          </Text>
        </View>
        <Text style={modern.emptyModernText}>
          Wallet-mode adapter đã sẵn sàng để cấu hình. Khi có Reown projectId,
          dApp request sẽ đi qua review, parse XDR và biometric trước khi ký.
        </Text>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Security" />
        <View style={modern.infoRow}>
          <Text style={modern.infoLabel}>Mainnet signing</Text>
          <Text style={modern.infoRowValue}>Biometric every tx</Text>
        </View>
        <View style={modern.infoRow}>
          <Text style={modern.infoLabel}>Secret storage</Text>
          <Text style={modern.infoRowValue}>Privy custody</Text>
        </View>
        <View style={modern.infoRow}>
          <Text style={modern.infoLabel}>Export</Text>
          <Text style={modern.infoRowValue}>Show once</Text>
        </View>
      </View>

      <View style={modern.sectionCard}>
        <PressScale onPress={wallet.logout} style={modern.signOutButton}>
          <Text style={modern.signOutText}>Đăng xuất (Sign out)</Text>
        </PressScale>
      </View>

      <Modal visible={isCurrencyModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Currency</Text>
            {CURRENCIES.map(currency => {
              const isSelected = selectedCurrency === currency.code;
              return (
                <TouchableOpacity
                  key={currency.code}
                  onPress={() => {
                    setSelectedCurrency(currency.code);
                    setIsCurrencyModalVisible(false);
                  }}
                  style={[
                    styles.currencyItem,
                    isSelected && styles.currencyItemSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.currencyText,
                      isSelected && styles.currencyTextSelected,
                    ]}
                  >
                    {currency.symbol} - {currency.name} ({currency.code})
                  </Text>
                  {isSelected ? (
                    <Ionicons
                      color="#0F8EA3"
                      name="checkmark-circle"
                      size={24}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => setIsCurrencyModalVisible(false)}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {renderToolModal()}

      <Modal
        transparent
        visible={Boolean(exportResult)}
        animationType="fade"
        onRequestClose={() => setExportResult(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Secret show-once</Text>
            <Text style={styles.modalDesc}>
              Lưu lại nếu bạn thật sự cần. Đóng modal này sẽ xóa secret khỏi UI.
            </Text>
            <View style={styles.secretBox}>
              <Text selectable style={styles.secretText}>
                {exportResult?.secret}
              </Text>
            </View>
            <View style={styles.promptActions}>
              <TouchableOpacity style={styles.promptBtn} onPress={copySecret}>
                <Text style={styles.promptBtnText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setExportResult(null)}
                style={styles.promptBtnPrimary}
              >
                <Text style={styles.promptBtnPrimaryText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  closeBtn: {
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
  },
  closeBtnText: { color: '#8A9AA3', fontSize: 16, fontWeight: '600' },
  currencyItem: {
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: 16,
  },
  currencyItemSelected: { borderColor: '#0F8EA3', borderWidth: 1 },
  currencyText: { color: '#8A9AA3', fontSize: 16, fontWeight: '600' },
  currencyTextSelected: { color: '#FFF' },
  inlineValue: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  modalBox: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  modalDesc: {
    color: '#B8C4CC',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  promptActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  promptBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  promptBtnPrimary: {
    backgroundColor: '#0F8EA3',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  promptBtnPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  promptBtnText: { color: '#8A9AA3', fontSize: 16, fontWeight: '600' },
  promptInput: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 14,
    padding: 12,
  },
  secretBox: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 14,
  },
  secretInput: { minHeight: 86, textAlignVertical: 'top' },
  secretText: { color: '#FFF', fontSize: 14, lineHeight: 20 },
  settingsRow: { alignItems: 'center' },
  toolButton: {
    alignItems: 'center',
    backgroundColor: '#EEF7F9',
    borderRadius: 16,
    flex: 1,
    gap: 8,
    minWidth: '44%',
    padding: 14,
  },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toolText: { color: '#24495A', fontSize: 13, fontWeight: '800' },
});
