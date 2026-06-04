import React, {
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  Image,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getTransactionIcon,
  getTransactionTitle,
} from '../../hooks/useWalletDemo';
import type { AssetItem, BalanceItem, TransactionItem } from '../../types';
import { formatDate, shortAddress } from '../../utils/format';

const assetColors: Record<string, { bg: string; fg: string }> = {
  AQUA: { bg: '#E5F8FF', fg: '#087EA4' },
  EURC: { bg: '#EAF3FF', fg: '#1F66C2' },
  PYUSD: { bg: '#EEF5FF', fg: '#153B7D' },
  USDC: { bg: '#EAF5FF', fg: '#2374D7' },
  USDT: { bg: '#E5FAF1', fg: '#0ABF73' },
  XLM: { bg: '#EEF3F5', fg: '#132A35' },
  yUSDC: { bg: '#F0F7FF', fg: '#315A94' },
  yXLM: { bg: '#F2F6F8', fg: '#284653' },
};

const assetImages: Record<string, number> = {
  EURC: require('../../assets/images/coin/eurc.png'),
  PYUSD: require('../../assets/images/coin/pyusd.png'),
  USDC: require('../../assets/images/coin/usdc.png'),
  USDT: require('../../assets/images/coin/usdt.png'),
  XLM: require('../../assets/images/coin/xlm.png'),
};

export function useSafeScreenInsetStyle() {
  const insets = useSafeAreaInsets();

  return useMemo(
    () => [modern.screenInset, { paddingTop: insets.top + 18 }],
    [insets.top],
  );
}

export type PillTabItem<T extends string> = {
  icon: ReactNode;
  key: T;
  label: string;
};

export function PressScale({
  children,
  disabled,
  onPress,
  style,
}: {
  children: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(disabled ? 0.55 : 1, { duration: 160 }),
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

export function AnimatedPillTabBar<T extends string>({
  activeKey,
  onChange,
  tabs,
}: {
  activeKey: T;
  onChange: (key: T) => void;
  tabs: PillTabItem<T>[];
}) {
  const [barWidth, setBarWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    tabs.findIndex(tab => tab.key === activeKey),
  );
  const tabWidth = barWidth > 0 ? barWidth / tabs.length : 0;
  const indicatorX = useSharedValue(0);

  useEffect(() => {
    indicatorX.value = withSpring(activeIndex * tabWidth, {
      damping: 200,
      stiffness: 160,
    });
  }, [activeIndex, indicatorX, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View style={modern.tabBarWrap}>
      <View
        onLayout={event => setBarWidth(event.nativeEvent.layout.width)}
        style={modern.tabBar}
      >
        {tabWidth > 0 ? (
          <Animated.View
            style={[
              modern.tabIndicator,
              { width: tabWidth - 10 },
              indicatorStyle,
            ]}
          />
        ) : null}
        {tabs.map(tab => {
          const selected = activeKey === tab.key;

          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={modern.tabPress}
            >
              <View style={modern.tabItem}>
                <View
                  style={[
                    modern.tabIconWrap,
                    selected ? modern.tabIconWrapActive : null,
                  ]}
                >
                  {tab.icon}
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    modern.tabText,
                    selected ? modern.tabTextActive : null,
                  ]}
                >
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ScreenTransition({
  children,
  screenKey,
}: {
  children: ReactNode;
  screenKey: string;
}) {
  const progress = useSharedValue(1);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 220 });
  }, [progress, screenKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [14, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.99, 1]) },
    ],
  }));

  return (
    <Animated.View key={screenKey} style={[modern.screenFill, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

export function TokenIcon({
  assetCode,
  size = 46,
}: {
  assetCode: string;
  size?: number;
}) {
  const colors = assetColors[assetCode] || { bg: '#EEF3F5', fg: '#24495A' };
  const image = assetImages[assetCode];

  return (
    <View
      style={[
        modern.tokenIcon,
        {
          backgroundColor: colors.bg,
          height: size,
          width: size,
        },
      ]}
    >
      {image ? (
        <Image
          resizeMode="contain"
          source={image}
          style={{ height: size * 0.7, width: size * 0.7 }}
        />
      ) : (
        <Text style={[modern.tokenIconText, { color: colors.fg }]}>
          {assetCode.slice(0, 1)}
        </Text>
      )}
    </View>
  );
}

export function WalletHero({
  address,
  children,
  email,
  hidden,
  onHideToggle,
  onMenu,
  onNetworkPress,
  onScan,
  onSearch,
  onWalletPress,
  portfolioValue,
  network = 'testnet',
}: {
  address?: string;
  children?: ReactNode;
  email?: string;
  hidden: boolean;
  onHideToggle: () => void;
  onMenu: () => void;
  onNetworkPress?: () => void;
  onScan: () => void;
  onSearch: () => void;
  onWalletPress?: () => void;
  portfolioValue: string;
  network?: 'testnet' | 'mainnet';
}) {
  const [networkPillExpanded, setNetworkPillExpanded] = useState(false);
  const networkPillWidth = useSharedValue(72);
  const closeNetworkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const hideNetworkTextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const insets = useSafeAreaInsets();
  const heroScrimStyle = useMemo(
    () => [modern.heroScrim, { paddingTop: insets.top + 12 }],
    [insets.top],
  );
  const networkPillAnimatedStyle = useAnimatedStyle(() => ({
    width: networkPillWidth.value,
  }));

  useEffect(
    () => () => {
      if (closeNetworkTimerRef.current) {
        clearTimeout(closeNetworkTimerRef.current);
      }

      if (hideNetworkTextTimerRef.current) {
        clearTimeout(hideNetworkTextTimerRef.current);
      }
    },
    [],
  );

  function clearNetworkPillTimers() {
    if (closeNetworkTimerRef.current) {
      clearTimeout(closeNetworkTimerRef.current);
      closeNetworkTimerRef.current = null;
    }

    if (hideNetworkTextTimerRef.current) {
      clearTimeout(hideNetworkTextTimerRef.current);
      hideNetworkTextTimerRef.current = null;
    }
  }

  function handleNetworkPress() {
    clearNetworkPillTimers();
    setNetworkPillExpanded(true);
    networkPillWidth.value = withTiming(118, { duration: 180 });
    onNetworkPress?.();

    closeNetworkTimerRef.current = setTimeout(() => {
      networkPillWidth.value = withTiming(72, { duration: 180 });
      hideNetworkTextTimerRef.current = setTimeout(() => {
        setNetworkPillExpanded(false);
      }, 130);
    }, 760);
  }

  return (
    <View style={modern.hero}>
      <View style={heroScrimStyle}>
        <View style={modern.heroTop}>
          <PressScale onPress={onMenu} style={modern.heroIconButton}>
            <Ionicons color="#FFFFFF" name="menu" size={23} />
          </PressScale>
          <Pressable onPress={handleNetworkPress}>
            <Animated.View
              style={[modern.networkPill, networkPillAnimatedStyle]}
            >
              <TokenIcon assetCode="XLM" size={25} />
              {networkPillExpanded ? (
                <Text numberOfLines={1} style={modern.networkPillText}>
                  {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                </Text>
              ) : null}
              <MaterialCommunityIcons
                color="rgba(255,255,255,0.88)"
                name="autorenew"
                size={17}
              />
            </Animated.View>
          </Pressable>
          <Pressable
            onPress={onWalletPress || onMenu}
            style={modern.addressPill}
          >
            <Ionicons
              color="rgba(255,255,255,0.9)"
              name="wallet-outline"
              size={15}
            />
            <Text numberOfLines={1} style={modern.addressPillText}>
              {shortAddress(address)}
            </Text>
          </Pressable>
          <View style={modern.heroActions}>
            <PressScale onPress={onSearch} style={modern.heroIconButton}>
              <Ionicons color="#FFFFFF" name="search" size={21} />
            </PressScale>
            <PressScale onPress={onScan} style={modern.heroIconButton}>
              <Ionicons color="#FFFFFF" name="scan-outline" size={21} />
            </PressScale>
          </View>
        </View>

        <View style={modern.heroCard}>
          <View style={modern.heroCardHeader}>
            <View>
              <Text style={modern.heroLabel}>Estimated portfolio value</Text>
              <Text style={modern.heroNetworkMeta}>
                {network === 'mainnet'
                  ? 'Stellar Mainnet · real assets'
                  : 'Stellar Testnet · demo assets'}
              </Text>
            </View>
            <PressScale onPress={onHideToggle} style={modern.heroEyeButton}>
              <Ionicons
                color="#3867D6"
                name={hidden ? 'eye-off-outline' : 'eye-outline'}
                size={20}
              />
            </PressScale>
          </View>

          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={modern.heroAmount}
          >
            {hidden ? '••••' : portfolioValue}
          </Text>

          <View style={modern.heroAccountRow}>
            <View style={modern.heroAccountMark}>
              <Text style={modern.heroAccountMarkText}>S</Text>
            </View>
            <View style={modern.heroAccountCopy}>
              <Text numberOfLines={1} style={modern.heroAccountTitle}>
                Privy Stellar wallet
              </Text>
              <Text numberOfLines={1} style={modern.heroSubValue}>
                {email || shortAddress(address)}
              </Text>
            </View>
            <View
              style={[
                modern.heroNetworkBadge,
                network === 'mainnet' ? modern.heroNetworkBadgeMainnet : null,
              ]}
            >
              <Text
                style={[
                  modern.heroNetworkBadgeText,
                  network === 'mainnet'
                    ? modern.heroNetworkBadgeTextMainnet
                    : null,
                ]}
              >
                {network === 'mainnet' ? 'LIVE' : 'DEMO'}
              </Text>
            </View>
          </View>

          {children}
        </View>
      </View>
    </View>
  );
}

export function ActivateWalletNotice({ onPress }: { onPress: () => void }) {
  return (
    <View style={modern.activateNotice}>
      <View style={modern.activateIcon}>
        <Ionicons color="#0F8EA3" name="flash-outline" size={24} />
      </View>
      <View style={modern.activateCopy}>
        <Text style={modern.activateTitle}>Activate wallet</Text>
        <Text style={modern.activateText}>
          Deposit XLM to start using this Mainnet wallet
        </Text>
      </View>
      <PressScale onPress={onPress} style={modern.activateButton}>
        <Text style={modern.activateButtonText}>Show deposit QR</Text>
      </PressScale>
    </View>
  );
}

export function QuickActionGrid({
  actions,
}: {
  actions: {
    icon: ReactNode;
    key: string;
    label: string;
    onPress: () => void;
  }[];
}) {
  return (
    <View style={modern.quickGrid}>
      {actions.map(action => (
        <PressScale
          key={action.key}
          onPress={action.onPress}
          style={modern.quickItem}
        >
          <View style={modern.quickCircle}>{action.icon}</View>
          <Text style={modern.quickLabel}>{action.label}</Text>
        </PressScale>
      ))}
    </View>
  );
}

export function PromoCarousel({
  network = 'testnet',
}: {
  network?: 'testnet' | 'mainnet';
}) {
  const promos = [
    {
      accent: '#4D46E8',
      iconName: 'rocket-outline',
      iconSet: 'ionicons' as const,
      subtitle:
        network === 'mainnet'
          ? 'Giao dịch mainnet cần review và biometric'
          : 'Tài khoản đang chạy trên mạng thử nghiệm',
      title:
        network === 'mainnet'
          ? 'Stellar Mainnet ready'
          : 'Stellar Testnet ready',
    },
    {
      accent: '#FFFFFF',
      iconName: 'coin',
      iconSet: 'material' as const,
      subtitle:
        network === 'mainnet'
          ? 'Nhận XLM thật bằng QR/on-chain deposit'
          : 'Nạp USDC/USDT demo sau khi add trustline',
      title: network === 'mainnet' ? 'On-chain deposit' : 'Demo token faucet',
    },
    {
      accent: '#8A2BE2',
      iconName: 'swap-horizontal',
      iconSet: 'material' as const,
      subtitle:
        network === 'mainnet'
          ? 'Swap qua Stellar DEX/path payment'
          : 'Đổi token test qua quầy swap demo',
      title: network === 'mainnet' ? 'Stellar DEX swap' : 'Swap test assets',
    },
  ];

  return (
    <ScrollView
      contentContainerStyle={modern.promoTrack}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {promos.map(promo => {
        const dark = promo.accent !== '#FFFFFF';

        return (
          <View
            key={promo.title}
            style={[
              modern.promoCard,
              {
                backgroundColor: promo.accent,
              },
            ]}
          >
            <View style={modern.promoIcon}>
              {promo.iconSet === 'ionicons' ? (
                <Ionicons color="#24495A" name={promo.iconName} size={18} />
              ) : (
                <MaterialCommunityIcons
                  color="#24495A"
                  name={promo.iconName}
                  size={18}
                />
              )}
            </View>
            <Text
              numberOfLines={2}
              style={[modern.promoTitle, dark ? modern.promoTitleDark : null]}
            >
              {promo.title}
            </Text>
            <Text
              numberOfLines={2}
              style={[modern.promoText, dark ? modern.promoTextDark : null]}
            >
              {promo.subtitle}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

export function SectionHeader({
  action,
  title,
}: {
  action?: ReactNode;
  title: string;
}) {
  return (
    <View style={modern.sectionHeader}>
      <Text style={modern.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function AssetListItem({
  asset,
  disabled,
  index,
  onAdd,
  onSend,
  onTopUp,
}: {
  asset: BalanceItem;
  disabled?: boolean;
  index: number;
  onAdd: (assetCode: string) => void;
  onSend: (assetCode: string) => void;
  onTopUp: (assetCode: string) => void;
}) {
  const canUse = asset.isNative || asset.trusted;
  const buttonLabel = canUse
    ? asset.network === 'mainnet'
      ? 'Deposit'
      : 'Faucet'
    : 'Add';
  const buttonAction = canUse ? onTopUp : onAdd;
  const badgeLabel = !canUse
    ? 'Trustline needed'
    : asset.demo
    ? 'Demo'
    : asset.trustLevel === 'verified'
    ? 'Verified'
    : 'Unverified';
  const subtitle = asset.isNative
    ? 'Lumens · Native Stellar coin'
    : asset.trusted
    ? `${asset.displayName} · ${asset.homeDomain || asset.trustLevel}`
    : `${asset.displayName} · add trustline first`;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 45).duration(280)}
      style={modern.assetModernRow}
    >
      <PressScale
        disabled={!canUse}
        onPress={() => canUse && onSend(asset.assetCode)}
        style={modern.assetPressArea}
      >
        <TokenIcon assetCode={asset.assetCode} />
        <View style={modern.assetModernBody}>
          <View style={modern.assetNameLine}>
            <Text style={modern.assetModernName}>{asset.assetCode}</Text>
            <View
              style={[
                modern.assetBadge,
                badgeLabel === 'Demo'
                  ? modern.assetBadgeDemo
                  : badgeLabel === 'Verified'
                  ? modern.assetBadgeVerified
                  : badgeLabel === 'Trustline needed'
                  ? modern.assetBadgeTrustline
                  : modern.assetBadgeUnverified,
              ]}
            >
              <Text
                style={[
                  modern.assetBadgeText,
                  badgeLabel === 'Demo'
                    ? modern.assetBadgeTextDemo
                    : badgeLabel === 'Verified'
                    ? modern.assetBadgeTextVerified
                    : badgeLabel === 'Trustline needed'
                    ? modern.assetBadgeTextTrustline
                    : modern.assetBadgeTextUnverified,
                ]}
              >
                {badgeLabel}
              </Text>
            </View>
          </View>
          <Text style={modern.assetModernMeta}>{subtitle}</Text>
        </View>
        <View style={modern.assetModernRight}>
          <Text style={modern.assetModernBalance}>
            {canUse ? asset.balance : 'Not added'}
          </Text>
          <Text style={modern.assetModernCode}>{asset.assetCode}</Text>
        </View>
      </PressScale>
      <PressScale
        disabled={disabled}
        onPress={() => buttonAction(asset.assetCode)}
        style={canUse ? modern.assetTopUpButton : modern.assetAddButton}
      >
        <Text style={modern.assetButtonText}>{buttonLabel}</Text>
      </PressScale>
    </Animated.View>
  );
}

export function TokenPillSelector({
  assets,
  onSelect,
  selectedAssetCode,
}: {
  assets: AssetItem[];
  onSelect: (assetCode: string) => void;
  selectedAssetCode: string;
}) {
  return (
    <View style={modern.tokenPills}>
      {assets.map(asset => {
        const selected = asset.assetCode === selectedAssetCode;

        return (
          <PressScale
            key={`${asset.assetCode}:${asset.assetIssuer || 'native'}`}
            onPress={() => onSelect(asset.assetCode)}
            style={[modern.tokenPill, selected ? modern.tokenPillActive : null]}
          >
            <Text
              style={[
                modern.tokenPillText,
                selected ? modern.tokenPillTextActive : null,
              ]}
            >
              {asset.assetCode}
            </Text>
          </PressScale>
        );
      })}
    </View>
  );
}

export function TransactionListItem({
  onPress,
  transaction,
}: {
  onPress: () => void;
  transaction: TransactionItem;
}) {
  const isReceived = transaction.direction === 'received';
  const isTrustline = transaction.operation === 'change_trust';
  const amountPrefix = isTrustline ? '' : isReceived ? '+' : '-';
  const amountText = isTrustline
    ? 'Trustline'
    : `${amountPrefix}${transaction.amount} ${transaction.assetCode}`;

  return (
    <PressScale onPress={onPress} style={modern.txModernRow}>
      <TokenIcon assetCode={transaction.assetCode} size={42} />
      <View style={modern.txModernBody}>
        <Text style={modern.txModernTitle}>
          {getTransactionTitle(transaction)}
        </Text>
        <Text style={modern.txModernMeta}>
          {getTransactionIcon(transaction)}{' '}
          {isReceived
            ? shortAddress(transaction.from)
            : shortAddress(transaction.to)}{' '}
          · {formatDate(transaction.createdAt)}
        </Text>
      </View>
      <Text
        style={[
          modern.txModernAmount,
          isReceived || isTrustline
            ? modern.txAmountPositive
            : modern.txAmountNegative,
        ]}
      >
        {amountText}
      </Text>
    </PressScale>
  );
}

export function SegmentedFilter<T extends string>({
  active,
  onChange,
  options,
}: {
  active: T;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
}) {
  return (
    <View style={modern.segmented}>
      {options.map(option => {
        const selected = option.value === active;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              modern.segmentItem,
              selected ? modern.segmentItemActive : null,
              pressed && !selected ? modern.segmentItemPressed : null,
            ]}
          >
            <Text
              style={[
                modern.segmentText,
                selected ? modern.segmentTextActive : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ModernScreenHeader({
  onBack,
  subtitle,
  title,
}: {
  onBack?: () => void;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={modern.modernHeader}>
      {onBack ? (
        <PressScale onPress={onBack} style={modern.backButton}>
          <Ionicons color="#24495A" name="chevron-back" size={26} />
        </PressScale>
      ) : null}
      <View style={modern.modernHeaderCopy}>
        <Text style={modern.modernHeaderTitle}>{title}</Text>
        {subtitle ? (
          <Text style={modern.modernHeaderSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function calculateTotalUsdValue(balances: BalanceItem[]): number {
  return balances.reduce((sum, balance) => {
    const amount = Number(balance.balance) || 0;

    if (balance.assetCode === 'XLM') {
      return sum + amount * 0.12;
    }

    if (
      balance.assetCode === 'EURC' ||
      balance.assetCode === 'PYUSD' ||
      balance.assetCode === 'USDC' ||
      balance.assetCode === 'USDT' ||
      balance.assetCode === 'yUSDC'
    ) {
      return sum + amount;
    }

    return sum;
  }, 0);
}

export function getModernAssets(
  balances: BalanceItem[],
  visibleAssets: AssetItem[],
) {
  return visibleAssets.map<BalanceItem>(asset => {
    const balance = balances.find(
      item =>
        item.assetCode === asset.assetCode &&
        (item.assetIssuer || null) === (asset.assetIssuer || null),
    );

    if (balance) {
      return balance;
    }

    return {
      ...asset,
      balance: '0',
      exists: false,
      trusted: asset.isNative,
    };
  });
}

export function useDistinctAssetPair(assets: AssetItem[], initialFrom: string) {
  return useMemo(() => {
    const fallback = assets[0]?.assetCode || 'XLM';
    const from = assets.some(asset => asset.assetCode === initialFrom)
      ? initialFrom
      : fallback;
    const to =
      assets.find(asset => asset.assetCode !== from)?.assetCode ||
      (from === 'XLM' ? 'USDC' : 'XLM');

    return { from, to };
  }, [assets, initialFrom]);
}

export const modern = StyleSheet.create({
  screenFill: {
    flex: 1,
  },
  screen: {
    backgroundColor: 'transparent',
    flexGrow: 1,
    paddingBottom: 126,
  },
  portfolioRoot: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  portfolioBackgroundImage: {
    opacity: 0.98,
  },
  screenInset: {
    gap: 18,
    paddingBottom: 126,
  },
  hero: {
    backgroundColor: 'transparent',
    minHeight: 492,
    overflow: 'hidden',
  },
  heroScrim: {
    backgroundColor: 'rgba(18, 42, 96, 0.12)',
    flex: 1,
    paddingBottom: 30,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  heroIconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(14, 31, 74, 0.22)',
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  heroIconText: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '600',
  },
  networkPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(14, 31, 74, 0.24)',
    borderColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
    borderRadius: 20,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 5,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingLeft: 6,
    paddingRight: 8,
  },
  networkPillText: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  networkChevron: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 16,
    fontWeight: '800',
  },
  addressPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 40,
    justifyContent: 'center',
    minWidth: 70,
    paddingHorizontal: 10,
  },
  addressPillText: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 6,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.78)',
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 42,
    padding: 20,
    shadowColor: '#17264F',
    shadowOffset: { height: 18, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 34,
  },
  heroCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  heroValue: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingTop: 52,
  },
  heroLabel: {
    color: '#6D7F98',
    fontSize: 13,
    fontWeight: '800',
  },
  heroEye: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '800',
  },
  heroEyeButton: {
    alignItems: 'center',
    backgroundColor: '#EEF4FF',
    borderRadius: 18,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  heroNetworkMeta: {
    color: '#9AA7BA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  heroAmount: {
    color: '#17233D',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 16,
  },
  heroAccountRow: {
    alignItems: 'center',
    backgroundColor: '#F5F8FF',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    padding: 10,
  },
  heroAccountMark: {
    alignItems: 'center',
    backgroundColor: '#3867D6',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  heroAccountMarkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  heroAccountCopy: {
    flex: 1,
    gap: 2,
  },
  heroAccountTitle: {
    color: '#17233D',
    fontSize: 13,
    fontWeight: '900',
  },
  heroSubValue: {
    color: '#71839B',
    fontSize: 12,
    fontWeight: '700',
  },
  heroNetworkBadge: {
    backgroundColor: '#EDF4FF',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  heroNetworkBadgeMainnet: {
    backgroundColor: '#EAF8F1',
  },
  heroNetworkBadgeText: {
    color: '#3867D6',
    fontSize: 10,
    fontWeight: '900',
  },
  heroNetworkBadgeTextMainnet: {
    color: '#0B9361',
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  quickItem: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  quickCircle: {
    alignItems: 'center',
    backgroundColor: '#EEF4FF',
    borderColor: '#DCE8FF',
    borderRadius: 22,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  quickIcon: {
    color: '#FFFFFF',
    fontSize: 33,
    fontWeight: '500',
  },
  quickLabel: {
    color: '#243653',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  belowHero: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    gap: 16,
    marginTop: 20,
    paddingBottom: 24,
    paddingTop: 28,
  },
  promoTrack: {
    gap: 12,
    paddingHorizontal: 18,
  },
  promoCard: {
    borderRadius: 18,
    gap: 10,
    minHeight: 128,
    padding: 18,
    width: 226,
  },
  promoIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  promoIconText: {
    color: '#24495A',
    fontSize: 18,
    fontWeight: '900',
  },
  promoTitle: {
    color: '#24495A',
    fontSize: 17,
    fontWeight: '900',
  },
  promoTitleDark: {
    color: '#FFFFFF',
  },
  promoText: {
    color: '#7E909A',
    fontSize: 13,
    lineHeight: 18,
  },
  promoTextDark: {
    color: 'rgba(255,255,255,0.72)',
  },
  activateNotice: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D7EEF3',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 18,
    padding: 14,
    shadowColor: '#1F3B4D',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
  },
  activateIcon: {
    alignItems: 'center',
    backgroundColor: '#EAF7FA',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  activateCopy: {
    flex: 1,
    gap: 3,
  },
  activateTitle: {
    color: '#24495A',
    fontSize: 15,
    fontWeight: '900',
  },
  activateText: {
    color: '#6A7E88',
    fontSize: 12,
    lineHeight: 17,
  },
  activateButton: {
    alignItems: 'center',
    backgroundColor: '#0ABF73',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  activateButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EEF8',
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
    marginHorizontal: 18,
    padding: 18,
    shadowColor: '#1F3B4D',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    color: '#17233D',
    fontSize: 19,
    fontWeight: '900',
  },
  sectionActionText: {
    color: '#3867D6',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionIconButton: {
    alignItems: 'center',
    backgroundColor: '#F2F6FF',
    borderRadius: 16,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  assetModernRow: {
    borderBottomColor: '#EDF2F4',
    borderBottomWidth: 1,
    gap: 10,
    paddingVertical: 14,
  },
  assetPressArea: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  tokenIcon: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
  },
  tokenIconText: {
    fontSize: 18,
    fontWeight: '900',
  },
  assetModernBody: {
    flex: 1,
    gap: 4,
  },
  assetNameLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  assetModernName: {
    color: '#24495A',
    fontSize: 17,
    fontWeight: '900',
  },
  assetBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  assetBadgeDemo: {
    backgroundColor: '#EEF3F5',
  },
  assetBadgeTrustline: {
    backgroundColor: '#FFF5E7',
  },
  assetBadgeUnverified: {
    backgroundColor: '#FFF1F3',
  },
  assetBadgeVerified: {
    backgroundColor: '#E7F9F1',
  },
  assetBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  assetBadgeTextDemo: {
    color: '#536873',
  },
  assetBadgeTextTrustline: {
    color: '#A86200',
  },
  assetBadgeTextUnverified: {
    color: '#C01048',
  },
  assetBadgeTextVerified: {
    color: '#0ABF73',
  },
  assetModernMeta: {
    color: '#8B99A3',
    fontSize: 14,
  },
  assetModernRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  assetModernBalance: {
    color: '#1F3440',
    fontSize: 16,
    fontWeight: '900',
  },
  assetModernCode: {
    color: '#9AA7AE',
    fontSize: 12,
    fontWeight: '800',
  },
  assetTopUpButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#E7F9F1',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  assetAddButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#EEF3F5',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  assetButtonText: {
    color: '#0ABF73',
    fontSize: 13,
    fontWeight: '900',
  },
  tabBarWrap: {
    bottom: 22,
    left: 0,
    paddingHorizontal: 24,
    position: 'absolute',
    right: 0,
  },
  tabBar: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: 'rgba(195,215,222,0.72)',
    borderRadius: 34,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 68,
    overflow: 'hidden',
    padding: 5,
    shadowColor: '#24495A',
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
  },
  tabIndicator: {
    backgroundColor: '#E8F7F9',
    borderRadius: 28,
    bottom: 5,
    left: 5,
    position: 'absolute',
    top: 5,
  },
  tabPress: {
    flex: 1,
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    justifyContent: 'center',
  },
  tabIcon: {
    color: '#8A9AA3',
    fontSize: 20,
    fontWeight: '900',
  },
  tabIconActive: {
    color: '#0F8EA3',
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: {
    opacity: 1,
  },
  tabText: {
    color: '#8A9AA3',
    fontSize: 11,
    fontWeight: '800',
  },
  tabTextActive: {
    color: '#24495A',
  },
  appStatus: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: '#E4EEF2',
    borderRadius: 20,
    borderWidth: 1,
    bottom: 98,
    flexDirection: 'row',
    gap: 8,
    left: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    position: 'absolute',
    right: 18,
  },
  statusText: {
    color: '#6A7E88',
    flex: 1,
    fontSize: 12,
  },
  tokenPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tokenPill: {
    backgroundColor: '#EEF3F5',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  tokenPillActive: {
    backgroundColor: '#0F8EA3',
  },
  tokenPillText: {
    color: '#536873',
    fontSize: 13,
    fontWeight: '900',
  },
  tokenPillTextActive: {
    color: '#FFFFFF',
  },
  modernHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 18,
    marginTop: 16,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    shadowColor: '#24495A',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    width: 48,
  },
  backButtonText: {
    color: '#24495A',
    fontSize: 34,
    fontWeight: '600',
    lineHeight: 40,
  },
  modernHeaderCopy: {
    flex: 1,
    gap: 3,
  },
  modernHeaderTitle: {
    color: '#24495A',
    fontSize: 28,
    fontWeight: '900',
  },
  modernHeaderSubtitle: {
    color: '#7E909A',
    fontSize: 13,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    gap: 14,
    marginHorizontal: 18,
    padding: 20,
  },
  swapField: {
    backgroundColor: '#F4F8FA',
    borderRadius: 22,
    gap: 10,
    padding: 16,
  },
  swapFieldTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  swapLabel: {
    color: '#8A9AA3',
    fontSize: 13,
    fontWeight: '800',
  },
  swapAmountInput: {
    color: '#24495A',
    fontSize: 34,
    fontWeight: '800',
    minHeight: 58,
  },
  swapAmountValue: {
    color: '#24495A',
    fontSize: 34,
    fontWeight: '800',
    minHeight: 58,
  },
  swapMiddleButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3ECEF',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    marginVertical: -5,
    shadowColor: '#24495A',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    width: 48,
  },
  swapMiddleText: {
    color: '#0F8EA3',
    fontSize: 23,
    fontWeight: '900',
  },
  rateCard: {
    alignItems: 'center',
    backgroundColor: '#F4F8FA',
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryModernButton: {
    alignItems: 'center',
    backgroundColor: '#0ABF73',
    borderRadius: 22,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryModernButton: {
    alignItems: 'center',
    backgroundColor: '#E7F9F1',
    borderRadius: 22,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modernButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryModernButtonText: {
    color: '#0ABF73',
  },
  segmented: {
    backgroundColor: '#EAF1F4',
    borderRadius: 22,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmentItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#24495A',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 9,
  },
  segmentItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  segmentText: {
    color: '#6A7E88',
    fontSize: 13,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: '#24495A',
  },
  txModernRow: {
    alignItems: 'center',
    borderBottomColor: '#EDF2F4',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
  },
  txModernBody: {
    flex: 1,
    gap: 4,
  },
  txModernTitle: {
    color: '#24495A',
    fontSize: 15,
    fontWeight: '900',
  },
  txModernMeta: {
    color: '#8A9AA3',
    fontSize: 12,
  },
  txModernAmount: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  txAmountPositive: {
    color: '#0ABF73',
  },
  txAmountNegative: {
    color: '#D84C5F',
  },
  emptyModern: {
    alignItems: 'center',
    backgroundColor: '#F4F8FA',
    borderRadius: 22,
    gap: 6,
    padding: 22,
  },
  emptyModernTitle: {
    color: '#24495A',
    fontSize: 16,
    fontWeight: '900',
  },
  emptyModernText: {
    color: '#7E909A',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  infoBlock: {
    backgroundColor: '#F4F8FA',
    borderRadius: 20,
    gap: 7,
    padding: 14,
  },
  infoLabel: {
    color: '#8A9AA3',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: '#24495A',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoRowValue: {
    color: '#24495A',
    fontSize: 13,
    fontWeight: '900',
  },
  activeWalletCard: {
    alignItems: 'center',
    backgroundColor: '#EAF7FA',
    borderColor: '#C5E9EF',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  walletOrb: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  activeWalletName: {
    color: '#24495A',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  activeWalletAddress: {
    color: '#667985',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  walletBadge: {
    backgroundColor: '#E7F9F1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  walletBadgeText: {
    color: '#0ABF73',
    fontSize: 12,
    fontWeight: '900',
  },
  walletListRow: {
    borderColor: '#E4EEF2',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  walletListTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  walletListIcon: {
    alignItems: 'center',
    backgroundColor: '#EAF7FA',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  walletListBody: {
    flex: 1,
    gap: 4,
  },
  walletNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  walletListName: {
    color: '#24495A',
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  walletListMeta: {
    color: '#7E909A',
    fontSize: 12,
    fontWeight: '800',
  },
  walletActiveBadge: {
    backgroundColor: '#E7F9F1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  walletActiveText: {
    color: '#0ABF73',
    fontSize: 11,
    fontWeight: '900',
  },
  walletRenameInput: {
    backgroundColor: '#F4F8FA',
    borderColor: '#D8E7EC',
    borderRadius: 8,
    borderWidth: 1,
    color: '#24495A',
    fontSize: 14,
    fontWeight: '800',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  walletActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  walletMiniButton: {
    backgroundColor: '#EAF7FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  walletMiniButtonText: {
    color: '#0F8EA3',
    fontSize: 12,
    fontWeight: '900',
  },
  walletArchiveButton: {
    backgroundColor: '#FFF1F3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  walletArchiveText: {
    color: '#C01048',
    fontSize: 12,
    fontWeight: '900',
  },
  walletButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: '#FFF0F2',
    borderRadius: 22,
    flex: 1,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  signOutText: {
    color: '#D84C5F',
    fontSize: 16,
    fontWeight: '900',
  },
  topUpRow: {
    alignItems: 'center',
    borderBottomColor: '#EDF2F4',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
  },
  disabledActionRow: {
    alignItems: 'center',
    backgroundColor: '#F4F8FA',
    borderColor: '#E2EBEF',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    opacity: 0.78,
    padding: 14,
  },
  successOrb: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#E7F9F1',
    borderColor: '#BDEFD8',
    borderRadius: 42,
    borderWidth: 1,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  successOrbText: {
    color: '#0ABF73',
    fontSize: 42,
    fontWeight: '900',
  },
  successModernTitle: {
    color: '#24495A',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  successModernText: {
    color: '#7E909A',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  reviewModernBox: {
    backgroundColor: '#F4F8FA',
    borderRadius: 20,
    gap: 5,
    padding: 14,
  },
  reviewModernTitle: {
    color: '#24495A',
    fontSize: 15,
    fontWeight: '900',
  },
  reviewModernText: {
    color: '#7E909A',
    fontSize: 13,
    lineHeight: 18,
  },
  modernInput: {
    backgroundColor: '#F4F8FA',
    borderColor: '#E2EBEF',
    borderRadius: 20,
    borderWidth: 1,
    color: '#24495A',
    fontSize: 16,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  assetSearchInput: {
    height: 44,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  qrCard: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F4F8FA',
    borderColor: '#DFE9ED',
    borderRadius: 28,
    borderWidth: 1,
    gap: 8,
    height: 192,
    justifyContent: 'center',
    width: 192,
  },
  qrMark: {
    color: '#0F8EA3',
    fontSize: 62,
    fontWeight: '900',
  },
  qrTinyText: {
    color: '#7E909A',
    fontSize: 12,
    fontWeight: '900',
  },
});
