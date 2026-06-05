import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
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

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <View style={styles.statusPill}>
      <View
        style={[styles.statusDot, active ? styles.statusDotActive : null]}
      />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

function PrimaryButton({
  disabled,
  icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  icon?: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.primaryButton,
        disabled ? styles.primaryButtonDisabled : null,
      ]}
    >
      {icon ? (
        <Ionicons
          color={disabled ? '#7D8796' : '#FFFFFF'}
          name={icon}
          size={18}
        />
      ) : null}
      <Text
        style={[
          styles.primaryButtonText,
          disabled ? styles.primaryButtonTextDisabled : null,
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
      style={[
        styles.googleButton,
        disabled ? styles.googleButtonDisabled : null,
      ]}
    >
      <Image
        source={require('@assets/images/social/google.png')}
        style={styles.googleIcon}
      />
      <Text style={[styles.googleText, disabled ? styles.disabledText : null]}>
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

function LoginHero({ wallet }: { wallet: WalletState }) {
  const serverReady = Boolean(wallet.health?.ok);

  return (
    <View style={styles.hero}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Image
            source={require('@assets/images/coin/xlm.png')}
            style={styles.brandImage}
          />
        </View>
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>Stellar Smart Wallet</Text>
          <Text style={styles.brandMeta}>Privy secured access</Text>
        </View>
        {wallet.isBusy ? <ActivityIndicator color="#FFFFFF" /> : null}
      </View>

      <View style={styles.heroTextBlock}>
        <Text style={styles.eyebrow}>Privy x Stellar</Text>
        <Text style={styles.heroTitle}>Welcome back</Text>
        <Text style={styles.heroSubtitle}>
          Sign in to continue to your Stellar wallet.
        </Text>
        <View style={styles.statusRow}>
          <StatusPill
            active={wallet.isReady}
            label={wallet.isReady ? 'Privy ready' : 'Privy loading'}
          />
          <StatusPill
            active={serverReady}
            label={serverReady ? 'Server online' : 'Server sync'}
          />
        </View>
      </View>
    </View>
  );
}

function EmailLoginStep({ wallet }: { wallet: WalletState }) {
  const googleBusy = wallet.busy === 'Sign in with Google';

  return (
    <View style={styles.sheet}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepKicker}>Sign in</Text>
        <Text style={styles.stepTitle}>Access your wallet</Text>
        <Text style={styles.stepSubtitle}>
          Use Google or receive a one-time code by email.
        </Text>
      </View>

      <View style={styles.form}>
        <GoogleButton
          disabled={!wallet.isReady || wallet.isBusy}
          label={googleBusy ? 'Opening Google' : 'Continue with Google'}
          onPress={wallet.loginWithGoogle}
        />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.inputLabel}>Email address</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!wallet.isBusy}
          inputMode="email"
          keyboardType="email-address"
          onChangeText={wallet.setEmail}
          placeholder="name@example.com"
          placeholderTextColor="#8A97A6"
          style={styles.input}
          value={wallet.email}
        />

        <PrimaryButton
          disabled={!wallet.isReady || wallet.isBusy}
          icon="mail-outline"
          label={
            wallet.busy && !googleBusy ? wallet.busy : 'Send verification code'
          }
          onPress={wallet.sendEmailCode}
        />
      </View>
    </View>
  );
}

function OtpLoginStep({ wallet }: { wallet: WalletState }) {
  const otpReady = wallet.code.length === OTP_LENGTH;

  return (
    <View style={styles.sheet}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepKicker}>Verification</Text>
        <Text style={styles.stepTitle}>Enter your code</Text>
        <Text style={styles.stepSubtitle}>
          Check the inbox linked to this sign-in request.
        </Text>
      </View>

      <View style={styles.sentBox}>
        <Text style={styles.sentLabel}>Sent to</Text>
        <Text numberOfLines={1} style={styles.sentEmail}>
          {wallet.email}
        </Text>
      </View>

      <View style={styles.form}>
        <OtpInput
          code={wallet.code}
          disabled={wallet.isBusy}
          onChange={wallet.setCode}
        />

        <PrimaryButton
          disabled={!wallet.isReady || wallet.isBusy || !otpReady}
          icon="checkmark-circle-outline"
          label={wallet.busy || 'Verify and continue'}
          onPress={wallet.verifyCodeAndLogin}
        />

        <View style={styles.linkRow}>
          <Pressable
            disabled={!wallet.isReady || wallet.isBusy}
            onPress={wallet.sendEmailCode}
            style={styles.textButton}
          >
            <Text style={styles.textButtonText}>Resend code</Text>
          </Pressable>
          <Pressable
            disabled={wallet.isBusy}
            onPress={wallet.resetLoginCode}
            style={styles.textButton}
          >
            <Text style={styles.textButtonText}>Use another email</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function LoginMessage({ wallet }: { wallet: WalletState }) {
  return (
    <View style={styles.messageBox}>
      <Text style={styles.messageText}>{wallet.message}</Text>
      {wallet.privyError ? (
        <Text style={styles.errorText}>{String(wallet.privyError)}</Text>
      ) : null}
    </View>
  );
}

export function LoginScreen({ wallet }: { wallet: WalletState }) {
  return (
    <ImageBackground
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
      source={loginHeroImage}
      style={styles.background}
    >
      <View style={styles.backdrop}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
          <View>
            <LoginHero wallet={wallet} />
            {wallet.codeSent ? (
              <OtpLoginStep wallet={wallet} />
            ) : (
              <EmailLoginStep wallet={wallet} />
            )}
            <View style={styles.messageInset}>
              <LoginMessage wallet={wallet} />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}
