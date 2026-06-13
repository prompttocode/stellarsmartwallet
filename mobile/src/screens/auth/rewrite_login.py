import os

login_styles_ts = """import { StyleSheet } from 'react-native';

export const loginStyles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#050505',
  },
  safe: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  
  // Header / Top icon
  topIconContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Graphic
  graphicContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 250,
  },
  graphicImage: {
    width: '100%',
    height: 250,
    opacity: 0.8,
  },

  // Welcome Text
  welcomeTextContainer: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  welcomeSubtitle: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },

  // Buttons
  buttonContainer: {
    gap: 16,
    marginBottom: 32,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    width: '100%',
    gap: 10,
  },
  actionButtonLight: {
    backgroundColor: '#FFFFFF',
  },
  actionButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  actionButtonTextLight: {
    color: '#000000',
  },
  actionButtonTextDark: {
    color: '#FFFFFF',
  },
  actionButtonTextDisabled: {},
  googleIcon: {
    width: 20,
    height: 20,
  },

  // Footer
  footerContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  footerText: {
    color: '#636366',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    textDecorationLine: 'underline',
    color: '#8E8E93',
  },

  // Form Container (for email/otp)
  formContainer: {
    flex: 1,
    gap: 20,
  },
  input: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    color: '#FFFFFF',
    fontSize: 17,
    height: 56,
    paddingHorizontal: 20,
    width: '100%',
  },
  
  // OTP
  otpWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  otpHiddenInput: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
  otpCell: {
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    width: 48,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  otpCellFilled: {
    borderColor: '#3A3A3C',
  },
  otpCellActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#2C2C2E',
  },
  otpDigit: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },

  // Links
  linkRow: {
    alignItems: 'center',
    marginTop: 10,
  },
  textButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  textButtonText: {
    color: '#8E8E93',
    fontSize: 15,
    fontWeight: '500',
  },

  // Error
  messageBox: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 14,
  },
});
"""

login_screen_tsx = """import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { WalletState } from '@hooks/useWallet';
import { loginStyles as styles } from './loginStyles';

const OTP_LENGTH = 6;
const loginHeroImage = require('@assets/images/background/backstellar.png');

function sanitizeOtp(value: string) {
  return value.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

function ActionButton({
  disabled,
  icon,
  iconColor,
  label,
  onPress,
  variant = 'light',
}: {
  disabled?: boolean;
  icon?: string;
  iconColor?: string;
  label: string;
  onPress: () => void;
  variant?: 'light' | 'dark';
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === 'dark' ? styles.actionButtonDark : styles.actionButtonLight,
        disabled ? styles.actionButtonDisabled : null,
        pressed && !disabled ? { opacity: 0.8 } : null,
      ]}
    >
      {icon ? (
        <Ionicons
          color={disabled ? '#7D8796' : (iconColor || (variant === 'dark' ? '#FFFFFF' : '#000000'))}
          name={icon}
          size={20}
        />
      ) : null}
      <Text
        style={[
          styles.actionButtonText,
          variant === 'dark' ? styles.actionButtonTextDark : styles.actionButtonTextLight,
          disabled ? styles.actionButtonTextDisabled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function GoogleButton({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        styles.actionButtonDark,
        disabled ? styles.actionButtonDisabled : null,
        pressed && !disabled ? { opacity: 0.8 } : null,
      ]}
    >
      <Image
        source={require('@assets/images/social/google.png')}
        style={styles.googleIcon}
      />
      <Text style={[styles.actionButtonText, styles.actionButtonTextDark, disabled ? styles.actionButtonTextDisabled : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function OtpInput({
  code,
  disabled,
  onChange,
}: {
  code: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const digits = Array.from({ length: OTP_LENGTH }, (_, index) => code[index]);
  const activeIndex =
    code.length >= OTP_LENGTH ? OTP_LENGTH - 1 : Math.max(code.length, 0);

  useEffect(() => {
    if (disabled) {
      return undefined;
    }

    const timer = setTimeout(() => inputRef.current?.focus(), 120);

    return () => clearTimeout(timer);
  }, [disabled]);

  function focusInput() {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }

  return (
    <Pressable
      accessibilityLabel="Six digit verification code"
      disabled={disabled}
      onPress={focusInput}
      style={styles.otpWrap}
    >
      <TextInput
        autoComplete="one-time-code"
        caretHidden
        editable={!disabled}
        inputMode="numeric"
        keyboardType="number-pad"
        onChangeText={value => onChange(sanitizeOtp(value))}
        ref={inputRef}
        style={styles.otpHiddenInput}
        textContentType="oneTimeCode"
        value={code}
      />
      {digits.map((digit, index) => {
        const filled = Boolean(digit);
        const active = !disabled && index === activeIndex;

        return (
          <View
            key={index}
            style={[
              styles.otpCell,
              filled ? styles.otpCellFilled : null,
              active ? styles.otpCellActive : null,
            ]}
          >
            <Text style={styles.otpDigit}>{digit || ''}</Text>
          </View>
        );
      })}
    </Pressable>
  );
}

function LoginMessage({ wallet }: { wallet: WalletState }) {
  if (!wallet.privyError) {
    return null;
  }

  return (
    <View style={styles.messageBox}>
      <Ionicons color="#FF453A" name="alert-circle-outline" size={17} />
      <Text style={styles.errorText}>{String(wallet.privyError)}</Text>
    </View>
  );
}

function WelcomeStep({ wallet, onSelectEmail }: { wallet: WalletState, onSelectEmail: () => void }) {
  const googleBusy = wallet.busy === 'Sign in with Google';

  return (
    <View style={styles.stepContainer}>
      <View style={styles.topIconContainer}>
        <Ionicons name="planet" size={28} color="#FFFFFF" />
      </View>

      <View style={styles.graphicContainer}>
        <Image source={loginHeroImage} style={styles.graphicImage} resizeMode="contain" />
      </View>

      <View style={styles.welcomeTextContainer}>
        <Text style={styles.welcomeTitle}>Welcome</Text>
        <Text style={styles.welcomeSubtitle}>Your journey starts from here</Text>
      </View>

      <View style={styles.buttonContainer}>
        <ActionButton 
          label="Continue with Email" 
          onPress={onSelectEmail} 
          variant="light" 
        />
        <GoogleButton
          disabled={!wallet.isReady || wallet.isBusy}
          label={googleBusy ? 'Opening Google...' : 'Continue with Google'}
          onPress={wallet.loginWithGoogle}
        />
      </View>

      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>
          By pressing on "Continue with..." you agree{`\\n`}to our <Text style={styles.footerLink}>Terms of Service</Text> and <Text style={styles.footerLink}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}

function EmailLoginStep({ wallet, onBack }: { wallet: WalletState, onBack: () => void }) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.welcomeTextContainer}>
        <Text style={styles.welcomeTitle}>Sign in</Text>
        <Text style={styles.welcomeSubtitle}>Enter your email to receive a code</Text>
      </View>

      <View style={styles.formContainer}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!wallet.isBusy}
          inputMode="email"
          keyboardType="email-address"
          onChangeText={wallet.setEmail}
          placeholder="name@example.com"
          placeholderTextColor="#636366"
          style={styles.input}
          value={wallet.email}
        />

        <ActionButton
          disabled={!wallet.isReady || wallet.isBusy || !wallet.email}
          label={wallet.busy ? wallet.busy : 'Send verification code'}
          onPress={wallet.sendEmailCode}
          variant="light"
        />

        <LoginMessage wallet={wallet} />
      </View>
    </View>
  );
}

function OtpLoginStep({ wallet }: { wallet: WalletState }) {
  const otpReady = wallet.code.length === OTP_LENGTH;

  return (
    <View style={styles.stepContainer}>
      <View style={styles.headerRow}>
        <Pressable onPress={wallet.resetLoginCode} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.welcomeTextContainer}>
        <Text style={styles.welcomeTitle}>Verification</Text>
        <Text style={styles.welcomeSubtitle}>
          We sent a code to{`\\n`}<Text style={{color: '#FFFFFF'}}>{wallet.email}</Text>
        </Text>
      </View>

      <View style={styles.formContainer}>
        <OtpInput
          code={wallet.code}
          disabled={wallet.isBusy}
          onChange={wallet.setCode}
        />

        <ActionButton
          disabled={!wallet.isReady || wallet.isBusy || !otpReady}
          label={wallet.busy || 'Verify and continue'}
          onPress={wallet.verifyCodeAndLogin}
          variant="light"
        />

        <View style={styles.linkRow}>
          <Pressable
            disabled={!wallet.isReady || wallet.isBusy}
            onPress={wallet.sendEmailCode}
            style={styles.textButton}
          >
            <Text style={styles.textButtonText}>Resend code</Text>
          </Pressable>
        </View>

        <LoginMessage wallet={wallet} />
      </View>
    </View>
  );
}

export function LoginScreen({ wallet }: { wallet: WalletState }) {
  const [showEmailStep, setShowEmailStep] = useState(false);

  return (
    <View style={styles.background}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {wallet.codeSent ? (
            <OtpLoginStep wallet={wallet} />
          ) : showEmailStep ? (
            <EmailLoginStep wallet={wallet} onBack={() => setShowEmailStep(false)} />
          ) : (
            <WelcomeStep wallet={wallet} onSelectEmail={() => setShowEmailStep(true)} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
"""

with open('loginStyles.ts', 'w') as f:
    f.write(login_styles_ts)

with open('LoginScreen.tsx', 'w') as f:
    f.write(login_screen_tsx)
