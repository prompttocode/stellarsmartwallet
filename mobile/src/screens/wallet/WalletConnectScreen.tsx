import React from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {
  ModernScreenHeader,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import { useWalletConnect } from '@contexts/WalletConnectContext';
import type { WalletState } from '@hooks/useWallet';
import { shortAddress } from '@utils/format';

function formatExpiry(expiry: number) {
  return new Date(expiry * 1000).toLocaleString();
}

export function WalletConnectScreen({
  onBack,
  onScan,
  wallet,
}: {
  onBack: () => void;
  onScan: () => void;
  wallet: WalletState;
}) {
  const screenInsetStyle = useSafeScreenInsetStyle();
  const walletConnect = useWalletConnect();

  function confirmDisconnect(topic: string, name: string) {
    Alert.alert(
      `Disconnect ${name}?`,
      'The dApp will no longer be able to request transaction signatures.',
      [
        { style: 'cancel', text: 'Keep connected' },
        {
          onPress: () => walletConnect.disconnectSession(topic),
          style: 'destructive',
          text: 'Disconnect',
        },
      ],
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[screenInsetStyle, styles.content]}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <ModernScreenHeader onBack={onBack} title="WalletConnect" />

      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Ionicons color="#FFFFFF" name="link" size={28} />
        </View>
        <Text style={styles.heroTitle}>Connect to Stellar dApps</Text>
        <Text style={styles.heroText}>
          Scan a WalletConnect QR code. Every transaction must still be reviewed
          and approved inside this wallet.
        </Text>
        <View style={styles.walletPill}>
          <View
            style={[
              styles.statusDot,
              walletConnect.configured
                ? styles.statusDotReady
                : styles.statusDotMissing,
            ]}
          />
          <Text style={styles.walletPillText}>
            {walletConnect.configured
              ? `${wallet.isMainnet ? 'Mainnet' : 'Testnet'} · ${shortAddress(
                  wallet.wallet?.address,
                )}`
              : 'Reown project ID not configured'}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.78}
          disabled={
            !walletConnect.configured ||
            walletConnect.initializing ||
            !wallet.walletCanSign ||
            !wallet.walletActive
          }
          onPress={onScan}
          style={[
            styles.scanButton,
            !walletConnect.configured ||
            !wallet.walletCanSign ||
            !wallet.walletActive
              ? styles.disabled
              : null,
          ]}
        >
          <Ionicons color="#111318" name="qr-code-outline" size={20} />
          <Text style={styles.scanButtonText}>
            {walletConnect.initializing ? 'Starting WalletConnect' : 'Scan QR'}
          </Text>
        </TouchableOpacity>
      </View>

      {!walletConnect.configured ? (
        <View style={styles.infoCard}>
          <Ionicons color="#8D5D19" name="information-circle" size={22} />
          <View style={styles.flex}>
            <Text style={styles.infoTitle}>Configuration required</Text>
            <Text style={styles.infoText}>
              Set WALLETCONNECT_PROJECT_ID in the Worker and deploy it before
              pairing a dApp.
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Connected dApps</Text>
        <Text style={styles.sectionCount}>{walletConnect.sessions.length}</Text>
      </View>

      {walletConnect.sessions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons color="#9AA0A9" name="unlink-outline" size={30} />
          <Text style={styles.emptyTitle}>No active connections</Text>
          <Text style={styles.emptyText}>
            Connected Stellar dApps will appear here.
          </Text>
        </View>
      ) : (
        walletConnect.sessions.map(session => (
          <View key={session.topic} style={styles.sessionCard}>
            <View style={styles.sessionTop}>
              <View style={styles.sessionIcon}>
                {session.icon ? (
                  <Image
                    source={{ uri: session.icon }}
                    style={styles.sessionImage}
                  />
                ) : (
                  <Ionicons color="#FFFFFF" name="globe-outline" size={22} />
                )}
              </View>
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.sessionName}>
                  {session.name}
                </Text>
                <Text numberOfLines={1} style={styles.sessionUrl}>
                  {session.url}
                </Text>
              </View>
              <View style={styles.networkBadge}>
                <Text style={styles.networkBadgeText}>
                  {session.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                </Text>
              </View>
            </View>
            <View style={styles.sessionDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Wallet</Text>
                <Text style={styles.detailValue}>
                  {shortAddress(session.address)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Expires</Text>
                <Text style={styles.detailValue}>
                  {formatExpiry(session.expiry)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() =>
                confirmDisconnect(session.topic, session.name)
              }
              style={styles.disconnectButton}
            >
              <Ionicons color="#B83D45" name="unlink-outline" size={18} />
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <View style={styles.securityCard}>
        <Ionicons color="#313740" name="shield-checkmark-outline" size={22} />
        <View style={styles.flex}>
          <Text style={styles.securityTitle}>You remain in control</Text>
          <Text style={styles.securityText}>
            dApps receive only your public address. Mainnet signing requires
            biometric confirmation and your private key never leaves Privy.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 36,
    paddingHorizontal: 18,
  },
  detailLabel: {
    color: '#8A9098',
    fontSize: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.4,
  },
  disconnectButton: {
    alignItems: 'center',
    borderColor: '#3D2527',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 44,
  },
  disconnectText: {
    color: '#B83D45',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#111318',
    borderRadius: 22,
    padding: 28,
  },
  emptyText: {
    color: '#A1A1AA',
    fontSize: 13,
    marginTop: 5,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 11,
  },
  flex: {
    flex: 1,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: '#111318',
    borderRadius: 26,
    padding: 22,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#1E232B',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  heroText: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    textAlign: 'center',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 15,
  },
  infoCard: {
    backgroundColor: '#2D2012',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 11,
    padding: 15,
  },
  infoText: {
    color: '#FFB84D',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  infoTitle: {
    color: '#FFA933',
    fontSize: 14,
    fontWeight: '800',
  },
  networkBadge: {
    backgroundColor: '#1E232B',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  networkBadgeText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '800',
  },
  scanButton: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 17,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 54,
    width: '100%',
  },
  scanButtonText: {
    color: '#111318',
    fontSize: 15,
    fontWeight: '800',
  },
  screen: {
    backgroundColor: '#000000',
    flex: 1,
  },
  sectionCount: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
    paddingHorizontal: 3,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  securityCard: {
    backgroundColor: '#111318',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 11,
    padding: 15,
  },
  securityText: {
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  securityTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  sessionCard: {
    backgroundColor: '#111318',
    borderRadius: 22,
    padding: 16,
  },
  sessionDetails: {
    backgroundColor: '#1E232B',
    borderRadius: 14,
    gap: 9,
    marginTop: 14,
    padding: 12,
  },
  sessionIcon: {
    alignItems: 'center',
    backgroundColor: '#171A20',
    borderRadius: 15,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 46,
  },
  sessionImage: {
    height: 46,
    width: 46,
  },
  sessionName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  sessionTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  sessionUrl: {
    color: '#8A9098',
    fontSize: 11,
    marginTop: 3,
  },
  statusDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusDotMissing: {
    backgroundColor: '#D99B38',
  },
  statusDotReady: {
    backgroundColor: '#20B978',
  },
  walletPill: {
    alignItems: 'center',
    backgroundColor: '#1E232B',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 7,
    marginTop: 15,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  walletPillText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
  },
});
