import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ActionButton,
  StatusDot,
} from '../../components/WalletPrimitives';
import { styles } from '../../styles/walletStyles';
import type { WalletDemoState } from '../../hooks/useWalletDemo';

const OTP_LENGTH = 6;

function sanitizeOtp(value: string) {
  return value.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

function ConnectionPill({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <View style={styles.loginPill}>
      <StatusDot active={active} />
      <Text style={styles.loginPillText}>{label}</Text>
    </View>
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
      <View style={styles.googleMark}>
        <Text style={styles.googleMarkText}>G</Text>
      </View>
      <Text
        style={[
          styles.googleButtonText,
          disabled ? styles.disabledButtonText : null,
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

export function LoginScreen({ wallet }: { wallet: WalletDemoState }) {
  const otpReady = wallet.code.length === OTP_LENGTH;
  const serverReady = Boolean(wallet.health?.ok);
  const googleBusy = wallet.busy === 'Đăng nhập Google';

  return (
    <ScrollView
      contentContainerStyle={styles.loginContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brandRow}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>S</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.brandName}>Stellar Wallet</Text>
          <Text style={styles.brandMeta}>Privy secured</Text>
        </View>
        {wallet.isBusy ? <ActivityIndicator color="#1A6F8F" /> : null}
      </View>

      <View style={styles.loginStatusRow}>
        <ConnectionPill
          active={wallet.isReady}
          label={wallet.isReady ? 'Privy ready' : 'Privy loading'}
        />
        <ConnectionPill
          active={serverReady}
          label={serverReady ? 'Server online' : 'Server sync'}
        />
      </View>

      {wallet.codeSent ? (
        <View style={styles.loginPanel}>
          <View style={styles.authHeader}>
            <Pressable
              disabled={wallet.isBusy}
              onPress={wallet.resetLoginCode}
              style={styles.authBackButton}
            >
              <Text style={styles.authBackButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.authEyebrow}>Verification</Text>
          </View>

          <View style={styles.loginTitleBlock}>
            <Text style={styles.authTitle}>Check your email</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to your inbox.
            </Text>
          </View>

          <View style={styles.sentToBox}>
            <Text style={styles.sentToLabel}>Sent to</Text>
            <Text numberOfLines={1} style={styles.sentToEmail}>
              {wallet.email}
            </Text>
          </View>

          <View style={styles.authForm}>
            <OtpInput
              code={wallet.code}
              disabled={wallet.isBusy}
              onChange={wallet.setCode}
            />

            <ActionButton
              disabled={!wallet.isReady || wallet.isBusy || !otpReady}
              label={wallet.busy || 'Verify and continue'}
              onPress={wallet.verifyCodeAndLogin}
            />

            <View style={styles.authLinkRow}>
              <Pressable
                disabled={!wallet.isReady || wallet.isBusy}
                onPress={wallet.sendEmailCode}
                style={styles.authTextButton}
              >
                <Text style={styles.authTextButtonText}>Resend code</Text>
              </Pressable>
              <Pressable
                disabled={wallet.isBusy}
                onPress={wallet.resetLoginCode}
                style={styles.authTextButton}
              >
                <Text style={styles.authTextButtonText}>Use another email</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.loginPanel}>
          <View style={styles.loginTitleBlock}>
            <Text style={styles.kicker}>Privy x Stellar</Text>
            <Text style={styles.title}>Sign in to your wallet</Text>
            <Text style={styles.subtitle}>
              Choose Google or continue with an email code.
            </Text>
          </View>

          <View style={styles.authForm}>
            <GoogleButton
              disabled={!wallet.isReady || wallet.isBusy}
              label={googleBusy ? 'Opening Google' : 'Continue with Google'}
              onPress={wallet.loginWithGoogle}
            />

            <View style={styles.loginDivider}>
              <View style={styles.loginDividerLine} />
              <Text style={styles.loginDividerText}>or</Text>
              <View style={styles.loginDividerLine} />
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

            <ActionButton
              disabled={!wallet.isReady || wallet.isBusy}
              label={
                wallet.busy && !googleBusy
                  ? wallet.busy
                  : 'Send verification code'
              }
              onPress={wallet.sendEmailCode}
            />
          </View>
        </View>
      )}

      <View style={styles.loginMessageBox}>
        <Text style={styles.helper}>{wallet.message}</Text>
        {wallet.privyError ? (
          <Text style={styles.loginErrorText}>{String(wallet.privyError)}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
