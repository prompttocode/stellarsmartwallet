import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  modern,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import type { WalletState } from '@hooks/useWallet';
import { shortAddress } from '@utils/format';
import {
  SupportedCurrency,
  useCurrencyConfig,
} from '@contexts/CurrencyContext';
import Clipboard from '@react-native-clipboard/clipboard';

const CURRENCIES: { code: SupportedCurrency; name: string; symbol: string }[] =
  [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
  ];

type ToolMode = 'import' | 'watch' | null;

export function AccountScreen({ wallet }: { wallet: WalletState }) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const { selectedCurrency, setSelectedCurrency } = useCurrencyConfig();
  const [isCurrencyModalVisible, setIsCurrencyModalVisible] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>(null);
  const [toolValue, setToolValue] = useState('');
  const [toolName, setToolName] = useState('');

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
  }

  async function requirePrivyToolSession() {
    const hasPrivyToken = await wallet.refreshPrivySecuritySession();

    if (!hasPrivyToken) {
      Alert.alert(
        'Privy sign-in required',
        'Importing a Stellar secret key needs an active Privy session. Please sign out and sign in again with email OTP or Google.',
      );
      closeToolModal();
      return false;
    }

    return true;
  }

  async function openTool(mode: ToolMode) {
    if (mode === 'import' && !(await requirePrivyToolSession())) {
      return;
    }

    setToolMode(mode);
  }

  async function submitTool() {
    if (toolMode === 'import' && !(await requirePrivyToolSession())) {
      return;
    }

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
  }

  async function shareActiveWalletAddress() {
    if (!activeWallet?.address) {
      return;
    }

    await Share.share({
      message: activeWallet.address,
      title: 'Stellar wallet address',
    });
  }

  function copyActiveWalletAddress() {
    if (!activeWallet?.address) {
      return;
    }

    Clipboard.setString(activeWallet.address);
    Alert.alert('Copied', 'Wallet address copied to clipboard.');
  }

  function renderToolModal() {
    const title =
      toolMode === 'import'
        ? 'Import wallet'
        : 'Add watch-only';

    if (!toolMode) {
      return null;
    }

    return (
      <Modal transparent visible animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{title}</Text>
            <>
              <Text style={styles.modalDesc}>
                {toolMode === 'import'
                  ? 'Import a Stellar secret key (S...). The app sends it to the server to import into Privy and does not store it locally.'
                  : 'Track a public address (G...) to view balances and QR codes without signing transactions.'}
              </Text>
              <TextInput
                autoCapitalize="none"
                onChangeText={setToolName}
                placeholder="Wallet name (optional)"
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
            <View style={styles.promptActions}>
              <TouchableOpacity
                style={styles.promptBtn}
                onPress={closeToolModal}
              >
                <Text style={styles.promptBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.promptBtnPrimary}
                onPress={submitTool}
              >
                <Text style={styles.promptBtnPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={screenInsetStyle}
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader
        title="Account"
        subtitle="Manage profile, wallet, network, security, and tools."
      />

      <View style={modern.sectionCard}>
        <SectionHeader title="Profile" />
        <View style={styles.profileHero}>
          <View style={styles.profileOrb}>
            <Ionicons color="#0F8EA3" name="person" size={26} />
          </View>
          <View style={styles.profileCopy}>
            <Text numberOfLines={1} style={styles.profileEmail}>
              {wallet.account?.email || 'No email'}
            </Text>
            <Text style={styles.profileMeta}>
              Privy ID {shortAddress(wallet.account?.id)}
            </Text>
          </View>
        </View>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Active wallet" />
        {activeWallet ? (
          <View style={styles.walletCard}>
            <View style={styles.walletTop}>
              <View style={modern.walletOrb}>
                <Ionicons
                  color="#0F8EA3"
                  name={activeWallet.canSign ? 'wallet' : 'eye-outline'}
                  size={28}
                />
              </View>
              <View style={styles.walletCopy}>
                <Text numberOfLines={1} style={modern.activeWalletName}>
                  {activeWallet.displayName || 'Stellar Wallet'}
                </Text>
                <Text style={styles.walletKind}>
                  {activeWallet.kind === 'watch_only'
                    ? 'Watch-only wallet'
                    : activeWallet.kind === 'imported_privy'
                    ? 'Imported via Privy'
                    : 'Managed by Privy'}
                </Text>
              </View>
            </View>
            <View style={modern.infoBlock}>
              <Text selectable style={styles.walletAddress}>
                {activeWallet.address}
              </Text>
            </View>
            <View style={styles.badgeRow}>
              <View style={modern.walletBadge}>
                <Text style={modern.walletBadgeText}>
                  {activeWallet.canSign ? 'Can sign' : 'View only'}
                </Text>
              </View>
              <View style={modern.walletBadge}>
                <Text style={modern.walletBadgeText}>
                  {activeWallet.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                </Text>
              </View>
            </View>
            <View style={modern.walletButtons}>
              <PressScale
                disabled={!activeWallet.address}
                onPress={copyActiveWalletAddress}
                style={styles.compactWalletButton}
              >
                <Text style={styles.compactWalletButtonText}>Copy</Text>
              </PressScale>
              <PressScale
                disabled={!activeWallet.address}
                onPress={shareActiveWalletAddress}
                style={styles.compactWalletButton}
              >
                <Text style={styles.compactWalletButtonText}>Share</Text>
              </PressScale>
              <PressScale
                disabled={wallet.isBusy || !canOpenExplorer}
                onPress={() => wallet.openUrl(wallet.explorerAddressUrl)}
                style={styles.compactWalletButtonSoft}
              >
                <Text style={styles.compactWalletButtonSoftText}>Explorer</Text>
              </PressScale>
            </View>
          </View>
        ) : (
          <View style={modern.emptyModern}>
            <Text style={modern.emptyModernTitle}>No wallet yet</Text>
            <Text style={modern.emptyModernText}>
              Create your first wallet to start using Stellar.
            </Text>
          </View>
        )}
        {wallet.isMainnet && !wallet.walletActive ? (
          <Text style={modern.emptyModernText}>
            Explorer opens after this wallet receives its first Mainnet XLM
            deposit.
          </Text>
        ) : null}
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Network" />
        <View style={styles.networkCard}>
          <View style={styles.networkIcon}>
            <Ionicons
              color={wallet.isMainnet ? '#0ABF73' : '#3867D6'}
              name={wallet.isMainnet ? 'diamond-outline' : 'flask-outline'}
              size={26}
            />
          </View>
          <View style={styles.networkCopy}>
            <Text style={styles.networkTitle}>
              {wallet.isMainnet ? 'Mainnet' : 'Testnet'}
            </Text>
            <Text style={styles.networkText}>
              {wallet.isMainnet
                ? 'Real Stellar assets. Sends require biometric confirmation.'
                : 'Demo network for testing wallets, swaps, and orders.'}
            </Text>
          </View>
        </View>
        <PressScale
          onPress={() =>
            wallet.switchNetwork(
              wallet.network === 'mainnet' ? 'testnet' : 'mainnet',
            )
          }
          style={modern.secondaryModernButton}
        >
          <Text
            style={[modern.modernButtonText, modern.secondaryModernButtonText]}
          >
            Switch to {wallet.network === 'mainnet' ? 'Testnet' : 'Mainnet'}
          </Text>
        </PressScale>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Preferences" />
        <PressScale
          onPress={() => setIsCurrencyModalVisible(true)}
          style={styles.actionRow}
        >
          <View style={styles.actionIcon}>
            <Ionicons color="#0F8EA3" name="cash-outline" size={22} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Display currency</Text>
            <Text style={styles.actionText}>
              Portfolio value is shown in {selectedCurrency}.
            </Text>
          </View>
          <View style={styles.inlineValue}>
            <Text style={modern.infoRowValue}>{selectedCurrency}</Text>
            <Ionicons color="#8A9AA3" name="chevron-forward" size={20} />
          </View>
        </PressScale>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Security" />
        <View style={styles.securityGrid}>
          <View style={styles.securityCard}>
            <Ionicons color="#0F8EA3" name="finger-print" size={24} />
            <Text style={styles.securityTitle}>Mainnet signing</Text>
            <Text style={styles.securityText}>Biometric every tx</Text>
          </View>
          <View style={styles.securityCard}>
            <Ionicons color="#0F8EA3" name="shield-checkmark" size={24} />
            <Text style={styles.securityTitle}>Secret storage</Text>
            <Text style={styles.securityText}>Privy custody</Text>
          </View>
        </View>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Wallet tools" />
        <View style={styles.toolGrid}>
          <PressScale
            disabled={wallet.isBusy}
            onPress={() => openTool('import')}
            style={styles.toolButton}
          >
            <Ionicons color="#0F8EA3" name="download-outline" size={22} />
            <Text style={styles.toolText}>
              Import Stellar secret key (S...)
            </Text>
          </PressScale>
          <PressScale
            disabled={wallet.isBusy}
            onPress={() => openTool('watch')}
            style={styles.toolButton}
          >
            <Ionicons color="#0F8EA3" name="eye-outline" size={22} />
            <Text style={styles.toolText}>Track public address (G...)</Text>
          </PressScale>
          <PressScale
            disabled
            style={[styles.toolButton, styles.toolButtonDisabled]}
          >
            <Ionicons color="#8A9AA3" name="lock-closed-outline" size={22} />
            <Text style={[styles.toolText, styles.toolTextDisabled]}>
              Seed phrase unavailable for Privy-created Stellar wallet
            </Text>
          </PressScale>
        </View>
        <Text style={modern.emptyModernText}>
          {wallet.isBusy
            ? `Processing: ${wallet.busy}`
            : 'Import a Stellar secret key to use a signing wallet. Watch-only wallets only track addresses and cannot send funds.'}
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
          The wallet-mode adapter is ready to configure. With a Reown
          projectId, dApp requests can go through review, XDR parsing, and
          biometric confirmation before signing.
        </Text>
      </View>

      <View style={modern.sectionCard}>
        <PressScale onPress={wallet.logout} style={modern.signOutButton}>
          <Text style={modern.signOutText}>Sign out</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: '#EAF7FA',
    borderRadius: 17,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  actionRow: {
    alignItems: 'center',
    backgroundColor: '#F6FAFC',
    borderColor: '#E2EBEF',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    padding: 14,
  },
  actionText: {
    color: '#7E909A',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  actionTitle: {
    color: '#24495A',
    fontSize: 15,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  closeBtn: {
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
  },
  compactWalletButton: {
    alignItems: 'center',
    backgroundColor: '#0ABF73',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  compactWalletButtonSoft: {
    alignItems: 'center',
    backgroundColor: '#E7F9F1',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  compactWalletButtonSoftText: {
    color: '#0ABF73',
    fontSize: 13,
    fontWeight: '900',
  },
  compactWalletButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  closeBtnText: { color: '#8A9AA3', fontSize: 16, fontWeight: '600' },
  currencyItem: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: 16,
  },
  currencyItemSelected: { borderColor: '#0F8EA3', borderWidth: 1 },
  currencyText: { color: '#8A9AA3', fontSize: 16, fontWeight: '600' },
  currencyTextSelected: { color: '#000000' },
  inlineValue: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  modalBox: {
    backgroundColor: '#ffffff',
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
  modalTitle: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
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
  secretInput: { minHeight: 86, textAlignVertical: 'top' },
  networkCard: {
    alignItems: 'center',
    backgroundColor: '#F6FAFC',
    borderColor: '#E2EBEF',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
  },
  networkCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  networkIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  networkText: {
    color: '#7E909A',
    fontSize: 13,
    lineHeight: 18,
  },
  networkTitle: {
    color: '#24495A',
    fontSize: 17,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  profileEmail: {
    color: '#24495A',
    fontSize: 18,
    fontWeight: '900',
  },
  profileHero: {
    alignItems: 'center',
    backgroundColor: '#F6FAFC',
    borderColor: '#E2EBEF',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
  },
  profileMeta: {
    color: '#7E909A',
    fontSize: 13,
    fontWeight: '800',
  },
  profileOrb: {
    alignItems: 'center',
    backgroundColor: '#EAF7FA',
    borderRadius: 22,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  securityCard: {
    backgroundColor: '#F6FAFC',
    borderColor: '#E2EBEF',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 7,
    minHeight: 104,
    padding: 14,
  },
  securityGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  securityText: {
    color: '#7E909A',
    fontSize: 12,
    lineHeight: 17,
  },
  securityTitle: {
    color: '#24495A',
    fontSize: 14,
    fontWeight: '900',
  },
  toolButton: {
    alignItems: 'center',
    backgroundColor: '#EEF7F9',
    borderRadius: 16,
    gap: 8,
    justifyContent: 'center',
    minHeight: 76,
    padding: 14,
    width: '100%',
  },
  toolButtonDisabled: {
    backgroundColor: '#F1F4F6',
    borderColor: '#E2E8EC',
    borderWidth: 1,
  },
  toolGrid: {
    flexDirection: 'column',
    gap: 10,
  },
  toolText: {
    color: '#24495A',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  toolTextDisabled: { color: '#667985' },
  walletAddress: {
    color: '#667985',
    fontSize: 12,
    lineHeight: 18,
  },
  walletCard: {
    backgroundColor: '#EAF7FA',
    borderColor: '#C5E9EF',
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  walletCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  walletKind: {
    color: '#6A7E88',
    fontSize: 13,
    fontWeight: '800',
  },
  walletTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});
