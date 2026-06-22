import React, { useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppPopup } from '@components/common/AppPopup';
import {
  ActivateWalletNotice,
  AssetListItem,
  HomeBannerCarousel,
  QuickActionGrid,
  SectionHeader,
  WalletHero,
  calculatePortfolioValuation,
  getWalletAssets,
  modern,
  PressScale,
  TransactionListItem,
  TokenIcon,
} from '@components/wallet';
import { WalletManagerModal } from '@components/wallet';
import { useCurrencyConfig } from '@contexts/CurrencyContext';
import type { BalanceItem, RampAssetCode, RampDirection } from '@app-types';
import type { WalletState } from '@hooks/useWallet';

type RampPreset = {
  amount?: string;
  assetCode?: RampAssetCode;
  autoCreate?: boolean;
  direction?: RampDirection;
};

type PortfolioAssetTab = 'crypto' | 'nft';
const CRYPTO_PREVIEW_LIMIT = 5;

const portfolioAssetTabs: { key: PortfolioAssetTab; label: string }[] = [
  { key: 'crypto', label: 'Crypto' },
  { key: 'nft', label: "NFT's" },
];

const homeBanners: ImageSourcePropType[] = [
  require('@assets/images/banner/banner1.png'),
  require('@assets/images/banner/banner2.png'),
  require('@assets/images/banner/bannner3.png'),
];

export function PortfolioScreen({
  onGoToReceive,
  onGoToSend,
  onGoToWithdraw,
  onGoToFaucet,
  onGoToRamp,
  onGoToAssetSearch,
  onGoToAssetDetail,
  onGoToWallets: _onGoToWallets,
  onGoToTransaction,
  onGoToHistory,
  onGoToScan,
  wallet,
}: {
  onGoToReceive: () => void;
  onGoToSend: (assetCode?: string) => void;
  onGoToWithdraw: () => void;
  onGoToFaucet: () => void;
  onGoToRamp: (preset?: RampPreset) => void;
  onGoToAssetSearch: () => void;
  onGoToAssetDetail: (asset: BalanceItem) => void;
  onGoToWallets: () => void;
  onGoToTransaction: (id: string) => void;
  onGoToHistory: () => void;
  onGoToScan: () => void;
  wallet: WalletState;
}) {
  const [isWalletModalVisible, setIsWalletModalVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeAssetTab, setActiveAssetTab] =
    useState<PortfolioAssetTab>('crypto');
  const [showAllCryptoAssets, setShowAllCryptoAssets] = useState(false);
  const { showPopup } = useAppPopup();
  const { selectedCurrency, convertFromUSD, loading } = useCurrencyConfig();

  const assets = getWalletAssets(wallet.balances, wallet.visibleAssets);
  const visibleCryptoAssets = showAllCryptoAssets
    ? assets
    : assets.slice(0, CRYPTO_PREVIEW_LIMIT);
  const canToggleCryptoAssets = assets.length > CRYPTO_PREVIEW_LIMIT;
  const valuation = calculatePortfolioValuation(assets);
  const baseUsdValue = valuation.totalUsd;
  const convertedValue = convertFromUSD(baseUsdValue);
  const showActivateWalletNotice = wallet.isMainnet && !wallet.walletActive;

  // Format based on currency
  const currencySymbols: Record<string, string> = {
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    USD: '$',
    VND: '₫',
  };
  const symbol = currencySymbols[selectedCurrency] || '$';

  const formattedPortfolioValue = loading
    ? '...'
    : selectedCurrency === 'VND' || selectedCurrency === 'JPY'
    ? `${Math.round(convertedValue).toLocaleString('en-US')} ${symbol}`
    : `${symbol}${convertedValue.toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })}`;
  const portfolioValue =
    valuation.positiveAssetCount > 0 && valuation.pricedAssetCount === 0
      ? 'Price unavailable'
      : formattedPortfolioValue;
  const portfolioNote = !wallet.isMainnet
    ? valuation.pricedAssetCount > 0
      ? 'Reference market price only'
      : 'Waiting for reference market prices'
    : valuation.unpricedAssetCount > 0
    ? `${valuation.unpricedAssetCount} asset${
        valuation.unpricedAssetCount === 1 ? '' : 's'
      } not included · Market prices refresh every minute`
    : wallet.assetPricesUpdatedAt
    ? ''
    : 'Waiting for market prices';

  function faucetAsset(assetCode: string) {
    if (wallet.isMainnet) {
      if (assetCode === 'XLM') {
        onGoToFaucet();
      } else {
        onGoToRamp();
      }
      return;
    }

    if (assetCode === 'XLM') {
      wallet.fundWallet();
      return;
    }

    onGoToRamp();
  }

  async function refreshPortfolio() {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    try {
      await Promise.all([
        wallet.refreshSession({ showAlert: false, showBusy: false }),
        wallet.refreshAssetPrices(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }

  function confirmNetworkSwitch() {
    const nextNetwork = wallet.isMainnet ? 'Testnet' : 'Mainnet';

    showPopup({
      actions: [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () =>
            wallet.switchNetwork(
              wallet.network === 'mainnet' ? 'testnet' : 'mainnet',
            ),
          text: `Switch to ${nextNetwork}`,
        },
      ],
      message: wallet.isMainnet
        ? 'Testnet uses demo assets. Your Mainnet wallets and balances will be hidden until you switch back.'
        : 'Mainnet uses real assets and real money. Check every transaction carefully.',
      title: `Switch to ${nextNetwork}?`,
      variant: wallet.isMainnet ? 'info' : 'warning',
    });
  }

  return (
    <View style={modern.portfolioRoot}>
      <Image
        source={require('@assets/images/background/backgroundhome.png')}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          opacity: 0.6,
        }}
        resizeMode="cover"
      />
      <ScrollView
        alwaysBounceVertical
        contentContainerStyle={modern.screen}
        refreshControl={
          <RefreshControl
            colors={['#3867D6']}
            onRefresh={refreshPortfolio}
            refreshing={isRefreshing}
            tintColor="#3867D6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <WalletHero
          address={wallet.wallet?.address}
          onNetworkPress={confirmNetworkSwitch}
          onScan={onGoToScan}
          onSearch={onGoToAssetSearch}
          onWalletPress={() => setIsWalletModalVisible(true)}
          network={wallet.network}
          portfolioNote={portfolioNote}
          portfolioValue={portfolioValue}
          walletName={wallet.wallet?.displayName}
        >
          <QuickActionGrid
            actions={[
              {
                icon: (
                  <MaterialCommunityIcons
                    color="#FFFFFF"
                    name="arrow-top-right"
                    size={25}
                  />
                ),
                key: 'send',
                label: 'Send',
                onPress: () => onGoToSend(),
              },
              {
                icon: (
                  <MaterialCommunityIcons
                    color="#FFFFFF"
                    name="arrow-bottom-left"
                    size={25}
                  />
                ),
                key: 'receive',
                label: 'Receive',
                onPress: onGoToReceive,
              },
              {
                icon: <Ionicons color="#FFFFFF" name="card" size={24} />,
                key: 'faucet',
                label: wallet.isMainnet ? 'Deposit' : 'Faucet',
                onPress: onGoToFaucet,
              },
              {
                icon: (
                  <MaterialCommunityIcons
                    color="#FFFFFF"
                    name="bank-transfer-out"
                    size={25}
                  />
                ),
                key: 'withdraw',
                label: 'Withdraw',
                onPress: onGoToWithdraw,
              },
            ]}
          />
          <HomeBannerCarousel banners={homeBanners} />
        </WalletHero>

        <View style={modern.belowHero}>
          {/* <PromoCarousel network={wallet.network} /> */}

          {showActivateWalletNotice ? (
            <ActivateWalletNotice
              onPress={() =>
                onGoToRamp({
                  amount: '5',
                  assetCode: 'XLM',
                  autoCreate: true,
                  direction: 'buy',
                })
              }
            />
          ) : null}

          <View
            style={[
              modern.homeAssetGroup,
              wallet.isMainnet
                ? showActivateWalletNotice
                  ? modern.homeAssetGroupMainnetWithNotice
                  : modern.homeAssetGroupMainnet
                : null,
            ]}
          >
            <View style={modern.assetTabsCard}>
              <View style={modern.assetTabs}>
                {portfolioAssetTabs.map(tab => {
                  const selected = tab.key === activeAssetTab;

                  return (
                    <PressScale
                      key={tab.key}
                      onPress={() => setActiveAssetTab(tab.key)}
                      style={modern.assetTab}
                    >
                      <Text
                        style={[
                          modern.assetTabText,
                          selected ? modern.assetTabTextActive : null,
                        ]}
                      >
                        {tab.label}
                      </Text>
                      <View
                        style={[
                          modern.assetTabUnderline,
                          selected ? modern.assetTabUnderlineActive : null,
                        ]}
                      />
                    </PressScale>
                  );
                })}
              </View>

              <View style={modern.assetTabPanel}>
                {activeAssetTab === 'crypto'
                  ? (
                    <>
                      {visibleCryptoAssets.map((asset, index) => (
                        <AssetListItem
                          asset={asset}
                          disabled={wallet.isBusy}
                          index={index}
                          key={`${asset.assetCode}:${
                            asset.assetIssuer || 'native'
                          }`}
                          onAdd={wallet.addTrustline}
                          onSend={onGoToSend}
                          onFaucet={faucetAsset}
                          onPress={onGoToAssetDetail}
                          showAction={false}
                        />
                      ))}
                      {canToggleCryptoAssets ? (
                        <PressScale
                          onPress={() =>
                            setShowAllCryptoAssets(value => !value)
                          }
                          style={modern.assetShowMoreButton}
                        >
                          <Text style={modern.assetShowMoreText}>
                            {showAllCryptoAssets ? 'Show less' : 'Show more'}
                          </Text>
                        </PressScale>
                      ) : null}
                    </>
                  )
                  : null}

                {activeAssetTab === 'nft' ? (
                  wallet.isMainnet ? (
                    <Text style={modern.emptyModernText}>
                      Demo NFTs are available on Stellar Testnet only.
                    </Text>
                  ) : wallet.collectibles.length > 0 ? (
                    wallet.collectibles.map(collectible => (
                      <View
                        key={collectible.id}
                        style={modern.collectibleModernRow}
                      >
                        <TokenIcon assetCode={collectible.assetCode} />
                        <View style={modern.assetModernBody}>
                          <Text
                            numberOfLines={1}
                            style={modern.assetModernName}
                          >
                            {collectible.displayName}
                          </Text>
                          <Text numberOfLines={2} style={modern.assetModernMeta}>
                            {collectible.claimed
                              ? `${collectible.assetCode} claimed · supply ${collectible.supply}`
                              : `${collectible.assetCode} demo NFT · claim on Testnet`}
                          </Text>
                        </View>
                        <PressScale
                          disabled={wallet.isBusy}
                          onPress={() =>
                            collectible.claimed
                              ? wallet.openUrl(collectible.explorerUrl)
                              : wallet.claimDemoNft()
                          }
                          style={[
                            collectible.claimed
                              ? modern.assetFaucetButton
                              : modern.assetAddButton,
                            modern.collectibleActionButton,
                          ]}
                        >
                          <Text style={modern.assetButtonText}>
                            {collectible.claimed ? 'View' : 'Claim'}
                          </Text>
                        </PressScale>
                      </View>
                    ))
                  ) : (
                    <>
                      <Text style={modern.emptyModernText}>
                        No NFTs loaded yet. Claim the SOW demo NFT after your
                        wallet has Testnet XLM.
                      </Text>
                      <PressScale
                        disabled={wallet.isBusy || !wallet.walletActive}
                        onPress={wallet.claimDemoNft}
                        style={modern.primaryModernButton}
                      >
                        <Text style={modern.modernButtonText}>
                          Claim demo NFT
                        </Text>
                      </PressScale>
                    </>
                  )
                ) : null}
              </View>
            </View>
          </View>

          <View style={modern.sectionCard}>
            <SectionHeader
              action={
                wallet.transactions.length > 5 ? (
                  <PressScale onPress={onGoToHistory}>
                    <Text style={modern.sectionActionText}>View all</Text>
                  </PressScale>
                ) : null
              }
              title="Recent activity"
            />
            {wallet.transactions.slice(0, 5).map(transaction => {
              const assetItem = assets.find(
                item => item.assetCode === transaction.assetCode,
              );
              return (
                <TransactionListItem
                  key={transaction.id}
                  onPress={() => onGoToTransaction(transaction.id)}
                  transaction={transaction}
                  imageUrl={assetItem?.image}
                />
              );
            })}
            {wallet.transactions.length === 0 && (
              <Text style={modern.emptyModernText}>No transactions yet.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <WalletManagerModal
        visible={isWalletModalVisible}
        onClose={() => setIsWalletModalVisible(false)}
        walletState={wallet}
      />
    </View>
  );
}
