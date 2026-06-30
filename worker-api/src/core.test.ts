import {
  Account,
  Asset,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import {
  assertCanAddTrustline,
  assertSufficientBalance,
  assertStellarMemo,
  buildPaymentTransaction,
  getAvailableNativeBalance,
  getDefaultFeeEstimateFields,
  getStellarSubmissionErrorMessage,
  getTransactionFeeFields,
  reviewStellarXdr,
  stroopsToXlm,
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
  function accountWithXlm(
    balance: string,
    subentryCount = 0,
    extraBalances: Array<Record<string, unknown>> = [],
  ) {
    return {
      balances: [{ asset_type: 'native', balance }, ...extraBalances],
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

  it('calculates native available balance after reserve and fee buffer', () => {
    expect(getAvailableNativeBalance(accountWithXlm('1.25'))).toBeCloseTo(
      0.2499,
    );
  });

  it('rejects sending native XLM above available balance', () => {
    expect(() =>
      assertSufficientBalance(
        accountWithXlm('1.25'),
        {
          assetCode: 'XLM',
          assetIssuer: null,
          isNative: true,
        } as never,
        '0.3',
      ),
    ).toThrow('Insufficient available XLM balance');
  });

  it('requires XLM for network fees when sending issued assets', () => {
    expect(() =>
      assertSufficientBalance(
        accountWithXlm('1', 1, [
          {
            asset_code: 'USDC',
            asset_issuer: 'GISSUER',
            asset_type: 'credit_alphanum4',
            balance: '5',
          },
        ]),
        {
          assetCode: 'USDC',
          assetIssuer: 'GISSUER',
          isNative: false,
        } as never,
        '1',
      ),
    ).toThrow('Deposit a small amount of XLM');
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

  it('maps insufficient network fee bids to a readable message', () => {
    const message = getStellarSubmissionErrorMessage({
      response: {
        data: {
          extras: {
            result_codes: {
              transaction: 'tx_insufficient_fee',
            },
          },
        },
      },
    });

    expect(message).toContain('higher network fee');
  });
});

describe('Stellar network fees', () => {
  it('converts Horizon fee stroops to XLM exactly', () => {
    expect(stroopsToXlm('100')).toBe('0.00001');
    expect(stroopsToXlm('12345678')).toBe('1.2345678');
  });

  it('normalizes transaction fee fields from Horizon records', () => {
    expect(
      getTransactionFeeFields({
        fee_charged: '100',
        max_fee: '1000',
        operation_count: 1,
      }),
    ).toMatchObject({
      feeChargedStroops: '100',
      feeChargedXlm: '0.00001',
      maxFeeStroops: '1000',
      maxFeeXlm: '0.0001',
      operationCount: 1,
    });
  });

  it('estimates the max transaction fee before submit', () => {
    expect(getDefaultFeeEstimateFields(1)).toEqual({
      feeEstimateStroops: '100',
      feeEstimateXlm: '0.00001',
    });
    expect(getDefaultFeeEstimateFields(2)).toEqual({
      feeEstimateStroops: '200',
      feeEstimateXlm: '0.00002',
    });
  });
});

describe('WalletConnect XDR review', () => {
  const walletConnectEnv = {
    HORIZON_TESTNET_URL: 'https://horizon-testnet.stellar.org',
  } as Env;

  function buildXdr(operation: ReturnType<typeof Operation.payment>) {
    const source = Keypair.random();
    const transaction = new TransactionBuilder(
      new Account(source.publicKey(), '1'),
      {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      },
    )
      .addOperation(operation)
      .setTimeout(60)
      .build();

    return {
      source: source.publicKey(),
      xdr: transaction.toEnvelope().toXDR('base64'),
    };
  }

  function buildSorobanXdr() {
    const source = Keypair.random();
    const contractId = StrKey.encodeContract(new Uint8Array(32).fill(1));
    const transaction = new TransactionBuilder(
      new Account(source.publicKey(), '1'),
      {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      },
    )
      .addOperation(
        new Contract(contractId).call('hello', nativeToScVal('world')),
      )
      .setTimeout(60)
      .build();

    return {
      contractId,
      source: source.publicKey(),
      xdr: transaction.toEnvelope().toXDR('base64'),
    };
  }

  it('returns structured payment details', () => {
    const destination = Keypair.random().publicKey();
    const { source, xdr } = buildXdr(
      Operation.payment({
        amount: '1.25',
        asset: Asset.native(),
        destination,
      }),
    );
    const review = reviewStellarXdr({
      env: walletConnectEnv,
      network: 'testnet',
      sourceAddress: source,
      xdr,
    });

    expect(review.operations).toEqual([
      expect.objectContaining({
        amount: '1.2500000',
        asset: { code: 'XLM', issuer: null },
        destination,
        type: 'payment',
      }),
    ]);
  });

  it('rejects classic operations outside the v1 allowlist', () => {
    const { source, xdr } = buildXdr(
      Operation.manageData({
        name: 'unsupported',
        value: 'value',
      }) as ReturnType<typeof Operation.payment>,
    );

    expect(() =>
      reviewStellarXdr({
        env: walletConnectEnv,
        network: 'testnet',
        sourceAddress: source,
        xdr,
      }),
    ).toThrow('Operation manageData');
  });

  it('returns a guarded Soroban contract call review', () => {
    const { contractId, source, xdr } = buildSorobanXdr();
    const review = reviewStellarXdr({
      env: walletConnectEnv,
      network: 'testnet',
      sourceAddress: source,
      xdr,
    });

    expect(review.operations).toEqual([
      expect.objectContaining({
        argCount: 1,
        authCount: 0,
        contractId,
        functionName: 'hello',
        hostFunctionType: 'hostFunctionTypeInvokeContract',
        type: 'invokeHostFunction',
      }),
    ]);
    expect(review.warnings).toContain(
      'This is a Soroban smart contract request. Only approve if you trust this dApp and understand the contract action.',
    );
  });
});
