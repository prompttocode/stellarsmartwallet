import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { StellarNetwork } from '@app-types';

type AppSplashScreenProps = {
  durationMs?: number;
  network: StellarNetwork;
};

const ledgerRain = [
  { left: '7%', top: '9%', value: '01' },
  { left: '18%', top: '24%', value: '$' },
  { left: '29%', top: '12%', value: '10' },
  { left: '38%', top: '34%', value: 'XLM' },
  { left: '53%', top: '16%', value: '001' },
  { left: '66%', top: '29%', value: '$' },
  { left: '78%', top: '8%', value: '11' },
  { left: '88%', top: '23%', value: '010' },
  { left: '12%', top: '62%', value: '100' },
  { left: '24%', top: '76%', value: '$' },
  { left: '45%', top: '68%', value: '01' },
  { left: '61%', top: '82%', value: 'XLM' },
  { left: '73%', top: '64%', value: '10' },
  { left: '86%', top: '74%', value: '$' },
] as const;

export function AppSplashScreen({
  durationMs = 3000,
  network,
}: AppSplashScreenProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const networkLabel = useMemo(() => network.toUpperCase(), [network]);

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: false,
    }).start();
  }, [durationMs, progress]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 1300,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 1300,
          easing: Easing.in(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [pulse]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const progressSpark = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 142],
  });
  const orbitRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const rainTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-42, 118],
  });
  const rainOpacity = progress.interpolate({
    inputRange: [0, 0.22, 0.82, 1],
    outputRange: [0, 0.18, 0.18, 0],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.34, 0.78],
  });
  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.16],
  });

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.backgroundRingLarge} />
        <View style={styles.backgroundRingSmall} />
        {ledgerRain.map((item, index) => (
          <Animated.Text
            key={`${item.value}-${index}`}
            style={[
              styles.rainGlyph,
              {
                left: item.left,
                opacity: rainOpacity,
                top: item.top,
                transform: [
                  {
                    translateY: rainTranslate,
                  },
                ],
              },
            ]}
          >
            {item.value}
          </Animated.Text>
        ))}
      </View>

      <View style={styles.center}>
        <View style={styles.logoStage}>
          <Animated.View
            style={[
              styles.iconGlow,
              {
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />
          <View style={styles.orbitShadow} />
          <Animated.View
            style={[
              styles.orbitRing,
              {
                transform: [{ rotate: orbitRotate }],
              },
            ]}
          >
            <View style={styles.orbitDot} />
          </Animated.View>
          <View style={styles.orb}>
            <MaterialCommunityIcons
              color="#B8FF00"
              name="wallet-outline"
              size={32}
            />
          </View>
        </View>

        <Text style={styles.title}>STELLAR SMART WALLET</Text>
        <Text style={styles.subtitle}>INITIALIZING {networkLabel}...</Text>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { width: progressWidth }]}
          />
          <Animated.View
            style={[
              styles.progressSpark,
              {
                transform: [{ translateX: progressSpark }],
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#101313',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backgroundRingLarge: {
    borderColor: 'rgba(184, 255, 0, 0.04)',
    borderRadius: 220,
    borderWidth: 1,
    height: 440,
    left: -84,
    position: 'absolute',
    top: 122,
    width: 440,
  },
  backgroundRingSmall: {
    borderColor: 'rgba(184, 255, 0, 0.06)',
    borderRadius: 148,
    borderWidth: 1,
    bottom: 84,
    height: 296,
    position: 'absolute',
    right: -118,
    width: 296,
  },
  center: {
    alignItems: 'center',
    marginTop: -20,
    width: 210,
  },
  iconGlow: {
    backgroundColor: '#B8FF00',
    borderRadius: 42,
    height: 84,
    position: 'absolute',
    shadowColor: '#B8FF00',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    width: 84,
  },
  logoStage: {
    alignItems: 'center',
    height: 154,
    justifyContent: 'center',
    width: 154,
  },
  orb: {
    alignItems: 'center',
    backgroundColor: '#171B1A',
    borderColor: 'rgba(184, 255, 0, 0.34)',
    borderRadius: 42,
    borderWidth: 1.5,
    height: 84,
    justifyContent: 'center',
    shadowColor: '#B8FF00',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.44,
    shadowRadius: 18,
    width: 84,
  },
  orbitDot: {
    backgroundColor: '#B8FF00',
    borderRadius: 5,
    height: 10,
    left: 54,
    position: 'absolute',
    shadowColor: '#B8FF00',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 1,
    shadowRadius: 9,
    top: -5,
    width: 10,
  },
  orbitRing: {
    borderColor: 'rgba(184, 255, 0, 0.46)',
    borderRadius: 60,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 120,
    position: 'absolute',
    width: 120,
  },
  orbitShadow: {
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 66,
    borderWidth: 1,
    height: 132,
    position: 'absolute',
    width: 132,
  },
  progressFill: {
    backgroundColor: '#B8FF00',
    borderRadius: 2,
    height: 3,
  },
  progressSpark: {
    backgroundColor: '#F0FFB8',
    borderRadius: 4,
    height: 8,
    left: 0,
    position: 'absolute',
    shadowColor: '#B8FF00',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    top: -2.5,
    width: 8,
  },
  progressTrack: {
    backgroundColor: '#2D3430',
    borderRadius: 2,
    height: 3,
    marginTop: 22,
    overflow: 'hidden',
    width: 146,
  },
  rainGlyph: {
    color: '#B8FF00',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    position: 'absolute',
  },
  subtitle: {
    color: '#A5ABA3',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginTop: 9,
  },
  title: {
    color: '#B8FF00',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
