import { describe, expect, it } from 'vitest';
import type { Env } from './core';
import { getExchangeEligibility } from './exchangeEligibility';

function createEnv(
  values: Partial<Env> = {},
  profile: Record<string, unknown> | null = null,
) {
  return {
    DB: {
      prepare: () => ({
        bind() {
          return this;
        },
        first: async () => profile,
      }),
    },
    FRIENDBOT_URL: 'https://friendbot.example',
    HORIZON_MAINNET_URL: 'https://horizon.example',
    HORIZON_TESTNET_URL: 'https://horizon-testnet.example',
    PRIVY_APP_ID: 'app-id',
    PRIVY_APP_SECRET: 'app-secret',
    ...values,
  } as unknown as Env;
}

const account = { email: 'user@example.com', id: 'user-1' };

describe('exchange eligibility', () => {
  it('allows direct Horizon swaps only on Testnet', async () => {
    await expect(
      getExchangeEligibility(createEnv(), account, {
        network: 'testnet',
        service: 'swap',
      }),
    ).resolves.toMatchObject({
      allowed: true,
      providerId: 'stellar-testnet-horizon',
      reasonCode: 'ALLOWED_TESTNET',
    });
  });

  it('fails closed when no licensed Mainnet provider is configured', async () => {
    await expect(
      getExchangeEligibility(createEnv(), account, {
        network: 'mainnet',
        service: 'swap',
      }),
    ).resolves.toMatchObject({
      allowed: false,
      reasonCode: 'PROVIDER_NOT_CONFIGURED',
    });
  });

  it('rejects a country outside the written provider matrix', async () => {
    const env = createEnv(
      {
        EXCHANGE_ALLOWED_COUNTRIES: 'VN',
        EXCHANGE_LICENSE_VALID_UNTIL: '2099-12-31',
        EXCHANGE_PROVIDER_ID: 'licensed-provider',
        EXCHANGE_PROVIDER_STATUS: 'active',
      },
      {
        country_code: 'US',
        kyc_status: 'verified',
        provider_id: 'licensed-provider',
        sanctions_status: 'clear',
      },
    );

    await expect(
      getExchangeEligibility(env, account, {
        network: 'mainnet',
        service: 'swap',
      }),
    ).resolves.toMatchObject({
      allowed: false,
      countryCode: 'US',
      reasonCode: 'COUNTRY_NOT_SUPPORTED',
    });
  });

  it('requires Vietnam pilot-license evidence even when VN is allowed', async () => {
    const env = createEnv(
      {
        EXCHANGE_ALLOWED_COUNTRIES: 'VN',
        EXCHANGE_LICENSE_VALID_UNTIL: '2099-12-31',
        EXCHANGE_PROVIDER_ID: 'licensed-provider',
        EXCHANGE_PROVIDER_STATUS: 'active',
      },
      {
        country_code: 'VN',
        kyc_status: 'verified',
        provider_id: 'licensed-provider',
        sanctions_status: 'clear',
      },
    );

    await expect(
      getExchangeEligibility(env, account, {
        network: 'mainnet',
        service: 'swap',
      }),
    ).resolves.toMatchObject({
      allowed: false,
      reasonCode: 'VN_PILOT_LICENSE_NOT_VERIFIED',
    });
  });
});
