import React, { useState } from 'react';
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Application from 'expo-application';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppPopup } from '@components/common/AppPopup';
import {
  PressScale,
  WalletManagerModal,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import {
  type SupportedCurrency,
  useCurrencyConfig,
} from '@contexts/CurrencyContext';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@config';
import type { FeedbackCategory, StellarNetwork } from '@app-types';
import type { WalletState } from '@hooks/useWallet.ios';
import { maskEmailForDisplay, shortAddress } from '@utils/format';

const CURRENCIES: { code: SupportedCurrency; name: string }[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'EUR', name: 'Euro' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'GBP', name: 'British Pound' },
];

type Sheet =
  | 'advanced'
  | 'currency'
  | 'feedback'
  | 'security'
  | null;

function SettingRow({
  icon,
  onPress,
  subtitle,
  title,
  value,
}: {
  icon: string;
  onPress: () => void;
  subtitle?: string;
  title: string;
  value?: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons color="#FFFFFF" name={icon} size={20} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <Ionicons color="#77808E" name="chevron-forward" size={19} />
    </TouchableOpacity>
  );
}

function SheetModal({
  children,
  onClose,
  title,
  visible,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <TouchableOpacity onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons color="#FFFFFF" name="close" size={20} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function SettingsScreen({
  onOpenWalletConnect,
  wallet,
}: {
  onOpenWalletConnect: () => void;
  wallet: WalletState;
}) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const { showPopup } = useAppPopup();
  const { selectedCurrency, setSelectedCurrency } = useCurrencyConfig();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [walletManagerVisible, setWalletManagerVisible] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [watchAddress, setWatchAddress] = useState('');
  const [walletName, setWalletName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackNotice, setFeedbackNotice] = useState('');
  const activeWallet = wallet.wallet;
  const networkLabel = wallet.isMainnet ? 'Mainnet' : 'Testnet';

  function confirmNetworkSwitch(nextNetwork: StellarNetwork) {
    if (nextNetwork === wallet.network) return;

    showPopup({
      actions: [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => wallet.switchNetwork(nextNetwork),
          text: `Switch to ${nextNetwork === 'mainnet' ? 'Mainnet' : 'Testnet'}`,
        },
      ],
      message:
        nextNetwork === 'mainnet'
          ? 'Mainnet uses real assets and real transactions.'
          : 'Testnet uses demo assets for testing.',
      title: `Switch network?`,
      variant: nextNetwork === 'mainnet' ? 'warning' : 'info',
    });
  }

  function confirmDeletion() {
    showPopup({
      actions: [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: wallet.deleteAccount,
          style: 'destructive',
          text: 'Delete account',
        },
      ],
      message:
        'Back up your recovery key first. This removes your app profile and local session. Public blockchain transactions cannot be erased.',
      title: 'Delete account?',
      variant: 'danger',
    });
  }

  async function openRecoveryExport() {
    const url = await wallet.createWalletExportUrl();
    if (url) wallet.openUrl(url);
  }

  async function importWallet() {
    const result = await wallet.importWallet(secretInput, walletName);
    if (result) {
      setSecretInput('');
      setWalletName('');
      setSheet(null);
    }
  }

  async function addWatchOnlyWallet() {
    const result = await wallet.addWatchOnlyWallet(watchAddress, walletName);
    if (result) {
      setWatchAddress('');
      setWalletName('');
      setSheet(null);
    }
  }

  async function sendFeedback() {
    const message = feedback.trim();
    if (message.length < 3) return;

    const result = await wallet.submitFeedback({
      appVersion: `${Application.nativeApplicationVersion || ''} (${Application.nativeBuildVersion || ''})`,
      category: 'general' as FeedbackCategory,
      message,
      rating: 5,
    });
    if (result) {
      setFeedback('');
      setFeedbackNotice('Feedback sent. Thank you.');
    }
  }

  return (
    <>
      <ScrollView contentContainerStyle={screenInsetStyle} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Wallet preferences, security and support</Text>
        </View>

        <TouchableOpacity onPress={() => setWalletManagerVisible(true)} style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(wallet.account?.email || 'S').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.profileTitle}>{activeWallet?.displayName || 'Stellar Wallet'}</Text>
            <Text style={styles.profileMeta}>{maskEmailForDisplay(wallet.account?.email)}</Text>
            <Text style={styles.profileMeta}>{shortAddress(activeWallet?.address)}</Text>
          </View>
          <Ionicons color="#77808E" name="chevron-forward" size={20} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>NETWORK</Text>
        <View style={styles.segmented}>
          {(['mainnet', 'testnet'] as StellarNetwork[]).map(item => {
            const selected = wallet.network === item;
            return (
              <TouchableOpacity
                disabled={wallet.isBusy}
                key={item}
                onPress={() => confirmNetworkSwitch(item)}
                style={[styles.segment, selected ? styles.segmentSelected : null]}
              >
                <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>
                  {item === 'mainnet' ? 'Mainnet' : 'Testnet'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.networkHint}>
          {networkLabel}: {wallet.isMainnet ? 'real assets and transactions' : 'demo assets for testing'}
        </Text>

        <Text style={styles.sectionLabel}>WALLET</Text>
        <View style={styles.group}>
          <SettingRow icon="wallet-outline" onPress={() => setWalletManagerVisible(true)} subtitle="Create, select, rename or archive wallets" title="Manage wallets" />
          <View style={styles.divider} />
          <SettingRow icon="link-outline" onPress={onOpenWalletConnect} subtitle="Connect to supported Stellar dApps" title="WalletConnect" />
          <View style={styles.divider} />
          <SettingRow icon="shield-checkmark-outline" onPress={() => setSheet('security')} subtitle="Recovery export and signing protection" title="Security" />
          <View style={styles.divider} />
          <SettingRow icon="options-outline" onPress={() => setSheet('advanced')} subtitle="Import or track a public wallet" title="Advanced" />
        </View>

        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.group}>
          <SettingRow icon="cash-outline" onPress={() => setSheet('currency')} title="Display currency" value={selectedCurrency} />
        </View>

        <Text style={styles.sectionLabel}>SUPPORT</Text>
        <View style={styles.group}>
          <SettingRow icon="chatbubble-outline" onPress={() => setSheet('feedback')} title="Send feedback" />
          <View style={styles.divider} />
          <SettingRow icon="document-text-outline" onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)} title="Terms of Service" />
          <View style={styles.divider} />
          <SettingRow icon="lock-closed-outline" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} title="Privacy Policy" />
        </View>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.group}>
          <SettingRow icon="trash-outline" onPress={confirmDeletion} subtitle="Permanently remove your app account" title="Delete account" />
        </View>

        <PressScale onPress={wallet.logout} style={styles.signOut}>
          <Ionicons color="#FF6262" name="log-out-outline" size={20} />
          <Text style={styles.signOutText}>Sign out</Text>
        </PressScale>
        <Text style={styles.version}>Version {Application.nativeApplicationVersion} ({Application.nativeBuildVersion})</Text>
      </ScrollView>

      <WalletManagerModal onClose={() => setWalletManagerVisible(false)} visible={walletManagerVisible} walletState={wallet as never} />

      <SheetModal onClose={() => setSheet(null)} title="Display currency" visible={sheet === 'currency'}>
        {CURRENCIES.map(item => (
          <TouchableOpacity
            key={item.code}
            onPress={() => {
              setSelectedCurrency(item.code);
              setSheet(null);
            }}
            style={styles.choiceRow}
          >
            <Text style={styles.choiceText}>{item.name}</Text>
            <Text style={styles.rowValue}>{item.code}</Text>
          </TouchableOpacity>
        ))}
      </SheetModal>

      <SheetModal onClose={() => setSheet(null)} title="Security" visible={sheet === 'security'}>
        <Text style={styles.sheetCopy}>Privy protects signing access. The app does not store your secret key locally.</Text>
        <TouchableOpacity disabled={activeWallet?.kind !== 'privy'} onPress={openRecoveryExport} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Open secure recovery export</Text>
        </TouchableOpacity>
      </SheetModal>

      <SheetModal onClose={() => setSheet(null)} title="Advanced wallet tools" visible={sheet === 'advanced'}>
        <TextInput onChangeText={setWalletName} placeholder="Wallet name (optional)" placeholderTextColor="#78818E" style={styles.input} value={walletName} />
        <TextInput autoCapitalize="characters" onChangeText={setSecretInput} placeholder="Stellar secret key to import" placeholderTextColor="#78818E" secureTextEntry style={styles.input} value={secretInput} />
        <TouchableOpacity disabled={!secretInput.trim()} onPress={importWallet} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Import wallet</Text>
        </TouchableOpacity>
        <View style={styles.toolDivider} />
        <TextInput autoCapitalize="characters" onChangeText={setWatchAddress} placeholder="Public G... address" placeholderTextColor="#78818E" style={styles.input} value={watchAddress} />
        <TouchableOpacity disabled={!watchAddress.trim()} onPress={addWatchOnlyWallet} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Add watch-only wallet</Text>
        </TouchableOpacity>
      </SheetModal>

      <SheetModal onClose={() => setSheet(null)} title="Feedback" visible={sheet === 'feedback'}>
        <TextInput multiline onChangeText={setFeedback} placeholder="Tell us what worked or what felt confusing." placeholderTextColor="#78818E" style={[styles.input, styles.feedbackInput]} value={feedback} />
        {feedbackNotice ? <Text style={styles.notice}>{feedbackNotice}</Text> : null}
        <TouchableOpacity disabled={feedback.trim().length < 3} onPress={sendFeedback} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Send feedback</Text>
        </TouchableOpacity>
      </SheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', backgroundColor: '#7657FF', borderRadius: 27, height: 54, justifyContent: 'center', width: 54 },
  avatarText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  choiceRow: { alignItems: 'center', borderBottomColor: '#25282D', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  choiceText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  closeButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  divider: { backgroundColor: '#24272C', height: 1, marginLeft: 58 },
  feedbackInput: { height: 120, textAlignVertical: 'top' },
  group: { backgroundColor: '#14161A', borderRadius: 20, marginHorizontal: 20, overflow: 'hidden' },
  header: { paddingHorizontal: 22, paddingTop: 20 },
  headerSubtitle: { color: '#8C95A3', fontSize: 13, marginTop: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  input: { backgroundColor: '#0B0C0E', borderColor: '#292D33', borderRadius: 14, borderWidth: 1, color: '#FFFFFF', marginBottom: 12, padding: 14 },
  networkHint: { color: '#858E9B', fontSize: 12, marginHorizontal: 24, marginTop: 8 },
  notice: { color: '#B8FF45', marginBottom: 12 },
  overlay: { backgroundColor: 'rgba(0,0,0,0.65)', flex: 1, justifyContent: 'flex-end' },
  primaryButton: { alignItems: 'center', backgroundColor: '#B8FF45', borderRadius: 14, marginTop: 8, padding: 15 },
  primaryButtonText: { color: '#050505', fontSize: 14, fontWeight: '900' },
  profileCard: { alignItems: 'center', backgroundColor: '#14161A', borderRadius: 22, flexDirection: 'row', gap: 14, marginHorizontal: 20, marginTop: 20, padding: 16 },
  profileMeta: { color: '#8993A0', fontSize: 12, marginTop: 2 },
  profileTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  row: { alignItems: 'center', flexDirection: 'row', minHeight: 72, paddingHorizontal: 16 },
  rowBody: { flex: 1, minWidth: 0 },
  rowIcon: { alignItems: 'center', backgroundColor: '#23262C', borderRadius: 14, height: 40, justifyContent: 'center', marginRight: 12, width: 40 },
  rowSubtitle: { color: '#838D9A', fontSize: 11, marginTop: 3 },
  rowTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  rowValue: { color: '#AAB4C2', fontSize: 13, marginRight: 6 },
  secondaryButton: { alignItems: 'center', borderColor: '#B8FF45', borderRadius: 14, borderWidth: 1, padding: 14 },
  secondaryButtonText: { color: '#B8FF45', fontWeight: '800' },
  sectionLabel: { color: '#69727E', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginHorizontal: 24, marginTop: 26 },
  segment: { alignItems: 'center', borderRadius: 14, flex: 1, paddingVertical: 12 },
  segmentSelected: { backgroundColor: '#31353C' },
  segmented: { backgroundColor: '#14161A', borderRadius: 18, flexDirection: 'row', gap: 6, marginHorizontal: 20, marginTop: 10, padding: 5 },
  segmentText: { color: '#7D8795', fontWeight: '700' },
  segmentTextSelected: { color: '#FFFFFF' },
  sheet: { backgroundColor: '#15171B', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '88%', padding: 20 },
  sheetCopy: { color: '#AAB3C0', lineHeight: 21, marginBottom: 12 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  sheetTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  signOut: { alignItems: 'center', borderColor: '#3B2529', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 10, justifyContent: 'center', marginHorizontal: 20, marginTop: 24, padding: 15 },
  signOutText: { color: '#FF6262', fontWeight: '800' },
  toolDivider: { backgroundColor: '#292D33', height: 1, marginVertical: 18 },
  version: { color: '#59616C', fontSize: 11, marginBottom: 36, marginTop: 18, textAlign: 'center' },
});
