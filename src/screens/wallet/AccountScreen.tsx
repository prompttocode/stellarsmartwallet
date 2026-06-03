import React, { useState } from 'react';
import { ScrollView, Text, View, Modal, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  ModernScreenHeader,
  PressScale,
  SectionHeader,
  modern,
} from '../../components/wallet/ModernWalletUI';
import type { WalletDemoState } from '../../hooks/useWalletDemo';
import { shortAddress } from '../../utils/format';
import { useCurrencyConfig, SupportedCurrency } from '../../contexts/CurrencyContext';

const CURRENCIES: { code: SupportedCurrency; name: string; symbol: string }[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
];

export function AccountScreen({ wallet }: { wallet: WalletDemoState }) {
  const { selectedCurrency, setSelectedCurrency } = useCurrencyConfig();
  const [isCurrencyModalVisible, setIsCurrencyModalVisible] = useState(false);

  const activeWallet =
    wallet.wallets.find((item) => item.id === wallet.activeWalletId) ||
    wallet.wallet;

  return (
    <ScrollView
      contentContainerStyle={modern.screenInset}
      showsVerticalScrollIndicator={false}
    >
      <ModernScreenHeader title="Account" subtitle="Quản lý tài khoản và ví Privy." />

      <View style={modern.sectionCard}>
        <SectionHeader title="Your Profile" />
        <View style={modern.infoRow}>
          <Text style={modern.infoLabel}>Email</Text>
          <Text style={modern.infoRowValue}>{wallet.account?.email}</Text>
        </View>
        <View style={modern.infoRow}>
          <Text style={modern.infoLabel}>Privy ID</Text>
          <Text style={modern.infoRowValue}>
            {shortAddress(wallet.account?.id)}
          </Text>
        </View>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Settings" />
        <PressScale 
          style={[modern.infoRow, { alignItems: 'center' }]} 
          onPress={() => setIsCurrencyModalVisible(true)}
        >
          <Text style={modern.infoLabel}>Display Currency</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={modern.infoRowValue}>{selectedCurrency}</Text>
            <Ionicons name="chevron-forward" size={20} color="#8A9AA3" />
          </View>
        </PressScale>
      </View>

      <View style={modern.sectionCard}>
        <SectionHeader title="Active Wallet" />
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
            <Text style={modern.emptyModernTitle}>Chưa có ví</Text>
            <Text style={modern.emptyModernText}>
              Tạo ví đầu tiên để bắt đầu dùng Stellar Testnet.
            </Text>
          </View>
        )}

        <PressScale
          disabled={wallet.isBusy}
          onPress={() => wallet.openUrl(wallet.explorerAddressUrl)}
          style={modern.secondaryModernButton}
        >
          <Text
            style={[modern.modernButtonText, modern.secondaryModernButtonText]}
          >
            Mở trên Stellar Expert
          </Text>
        </PressScale>

        <PressScale onPress={wallet.logout} style={modern.signOutButton}>
          <Text style={modern.signOutText}>Đăng xuất (Sign out)</Text>
        </PressScale>
      </View>

      <Modal visible={isCurrencyModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Currency</Text>
            {CURRENCIES.map((currency) => {
              const isSelected = selectedCurrency === currency.code;
              return (
                <TouchableOpacity
                  key={currency.code}
                  style={[styles.currencyItem, isSelected && styles.currencyItemSelected]}
                  onPress={() => {
                    setSelectedCurrency(currency.code);
                    setIsCurrencyModalVisible(false);
                  }}
                >
                  <Text style={[styles.currencyText, isSelected && styles.currencyTextSelected]}>
                    {currency.symbol} - {currency.name} ({currency.code})
                  </Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={24} color="#0F8EA3" />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={() => setIsCurrencyModalVisible(false)}
            >
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '100%', backgroundColor: '#1E293B', borderRadius: 16, padding: 20 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  currencyItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12, marginBottom: 8, backgroundColor: '#0F172A' },
  currencyItemSelected: { borderWidth: 1, borderColor: '#0F8EA3' },
  currencyText: { color: '#8A9AA3', fontSize: 16, fontWeight: '600' },
  currencyTextSelected: { color: '#FFF' },
  closeBtn: { marginTop: 16, padding: 16, alignItems: 'center' },
  closeBtnText: { color: '#8A9AA3', fontSize: 16, fontWeight: '600' }
});
