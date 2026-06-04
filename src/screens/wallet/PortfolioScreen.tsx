import React, { useMemo, useState, useEffect } from 'react';
import { ScrollView, Text, View, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  ActivateWalletNotice,
  AssetListItem,
  PromoCarousel,
  QuickActionGrid,
  SectionHeader,
  WalletHero,
  calculateTotalUsdValue,
  getModernAssets,
  modern,
  PressScale,
  TransactionListItem,
} from '../../components/wallet/ModernWalletUI';
import { WalletManagerModal } from '../../components/wallet/WalletManagerModal';
import { useCurrencyConfig } from '../../contexts/CurrencyContext';
import type { WalletDemoState } from '../../hooks/useWalletDemo';

export function PortfolioScreen({
  onGoToReceive,
  onGoToSend,
  onGoToSwap,
  onGoToTopUp,
  onGoToWallets,
  onGoToTransaction,
  onGoToHistory,
  onGoToScan,
  wallet,
}: {
  onGoToReceive: () => void;
  onGoToSend: (assetCode?: string) => void;
  onGoToSwap: () => void;
  onGoToTopUp: () => void;
  onGoToWallets: () => void;
  onGoToTransaction: (id: string) => void;
  onGoToHistory: () => void;
  onGoToScan: () => void;
  wallet: WalletDemoState;
}) {
  const [hidden, setHidden] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isWalletModalVisible, setIsWalletModalVisible] = useState(false);
  const { selectedCurrency, convertFromUSD, loading } = useCurrencyConfig();
  
  // Enable LayoutAnimation for Android
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const toggleSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearching(!isSearching);
    if (isSearching) setSearchQuery(''); // Clear when closing
  };

  const baseUsdValue = calculateTotalUsdValue(wallet.balances);
  const convertedValue = convertFromUSD(baseUsdValue);
  
  // Format based on currency
  const currencySymbols: Record<string, string> = {
    USD: '$', VND: '₫', EUR: '€', JPY: '¥', GBP: '£'
  };
  const symbol = currencySymbols[selectedCurrency] || '$';
  
  const portfolioValue = loading ? '...' : 
    (selectedCurrency === 'VND' || selectedCurrency === 'JPY') 
      ? `${Math.round(convertedValue).toLocaleString('vi-VN')} ${symbol}`
      : `${symbol}${convertedValue.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

  const assets = getModernAssets(wallet.balances, wallet.visibleAssets);
  
  const filteredAssets = useMemo(() => {
    if (!searchQuery) return assets;
    const q = searchQuery.toLowerCase();
    return assets.filter(a => a.assetCode.toLowerCase().includes(q) || a.balance.includes(q));
  }, [assets, searchQuery]);

  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return wallet.transactions;
    const q = searchQuery.toLowerCase();
    return wallet.transactions.filter(t => 
      t.id.toLowerCase().includes(q) || 
      t.operation.toLowerCase().includes(q) || 
      t.direction.toLowerCase().includes(q) ||
      (t.assetCode && t.assetCode.toLowerCase().includes(q))
    );
  }, [wallet.transactions, searchQuery]);

  function topUpAsset(assetCode: string) {
    if (wallet.isMainnet) {
      onGoToTopUp();
      return;
    }

    if (assetCode === 'XLM') {
      wallet.fundWallet();
      return;
    }

    wallet.fundDemoAsset(assetCode);
  }

  return (
    <View style={modern.portfolioRoot}>
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
                icon: <MaterialCommunityIcons color="#FFFFFF" name="arrow-top-right" size={30} />,
                key: 'send',
                label: 'Send',
                onPress: () => onGoToSend(),
              },
              {
                icon: <MaterialCommunityIcons color="#FFFFFF" name="arrow-bottom-left" size={30} />,
                key: 'receive',
                label: 'Receive',
                onPress: onGoToReceive,
              },
              {
                icon: <Ionicons color="#FFFFFF" name="card" size={28} />,
                key: 'buy',
                label: wallet.isMainnet ? 'Deposit' : 'Buy',
                onPress: onGoToTopUp,
              },
              { icon: <MaterialCommunityIcons color="#FFFFFF" name="swap-horizontal" size={30} />, key: 'swap', label: 'Swap', onPress: onGoToSwap },
            ]}
          />
        </WalletHero>

        <View style={modern.belowHero}>
          <PromoCarousel network={wallet.network} />

          {wallet.isMainnet && !wallet.walletActive ? (
            <ActivateWalletNotice onPress={onGoToReceive} />
          ) : null}

          <View style={modern.sectionCard}>
            <SectionHeader
              action={
                <View style={modern.sectionHeaderActions}>
                  <PressScale onPress={toggleSearch}>
                    <Ionicons color={isSearching ? "#0F8EA3" : "#9AA7AE"} name="search" size={20} />
                  </PressScale>
                  <Ionicons color="#9AA7AE" name="filter" size={20} />
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
                onTopUp={topUpAsset}
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
            {filteredTransactions.slice(0, 5).map(transaction => (
              <TransactionListItem
                key={transaction.id}
                onPress={() => onGoToTransaction(transaction.id)}
                transaction={transaction}
              />
            ))}
            {filteredTransactions.length === 0 && (
              <Text style={modern.emptyModernText}>
                {searchQuery ? "Không tìm thấy kết quả phù hợp." : "Chưa có giao dịch nào."}
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
    </View>
  );
}
