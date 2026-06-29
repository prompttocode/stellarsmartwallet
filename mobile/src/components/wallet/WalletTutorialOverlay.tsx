import React, { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LottieView, { type AnimationObject } from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StellarNetwork } from '@app-types';
import { PressScale } from './ui/primitives';

type TutorialSlide = {
  body: string;
  eyebrow: string;
  renderArt: () => ReactNode;
  title: string;
};

const guideCoinImages = {
  EURC: require('@assets/images/coin/eurc.png'),
  PYUSD: require('@assets/images/coin/pyusd.png'),
  USDC: require('@assets/images/coin/usdc.png'),
  USDT: require('@assets/images/coin/usdt.png'),
  XLM: require('@assets/images/coin/xlm.png'),
};

const guideLottieAnimations = {
  step1: require('@assets/lottie/step1.json') as AnimationObject,
  step2: require('@assets/lottie/step2.json') as AnimationObject,
  step4: require('@assets/lottie/step4.json') as AnimationObject,
};

function AnimatedOrb({ children }: { children: ReactNode }) {
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0.58)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            duration: 1500,
            toValue: 1.04,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            duration: 1500,
            toValue: 0.96,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            duration: 1500,
            toValue: 0.92,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            duration: 1500,
            toValue: 0.58,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [opacity, scale]);

  return (
    <View style={styles.artStage}>
      <Animated.View
        style={[
          styles.artGlow,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
      {children}
    </View>
  );
}

function LottieArt({ source }: { source: AnimationObject }) {
  return (
    <AnimatedOrb>
      <View style={styles.lottieArtFrame}>
        <LottieView
          autoPlay
          loop
          resizeMode="contain"
          source={source}
          duration={5000}
          style={styles.lottieArt}
        />
      </View>
    </AnimatedOrb>
  );
}

function WalletReadyArt() {
  return <LottieArt source={guideLottieAnimations.step1} />;
}

function ReceiveArt() {
  return <LottieArt source={guideLottieAnimations.step2} />;
}

function AssetArt() {
  return (
    <AnimatedOrb>
      <View style={styles.coinConstellation}>
        <View style={styles.coinOrbitRing} />
        <View style={[styles.coinImageBubble, styles.coinImageXlm]}>
          <Image
            resizeMode="contain"
            source={guideCoinImages.XLM}
            style={styles.coinImage}
          />
        </View>
        <View style={[styles.coinImageBubble, styles.coinImageUsdc]}>
          <Image
            resizeMode="contain"
            source={guideCoinImages.USDC}
            style={styles.coinImage}
          />
        </View>
        <View style={[styles.coinImageBubble, styles.coinImageEurc]}>
          <Image
            resizeMode="contain"
            source={guideCoinImages.EURC}
            style={styles.coinImage}
          />
        </View>
        <View style={[styles.coinImageBubble, styles.coinImagePyusd]}>
          <Image
            resizeMode="contain"
            source={guideCoinImages.PYUSD}
            style={styles.coinImage}
          />
        </View>
        <View style={[styles.coinImageBubble, styles.coinImageUsdt]}>
          <Image
            resizeMode="contain"
            source={guideCoinImages.USDT}
            style={styles.coinImage}
          />
        </View>
        <View style={styles.coinPulseDot} />
      </View>
    </AnimatedOrb>
  );
}

function SendArt() {
  return <LottieArt source={guideLottieAnimations.step4} />;
}

function TrackArt() {
  return (
    <AnimatedOrb>
      <View style={styles.txCard}>
        <View style={styles.txIcon}>
          <Ionicons color="#07100B" name="checkmark" size={22} />
        </View>
        <View style={styles.txCopy}>
          <View style={styles.txLineWide} />
          <View style={styles.txLineShort} />
        </View>
        <Ionicons color="#B8FF45" name="open-outline" size={24} />
      </View>
    </AnimatedOrb>
  );
}

function getTutorialSlides(network: StellarNetwork): TutorialSlide[] {
  const isMainnet = network === 'mainnet';

  return [
    {
      body: 'Check your portfolio, current network, and active wallet before moving funds.',
      eyebrow: 'Step 1',
      renderArt: () => <WalletReadyArt />,
      title: 'Your Stellar wallet is ready',
    },
    {
      body: 'Copy your address, share it, or show the QR code. Enable issued assets before receiving them.',
      eyebrow: 'Step 2',
      renderArt: () => <ReceiveArt />,
      title: 'Receive with one address',
    },
    {
      body: isMainnet
        ? 'Mainnet uses real assets. Deposit or buy carefully, then review every action before signing.'
        : 'Use Faucet for Testnet XLM and test assets, then try the flow without real funds.',
      eyebrow: 'Step 3',
      renderArt: () => <AssetArt />,
      title: isMainnet ? 'Add real assets carefully' : 'Get assets for testing',
    },
    {
      body: 'Choose an asset, enter a Stellar address, review the details, then confirm sensitive actions.',
      eyebrow: 'Step 4',
      renderArt: () => <SendArt />,
      title: 'Send after review',
    },
    {
      body: 'Use Activity and transaction detail screens to inspect status, fees, hash, and Stellar Expert links.',
      eyebrow: 'Step 5',
      renderArt: () => <TrackArt />,
      title: 'Track every transaction',
    },
  ];
}

export function WalletTutorialOverlay({
  network,
  onClose,
  visible,
}: {
  network: StellarNetwork;
  onClose: () => void;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const slides = getTutorialSlides(network);
  const isLastSlide = activeIndex === slides.length - 1;
  const slideWidth = Math.max(1, width);

  useEffect(() => {
    if (visible) {
      setActiveIndex(0);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ animated: false, x: 0, y: 0 });
      });
    }
  }, [visible]);

  function goToSlide(index: number) {
    const nextIndex = Math.max(0, Math.min(index, slides.length - 1));

    setActiveIndex(nextIndex);
    scrollRef.current?.scrollTo({
      animated: true,
      x: nextIndex * slideWidth,
      y: 0,
    });
  }

  function handleMomentumEnd(event: {
    nativeEvent: { contentOffset: { x: number } };
  }) {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / slideWidth,
    );

    setActiveIndex(Math.max(0, Math.min(nextIndex, slides.length - 1)));
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <View style={styles.backdropGlowTop} />
        <View style={styles.backdropGlowBottom} />

        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={styles.headerEyebrow}>STELLAR SMART WALLET</Text>
            <Text style={styles.headerTitle}>Quick app guide</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          onMomentumScrollEnd={handleMomentumEnd}
          pagingEnabled
          ref={scrollRef}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          style={styles.carousel}
        >
          {slides.map(slide => (
            <View
              key={slide.title}
              style={[styles.slide, { width: slideWidth }]}
            >
              {slide.renderArt()}
              <View style={styles.copyBlock}>
                <Text style={styles.slideEyebrow}>{slide.eyebrow}</Text>
                <Text style={styles.slideTitle}>{slide.title}</Text>
                <Text style={styles.slideBody}>{slide.body}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.dots}>
            {slides.map((slide, index) => (
              <View
                key={slide.title}
                style={[
                  styles.dot,
                  index === activeIndex ? styles.dotActive : null,
                ]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <View style={styles.actionLeft}>
              <PressScale
                disabled={activeIndex === 0}
                onPress={() => goToSlide(activeIndex - 1)}
                style={[
                  styles.secondaryAction,
                  activeIndex === 0 ? styles.actionDisabled : null,
                ]}
              >
                <Ionicons color="#FFFFFF" name="chevron-back" size={18} />
                <Text style={styles.secondaryActionText}>Back</Text>
              </PressScale>
            </View>

            <View style={styles.actionRight}>
              <PressScale
                onPress={() =>
                  isLastSlide ? onClose() : goToSlide(activeIndex + 1)
                }
                style={styles.primaryAction}
              >
                <Text numberOfLines={1} style={styles.primaryActionText}>
                  {isLastSlide ? 'Start using wallet' : 'Next'}
                </Text>
                <Ionicons
                  color="#07100B"
                  name={isLastSlide ? 'checkmark' : 'chevron-forward'}
                  size={18}
                />
              </PressScale>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionDisabled: {
    opacity: 0.34,
  },
  actionLeft: {
    alignItems: 'flex-start',
    flex: 1,
  },
  actionRight: {
    alignItems: 'flex-end',
    flex: 1,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  artGlow: {
    backgroundColor: 'rgba(184,255,69,0.2)',
    borderRadius: 115,
    height: 230,
    position: 'absolute',
    width: 230,
  },
  artStage: {
    alignItems: 'center',
    height: 250,
    justifyContent: 'center',
    marginBottom: 18,
    width: '100%',
  },
  backdropGlowBottom: {
    backgroundColor: 'rgba(77,70,232,0.18)',
    borderRadius: 180,
    bottom: -130,
    height: 300,
    position: 'absolute',
    right: -110,
    width: 300,
  },
  backdropGlowTop: {
    backgroundColor: 'rgba(184,255,69,0.12)',
    borderRadius: 190,
    height: 320,
    left: -130,
    position: 'absolute',
    top: -140,
    width: 320,
  },
  carousel: {
    flex: 1,
  },
  coinConstellation: {
    alignItems: 'center',
    height: 196,
    justifyContent: 'center',
    width: 268,
  },
  coinImage: {
    height: '72%',
    width: '72%',
  },
  coinImageBubble: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.65)',
    borderWidth: 2,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#B8FF45',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  coinImageEurc: {
    borderRadius: 29,
    height: 58,
    transform: [{ translateX: 76 }, { translateY: -44 }, { rotate: '10deg' }],
    width: 58,
  },
  coinImagePyusd: {
    borderRadius: 25,
    height: 50,
    opacity: 0.9,
    transform: [{ translateX: -86 }, { translateY: 44 }, { rotate: '14deg' }],
    width: 50,
  },
  coinImageUsdc: {
    borderRadius: 34,
    height: 68,
    transform: [{ translateX: -78 }, { translateY: -42 }, { rotate: '-12deg' }],
    width: 68,
  },
  coinImageUsdt: {
    borderRadius: 24,
    height: 48,
    opacity: 0.88,
    transform: [{ translateX: 88 }, { translateY: 46 }, { rotate: '-8deg' }],
    width: 48,
  },
  coinImageXlm: {
    borderColor: '#B8FF45',
    borderRadius: 45,
    borderWidth: 3,
    height: 90,
    zIndex: 4,
    width: 90,
  },
  coinOrbitRing: {
    borderColor: 'rgba(184,255,69,0.2)',
    borderRadius: 78,
    borderWidth: 1,
    height: 126,
    position: 'absolute',
    transform: [{ rotate: '-16deg' }],
    width: 224,
  },
  coinPulseDot: {
    backgroundColor: '#B8FF45',
    borderRadius: 7,
    height: 14,
    opacity: 0.85,
    position: 'absolute',
    right: 52,
    top: 70,
    width: 14,
  },
  copyBlock: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  dot: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 5,
    height: 8,
    width: 8,
  },
  dotActive: {
    backgroundColor: '#B8FF45',
    width: 28,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 18,
  },
  footer: {
    paddingHorizontal: 22,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
  headerEyebrow: {
    color: '#B8FF45',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 3,
  },
  lottieArt: {
    height: 236,
    width: 236,
  },
  lottieArtFrame: {
    alignItems: 'center',
    height: 236,
    justifyContent: 'center',
    width: 236,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    maxWidth: 220,
    minHeight: 54,
    minWidth: 150,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: '#07100B',
    fontSize: 16,
    fontWeight: '900',
  },
  root: {
    backgroundColor: 'rgba(3,7,10,0.98)',
    flex: 1,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
    width: 118,
  },
  secondaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  skipButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  slide: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 22,
  },
  slideBody: {
    color: '#AAB3C2',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 330,
    textAlign: 'center',
  },
  slideEyebrow: {
    color: '#B8FF45',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  slideTitle: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '900',
    lineHeight: 37,
    marginTop: 8,
    textAlign: 'center',
  },
  txCard: {
    alignItems: 'center',
    backgroundColor: '#151A20',
    borderColor: 'rgba(184,255,69,0.25)',
    borderRadius: 25,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    padding: 16,
    width: 248,
  },
  txCopy: {
    flex: 1,
    gap: 8,
  },
  txIcon: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  txLineShort: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 5,
    height: 10,
    width: '58%',
  },
  txLineWide: {
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    height: 12,
    width: '86%',
  },
});
