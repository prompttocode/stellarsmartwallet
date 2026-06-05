import React, { useEffect, useMemo, useState } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned: (codes) => {
      if (scanned) return;
      if (codes.length > 0) {
        const value = codes[0].value;
        if (value) {
          setScanned(true);
          const parsed = parseScannedValue(value);

          if (parsed.type === 'walletconnect') {
            Alert.alert(
              'WalletConnect',
              'WalletConnect URI received. Open Account to configure a Reown projectId before pairing dApps.',
            );
            navigation.goBack();
            return;
          }

          navigation.replace('Send', { prefilledAddress: parsed.value });
        }
      }
    }
  });

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Please allow camera access in device settings.</Text>
        <TouchableOpacity style={styles.buttonPrimary} onPress={requestPermission}>
          <Text style={styles.buttonPrimaryText}>Allow camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonSecondary} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonSecondaryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No camera was found on this device.</Text>
        <TouchableOpacity style={styles.buttonSecondary} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonSecondaryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!scanned}
        codeScanner={codeScanner}
      />
      <View style={headerStyle}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Scan QR code</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.scanText}>Place the QR code inside the frame</Text>
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
    pointerEvents: 'none',
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
  }
});
