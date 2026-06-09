import React, { useState } from 'react';
import {
  ImageBackground,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  ActivateWalletNotice,
  AssetListItem,
  QuickActionGrid,
  SectionHeader,
  WalletHero,
  calculateTotalUsdValue,
  getModernAssets,
  modern,
  PressScale,
  TransactionListItem,
  TokenIcon,
} from '@components/wallet';
import { WalletManagerModal } from '@components/wallet';
import { useCurrencyConfig } from '@contexts/CurrencyContext';
import type { BalanceItem } from '@app-types';
import type { WalletState } from '@hooks/useWallet';

const portfolioBackground = require('@assets/images/background/backstellar.png');

export function PortfolioScreen({
  onGoToReceive,
  onGoToSend,
  onGoToSwap,
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
  onGoToSwap: () => void;
  onGoToFaucet: () => void;
  onGoToRamp: () => void;
  onGoToAssetSearch: () => void;
  onGoToAssetDetail: (asset: BalanceItem) => void;
  onGoToWallets: () => void;
  onGoToTransaction: (id: string) => void;
  onGoToHistory: () => void;
  onGoToScan: () => void;
  wallet: WalletState;
}) {
  const [hidden, setHidden] = useState(false);
  const [isWalletModalVisible, setIsWalletModalVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { selectedCurrency, convertFromUSD, loading } = useCurrencyConfig();

  const baseUsdValue = calculateTotalUsdValue(wallet.balances);
  const convertedValue = convertFromUSD(baseUsdValue);

  // Format based on currency
  const currencySymbols: Record<string, string> = {
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    USD: '$',
    VND: '₫',
  };
  const symbol = currencySymbols[selectedCurrency] || '$';

  const portfolioValue = loading
    ? '...'
    : selectedCurrency === 'VND' || selectedCurrency === 'JPY'
    ? `${Math.round(convertedValue).toLocaleString('en-US')} ${symbol}`
    : `${symbol}${convertedValue.toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })}`;

  const assets = getModernAssets(wallet.balances, wallet.visibleAssets);

  function faucetAsset(assetCode: string) {
    if (wallet.isMainnet) {
      onGoToFaucet();
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
      await wallet.refreshSession();
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <ImageBackground
      imageStyle={modern.portfolioBackgroundImage}
      resizeMode="cover"
      source={portfolioBackground}
      style={modern.portfolioRoot}
    >
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
          email={wallet.account?.email}
          hidden={hidden}
          onHideToggle={() => setHidden(value => !value)}
          onNetworkPress={() =>
            wallet.switchNetwork(
              wallet.network === 'mainnet' ? 'testnet' : 'mainnet',
            )
          }
          onScan={onGoToScan}
          onSearch={onGoToAssetSearch}
          onWalletPress={() => setIsWalletModalVisible(true)}
          network={wallet.network}
          portfolioValue={portfolioValue}
        >
          <QuickActionGrid
            actions={[
              {
                icon: (
                  <MaterialCommunityIcons
                    color="#3867D6"
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
                    color="#3867D6"
                    name="arrow-bottom-left"
                    size={25}
                  />
                ),
                key: 'receive',
                label: 'Receive',
                onPress: onGoToReceive,
              },
              {
                icon: <Ionicons color="#3867D6" name="card" size={24} />,
                key: 'faucet',
                label: wallet.isMainnet ? 'Deposit' : 'Faucet',
                onPress: onGoToFaucet,
              },
              {
                icon: (
                  <MaterialCommunityIcons
                    color="#3867D6"
                    name="swap-horizontal"
                    size={25}
                  />
                ),
                key: 'swap',
                label: 'Swap',
                onPress: onGoToSwap,
              },
            ]}
          />
        </WalletHero>

        <View style={modern.belowHero}>
          {/* <PromoCarousel network={wallet.network} /> */}

          {wallet.isMainnet && !wallet.walletActive ? (
            <ActivateWalletNotice onPress={onGoToReceive} />
          ) : null}

          <View style={modern.sectionCard}>
            <SectionHeader
              action={
                <View style={modern.sectionHeaderActions}>
                  <PressScale
                    onPress={onGoToAssetSearch}
                    style={modern.sectionIconButton}
                  >
                    <Ionicons color="#3867D6" name="search" size={18} />
                  </PressScale>
                </View>
              }
              title="My assets"
            />
            {assets.map((asset, index) => (
              <AssetListItem
                asset={asset}
                disabled={wallet.isBusy}
                index={index}
                key={`${asset.assetCode}:${asset.assetIssuer || 'native'}`}
                onAdd={wallet.addTrustline}
                onSend={onGoToSend}
                onFaucet={faucetAsset}
                onPress={onGoToAssetDetail}
              />
            ))}
          </View>

          <View style={modern.sectionCard}>
            <SectionHeader title="Collectibles" />
            {wallet.isMainnet ? (
              <Text style={modern.emptyModernText}>
                Demo collectibles are available on Stellar Testnet only.
              </Text>
            ) : wallet.collectibles.length > 0 ? (
              wallet.collectibles.map(collectible => (
                <View key={collectible.id} style={modern.assetModernRow}>
                  <TokenIcon assetCode={collectible.assetCode} />
                  <View style={modern.assetModernBody}>
                    <Text numberOfLines={1} style={modern.assetModernName}>
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
                    style={
                      collectible.claimed
                        ? modern.assetFaucetButton
                        : modern.assetAddButton
                    }
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
                  No collectibles loaded yet. Claim the SOW demo NFT after your
                  wallet has Testnet XLM.
                </Text>
                <PressScale
                  disabled={wallet.isBusy || !wallet.walletActive}
                  onPress={wallet.claimDemoNft}
                  style={modern.primaryModernButton}
                >
                  <Text style={modern.modernButtonText}>Claim demo NFT</Text>
                </PressScale>
              </>
            )}
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
              title="Recent Transactions"
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
    </ImageBackground>
  );
}
