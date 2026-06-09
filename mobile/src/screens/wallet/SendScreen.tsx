import React, { useState, useEffect } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ReactNativeBiometrics from 'react-native-biometrics';
import {
  AssetPickerModal,
  AssetSelectButton,
  getModernAssets,
  InfoLine,
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  modern,
  useSafeScreenInsetStyle,
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
  const screenInsetStyle = useSafeScreenInsetStyle();
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
          promptMessage: 'Confirm to send this transaction',
          cancelButtonText: 'Cancel',
        });

        if (!success) {
          Alert.alert('Authentication failed', 'Could not send the transaction.');
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

  if (step === 'success' && lastResult) {
    return (
      <ScrollView
        contentContainerStyle={screenInsetStyle}
        showsVerticalScrollIndicator={false}
      >
        <ModernScreenHeader
          onBack={onBack}
          subtitle={`Transaction submitted to Stellar ${
            wallet.network === 'mainnet' ? 'Mainnet' : 'Testnet'
          }.`}
          title="Payment sent"
        />
        <View style={modern.sectionCard}>
          <View style={modern.successOrb}>
            <Ionicons color="#0ABF73" name="checkmark" size={42} />
          </View>
          <Text style={modern.successModernTitle}>Payment sent</Text>
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
            <Text
              style={[
                modern.modernButtonText,
                modern.secondaryModernButtonText,
              ]}
            >
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
        contentContainerStyle={screenInsetStyle}
        showsVerticalScrollIndicator={false}
      >
        <ModernScreenHeader
          onBack={() => setStep('compose')}
          subtitle={
            wallet.isMainnet
              ? 'Review carefully. Mainnet transactions move real assets.'
              : 'Review carefully before sending test tokens.'
          }
          title="Review payment"
        />
        <View style={modern.sectionCard}>
          <SectionHeader title="Payment details" />
          <InfoLine
            label="Network"
            value={
              wallet.isMainnet ? 'Mainnet · real assets' : 'Testnet · demo only'
            }
          />
          <InfoLine
            label="Amount"
            value={`${formatTokenAmount(wallet.amount || '0')} ${wallet.selectedAssetCode}`}
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
            style={modern.primaryModernButton}
          >
            <Text style={modern.modernButtonText}>
              {wallet.busy ||
                (wallet.isMainnet ? 'Confirm with biometric' : 'Send')}
            </Text>
          </PressScale>
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={screenInsetStyle}
        showsVerticalScrollIndicator={false}
      >
        <ModernScreenHeader
          onBack={onBack}
          subtitle={
            wallet.isMainnet
              ? 'Send or withdraw real tokens on Stellar Mainnet.'
              : 'Send Stellar Testnet XLM or Payment API USDC.'
          }
          title="Send"
        />

      {!wallet.walletCanSign ? (
        <View style={modern.sectionCard}>
          <Text style={modern.emptyModernTitle}>Watch-only wallet</Text>
          <Text style={modern.emptyModernText}>
            This wallet can only view balances and QR codes. It cannot sign
            sends, swaps, or exports.
          </Text>
        </View>
      ) : null}

      {wallet.isMainnet && !wallet.walletActive ? (
        <View style={modern.sectionCard}>
          <Text style={modern.emptyModernTitle}>Wallet inactive</Text>
          <Text style={modern.emptyModernText}>
            Deposit real XLM into this wallet before sending Mainnet
            transactions.
          </Text>
        </View>
      ) : null}

        <View style={modern.formCard}>
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
          <Text style={modern.emptyModernText}>
            Search and choose from available Stellar assets without stretching
            this form.
          </Text>
        </View>

      <View style={modern.formCard}>
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
          style={modern.modernInput}
          value={wallet.recipient}
        />
        {wallet.recipientContact ? (
          <View style={modern.reviewModernBox}>
            <Text style={modern.reviewModernTitle}>
              {wallet.recipientContact.label}
            </Text>
            <Text style={modern.reviewModernText}>
              {shortAddress(wallet.recipientContact.wallet.address)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={modern.formCard}>
        <SectionHeader title="Amount" />
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={wallet.setAmount}
          placeholder="1"
          placeholderTextColor="#A7B3BA"
          style={modern.modernInput}
          value={wallet.amount}
        />
        <PressScale
          disabled={wallet.isBusy || !canSubmit}
          onPress={() => setStep('review')}
          style={modern.primaryModernButton}
        >
          <Text style={modern.modernButtonText}>Review payment</Text>
        </PressScale>
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
