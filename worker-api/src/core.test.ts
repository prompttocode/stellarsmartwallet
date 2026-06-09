import { Account, Asset, Keypair } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import {
  assertStellarMemo,
  buildPaymentTransaction,
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
