import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({
  visible,
  message = 'Loading...',
}: LoadingOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.container}>
        <View style={styles.box}>
          <ActivityIndicator size="large" color="#0F8EA3" />
          <Text style={styles.text}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: 'rgba(12, 14, 18, 0.38)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  box: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    minWidth: 184,
    paddingHorizontal: 28,
    paddingVertical: 24,
    shadowColor: '#000000',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
  },
  text: {
    color: '#17191D',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
});
