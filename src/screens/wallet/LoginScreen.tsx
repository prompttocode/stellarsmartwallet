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

function FeatureChip({ label }: { label: string }) {
  return (
    <View style={styles.loginChip}>
      <Text style={styles.loginChipText}>{label}</Text>
    </View>
  );
}

function StatusBadge({
  active,
  label,
  value,
}: {
  active: boolean;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.trustBadge}>
      <View
        style={[
          styles.trustBadgeDot,
          active ? styles.trustBadgeDotActive : null,
        ]}
      />
      <View>
        <Text style={styles.trustBadgeLabel}>{label}</Text>
        <Text style={styles.trustBadgeValue}>{value}</Text>
      </View>
    </View>
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

  return (
    <ScrollView
      contentContainerStyle={styles.loginContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.loginDecorTop} />
      <View style={styles.loginDecorBottom} />

      <View style={styles.brandRow}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>S</Text>
        </View>
        <View>
          <Text style={styles.brandName}>Stellar Wallet</Text>
          <Text style={styles.brandMeta}>Privy secured access</Text>
        </View>
      </View>

      <View style={styles.loginHero}>
        <Text style={styles.kicker}>Privy x Stellar</Text>
        <Text style={styles.title}>Access your Stellar wallet in seconds</Text>
        <Text style={styles.subtitle}>
          Sign in with email, then manage Testnet demos or Mainnet assets
          through a Privy-backed Stellar wallet.
        </Text>
        <View style={styles.loginChipRow}>
          <FeatureChip label="Privy Auth" />
          <FeatureChip label="Testnet + Mainnet" />
          <FeatureChip label="Wallet security" />
        </View>
      </View>

      <View style={styles.loginPanel}>
        <View style={styles.authHeader}>
          <View>
            <Text style={styles.authEyebrow}>
              {wallet.codeSent ? 'Verification' : 'Email sign in'}
            </Text>
            <Text style={styles.authTitle}>
              {wallet.codeSent ? 'Enter your code' : 'Open your wallet'}
            </Text>
          </View>
          {wallet.isBusy ? <ActivityIndicator color="#35F2A7" /> : null}
        </View>

        <View style={styles.trustBadgeRow}>
          <StatusBadge
            active={wallet.isReady}
            label="Privy"
            value={wallet.isReady ? 'Ready' : 'Loading'}
          />
          <StatusBadge
            active={serverReady}
            label="Server"
            value={serverReady ? 'Online' : 'Syncing'}
          />
        </View>

        {wallet.codeSent ? (
          <View style={styles.authForm}>
            <View style={styles.sentToBox}>
              <Text style={styles.sentToLabel}>Code sent to</Text>
              <Text numberOfLines={1} style={styles.sentToEmail}>
                {wallet.email}
              </Text>
            </View>

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
                <Text style={styles.authTextButtonText}>Change email</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.authForm}>
            <Text style={styles.inputLabel}>Email address</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!wallet.isBusy}
              inputMode="email"
              keyboardType="email-address"
              onChangeText={wallet.setEmail}
              placeholder="name@example.com"
              placeholderTextColor="#7D8D9A"
              style={styles.input}
              value={wallet.email}
            />

            <ActionButton
              disabled={!wallet.isReady || wallet.isBusy}
              label={wallet.busy || 'Send verification code'}
              onPress={wallet.sendEmailCode}
            />
            <ActionButton
              disabled={!wallet.isReady || wallet.isBusy}
              label={
                wallet.busy === 'Đăng nhập Google'
                  ? wallet.busy
                  : 'Continue with Google'
              }
              onPress={wallet.loginWithGoogle}
              variant="secondary"
            />
          </View>
        )}

        <View style={styles.loginMessageBox}>
          <Text style={styles.helper}>{wallet.message}</Text>
        </View>
        {wallet.privyError ? (
          <Text style={styles.loginErrorText}>{String(wallet.privyError)}</Text>
        ) : null}
      </View>

      <View style={styles.statusStrip}>
        <StatusDot active={Boolean(wallet.health?.ok)} />
        <Text style={styles.statusText}>
          {wallet.health?.ok
            ? 'Privy API và Stellar network sẵn sàng'
            : 'Đang kiểm tra máy chủ demo'}
        </Text>
      </View>
    </ScrollView>
  );
}
