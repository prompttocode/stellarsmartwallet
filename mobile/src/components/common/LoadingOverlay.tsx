import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';

const loadingAnimation = require('@assets/lottie/loading3.json');

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({
  visible,
  message = 'Loading...',
}: LoadingOverlayProps) {
  return (
    <Modal
      animationType="fade"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.container}>
        <View style={styles.box}>
          <LottieView
            autoPlay
            loop
            source={loadingAnimation}
            style={styles.animation}
          />
          <Text style={styles.text}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#00000000',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  animation: {
    height: 96,
    width: 128,
  },
  box: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 28,
    minWidth: 190,
    paddingHorizontal: 26,
    paddingVertical: 22,
    shadowColor: '#000000',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
});
