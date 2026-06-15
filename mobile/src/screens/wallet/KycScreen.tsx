import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  default as DocumentScanner,
  ResponseType,
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ModernScreenHeader,
  PressScale,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import type { WalletState } from '@hooks/useWallet';

type CaptureSide = 'front' | 'back';
type Step = 'intro' | 'guide' | 'preview';

const ID_CARD_ASPECT_RATIO = 85.6 / 54;
const GUIDE_WIDTH_RATIO = 0.86;
const GUIDE_MAX_WIDTH = 460;

function sideLabel(side: CaptureSide) {
  return side === 'front' ? 'front side' : 'back side';
}

function sideHint(side: CaptureSide) {
  return side === 'front'
    ? 'Front: portrait, ID number and full name.'
    : 'Back: fingerprints and MRZ code.';
}

export function KycScreen({
  onBack,
  wallet,
}: {
  onBack: () => void;
  wallet: WalletState;
}) {
  const insets = useSafeAreaInsets();
  const screenInsetStyle = useSafeScreenInsetStyle();
  const [step, setStep] = useState<Step>('intro');
  const [captureSide, setCaptureSide] = useState<CaptureSide>('front');
  const [frontBase64, setFrontBase64] = useState('');
  const [backBase64, setBackBase64] = useState('');
  const [phone, setPhone] = useState('');
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const currentBase64 =
    captureSide === 'front' ? frontBase64 : backBase64;
  const currentPreviewUri = currentBase64
    ? `data:image/jpeg;base64,${currentBase64}`
    : '';
  const cameraHeaderStyle = useMemo(
    () => [styles.cameraHeader, { paddingTop: insets.top + 8 }],
    [insets.top],
  );
  const verified = wallet.kyc.status === 'verified';

  function resetCaptureSession() {
    setStep('intro');
    setCaptureSide('front');
    setFrontBase64('');
    setBackBase64('');
    setScanning(false);
    setSubmitting(false);
  }

  function closeScreen() {
    resetCaptureSession();
    onBack();
  }

  function returnToIntro() {
    resetCaptureSession();
  }

  function handleCaptureBack() {
    if (step === 'guide' && captureSide === 'back' && frontBase64) {
      setCaptureSide('front');
      setStep('preview');
      return;
    }

    if (step === 'preview') {
      setStep('guide');
      return;
    }

    returnToIntro();
  }

  async function requestScannerPermission() {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permission = PermissionsAndroid.PERMISSIONS.CAMERA;
    const hasPermission = await PermissionsAndroid.check(permission);

    if (hasPermission) {
      return true;
    }

    const result = await PermissionsAndroid.request(permission);

    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  async function scanSide(side: CaptureSide) {
    if (scanning) {
      return false;
    }

    const hasPermission = await requestScannerPermission();

    if (!hasPermission) {
      Alert.alert(
        'Camera permission required',
        'Please allow camera access to scan your ID card.',
      );
      return false;
    }

    setScanning(true);

    try {
      const result = await DocumentScanner.scanDocument({
        croppedImageQuality: 100,
        maxNumDocuments: 1,
        responseType: ResponseType.Base64,
      });
      const scannedImage = result.scannedImages?.[0];

      if (
        result.status === ScanDocumentResponseStatus.Cancel ||
        !scannedImage
      ) {
        return false;
      }

      if (side === 'front') {
        setFrontBase64(scannedImage);
      } else {
        setBackBase64(scannedImage);
      }

      setCaptureSide(side);
      setStep('preview');
      return true;
    } catch (error) {
      Alert.alert(
        'Unable to scan document',
        error instanceof Error
          ? error.message
          : 'Please try scanning your CCCD again.',
      );
      return false;
    } finally {
      setScanning(false);
    }
  }

  async function continueToCamera() {
    setCaptureSide('front');
    setStep('guide');
  }

  async function acceptCurrentPhoto() {
    if (captureSide === 'front') {
      setCaptureSide('back');
      setStep('guide');
      return;
    }

    submitKyc().catch(() => null);
  }

  function retakeCurrentPhoto() {
    scanSide(captureSide).catch(() => null);
  }

  async function submitKyc() {
    if (!frontBase64 || !backBase64 || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const result = await wallet.submitKycIdCard({
        imageBackBase64: backBase64,
        imageFrontBase64: frontBase64,
        phone: phone.replace(/\D/g, ''),
      });

      if (result?.status === 'verified') {
        Alert.alert(
          'Verification complete',
          'Your identity has been verified. You can now buy or withdraw with VND.',
          [{ onPress: closeScreen, text: 'Done' }],
        );
      }
    } catch (error) {
      Alert.alert(
        'Verification failed',
        error instanceof Error
          ? error.message
          : 'Please retake clear photos and try again.',
        [
          {
            onPress: () => {
              setCaptureSide('front');
              setFrontBase64('');
              setBackBase64('');
              scanSide('front').catch(() => null);
            },
            text: 'Retake front',
          },
          {
            onPress: () => {
              setCaptureSide('back');
              setBackBase64('');
              scanSide('back').catch(() => null);
            },
            text: 'Retake back',
          },
        ],
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'intro') {
    return (
      <ScrollView
        contentContainerStyle={[screenInsetStyle, styles.content]}
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <ModernScreenHeader
          onBack={closeScreen}
          subtitle="Verify before using VND buy and withdrawal."
          title="Identity verification"
        />

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons color="#111827" name="id-card-outline" size={30} />
          </View>
          <Text style={styles.heroTitle}>
            {verified ? 'Identity verified' : 'Verify your CCCD'}
          </Text>
          <Text style={styles.heroText}>
            Capture the front and back of your Vietnamese ID card. Keep all
            four corners visible and avoid glare.
          </Text>
        </View>

        <View style={styles.checklistCard}>
          {[
            'Use the original physical CCCD.',
            'Place it on a flat, dark surface.',
            'Make sure text is clear and not cropped.',
          ].map(item => (
            <View key={item} style={styles.checkRow}>
              <Ionicons color="#B8FF45" name="checkmark-circle" size={20} />
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Phone number optional</Text>
          <TextInput
            keyboardType="phone-pad"
            onChangeText={value => setPhone(value.replace(/[^\d]/g, ''))}
            placeholder="0901234567"
            placeholderTextColor="#717781"
            style={styles.input}
            value={phone}
          />
        </View>

        <PressScale
          disabled={wallet.isBusy || submitting}
          onPress={continueToCamera}
          style={[styles.primaryButton, styles.primaryButtonStretch]}
        >
          <Text style={styles.primaryButtonText}>
            {verified ? 'Verify again' : 'Continue'}
          </Text>
        </PressScale>
      </ScrollView>
    );
  }

  if (step === 'guide') {
    const isFront = captureSide === 'front';

    return (
      <View
        style={[
          styles.guideScreen,
          {
            paddingBottom: insets.bottom + 16,
            paddingTop: insets.top + 12,
          },
        ]}
      >
        <ModernScreenHeader
          onBack={handleCaptureBack}
          subtitle={`Step ${isFront ? '1' : '2'} of 2`}
          title={`Scan ${sideLabel(captureSide)}`}
        />

        <View style={styles.guideMain}>
          <View style={styles.sideGuide}>
            <View
              style={[
                styles.sideGuideCard,
                { aspectRatio: ID_CARD_ASPECT_RATIO },
              ]}
            >
              <Ionicons
                color="#111827"
                name={isFront ? 'person-outline' : 'finger-print-outline'}
                size={44}
              />
              <View style={styles.sideGuideLines}>
                <View style={styles.sideGuideLineLong} />
                <View style={styles.sideGuideLineShort} />
                <View style={styles.sideGuideLineMedium} />
              </View>
            </View>
          </View>

          <View style={styles.guideCopy}>
            <Text style={styles.guideTitle}>
              {isFront ? 'Prepare the front side' : 'Prepare the back side'}
            </Text>
            <Text style={styles.guideText}>
              {isFront
                ? 'Place the portrait and ID-number side facing up.'
                : 'Place the fingerprints and MRZ-code side facing up.'}
            </Text>
          </View>

          <View style={[styles.checklistCard, styles.guideChecklist]}>
            {[
              'Scan only this side of the CCCD.',
              'Keep all four corners visible and avoid glare.',
              'Tap Save or the checkmark after capture.',
            ].map(item => (
              <View key={item} style={[styles.checkRow, styles.guideCheckRow]}>
                <Ionicons color="#B8FF45" name="checkmark-circle" size={19} />
                <Text style={styles.checkText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <PressScale
          disabled={scanning}
          onPress={() => scanSide(captureSide)}
          style={[styles.primaryButton, styles.primaryButtonStretch]}
        >
          <Text style={styles.primaryButtonText}>
            {scanning
              ? 'Opening scanner...'
              : `Scan ${sideLabel(captureSide)}`}
          </Text>
        </PressScale>
      </View>
    );
  }

  return (
    <View style={styles.cameraScreen}>
      <View style={cameraHeaderStyle}>
        <PressScale onPress={handleCaptureBack} style={styles.cameraBackButton}>
          <Ionicons color="#FFFFFF" name="chevron-back" size={25} />
        </PressScale>
        <View style={styles.cameraHeaderCopy}>
          <Text numberOfLines={1} style={styles.cameraTitle}>
            Capture {sideLabel(captureSide)}
          </Text>
          <Text style={styles.cameraSubtitle}>
            {sideHint(captureSide)}
          </Text>
        </View>
      </View>

      <View style={styles.cameraFrame}>
        {currentPreviewUri ? (
          <View style={styles.capturedPreviewLayer}>
            <View
              style={[
                styles.capturedCardPreview,
                { aspectRatio: ID_CARD_ASPECT_RATIO },
              ]}
            >
              <Image
                source={{ uri: currentPreviewUri }}
                style={styles.previewImage}
              />
              <View pointerEvents="none" style={styles.capturedGuideBorder}>
                <View style={styles.cornerTopLeft} />
                <View style={styles.cornerTopRight} />
                <View style={styles.cornerBottomLeft} />
                <View style={styles.cornerBottomRight} />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.cameraFallback}>
            <Ionicons color="#B8FF45" name="scan-outline" size={42} />
            <Text style={styles.cameraFallbackTitle}>
              Scan {sideLabel(captureSide)}
            </Text>
            <Text style={styles.cameraFallbackText}>
              The scanner will detect the CCCD edges and correct perspective
              automatically.
            </Text>
            <PressScale
              disabled={scanning}
              onPress={() => scanSide(captureSide)}
              style={[styles.primaryButton, styles.scanAgainButton]}
            >
              <Text style={styles.primaryButtonText}>
                {scanning ? 'Opening scanner...' : 'Open scanner'}
              </Text>
            </PressScale>
          </View>
        )}
      </View>

      <View style={[styles.cameraActions, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.progressRow}>
          <View
            style={[
              styles.progressDot,
              frontBase64 ? styles.progressDone : null,
            ]}
          />
          <Text style={styles.progressText}>Front</Text>
          <View
            style={[
              styles.progressDot,
              backBase64 ? styles.progressDone : null,
            ]}
          />
          <Text style={styles.progressText}>Back</Text>
        </View>

        {currentPreviewUri ? (
          <View style={styles.actionRow}>
            <Pressable
              disabled={scanning || submitting}
              onPress={retakeCurrentPhoto}
              style={({ pressed }) => [
                styles.actionButtonSlot,
                scanning || submitting ? styles.disabledButton : null,
                pressed ? styles.pressedButton : null,
              ]}
            >
              <View style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Retake</Text>
              </View>
            </Pressable>
            <Pressable
              disabled={scanning || submitting || wallet.isBusy}
              onPress={acceptCurrentPhoto}
              style={({ pressed }) => [
                styles.actionButtonSlot,
                scanning || submitting || wallet.isBusy
                  ? styles.disabledButton
                  : null,
                pressed ? styles.pressedButton : null,
              ]}
            >
              <View style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>
                  {captureSide === 'front'
                    ? scanning
                      ? 'Opening scanner...'
                      : 'Use front'
                    : submitting || wallet.isBusy
                    ? 'Submitting...'
                    : 'Submit'}
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  actionButtonSlot: {
    flex: 1,
  },
  cameraActions: {
    backgroundColor: '#000000',
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  cameraBackButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  cameraFallback: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  cameraFallbackText: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  cameraFallbackTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  cameraFrame: {
    backgroundColor: '#000000',
    flex: 1,
    overflow: 'hidden',
  },
  cameraHeader: {
    alignItems: 'center',
    backgroundColor: '#000000',
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 14,
    paddingHorizontal: 18,
  },
  cameraHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  cameraScreen: {
    backgroundColor: '#000000',
    flex: 1,
  },
  cameraSubtitle: {
    color: '#A1B0C8',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 2,
  },
  cameraTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 34,
  },
  capturedCardPreview: {
    backgroundColor: '#111827',
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 0,
    borderWidth: 1,
    maxWidth: GUIDE_MAX_WIDTH,
    overflow: 'hidden',
    width: `${GUIDE_WIDTH_RATIO * 100}%`,
  },
  capturedGuideBorder: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 0,
    borderWidth: 1,
  },
  capturedPreviewLayer: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 18,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  checkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 34,
  },
  checkText: {
    color: '#DDE3EA',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  checklistCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    gap: 8,
    padding: 16,
  },
  content: {
    gap: 14,
    paddingHorizontal: 16,
  },
  cornerBottomLeft: {
    borderBottomColor: '#B8FF45',
    borderLeftColor: '#B8FF45',
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    bottom: -1,
    height: 34,
    left: -1,
    position: 'absolute',
    width: 34,
  },
  cornerBottomRight: {
    borderBottomColor: '#B8FF45',
    borderRightColor: '#B8FF45',
    borderRightWidth: 4,
    borderBottomWidth: 4,
    bottom: -1,
    height: 34,
    position: 'absolute',
    right: -1,
    width: 34,
  },
  cornerTopLeft: {
    borderLeftColor: '#B8FF45',
    borderTopColor: '#B8FF45',
    borderLeftWidth: 4,
    borderTopWidth: 4,
    height: 34,
    left: -1,
    position: 'absolute',
    top: -1,
    width: 34,
  },
  cornerTopRight: {
    borderRightColor: '#B8FF45',
    borderTopColor: '#B8FF45',
    borderRightWidth: 4,
    borderTopWidth: 4,
    height: 34,
    position: 'absolute',
    right: -1,
    top: -1,
    width: 34,
  },
  disabledButton: {
    opacity: 0.55,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    gap: 12,
    padding: 20,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 24,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  heroText: {
    color: '#A1B0C8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  guideChecklist: {
    borderRadius: 16,
    gap: 4,
    padding: 12,
  },
  guideCheckRow: {
    minHeight: 29,
  },
  guideCopy: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  guideMain: {
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    minHeight: 0,
  },
  guideScreen: {
    backgroundColor: '#000000',
    flex: 1,
    gap: 12,
    paddingHorizontal: 16,
  },
  guideText: {
    color: '#A1B0C8',
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
  guideTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#000000',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    gap: 10,
    padding: 16,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  previewImage: {
    backgroundColor: '#000000',
    height: '100%',
    resizeMode: 'contain',
    width: '100%',
  },
  pressedButton: {
    opacity: 0.78,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 18,
    width: '100%',
  },
  primaryButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  primaryButtonStretch: {
    flex: 0,
  },
  progressDone: {
    backgroundColor: '#B8FF45',
  },
  progressDot: {
    backgroundColor: '#2A313B',
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  progressText: {
    color: '#A1B0C8',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 8,
  },
  screen: {
    backgroundColor: '#000000',
  },
  scanAgainButton: {
    marginTop: 8,
    maxWidth: 260,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#161A20',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 18,
    width: '100%',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  sideGuide: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  sideGuideCard: {
    alignItems: 'center',
    backgroundColor: '#E8EDF2',
    borderColor: '#FFFFFF',
    borderRadius: 0,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    maxWidth: 380,
    paddingHorizontal: 24,
    width: '78%',
  },
  sideGuideLineLong: {
    backgroundColor: '#667085',
    height: 8,
    width: '100%',
  },
  sideGuideLineMedium: {
    backgroundColor: '#98A2B3',
    height: 8,
    width: '76%',
  },
  sideGuideLines: {
    flex: 1,
    gap: 12,
  },
  sideGuideLineShort: {
    backgroundColor: '#98A2B3',
    height: 8,
    width: '58%',
  },
});
