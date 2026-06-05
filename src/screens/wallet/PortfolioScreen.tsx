import React, { useMemo, useState, useEffect } from 'react';
import {
  ImageBackground,
  LayoutAnimation,
  Platform,
  ScrollView,
  Text,
  TextInput,
  UIManager,
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
} from '@components/wallet';
import { WalletManagerModal } from '@components/wallet';
import { useCurrencyConfig } from '@contexts/CurrencyContext';
import type { WalletState } from '@hooks/useWallet';

const portfolioBackground = require('@assets/images/background/backstellar.png');

export function PortfolioScreen({
  onGoToReceive,
  onGoToSend,
  onGoToSwap,
  onGoToFaucet,
  onGoToWallets,
  onGoToTransaction,
  onGoToHistory,
  onGoToScan,
  wallet,
}: {
  onGoToReceive: () => void;
  onGoToSend: (assetCode?: string) => void;
  onGoToSwap: () => void;
  onGoToFaucet: () => void;
  onGoToWallets: () => void;
  onGoToTransaction: (id: string) => void;
  onGoToHistory: () => void;
  onGoToScan: () => void;
  wallet: WalletState;
}) {
  const [hidden, setHidden] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isWalletModalVisible, setIsWalletModalVisible] = useState(false);
  const { selectedCurrency, convertFromUSD, loading } = useCurrencyConfig();

  useEffect(() => {
    if (
      Platform.OS === 'android' &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const toggleSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearching(!isSearching);
    if (isSearching) setSearchQuery('');
  };

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

  const filteredAssets = useMemo(() => {
    if (!searchQuery) return assets;
    const q = searchQuery.toLowerCase();
    return assets.filter(
      asset =>
        asset.assetCode.toLowerCase().includes(q) || asset.balance.includes(q),
    );
  }, [assets, searchQuery]);

  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return wallet.transactions;
    const q = searchQuery.toLowerCase();
    return wallet.transactions.filter(
      transaction =>
        transaction.id.toLowerCase().includes(q) ||
        transaction.operation.toLowerCase().includes(q) ||
        transaction.direction.toLowerCase().includes(q) ||
        (transaction.assetCode &&
          transaction.assetCode.toLowerCase().includes(q)),
    );
  }, [wallet.transactions, searchQuery]);

  function faucetAsset(assetCode: string) {
    if (wallet.isMainnet) {
      onGoToFaucet();
      return;
    }

    if (assetCode === 'XLM') {
      wallet.fundWallet();
      return;
    }

    wallet.fundTestAsset(assetCode);
  }

  return (
    <ImageBackground
      imageStyle={modern.portfolioBackgroundImage}
      resizeMode="cover"
      source={portfolioBackground}
      style={modern.portfolioRoot}
    >
      <ScrollView
        contentContainerStyle={modern.screen}
        showsVerticalScrollIndicator={false}
      >
        <WalletHero
          address={wallet.wallet?.address}
          email={wallet.account?.email}
          hidden={hidden}
          onHideToggle={() => setHidden(value => !value)}
          onMenu={onGoToWallets}
          onNetworkPress={() =>
            wallet.switchNetwork(
              wallet.network === 'mainnet' ? 'testnet' : 'mainnet',
            )
          }
          onScan={onGoToScan}
          onSearch={toggleSearch}
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
                    onPress={toggleSearch}
                    style={modern.sectionIconButton}
                  >
                    <Ionicons
                      color={isSearching ? '#3867D6' : '#7E8BA3'}
                      name="search"
                      size={18}
                    />
                  </PressScale>
                </View>
              }
              title="My assets"
            />
            {isSearching && (
              <TextInput
                style={[modern.modernInput, modern.assetSearchInput]}
                placeholder="Search assets or transactions..."
                placeholderTextColor="#A7B3BA"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            )}
            {filteredAssets.map((asset, index) => (
              <AssetListItem
                asset={asset}
                disabled={wallet.isBusy}
                index={index}
                key={`${asset.assetCode}:${asset.assetIssuer || 'native'}`}
                onAdd={wallet.addTrustline}
                onSend={onGoToSend}
                onFaucet={faucetAsset}
              />
            ))}
          </View>

          <View style={modern.sectionCard}>
            <SectionHeader
              action={
                filteredTransactions.length > 5 ? (
                  <PressScale onPress={onGoToHistory}>
                    <Text style={modern.sectionActionText}>View all</Text>
                  </PressScale>
                ) : null
              }
              title="Recent Transactions"
            />
            {filteredTransactions.slice(0, 5).map(transaction => {
              const assetItem = assets.find(item => item.assetCode === transaction.assetCode);
              return (
                <TransactionListItem
                  key={transaction.id}
                  onPress={() => onGoToTransaction(transaction.id)}
                  transaction={transaction}
                  imageUrl={assetItem?.image}
                />
              );
            })}
            {filteredTransactions.length === 0 && (
              <Text style={modern.emptyModernText}>
                {searchQuery
                  ? 'No matching results found.'
                  : 'No transactions yet.'}
              </Text>
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
