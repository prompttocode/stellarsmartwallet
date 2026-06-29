import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
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
  step5: require('@assets/lottie/step5.json') as AnimationObject,
};
const guideMascotImage = require('@assets/images/mascot/mascot.png');

const guideMascotSteps = [0, 1, 2, 3, 4];
const guideMascotRotatePositions = [-8, 9, -13, 7, -4];
const guideMascotScalePositions = [0.92, 1, 0.86, 0.96, 0.9];

function LottieArt({ source }: { source: AnimationObject }) {
  return (
    <View style={styles.artStage}>
      <View style={styles.lottieArtFrame}>
        <LottieView
          autoPlay
          loop
          resizeMode="contain"
          source={source}
          style={styles.lottieArt}
        />
      </View>
    </View>
  );
}

function GuideMascot({
  activeIndex,
  slide,
  topInset,
  width,
}: {
  activeIndex: number;
  slide: TutorialSlide;
  topInset: number;
  width: number;
}) {
  const step = useSharedValue(activeIndex);
  const float = useSharedValue(0);
  const bubbleWidth = Math.min(width - 112, 286);
  const mascotOnRight = activeIndex % 2 === 1;
  const xPositions = useMemo(
    () => [10, width - 104, 10, width - 104, 10],
    [width],
  );
  const bubbleXPositions = useMemo(
    () => [92, width - bubbleWidth - 92, 92, width - bubbleWidth - 92, 92],
    [bubbleWidth, width],
  );
  const yPositions = useMemo(
    () => [
      topInset + 126,
      topInset + 126,
      topInset + 126,
      topInset + 126,
      topInset + 126,
    ],
    [topInset],
  );
  const bubbleYPositions = useMemo(
    () => [
      topInset + 92,
      topInset + 92,
      topInset + 92,
      topInset + 92,
      topInset + 92,
    ],
    [topInset],
  );

  useEffect(() => {
    step.value = withTiming(activeIndex, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeIndex, step]);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, {
        duration: 1500,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
  }, [float]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(step.value, guideMascotSteps, xPositions);
    const translateY =
      interpolate(step.value, guideMascotSteps, yPositions) +
      interpolate(float.value, [0, 1], [0, -7]);
    const rotate = interpolate(
      step.value,
      guideMascotSteps,
      guideMascotRotatePositions,
    );
    const scale =
      interpolate(step.value, guideMascotSteps, guideMascotScalePositions) +
      interpolate(float.value, [0, 1], [0, 0.035]);

    return {
      transform: [
        { translateX },
        { translateY },
        { rotate: `${rotate}deg` },
        { scale },
      ],
    };
  }, [xPositions, yPositions]);
  const bubbleAnimatedStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          translateX: interpolate(
            step.value,
            guideMascotSteps,
            bubbleXPositions,
          ),
        },
        {
          translateY: interpolate(
            step.value,
            guideMascotSteps,
            bubbleYPositions,
          ),
        },
      ],
    }),
    [bubbleXPositions, bubbleYPositions],
  );

  return (
    <>
      <Reanimated.View
        pointerEvents="none"
        style={[
          styles.guideChatBubble,
          { width: bubbleWidth },
          bubbleAnimatedStyle,
        ]}
      >
        <View
          style={[
            styles.guideChatTail,
            mascotOnRight
              ? styles.guideChatTailRight
              : styles.guideChatTailLeft,
          ]}
        />
        <View
          style={[
            styles.guideChatTailInner,
            mascotOnRight
              ? styles.guideChatTailInnerRight
              : styles.guideChatTailInnerLeft,
          ]}
        />
        <Text style={styles.guideChatEyebrow}>{slide.eyebrow}</Text>
        <Text numberOfLines={2} style={styles.guideChatTitle}>
          {slide.title}
        </Text>
        <Text numberOfLines={4} style={styles.guideChatBody}>
          {slide.body}
        </Text>
      </Reanimated.View>

      <Reanimated.View
        pointerEvents="none"
        style={[styles.guideMascot, animatedStyle]}
      >
        <View style={styles.guideMascotGlow} />
        <Image
          resizeMode="contain"
          source={guideMascotImage}
          style={styles.guideMascotImage}
        />
      </Reanimated.View>
    </>
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
    <View style={styles.artStage}>
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
    </View>
  );
}

function SendArt() {
  return <LottieArt source={guideLottieAnimations.step4} />;
}

function TrackArt() {
  return (
    <View style={styles.artStage}>
      <View style={styles.trackArtStack}>
        <LottieView
          autoPlay
          loop
          resizeMode="contain"
          source={guideLottieAnimations.step5}
          style={styles.trackLottieArt}
        />
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
      </View>
    </View>
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
  const activeSlide = slides[activeIndex] || slides[0];
  const artTopPadding = Math.max(230, insets.top + 205);

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
        <GuideMascot
          activeIndex={activeIndex}
          slide={activeSlide}
          topInset={insets.top}
          width={slideWidth}
        />

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
              style={[
                styles.slide,
                {
                  paddingTop: artTopPadding,
                  width: slideWidth,
                },
              ]}
            >
              {slide.renderArt()}
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
  artStage: {
    alignItems: 'center',
    height: 250,
    justifyContent: 'center',
    marginBottom: 18,
    width: '100%',
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
  guideChatBody: {
    color: '#B4BFCD',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 7,
  },
  guideChatBubble: {
    backgroundColor: '#11171D',
    borderColor: 'rgba(184,255,69,0.28)',
    borderRadius: 18,
    borderWidth: 1,
    left: 0,
    paddingHorizontal: 15,
    paddingVertical: 13,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    top: 0,
    zIndex: 6,
  },
  guideChatEyebrow: {
    color: '#B8FF45',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  guideChatTail: {
    backgroundColor: '#11171D',
    borderBottomColor: 'rgba(184,255,69,0.28)',
    borderBottomWidth: 1,
    borderRightColor: 'rgba(184,255,69,0.28)',
    borderRightWidth: 1,
    height: 15,
    position: 'absolute',
    top: 42,
    transform: [{ rotate: '45deg' }],
    width: 15,
  },
  guideChatTailLeft: {
    left: -8,
  },
  guideChatTailRight: {
    right: -8,
  },
  guideChatTailInner: {
    backgroundColor: '#B8FF45',
    borderRadius: 2,
    height: 10,
    opacity: 0.95,
    position: 'absolute',
    top: 44,
    transform: [{ rotate: '45deg' }],
    width: 10,
  },
  guideChatTailInnerLeft: {
    left: -5,
  },
  guideChatTailInnerRight: {
    right: -5,
  },
  guideChatTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 21,
    marginTop: 4,
  },
  guideMascot: {
    alignItems: 'center',
    height: 92,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
    width: 92,
    zIndex: 7,
  },
  guideMascotGlow: {
    backgroundColor: 'rgba(184,255,69,0.1)',
    borderRadius: 37,
    height: 74,
    left: 9,
    position: 'absolute',
    shadowColor: '#B8FF45',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 7,
    top: 9,
    width: 74,
  },
  guideMascotImage: {
    height: 86,
    width: 86,
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
    position: 'relative',
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
    justifyContent: 'flex-start',
    paddingBottom: 22,
  },
  trackArtStack: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 238,
    width: '100%',
  },
  trackLottieArt: {
    height: 200,
    marginBottom: 0,
    width: 200,
    zIndex: 1,
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
