import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { modern } from '../../components/wallet/ModernWalletUI';

export function ScanScreen({ navigation }: any) {
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
          // Navigate to Send screen, passing the scanned string as initial parameter
          navigation.replace('Send', { prefilledAddress: value });
        }
      }
    }
  });

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Vui lòng cấp quyền sử dụng Camera trong cài đặt máy.</Text>
        <TouchableOpacity style={styles.buttonPrimary} onPress={requestPermission}>
          <Text style={styles.buttonPrimaryText}>Cấp quyền Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonSecondary} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonSecondaryText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Không tìm thấy Camera trên thiết bị này.</Text>
        <TouchableOpacity style={styles.buttonSecondary} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonSecondaryText}>Quay lại</Text>
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Quét mã QR</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.scanText}>Di chuyển mã QR vào giữa khung hình</Text>
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
    top: 44,
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
