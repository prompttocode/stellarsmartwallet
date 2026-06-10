import { Account, Asset, Keypair } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import {
  assertCanAddTrustline,
  assertStellarMemo,
  buildPaymentTransaction,
  getStellarSubmissionErrorMessage,
  type Env,
} from './core';

const env = {
  HORIZON_TESTNET_URL: 'https://horizon-testnet.stellar.org',
} as Env;

describe('Stellar payment memo', () => {
  it('adds the order code as a text memo', () => {
    const sourceKeypair = Keypair.random();
    const destinationKeypair = Keypair.random();
    const sourceAccount = new Account(sourceKeypair.publicKey(), '1');
    const destinationAccount = new Account(destinationKeypair.publicKey(), '1');
    const { transaction } = buildPaymentTransaction({
      amount: '1',
      asset: Asset.native(),
      destination: destinationKeypair.publicKey(),
      destinationAccount: destinationAccount as never,
      env,
      memo: 'DHDDWAUQX6DE',
      network: 'testnet',
      sourceAccount: sourceAccount as never,
    });

    expect(transaction.memo.type).toBe('text');
    expect(transaction.memo.value.toString()).toBe('DHDDWAUQX6DE');
  });

  it('rejects text memos larger than Stellar allows', () => {
    expect(() => assertStellarMemo('x'.repeat(29))).toThrow(
      'Stellar text memo must be at most 28 bytes',
    );
  });
});

describe('Stellar trustline reserve', () => {
  function accountWithXlm(balance: string, subentryCount = 0) {
    return {
      balances: [{ asset_type: 'native', balance }],
      subentry_count: subentryCount,
    } as never;
  }

  it('rejects enabling a first trustline with only the base account reserve', () => {
    expect(() => assertCanAddTrustline(accountWithXlm('1'), 'USDT')).toThrow(
      'Not enough XLM to enable USDT',
    );
  });

  it('allows enabling a first trustline when reserve and fee buffer are available', () => {
    expect(() =>
      assertCanAddTrustline(accountWithXlm('1.5002'), 'USDT'),
    ).not.toThrow();
  });
});

describe('Stellar submission errors', () => {
  it('maps low reserve Horizon result codes to a readable message', () => {
    const message = getStellarSubmissionErrorMessage({
      response: {
        data: {
          extras: {
            result_codes: {
              transaction: 'tx_failed',
              operations: ['op_low_reserve'],
            },
          },
        },
      },
    });

    expect(message).toContain('Not enough XLM reserve');
  });

  it('hides generic 400 SDK messages behind the fallback', () => {
    expect(
      getStellarSubmissionErrorMessage(
        new Error('Request failed with status code 400'),
        'Stellar could not submit this transaction.',
      ),
    ).toBe('Stellar could not submit this transaction.');
  });
});
