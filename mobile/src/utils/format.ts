export function getErrorMessage(error: unknown) {
  const rawMessage =
    error instanceof Error ? error.message : String(error || 'Unknown error');
  const normalized = rawMessage.trim().toUpperCase();
  const friendlyMessages: Record<string, string> = {
    INSUFFICIENT_VND_BALANCE:
      'The payment provider does not have enough VND available for this withdrawal.',
    ORDER_NOT_ELIGIBLE:
      'This order can no longer be confirmed. Refresh the order to see its latest status.',
    INVALID_ADMIN_CODE:
      'The Testnet confirmation service is not configured correctly.',
    KYC_REQUIRED:
      'Please verify your identity before buying or withdrawing with VND.',
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
    }).format(amount);
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits:
      options.maxFractionDigits ?? (absAmount >= 1_000 ? 2 : 7),
    minimumFractionDigits: 0,
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
