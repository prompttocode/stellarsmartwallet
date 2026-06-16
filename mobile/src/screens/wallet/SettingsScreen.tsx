import React, { ReactNode, useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ModernScreenHeader,
  PressScale,
  WalletManagerModal,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import {
  SupportedCurrency,
  useCurrencyConfig,
} from '@contexts/CurrencyContext';
import type { WalletState } from '@hooks/useWallet';
import { shortAddress } from '@utils/format';

const CURRENCIES: { code: SupportedCurrency; name: string; symbol: string }[] =
  [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
  ];

type DetailSheet = 'advanced' | 'security' | 'wallet' | null;
type ToolMode = 'import' | 'watch' | null;

function BottomSheet({
  bottomInset,
  children,
  onClose,
  title,
  visible,
}: {
  bottomInset: number;
  children: ReactNode;
  onClose: () => void;
  title: string;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.sheetOverlay}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(bottomInset, 18) },
          ]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
              <Ionicons color="#FFFFFF" name="close" size={20} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function SettingsRow({
  disabled,
  icon,
  onPress,
  subtitle,
  title,
  trailing,
}: {
  disabled?: boolean;
  icon: string;
  onPress?: () => void;
  subtitle?: string;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <TouchableOpacity
      accessibilityRole={onPress ? 'button' : undefined}
      activeOpacity={0.75}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={[styles.row, disabled ? styles.rowDisabled : null]}
    >
      <View style={styles.rowIcon}>
        <Ionicons color="#FFFFFF" name={icon} size={21} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.rowSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing || (
        <Ionicons color="#A1B0C8" name="chevron-forward" size={20} />
      )}
    </TouchableOpacity>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons color="#FFFFFF" name={icon} size={19} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text selectable style={styles.detailValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function SettingsScreen({
  onOpenKyc,
  onOpenWalletConnect,
  wallet,
}: {
  onOpenKyc: () => void;
  onOpenWalletConnect: () => void;
  wallet: WalletState;
}) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const insets = useSafeAreaInsets();
  const { selectedCurrency, setSelectedCurrency } = useCurrencyConfig();
  const [detailSheet, setDetailSheet] = useState<DetailSheet>(null);
  const [currencyVisible, setCurrencyVisible] = useState(false);
  const [walletManagerVisible, setWalletManagerVisible] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>(null);
  const [toolValue, setToolValue] = useState('');
  const [toolName, setToolName] = useState('');
  const [backupVisible, setBackupVisible] = useState(false);
  const [backupConfirmation, setBackupConfirmation] = useState('');
  const [recoverySecret, setRecoverySecret] = useState('');

  const activeWallet =
    wallet.wallets.find(item => item.id === wallet.activeWalletId) ||
    wallet.wallet;
  const canOpenExplorer =
    Boolean(wallet.explorerAddressUrl) &&
    (!wallet.isMainnet || wallet.walletActive);
  const email = wallet.account?.email || 'No email';
  const profileInitial = email.charAt(0).toUpperCase() || 'S';
  const networkLabel = wallet.isMainnet ? 'Mainnet' : 'Testnet';
  const kycVerified = wallet.kyc.status === 'verified';
  const walletKind = activeWallet
    ? activeWallet.kind === 'watch_only'
      ? 'Watch-only wallet'
      : activeWallet.kind === 'imported_privy'
      ? 'Imported via Privy'
      : 'Managed by Privy'
    : 'No wallet on this network';

  function closeToolModal() {
    setToolMode(null);
    setToolValue('');
    setToolName('');
  }

  function closeBackupModal() {
    setBackupVisible(false);
    setBackupConfirmation('');
    setRecoverySecret('');
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
        setBackupVisible(false);
        setBackupConfirmation('');
        setRecoverySecret('');
      }
    });

    return () => subscription.remove();
  }, []);

  async function requirePrivyToolSession() {
    const hasPrivyToken = await wallet.refreshPrivySecuritySession();

    if (!hasPrivyToken) {
      Alert.alert(
        'Privy sign-in required',
        'This security action needs an active Privy session. Please sign out and sign in again with email OTP or Google.',
      );
      closeToolModal();
      return false;
    }

    return true;
  }

  async function openTool(mode: Exclude<ToolMode, null>) {
    if (mode === 'import' && !(await requirePrivyToolSession())) {
      return;
    }

    setToolMode(mode);
  }

  function openToolFromAdvanced(mode: Exclude<ToolMode, null>) {
    setDetailSheet(null);
    setTimeout(() => {
      openTool(mode).catch(() => null);
    }, 260);
  }

  async function openBackupRecovery() {
    if (!activeWallet?.canSign) {
      Alert.alert(
        'Recovery key unavailable',
        'Watch-only wallets do not contain a private recovery key.',
      );
      return;
    }

    if (!(await requirePrivyToolSession())) {
      return;
    }

    setDetailSheet(null);
    setBackupConfirmation('');
    setRecoverySecret('');
    setTimeout(() => setBackupVisible(true), 260);
  }

  async function revealRecoveryKey() {
    if (backupConfirmation.trim() !== 'EXPORT') {
      Alert.alert('Confirmation required', 'Enter EXPORT exactly to continue.');
      return;
    }

    const result = await wallet.exportWalletSecret(
      backupConfirmation.trim(),
    );

    if (
      result &&
      activeWallet &&
      result.address === activeWallet.address &&
      result.secret.startsWith('S')
    ) {
      setRecoverySecret(result.secret);
    } else if (result) {
      Alert.alert(
        'Recovery key rejected',
        'The exported key did not match the selected Stellar wallet.',
      );
    }
  }

  function copyRecoveryKey() {
    if (!recoverySecret) {
      return;
    }

    Clipboard.setString(recoverySecret);
    Alert.alert(
      'Recovery key copied',
      'Paste it into secure offline storage or a trusted password manager. Clipboard contents may be visible to other apps.',
    );
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

  function confirmNetworkSwitch(nextNetwork: 'mainnet' | 'testnet') {
    if (nextNetwork === wallet.network || wallet.isBusy) {
      return;
    }

    const nextLabel = nextNetwork === 'mainnet' ? 'Mainnet' : 'Testnet';

    Alert.alert(
      `Switch to ${nextLabel}?`,
      nextNetwork === 'testnet'
        ? 'Testnet uses demo assets. Your Mainnet balances will be hidden until you switch back.'
        : 'Mainnet uses real assets and real money. Check every transaction carefully.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => wallet.switchNetwork(nextNetwork),
          text: `Switch to ${nextLabel}`,
        },
      ],
    );
  }

  function openWalletManager() {
    setDetailSheet(null);
    setTimeout(() => setWalletManagerVisible(true), 260);
  }

  function renderToolModal() {
    if (!toolMode) {
      return null;
    }

    const isImport = toolMode === 'import';

    return (
      <Modal
        animationType="fade"
        onRequestClose={closeToolModal}
        transparent
        visible
      >
        <View style={styles.centerModalOverlay}>
          <View style={styles.toolModal}>
            <View style={styles.toolModalIcon}>
              <Ionicons
                color="#20242B"
                name={isImport ? 'download-outline' : 'eye-outline'}
                size={24}
              />
            </View>
            <Text style={styles.toolModalTitle}>
              {isImport ? 'Import wallet' : 'Add watch-only'}
            </Text>
            <Text style={styles.toolModalText}>
              {isImport
                ? 'Import a Stellar secret key (S...). It is sent securely to Privy and is not stored locally.'
                : 'Track a public Stellar address (G...) without transaction signing.'}
            </Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setToolName}
              placeholder="Wallet name (optional)"
              placeholderTextColor="#9499A2"
              style={styles.input}
              value={toolName}
            />
            <TextInput
              autoCapitalize="characters"
              multiline
              onChangeText={setToolValue}
              placeholder={isImport ? 'S...' : 'G...'}
              placeholderTextColor="#9499A2"
              style={[styles.input, styles.secretInput]}
              value={toolValue}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={closeToolModal}
                style={styles.modalSecondaryButton}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={wallet.isBusy}
                onPress={submitTool}
                style={styles.modalPrimaryButton}
              >
                <Text style={styles.modalPrimaryText}>
                  {wallet.isBusy ? wallet.busy : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function renderBackupModal() {
    return (
      <Modal
        animationType="fade"
        onRequestClose={closeBackupModal}
        transparent
        visible={backupVisible}
      >
        <View style={styles.centerModalOverlay}>
          <View style={styles.toolModal}>
            <View style={styles.toolModalIcon}>
              <Ionicons color="#FFFFFF" name="key-outline" size={24} />
            </View>
            <Text style={styles.toolModalTitle}>
              {recoverySecret ? 'Recovery key' : 'Back up recovery key'}
            </Text>
            {recoverySecret ? (
              <>
                <Text style={styles.toolModalText}>
                  This Stellar secret key restores the selected wallet through
                  Import wallet. Anyone who has it can control the funds.
                </Text>
                <View style={styles.recoveryKeyBox}>
                  <Text style={styles.recoveryKeyLabel}>
                    STELLAR SECRET KEY
                  </Text>
                  <Text selectable style={styles.recoveryKeyText}>
                    {recoverySecret}
                  </Text>
                </View>
                <Text style={styles.recoveryAddress}>
                  Wallet: {activeWallet?.address || 'Unavailable'}
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={copyRecoveryKey}
                    style={styles.modalSecondaryButton}
                  >
                    <Text style={styles.modalSecondaryText}>Copy key</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={closeBackupModal}
                    style={styles.modalPrimaryButton}
                  >
                    <Text style={styles.modalPrimaryText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.toolModalText}>
                  The app will ask for biometric confirmation, then show the
                  Stellar S... key once. Store it offline and never share it.
                </Text>
                <View style={styles.recoveryWarning}>
                  <Ionicons
                    color="#FFB020"
                    name="warning-outline"
                    size={20}
                  />
                  <Text style={styles.recoveryWarningText}>
                    Support staff will never ask for this key.
                  </Text>
                </View>
                <TextInput
                  autoCapitalize="characters"
                  autoCorrect={false}
                  onChangeText={setBackupConfirmation}
                  placeholder="Type EXPORT"
                  placeholderTextColor="#9499A2"
                  style={styles.input}
                  value={backupConfirmation}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={closeBackupModal}
                    style={styles.modalSecondaryButton}
                  >
                    <Text style={styles.modalSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={wallet.isBusy}
                    onPress={revealRecoveryKey}
                    style={[
                      styles.modalPrimaryButton,
                      wallet.isBusy ? styles.rowDisabled : null,
                    ]}
                  >
                    <Text style={styles.modalPrimaryText}>
                      {wallet.isBusy ? wallet.busy : 'Reveal key'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={[screenInsetStyle, styles.content]}
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <ModernScreenHeader title="Settings" />

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profileInitial}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text numberOfLines={1} style={styles.profileEmail}>
              {email}
            </Text>
            <View style={styles.profileMetaRow}>
              <Ionicons
                color="#717781"
                name="shield-checkmark-outline"
                size={14}
              />
              <Text style={styles.profileMeta}>Privy secured account</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>WALLET</Text>
        <View style={styles.groupCard}>
          <SettingsRow
            icon={activeWallet?.canSign ? 'wallet-outline' : 'eye-outline'}
            onPress={() => setDetailSheet('wallet')}
            subtitle={
              activeWallet
                ? `${shortAddress(activeWallet.address)} · ${walletKind}`
                : walletKind
            }
            title={activeWallet?.displayName || `${networkLabel} wallet`}
          />
        </View>

        <Text style={styles.sectionLabel}>NETWORK</Text>
        <View style={styles.networkCard}>
          <View style={styles.segmented}>
            {(['testnet', 'mainnet'] as const).map(network => {
              const selected = wallet.network === network;
              const label = network === 'mainnet' ? 'Mainnet' : 'Testnet';

              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={wallet.isBusy}
                  key={network}
                  onPress={() => confirmNetworkSwitch(network)}
                  style={[
                    styles.segment,
                    selected ? styles.segmentActive : null,
                    wallet.isBusy ? styles.segmentDisabled : null,
                  ]}
                >
                  <Ionicons
                    color={
                      selected
                        ? '#FFFFFF'
                        : network === 'mainnet'
                        ? '#15966A'
                        : '#4878D7'
                    }
                    name={
                      network === 'mainnet'
                        ? 'diamond-outline'
                        : 'flask-outline'
                    }
                    size={17}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      selected ? styles.segmentTextActive : null,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.networkDescriptionRow}>
            <Ionicons
              color="#858B94"
              name={wallet.isMainnet ? 'alert-circle-outline' : 'beaker-outline'}
              size={15}
            />
            <Text style={styles.networkDescription}>
              {wallet.isMainnet
                ? 'Real assets and real transactions'
                : 'Demo assets for testing'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.groupCard}>
          <SettingsRow
            icon="cash-outline"
            onPress={() => setCurrencyVisible(true)}
            title="Display currency"
            trailing={
              <View style={styles.rowTrailing}>
                <Text style={styles.rowValue}>{selectedCurrency}</Text>
                <Ionicons
                  color="#A1B0C8"
                  name="chevron-forward"
                  size={20}
                />
              </View>
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            disabled={kycVerified}
            icon="shield-checkmark-outline"
            onPress={kycVerified ? undefined : onOpenKyc}
            subtitle={kycVerified ? 'Verified for VND buy and withdrawal' : 'Required before buying or withdrawing with VND'}
            title="Identity verification"
            trailing={
              <View style={styles.rowTrailing}>
                <Text
                  style={[
                    styles.rowValue,
                    kycVerified ? styles.rowValueSuccess : styles.rowValueWarning,
                  ]}
                >
                  {kycVerified ? 'Verified' : 'Not verified'}
                </Text>
                <Ionicons
                  color={kycVerified ? '#59D98E' : '#A1B0C8'}
                  name={kycVerified ? 'checkmark-circle' : 'chevron-forward'}
                  size={20}
                />
              </View>
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="lock-closed-outline"
            onPress={() => setDetailSheet('security')}
            subtitle="Biometric signing and Privy custody"
            title="Security"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="link-outline"
            onPress={onOpenWalletConnect}
            subtitle={
              wallet.walletConnectConfig?.configured
                ? 'Connect and manage Stellar dApps'
                : 'Reown project ID not configured'
            }
            title="WalletConnect"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="options-outline"
            onPress={() => setDetailSheet('advanced')}
            subtitle="Wallet tools and app information"
            title="Advanced"
          />
        </View>

        <PressScale onPress={wallet.logout} style={styles.signOutRow}>
          <View style={styles.signOutIcon}>
            <Ionicons color="#FF5252" name="log-out-outline" size={21} />
          </View>
          <Text style={styles.signOutText}>Sign out</Text>
        </PressScale>
      </ScrollView>

      <BottomSheet
        bottomInset={insets.bottom}
        onClose={() => setDetailSheet(null)}
        title="Wallet details"
        visible={detailSheet === 'wallet'}
      >
        {activeWallet ? (
          <>
            <View style={styles.walletIdentity}>
              <View style={styles.walletHeroIcon}>
                <Ionicons
                  color="#FFFFFF"
                  name={activeWallet.canSign ? 'wallet' : 'eye-outline'}
                  size={25}
                />
              </View>
              <View style={styles.walletIdentityCopy}>
                <Text numberOfLines={1} style={styles.walletHeroTitle}>
                  {activeWallet.displayName || 'Stellar Wallet'}
                </Text>
                <Text style={styles.walletHeroMeta}>{walletKind}</Text>
                <View style={styles.badges}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{networkLabel}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {activeWallet.canSign ? 'Can sign' : 'View only'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.addressBox}>
              <Text style={styles.addressLabel}>WALLET ADDRESS</Text>
              <Text selectable style={styles.addressText}>
                {activeWallet.address}
              </Text>
            </View>

            <View style={styles.walletActions}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={copyActiveWalletAddress}
                style={styles.walletAction}
              >
                <Ionicons color="#FFFFFF" name="copy-outline" size={21} />
                <Text style={styles.walletActionText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={shareActiveWalletAddress}
                style={styles.walletAction}
              >
                <Ionicons color="#FFFFFF" name="share-outline" size={21} />
                <Text style={styles.walletActionText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                disabled={wallet.isBusy || !canOpenExplorer}
                onPress={() => wallet.openUrl(wallet.explorerAddressUrl)}
                style={[
                  styles.walletAction,
                  wallet.isBusy || !canOpenExplorer
                    ? styles.walletActionDisabled
                    : null,
                ]}
              >
                <Ionicons color="#FFFFFF" name="open-outline" size={21} />
                <Text style={styles.walletActionText}>Explorer</Text>
              </TouchableOpacity>
            </View>
            {wallet.isMainnet && !wallet.walletActive ? (
              <Text style={styles.helperText}>
                Explorer becomes available after this Mainnet wallet receives
                its first XLM deposit.
              </Text>
            ) : null}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons color="#A1B0C8" name="wallet-outline" size={34} />
            <Text style={styles.emptyTitle}>No {networkLabel} wallet</Text>
            <Text style={styles.emptyText}>
              Create or import a wallet for this network.
            </Text>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={openWalletManager}
          style={styles.manageWalletRow}
        >
          <View style={styles.manageWalletIcon}>
            <Ionicons color="#FFFFFF" name="wallet-outline" size={20} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.manageWalletTitle}>Manage wallets</Text>
            <Text style={styles.manageWalletText}>
              Switch, rename or create another wallet
            </Text>
          </View>
          <Ionicons color="#A1B0C8" name="chevron-forward" size={20} />
        </TouchableOpacity>
      </BottomSheet>

      <BottomSheet
        bottomInset={insets.bottom}
        onClose={() => setCurrencyVisible(false)}
        title="Display currency"
        visible={currencyVisible}
      >
        <View style={styles.currencyList}>
          {CURRENCIES.map(currency => {
            const selected = selectedCurrency === currency.code;

            return (
              <TouchableOpacity
                key={currency.code}
                onPress={() => {
                  setSelectedCurrency(currency.code);
                  setCurrencyVisible(false);
                }}
                style={[
                  styles.currencyRow,
                  selected ? styles.currencyRowSelected : null,
                ]}
              >
                <View style={styles.currencySymbol}>
                  <Text style={styles.currencySymbolText}>
                    {currency.symbol}
                  </Text>
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.currencyName}>{currency.name}</Text>
                  <Text style={styles.currencyCode}>{currency.code}</Text>
                </View>
                {selected ? (
                  <Ionicons
                    color="#B8FF45"
                    name="checkmark-circle"
                    size={23}
                  />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

      <BottomSheet
        bottomInset={insets.bottom}
        onClose={() => setDetailSheet(null)}
        title="Security"
        visible={detailSheet === 'security'}
      >
        <View style={styles.securityIntro}>
          <View style={styles.securityHeroIcon}>
            <Ionicons
              color="#FFFFFF"
              name="shield-checkmark"
              size={28}
            />
          </View>
          <Text style={styles.securityIntroTitle}>Built for safer signing</Text>
          <Text style={styles.securityIntroText}>
            Your wallet combines Privy-managed access with Stellar transaction
            checks.
          </Text>
        </View>
        <View style={styles.detailGroup}>
          <SettingsRow
            disabled={!activeWallet?.canSign}
            icon="key-outline"
            onPress={openBackupRecovery}
            subtitle={
              activeWallet?.canSign
                ? 'Reveal the Stellar S... key for independent recovery'
                : 'Unavailable for watch-only wallets'
            }
            title="Backup recovery key"
          />
          <View style={styles.divider} />
          <DetailRow
            icon="finger-print"
            label="Mainnet transactions"
            value="Biometric confirmation is required before signing real asset transfers."
          />
          <View style={styles.divider} />
          <DetailRow
            icon="key-outline"
            label="Private key custody"
            value="Privy protects signing access. The app does not store your secret key locally."
          />
          <View style={styles.divider} />
          <DetailRow
            icon="eye-off-outline"
            label="Watch-only wallets"
            value="Public addresses can be tracked, but they cannot sign or send transactions."
          />
        </View>
      </BottomSheet>

      <BottomSheet
        bottomInset={insets.bottom}
        onClose={() => setDetailSheet(null)}
        title="Advanced"
        visible={detailSheet === 'advanced'}
      >
        <View style={styles.detailGroup}>
          <SettingsRow
            icon="download-outline"
            onPress={() => openToolFromAdvanced('import')}
            subtitle="Add a signing wallet using an S... key"
            title="Import wallet"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="eye-outline"
            onPress={() => openToolFromAdvanced('watch')}
            subtitle="Track a public G... address"
            title="Add watch-only wallet"
          />
        </View>

        <View style={styles.technicalCard}>
          <DetailRow
            icon="finger-print-outline"
            label="Privy ID"
            value={shortAddress(wallet.account?.id)}
          />
          <View style={styles.divider} />
          <DetailRow
            icon="lock-closed-outline"
            label="Wallet recovery"
            value="Use Backup recovery key to export the Stellar S... key. Restore it later with Import wallet."
          />
        </View>
      </BottomSheet>

      <WalletManagerModal
        onClose={() => setWalletManagerVisible(false)}
        visible={walletManagerVisible}
        walletState={wallet}
      />

      {renderToolModal()}
      {renderBackupModal()}
    </>
  );
}

const styles = StyleSheet.create({
  addressBox: {
    backgroundColor: '#000000',
    borderRadius: 18,
    gap: 7,
    padding: 15,
  },
  addressLabel: {
    color: '#A1B0C8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  addressText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#1E222B',
    borderRadius: 27,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#A1B0C8',
    fontSize: 11,
    fontWeight: '800',
  },
  badges: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 3,
  },
  centerModalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(5,16,25,0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    gap: 14,
    paddingHorizontal: 16,
  },
  currencyCode: {
    color: '#A1B0C8',
    fontSize: 12,
    fontWeight: '700',
  },
  currencyList: {
    gap: 8,
  },
  currencyName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  currencyRow: {
    alignItems: 'center',
    borderRadius: 17,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 12,
  },
  currencyRowSelected: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  currencySymbol: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 17,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  currencySymbolText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  detailGroup: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  detailIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  detailLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  detailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  detailValue: {
    color: '#A1B0C8',
    fontSize: 12,
    lineHeight: 17,
  },
  divider: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },
  emptyState: {
    alignItems: 'center',
    gap: 7,
    paddingVertical: 24,
  },
  emptyText: {
    color: '#A1B0C8',
    fontSize: 13,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  groupCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#1A1D22',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
  },
  helperText: {
    color: '#A1B0C8',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#000000',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 15,
    marginTop: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  manageWalletIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  manageWalletRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 11,
    marginTop: 2,
    minHeight: 68,
    paddingHorizontal: 13,
  },
  manageWalletText: {
    color: '#A1B0C8',
    fontSize: 11,
  },
  manageWalletTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 14,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  modalPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalSecondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  modalSecondaryText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  networkCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    gap: 10,
    padding: 12,
    shadowColor: '#1A1D22',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
  },
  networkDescription: {
    color: '#A1B0C8',
    fontSize: 12,
    fontWeight: '600',
  },
  networkDescriptionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingBottom: 1,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    shadowColor: '#1A1D22',
    shadowOffset: { height: 9, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  profileCopy: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  profileEmail: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  profileMeta: {
    color: '#A1B0C8',
    fontSize: 12,
    fontWeight: '600',
  },
  profileMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  recoveryAddress: {
    color: '#A1B0C8',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 9,
  },
  recoveryKeyBox: {
    backgroundColor: '#000000',
    borderColor: 'rgba(184,255,69,0.3)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    marginTop: 16,
    padding: 14,
  },
  recoveryKeyLabel: {
    color: '#B8FF45',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  recoveryKeyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 22,
  },
  recoveryWarning: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,176,32,0.12)',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    marginTop: 14,
    padding: 12,
  },
  recoveryWarningText: {
    color: '#FFD27A',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 17,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  rowSubtitle: {
    color: '#A1B0C8',
    fontSize: 12,
  },
  rowTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  rowTrailing: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  rowValue: {
    color: '#A1B0C8',
    fontSize: 13,
    fontWeight: '800',
  },
  rowValueSuccess: {
    color: '#B8FF45',
  },
  rowValueWarning: {
    color: '#FFB020',
  },
  screen: {
    backgroundColor: '#000000',
  },
  secretInput: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    color: '#A1B0C8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginLeft: 5,
    marginTop: 4,
  },
  securityHeroIcon: {
    alignItems: 'center',
    backgroundColor: '#1E222B',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  securityIntro: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 18,
  },
  securityIntroText: {
    color: '#A1B0C8',
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 290,
    textAlign: 'center',
  },
  securityIntroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  segment: {
    alignItems: 'center',
    borderRadius: 15,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 50,
  },
  segmentActive: {
    backgroundColor: '#1E222B',
    shadowColor: '#111318',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  segmentDisabled: {
    opacity: 0.55,
  },
  segmentText: {
    color: '#A1B0C8',
    fontSize: 14,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  segmented: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    flexDirection: 'row',
    padding: 4,
  },
  sheet: {
    backgroundColor: '#111318',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 12,
    maxHeight: '88%',
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    height: 4,
    width: 38,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 2,
  },
  sheetOverlay: {
    backgroundColor: 'rgba(5,16,25,0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  signOutIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,82,82,0.15)',
    borderRadius: 17,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  signOutRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 12,
    minHeight: 66,
    paddingHorizontal: 14,
  },
  signOutText: {
    color: '#FF5252',
    fontSize: 15,
    fontWeight: '800',
  },
  technicalCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    marginTop: 4,
    overflow: 'hidden',
  },
  toolModal: {
    backgroundColor: '#111318',
    borderRadius: 24,
    padding: 20,
    width: '100%',
  },
  toolModalIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    height: 46,
    justifyContent: 'center',
    marginBottom: 14,
    width: 46,
  },
  toolModalText: {
    color: '#A1B0C8',
    fontSize: 13,
    lineHeight: 19,
  },
  toolModalTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 6,
  },
  walletAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 8,
  },
  walletActionDisabled: {
    opacity: 0.42,
  },
  walletActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  walletActions: {
    flexDirection: 'row',
    gap: 9,
  },
  walletIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    paddingBottom: 4,
  },
  walletHeroIcon: {
    alignItems: 'center',
    backgroundColor: '#1E222B',
    borderRadius: 23,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  walletHeroMeta: {
    color: '#A1B0C8',
    fontSize: 12,
  },
  walletHeroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  walletIdentityCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
});
