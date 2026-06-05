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

export function FaucetScreen({
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

  async function shareDepositAddress() {
    if (!address) {
      return;
    }

    await Share.share({
      message: address,
      title: 'Stellar deposit address',
    });
  }

  function handleFaucet(assetCode: string) {
    if (assetCode === 'XLM') {
      wallet.fundWallet();
      return;
    }

    wallet.fundTestAsset(assetCode);
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
            ? 'Deposit XLM on-chain to activate this wallet. Fiat on/off-ramp is waiting for a provider API.'
            : 'Fund test tokens for wallet demos. These are not real assets.'
        }
        title={wallet.isMainnet ? 'Deposit' : 'Faucet'}
      />

      {wallet.isMainnet ? (
        <View style={modern.sectionCard}>
          <SectionHeader title="Deposit XLM" />
          <Text style={modern.emptyModernText}>
            Use the QR code or address below to deposit real XLM and activate
            this Mainnet wallet.
          </Text>
          {!wallet.walletActive ? (
            <View style={modern.reviewModernBox}>
              <Text style={modern.reviewModernTitle}>Activate wallet</Text>
              <Text style={modern.reviewModernText}>
                Deposit XLM to start using this Mainnet wallet. Explorer opens
                after the wallet receives its first XLM deposit.
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
              {address || 'No wallet yet'}
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
          <SectionHeader title="Fiat on-ramp" />
          <View style={modern.disabledActionRow}>
            <Ionicons color="#8A9AA3" name="card" size={28} />
            <View style={modern.assetModernBody}>
              <Text style={modern.assetModernName}>Fiat on-ramp</Text>
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
          const canUseFaucet = asset.isNative || asset.trusted;

          return (
            <View
              key={`${asset.assetCode}:${asset.assetIssuer || 'native'}`}
              style={modern.faucetRow}
            >
              <TokenIcon assetCode={asset.assetCode} imageUrl={asset.image} />
              <View style={modern.assetModernBody}>
                <Text style={modern.assetModernName}>{asset.assetCode}</Text>
                <Text style={modern.assetModernMeta}>
                  {canUseFaucet
                    ? wallet.isMainnet
                      ? `Current balance ${formatTokenAmount(asset.balance, {
                          compact: true,
                        })}`
                      : `Current balance ${formatTokenAmount(asset.balance, {
                          compact: true,
                        })}`
                    : 'Add trustline before faucet'}
                </Text>
              </View>
              <PressScale
                disabled={wallet.isBusy || (wallet.isMainnet && !canOpenExplorer)}
                onPress={() =>
                  wallet.isMainnet
                    ? wallet.openUrl(wallet.explorerAddressUrl)
                    : canUseFaucet
                    ? handleFaucet(asset.assetCode)
                    : wallet.addTrustline(asset.assetCode)
                }
                style={
                  canUseFaucet ? modern.assetFaucetButton : modern.assetAddButton
                }
              >
                <Text style={modern.assetButtonText}>
                  {wallet.isMainnet
                    ? wallet.walletActive
                      ? 'Explorer'
                      : 'Inactive'
                    : canUseFaucet
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
