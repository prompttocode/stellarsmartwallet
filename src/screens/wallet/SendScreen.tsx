import React, { useState, useEffect } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ReactNativeBiometrics from 'react-native-biometrics';
import Toast from 'react-native-toast-message';
import { InfoLine } from '../../components/WalletPrimitives';
import {
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  TokenPillSelector,
  modern,
} from '../../components/wallet/ModernWalletUI';
import type { WalletDemoState } from '../../hooks/useWalletDemo';
import type { SendResult } from '../../types';
import { shortAddress } from '../../utils/format';

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
  wallet: WalletDemoState;
}) {
  const [step, setStep] = useState<SendStep>('compose');
  const [lastResult, setLastResult] = useState<SendResult | null>(null);
  const { setRecipient } = wallet;

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
          promptMessage: 'Xác thực để gửi giao dịch',
          cancelButtonText: 'Hủy'
        });
        
        if (!success) {
          Toast.show({ type: 'error', text1: 'Xác thực thất bại', text2: 'Không thể gửi giao dịch' });
          return;
        }
      } catch {
        Toast.show({ type: 'error', text1: 'Lỗi xác thực', text2: 'Vui lòng thử lại' });
        return;
      }
    }

    const result = await wallet.sendAsset();

    if (result) {
      setLastResult(result);
      setStep('success');
      Toast.show({ type: 'success', text1: 'Giao dịch thành công!' });
    } else {
      Toast.show({ type: 'error', text1: 'Giao dịch thất bại', text2: wallet.message });
    }
  }

  if (step === 'success' && lastResult) {
    return (
      <ScrollView
        contentContainerStyle={modern.screenInset}
        showsVerticalScrollIndicator={false}
      >
        <ModernScreenHeader
          onBack={onBack}
          subtitle={`Giao dịch đã gửi lên Stellar ${
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
            {wallet.amount} {lastResult.assetCode} → {recipientLabel}
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
              style={[modern.modernButtonText, modern.secondaryModernButtonText]}
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
        contentContainerStyle={modern.screenInset}
        showsVerticalScrollIndicator={false}
      >
        <ModernScreenHeader
          onBack={() => setStep('compose')}
          subtitle={
            wallet.isMainnet
              ? 'Kiểm tra kỹ. Mainnet transaction là giao dịch thật.'
              : 'Kiểm tra kỹ trước khi gửi token test.'
          }
          title="Review payment"
        />
        <View style={modern.sectionCard}>
          <SectionHeader title="Payment details" />
          <InfoLine
            label="Network"
            value={wallet.isMainnet ? 'Mainnet · real assets' : 'Testnet · demo only'}
          />
          <InfoLine
            label="Amount"
            value={`${wallet.amount || '0'} ${wallet.selectedAssetCode}`}
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
              ? 'Mainnet transaction là giao dịch thật. App sẽ yêu cầu biometric trước khi ký bằng Privy.'
              : 'Sau khi bấm Send, giao dịch test sẽ được gửi thật lên Stellar Testnet.'}
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
    <ScrollView
      contentContainerStyle={modern.screenInset}
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader
        onBack={onBack}
        subtitle={
          wallet.isMainnet
            ? 'Gửi/withdraw token thật qua Stellar Mainnet.'
            : 'Gửi XLM, USDC hoặc USDT demo qua Stellar Testnet.'
        }
        title="Send"
      />

      {!wallet.walletCanSign ? (
        <View style={modern.sectionCard}>
          <Text style={modern.emptyModernTitle}>Watch-only wallet</Text>
          <Text style={modern.emptyModernText}>
            Ví này chỉ xem được balance/QR, không thể ký send/swap/export.
          </Text>
        </View>
      ) : null}

      {wallet.isMainnet && !wallet.walletActive ? (
        <View style={modern.sectionCard}>
          <Text style={modern.emptyModernTitle}>Wallet inactive</Text>
          <Text style={modern.emptyModernText}>
            Deposit XLM thật vào ví trước khi gửi giao dịch mainnet.
          </Text>
        </View>
      ) : null}

      <View style={modern.formCard}>
        <SectionHeader title="Asset" />
        <TokenPillSelector
          assets={wallet.visibleAssets}
          onSelect={wallet.setSelectedAssetCode}
          selectedAssetCode={wallet.selectedAssetCode}
        />
        <Text style={modern.emptyModernText}>
          Available: {wallet.selectedBalance?.balance || '0'}{' '}
          {wallet.selectedAssetCode}
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
        {!wallet.isMainnet ? (
          <PressScale
            disabled={wallet.isBusy}
            onPress={wallet.createDemoReceiver}
            style={modern.secondaryModernButton}
          >
            <Text
              style={[modern.modernButtonText, modern.secondaryModernButtonText]}
            >
              Create demo receiver
            </Text>
          </PressScale>
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
  );
}
