import React from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
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

  return (
    <ScrollView
      contentContainerStyle={screenInsetStyle}
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader
        onBack={onBack}
        subtitle={
          wallet.isMainnet
            ? 'Deposit assets or use VND orders for real XLM and USDC.'
            : 'Free XLM is for wallet testing. Orders test the payment flow.'
        }
        title={wallet.isMainnet ? 'Deposit' : 'Faucet & Deposit'}
      />

      <View style={[modern.sectionCard, styles.heroCard]}>
        <View style={styles.cardTopRow}>
          <View style={styles.heroIcon}>
            <Ionicons color="#0ABF73" name="card" size={26} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={styles.cardEyebrow}>{networkLabel} orders</Text>
            <Text style={styles.cardTitle}>Buy or sell with VND</Text>
            <Text style={styles.cardText}>
              {wallet.isMainnet
                ? 'Create real payment orders for XLM and USDC.'
                : 'Use the same order flow as Mainnet with Testnet assets.'}
            </Text>
          </View>
        </View>
        <PressScale
          disabled={!wallet.wallet}
          onPress={onGoToRamp}
          style={[modern.primaryModernButton, styles.fullButton]}
        >
          <Text style={modern.modernButtonText}>Open Buy/Sell orders</Text>
        </PressScale>
      </View>

      {!wallet.isMainnet ? (
        <View style={modern.sectionCard}>
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
            style={[modern.secondaryModernButton, styles.fullButton]}
          >
            <Text
              style={[
                modern.modernButtonText,
                modern.secondaryModernButtonText,
              ]}
            >
              Get free Testnet XLM
            </Text>
          </PressScale>
        </View>
      ) : null}

      <View style={modern.sectionCard}>
        <SectionHeader title="Wallet address" />
        <View style={styles.addressCopy}>
          <Text style={styles.cardTitle}>
            {wallet.isMainnet ? 'Deposit address' : 'Testnet address'}
          </Text>
          <Text style={styles.cardText}>
            {wallet.isMainnet
              ? 'Send XLM or enabled Stellar assets to this wallet.'
              : 'Use this address for Testnet sends, receives, and order deposits.'}
          </Text>
        </View>
        <View style={[modern.qrCard, styles.compactQrCard]}>
          {address ? (
            <QRCode
              backgroundColor="#FFFFFF"
              color="#0F8EA3"
              data={address}
              padding={14}
              pieceSize={6}
            />
          ) : (
            <Ionicons color="#9AA7AE" name="qr-code" size={52} />
          )}
        </View>
        <View style={styles.addressBox}>
          <Text
            numberOfLines={2}
            selectable
            style={styles.addressText}
          >
            {address || 'Create a wallet first'}
          </Text>
        </View>
        <View style={modern.walletButtons}>
          <PressScale
            disabled={!address}
            onPress={shareDepositAddress}
            style={[modern.primaryModernButton, styles.splitButton]}
          >
            <Text style={modern.modernButtonText}>Share</Text>
          </PressScale>
          <PressScale
            disabled={!canOpenExplorer}
            onPress={() => wallet.openUrl(wallet.explorerAddressUrl)}
            style={[modern.secondaryModernButton, styles.splitButton]}
          >
            <Text
              style={[
                modern.modernButtonText,
                modern.secondaryModernButtonText,
              ]}
            >
              Explorer
            </Text>
          </PressScale>
        </View>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Supported assets" />
        {assets.map(asset => {
          const needsTrustline = !asset.isNative && !asset.trusted;
          const isXlm = asset.isNative;
          const actionLabel = isXlm
            ? wallet.isMainnet
              ? 'Explorer'
              : 'Faucet'
            : needsTrustline
            ? 'Enable'
            : 'Buy/Sell';
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
                <View style={modern.assetModernBody}>
                  <View style={styles.assetTitleRow}>
                    <Text style={modern.assetModernName}>
                      {asset.assetCode}
                    </Text>
                    <View
                      style={[
                        styles.assetPill,
                        needsTrustline
                          ? styles.warningPill
                          : styles.readyPill,
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
                  <Text style={modern.assetModernMeta}>{assetText}</Text>
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
                    ? [modern.assetAddButton, styles.assetButton]
                    : [modern.assetFaucetButton, styles.assetButton]
                }
              >
                <Text style={modern.assetButtonText}>{actionLabel}</Text>
              </PressScale>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  },
  addressText: {
    color: '#24495A',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
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
  compactQrCard: {
    height: 190,
    marginVertical: 8,
    width: '100%',
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
