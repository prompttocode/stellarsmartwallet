import re

with open('SendScreen.tsx', 'r') as f:
    original = f.read()

# We want to replace the `return` blocks and add `insets = useSafeAreaInsets()` and `styles`

# Extract imports and add useSafeAreaInsets and StyleSheet
if "useSafeAreaInsets" not in original:
    original = original.replace("import { Alert, ScrollView, Text, TextInput, View } from 'react-native';", "import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';")

original = original.replace("  const screenInsetStyle = useSafeScreenInsetStyle();", "  const insets = useSafeAreaInsets();\n  const screenInsetStyle = { paddingBottom: insets.bottom + 48 };")

# Instead of parsing heavily, let's just generate the whole file since we know exactly what we want.
content = """import React, { useState, useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ReactNativeBiometrics from 'react-native-biometrics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AssetPickerModal,
  AssetSelectButton,
  getModernAssets,
  InfoLine,
  PressScale,
  SectionHeader,
  modern,
} from '@components/wallet';
import type { WalletState } from '@hooks/useWallet';
import type { SendResult } from '@app-types';
import { formatTokenAmount, shortAddress } from '@utils/format';

type SendStep = 'compose' | 'review' | 'success';

export function SendScreen({
  onBack,
  onGoToScan,
  route,
  wallet,
}: {
  onBack?: () => void;
  onGoToScan?: () => void;
  route?: any;
  wallet: WalletState;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<SendStep>('compose');
  const [assetPickerVisible, setAssetPickerVisible] = useState(false);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);
  const { setRecipient } = wallet;
  const assets = getModernAssets(wallet.balances, wallet.visibleAssets);
  const selectedAsset = assets.find(
    asset => asset.assetCode === wallet.selectedAssetCode,
  );

  useEffect(() => {
    if (route?.params?.prefilledAddress) {
      setRecipient(route.params.prefilledAddress);
    }
  }, [route?.params?.prefilledAddress, setRecipient]);
  const recipientLabel =
    wallet.recipientContact?.wallet.address === wallet.recipient
      ? wallet.recipientContact.label
      : shortAddress(wallet.recipient);
  const canSubmit =
    wallet.walletCanSign &&
    (!wallet.isMainnet || wallet.walletActive) &&
    Boolean(wallet.amount) &&
    Boolean(wallet.recipient.trim());

  async function handleConfirmSend() {
    const rnBiometrics = new ReactNativeBiometrics();
    const { available } = await rnBiometrics.isSensorAvailable();

    if (available) {
      try {
        const { success } = await rnBiometrics.simplePrompt({
          promptMessage: 'Confirm this transfer',
          cancelButtonText: 'Cancel',
        });

        if (!success) {
          Alert.alert(
            'Authentication failed',
            'Could not send the transaction.',
          );
          return;
        }
      } catch {
        Alert.alert('Authentication error', 'Please try again.');
        return;
      }
    }

    const result = await wallet.sendAsset();

    if (result) {
      setLastResult(result);
      setStep('success');
    }
  }

  async function searchPickerAssets(query: string) {
    const result = await wallet.searchAssets(query);
    return getModernAssets(wallet.balances, result);
  }

  function renderHero(title: string, subtitle: string, onHeroBack?: () => void) {
    return (
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.heroHeader}>
          <PressScale onPress={onHeroBack || onBack} style={styles.heroBackButton}>
            <Ionicons color="#FFFFFF" name="chevron-back" size={24} />
          </PressScale>
          <Text style={styles.heroHeaderTitle}>Transfer</Text>
          <View style={styles.heroHeaderSpacer} />
        </View>
        <Text style={styles.heroEyebrow}>STELLAR WALLET</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </View>
    );
  }

  if (step === 'success' && lastResult) {
    return (
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        style={styles.root}
        showsVerticalScrollIndicator={false}
      >
        {renderHero('Transfer sent', `Transaction submitted to Stellar ${wallet.network === 'mainnet' ? 'Mainnet' : 'Testnet'}.`)}
        <View style={styles.receiptCard}>
          <View style={modern.successOrb}>
            <Ionicons color="#B8FF45" name="checkmark" size={42} />
          </View>
          <Text style={styles.receiptTitle}>Transfer sent</Text>
          <Text style={modern.successModernText}>
            {formatTokenAmount(wallet.amount)} {lastResult.assetCode} →{' '}
            {recipientLabel}
          </Text>
          <PressScale
            onPress={() => wallet.openUrl(lastResult.transaction.explorerUrl)}
            style={modern.primaryModernButton}
          >
            <Text style={modern.modernButtonText}>Open Stellar Expert</Text>
          </PressScale>
          <PressScale
            onPress={() => setStep('compose')}
            style={modern.secondaryModernButton}
          >
            <Text style={[modern.modernButtonText, modern.secondaryModernButtonText]}>
              Send again
            </Text>
          </PressScale>
        </View>
      </ScrollView>
    );
  }

  if (step === 'review') {
    return (
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        style={styles.root}
        showsVerticalScrollIndicator={false}
      >
        {renderHero('Review transfer', wallet.isMainnet ? 'Review carefully. Mainnet transactions move real assets.' : 'Review carefully before sending test tokens.', () => setStep('compose'))}
        <View style={styles.receiptCard}>
          <SectionHeader title="Transfer details" />
          <InfoLine
            label="Network"
            value={
              wallet.isMainnet ? 'Mainnet · real assets' : 'Testnet · demo only'
            }
          />
          <InfoLine
            label="Amount"
            value={`${formatTokenAmount(wallet.amount || '0')} ${
              wallet.selectedAssetCode
            }`}
          />
          <InfoLine
            label="Destination"
            value={wallet.recipient.trim() || recipientLabel}
          />
          {wallet.selectedAssetCode !== 'XLM' ? (
            <InfoLine
              label="Asset issuer"
              value={wallet.selectedAsset?.assetIssuer || 'Unknown issuer'}
            />
          ) : null}
          <InfoLine label="Estimated fee" value="0.00001 XLM" />
          <Text style={modern.emptyModernText}>
            {wallet.isMainnet
              ? 'This is a real Mainnet transaction. The app will ask for biometric confirmation before Privy signs it.'
              : 'After you press Send, this test transaction will be submitted to Stellar Testnet.'}
          </Text>
          <PressScale
            disabled={wallet.isBusy || !canSubmit}
            onPress={handleConfirmSend}
            style={[styles.primaryButton, (wallet.isBusy || !canSubmit) ? styles.disabledButton : null]}
          >
            <Text style={styles.primaryButtonText}>
              {wallet.busy || (wallet.isMainnet ? 'Confirm' : 'Send')}
            </Text>
          </PressScale>
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        style={styles.root}
        showsVerticalScrollIndicator={false}
      >
        {renderHero('Send crypto', wallet.isMainnet ? 'Transfer crypto to another Stellar wallet on Mainnet.' : 'Transfer Testnet XLM or USDC to another Stellar wallet.')}

        <View style={styles.receiptCard}>
          {!wallet.walletCanSign ? (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeTitle}>Watch-only wallet</Text>
              <Text style={styles.noticeText}>
                This wallet can only view balances and QR codes. It cannot sign
                sends, swaps, or exports.
              </Text>
            </View>
          ) : null}

          {wallet.isMainnet && !wallet.walletActive ? (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeTitle}>Wallet inactive</Text>
              <Text style={styles.noticeText}>
                Deposit real XLM into this wallet before sending Mainnet
                transactions.
              </Text>
            </View>
          ) : null}

          <View style={styles.formCard}>
            <SectionHeader title="Asset" />
            <AssetSelectButton
              asset={selectedAsset}
              label="Sending asset"
              onPress={() => setAssetPickerVisible(true)}
              valueLabel={`${formatTokenAmount(
                wallet.selectedBalance?.balance || selectedAsset?.balance || '0',
                { compact: true },
              )} ${wallet.selectedAssetCode}`}
            />
          </View>

          <View style={styles.formCard}>
            <SectionHeader
              action={
                <PressScale onPress={onGoToScan}>
                  <Ionicons name="qr-code-outline" size={20} color="#0F8EA3" />
                </PressScale>
              }
              title="Recipient"
            />
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              multiline
              onChangeText={wallet.setRecipient}
              placeholder="G... Stellar wallet address"
              placeholderTextColor="#A7B3BA"
              style={styles.input}
              value={wallet.recipient}
            />
            {wallet.recipientContact ? (
              <View style={styles.reviewBox}>
                <Text style={styles.reviewBoxTitle}>
                  {wallet.recipientContact.label}
                </Text>
                <Text style={styles.reviewBoxText}>
                  {shortAddress(wallet.recipientContact.wallet.address)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.formCard}>
            <SectionHeader title="Amount" />
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={wallet.setAmount}
              placeholder="1"
              placeholderTextColor="#A7B3BA"
              style={styles.input}
              value={wallet.amount}
            />
            <PressScale
              disabled={wallet.isBusy || !canSubmit}
              onPress={() => setStep('review')}
              style={[styles.primaryButton, (wallet.isBusy || !canSubmit) ? styles.disabledButton : null]}
            >
              <Text style={styles.primaryButtonText}>Review transfer</Text>
            </PressScale>
          </View>
        </View>
      </ScrollView>

      <AssetPickerModal
        assets={assets}
        onAddTrustline={wallet.addTrustline}
        onClose={() => setAssetPickerVisible(false)}
        onRemoteSearch={searchPickerAssets}
        onSelect={asset => wallet.setSelectedAssetCode(asset.assetCode)}
        selectedAssetCode={wallet.selectedAssetCode}
        title="Select asset to send"
        visible={assetPickerVisible}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    backgroundColor: '#F4F5F7',
  },
  disabledButton: {
    opacity: 0.45,
  },
  formCard: {
    marginBottom: 24,
  },
  hero: {
    backgroundColor: '#071421',
    paddingBottom: 72,
    paddingHorizontal: 18,
  },
  heroBackButton: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginTop: 24,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroHeaderSpacer: {
    width: 40,
  },
  heroHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 320,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F5F6F8',
    borderColor: '#E5E7EB',
    borderRadius: 14,
    borderWidth: 1,
    color: '#171A1F',
    fontSize: 15,
    marginTop: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  noticeBox: {
    backgroundColor: '#FFF7E8',
    borderRadius: 18,
    gap: 5,
    marginBottom: 24,
    padding: 14,
  },
  noticeText: {
    color: '#7C5A13',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  noticeTitle: {
    color: '#5C3D00',
    fontSize: 14,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 28,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 58,
  },
  primaryButtonText: {
    color: '#071421',
    fontSize: 15,
    fontWeight: '900',
  },
  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    marginHorizontal: 16,
    marginTop: -48,
    padding: 20,
    shadowColor: '#071421',
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
  },
  receiptTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 16,
    textAlign: 'center',
  },
  reviewBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    gap: 2,
    marginTop: 12,
    padding: 12,
  },
  reviewBoxText: {
    color: '#6C757D',
    fontSize: 12,
  },
  reviewBoxTitle: {
    color: '#343A40',
    fontSize: 14,
    fontWeight: '700',
  },
  root: {
    backgroundColor: '#F4F5F7',
    flex: 1,
  },
});
"""

with open('SendScreen.tsx', 'w') as f:
    f.write(content)

