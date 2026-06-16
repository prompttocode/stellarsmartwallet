import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ErrorPopupProps {
  message?: string;
  onDismiss: () => void;
  title?: string;
  visible: boolean;
}

export function ErrorPopup({
  message,
  onDismiss,
  title = 'Something went wrong',
  visible,
}: ErrorPopupProps) {
  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={styles.overlay}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onDismiss}
        style={styles.backdrop}
      >
        <Pressable style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons color="#FF6B7A" name="alert-circle" size={34} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>
            {message || 'Please try again.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.button,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.buttonText}>OK</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    elevation: 999,
    zIndex: 999,
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#B8FF45',
    borderRadius: 18,
    marginTop: 22,
    paddingVertical: 14,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonText: {
    color: '#07100B',
    fontSize: 16,
    fontWeight: '900',
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 30,
    borderWidth: 1,
    maxWidth: 360,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { height: 18, width: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    width: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 122, 0.12)',
    borderRadius: 24,
    height: 56,
    justifyContent: 'center',
    marginBottom: 14,
    width: 56,
  },
  message: {
    color: '#D5DEE5',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
});
