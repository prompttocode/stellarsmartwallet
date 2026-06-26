import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import type {
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shortAddress } from '@utils/format';
import { modern } from '../modernStyles';
import { PressScale } from './primitives';
import { TokenIcon } from './token';

type HeroMeteorStreak = {
  delay: number;
  duration: number;
  key: string;
  opacity: number;
  right: number;
  top: number;
  travelX: number;
  travelY: number;
  width: number;
};

function createHeroMeteorStreaks(): HeroMeteorStreak[] {
  const count = 3 + Math.floor(Math.random() * 3);

  return Array.from({ length: count }, (_, index) => ({
    delay: 450 + Math.random() * 5200 + index * 560,
    duration: 2100 + Math.random() * 1300,
    key: `hero-meteor-${index}`,
    opacity: 0.18 + Math.random() * 0.16,
    right: -80 + Math.random() * 170,
    top: 62 + Math.random() * 285,
    travelX: -(260 + Math.random() * 180),
    travelY: 130 + Math.random() * 150,
    width: 62 + Math.random() * 58,
  }));
}

function HeroMeteorField() {
  const streaks = useMemo(createHeroMeteorStreaks, []);

  return (
    <View pointerEvents="none" style={modern.heroMeteorLayer}>
      {streaks.map(streak => (
        <HeroMeteorLine key={streak.key} streak={streak} />
      ))}
    </View>
  );
}

function HeroMeteorLine({ streak }: { streak: HeroMeteorStreak }) {
  const progress = useSharedValue(0);
  const baseStyle = useMemo(
    () => ({
      right: streak.right,
      top: streak.top,
      width: streak.width,
    }),
    [streak.right, streak.top, streak.width],
  );
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [0, 0.1, 0.72, 1],
      [0, streak.opacity, streak.opacity * 0.85, 0],
    );

    return {
      opacity,
      transform: [
        {
          translateX: interpolate(progress.value, [0, 1], [0, streak.travelX]),
        },
        {
          translateY: interpolate(progress.value, [0, 1], [0, streak.travelY]),
        },
        { rotate: '-32deg' },
      ],
    };
  }, [streak.opacity, streak.travelX, streak.travelY]);

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withSequence(
        withDelay(
          streak.delay,
          withTiming(1, {
            duration: streak.duration,
            easing: Easing.out(Easing.cubic),
          }),
        ),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, [progress, streak.delay, streak.duration]);

  return (
    <Animated.View style={[modern.heroMeteorStreak, baseStyle, animatedStyle]}>
      <View style={modern.heroMeteorHead} />
    </Animated.View>
  );
}

export function WalletHero({
  address,
  children,
  onNetworkPress,
  onScan,
  onSearch,
  onWalletPress,
  portfolioNote,
  portfolioValue,
  network = 'testnet',
  walletName,
}: {
  address?: string;
  children?: ReactNode;
  onNetworkPress?: () => void;
  onScan: () => void;
  onSearch: () => void;
  onWalletPress?: () => void;
  portfolioNote?: string;
  portfolioValue: string;
  network?: 'testnet' | 'mainnet';
  walletName?: string;
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
    <View
      style={[modern.hero, network === 'mainnet' ? modern.heroMainnet : null]}
    >
      <View style={heroScrimStyle}>
        <HeroMeteorField />
        <View style={modern.heroContent}>
          <View style={modern.heroTop}>
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
            <Pressable onPress={onWalletPress} style={modern.addressPill}>
              <Ionicons
                color="rgba(255,255,255,0.9)"
                name="wallet-outline"
                size={15}
              />
              <Text numberOfLines={1} style={modern.addressPillText}>
                {walletName || shortAddress(address)}
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
                <Text style={modern.heroLabel}>
                  {network === 'mainnet'
                    ? 'Estimated portfolio value'
                    : 'Testnet portfolio'}
                </Text>
                <Text style={modern.heroNetworkMeta}>
                  {network === 'mainnet' ? '' : 'Stellar Testnet · demo assets'}
                </Text>
              </View>
            </View>

            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={modern.heroAmount}
            >
              {portfolioValue}
            </Text>
            {portfolioNote ? (
              <Text style={modern.heroPriceNote}>{portfolioNote}</Text>
            ) : null}

            {children}
          </View>
        </View>
      </View>
    </View>
  );
}

export function ActivateWalletNotice({ onPress }: { onPress: () => void }) {
  return (
    <View style={modern.activateNotice}>
      <View style={modern.activateIcon}>
        <Ionicons color="#B8FF45" name="flash-outline" size={22} />
      </View>
      <View style={modern.activateCopy}>
        <Text style={modern.activateTitle}>Activate wallet</Text>
        <Text style={modern.activateText}>
          Deposit XLM to start using this Mainnet wallet
        </Text>
      </View>
      <PressScale onPress={onPress} style={modern.activateButton}>
        <Text style={modern.activateButtonText}>Activate</Text>
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

export function HomeBannerCarousel({
  banners,
}: {
  banners: ImageSourcePropType[];
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [bannerWidth, setBannerWidth] = useState(0);

  useEffect(() => {
    if (bannerWidth <= 0 || banners.length <= 1) {
      return undefined;
    }

    const interval = setInterval(() => {
      setActiveIndex(currentIndex => {
        const nextIndex = (currentIndex + 1) % banners.length;

        scrollRef.current?.scrollTo({
          animated: true,
          x: nextIndex * bannerWidth,
          y: 0,
        });

        return nextIndex;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [bannerWidth, banners.length]);

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (bannerWidth <= 0) {
      return;
    }

    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / bannerWidth,
    );

    setActiveIndex(Math.max(0, Math.min(nextIndex, banners.length - 1)));
  }

  return (
    <View
      onLayout={event => setBannerWidth(event.nativeEvent.layout.width)}
      style={modern.homeBannerWrap}
    >
      <ScrollView
        horizontal
        onMomentumScrollEnd={handleMomentumEnd}
        pagingEnabled
        ref={scrollRef}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={modern.homeBannerScroll}
      >
        {banners.map((banner, index) => (
          <Image
            key={index}
            resizeMode="stretch"
            source={banner}
            style={[modern.homeBannerImage, { width: bannerWidth || 1 }]}
          />
        ))}
      </ScrollView>

      <View style={modern.homeBannerDots}>
        {banners.map((_, index) => (
          <View
            key={index}
            style={[
              modern.homeBannerDot,
              index === activeIndex ? modern.homeBannerDotActive : null,
            ]}
          />
        ))}
      </View>
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
          : 'Friendbot funds XLM; buy or receive official Testnet USDC',
      title: network === 'mainnet' ? 'On-chain deposit' : 'Testnet assets',
    },
    {
      accent: '#8A2BE2',
      iconName: 'swap-horizontal',
      iconSet: 'material' as const,
      subtitle:
        network === 'mainnet'
          ? 'Swap through Stellar DEX/path payment'
          : 'Swap XLM and USDC through Stellar Testnet paths',
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
