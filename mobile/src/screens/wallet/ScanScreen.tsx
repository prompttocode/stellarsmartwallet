import React, { useEffect, useMemo, useState } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletConnect } from '@contexts/WalletConnectContext';

function parseScannedValue(value: string) {
  if (value.startsWith('wc:')) {
    return { type: 'walletconnect' as const, value };
  }

  if (value.startsWith('web+stellar:') || value.startsWith('stellar:')) {
    const normalized = value.replace(/^web\+stellar:/, 'stellar:');
    const query = normalized.includes('?') ? normalized.split('?')[1] : '';
    const params = new URLSearchParams(query);
    const destination =
      params.get('destination') ||
      params.get('to') ||
      params.get('address') ||
      '';

    if (destination) {
      return { type: 'address' as const, value: destination };
    }
  }

  return { type: 'address' as const, value };
}

export function ScanScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const headerStyle = useMemo(
    () => [styles.header, { top: insets.top + 12 }],
    [insets.top],
  );
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [scanned, setScanned] = useState(false);
  const [galleryScanning, setGalleryScanning] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const walletConnect = useWalletConnect();
  const torchAvailable = Boolean(device?.hasTorch);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  function handleFlashPress() {
    if (!torchAvailable) {
      Alert.alert(
        'Flash unavailable',
        'This device camera does not report torch support.',
      );
      return;
    }

    setTorchEnabled(value => !value);
  }

  async function handleScannedValue(value: string) {
    const parsed = parseScannedValue(value);

    if (parsed.type === 'walletconnect') {
      const paired = await walletConnect.pair(parsed.value);

      if (paired) {
        navigation.goBack();
      } else {
        setScanned(false);
      }
      return;
    }

    navigation.replace('Send', { prefilledAddress: parsed.value });
  }

  async function handleSelectFromGallery() {
    if (galleryScanning) {
      return;
    }

    setGalleryScanning(true);
    setScanned(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: false,
        mediaTypes: ['images'],
        quality: 1,
      });

      if (result.canceled) {
        setScanned(false);
        return;
      }

      const imageUri = result.assets?.[0]?.uri;

      if (!imageUri) {
        throw new Error('No image was selected.');
      }

      const qrResults = await scanFromURLAsync(imageUri, ['qr']);
      const value = qrResults.find(item => item.data)?.data;

      if (!value) {
        Alert.alert(
          'No QR code found',
          'Choose a clear image that contains a valid QR code.',
        );
        setScanned(false);
        return;
      }

      await handleScannedValue(value);
    } catch (error) {
      Alert.alert(
        'Could not read QR',
        error instanceof Error
          ? error.message
          : 'Choose another image and try again.',
      );
      setScanned(false);
    } finally {
      setGalleryScanning(false);
    }
  }

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (scanned) return;
      if (codes.length > 0) {
        const value = codes[0].value;
        if (value) {
          setScanned(true);
          handleScannedValue(value).catch(() => setScanned(false));
        }
      }
    },
  });

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>
          Please allow camera access in device settings.
        </Text>
        <TouchableOpacity
          style={styles.buttonPrimary}
          onPress={requestPermission}
        >
          <Text style={styles.buttonPrimaryText}>Allow camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.buttonSecondary}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonSecondaryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No camera was found on this device.</Text>
        <TouchableOpacity
          style={styles.buttonSecondary}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonSecondaryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VisionCamera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!scanned && !galleryScanning}
        torch={
          torchEnabled && torchAvailable && !scanned && !galleryScanning
            ? 'on'
            : 'off'
        }
        codeScanner={codeScanner}
      />
      <View style={headerStyle}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Scan QR code</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View pointerEvents="box-none" style={styles.overlay}>
        <View pointerEvents="none" style={styles.scanFrame} />
        <Text pointerEvents="none" style={styles.scanText}>
          Place the QR code inside the frame
        </Text>
        <View pointerEvents="box-none" style={styles.scanControls}>
          <TouchableOpacity
            activeOpacity={0.78}
            hitSlop={12}
            onPress={handleFlashPress}
            style={[
              styles.flashButton,
              torchEnabled ? styles.flashButtonActive : null,
              !torchAvailable ? styles.flashButtonDisabled : null,
            ]}
          >
            <Ionicons
              color={torchEnabled ? '#0A0A0A' : '#FFFFFF'}
              name={torchEnabled ? 'flash' : 'flash-outline'}
              size={20}
            />
            <Text
              style={[
                styles.flashButtonText,
                torchEnabled ? styles.flashButtonTextActive : null,
              ]}
            >
              {torchAvailable ? 'Flash' : 'No flash'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.78}
            disabled={galleryScanning}
            hitSlop={{ bottom: 14, left: 24, right: 24, top: 14 }}
            onPress={handleSelectFromGallery}
            style={[
              styles.galleryButton,
              galleryScanning ? styles.galleryButtonDisabled : null,
            ]}
          >
            <Ionicons color="#FFFFFF" name="images-outline" size={18} />
            <Text style={styles.galleryText}>Select from gallery</Text>
            {galleryScanning ? (
              <Text style={styles.galleryBusyText}>Reading...</Text>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 44,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  scanText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  scanControls: {
    alignItems: 'center',
    gap: 16,
    marginTop: 22,
    zIndex: 20,
    elevation: 20,
  },
  flashButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  flashButtonActive: {
    backgroundColor: '#B8FF45',
    borderColor: '#B8FF45',
  },
  flashButtonDisabled: {
    opacity: 0.45,
  },
  flashButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  flashButtonTextActive: {
    color: '#0A0A0A',
  },
  galleryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  galleryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  galleryButtonDisabled: {
    opacity: 0.72,
  },
  galleryBusyText: {
    color: '#B8FF45',
    fontSize: 12,
    fontWeight: '800',
  },
  buttonPrimary: {
    backgroundColor: '#3E8FA0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginTop: 16,
  },
  buttonSecondaryText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
