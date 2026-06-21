import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppPopup } from '@components/common/AppPopup';
import {
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  modern,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import type { WalletState } from '@hooks/useWallet';
import type { Wallet } from '@app-types';
import { shortAddress } from '@utils/format';

function getWalletName(wallet: Wallet, index: number) {
  return wallet.displayName || `Stellar Wallet ${index + 1}`;
}

export function WalletsScreen({
  onBack,
  wallet,
}: {
  onBack: () => void;
  wallet: WalletState;
}) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const { showPopup } = useAppPopup();
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const networkLabel = wallet.isMainnet ? 'Mainnet' : 'Testnet';
  const wallets =
    wallet.wallets.length > 0
      ? wallet.wallets
      : wallet.wallet
      ? [wallet.wallet]
      : [];
  const activeWallet =
    wallets.find(item => item.id === wallet.activeWalletId) ||
    wallet.wallet ||
    wallets[0];

  function getDraftName(item: Wallet, index: number) {
    return draftNames[item.id] ?? getWalletName(item, index);
  }

  function handleRename(item: Wallet, index: number) {
    const nextName = getDraftName(item, index).trim();

    if (!nextName || nextName === getWalletName(item, index)) {
      return;
    }

    wallet.renameWallet(item.id, nextName);
  }

  function confirmArchive(item: Wallet) {
    showPopup({
      actions: [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => wallet.archiveWallet(item.id),
          style: 'destructive',
          text: 'Archive',
        },
      ],
      message:
        'The wallet still exists in Privy/Stellar. The app only hides it from the local wallet list.',
      title: 'Archive this wallet?',
      variant: 'warning',
    });
  }

  return (
    <ScrollView
      contentContainerStyle={screenInsetStyle}
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader
        onBack={onBack}
        subtitle={`Create, switch, rename, and archive ${networkLabel} wallets only.`}
        title={`${networkLabel} wallets`}
      />

      <View style={modern.sectionCard}>
        <SectionHeader title="Active wallet" />
        {activeWallet ? (
          <View style={modern.activeWalletCard}>
            <View style={modern.walletOrb}>
              <Ionicons color="#0F8EA3" name="wallet" size={28} />
            </View>
            <Text style={modern.activeWalletName}>
              {activeWallet.displayName || 'Stellar Wallet'}
            </Text>
            <Text selectable style={modern.activeWalletAddress}>
              {activeWallet.address}
            </Text>
            <View style={modern.walletBadge}>
              <Text style={modern.walletBadgeText}>Managed by Privy</Text>
            </View>
          </View>
        ) : (
          <View style={modern.emptyModern}>
            <Text style={modern.emptyModernTitle}>No wallet yet</Text>
            <Text style={modern.emptyModernText}>
              Create your first wallet to start using Stellar {networkLabel}.
            </Text>
          </View>
        )}
        <PressScale
          disabled={wallet.isBusy}
          onPress={wallet.createWallet}
          style={modern.primaryModernButton}
        >
          <Text style={modern.modernButtonText}>
            {wallet.busy || `Create ${networkLabel} wallet`}
          </Text>
        </PressScale>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title={`${networkLabel} wallets`} />
        {wallets.map((item, index) => {
          const isActive = item.id === activeWallet?.id;
          const name = getWalletName(item, index);
          const draftName = getDraftName(item, index);
          const canSave =
            Boolean(draftName.trim()) && draftName.trim() !== name;

          return (
            <View key={item.id} style={modern.walletListRow}>
              <View style={modern.walletListTop}>
                <View style={modern.walletListIcon}>
                  <Ionicons color="#0F8EA3" name="wallet-outline" size={22} />
                </View>
                <View style={modern.walletListBody}>
                  <View style={modern.walletNameRow}>
                    <Text style={modern.walletListName}>{name}</Text>
                    {isActive ? (
                      <View style={modern.walletActiveBadge}>
                        <Text style={modern.walletActiveText}>Active</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={modern.walletListMeta}>
                    {shortAddress(item.address)}
                  </Text>
                </View>
              </View>

              <TextInput
                editable={!wallet.isBusy}
                onChangeText={value =>
                  setDraftNames(current => ({
                    ...current,
                    [item.id]: value,
                  }))
                }
                placeholder="Wallet name"
                placeholderTextColor="#A7B3BA"
                style={modern.walletRenameInput}
                value={draftName}
              />

              <View style={modern.walletActionsRow}>
                {!isActive ? (
                  <PressScale
                    disabled={wallet.isBusy}
                    onPress={() => wallet.selectWallet(item.id)}
                    style={modern.walletMiniButton}
                  >
                    <Text style={modern.walletMiniButtonText}>Use wallet</Text>
                  </PressScale>
                ) : null}
                <PressScale
                  disabled={wallet.isBusy || !canSave}
                  onPress={() => handleRename(item, index)}
                  style={modern.walletMiniButton}
                >
                  <Text style={modern.walletMiniButtonText}>Save name</Text>
                </PressScale>
                <PressScale
                  disabled={wallet.isBusy || wallets.length <= 1}
                  onPress={() => confirmArchive(item)}
                  style={modern.walletArchiveButton}
                >
                  <Text style={modern.walletArchiveText}>Archive</Text>
                </PressScale>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
