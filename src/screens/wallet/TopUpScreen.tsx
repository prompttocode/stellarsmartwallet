import React from 'react';
import { ScrollView, Text, View } from 'react-native';
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
        subtitle="Nạp token test để demo luồng ví. Đây không phải tiền thật."
        title="Buy / Faucet"
      />

      <View style={modern.sectionCard}>
        <SectionHeader title="Choose asset" />
        {assets.map(asset => {
          const canTopUp = asset.isNative || asset.trusted;

          return (
            <View key={asset.assetCode} style={modern.topUpRow}>
              <TokenIcon assetCode={asset.assetCode} />
              <View style={modern.assetModernBody}>
                <Text style={modern.assetModernName}>{asset.assetCode}</Text>
                <Text style={modern.assetModernMeta}>
                  {canTopUp
                    ? `Current balance ${asset.balance}`
                    : 'Add trustline before faucet'}
                </Text>
              </View>
              <PressScale
                disabled={wallet.isBusy}
                onPress={() =>
                  canTopUp
                    ? handleTopUp(asset.assetCode)
                    : wallet.addTrustline(asset.assetCode)
                }
                style={
                  canTopUp ? modern.assetTopUpButton : modern.assetAddButton
                }
              >
                <Text style={modern.assetButtonText}>
                  {canTopUp ? 'Faucet' : 'Add'}
                </Text>
              </PressScale>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
