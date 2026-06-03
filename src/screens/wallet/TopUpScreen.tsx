import React from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  TokenIcon,
  getModernAssets,
  modern,
} from '../../components/wallet/ModernWalletUI';
import type { WalletDemoState } from '../../hooks/useWalletDemo';

export function TopUpScreen({
  onBack,
  wallet,
}: {
  onBack: () => void;
  wallet: WalletDemoState;
}) {
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
      contentContainerStyle={modern.screenInset}
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader
        onBack={onBack}
        subtitle={
          wallet.isMainnet
            ? 'Deposit on-chain đã bật. Fiat on/off-ramp chờ provider API.'
            : 'Nạp token test để demo luồng ví. Đây không phải tiền thật.'
        }
        title={wallet.isMainnet ? 'Buy / Deposit' : 'Buy / Faucet'}
      />

      {wallet.isMainnet ? (
        <View style={modern.sectionCard}>
          <SectionHeader title="On-chain deposit" />
          <Text style={modern.emptyModernText}>
            Dùng address bên dưới để nạp XLM thật và active ví mainnet. Buy
            fiat đang để Coming soon vì chưa cấu hình provider.
          </Text>
          {!wallet.walletActive ? (
            <View style={modern.reviewModernBox}>
              <Text style={modern.reviewModernTitle}>Explorer not available</Text>
              <Text style={modern.reviewModernText}>
                Account chưa tồn tại trên ledger Mainnet. Sau khi nhận XLM
                đầu tiên, Explorer sẽ mở được.
              </Text>
            </View>
          ) : null}
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
          <SectionHeader title="Fiat ramps" />
          {wallet.rampProviders.map(provider => (
            <View key={provider.id} style={modern.topUpRow}>
              <Ionicons
                color={provider.configured ? '#0ABF73' : '#8A9AA3'}
                name={provider.type === 'fiat' ? 'card' : 'download-outline'}
                size={28}
              />
              <View style={modern.assetModernBody}>
                <Text style={modern.assetModernName}>{provider.name}</Text>
                <Text style={modern.assetModernMeta}>
                  {provider.configured
                    ? provider.supports.join(', ')
                    : 'Coming soon / provider not configured'}
                </Text>
              </View>
            </View>
          ))}
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
