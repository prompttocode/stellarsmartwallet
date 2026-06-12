import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { modern } from '../modernStyles';

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
              { position: 'absolute', width: tabWidth, alignItems: 'center' },
              indicatorStyle,
            ]}
          >
            <View style={modern.tabIndicator} />
          </Animated.View>
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

export function ModernInfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={modern.infoRow}>
      <Text style={modern.infoLabel}>{label}</Text>
      <Text style={modern.infoRowValue}>{value}</Text>
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
          <Ionicons color="#FFFFFF" name="chevron-back" size={24} />
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

export function ExplorerLink({
  disabled,
  onPress,
}: {
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <PressScale
      disabled={disabled}
      onPress={onPress}
      style={modern.explorerButton}
    >
      <Ionicons color="#0F8EA3" name="open-outline" size={18} />
      <Text style={modern.explorerText}>Open explorer</Text>
    </PressScale>
  );
}
