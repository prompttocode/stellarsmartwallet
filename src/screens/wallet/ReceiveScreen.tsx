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
} from '../../components/wallet/ModernWalletUI';
import type { WalletDemoState } from '../../hooks/useWalletDemo';

export function ReceiveScreen({
  onBack,
  wallet,
}: {
  onBack: () => void;
  wallet: WalletDemoState;
}) {
  const assets = getModernAssets(wallet.balances, wallet.visibleAssets);
  const address = wallet.wallet?.address || '';

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
      contentContainerStyle={modern.screenInset}
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader
        onBack={onBack}
        subtitle="Dùng địa chỉ này để nhận token test trên Stellar Testnet."
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
        <View style={modern.infoBlock}>
          <Text selectable style={modern.infoValue}>
            {address || 'Chưa có ví'}
          </Text>
        </View>
        <View style={modern.walletButtons}>
          <PressScale
            disabled={!address}
            onPress={shareAddress}
            style={modern.primaryModernButton}
          >
            <Text style={modern.modernButtonText}>Share address</Text>
          </PressScale>
          <PressScale
            disabled={!wallet.explorerAddressUrl}
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
          const canReceive = asset.isNative || asset.trusted;

          return (
            <View key={asset.assetCode} style={modern.topUpRow}>
              <TokenIcon assetCode={asset.assetCode} />
              <View style={modern.assetModernBody}>
                <Text style={modern.assetModernName}>{asset.assetCode}</Text>
                <Text style={modern.assetModernMeta}>
                  {canReceive
                    ? `Ready to receive · ${asset.balance}`
                    : 'Add trustline before receiving'}
                </Text>
              </View>
              {!canReceive ? (
                <PressScale
                  disabled={wallet.isBusy}
                  onPress={() => wallet.addTrustline(asset.assetCode)}
                  style={modern.assetAddButton}
                >
                  <Text style={modern.assetButtonText}>Add</Text>
                </PressScale>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
