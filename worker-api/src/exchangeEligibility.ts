import {
  getKycForAccount,
  makeError,
  normalizeNetwork,
  type AccountRecord,
  type Env,
  type StellarNetwork,
} from './core';

export type ExchangeService = 'ramp' | 'swap';

export type ExchangeEligibility = {
  allowed: boolean;
  countryCode: string | null;
  kycStatus: string;
  providerId: string | null;
  reasonCode: string;
};

type ExchangeProfileRow = {
  country_code: string | null;
  kyc_status: string | null;
  provider_id: string | null;
  sanctions_status: string | null;
};

function normalizedValue(value: unknown) {
  return String(value || '').trim();
}

function isEnabled(value: unknown) {
  return ['1', 'true', 'yes'].includes(normalizedValue(value).toLowerCase());
}

function getAllowedCountries(env: Env) {
  return new Set(
    normalizedValue(env.EXCHANGE_ALLOWED_COUNTRIES)
      .split(',')
      .map(value => value.trim().toUpperCase())
      .filter(value => /^[A-Z]{2}$/.test(value)),
  );
}

function getProviderLicenseExpiry(env: Env) {
  const value = normalizedValue(env.EXCHANGE_LICENSE_VALID_UNTIL);
  const timestamp = Date.parse(value);

  return value && Number.isFinite(timestamp) ? timestamp : null;
}

function getGlobalProviderReason(env: Env, service: ExchangeService) {
  if (!normalizedValue(env.EXCHANGE_PROVIDER_ID)) {
    return 'PROVIDER_NOT_CONFIGURED';
  }

  if (normalizedValue(env.EXCHANGE_PROVIDER_STATUS).toLowerCase() !== 'active') {
    return 'PROVIDER_NOT_ACTIVE';
  }

  const licenseExpiry = getProviderLicenseExpiry(env);

  if (!licenseExpiry) {
    return 'PROVIDER_LICENSE_NOT_VERIFIED';
  }

  if (licenseExpiry <= Date.now()) {
    return 'PROVIDER_LICENSE_EXPIRED';
  }

  if (getAllowedCountries(env).size === 0) {
    return 'COUNTRY_MATRIX_NOT_CONFIGURED';
  }

  if (
    service === 'ramp' &&
    (!normalizedValue(env.PAYMENT_API_BASE_URL) ||
      !normalizedValue(env.PAYMENT_PARTNER_APP_KEY))
  ) {
    return 'PROVIDER_API_NOT_CONFIGURED';
  }

  return null;
}

async function getExchangeProfile(env: Env, accountEmail: string) {
  try {
    return await env.DB.prepare(
      `SELECT provider_id, country_code, kyc_status, sanctions_status
       FROM account_exchange_profiles
       WHERE account_email = ?
       LIMIT 1`,
    )
      .bind(accountEmail)
      .first<ExchangeProfileRow>();
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: 'exchange.profile_unavailable',
        message: error instanceof Error ? error.message : String(error),
        service: 'privy-stellar-api',
        timestamp: new Date().toISOString(),
      }),
    );
    return null;
  }
}

function denied(
  reasonCode: string,
  values: Partial<ExchangeEligibility> = {},
): ExchangeEligibility {
  return {
    allowed: false,
    countryCode: values.countryCode || null,
    kycStatus: values.kycStatus || 'not_started',
    providerId: values.providerId || null,
    reasonCode,
  };
}

export function isExchangeProviderConfigured(
  env: Env,
  networkValue: unknown,
  service: ExchangeService,
) {
  const network = normalizeNetwork(networkValue);

  if (network === 'testnet') {
    if (service === 'swap') {
      return true;
    }

    return (
      isEnabled(env.EXCHANGE_SANDBOX_ENABLED) &&
      Boolean(
        normalizedValue(env.PAYMENT_API_BASE_URL) &&
          normalizedValue(env.PAYMENT_PARTNER_APP_KEY),
      )
    );
  }

  return getGlobalProviderReason(env, service) === null;
}

export async function getExchangeEligibility(
  env: Env,
  account: AccountRecord,
  options: { network: StellarNetwork; service: ExchangeService },
): Promise<ExchangeEligibility> {
  if (options.network === 'testnet') {
    if (options.service === 'swap') {
      return {
        allowed: true,
        countryCode: null,
        kycStatus: 'not_required',
        providerId: 'stellar-testnet-horizon',
        reasonCode: 'ALLOWED_TESTNET',
      };
    }

    const kyc = await getKycForAccount(env, account.email);
    const kycStatus = kyc?.status || 'not_started';

    if (!isExchangeProviderConfigured(env, options.network, options.service)) {
      return denied('SANDBOX_PROVIDER_NOT_CONFIGURED', { kycStatus });
    }

    if (kycStatus !== 'verified') {
      return denied('KYC_REQUIRED', {
        kycStatus,
        providerId: normalizedValue(env.EXCHANGE_SANDBOX_PROVIDER_ID) ||
          'partner-sandbox',
      });
    }

    return {
      allowed: true,
      countryCode: kyc?.countryCode || null,
      kycStatus,
      providerId:
        normalizedValue(env.EXCHANGE_SANDBOX_PROVIDER_ID) || 'partner-sandbox',
      reasonCode: 'ALLOWED_SANDBOX',
    };
  }

  const providerId = normalizedValue(env.EXCHANGE_PROVIDER_ID) || null;
  const globalReason = getGlobalProviderReason(env, options.service);

  if (globalReason) {
    return denied(globalReason, { providerId });
  }

  const profile = await getExchangeProfile(env, account.email);

  if (!profile) {
    return denied('COUNTRY_NOT_VERIFIED', { providerId });
  }

  const countryCode = normalizedValue(profile.country_code).toUpperCase() || null;
  const kycStatus = normalizedValue(profile.kyc_status).toLowerCase() ||
    'not_started';
  const sanctionsStatus = normalizedValue(profile.sanctions_status).toLowerCase();

  if (normalizedValue(profile.provider_id) !== providerId) {
    return denied('PROVIDER_PROFILE_MISMATCH', {
      countryCode,
      kycStatus,
      providerId,
    });
  }

  if (!countryCode) {
    return denied('COUNTRY_NOT_VERIFIED', { kycStatus, providerId });
  }

  if (!getAllowedCountries(env).has(countryCode)) {
    return denied('COUNTRY_NOT_SUPPORTED', {
      countryCode,
      kycStatus,
      providerId,
    });
  }

  if (
    countryCode === 'US' &&
    !isEnabled(env.EXCHANGE_US_PERMISSIONS_VERIFIED)
  ) {
    return denied('US_PERMISSIONS_NOT_VERIFIED', {
      countryCode,
      kycStatus,
      providerId,
    });
  }

  if (
    countryCode === 'GB' &&
    !isEnabled(env.EXCHANGE_UK_PROMOTIONS_APPROVED)
  ) {
    return denied('UK_PROMOTIONS_NOT_APPROVED', {
      countryCode,
      kycStatus,
      providerId,
    });
  }

  if (
    countryCode === 'VN' &&
    !normalizedValue(env.EXCHANGE_VN_PILOT_LICENSE_ID)
  ) {
    return denied('VN_PILOT_LICENSE_NOT_VERIFIED', {
      countryCode,
      kycStatus,
      providerId,
    });
  }

  if (!['approved', 'verified'].includes(kycStatus)) {
    return denied('KYC_REQUIRED', { countryCode, kycStatus, providerId });
  }

  if (sanctionsStatus !== 'clear') {
    return denied('SANCTIONS_REVIEW', { countryCode, kycStatus, providerId });
  }

  return {
    allowed: true,
    countryCode,
    kycStatus,
    providerId,
    reasonCode: 'ALLOWED',
  };
}

export async function assertExchangeEligibility(
  env: Env,
  account: AccountRecord,
  options: { network: StellarNetwork; service: ExchangeService },
) {
  const result = await getExchangeEligibility(env, account, options);

  if (!result.allowed) {
    throw makeError(result.reasonCode, 403);
  }

  return result;
}
