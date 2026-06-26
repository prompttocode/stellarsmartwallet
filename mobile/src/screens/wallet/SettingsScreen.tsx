import React, { ReactNode, useEffect, useState, useRef } from 'react';
import {
  Animated,
  AppState,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import * as Application from 'expo-application';
import * as ExpoLinking from 'expo-linking';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppPopup } from '@components/common/AppPopup';
import { AppBottomSheet } from '../../components/ui/AppBottomSheet';
import { BANK_OPTIONS } from '@constants/banks';

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
import type { StellarNetwork } from '@app-types';
import type { RampPaymentMethod } from '@app-types';
import type { WalletState } from '@hooks/useWallet';
import { shortAddress } from '@utils/format';
import {
  getImportSecretPublicAddress,
  validateImportSecret,
  validateWatchOnlyAddress,
} from '@utils/walletValidation';

const CURRENCIES: { code: SupportedCurrency; name: string; symbol: string }[] =
  [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
  ];

const EGG_COLORS = ['#8B5CF6', '#F59E0B', '#10B981', '#EC4899', '#3B82F6', '#B8FF45', '#EF4444'];

type DetailSheet = 'advanced' | 'payment' | 'security' | 'wallet' | null;
type ToolMode = 'import' | 'watch' | null;
type PaymentSheetMode = 'form' | 'list';

const HORIZON_ACCOUNT_URLS: Record<StellarNetwork, string> = {
  mainnet: 'https://horizon.stellar.org/accounts/',
  testnet: 'https://horizon-testnet.stellar.org/accounts/',
};

function getOtherNetwork(network: StellarNetwork): StellarNetwork {
  return network === 'mainnet' ? 'testnet' : 'mainnet';
}

function getNetworkLabel(network: StellarNetwork) {
  return network === 'mainnet' ? 'Mainnet' : 'Testnet';
}

function maskBankAccount(value: string) {
  return value.length > 4 ? `•••• ${value.slice(-4)}` : value;
}

async function checkHorizonAccountExists(
  address: string,
  network: StellarNetwork,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response: Response;

  try {
    response = await fetch(
      `${HORIZON_ACCOUNT_URLS[network]}${encodeURIComponent(address)}`,
      { signal: controller.signal },
    );
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${getNetworkLabel(network)} account check timed out`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (response.ok) {
    return true;
  }

  if (response.status === 404) {
    return false;
  }

  throw new Error(
    `Horizon ${getNetworkLabel(network)} returned ${response.status}`,
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
  const { showPopup } = useAppPopup();
  const { selectedCurrency, setSelectedCurrency } = useCurrencyConfig();
  const [detailSheet, setDetailSheet] = useState<DetailSheet>(null);
  const [currencyVisible, setCurrencyVisible] = useState(false);
  const [walletManagerVisible, setWalletManagerVisible] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>(null);
  const [toolValue, setToolValue] = useState('');
  const [toolName, setToolName] = useState('');
  const [toolError, setToolError] = useState<string | null>(null);
  const [backupVisible, setBackupVisible] = useState(false);
  const [backupConfirmation, setBackupConfirmation] = useState('');
  const [walletExportOpening, setWalletExportOpening] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [toolCheckingNetwork, setToolCheckingNetwork] = useState(false);
  const [paymentSheetMode, setPaymentSheetMode] =
    useState<PaymentSheetMode>('list');
  const [editingPaymentMethod, setEditingPaymentMethod] =
    useState<RampPaymentMethod | null>(null);
  const [paymentBankId, setPaymentBankId] = useState(BANK_OPTIONS[0].bin);
  const [paymentFullName, setPaymentFullName] = useState('');
  const [paymentAccountNumber, setPaymentAccountNumber] = useState('');
  const [paymentAccountType, setPaymentAccountType] = useState<0 | 1 | 2>(0);
  const [paymentDefault, setPaymentDefault] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  const [avatarColor, setAvatarColor] = useState('#8B5CF6');
  const bounceAnim = useRef(new Animated.Value(1)).current;

  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(0)).current;
  const toastScale = useRef(new Animated.Value(0.5)).current;

  function handleProfileEgg() {
    Clipboard.setString(wallet.account?.email || '');
    
    setToastVisible(true);
    toastOpacity.setValue(0);
    toastTranslateY.setValue(0);
    toastScale.setValue(0.5);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(toastScale, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(toastTranslateY, { toValue: -30, duration: 200, useNativeDriver: true })
      ]),
      Animated.delay(1000),
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(toastTranslateY, { toValue: 50, duration: 400, useNativeDriver: true })
      ])
    ]).start(({ finished }) => {
      if (finished) setToastVisible(false);
    });

    const nextColors = EGG_COLORS.filter(c => c !== avatarColor);
    const randomColor = nextColors[Math.floor(Math.random() * nextColors.length)];
    setAvatarColor(randomColor);
    
    bounceAnim.setValue(0.9);
    Animated.spring(bounceAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }

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
  const canBackupRecovery = activeWallet?.kind === 'privy';
  const walletKind = activeWallet
    ? activeWallet.kind === 'watch_only'
      ? 'Watch-only wallet'
      : activeWallet.kind === 'imported_privy'
      ? 'Imported via Privy'
      : 'Managed by Privy'
    : 'No wallet on this network';
  const defaultPaymentMethod = wallet.paymentMethods.find(
    method => method.isDefault,
  );
  const paymentBank =
    BANK_OPTIONS.find(bank => bank.bin === paymentBankId) || BANK_OPTIONS[0];

  function closeToolModal() {
    Keyboard.dismiss();
    setToolMode(null);
    setToolError(null);
    setToolCheckingNetwork(false);
    setTimeout(() => {
      setToolValue('');
      setToolName('');
    }, 260);
  }

  function closeBackupModal() {
    setBackupVisible(false);
    setBackupConfirmation('');
  }

  function resetPaymentForm(method?: RampPaymentMethod | null) {
    setEditingPaymentMethod(method || null);
    setPaymentBankId(method?.bankId || BANK_OPTIONS[0].bin);
    setPaymentFullName(method?.fullName || '');
    setPaymentAccountNumber(method?.accountNumber || '');
    setPaymentAccountType(method?.accountType || 0);
    setPaymentDefault(Boolean(method?.isDefault));
    setPaymentError(null);
  }

  function openPaymentMethods() {
    setPaymentSheetMode('list');
    setPaymentNotice(null);
    setPaymentError(null);
    setDetailSheet('payment');
    wallet.loadPaymentMethods({ silent: true }).catch(() => null);
  }

  function openPaymentForm(method?: RampPaymentMethod) {
    resetPaymentForm(method || null);
    setPaymentNotice(null);
    setPaymentSheetMode('form');
  }

  function getPaymentFormError() {
    const fullName = paymentFullName.trim().toUpperCase();
    const accountNumber = paymentAccountNumber.trim();

    if (!/^[A-Z0-9 ]{2,100}$/.test(fullName)) {
      return 'Account holder name must use unaccented letters and numbers.';
    }

    if (!/^\d{4,30}$/.test(accountNumber)) {
      return 'Bank account number must contain 4-30 digits.';
    }

    return null;
  }

  async function submitPaymentMethod() {
    const formError = getPaymentFormError();

    if (formError) {
      setPaymentError(formError);
      return;
    }

    const payload = {
      accountNumber: paymentAccountNumber.trim(),
      accountType: paymentAccountType,
      bankId: paymentBank.bin,
      bankName: paymentBank.name,
      fullName: paymentFullName.trim().toUpperCase(),
      isDefault: paymentDefault,
    };
    const result = editingPaymentMethod
      ? await wallet.updatePaymentMethod(editingPaymentMethod.id, payload)
      : await wallet.savePaymentMethod(payload);

    if (!result) {
      setPaymentError('Could not save this payment method. Try again.');
      return;
    }

    setPaymentNotice(
      editingPaymentMethod
        ? 'Payment method updated.'
        : 'Payment method saved.',
    );
    resetPaymentForm(null);
    setPaymentSheetMode('list');
  }

  async function removePaymentMethod(method: RampPaymentMethod) {
    const deleted = await wallet.deletePaymentMethod(method.id);

    if (deleted) {
      setPaymentNotice('Payment method deleted.');
    }
  }

  async function makeDefaultPaymentMethod(method: RampPaymentMethod) {
    const result = await wallet.setDefaultPaymentMethod(method.id);

    if (result) {
      setPaymentNotice('Default payment method updated.');
    }
  }

  useEffect(() => {
    if (detailSheet !== 'wallet') {
      setAddressCopied(false);
    }
  }, [detailSheet]);

  useEffect(() => {
    if (detailSheet !== 'payment') {
      resetPaymentForm(null);
      setPaymentSheetMode('list');
      setPaymentNotice(null);
    }
  }, [detailSheet]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
        setBackupVisible(false);
        setBackupConfirmation('');
      }
    });

    return () => subscription.remove();
  }, []);

  async function requirePrivyToolSession() {
    const hasPrivyToken = await wallet.refreshPrivySecuritySession();

    if (!hasPrivyToken) {
      closeToolModal();
      setTimeout(() => {
        showPopup({
          message:
            'This security action needs an active Privy session. Please sign out and sign in again with email OTP or Google.',
          title: 'Privy sign-in required',
          variant: 'warning',
        });
      }, 280);
      return false;
    }

    return true;
  }

  async function openTool(mode: Exclude<ToolMode, null>) {
    if (mode === 'import' && !(await requirePrivyToolSession())) {
      return;
    }

    setToolMode(mode);
    setToolError(null);
  }

  function openToolFromAdvanced(mode: Exclude<ToolMode, null>) {
    setDetailSheet(null);
    setTimeout(() => {
      openTool(mode).catch(() => null);
    }, 260);
  }

  async function openBackupRecovery() {
    if (!activeWallet?.canSign) {
      showPopup({
        message: 'Watch-only wallets do not contain a private recovery key.',
        title: 'Recovery key unavailable',
        variant: 'warning',
      });
      return;
    }

    if (activeWallet.kind === 'imported_privy') {
      showPopup({
        message:
          'This wallet was imported from your own Stellar secret key. Keep the original S... key you imported.',
        title: 'Recovery key unavailable',
        variant: 'warning',
      });
      return;
    }

    setDetailSheet(null);
    setBackupConfirmation('');
    setTimeout(() => setBackupVisible(true), 260);
  }

  async function revealRecoveryKey() {
    if (backupConfirmation.trim() !== 'EXPORT') {
      showPopup({
        message: 'Enter EXPORT exactly to continue.',
        title: 'Confirmation required',
        variant: 'warning',
      });
      return;
    }

    if (walletExportOpening) {
      showPopup({
        message:
          'A secure export browser is already being opened. Finish or close that session first.',
        title: 'Export already opening',
        variant: 'info',
      });
      return;
    }

    const returnUrl = ExpoLinking.createURL('wallet-export');
    const exportUrl = await wallet.createWalletExportUrl(returnUrl);

    if (exportUrl) {
      closeBackupModal();
      setWalletExportOpening(true);

      try {
        const canOpen = await Linking.canOpenURL(exportUrl);

        if (!canOpen) {
          throw new Error('iOS cannot open the secure export URL.');
        }

        await Linking.openURL(exportUrl);
        wallet.setMessage(
          'Opened Privy secure export page in your browser. Return to the app after copying the recovery key.',
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to open browser.';

        showPopup({
          message,
          title: 'Recovery export failed',
          variant: 'danger',
        });
      } finally {
        setWalletExportOpening(false);
      }
    }
  }

  async function submitTool() {
    setToolError(null);

    if (!toolMode) {
      return;
    }

    const trimmedValue = toolValue.trim();
    const validationMessage =
      toolMode === 'import'
        ? validateImportSecret(trimmedValue)
        : validateWatchOnlyAddress(trimmedValue);

    if (validationMessage) {
      setToolError(validationMessage);
      return;
    }

    if (toolMode === 'import') {
      const importedAddress = getImportSecretPublicAddress(trimmedValue);

      if (!importedAddress) {
        setToolError(
          'This import key could not be decoded. Check that you pasted the full Privy 64-hex key or Stellar S... key.',
        );
        return;
      }

      const duplicateWallet = wallet.wallets.find(
        item =>
          item.network === wallet.network &&
          item.address.toUpperCase() === importedAddress.toUpperCase(),
      );

      if (duplicateWallet) {
        setToolError(
          `${shortAddress(
            importedAddress,
          )} is already in this account on Stellar ${wallet.network}.`,
        );
        return;
      }

      setToolCheckingNetwork(true);

      try {
        const currentNetwork = wallet.network;
        const otherNetwork = getOtherNetwork(currentNetwork);
        const [currentExists, otherExists] = await Promise.all([
          checkHorizonAccountExists(importedAddress, currentNetwork),
          checkHorizonAccountExists(importedAddress, otherNetwork),
        ]);

        if (!currentExists) {
          setToolError(
            otherExists
              ? `This key belongs to an active ${getNetworkLabel(
                  otherNetwork,
                )} account. Switch to ${getNetworkLabel(
                  otherNetwork,
                )} before importing it.`
              : `This address is not active on ${getNetworkLabel(
                  currentNetwork,
                )}. Fund it on ${getNetworkLabel(
                  currentNetwork,
                )} first, then import again.`,
          );
          return;
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to verify this wallet network.';

        setToolError(`${message}. Please try again before importing.`);
        return;
      } finally {
        setToolCheckingNetwork(false);
      }
    }

    if (toolMode === 'import' && !(await requirePrivyToolSession())) {
      return;
    }

    if (toolMode === 'import') {
      const result = await wallet.importWallet(trimmedValue, toolName, {
        showAlert: false,
      });

      if (result) {
        closeToolModal();
      } else {
        setToolError(
          'Import failed or timed out. Check your connection and try again.',
        );
      }

      return;
    }

    if (toolMode === 'watch') {
      const result = await wallet.addWatchOnlyWallet(trimmedValue, toolName);

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
    setAddressCopied(true);
  }

  function confirmNetworkSwitch(nextNetwork: 'mainnet' | 'testnet') {
    if (nextNetwork === wallet.network || wallet.isBusy) {
      return;
    }

    const nextLabel = nextNetwork === 'mainnet' ? 'Mainnet' : 'Testnet';

    showPopup({
      actions: [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => wallet.switchNetwork(nextNetwork),
          text: `Switch to ${nextLabel}`,
        },
      ],
      message:
        nextNetwork === 'testnet'
          ? 'Testnet uses demo assets. Your Mainnet balances will be hidden until you switch back.'
          : 'Mainnet uses real assets and real money. Check every transaction carefully.',
      title: `Switch to ${nextLabel}?`,
      variant: nextNetwork === 'mainnet' ? 'warning' : 'info',
    });
  }

  function openWalletManager() {
    setDetailSheet(null);
    setTimeout(() => setWalletManagerVisible(true), 260);
  }

  function renderToolModal() {
    const modalVisible = Boolean(toolMode);
    const isImport = toolMode === 'import';
    const trimmedToolValue = toolValue.trim();
    const toolValidationMessage = trimmedToolValue
      ? isImport
        ? validateImportSecret(trimmedToolValue)
        : validateWatchOnlyAddress(trimmedToolValue)
      : null;
    const visibleToolError = toolError || toolValidationMessage;
    const saveDisabled =
      wallet.isBusy ||
      toolCheckingNetwork ||
      !trimmedToolValue ||
      Boolean(toolValidationMessage);

    return (
      <Modal
        animationType="fade"
        onRequestClose={closeToolModal}
        transparent
        visible={modalVisible}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
          style={styles.centerModalOverlay}
        >
          <ScrollView
            contentContainerStyle={styles.centerModalScroll}
            keyboardShouldPersistTaps="handled"
            style={styles.centerModalScroller}
          >
            <View style={styles.toolModal}>
              <View style={styles.toolModalIcon}>
                <Ionicons
                  color="#000000"
                  name={isImport ? 'download-outline' : 'eye-outline'}
                  size={24}
                />
              </View>
              <Text style={styles.toolModalTitle}>
                {isImport ? 'Import wallet' : 'Add watch-only'}
              </Text>
              <Text style={styles.toolModalText}>
                {isImport
                  ? 'Import a private key exported by Privy.'
                  : 'Track a public Stellar address (G...) without transaction signing.'}
              </Text>
              <TextInput
                autoCapitalize="none"
                onChangeText={value => {
                  setToolName(value);
                  setToolError(null);
                  setToolCheckingNetwork(false);
                }}
                placeholder="Wallet name (optional)"
                placeholderTextColor="#9499A2"
                style={styles.input}
                value={toolName}
              />
              <TextInput
                autoCapitalize="characters"
                multiline
                onChangeText={value => {
                  setToolValue(value);
                  setToolError(null);
                  setToolCheckingNetwork(false);
                }}
                placeholder={isImport ? 'Private key' : 'G...'}
                placeholderTextColor="#9499A2"
                style={[styles.input, styles.secretInput]}
                value={toolValue}
              />
              {visibleToolError ? (
                <Text style={styles.validationText}>{visibleToolError}</Text>
              ) : null}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={closeToolModal}
                  style={styles.modalSecondaryButton}
                >
                  <Text style={styles.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={saveDisabled}
                  onPress={submitTool}
                  style={[
                    styles.modalPrimaryButton,
                    saveDisabled ? styles.modalPrimaryButtonDisabled : null,
                  ]}
                >
                  <Text style={styles.modalPrimaryText}>
                    {toolCheckingNetwork
                      ? 'Checking...'
                      : wallet.isBusy
                      ? wallet.busy
                      : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
          style={styles.centerModalOverlay}
        >
          <ScrollView
            contentContainerStyle={styles.centerModalScroll}
            keyboardShouldPersistTaps="handled"
            style={styles.centerModalScroller}
          >
            <View style={styles.toolModal}>
              <View style={styles.toolModalIcon}>
                <Ionicons color="#000000" name="key-outline" size={24} />
              </View>
              <Text style={styles.toolModalTitle}>Back up recovery key</Text>
              <Text style={styles.toolModalText}>
                The app will ask for biometric confirmation, then open Privy's
                secure export page in your system browser. The exported recovery
                key is shown there by Privy and is never returned to this app.
              </Text>
              <View style={styles.recoveryWarning}>
                <Ionicons color="#FFB020" name="warning-outline" size={20} />
                <Text style={styles.recoveryWarningText}>
                  Anyone with this key can control the wallet. Support staff
                  will never ask for it.
                </Text>
              </View>
              <Text style={styles.recoveryAddress}>
                Wallet: {activeWallet?.address || 'Unavailable'}
              </Text>
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
                  disabled={wallet.isBusy || walletExportOpening}
                  onPress={revealRecoveryKey}
                  style={[
                    styles.modalPrimaryButton,
                    wallet.isBusy || walletExportOpening
                      ? styles.rowDisabled
                      : null,
                  ]}
                >
                  <Text style={styles.modalPrimaryText}>
                    {wallet.isBusy
                      ? wallet.busy
                      : walletExportOpening
                      ? 'Opening browser'
                      : 'Open secure page'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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

        <View style={{ zIndex: 10, alignItems: 'center', justifyContent: 'center' }}>
          <TouchableOpacity activeOpacity={0.9} onPress={handleProfileEgg} style={{ width: '100%' }}>
            <Animated.View style={[styles.profileCard, { transform: [{ scale: bounceAnim }] }]}>
              <Ionicons name="planet-outline" size={72} color="rgba(255,255,255,0.15)" style={styles.bgIcon1} />
              <Ionicons name="cube-outline" size={54} color="rgba(255,255,255,0.15)" style={styles.bgIcon2} />
              <Ionicons name="sparkles-outline" size={28} color="#FFFFFF" style={styles.bgIcon3} />
              <Ionicons name="rocket-outline" size={36} color="rgba(255,255,255,0.12)" style={styles.bgIcon4} />
              <Ionicons name="hardware-chip-outline" size={28} color="rgba(255,255,255,0.1)" style={styles.bgIcon5} />
              <Ionicons name="star-outline" size={14} color="#FFFFFF" style={styles.bgIcon6} />
              <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarText}>{profileInitial}</Text>
              </View>
              <View style={styles.profileEmailRow}>
                <Text numberOfLines={1} style={styles.profileEmail}>
                  {email}
                </Text>
                <Ionicons
                  color="#B8FF45"
                  name="shield-checkmark"
                  size={16}
                />
              </View>
            </Animated.View>
          </TouchableOpacity>

          {toastVisible && (
            <Animated.View 
              pointerEvents="none"
              style={[
                styles.customToast, 
                { 
                  opacity: toastOpacity, 
                  transform: [
                    { scale: toastScale },
                    { translateY: toastTranslateY }
                  ] 
                }
              ]}
            >
              <Ionicons name="checkmark-circle" size={16} color="#B8FF45" />
              <Text style={styles.customToastText}>Đã sao chép</Text>
            </Animated.View>
          )}
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
              name={
                wallet.isMainnet ? 'alert-circle-outline' : 'beaker-outline'
              }
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
                <Ionicons color="#A1B0C8" name="chevron-forward" size={20} />
              </View>
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            disabled={kycVerified}
            icon="shield-checkmark-outline"
            onPress={kycVerified ? undefined : onOpenKyc}
            subtitle={
              kycVerified
                ? 'Verified for VND buy and withdrawal'
                : 'Required before buying or withdrawing with VND'
            }
            title="Identity verification"
            trailing={
              <View style={styles.rowTrailing}>
                <Text
                  style={[
                    styles.rowValue,
                    kycVerified
                      ? styles.rowValueSuccess
                      : styles.rowValueWarning,
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
            icon="card-outline"
            onPress={openPaymentMethods}
            subtitle={
              defaultPaymentMethod
                ? `${defaultPaymentMethod.bankName} · ${maskBankAccount(
                    defaultPaymentMethod.accountNumber,
                  )}`
                : `${wallet.paymentMethods.length} saved method${
                    wallet.paymentMethods.length === 1 ? '' : 's'
                  }`
            }
            title="Payment methods"
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
                : 'Not available yet'
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

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>
            Version {Application.nativeApplicationVersion} ({Application.nativeBuildVersion})
          </Text>
        </View>
      </ScrollView>

      <AppBottomSheet
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
              <Text style={styles.addressText}>{activeWallet.address}</Text>
            </View>

            <View style={styles.walletActions}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={copyActiveWalletAddress}
                style={[
                  styles.walletAction,
                  addressCopied ? styles.walletActionSuccess : null,
                ]}
              >
                <Ionicons
                  color={addressCopied ? '#B8FF45' : '#FFFFFF'}
                  name={addressCopied ? 'checkmark-circle' : 'copy-outline'}
                  size={21}
                />
                <Text
                  style={[
                    styles.walletActionText,
                    addressCopied ? styles.walletActionSuccessText : null,
                  ]}
                >
                  {addressCopied ? 'Copied' : 'Copy'}
                </Text>
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
      </AppBottomSheet>

      <AppBottomSheet
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
                  <Ionicons color="#B8FF45" name="checkmark-circle" size={23} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        bottomInset={insets.bottom}
        onClose={() => setDetailSheet(null)}
        title="Payment methods"
        visible={detailSheet === 'payment'}
      >
        <ScrollView
          contentContainerStyle={styles.paymentSheetContent}
          showsVerticalScrollIndicator={false}
          style={styles.paymentSheetScroll}
        >
          {paymentNotice ? (
            <Text style={styles.paymentNotice}>{paymentNotice}</Text>
          ) : null}

          {paymentSheetMode === 'list' ? (
            <>
              {wallet.paymentMethods.length > 0 ? (
                <View style={styles.paymentList}>
                  {wallet.paymentMethods.map(method => {
                    const bank =
                      BANK_OPTIONS.find(item => item.bin === method.bankId) ||
                      null;

                    return (
                      <View key={method.id} style={styles.paymentMethodCard}>
                        <View style={styles.paymentMethodTop}>
                          <View style={styles.bankLogoBoxSmall}>
                            {bank ? (
                              <Image
                                resizeMode="contain"
                                source={bank.image}
                                style={styles.bankLogoSmall}
                              />
                            ) : (
                              <Ionicons
                                color="#FFFFFF"
                                name="business-outline"
                                size={20}
                              />
                            )}
                          </View>
                          <View style={styles.rowCopy}>
                            <View style={styles.paymentMethodTitleRow}>
                              <Text style={styles.paymentMethodTitle}>
                                {method.bankName}
                              </Text>
                              {method.isDefault ? (
                                <Text style={styles.defaultBadge}>Default</Text>
                              ) : null}
                            </View>
                            <Text style={styles.paymentMethodMeta}>
                              {maskBankAccount(method.accountNumber)} ·{' '}
                              {method.fullName}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.paymentMethodActions}>
                          <TouchableOpacity
                            activeOpacity={0.78}
                            onPress={() => openPaymentForm(method)}
                            style={styles.paymentMiniButton}
                          >
                            <Text style={styles.paymentMiniText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={0.78}
                            disabled={method.isDefault || wallet.isBusy}
                            onPress={() => makeDefaultPaymentMethod(method)}
                            style={[
                              styles.paymentMiniButton,
                              method.isDefault || wallet.isBusy
                                ? styles.paymentMiniButtonDisabled
                                : null,
                            ]}
                          >
                            <Text style={styles.paymentMiniText}>Default</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={0.78}
                            disabled={wallet.isBusy}
                            onPress={() => removePaymentMethod(method)}
                            style={[
                              styles.paymentMiniButton,
                              styles.paymentDangerButton,
                              wallet.isBusy
                                ? styles.paymentMiniButtonDisabled
                                : null,
                            ]}
                          >
                            <Text style={styles.paymentDangerText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons color="#A1B0C8" name="card-outline" size={34} />
                  <Text style={styles.emptyTitle}>No saved bank yet</Text>
                  <Text style={styles.emptyText}>
                    Add a bank account here, then choose it when withdrawing
                    VND.
                  </Text>
                </View>
              )}
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => openPaymentForm()}
                style={styles.paymentAddButton}
              >
                <Ionicons color="#07100B" name="add" size={20} />
                <Text style={styles.paymentAddText}>Add payment method</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.paymentFormLabel}>Bank</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.bankRail}
              >
                {BANK_OPTIONS.map(bank => {
                  const selected = paymentBankId === bank.bin;

                  return (
                    <TouchableOpacity
                      activeOpacity={0.82}
                      key={bank.bin}
                      onPress={() => {
                        setPaymentBankId(bank.bin);
                        setPaymentError(null);
                      }}
                      style={[
                        styles.bankChip,
                        selected ? styles.bankChipSelected : null,
                      ]}
                    >
                      <Image
                        resizeMode="contain"
                        source={bank.image}
                        style={styles.bankChipLogo}
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.bankChipText,
                          selected ? styles.bankChipTextSelected : null,
                        ]}
                      >
                        {bank.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TextInput
                autoCapitalize="characters"
                onChangeText={value => {
                  setPaymentFullName(value.toUpperCase());
                  setPaymentError(null);
                }}
                placeholder="Account holder name without accents"
                placeholderTextColor="#9499A2"
                style={styles.input}
                value={paymentFullName}
              />
              <TextInput
                keyboardType="number-pad"
                onChangeText={value => {
                  setPaymentAccountNumber(value.replace(/\D/g, ''));
                  setPaymentError(null);
                }}
                placeholder="Account number"
                placeholderTextColor="#9499A2"
                style={styles.input}
                value={paymentAccountNumber}
              />

              <View style={styles.segmented}>
                {([0, 1, 2] as const).map(type => {
                  const selected = paymentAccountType === type;
                  const label =
                    type === 0 ? 'Personal' : type === 1 ? 'Business' : 'Other';

                  return (
                    <TouchableOpacity
                      activeOpacity={0.82}
                      key={type}
                      onPress={() => setPaymentAccountType(type)}
                      style={[
                        styles.segment,
                        selected ? styles.segmentActive : null,
                      ]}
                    >
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

              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => setPaymentDefault(value => !value)}
                style={styles.paymentDefaultRow}
              >
                <Ionicons
                  color={paymentDefault ? '#B8FF45' : '#A1B0C8'}
                  name={paymentDefault ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                />
                <Text style={styles.paymentDefaultText}>
                  Set as default payment method
                </Text>
              </TouchableOpacity>

              {paymentError ? (
                <Text style={styles.validationText}>{paymentError}</Text>
              ) : null}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => {
                    resetPaymentForm(null);
                    setPaymentSheetMode('list');
                  }}
                  style={styles.modalSecondaryButton}
                >
                  <Text style={styles.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={wallet.isBusy}
                  onPress={submitPaymentMethod}
                  style={[
                    styles.modalPrimaryButton,
                    wallet.isBusy ? styles.modalPrimaryButtonDisabled : null,
                  ]}
                >
                  <Text style={styles.modalPrimaryText}>
                    {wallet.isBusy ? wallet.busy : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </AppBottomSheet>

      <AppBottomSheet
        bottomInset={insets.bottom}
        onClose={() => setDetailSheet(null)}
        title="Security"
        visible={detailSheet === 'security'}
      >
        <View style={styles.securityIntro}>
          <View style={styles.securityHeroIcon}>
            <Ionicons color="#FFFFFF" name="shield-checkmark" size={28} />
          </View>
          <Text style={styles.securityIntroTitle}>Built for safer signing</Text>
          <Text style={styles.securityIntroText}>
            Your wallet combines Privy-managed access with Stellar transaction
            checks.
          </Text>
        </View>
        <View style={styles.detailGroup}>
          <SettingsRow
            disabled={!canBackupRecovery}
            icon="key-outline"
            onPress={openBackupRecovery}
            subtitle={
              canBackupRecovery
                ? 'Open Privy secure page in your browser to export the recovery key once'
                : activeWallet?.kind === 'imported_privy'
                ? 'Imported wallets already use your own S... key'
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
      </AppBottomSheet>

      <AppBottomSheet
        bottomInset={insets.bottom}
        onClose={() => setDetailSheet(null)}
        title="Advanced"
        visible={detailSheet === 'advanced'}
      >
        <View style={styles.detailGroup}>
          <SettingsRow
            icon="download-outline"
            onPress={() => openToolFromAdvanced('import')}
            title="Import wallet"
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="eye-outline"
            onPress={() => openToolFromAdvanced('watch')}
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
            value="Backup recovery key opens Privy's secure export page in your browser for Privy-managed wallets. Restore later with Import wallet."
          />
        </View>
      </AppBottomSheet>

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
    backgroundColor: '#8B5CF6',
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
  bankChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 7,
    marginRight: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
    width: 92,
  },
  bankChipLogo: {
    height: 26,
    width: 48,
  },
  bankChipSelected: {
    backgroundColor: 'rgba(184,255,69,0.12)',
    borderColor: 'rgba(184,255,69,0.36)',
  },
  bankChipText: {
    color: '#A1B0C8',
    fontSize: 10,
    fontWeight: '800',
  },
  bankChipTextSelected: {
    color: '#B8FF45',
  },
  bankLogoBoxSmall: {
    alignItems: 'center',
    backgroundColor: '#1E222B',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 54,
  },
  bankLogoSmall: {
    height: 28,
    width: 46,
  },
  bankRail: {
    marginTop: 10,
  },
  centerModalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(5,16,25,0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  centerModalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  centerModalScroller: {
    width: '100%',
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
  defaultBadge: {
    backgroundColor: 'rgba(184,255,69,0.14)',
    borderRadius: 9,
    color: '#B8FF45',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  modalPrimaryButtonDisabled: {
    opacity: 0.45,
  },
  modalPrimaryText: {
    color: '#07100B',
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  paymentAddButton: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 50,
  },
  paymentAddText: {
    color: '#07100B',
    fontSize: 14,
    fontWeight: '900',
  },
  paymentDangerButton: {
    backgroundColor: 'rgba(255,82,82,0.12)',
  },
  paymentDangerText: {
    color: '#FF7A88',
    fontSize: 12,
    fontWeight: '900',
  },
  paymentDefaultRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    padding: 12,
  },
  paymentDefaultText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  paymentFormLabel: {
    color: '#A1B0C8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  paymentList: {
    gap: 10,
  },
  paymentMethodActions: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentMethodCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  paymentMethodMeta: {
    color: '#A1B0C8',
    fontSize: 12,
    fontWeight: '700',
  },
  paymentMethodTitle: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  paymentMethodTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  paymentMethodTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  paymentMiniButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
  },
  paymentMiniButtonDisabled: {
    opacity: 0.45,
  },
  paymentMiniText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  paymentNotice: {
    backgroundColor: 'rgba(184,255,69,0.12)',
    borderRadius: 13,
    color: '#B8FF45',
    fontSize: 12,
    fontWeight: '800',
    padding: 11,
    textAlign: 'center',
  },
  paymentSheetContent: {
    gap: 12,
    paddingBottom: 4,
  },
  paymentSheetScroll: {
    maxHeight: 540,
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
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 24,
    shadowColor: '#1A1D22',
    shadowOffset: { height: 9, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  profileEmailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  profileEmail: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  bgIcon1: {
    position: 'absolute',
    top: -15,
    left: -10,
    transform: [{ rotate: '-15deg' }],
  },
  bgIcon2: {
    position: 'absolute',
    bottom: -15,
    right: -5,
    transform: [{ rotate: '15deg' }],
  },
  bgIcon3: {
    position: 'absolute',
    top: 15,
    right: 25,
  },
  bgIcon4: {
    position: 'absolute',
    bottom: -10,
    left: 20,
    transform: [{ rotate: '45deg' }],
  },
  bgIcon5: {
    position: 'absolute',
    top: -5,
    right: 70,
    transform: [{ rotate: '15deg' }],
  },
  bgIcon6: {
    position: 'absolute',
    top: 55,
    left: 25,
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
    backgroundColor: '#B8FF45',
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
  validationText: {
    color: '#FFB86B',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: -4,
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
  walletActionSuccess: {
    backgroundColor: 'rgba(184, 255, 69, 0.12)',
    borderColor: 'rgba(184, 255, 69, 0.22)',
    borderWidth: 1,
  },
  walletActionSuccessText: {
    color: '#B8FF45',
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
  versionContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 24,
  },
  versionText: {
    color: '#717781',
    fontSize: 12,
    fontWeight: '600',
  },
  customToast: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#1E222B',
    borderRadius: 30,
    elevation: 5,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    zIndex: 9999,
  },
  customToastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
