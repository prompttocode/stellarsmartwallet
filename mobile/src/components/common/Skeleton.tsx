import React, { useEffect } from 'react';
import {
  StyleSheet,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type SkeletonBlockProps = {
  active?: boolean;
  color?: string;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  width?: DimensionValue;
};

export function SkeletonBlock({
  active = true,
  color = 'rgba(255,255,255,0.1)',
  height = 16,
  radius = 8,
  style,
  width = '100%',
}: SkeletonBlockProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      progress.value = 1;
      return undefined;
    }

    progress.value = 0;
    progress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 760,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0, {
          duration: 760,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );

    return () => cancelAnimation(progress);
  }, [active, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: active ? 0.46 + progress.value * 0.36 : 1,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.block,
        { backgroundColor: color, borderRadius: radius, height, width },
        style,
        animatedStyle,
      ]}
    />
  );
}

export function SkeletonLine({
  height = 12,
  radius = 999,
  width = '100%',
  ...props
}: SkeletonBlockProps) {
  return (
    <SkeletonBlock height={height} radius={radius} width={width} {...props} />
  );
}

export function SkeletonCircle({
  size,
  ...props
}: Omit<SkeletonBlockProps, 'height' | 'radius' | 'width'> & {
  size: number;
}) {
  return (
    <SkeletonBlock height={size} radius={size / 2} width={size} {...props} />
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
  },
});
