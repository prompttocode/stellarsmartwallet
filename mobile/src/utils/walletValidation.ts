import type { BalanceItem } from '@app-types';
import nacl from 'tweetnacl';
import { formatTokenAmount } from './format';

const STELLAR_AMOUNT_RE = /^\d+(\.\d{1,7})?$/;
const STELLAR_PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;
const STELLAR_SECRET_KEY_RE = /^S[A-Z2-7]{55}$/;
const PRIVY_PRIVATE_KEY_RE = /^(0x)?[0-9a-f]{64}$/i;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STELLAR_PUBLIC_KEY_VERSION_BYTE = 6 << 3;
const STELLAR_SECRET_KEY_VERSION_BYTE = 18 << 3;

export const TRUSTLINE_RESERVE_BUFFER_XLM = 0.5001;

export type AmountValidation = {
  amount: number;
  message: string | null;
  normalized: string;
  valid: boolean;
};

export function normalizeStellarAmountInput(value: unknown) {
  return String(value || '').trim().replace(',', '.');
}

export function validateStellarAmount(
  value: unknown,
  label = 'Amount',
): AmountValidation {
  const normalized = normalizeStellarAmountInput(value);
  const amount = Number(normalized);

  if (
    !normalized ||
    !STELLAR_AMOUNT_RE.test(normalized) ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return {
      amount: 0,
      message: `${label} must be greater than 0 with up to 7 decimal places.`,
      normalized,
      valid: false,
    };
  }

  return {
    amount,
    message: null,
    normalized,
    valid: true,
  };
}

export function isLikelyStellarPublicKey(value: unknown) {
  return STELLAR_PUBLIC_KEY_RE.test(String(value || '').trim().toUpperCase());
}

export function isLikelyImportSecret(value: unknown) {
  const trimmed = String(value || '').trim();

  return (
    STELLAR_SECRET_KEY_RE.test(trimmed) ||
    PRIVY_PRIVATE_KEY_RE.test(trimmed)
  );
}

export function validateImportSecret(value: unknown) {
  return isLikelyImportSecret(value)
    ? null
    : 'Enter a Stellar S... secret key or the 64-hex private key exported by Privy.';
}

function hexToBytes(value: string) {
  const clean = value.replace(/^0x/i, '');
  const bytes = new Uint8Array(clean.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function crc16Xmodem(bytes: Uint8Array) {
  let crc = 0;

  for (const byte of bytes) {
    crc ^= byte << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc =
        crc & 0x8000
          ? ((crc << 1) ^ 0x1021) & 0xffff
          : (crc << 1) & 0xffff;
    }
  }

  return crc;
}

function base32Decode(value: string) {
  const clean = value.replace(/=+$/g, '').toUpperCase();
  const output: number[] = [];
  let bits = 0;
  let buffer = 0;

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);

    if (index < 0) {
      throw new Error('Invalid base32 character');
    }

    buffer = (buffer << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((buffer >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

function base32Encode(bytes: Uint8Array) {
  let bits = 0;
  let buffer = 0;
  let output = '';

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(buffer >> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  }

  return output;
}

function encodeStellarPublicKey(publicKey: Uint8Array) {
  const payload = new Uint8Array(1 + publicKey.length);
  payload[0] = STELLAR_PUBLIC_KEY_VERSION_BYTE;
  payload.set(publicKey, 1);

  const checksum = crc16Xmodem(payload);
  const encoded = new Uint8Array(payload.length + 2);
  encoded.set(payload);
  encoded[payload.length] = checksum & 0xff;
  encoded[payload.length + 1] = (checksum >> 8) & 0xff;

  return base32Encode(encoded);
}

function decodeStellarSecretSeed(value: string) {
  const decoded = base32Decode(value);

  if (decoded.length !== 35 || decoded[0] !== STELLAR_SECRET_KEY_VERSION_BYTE) {
    throw new Error('Invalid Stellar secret key');
  }

  const payload = decoded.slice(0, -2);
  const checksum = crc16Xmodem(payload);
  const expectedLow = checksum & 0xff;
  const expectedHigh = (checksum >> 8) & 0xff;

  if (
    decoded[decoded.length - 2] !== expectedLow ||
    decoded[decoded.length - 1] !== expectedHigh
  ) {
    throw new Error('Invalid Stellar secret key checksum');
  }

  return decoded.slice(1, -2);
}

export function getImportSecretPublicAddress(value: unknown) {
  const trimmed = String(value || '').trim();
  let seed: Uint8Array;

  try {
    if (PRIVY_PRIVATE_KEY_RE.test(trimmed)) {
      seed = hexToBytes(trimmed);
    } else if (STELLAR_SECRET_KEY_RE.test(trimmed)) {
      seed = decodeStellarSecretSeed(trimmed);
    } else {
      return null;
    }
  } catch {
    return null;
  }

  if (seed.length !== 32) {
    return null;
  }

  const keypair = nacl.sign.keyPair.fromSeed(seed);
  const publicAddress = encodeStellarPublicKey(keypair.publicKey);

  if (!STELLAR_PUBLIC_KEY_RE.test(publicAddress)) {
    return null;
  }

  return publicAddress;
}

export function validateWatchOnlyAddress(value: unknown) {
  return isLikelyStellarPublicKey(value)
    ? null
    : 'Enter a valid Stellar public address that starts with G.';
}

export function getAvailableAmount(
  balance?: Pick<BalanceItem, 'availableBalance' | 'balance'> | null,
  fallback?: string | number | null,
) {
  const value = Number(balance?.availableBalance || balance?.balance || fallback || 0);

  return Number.isFinite(value) ? value : 0;
}

export function getXlmTrustlineReserveWarning(
  xlmBalance?: Pick<BalanceItem, 'balance' | 'minimumBalance'> | null,
  balances: Pick<BalanceItem, 'assetCode' | 'assetIssuer' | 'isNative' | 'trusted'>[] = [],
  assetCode = 'asset',
) {
  const balance = Number(xlmBalance?.balance || 0);
  const reportedMinimum = Number(xlmBalance?.minimumBalance || 0);
  const trustedIssuedAssets = balances.filter(
    item => !item.isNative && item.trusted,
  ).length;
  const fallbackMinimum = (2 + trustedIssuedAssets) * 0.5;
  const minimum = Math.max(
    Number.isFinite(reportedMinimum) ? reportedMinimum : 0,
    fallbackMinimum,
  );
  const required = minimum + TRUSTLINE_RESERVE_BUFFER_XLM;

  if (Number.isFinite(balance) && balance >= required) {
    return null;
  }

  return `Not enough XLM to enable ${assetCode}. You have ${formatTokenAmount(
    String(balance),
  )} XLM, but need at least ${formatTokenAmount(
    String(required),
  )} XLM for Stellar reserve and network fees. Deposit more XLM first.`;
}
