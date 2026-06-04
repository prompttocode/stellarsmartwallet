import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, SectionHeading } from '../../components/WalletPrimitives';
import type { WalletDemoState } from '../../hooks/useWalletDemo';
import { styles } from '../../styles/walletStyles';

type DemoDapp = {
  category: string;
  icon: string;
  name: string;
  url: string;
};

const demoDapps: DemoDapp[] = [
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

export function AppsScreen({ wallet }: { wallet: WalletDemoState }) {
  const insets = useSafeAreaInsets();
  const screenContentStyle = useMemo(
    () => [styles.screenContent, { paddingTop: insets.top + 18 }],
    [insets.top],
  );
  const [request, setRequest] = useState<DemoDapp | null>(null);

  function connectDemo() {
    if (!request) {
      return;
    }

    wallet.setMessage(
      `Đã mô phỏng kết nối ${request.name}. App chưa cấp quyền thật cho dApp.`,
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
            <Text style={styles.txMeta}>Demo UI, chưa có quyền dApp thật</Text>
          </View>
          <Text style={styles.linkText}>›</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <SectionHeading title="Popular Stellar dApps" />
        {demoDapps.map(dapp => (
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
            {request.name} muốn kết nối ví Stellar demo để xem số dư và yêu cầu
            giao dịch. Đây chỉ là mô phỏng giao diện.
          </Text>
          <View style={styles.buttonPair}>
            <ActionButton
              label="Reject"
              onPress={() => setRequest(null)}
              variant="secondary"
            />
            <ActionButton label="Connect" onPress={connectDemo} />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
