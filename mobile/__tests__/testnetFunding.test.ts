import { api } from '../src/api/client';
import { executeTestnetUsdcSwap } from '../src/hooks/wallet/testnetFunding';

jest.mock('../src/api/client', () => ({ api: jest.fn() }));

const request = jest.mocked(api);
const prepared = {
  hash: `0x${'ab'.repeat(32)}`,
  requiresClientSignature: true,
  transactionXdr: 'prepared-testnet-xdr',
};

function makeInput() {
  return {
    accountId: 'test-account',
    email: 'test@example.com',
    headers: { Authorization: 'Bearer test-token' },
    signRawHash: jest.fn(async () => ({ signature: 'user-signature' })),
    sourceAddress: 'GTEST',
    sourceWalletId: 'test-wallet',
    usdcIssuer: 'GUSDC',
  };
}

beforeEach(() => jest.clearAllMocks());

test('prepares Testnet USDC funding, signs in the client, then submits the same transaction', async () => {
  const input = makeInput();
  const submitted = { requiresClientSignature: false, toAmount: '1.7' };
  request.mockResolvedValueOnce(prepared).mockResolvedValueOnce(submitted);

  await expect(executeTestnetUsdcSwap(input)).resolves.toEqual(submitted);

  expect(request).toHaveBeenCalledTimes(2);
  const [endpoint, firstOptions] = request.mock.calls[0];
  expect(endpoint).toBe('/api/stellar/testnet/swap/execute');
  expect(firstOptions?.headers).toEqual(input.headers);
  const firstBody = JSON.parse(String(firstOptions?.body));
  expect(firstBody).toEqual({
    accountId: input.accountId,
    amount: '10',
    clientSigningSupported: true,
    email: input.email,
    fromAssetCode: 'XLM',
    fromAssetIssuer: null,
    sourceAddress: input.sourceAddress,
    sourceWalletId: input.sourceWalletId,
    toAssetCode: 'USDC',
    toAssetIssuer: input.usdcIssuer,
  });
  expect(input.signRawHash).toHaveBeenCalledWith({
    address: input.sourceAddress,
    chainType: 'stellar',
    hash: prepared.hash,
  });
  expect(request.mock.calls[1][0]).toBe(endpoint);
  expect(request.mock.calls[1][1]?.headers).toEqual(input.headers);
  expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toEqual({
    ...firstBody,
    clientSignature: 'user-signature',
    signingHash: prepared.hash,
    transactionXdr: prepared.transactionXdr,
  });
});

test.each([
  { ...prepared, hash: '' },
  { ...prepared, transactionXdr: undefined },
])('does not sign or submit an incomplete transaction preparation', async response => {
  const input = makeInput();
  request.mockResolvedValueOnce(response);

  await expect(executeTestnetUsdcSwap(input)).rejects.toThrow(
    'Could not prepare Testnet USDC funding',
  );
  expect(input.signRawHash).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
});

test('does not submit a transaction when client signing fails or is cancelled', async () => {
  const input = makeInput();
  request.mockResolvedValueOnce(prepared);
  input.signRawHash.mockRejectedValueOnce(new Error('Signing cancelled'));

  await expect(executeTestnetUsdcSwap(input)).rejects.toThrow('Signing cancelled');
  expect(request).toHaveBeenCalledTimes(1);
});

test('preserves the existing server-signed result for imported wallets', async () => {
  const input = makeInput();
  const result = { requiresClientSignature: false, toAmount: '1.7' };
  request.mockResolvedValueOnce(result);

  await expect(executeTestnetUsdcSwap(input)).resolves.toEqual(result);
  expect(input.signRawHash).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
});
