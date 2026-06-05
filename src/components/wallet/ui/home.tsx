import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shortAddress } from '@utils/format';
import { modern } from '../modernStyles';
import { PressScale } from './primitives';
import { TokenIcon } from './token';

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
          ? 'Mainnet transactions require review and biometric confirmation'
          : 'Your account is running on the test network',
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
          ? 'Receive real XLM with QR or on-chain deposit'
          : 'Fund demo USDC/USDT after adding trustlines',
      title: network === 'mainnet' ? 'On-chain deposit' : 'Demo token faucet',
    },
    {
      accent: '#8A2BE2',
      iconName: 'swap-horizontal',
      iconSet: 'material' as const,
      subtitle:
        network === 'mainnet'
          ? 'Swap through Stellar DEX/path payment'
          : 'Swap test tokens through the demo swap desk',
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
