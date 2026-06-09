import React from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
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

export function ReceiveScreen({
  onBack,
  wallet,
}: {
  onBack: () => void;
  wallet: WalletState;
}) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const assets = getModernAssets(wallet.balances, wallet.visibleAssets);
  const address = wallet.wallet?.address || '';
  const canOpenExplorer =
    Boolean(wallet.explorerAddressUrl) &&
    (!wallet.isMainnet || wallet.walletActive);

  async function shareAddress() {
    if (!address) {
      return;
    }

    await Share.share({
      message: address,
      title: 'Stellar wallet address',
    });
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
            ? 'Use this address to deposit real XLM or tokens on Stellar Mainnet.'
            : 'Use this address to receive test tokens on Stellar Testnet.'
        }
        title="Receive"
      />

      <View style={modern.sectionCard}>
        <View style={modern.qrCard}>
          {address ? (
            <QRCode
              data={address}
              padding={16}
              pieceSize={7}
              color={'#0F8EA3'}
              backgroundColor={'#FFFFFF'}
            />
          ) : (
            <>
              <Text style={modern.qrTinyText}>STELLAR</Text>
              <Ionicons color="#0F8EA3" name="qr-code" size={62} />
              <Text style={modern.qrTinyText}>No address</Text>
            </>
          )}
        </View>
        <SectionHeader title="Wallet address" />
        {wallet.isMainnet && !wallet.walletActive ? (
          <View style={modern.reviewModernBox}>
            <Text style={modern.reviewModernTitle}>Activate wallet</Text>
            <Text style={modern.reviewModernText}>
              Deposit XLM to start using this Mainnet wallet. Stellar creates
              the account on ledger after the first XLM deposit.
            </Text>
          </View>
        ) : null}
        <View style={modern.infoBlock}>
          <Text selectable style={modern.infoValue}>
            {address || 'No wallet yet'}
          </Text>
        </View>
        {wallet.isMainnet ? (
          <Text style={modern.emptyModernText}>
            If you deposit from an exchange, check that exchange's memo
            instructions. Personal wallet deposits usually only need the
            address.
          </Text>
        ) : null}
        <View style={modern.walletButtons}>
          <PressScale
            disabled={!address}
            onPress={shareAddress}
            style={modern.primaryModernButton}
          >
            <Text style={modern.modernButtonText}>Share address</Text>
          </PressScale>
          <PressScale
            disabled={!canOpenExplorer}
            onPress={() => wallet.openUrl(wallet.explorerAddressUrl)}
            style={modern.secondaryModernButton}
          >
            <Text
              style={[modern.modernButtonText, modern.secondaryModernButtonText]}
            >
              Explorer
            </Text>
          </PressScale>
        </View>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Receivable assets" />
        {assets.map(asset => {
          const needsTrustline = !asset.isNative && !asset.trusted;
          const canReceive = !needsTrustline;
          const enableDisabled =
            wallet.isBusy || (wallet.isMainnet && !wallet.walletActive);

          return (
            <View
              key={`${asset.assetCode}:${asset.assetIssuer || 'native'}`}
              style={modern.faucetRow}
            >
              <TokenIcon assetCode={asset.assetCode} imageUrl={asset.image} />
              <View style={modern.assetModernBody}>
                <Text style={modern.assetModernName}>{asset.assetCode}</Text>
                <Text style={modern.assetModernMeta}>
                  {canReceive
                    ? `Ready to receive · ${formatTokenAmount(asset.balance, {
                        compact: true,
                      })}`
                    : wallet.isMainnet && !wallet.walletActive
                    ? 'Deposit XLM first, then enable receiving'
                    : 'Enable receiving before deposits'}
                </Text>
              </View>
              {needsTrustline ? (
                <PressScale
                  disabled={enableDisabled}
                  onPress={() =>
                    wallet.addTrustline(asset.assetCode, asset.assetIssuer)
                  }
                  style={modern.assetAddButton}
                >
                  <Text style={modern.assetButtonText}>Enable</Text>
                </PressScale>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
