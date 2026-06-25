import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, SectionHeading } from '@components/wallet';
import type { WalletState } from '@hooks/useWallet';
import { styles } from '@styles/walletStyles';

type FeaturedDapp = {
  category: string;
  icon: string;
  name: string;
  url: string;
};

const featuredDapps: FeaturedDapp[] = [
  {
    category: 'Swap',
    icon: 'A',
    name: 'Aquarius Swap',
    url: 'aqua.network/swap',
  },
  {
    category: 'Market',
    icon: 'X',
    name: 'StellarX',
    url: 'stellarx.com',
  },
  {
    category: 'Portfolio',
    icon: 'S',
    name: 'StellarTerm',
    url: 'stellarterm.com',
  },
];

export function AppsScreen({ wallet }: { wallet: WalletState }) {
  const insets = useSafeAreaInsets();
  const screenContentStyle = useMemo(
    () => [styles.screenContent, { paddingTop: insets.top + 18 }],
    [insets.top],
  );
  const [request, setRequest] = useState<FeaturedDapp | null>(null);

  function connectPreview() {
    if (!request) {
      return;
    }

    wallet.setMessage(
      `${request.name} connection will be available after WalletConnect is enabled.`,
    );
    setRequest(null);
  }

  return (
    <ScrollView contentContainerStyle={screenContentStyle}>
      <View style={styles.transactionsHeader}>
        <View style={styles.heroTop}>
          <View style={styles.menuButton}>
            <Text style={styles.menuButtonText}>≡</Text>
          </View>
          <Text style={styles.screenHeaderTitleLight}>Stellar Apps</Text>
          <Text style={styles.headerRefresh}>?</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.appRow}>
          <View style={styles.appIcon}>
            <Text style={styles.appIconText}>2</Text>
          </View>
          <View style={styles.txBody}>
            <Text style={styles.txTitle}>Active connections</Text>
            <Text style={styles.txMeta}>
              WalletConnect sessions will appear here.
            </Text>
          </View>
          <Text style={styles.linkText}>›</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <SectionHeading title="Popular Stellar dApps" />
        {featuredDapps.map(dapp => (
          <View key={dapp.name} style={styles.appRow}>
            <View style={styles.appIcon}>
              <Text style={styles.appIconText}>{dapp.icon}</Text>
            </View>
            <View style={styles.txBody}>
              <Text style={styles.txTitle}>{dapp.name}</Text>
              <Text style={styles.txMeta}>{dapp.url}</Text>
              <Text style={styles.txHash}>{dapp.category}</Text>
            </View>
            <Pressable
              onPress={() => setRequest(dapp)}
              style={styles.connectButton}
            >
              <Text style={styles.connectButtonText}>Connect</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {request ? (
        <View style={styles.connectionSheet}>
          <Text style={styles.sheetTitle}>Connection request</Text>
          <Text style={styles.txMeta}>{request.url}</Text>
          <View style={styles.connectionIcons}>
            <View style={styles.appIconLarge}>
              <Text style={styles.appIconText}>{request.icon}</Text>
            </View>
            <Text style={styles.connectionDots}>•••</Text>
            <View style={styles.appIconLarge}>
              <Text style={styles.appIconText}>S</Text>
            </View>
          </View>
          <Text style={styles.helper}>
            {request.name} can connect once WalletConnect is available for this
            app.
          </Text>
          <View style={styles.buttonPair}>
            <ActionButton
              label="Reject"
              onPress={() => setRequest(null)}
              variant="secondary"
            />
            <ActionButton label="Connect" onPress={connectPreview} />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
