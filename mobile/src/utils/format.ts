export function getErrorMessage(error: unknown) {
  const rawMessage =
    error instanceof Error ? error.message : String(error || 'Unknown error');
  const normalized = rawMessage.trim().toUpperCase();
  const friendlyMessages: Record<string, string> = {
    APPLE_AUTHORIZATION_REVOCATION_FAILED:
      'Apple authorization could not be revoked. Please try account deletion again.',
    APPLE_REVOCATION_NOT_CONFIGURED:
      'Account deletion is temporarily unavailable because Apple revocation is not configured.',
    APPLE_REVOCATION_TOKEN_REQUIRED:
      'Sign out, sign in with Apple again, then retry account deletion so Apple authorization can be revoked.',
    APPLE_SIGNING_KEY_INVALID:
      'Account deletion is temporarily unavailable because the Apple signing key is invalid.',
    ACCOUNT_DELETION_STORAGE_NOT_READY:
      'Account deletion is temporarily unavailable while the secure data migration is being completed.',
    INSUFFICIENT_VND_BALANCE:
      'The payment provider does not have enough VND available for this withdrawal.',
    ORDER_NOT_ELIGIBLE:
      'This order can no longer be confirmed. Refresh the order to see its latest status.',
    INVALID_ADMIN_CODE:
      'The Testnet confirmation service is not configured correctly.',
    KYC_REQUIRED:
      'Please verify your identity before buying or withdrawing with VND.',
    COUNTRY_MATRIX_NOT_CONFIGURED:
      'Exchange access is not available until the licensed provider country matrix is configured.',
    COUNTRY_NOT_SUPPORTED:
      'The exchange provider does not support your verified country.',
    COUNTRY_NOT_VERIFIED:
      'Verify your country of residence with the exchange provider first.',
    HORIZON_MAINNET_SWAP_DISABLED:
      'Mainnet Swap cannot execute through the Stellar DEX.',
    PROVIDER_API_NOT_CONFIGURED:
      'The licensed exchange provider is not connected yet.',
    PROVIDER_LICENSE_EXPIRED:
      'Exchange access is paused while the provider license is reviewed.',
    PROVIDER_LICENSE_NOT_VERIFIED:
      'Exchange access is not available until the provider license is verified.',
    PROVIDER_NOT_ACTIVE:
      'The exchange provider is not active.',
    PROVIDER_NOT_CONFIGURED:
      'A licensed exchange provider has not been configured yet.',
    PROVIDER_PROFILE_MISMATCH:
      'Your verification profile belongs to a different exchange provider.',
    SANCTIONS_REVIEW:
      'Your exchange access is pending compliance review.',
    SANDBOX_PROVIDER_NOT_CONFIGURED:
      'The partner sandbox is not configured for Testnet review.',
    SWAP_PROVIDER_ADAPTER_NOT_IMPLEMENTED:
      'Mainnet Swap is unavailable until the licensed provider integration is complete.',
    UK_PROMOTIONS_NOT_APPROVED:
      'Exchange access is unavailable in the UK until the provider promotion approval is verified.',
    US_PERMISSIONS_NOT_VERIFIED:
      'Exchange access is unavailable in the US until federal and state permissions are verified.',
    VN_PILOT_LICENSE_NOT_VERIFIED:
      'Exchange access is unavailable in Vietnam until the provider pilot license is verified.',
    KYC_PHOTO_TOO_LARGE:
      'The CCCD photos are too large. Please retake them closer to the card and try again.',
    ORDER_NOT_FOUND: 'The payment provider could not find this order.',
  };
  const friendly = friendlyMessages[normalized];

  return friendly ? `${friendly}\n\nCode: ${normalized}` : rawMessage;
}

export const STELLAR_MINIMUM_FEE_XLM = '0.00001';
const STROOPS_PER_XLM = 10_000_000n;

export function shortAddress(address?: string) {
  if (!address) {
    return 'Not available';
  }

  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

export function maskEmailForDisplay(value?: string | null) {
  const email = String(value || '').trim();
  const separator = email.lastIndexOf('@');

  if (separator <= 0 || separator === email.length - 1) {
    return email || 'No email';
  }

  return `${email.charAt(0)}*****${email.slice(separator)}`;
}

export function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('en-US', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
}

export function formatTokenAmount(
  value?: number | string | null,
  options: {
    compact?: boolean;
    maxFractionDigits?: number;
  } = {},
) {
  const raw = String(value ?? '0').trim();
  const amount = Number(raw.replace(',', '.'));

  if (!Number.isFinite(amount)) {
    return raw || '0';
  }

  const absAmount = Math.abs(amount);

  if (options.compact && absAmount >= 1_000_000) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      notation: 'compact',
      useGrouping: false,
    }).format(amount);
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits:
      options.maxFractionDigits ?? (absAmount >= 1_000 ? 2 : 7),
    minimumFractionDigits: 0,
    useGrouping: false,
  }).format(amount);
}

export function formatStellarFee(
  feeXlm?: string | null,
  fallback = 'Not available',
) {
  if (!feeXlm) {
    return fallback;
  }

  return `${formatTokenAmount(feeXlm, { maxFractionDigits: 7 })} XLM`;
}

export function stroopsToXlm(value?: bigint | number | string | null) {
  const raw = String(value ?? '').trim();

  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const stroops = BigInt(raw);
  const whole = stroops / STROOPS_PER_XLM;
  const fraction = (stroops % STROOPS_PER_XLM).toString().padStart(7, '0');
  const trimmedFraction = fraction.replace(/0+$/, '');

  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole.toString();
}

export function formatStellarFeeFromStroops(
  feeStroops?: bigint | number | string | null,
  fallback = 'Not available',
) {
  return formatStellarFee(stroopsToXlm(feeStroops), fallback);
}

export function formatEstimatedStellarFee(feeXlm?: string | null) {
  return `Estimated ${formatStellarFee(feeXlm || STELLAR_MINIMUM_FEE_XLM)}`;
}

export function isEmailLike(emailValue: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue.trim());
}
