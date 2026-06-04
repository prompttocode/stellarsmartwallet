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
} from '../../components/wallet/ModernWalletUI';
import type { WalletDemoState } from '../../hooks/useWalletDemo';

export function TopUpScreen({
  onBack,
  wallet,
}: {
  onBack: () => void;
  wallet: WalletDemoState;
}) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const assets = getModernAssets(wallet.balances, wallet.visibleAssets);
  const address = wallet.wallet?.address || '';
  const canOpenExplorer =
    Boolean(wallet.explorerAddressUrl) &&
    (!wallet.isMainnet || wallet.walletActive);

  async function shareDepositAddress() {
    if (!address) {
      return;
    }

    await Share.share({
      message: address,
      title: 'Stellar deposit address',
    });
  }

  function handleTopUp(assetCode: string) {
    if (assetCode === 'XLM') {
      wallet.fundWallet();
      return;
    }

    wallet.fundDemoAsset(assetCode);
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
            ? 'Deposit XLM thật on-chain để active ví. Fiat on/off-ramp chờ provider API.'
            : 'Nạp token test để demo luồng ví. Đây không phải tiền thật.'
        }
        title={wallet.isMainnet ? 'Deposit' : 'Buy / Faucet'}
      />

      {wallet.isMainnet ? (
        <View style={modern.sectionCard}>
          <SectionHeader title="Deposit XLM" />
          <Text style={modern.emptyModernText}>
            Dùng QR hoặc address bên dưới để nạp XLM thật và active ví mainnet.
          </Text>
          {!wallet.walletActive ? (
            <View style={modern.reviewModernBox}>
              <Text style={modern.reviewModernTitle}>Activate wallet</Text>
              <Text style={modern.reviewModernText}>
                Deposit XLM to start using this Mainnet wallet. Explorer sẽ mở
                được sau khi ví nhận XLM đầu tiên.
              </Text>
            </View>
          ) : null}
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
          <View style={modern.infoBlock}>
            <Text selectable style={modern.infoValue}>
              {address || 'Chưa có ví'}
            </Text>
          </View>
          <View style={modern.walletButtons}>
            <PressScale
              disabled={!address}
              onPress={shareDepositAddress}
              style={modern.primaryModernButton}
            >
              <Text style={modern.modernButtonText}>Share deposit address</Text>
            </PressScale>
            <PressScale
              disabled={!canOpenExplorer}
              onPress={() => wallet.openUrl(wallet.explorerAddressUrl)}
              style={modern.secondaryModernButton}
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
      ) : null}

      {wallet.isMainnet ? (
        <View style={modern.sectionCard}>
          <SectionHeader title="Buy with fiat" />
          <View style={modern.disabledActionRow}>
            <Ionicons color="#8A9AA3" name="card" size={28} />
            <View style={modern.assetModernBody}>
              <Text style={modern.assetModernName}>Buy with fiat</Text>
              <Text style={modern.assetModernMeta}>
                Coming soon · provider not configured
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={modern.sectionCard}>
        <SectionHeader title={wallet.isMainnet ? 'Assets' : 'Choose asset'} />
        {assets.map(asset => {
          const canTopUp = asset.isNative || asset.trusted;

          return (
            <View
              key={`${asset.assetCode}:${asset.assetIssuer || 'native'}`}
              style={modern.topUpRow}
            >
              <TokenIcon assetCode={asset.assetCode} />
              <View style={modern.assetModernBody}>
                <Text style={modern.assetModernName}>{asset.assetCode}</Text>
                <Text style={modern.assetModernMeta}>
                  {canTopUp
                    ? wallet.isMainnet
                      ? `Current balance ${asset.balance}`
                      : `Current balance ${asset.balance}`
                    : 'Add trustline before faucet'}
                </Text>
              </View>
              <PressScale
                disabled={wallet.isBusy || (wallet.isMainnet && !canOpenExplorer)}
                onPress={() =>
                  wallet.isMainnet
                    ? wallet.openUrl(wallet.explorerAddressUrl)
                    : canTopUp
                    ? handleTopUp(asset.assetCode)
                    : wallet.addTrustline(asset.assetCode)
                }
                style={
                  canTopUp ? modern.assetTopUpButton : modern.assetAddButton
                }
              >
                <Text style={modern.assetButtonText}>
                  {wallet.isMainnet
                    ? wallet.walletActive
                      ? 'Explorer'
                      : 'Inactive'
                    : canTopUp
                    ? 'Faucet'
                    : 'Add'}
                </Text>
              </PressScale>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
