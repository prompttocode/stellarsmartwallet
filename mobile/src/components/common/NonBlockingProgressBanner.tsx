import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const loadingAnimation = require('@assets/lottie/loading3.json');
const successAnimation = require('@assets/lottie/Success.json');

type NonBlockingProgressBannerVariant = 'loading' | 'success';

export function NonBlockingProgressBanner({
  message = 'Loading...',
  variant = 'loading',
  visible,
}: {
  message?: string;
  variant?: NonBlockingProgressBannerVariant;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);
  const isSuccess = variant === 'success';

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: 220 });
      return undefined;
    }

    progress.value = withTiming(0, { duration: 180 });
    const timer = setTimeout(() => setMounted(false), 220);

    return () => clearTimeout(timer);
  }, [progress, visible]);

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [-80, 0]),
      },
    ],
  }));

  if (!mounted) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { paddingTop: insets.top + 8 }, bannerStyle]}
    >
      <View style={styles.card}>
        <LottieView
          key={variant}
          autoPlay
          duration={isSuccess ? 1200 : undefined}
          loop={!isSuccess}
          source={isSuccess ? successAnimation : loadingAnimation}
          style={isSuccess ? styles.successAnimation : styles.animation}
        />
        <View style={styles.copy}>
          <Text style={styles.title}>{isSuccess ? 'Success' : 'Working'}</Text>
          <Text numberOfLines={2} style={styles.message}>
            {message}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animation: {
    height: 38,
    width: 46,
  },
  successAnimation: {
    height: 50,
    width: 50,
  },
  card: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(12, 16, 18, 0.94)',
    borderColor: 'rgba(184, 255, 69, 0.18)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    maxWidth: 270,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
  },
  copy: {
    maxWidth: 176,
    minWidth: 0,
  },
  message: {
    color: '#D6DEE5',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  title: {
    color: '#B8FF45',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  wrap: {
    left: 0,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 200,
  },
});
