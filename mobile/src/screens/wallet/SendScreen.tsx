import React, { useState, useEffect } from 'react';
import { ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ReactNativeBiometrics from 'react-native-biometrics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppPopup } from '@components/common/AppPopup';
import {
  AssetPickerModal,
  getModernAssets,
  InfoLine,
  PressScale,
  modern,
} from '@components/wallet';
import type { WalletState } from '@hooks/useWallet';
import type { SendResult } from '@app-types';
import { formatDate, formatTokenAmount, shortAddress } from '@utils/format';
import {
  getAvailableAmount,
  isLikelyStellarPublicKey,
  validateStellarAmount,
} from '@utils/walletValidation';

type SendStep = 'compose' | 'review' | 'success';

import { TokenIcon } from '@components/wallet';

function LocalSectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

function LocalAssetSelectButton({ asset, label, onPress, valueLabel }: any) {
  return (
    <PressScale onPress={onPress} style={styles.assetSelectButton}>
      <TokenIcon assetCode={asset?.assetCode} imageUrl={asset?.image} size={42} />
      <View style={styles.assetSelectCopy}>
        <Text style={styles.assetSelectLabel}>{label}</Text>
        <Text style={styles.assetSelectTitle}>{asset?.assetCode || 'Select'}</Text>
        <Text style={styles.assetSelectSubtitle}>
          {asset?.assetIssuer ? 'Custom asset' : 'Lumens'} · Balance {valueLabel.split(' ')[0]}
        </Text>
      </View>
      <View style={styles.assetSelectTrailing}>
        <Text style={styles.assetSelectValue}>{valueLabel}</Text>
        <Text style={styles.assetSelectFiat}>≈ $0.00</Text>
        <Ionicons color="#6C757D" name="chevron-down" size={16} style={{ alignSelf: 'flex-end', marginTop: 4 }} />
      </View>
    </PressScale>
  );
}

function DetailRow({
  isLast,
  label,
  value,
  withCopyIcon,
}: {
  isLast?: boolean;
  label: string;
  value: string;
  withCopyIcon?: boolean;
}) {
  return (
    <View style={[styles.txDetailRow, isLast ? styles.txDetailRowLast : null]}>
      <Text style={styles.txDetailLabel}>{label}</Text>
      <View style={styles.txDetailValueWrap}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          numberOfLines={1}
          style={styles.txDetailValue}
        >
          {value}
        </Text>
        {withCopyIcon ? (
          <Ionicons color="#8C948D" name="copy-outline" size={12} />
        ) : null}
      </View>
    </View>
  );
}

function getTransferType(operation: SendResult['operation']) {
  if (operation === 'create_account') {
    return 'Create Account';
  }

  if (operation === 'path_payment_strict_send') {
    return 'Swap Payment';
  }

  return 'Send Token';
}

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
  const { showPopup } = useAppPopup();
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
  const recipientValue = wallet.recipient.trim();
  const recipientValid = isLikelyStellarPublicKey(recipientValue);
  const sendAmountValidation = validateStellarAmount(wallet.amount);
  const availableSendAmount = getAvailableAmount(
    wallet.selectedBalance,
    selectedAsset?.balance,
  );
  const exceedsSendBalance =
    sendAmountValidation.valid &&
    sendAmountValidation.amount > availableSendAmount;
  const sendFormWarning = wallet.amount.trim() && !sendAmountValidation.valid
    ? sendAmountValidation.message
    : recipientValue && !recipientValid
    ? 'Enter a valid Stellar recipient address that starts with G.'
    : exceedsSendBalance
    ? selectedAsset?.isNative
      ? `You can send up to ${formatTokenAmount(
          String(availableSendAmount),
        )} XLM. Stellar keeps ${
          formatTokenAmount(
            wallet.selectedBalance?.reservedBalance ||
              wallet.selectedBalance?.minimumBalance ||
              '0',
          )
        } XLM reserved for account minimum balance and network fees.`
      : `You can send up to ${formatTokenAmount(
          String(availableSendAmount),
        )} ${wallet.selectedAssetCode}.`
    : null;
  const canSubmit =
    wallet.walletCanSign &&
    (!wallet.isMainnet || wallet.walletActive) &&
    sendAmountValidation.valid &&
    recipientValid &&
    !exceedsSendBalance;

  function startReview() {
    if (sendFormWarning) {
      showPopup({
        message: sendFormWarning,
        title: 'Transfer unavailable',
        variant: 'warning',
      });
      return;
    }

    setStep('review');
  }

  async function handleConfirmSend() {
    if (!canSubmit) {
      showPopup({
        message:
          sendFormWarning ||
          'Enter a valid recipient and amount before sending.',
        title: 'Transfer unavailable',
        variant: 'warning',
      });
      return;
    }

    const rnBiometrics = new ReactNativeBiometrics();
    const { available } = await rnBiometrics.isSensorAvailable();

    if (available) {
      try {
        const { success } = await rnBiometrics.simplePrompt({
          promptMessage: 'Confirm this transfer',
          cancelButtonText: 'Cancel',
        });

        if (!success) {
          showPopup({
            message: 'Could not send the transaction.',
            title: 'Authentication failed',
            variant: 'warning',
          });
          return;
        }
      } catch {
        showPopup({
          message: 'Please try again.',
          title: 'Authentication error',
          variant: 'danger',
        });
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

  async function shareLastTransaction() {
    if (!lastResult?.transaction.explorerUrl) {
      return;
    }

    await Share.share({
      message: lastResult.transaction.explorerUrl,
      url: lastResult.transaction.explorerUrl,
    });
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
    const transaction = lastResult.transaction;
    const networkName =
      wallet.network === 'mainnet' ? 'Stellar Mainnet' : 'Stellar Testnet';
    const amountText = `- ${formatTokenAmount(transaction.amount || wallet.amount)} ${
      lastResult.assetCode
    }`;
    const detailRows = [
      {
        label: 'Date & Time',
        value: formatDate(transaction.createdAt),
      },
      {
        label: 'Type',
        value: getTransferType(transaction.operation),
      },
      {
        label: 'From',
        value: shortAddress(transaction.from),
      },
      {
        label: 'To',
        value: shortAddress(transaction.to),
        withCopyIcon: true,
      },
      {
        label: 'Network',
        value: networkName,
      },
      {
        label: 'Network Fee',
        value: '0.00001 XLM',
      },
      {
        label: 'Transaction ID',
        value: shortAddress(transaction.hash),
        withCopyIcon: true,
      },
    ].filter(row => Boolean(row.value));

    return (
      <View style={[styles.txDetailRoot, { paddingTop: insets.top + 8 }]}>
        <View style={styles.txDetailHeader}>
          <PressScale
            onPress={() => setStep('compose')}
            style={styles.txHeaderIconButton}
          >
            <Ionicons color="#FFFFFF" name="arrow-back" size={20} />
          </PressScale>
          <Text style={styles.txHeaderTitle}>Transaction Details</Text>
          <PressScale
            onPress={shareLastTransaction}
            style={styles.txHeaderIconButton}
          >
            <Ionicons color="#FFFFFF" name="share-social-outline" size={18} />
          </PressScale>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.txDetailContent,
            { paddingBottom: insets.bottom + 104 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.txStatusIcon}>
            <Ionicons color="#B8FF45" name="arrow-up" size={24} />
          </View>
          <Text style={styles.txStatusText}>Transfer sent</Text>

          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}
            style={styles.txAmountText}
          >
            {amountText}
          </Text>

          <View style={styles.txCompletedBadge}>
            <View style={styles.txCompletedDot} />
            <Text style={styles.txCompletedText}>COMPLETED</Text>
          </View>

          <View style={styles.txDetailsCard}>
            {detailRows.map((row, index) => (
              <DetailRow
                key={row.label}
                label={row.label}
                value={row.value}
                withCopyIcon={row.withCopyIcon}
                isLast={index === detailRows.length - 1}
              />
            ))}
          </View>
        </ScrollView>

        <View style={[styles.txBottomAction, { paddingBottom: insets.bottom + 10 }]}>
          <PressScale
            onPress={() => wallet.openUrl(transaction.explorerUrl)}
            style={styles.txExpertButton}
          >
            <Text style={styles.txExpertButtonText}>View on Stellar Expert</Text>
            <Ionicons color="#071421" name="open-outline" size={14} />
          </PressScale>
        </View>
      </View>
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
          <LocalSectionHeader title="Transfer details" />
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
              <Text style={styles.noticeTitle}>
                {wallet.walletSessionSyncing
                  ? 'Wallet session syncing'
                  : 'Watch-only wallet'}
              </Text>
              <Text style={styles.noticeText}>
                {wallet.walletSessionSyncing
                  ? 'Your saved wallet is visible. Sending will be available when the secure server session finishes syncing.'
                  : 'This wallet can only view balances and QR codes. It cannot sign sends, swaps, or exports.'}
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
            <LocalSectionHeader title="Asset" />
            <LocalAssetSelectButton
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
            <LocalSectionHeader
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
            <LocalSectionHeader title="Amount" />
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={wallet.setAmount}
              placeholder="1"
              placeholderTextColor="#A7B3BA"
              style={styles.input}
              value={wallet.amount}
            />
            {sendFormWarning ? (
              <Text style={styles.warningText}>{sendFormWarning}</Text>
            ) : null}
            <PressScale
              disabled={wallet.isBusy || !canSubmit}
              onPress={startReview}
              style={[styles.primaryButton, (wallet.isBusy || !canSubmit) ? styles.disabledButton : null]}
            >
              <Text style={styles.primaryButtonText}>Review transfer</Text>
            </PressScale>
          </View>
        </View>
      </ScrollView>

      <AssetPickerModal
        assets={assets}
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
  assetSelectButton: {
    alignItems: 'center',
    backgroundColor: '#111318',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  assetSelectCopy: {
    flex: 1,
    gap: 2,
  },
  assetSelectLabel: {
    color: '#8A9099',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  assetSelectTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  assetSelectSubtitle: {
    color: '#8A9099',
    fontSize: 11,
    fontWeight: '600',
  },
  assetSelectTrailing: {
    alignItems: 'flex-end',
    gap: 2,
  },
  assetSelectValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  assetSelectFiat: {
    color: '#8A9099',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#172033',
    fontSize: 18,
    fontWeight: '900',
  },

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
  txAmountText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 8,
    textAlign: 'center',
  },
  txBottomAction: {
    backgroundColor: 'rgba(16,19,17,0.98)',
    bottom: 0,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
  },
  txCompletedBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(184,255,0,0.08)',
    borderColor: 'rgba(184,255,0,0.85)',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  txCompletedDot: {
    backgroundColor: '#B8FF00',
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  txCompletedText: {
    color: '#B8FF00',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  txDetailContent: {
    paddingHorizontal: 16,
    paddingTop: 28,
  },
  txDetailHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  txDetailLabel: {
    color: '#AEB7AD',
    fontSize: 12,
    fontWeight: '700',
  },
  txDetailRoot: {
    backgroundColor: '#101311',
    flex: 1,
  },
  txDetailRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingVertical: 4,
  },
  txDetailRowLast: {
    borderBottomWidth: 0,
  },
  txDetailValue: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  txDetailValueWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'flex-end',
    marginLeft: 16,
    minWidth: 0,
  },
  txDetailsCard: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  txExpertButton: {
    alignItems: 'center',
    backgroundColor: '#B8FF00',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 54,
  },
  txExpertButtonText: {
    color: '#071421',
    fontSize: 14,
    fontWeight: '900',
  },
  txHeaderIconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  txHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  txStatusIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(184,255,69,0.08)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  txStatusText: {
    color: '#AEB7AD',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'center',
  },
  warningText: {
    color: '#B96B00',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 10,
    textAlign: 'center',
  },
});
