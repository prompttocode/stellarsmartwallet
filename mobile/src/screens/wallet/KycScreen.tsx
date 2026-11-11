import React, { useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ImageCompressor } from 'react-native-compressor';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  ModernScreenHeader,
  PressScale,
} from '@components/wallet';
import { useAppPopup } from '@components/common/AppPopup';
import type { WalletState } from '@hooks/useWallet';

type CaptureSide = 'front' | 'back';
type Step = 'intro' | 'guide' | 'preview';
type PreparedKycImage = {
  base64: string;
  sizeBytes: number;
  uri: string;
};

const ID_CARD_ASPECT_RATIO = 85.6 / 54;
const GUIDE_WIDTH_RATIO = 0.86;
const GUIDE_MAX_WIDTH = 460;
const TARGET_IMAGE_BYTES = 450 * 1024;
const MAX_IMAGE_BYTES = 500 * 1024;
const COMPRESSION_PROFILES = [
  { maxHeight: 1100, maxWidth: 1600, quality: 0.82 },
  { maxHeight: 1050, maxWidth: 1500, quality: 0.76 },
  { maxHeight: 1000, maxWidth: 1400, quality: 0.7 },
  { maxHeight: 900, maxWidth: 1280, quality: 0.64 },
  { maxHeight: 800, maxWidth: 1150, quality: 0.58 },
] as const;

function sideLabel(side: CaptureSide) {
  return side === 'front' ? 'front side' : 'back side';
}

function sideHint(side: CaptureSide) {
  return side === 'front'
    ? 'Front: portrait, ID number and full name.'
    : 'Back: fingerprints and MRZ code.';
}

async function getFileSizeBytes(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);

  if (!info.exists || info.isDirectory) {
    throw new Error('The captured image file is unavailable.');
  }

  return info.size;
}

async function deleteTemporaryImage(uri?: string, protectedUri?: string) {
  if (!uri || uri === protectedUri) {
    return;
  }

  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Temporary camera/compression files may already have been removed by the OS.
  }
}

async function prepareKycImage(sourceUri: string): Promise<PreparedKycImage> {
  let bestUri = sourceUri;
  let bestSize = await getFileSizeBytes(sourceUri);

  if (bestSize > TARGET_IMAGE_BYTES) {
    for (const profile of COMPRESSION_PROFILES) {
      const compressedUri = await ImageCompressor.compress(sourceUri, {
        compressionMethod: 'manual',
        input: 'uri',
        maxHeight: profile.maxHeight,
        maxWidth: profile.maxWidth,
        output: 'jpg',
        quality: profile.quality,
        returnableOutputType: 'uri',
      });
      const compressedSize = await getFileSizeBytes(compressedUri);

      if (compressedSize < bestSize) {
        await deleteTemporaryImage(bestUri, sourceUri);
        bestUri = compressedUri;
        bestSize = compressedSize;
      } else {
        await deleteTemporaryImage(compressedUri, sourceUri);
      }

      if (bestSize <= TARGET_IMAGE_BYTES) {
        break;
      }
    }
  }

  if (bestSize > MAX_IMAGE_BYTES) {
    await deleteTemporaryImage(bestUri, sourceUri);
    throw new Error(
      'The captured image is still too large. Please retake it with the card closer to the frame.',
    );
  }

  const base64 = await FileSystem.readAsStringAsync(bestUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await deleteTemporaryImage(sourceUri, bestUri);

  return {
    base64,
    sizeBytes: bestSize,
    uri: bestUri,
  };
}

export function KycScreen({
  onBack,
  wallet,
}: {
  onBack: () => void;
  wallet: WalletState;
}) {
  const insets = useSafeAreaInsets();
  const { showPopup } = useAppPopup();
  const cameraRef = useRef<VisionCamera>(null);
  const cameraDevice = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [step, setStep] = useState<Step>('intro');
  const [captureSide, setCaptureSide] = useState<CaptureSide>('front');
  const [frontImage, setFrontImage] = useState<PreparedKycImage | null>(null);
  const [backImage, setBackImage] = useState<PreparedKycImage | null>(null);
  const [phone, setPhone] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const currentImage = captureSide === 'front' ? frontImage : backImage;
  const currentPreviewUri = currentImage?.uri || '';
  const cameraHeaderStyle = useMemo(
    () => [styles.cameraHeader, { paddingTop: insets.top + 8 }],
    [insets.top],
  );
  const verified = wallet.kyc.status === 'verified';

  function resetCaptureSession() {
    deleteTemporaryImage(frontImage?.uri).catch(() => null);
    deleteTemporaryImage(backImage?.uri).catch(() => null);
    setStep('intro');
    setCaptureSide('front');
    setFrontImage(null);
    setBackImage(null);
    setCameraReady(false);
    setTakingPhoto(false);
    setTorchEnabled(false);
    setProcessingImage(false);
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
    if (step === 'guide' && captureSide === 'back' && frontImage) {
      setCaptureSide('front');
      setStep('preview');
      return;
    }

    if (step === 'preview') {
      setCameraReady(false);
      setStep('guide');
      return;
    }

    returnToIntro();
  }

  async function captureCurrentSide() {
    if (
      takingPhoto ||
      processingImage ||
      !cameraReady ||
      !cameraDevice ||
      !cameraRef.current
    ) {
      return false;
    }

    setTakingPhoto(true);

    try {
      const photo = await cameraRef.current.takePhoto({
        enableShutterSound: true,
        flash: 'off',
      });
      const capturedImageUri = photo.path.startsWith('file://')
        ? photo.path
        : `file://${photo.path}`;

      setProcessingImage(true);
      const preparedImage = await prepareKycImage(capturedImageUri);

      if (captureSide === 'front') {
        setFrontImage(current => {
          deleteTemporaryImage(current?.uri, preparedImage.uri).catch(
            () => null,
          );
          return preparedImage;
        });
      } else {
        setBackImage(current => {
          deleteTemporaryImage(current?.uri, preparedImage.uri).catch(
            () => null,
          );
          return preparedImage;
        });
      }

      setStep('preview');
      return true;
    } catch (error) {
      showPopup({
        message:
          error instanceof Error
            ? error.message
            : 'Please retake the CCCD image and try again.',
        title: 'Unable to capture image',
        variant: 'danger',
      });
      return false;
    } finally {
      setProcessingImage(false);
      setTakingPhoto(false);
    }
  }

  async function continueToCamera() {
    const granted = hasPermission || (await requestPermission());

    if (!granted) {
      showPopup({
        message:
          'Camera access is required to photograph your CCCD. Enable Camera permission in device settings and try again.',
        title: 'Camera permission needed',
        variant: 'warning',
      });
      return;
    }

    setCaptureSide('front');
    setCameraReady(false);
    setStep('guide');
  }

  async function acceptCurrentPhoto() {
    if (captureSide === 'front') {
      setCaptureSide('back');
      setCameraReady(false);
      setTorchEnabled(false);
      setStep('guide');
      return;
    }

    submitKyc().catch(() => null);
  }

  function retakeCurrentPhoto() {
    const image = captureSide === 'front' ? frontImage : backImage;

    deleteTemporaryImage(image?.uri).catch(() => null);
    if (captureSide === 'front') {
      setFrontImage(null);
    } else {
      setBackImage(null);
    }
    setCameraReady(false);
    setStep('guide');
  }

  async function submitKyc() {
    if (!frontImage || !backImage || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const result = await wallet.submitKycIdCard({
        imageBackBase64: backImage.base64,
        imageFrontBase64: frontImage.base64,
        phone: phone.replace(/\D/g, ''),
      });

      if (result?.status === 'verified') {
        showPopup({
          actions: [{ onPress: closeScreen, text: 'Done' }],
          message:
            'Your identity has been verified. You can now buy or withdraw with VND.',
          title: 'Verification complete',
          variant: 'success',
        });
      }
    } catch (error) {
      showPopup({
        actions: [
          {
            onPress: () => {
              setCaptureSide('front');
              deleteTemporaryImage(frontImage?.uri).catch(() => null);
              deleteTemporaryImage(backImage?.uri).catch(() => null);
              setFrontImage(null);
              setBackImage(null);
              setCameraReady(false);
              setStep('guide');
            },
            text: 'Retake front',
          },
          {
            onPress: () => {
              setCaptureSide('back');
              deleteTemporaryImage(backImage?.uri).catch(() => null);
              setBackImage(null);
              setCameraReady(false);
              setStep('guide');
            },
            text: 'Retake back',
          },
        ],
        message:
          error instanceof Error
            ? error.message
            : 'Please retake clear photos and try again.',
        title: 'Verification failed',
        variant: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'intro') {
    return (
      <SafeAreaView style={styles.screen}>
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
            Capture clear front and back photos of your Vietnamese ID card.
            Photos stay in the app's temporary storage until verification is
            submitted.
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
      </SafeAreaView>
    );
  }

  if (step === 'guide') {
    const isFront = captureSide === 'front';
    const cameraBusy = takingPhoto || processingImage;
    const torchAvailable = Boolean(cameraDevice?.hasTorch);

    return (
      <View style={styles.cameraScreen}>
        <View style={cameraHeaderStyle}>
          <PressScale
            onPress={handleCaptureBack}
            style={styles.cameraBackButton}
          >
            <Ionicons color="#FFFFFF" name="chevron-back" size={25} />
          </PressScale>
          <View style={styles.cameraHeaderCopy}>
            <Text numberOfLines={1} style={styles.cameraTitle}>
              Capture {sideLabel(captureSide)}
            </Text>
            <Text style={styles.cameraSubtitle}>
              Step {isFront ? '1' : '2'} of 2 · {sideHint(captureSide)}
            </Text>
          </View>
        </View>

        <View style={styles.cameraFrame}>
          {hasPermission && cameraDevice ? (
            <VisionCamera
              ref={cameraRef}
              device={cameraDevice}
              isActive={!processingImage}
              onInitialized={() => setCameraReady(true)}
              photo
              resizeMode="cover"
              style={StyleSheet.absoluteFill}
              torch={torchEnabled && torchAvailable ? 'on' : 'off'}
            />
          ) : (
            <View style={styles.cameraFallback}>
              <Ionicons color="#B8FF45" name="camera-outline" size={42} />
              <Text style={styles.cameraFallbackTitle}>
                {cameraDevice
                  ? 'Camera permission required'
                  : 'No rear camera found'}
              </Text>
              <Text style={styles.cameraFallbackText}>
                {cameraDevice
                  ? 'Allow camera access to continue identity verification.'
                  : 'Use a device with a rear camera to photograph your CCCD.'}
              </Text>
            </View>
          )}

          <View pointerEvents="none" style={styles.captureGuideLayer}>
            <View
              style={[
                styles.idCardCaptureGuide,
                { aspectRatio: ID_CARD_ASPECT_RATIO },
              ]}
            >
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
            </View>
            <Text style={styles.captureGuideTitle}>
              Keep all four corners inside the frame
            </Text>
            <Text style={styles.captureGuideText}>
              Hold steady · avoid glare · make every line readable
            </Text>
          </View>

          {cameraBusy ? (
            <View style={styles.captureBusyOverlay}>
              <Ionicons color="#B8FF45" name="sparkles-outline" size={28} />
              <Text style={styles.captureBusyText}>
                {processingImage ? 'Optimizing image...' : 'Capturing...'}
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={[styles.cameraActions, { paddingBottom: insets.bottom + 16 }]}
        >
          <View style={styles.progressRow}>
            <View
              style={[
                styles.progressDot,
                frontImage ? styles.progressDone : null,
              ]}
            />
            <Text style={styles.progressText}>Front</Text>
            <View
              style={[
                styles.progressDot,
                backImage ? styles.progressDone : null,
              ]}
            />
            <Text style={styles.progressText}>Back</Text>
          </View>

          <View style={styles.captureControlRow}>
            <Pressable
              disabled={!torchAvailable || cameraBusy}
              onPress={() => setTorchEnabled(value => !value)}
              style={({ pressed }) => [
                styles.captureSideControl,
                torchEnabled ? styles.captureSideControlActive : null,
                !torchAvailable || cameraBusy ? styles.disabledButton : null,
                pressed ? styles.pressedButton : null,
              ]}
            >
              <Ionicons
                color={torchEnabled ? '#111827' : '#FFFFFF'}
                name={torchEnabled ? 'flash' : 'flash-outline'}
                size={22}
              />
              <Text
                style={[
                  styles.captureSideControlText,
                  torchEnabled ? styles.captureSideControlTextActive : null,
                ]}
              >
                {torchAvailable ? 'Light' : 'No light'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel={`Capture ${sideLabel(captureSide)}`}
              accessibilityRole="button"
              disabled={cameraBusy || !cameraReady || !cameraDevice}
              onPress={() => captureCurrentSide().catch(() => null)}
              style={({ pressed }) => [
                styles.shutterButton,
                cameraBusy || !cameraReady || !cameraDevice
                  ? styles.disabledButton
                  : null,
                pressed ? styles.shutterButtonPressed : null,
              ]}
            >
              <View style={styles.shutterButtonInner} />
            </Pressable>

            <View style={styles.captureSideControl}>
              <Ionicons
                color="#B8FF45"
                name={isFront ? 'person-outline' : 'finger-print-outline'}
                size={22}
              />
              <Text style={styles.captureSideControlText}>
                {isFront ? 'Front' : 'Back'}
              </Text>
            </View>
          </View>
        </View>
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
            Review {sideLabel(captureSide)}
          </Text>
          <Text style={styles.cameraSubtitle}>{sideHint(captureSide)}</Text>
        </View>
      </View>

      <View style={styles.cameraFrame}>
        {currentPreviewUri ? (
          <View style={styles.capturedPreviewLayer}>
            <Image
              source={{ uri: currentPreviewUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <View
              style={[
                styles.idCardCaptureGuide,
                { aspectRatio: ID_CARD_ASPECT_RATIO },
              ]}
            >
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
            </View>
            <Text style={styles.captureGuideTitle}>
              Confirm all four corners are visible and readable
            </Text>
          </View>
        ) : (
          <View style={styles.cameraFallback}>
            <Ionicons color="#B8FF45" name="camera-outline" size={42} />
            <Text style={styles.cameraFallbackTitle}>
              Capture {sideLabel(captureSide)} again
            </Text>
            <Text style={styles.cameraFallbackText}>
              No preview is available. Return to the camera and retake this
              side.
            </Text>
            <PressScale
              onPress={retakeCurrentPhoto}
              style={[styles.primaryButton, styles.scanAgainButton]}
            >
              <Text style={styles.primaryButtonText}>Open camera</Text>
            </PressScale>
          </View>
        )}
      </View>

      <View
        style={[styles.cameraActions, { paddingBottom: insets.bottom + 16 }]}
      >
        <View style={styles.progressRow}>
          <View
            style={[
              styles.progressDot,
              frontImage ? styles.progressDone : null,
            ]}
          />
          <Text style={styles.progressText}>Front</Text>
          <View
            style={[styles.progressDot, backImage ? styles.progressDone : null]}
          />
          <Text style={styles.progressText}>Back</Text>
        </View>

        {currentPreviewUri ? (
          <View style={styles.actionRow}>
            <Pressable
              disabled={takingPhoto || processingImage || submitting}
              onPress={retakeCurrentPhoto}
              style={({ pressed }) => [
                styles.actionButtonSlot,
                takingPhoto || processingImage || submitting
                  ? styles.disabledButton
                  : null,
                pressed ? styles.pressedButton : null,
              ]}
            >
              <View style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Retake</Text>
              </View>
            </Pressable>
            <Pressable
              disabled={
                takingPhoto || processingImage || submitting || wallet.isBusy
              }
              onPress={acceptCurrentPhoto}
              style={({ pressed }) => [
                styles.actionButtonSlot,
                takingPhoto || processingImage || submitting || wallet.isBusy
                  ? styles.disabledButton
                  : null,
                pressed ? styles.pressedButton : null,
              ]}
            >
              <View style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>
                  {captureSide === 'front'
                    ? 'Use front'
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
  captureBusyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.58)',
    gap: 10,
    justifyContent: 'center',
  },
  captureBusyText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  captureControlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 76,
    width: '100%',
  },
  captureGuideLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  captureGuideText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
    textAlign: 'center',
  },
  captureGuideTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 18,
    textAlign: 'center',
  },
  captureSideControl: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 62,
    width: 76,
  },
  captureSideControlActive: {
    backgroundColor: '#B8FF45',
    borderColor: '#B8FF45',
  },
  captureSideControlText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  captureSideControlTextActive: {
    color: '#111827',
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
  idCardCaptureGuide: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderColor: 'rgba(255,255,255,0.78)',
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: GUIDE_MAX_WIDTH,
    width: `${GUIDE_WIDTH_RATIO * 100}%`,
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
    flex: 1,
    paddingHorizontal: 16,
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
  shutterButton: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 39,
    borderWidth: 4,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  shutterButtonInner: {
    backgroundColor: '#B8FF45',
    borderRadius: 31,
    height: 62,
    width: 62,
  },
  shutterButtonPressed: {
    transform: [{ scale: 0.94 }],
  },
});
