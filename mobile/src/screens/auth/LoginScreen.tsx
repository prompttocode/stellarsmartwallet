import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { WalletState } from '@hooks/useWallet';
import { loginStyles as styles } from './loginStyles';

const OTP_LENGTH = 6;
const loadingAnimation = require('@assets/lottie/loading.json');

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
          color={
            disabled
              ? '#7D8796'
              : iconColor || (variant === 'dark' ? '#FFFFFF' : '#000000')
          }
          name={icon}
          size={20}
        />
      ) : null}
      <Text
        style={[
          styles.actionButtonText,
          variant === 'dark'
            ? styles.actionButtonTextDark
            : styles.actionButtonTextLight,
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
      <Text
        style={[
          styles.actionButtonText,
          styles.actionButtonTextDark,
          disabled ? styles.actionButtonTextDisabled : null,
        ]}
      >
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

function SessionStatus({
  detail,
  label,
}: {
  detail: string;
  label: string;
}) {
  return (
    <View style={styles.sessionStatusBox}>
      <LottieView
        autoPlay
        loop
        source={loadingAnimation}
        style={styles.sessionStatusAnimation}
      />
      <View style={styles.sessionStatusCopy}>
        <Text style={styles.sessionStatusTitle}>{label}</Text>
        <Text style={styles.sessionStatusText}>{detail}</Text>
      </View>
    </View>
  );
}

function WelcomeStep({ wallet, onSelectEmail }: { wallet: WalletState, onSelectEmail: () => void }) {
  const googleBusy = wallet.busy === 'Sign in with Google';
  const restoringSession = wallet.sessionSyncing && !wallet.account;
  const preparingPrivy = !wallet.isReady;
  const status = restoringSession
    ? {
        detail: 'You will enter your wallet automatically when it is ready.',
        label: 'Restoring your session',
      }
    : preparingPrivy
    ? {
        detail: 'Secure sign-in is loading. This usually takes a moment.',
        label: 'Preparing sign-in',
      }
    : null;
  const googleLabel = restoringSession
    ? 'Restoring session...'
    : preparingPrivy
    ? 'Preparing sign-in...'
    : googleBusy
    ? 'Opening Google...'
    : 'Continue with Google';

  return (
    <View style={styles.stepContainer}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ marginBottom: 40 }}>
          <Ionicons name="planet" size={32} color="#FFFFFF" />
        </View>

        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Text style={styles.welcomeTitle}>Welcome</Text>
          <Text style={styles.welcomeSubtitle}>Your journey starts from here</Text>
        </View>

        {status ? (
          <SessionStatus detail={status.detail} label={status.label} />
        ) : null}
      </View>

      <View>
        <View style={styles.buttonContainer}>
          <ActionButton 
            disabled={preparingPrivy || restoringSession || wallet.isBusy}
            label="Continue with Email" 
            onPress={onSelectEmail} 
            variant="light" 
          />
          <GoogleButton
            disabled={!wallet.isReady || restoringSession || wallet.isBusy}
            label={googleLabel}
            onPress={wallet.loginWithGoogle}
          />
        </View>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            By pressing on "Continue with..." you agree{`
`}to our <Text style={styles.footerLink}>Terms of Service</Text> and <Text style={styles.footerLink}>Privacy Policy</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

function EmailLoginStep({
  wallet,
  onBack,
}: {
  wallet: WalletState;
  onBack: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.welcomeTextContainer}>
        <Text style={styles.welcomeTitle}>Sign in</Text>
        <Text style={styles.welcomeSubtitle}>
          Enter your email to receive a code
        </Text>
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
          We sent a code to{`\n`}
          <Text style={{ color: '#FFFFFF' }}>{wallet.email}</Text>
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
            <EmailLoginStep
              wallet={wallet}
              onBack={() => setShowEmailStep(false)}
            />
          ) : (
            <WelcomeStep
              wallet={wallet}
              onSelectEmail={() => setShowEmailStep(true)}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
