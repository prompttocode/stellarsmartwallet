import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Camera,
  type Orientation,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ModernScreenHeader,
  PressScale,
  useSafeScreenInsetStyle,
} from '@components/wallet';
import type { WalletState } from '@hooks/useWallet';

type CaptureSide = 'front' | 'back';
type Step = 'intro' | 'capture';
type Size = { height: number; width: number };
type Rect = { height: number; width: number; x: number; y: number };

const ID_CARD_ASPECT_RATIO = 85.6 / 54;
const GUIDE_WIDTH_RATIO = 0.86;
const GUIDE_MAX_WIDTH = 460;
const GUIDE_BOTTOM_OFFSET = 30;
const CAPTURE_IMAGE_QUALITY = 100;

function getFileUri(path: string) {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function getFilePath(uri: string) {
  return uri.replace(/^file:\/\//, '');
}

function sideLabel(side: CaptureSide) {
  return side === 'front' ? 'front side' : 'back side';
}

function sideHint(side: CaptureSide) {
  return side === 'front'
    ? 'Front: portrait, ID number and full name.'
    : 'Back: fingerprints and MRZ code.';
}

function getGuideRect(frame: Size): Rect | null {
  if (!frame.width || !frame.height) {
    return null;
  }

  let width = Math.min(frame.width * GUIDE_WIDTH_RATIO, GUIDE_MAX_WIDTH);
  let height = width / ID_CARD_ASPECT_RATIO;
  const maxHeight = frame.height * 0.76;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ID_CARD_ASPECT_RATIO;
  }

  return {
    height,
    width,
    x: (frame.width - width) / 2,
    y: Math.max(0, (frame.height - GUIDE_BOTTOM_OFFSET - height) / 2),
  };
}

function getCenterCropRect(image: Size, aspectRatio: number): Rect {
  let width = image.width;
  let height = width / aspectRatio;

  if (height > image.height) {
    height = image.height;
    width = height * aspectRatio;
  }

  return {
    height,
    width,
    x: (image.width - width) / 2,
    y: (image.height - height) / 2,
  };
}

function getImageCropRect(image: Size, frame?: Size | null): Rect {
  const guide = frame ? getGuideRect(frame) : null;

  if (!guide) {
    return getCenterCropRect(image, ID_CARD_ASPECT_RATIO);
  }

  const scale = Math.max(frame!.width / image.width, frame!.height / image.height);
  const displayedWidth = image.width * scale;
  const displayedHeight = image.height * scale;
  const offsetX = (displayedWidth - frame!.width) / 2;
  const offsetY = (displayedHeight - frame!.height) / 2;
  const x = Math.max(0, (guide.x + offsetX) / scale);
  const y = Math.max(0, (guide.y + offsetY) / scale);
  const width = Math.min(image.width - x, guide.width / scale);
  const height = Math.min(image.height - y, guide.height / scale);

  if (width < 20 || height < 20) {
    return getCenterCropRect(image, ID_CARD_ASPECT_RATIO);
  }

  return { height, width, x, y };
}

function getOrientedImageSize(image: Size, orientation: Orientation): Size {
  if (
    orientation === 'landscape-left' ||
    orientation === 'landscape-right'
  ) {
    return { height: image.width, width: image.height };
  }

  return image;
}

function mapDisplayCropToRaw(
  crop: Rect,
  rawImage: Size,
  orientation: Orientation,
): Rect {
  switch (orientation) {
    case 'landscape-right':
      return {
        height: crop.width,
        width: crop.height,
        x: crop.y,
        y: rawImage.height - crop.x - crop.width,
      };
    case 'landscape-left':
      return {
        height: crop.width,
        width: crop.height,
        x: rawImage.width - crop.y - crop.height,
        y: crop.x,
      };
    case 'portrait-upside-down':
      return {
        height: crop.height,
        width: crop.width,
        x: rawImage.width - crop.x - crop.width,
        y: rawImage.height - crop.y - crop.height,
      };
    default:
      return crop;
  }
}

function getUprightRotation(orientation: Orientation) {
  switch (orientation) {
    case 'landscape-right':
      return 90;
    case 'landscape-left':
      return -90;
    case 'portrait-upside-down':
      return 180;
    default:
      return 0;
  }
}

async function cropPhotoToGuide(
  uri: string,
  orientation: Orientation,
  frame?: Size | null,
) {
  try {
    const { loadImage } = await import('react-native-nitro-image');
    const image = await loadImage({ filePath: getFilePath(uri) });
    const rawImage = { height: image.height, width: image.width };
    const displayCrop = getImageCropRect(
      getOrientedImageSize(rawImage, orientation),
      frame,
    );
    const crop = mapDisplayCropToRaw(displayCrop, rawImage, orientation);
    const cropped = await image.cropAsync(
      Math.round(crop.x),
      Math.round(crop.y),
      Math.round(crop.x + crop.width),
      Math.round(crop.y + crop.height),
    );
    const rotation = getUprightRotation(orientation);
    const upright =
      rotation === 0 ? cropped : await cropped.rotateAsync(rotation, false);
    const croppedPath = await upright.saveToTemporaryFileAsync(
      'jpg',
      CAPTURE_IMAGE_QUALITY,
    );

    return getFileUri(croppedPath);
  } catch {
    return uri;
  }
}

async function prepareKycImageBase64(uri: string) {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
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
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const cameraFormat = useCameraFormat(device, [
    { photoResolution: 'max' },
  ]);
  const { hasPermission, requestPermission } = useCameraPermission();
  const [step, setStep] = useState<Step>('intro');
  const [captureSide, setCaptureSide] = useState<CaptureSide>('front');
  const [frontUri, setFrontUri] = useState('');
  const [backUri, setBackUri] = useState('');
  const [phone, setPhone] = useState('');
  const [cameraFrameSize, setCameraFrameSize] = useState<Size | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const currentUri = captureSide === 'front' ? frontUri : backUri;
  const cameraHeaderStyle = useMemo(
    () => [styles.cameraHeader, { paddingTop: insets.top + 8 }],
    [insets.top],
  );
  const verified = wallet.kyc.status === 'verified';

  function resetCaptureSession() {
    setStep('intro');
    setCaptureSide('front');
    setFrontUri('');
    setBackUri('');
    setCapturing(false);
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
    if (captureSide === 'back') {
      setBackUri('');
      setCaptureSide('front');
      return;
    }

    returnToIntro();
  }

  async function continueToCamera() {
    if (!hasPermission) {
      const granted = await requestPermission();

      if (!granted) {
        Alert.alert(
          'Camera permission required',
          'Please allow camera access to capture your ID card.',
        );
        return;
      }
    }

    setStep('capture');
  }

  async function capturePhoto() {
    if (!cameraRef.current || capturing) {
      return;
    }

    setCapturing(true);

    try {
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
      });
      const uri = await cropPhotoToGuide(
        getFileUri(photo.path),
        photo.orientation,
        cameraFrameSize,
      );

      if (captureSide === 'front') {
        setFrontUri(uri);
        return;
      }

      setBackUri(uri);
    } finally {
      setCapturing(false);
    }
  }

  function handleCameraFrameLayout(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout;

    setCameraFrameSize({ height, width });
  }

  function acceptCurrentPhoto() {
    if (captureSide === 'front') {
      setCaptureSide('back');
      return;
    }

    submitKyc().catch(() => null);
  }

  function retakeCurrentPhoto() {
    if (captureSide === 'front') {
      setFrontUri('');
      return;
    }

    setBackUri('');
  }

  async function submitKyc() {
    if (!frontUri || !backUri || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const [imageFrontBase64, imageBackBase64] = await Promise.all([
        prepareKycImageBase64(frontUri),
        prepareKycImageBase64(backUri),
      ]);
      const result = await wallet.submitKycIdCard({
        imageBackBase64,
        imageFrontBase64,
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
              setFrontUri('');
              setBackUri('');
            },
            text: 'Retake front',
          },
          {
            onPress: () => {
              setCaptureSide('back');
              setBackUri('');
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

      {!hasPermission ? (
        <View style={styles.cameraFallback}>
          <Text style={styles.cameraFallbackTitle}>Camera permission required</Text>
          <Text style={styles.cameraFallbackText}>
            Allow camera access to continue verification.
          </Text>
          <PressScale
            onPress={requestPermission}
            style={[styles.primaryButton, styles.primaryButtonStretch]}
          >
            <Text style={styles.primaryButtonText}>Allow camera</Text>
          </PressScale>
        </View>
      ) : !device ? (
        <View style={styles.cameraFallback}>
          <Text style={styles.cameraFallbackTitle}>No camera found</Text>
          <Text style={styles.cameraFallbackText}>
            This device does not have an available back camera.
          </Text>
        </View>
      ) : (
        <View onLayout={handleCameraFrameLayout} style={styles.cameraFrame}>
          {currentUri ? (
            <View style={styles.capturedPreviewLayer}>
              <View
                style={[
                  styles.capturedCardPreview,
                  { aspectRatio: ID_CARD_ASPECT_RATIO },
                ]}
              >
                <Image source={{ uri: currentUri }} style={styles.previewImage} />
                <View pointerEvents="none" style={styles.capturedGuideBorder}>
                  <View style={styles.cornerTopLeft} />
                  <View style={styles.cornerTopRight} />
                  <View style={styles.cornerBottomLeft} />
                  <View style={styles.cornerBottomRight} />
                </View>
              </View>
            </View>
          ) : (
            <Camera
              ref={cameraRef}
              device={device}
              format={cameraFormat}
              isActive
              outputOrientation="preview"
              photo
              photoQualityBalance="quality"
              style={StyleSheet.absoluteFill}
            />
          )}
          {!currentUri ? (
            <View pointerEvents="none" style={styles.guideLayer}>
              <View style={styles.sideHintPill}>
                <Text style={styles.sideHintText}>{sideHint(captureSide)}</Text>
              </View>
              <View
                style={[
                  styles.cardGuide,
                  { aspectRatio: ID_CARD_ASPECT_RATIO },
                ]}
              >
                <View style={styles.cornerTopLeft} />
                <View style={styles.cornerTopRight} />
                <View style={styles.cornerBottomLeft} />
                <View style={styles.cornerBottomRight} />
              </View>
            </View>
          ) : null}
        </View>
      )}

      <View style={[styles.cameraActions, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.progressRow}>
          <View style={[styles.progressDot, frontUri ? styles.progressDone : null]} />
          <Text style={styles.progressText}>Front</Text>
          <View style={[styles.progressDot, backUri ? styles.progressDone : null]} />
          <Text style={styles.progressText}>Back</Text>
        </View>

        {currentUri ? (
          <View style={styles.actionRow}>
            <Pressable
              onPress={retakeCurrentPhoto}
              style={({ pressed }) => [
                styles.actionButtonSlot,
                pressed ? styles.pressedButton : null,
              ]}
            >
              <View style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Retake</Text>
              </View>
            </Pressable>
            <Pressable
              disabled={submitting || wallet.isBusy}
              onPress={acceptCurrentPhoto}
              style={({ pressed }) => [
                styles.actionButtonSlot,
                submitting || wallet.isBusy ? styles.disabledButton : null,
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
        ) : (
          <PressScale
            disabled={capturing}
            onPress={capturePhoto}
            style={styles.captureButton}
          >
            <View style={styles.captureInner} />
          </PressScale>
        )}
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
  captureButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 38,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  captureInner: {
    borderColor: '#111827',
    borderRadius: 30,
    borderWidth: 2,
    height: 60,
    width: 60,
  },
  cardGuide: {
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: GUIDE_MAX_WIDTH,
    width: `${GUIDE_WIDTH_RATIO * 100}%`,
  },
  capturedCardPreview: {
    backgroundColor: '#111827',
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: GUIDE_MAX_WIDTH,
    overflow: 'hidden',
    width: `${GUIDE_WIDTH_RATIO * 100}%`,
  },
  capturedGuideBorder: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 18,
    borderWidth: 1,
  },
  capturedPreviewLayer: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingBottom: GUIDE_BOTTOM_OFFSET,
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
  guideLayer: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingBottom: GUIDE_BOTTOM_OFFSET,
    position: 'absolute',
    right: 0,
    top: 0,
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
  previewImage: {
    backgroundColor: '#000000',
    height: '100%',
    resizeMode: 'cover',
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
  sideHintPill: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    maxWidth: GUIDE_MAX_WIDTH,
    paddingHorizontal: 14,
    paddingVertical: 8,
    width: `${GUIDE_WIDTH_RATIO * 100}%`,
  },
  sideHintText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center',
  },
});
