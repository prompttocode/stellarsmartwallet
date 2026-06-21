import React from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Ionicons from 'react-native-vector-icons/Ionicons';
import QRCode from 'react-native-qrcode-styled';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppPopup } from '@components/common/AppPopup';
import { PressScale, TokenIcon, getWalletAssets } from '@components/wallet';
import type { AssetItem, BalanceItem } from '@app-types';
import type { WalletState } from '@hooks/useWallet';
import { formatTokenAmount } from '@utils/format';

function getAssetKey(asset: AssetItem) {
  return asset.isNative
    ? `${asset.network}:native`
    : `${asset.network}:${asset.assetCode}:${asset.assetIssuer || ''}`;
}

function getReceiveAssets(balances: BalanceItem[], visibleAssets: AssetItem[]) {
  const walletAssets = getWalletAssets(balances, visibleAssets);
  const walletAssetKeys = new Set(walletAssets.map(getAssetKey));
  const importantReceiveAssets = visibleAssets
    .filter(
      asset =>
        asset.assetCode === 'USDC' && !walletAssetKeys.has(getAssetKey(asset)),
    )
    .map<BalanceItem>(asset => ({
      ...asset,
      balance: '0',
      exists: false,
      trusted: asset.isNative,
    }));

  return [...walletAssets, ...importantReceiveAssets];
}

function shortDepositAddress(address?: string) {
  if (!address) {
    return 'Not available';
  }

  if (address.length <= 6) {
    return address;
  }

  return `${address.slice(0, 2)}...${address.slice(-4)}`;
}

export function ReceiveScreen({
  onBack,
  wallet,
}: {
  onBack: () => void;
  wallet: WalletState;
}) {
  const insets = useSafeAreaInsets();
  const { showPopup } = useAppPopup();
  const assets = getReceiveAssets(wallet.balances, wallet.visibleAssets);
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

  function copyAddress() {
    if (!address) {
      return;
    }

    Clipboard.setString(address);
    showPopup({
      message: 'Wallet address copied to clipboard.',
      title: 'Copied',
      variant: 'success',
    });
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: insets.bottom + 48,
        },
      ]}
      style={styles.root}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.heroHeader}>
          <PressScale onPress={onBack} style={styles.heroBackButton}>
            <Ionicons color="#FFFFFF" name="chevron-back" size={24} />
          </PressScale>
          <Text style={styles.heroHeaderTitle}>Details</Text>
          <View style={styles.heroHeaderSpacer} />
        </View>
        <Text style={styles.heroEyebrow}>STELLAR WALLET</Text>
        <Text style={styles.heroTitle}>Receive crypto</Text>
        <Text style={styles.heroSubtitle}>
          {wallet.isMainnet
            ? 'Use this address for on-chain deposits. Buying with VND stays separate.'
            : 'Use this Testnet address for demo sends and receives.'}
        </Text>
      </View>

      <View style={styles.receiptCard}>
        <Text style={styles.receiptTitle}>Deposit address</Text>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Network</Text>
            <Text style={styles.metaValue}>
              {wallet.isMainnet ? 'Mainnet' : 'Testnet'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Wallet</Text>
            <Text style={styles.metaValue}>{shortDepositAddress(address)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Status</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  wallet.walletActive ? styles.statusDotActive : null,
                ]}
              />
              <Text style={styles.metaValue}>
                {wallet.walletActive ? 'Ready' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>

        <PressScale
          disabled={!address}
          onPress={copyAddress}
          style={[styles.copyButton, !address ? styles.disabledButton : null]}
        >
          <Text style={styles.copyButtonText}>Copy address</Text>
        </PressScale>

        <View style={styles.actionRow}>
          <View style={styles.outlineButtonSlot}>
            <PressScale
              disabled={!address}
              onPress={shareAddress}
              style={[
                styles.outlineButton,
                !address ? styles.disabledButton : null,
              ]}
            >
              <Ionicons color="#071421" name="share-outline" size={18} />
              <Text style={styles.outlineButtonText}>Share</Text>
            </PressScale>
          </View>
          <View style={styles.outlineButtonSlot}>
            <PressScale
              disabled={!canOpenExplorer}
              onPress={() => wallet.openUrl(wallet.explorerAddressUrl)}
              style={[
                styles.outlineButton,
                !canOpenExplorer ? styles.disabledButton : null,
              ]}
            >
              <Ionicons color="#071421" name="open-outline" size={18} />
              <Text style={styles.outlineButtonText}>Explorer</Text>
            </PressScale>
          </View>
        </View>

        <Text style={styles.qrHint}>Scan QR or copy the address</Text>

        <View style={styles.qrFrame}>
          {address ? (
            <QRCode
              backgroundColor="#FFFFFF"
              color="#071421"
              data={address}
              padding={18}
              pieceSize={8}
            />
          ) : (
            <>
              <Ionicons color="#071421" name="qr-code" size={76} />
              <Text style={styles.emptyQrText}>No address</Text>
            </>
          )}
        </View>

        <View style={styles.brandChip}>
          <TokenIcon assetCode="XLM" size={26} />
          <Text style={styles.brandChipText}>Stellar</Text>
        </View>

        <View style={styles.addressBox}>
          <Text selectable style={styles.addressText}>
            {address || 'No wallet yet'}
          </Text>
        </View>

        {wallet.isMainnet && !wallet.walletActive ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>Activate wallet</Text>
            <Text style={styles.noticeText}>
              Deposit XLM to start using this Mainnet wallet. Stellar creates
              the account on ledger after the first XLM deposit.
            </Text>
          </View>
        ) : null}

        {wallet.isMainnet ? (
          <Text style={styles.exchangeNote}>
            Exchange deposits may require a memo. Personal wallet deposits
            usually only need this address.
          </Text>
        ) : null}
      </View>

      <View style={styles.assetsCard}>
        <View style={styles.assetsHeader}>
          <Text style={styles.assetsTitle}>Assets you can receive</Text>
          <Text style={styles.assetsSubtitle}>
            Enable non-native assets before receiving them.
          </Text>
        </View>
        {assets.map(asset => {
          const needsTrustline = !asset.isNative && !asset.trusted;
          const canReceive = !needsTrustline;
          const enableDisabled =
            wallet.isBusy || (wallet.isMainnet && !wallet.walletActive);

          return (
            <View
              key={`${asset.assetCode}:${asset.assetIssuer || 'native'}`}
              style={styles.assetRow}
            >
              <TokenIcon assetCode={asset.assetCode} imageUrl={asset.image} />
              <View style={styles.assetBody}>
                <Text style={styles.assetName}>{asset.assetCode}</Text>
                <Text style={styles.assetMeta}>
                  {canReceive
                    ? `Ready to receive · ${formatTokenAmount(asset.balance, {
                        compact: true,
                      })}`
                    : wallet.isMainnet && !wallet.walletActive
                    ? 'Deposit XLM first, then enable this asset'
                    : 'Enable this asset before receiving it'}
                </Text>
              </View>
              {needsTrustline ? (
                <PressScale
                  disabled={enableDisabled}
                  onPress={() =>
                    wallet.addTrustline(asset.assetCode, asset.assetIssuer)
                  }
                  style={styles.enableButton}
                >
                  <Text style={styles.enableButtonText}>Enable</Text>
                </PressScale>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  addressBox: {
    backgroundColor: '#F4F5F7',
    borderRadius: 18,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  addressText: {
    color: '#172033',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    lineHeight: 18,
    textAlign: 'center',
  },
  assetBody: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  assetMeta: {
    color: '#7D8795',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  assetName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  assetRow: {
    alignItems: 'center',
    borderTopColor: '#EEF0F3',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
  },
  assetsCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#ECEEF1',
    borderRadius: 28,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
  },
  assetsHeader: {
    gap: 4,
    paddingBottom: 8,
  },
  assetsSubtitle: {
    color: '#7D8795',
    fontSize: 13,
    fontWeight: '700',
  },
  assetsTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '900',
  },
  brandChip: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#ECEFF3',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    marginTop: -12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  brandChipText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
  },
  content: {
    backgroundColor: '#F4F5F7',
  },
  copyButton: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 28,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 58,
  },
  copyButtonText: {
    color: '#071421',
    fontSize: 15,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.45,
  },
  emptyQrText: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '900',
  },
  enableButton: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 17,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  enableButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  exchangeNote: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
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
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroHeaderSpacer: {
    width: 40,
  },
  heroHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 320,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 8,
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  metaItem: {
    flex: 1,
    gap: 5,
  },
  metaLabel: {
    color: '#7D8795',
    fontSize: 11,
    fontWeight: '800',
  },
  metaValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
  },
  noticeBox: {
    backgroundColor: '#FFF7E8',
    borderRadius: 18,
    gap: 5,
    marginTop: 14,
    padding: 14,
  },
  noticeText: {
    color: '#7C5A13',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  noticeTitle: {
    color: '#5C3D00',
    fontSize: 14,
    fontWeight: '900',
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
  qrFrame: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 248,
    padding: 12,
    width: 248,
  },
  qrHint: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 22,
    textAlign: 'center',
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
  receiptTitle: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  root: {
    backgroundColor: '#F4F5F7',
    flex: 1,
  },
  statusDot: {
    backgroundColor: '#D1D5DB',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusDotActive: {
    backgroundColor: '#B8FF45',
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
});
