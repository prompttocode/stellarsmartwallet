import React from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import Ionicons from 'react-native-vector-icons/Ionicons';
import QRCode from 'react-native-qrcode-styled';
import {
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  TokenIcon,
  getModernAssets,
  modern,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import type { WalletState } from '@hooks/useWallet';
import { formatTokenAmount } from '@utils/format';

export function FaucetScreen({
  onBack,
  onGoToRamp,
  wallet,
}: {
  onBack: () => void;
  onGoToRamp: () => void;
  wallet: WalletState;
}) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const insets = useSafeAreaInsets();
  const assets = getModernAssets(wallet.balances, wallet.visibleAssets);
  const address = wallet.wallet?.address || '';
  const networkLabel = wallet.isMainnet ? 'Mainnet' : 'Testnet';
  const canOpenExplorer =
    Boolean(wallet.explorerAddressUrl) &&
    (!wallet.isMainnet || wallet.walletActive);

  async function shareDepositAddress() {
    if (address) {
      await Share.share({
        message: address,
        title: 'Stellar deposit address',
      });
    }
  }

  function copyAddress() {
    if (!address) return;
    Clipboard.setString(address);
    Alert.alert('Copied', 'Wallet address copied to clipboard.');
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
      style={styles.root}
      showsVerticalScrollIndicator={false}
    >
      
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <PressScale onPress={onBack} style={styles.heroBackButton}>
            <Ionicons color="#FFFFFF" name="chevron-back" size={24} />
          </PressScale>
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>Funding</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.heroEyebrow}>STELLAR WALLET</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>
          {
          wallet.isMainnet
            ? 'Deposit assets or use VND orders for real XLM and USDC.'
            : 'Free XLM is for wallet testing. Orders test the payment flow.'
        }
        </Text>
        <Text style={styles.heroSubtitle}>{
          wallet.isMainnet
            ? 'Deposit assets or use VND orders for real XLM and USDC.'
            : 'Free XLM is for wallet testing. Orders test the payment flow.'
        }</Text>
      </View>

      <View style={[styles.receiptCard, styles.heroCard]}>
        <View style={styles.cardTopRow}>
          <View style={styles.heroIcon}>
            <Ionicons color="#0ABF73" name="card" size={26} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={styles.cardEyebrow}>{networkLabel} orders</Text>
            <Text style={styles.cardTitle}>Buy with VND</Text>
            <Text style={styles.cardText}>
              {wallet.isMainnet
                ? 'Buy XLM or USDC with a bank transfer. Withdraw is available from Home.'
                : 'Test the same buy flow as Mainnet with Testnet assets.'}
            </Text>
          </View>
        </View>
        <PressScale
          disabled={!wallet.wallet}
          onPress={onGoToRamp}
          style={[styles.primaryButton, styles.fullButton]}
        >
          <Text style={styles.primaryButtonText}>Buy with VND</Text>
        </PressScale>
      </View>

      {!wallet.isMainnet ? (
        <View style={styles.receiptCardBottom}>
          <View style={styles.cardTopRow}>
            <View style={[styles.smallIcon, styles.testnetIcon]}>
              <Ionicons color="#3867D6" name="flash" size={22} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>Free Testnet XLM</Text>
              <Text style={styles.cardText}>
                Use Friendbot to activate the wallet and pay Testnet fees. This
                does not test the VND order flow.
              </Text>
            </View>
          </View>
          <PressScale
            disabled={!wallet.wallet || wallet.isBusy}
            onPress={wallet.fundWallet}
            style={[styles.secondaryButton, styles.fullButton]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                styles.secondaryButtonText,
              ]}
            >
              Get free Testnet XLM
            </Text>
          </PressScale>
        </View>
      ) : null}

      <View style={styles.receiptCardBottom}>
        <Text style={styles.localSectionTitle}>{"Wallet address" }</Text>
        <View style={styles.addressCopy}>
          <Text style={styles.cardText}>
            {wallet.isMainnet
              ? 'Send XLM or enabled Stellar assets to this wallet.'
              : 'Use this address for Testnet sends, receives, and order deposits.'}
          </Text>
        </View>
        <View style={styles.qrWrapper}>
          {address ? (
            <QRCode
              backgroundColor="#FFFFFF"
              color="#000000"
              data={address}
              padding={14}
              pieceSize={6}
            />
          ) : (
            <Ionicons color="#9AA7AE" name="qr-code" size={52} />
          )}
        </View>
        <View style={styles.addressBox}>
          <Text numberOfLines={2} selectable style={styles.addressText}>
            {address || 'Create a wallet first'}
          </Text>
        </View>
        <View style={styles.actionRow}>
          <View style={styles.outlineButtonSlot}>
            <PressScale
              disabled={!address}
              onPress={copyAddress}
              style={[
                styles.outlineButton,
                styles.primaryOutlineButton,
                !address ? styles.disabledButton : null,
              ]}
            >
              <Text style={styles.outlineButtonText}>Copy</Text>
            </PressScale>
          </View>
          <View style={styles.outlineButtonSlot}>
            <PressScale
              disabled={!canOpenExplorer}
              onPress={() => wallet.openUrl(wallet.explorerAddressUrl)}
              style={[styles.outlineButton, !canOpenExplorer ? styles.disabledButton : null]}
            >
              <Ionicons color="#071421" name="open-outline" size={18} />
              <Text style={styles.outlineButtonText}>Explorer</Text>
            </PressScale>
          </View>
        </View>
      </View>

      <View style={styles.receiptCardBottom}>
        <Text style={styles.localSectionTitle}>{"Supported assets" }</Text>
        {assets.map(asset => {
          const needsTrustline = !asset.isNative && !asset.trusted;
          const isXlm = asset.isNative;
          const actionLabel = isXlm
            ? wallet.isMainnet
              ? 'Explorer'
              : 'Faucet'
            : needsTrustline
            ? 'Enable'
            : 'Buy';
          const assetText = isXlm
            ? wallet.isMainnet
              ? 'Native Stellar asset. Deposit real XLM to activate Mainnet.'
              : 'Native Testnet asset. Friendbot can fund this for free.'
            : needsTrustline
            ? 'Enable the trustline before receiving this asset.'
            : wallet.isMainnet
            ? 'Enabled for deposits and VND orders.'
            : 'Enabled for Testnet orders and Stellar transfers.';
          const disabled =
            wallet.isBusy ||
            (isXlm
              ? wallet.isMainnet
                ? !canOpenExplorer
                : !wallet.wallet
              : wallet.isMainnet && needsTrustline
              ? !wallet.walletActive
              : !wallet.walletActive);

          return (
            <View
              key={`${asset.assetCode}:${asset.assetIssuer || 'native'}`}
              style={styles.assetRow}
            >
              <View style={styles.assetLeft}>
                <TokenIcon assetCode={asset.assetCode} imageUrl={asset.image} />
                <View style={styles.assetBodyLocal}>
                  <View style={styles.assetTitleRow}>
                    <Text style={styles.assetNameLocal}>
                      {asset.assetCode}
                    </Text>
                    <View
                      style={[
                        styles.assetPill,
                        needsTrustline ? styles.warningPill : styles.readyPill,
                      ]}
                    >
                      <Text
                        style={[
                          styles.assetPillText,
                          needsTrustline
                            ? styles.warningPillText
                            : styles.readyPillText,
                        ]}
                      >
                        {needsTrustline ? 'Needs setup' : 'Ready'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.assetBalance}>
                    {formatTokenAmount(asset.balance, { compact: true })}{' '}
                    {asset.assetCode}
                  </Text>
                  <Text style={styles.assetMetaLocal}>{assetText}</Text>
                </View>
              </View>
              <PressScale
                disabled={disabled}
                onPress={() => {
                  if (isXlm) {
                    if (wallet.isMainnet) {
                      wallet.openUrl(wallet.explorerAddressUrl);
                    } else {
                      wallet.fundWallet();
                    }
                  } else if (needsTrustline) {
                    wallet.addTrustline(asset.assetCode, asset.assetIssuer);
                  } else {
                    onGoToRamp();
                  }
                }}
                style={
                  needsTrustline
                    ? [styles.enableButton, styles.assetButton]
                    : [styles.faucetButton, styles.assetButton]
                }
              >
                <Text style={styles.assetButtonText}>{actionLabel}</Text>
              </PressScale>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  localSectionTitle: { color: '#111827', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  assetBodyLocal: { flex: 1, gap: 3 },
  assetNameLocal: { color: '#111827', fontSize: 15, fontWeight: '900' },
  assetMetaLocal: { color: '#7D8795', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  enableButton: { alignItems: 'center', backgroundColor: '#111827', borderRadius: 17, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 9 },
  faucetButton: { alignItems: 'center', backgroundColor: '#EEF4FF', borderRadius: 17, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 9 },
  assetButtonText: { color: '#111827', fontSize: 12, fontWeight: '900' },

  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 28,
    justifyContent: 'center',
    minHeight: 58,
  },
  primaryButtonText: {
    color: '#071421',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 28,
    justifyContent: 'center',
    minHeight: 58,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
  },

  root: {
    backgroundColor: '#F4F5F7',
  },
  content: {
    backgroundColor: '#F4F5F7',
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
  heroSubtitle: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 320,
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
  receiptCardBottom: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  addressBox: {
    backgroundColor: '#F4F8FA',
    borderColor: '#E2EBEF',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addressCopy: {
    gap: 8,
    marginBottom: 4,
  },
  addressText: {
    color: '#24495A',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    textAlign: 'center',
  },
  assetBalance: {
    color: '#17233D',
    fontSize: 14,
    fontWeight: '900',
  },
  assetButton: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    minWidth: 86,
  },
  assetLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  assetPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  assetPillText: {
    fontSize: 10,
    fontWeight: '900',
  },
  assetRow: {
    backgroundColor: '#F8FBFC',
    borderColor: '#E8EEF8',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  assetTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  cardCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  cardEyebrow: {
    color: '#0ABF73',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cardText: {
    color: '#72838F',
    fontSize: 13,
    lineHeight: 18,
  },
  cardTitle: {
    color: '#24495A',
    fontSize: 17,
    fontWeight: '900',
  },
  cardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  primaryOutlineButton: {
    backgroundColor: '#B8FF45',
    borderColor: '#B8FF45',
  },
  disabledButton: {
    opacity: 0.45,
  },
  qrWrapper: {
    alignItems: 'center',
    marginVertical: 12,
  },
  fullButton: {
    marginTop: 10,
  },
  heroCard: {
    backgroundColor: '#F0FFF8',
    borderColor: '#C6F3DE',
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#C6F3DE',
    borderRadius: 24,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    shadowColor: '#0ABF73',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    width: 52,
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: '#071421',
    borderRadius: 25,
    borderWidth: 1.4,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 52,
  },
  outlineButtonSlot: {
    flex: 1,
  },
  outlineButtonText: {
    color: '#071421',
    fontSize: 14,
    fontWeight: '900',
  },
  readyPill: {
    backgroundColor: '#E7F9F1',
  },
  readyPillText: {
    color: '#0ABF73',
  },
  smallIcon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  splitButton: {
    flex: 1,
  },
  testnetIcon: {
    backgroundColor: '#EEF4FF',
  },
  warningPill: {
    backgroundColor: '#FFF5E7',
  },
  warningPillText: {
    color: '#A86200',
  },
});
