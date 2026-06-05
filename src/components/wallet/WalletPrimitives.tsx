import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { styles } from '@styles/walletStyles';

export function StatusDot({ active }: { active: boolean }) {
  return (
    <View style={[styles.statusDot, active ? styles.statusDotActive : null]} />
  );
}

export function SectionHeading({ title }: { title: string }) {
  return <Text style={styles.sectionHeading}>{title}</Text>;
}

export function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function AddressBlock({ address }: { address?: string }) {
  if (!address) {
    return (
      <View style={styles.addressBox}>
        <Text style={styles.addressText}>No wallet address yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.addressBox}>
      <Text selectable style={styles.addressText}>
        {address}
      </Text>
    </View>
  );
}

export function ActionButton({
  disabled,
  label,
  onPress,
  variant = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  const buttonStyle = [
    styles.button,
    variant === 'secondary' ? styles.secondaryButton : styles.primaryButton,
    disabled ? styles.disabledButton : null,
  ];
  const textStyle = [
    styles.buttonText,
    variant === 'secondary' ? styles.secondaryButtonText : null,
    disabled ? styles.disabledButtonText : null,
  ];

  return (
    <Pressable disabled={disabled} onPress={onPress} style={buttonStyle}>
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}
