import type { Context, Hono } from 'hono';
import { Keypair } from '@stellar/stellar-sdk';
import {
  assertAccountWallet,
  assertStellarAddress,
  buildPaymentTransaction,
  buildSubmittedTransactionItem,
  buildTrustlineTransaction,
  bytesToHex,
  DEMO_NFT_ASSET_CODE,
  ensureDemoAssetIssuer,
  findIssuedBalance,
  getAccountBalances,
  getAccountHistory,
  getIssuedAsset,
  getStellarServer,
  loadAccount,
  makeError,
  normalizeNetwork,
  parseStellarXdr,
  readJsonBody,
  requireClassicTransaction,
  requireAccountContext,
  submitPrivySignedTransaction,
  type AssetDefinition,
  type StellarNetwork,
  type WorkerBindings,
} from '../core';

const DEMO_NFT_AMOUNT = '1';

function normalizeClientSignature(value: unknown) {
  const signature = String(value || '').trim();

  if (!signature) {
    return null;
  }

  if (!/^(0x)?[0-9a-fA-F]+$/.test(signature)) {
    throw makeError('Invalid Stellar signature format', 400);
  }

  const signatureHex = signature.replace(/^0x/i, '');

  if (signatureHex.length !== 128) {
    throw makeError('Invalid Stellar signature format', 400);
  }

  return signatureHex;
}

function buildDemoNftDefinition(
  issuerAddress: string,
  network: StellarNetwork,
): AssetDefinition {
  return {
    assetCode: DEMO_NFT_ASSET_CODE,
    assetIssuer: issuerAddress,
    demo: true,
    displayName: 'Instawards Completion NFT',
    homeDomain: 'demo.local',
    iconKey: 'sownft',
    isNative: false,
    network,
    trustLevel: 'verified',
  };
}

async function getDemoNftDefinition(env: WorkerBindings['Bindings']) {
  const issuer = await ensureDemoAssetIssuer(env, DEMO_NFT_ASSET_CODE, 'testnet');

  if (!issuer) {
    throw makeError('Demo NFT issuer is not available', 500);
  }

  return {
    issuer,
    nftDefinition: buildDemoNftDefinition(issuer.publicKey, 'testnet'),
  };
}

async function getCollectibleItems(
  env: WorkerBindings['Bindings'],
  addressValue: unknown,
  networkValue: unknown,
) {
  const network = normalizeNetwork(networkValue);

  if (network !== 'testnet') {
    return {
      collectibles: [],
      network,
    };
  }

  const address = String(addressValue || '').trim();
  const { nftDefinition } = await getDemoNftDefinition(env);
  const account = address ? await loadAccount(env, address, network) : null;
  const balance = findIssuedBalance(
    account,
    nftDefinition.assetCode,
    nftDefinition.assetIssuer,
  );
  const balanceAmount = balance?.balance || '0';

  return {
    collectibles: [
      {
        ...nftDefinition,
        balance: balanceAmount,
        claimed: Number(balanceAmount) > 0,
        description:
          'Demo Stellar collectible for the Instawards SOW completion evidence.',
        explorerUrl: nftDefinition.assetIssuer
          ? `https://stellar.expert/explorer/testnet/asset/${nftDefinition.assetCode}-${nftDefinition.assetIssuer}`
          : null,
        id: `${network}:${nftDefinition.assetCode}:${nftDefinition.assetIssuer}`,
        supply: DEMO_NFT_AMOUNT,
      },
    ],
    network,
  };
}

async function handleFundNft(
  c: Context<WorkerBindings>,
  fallbackNetwork: StellarNetwork = 'testnet',
) {
  const body = await readJsonBody(c);
  const network = normalizeNetwork(c.req.param('network'), fallbackNetwork);

  if (network !== 'testnet') {
    throw makeError('Demo NFT minting is only available on Testnet', 400);
  }

  const sourceWalletId = String(body.sourceWalletId || '').trim();
  const sourceAddress = String(body.sourceAddress || body.address || '').trim();
  const clientSignatureHex = normalizeClientSignature(
    body.clientSignature || body.signature,
  );
  const expectedSigningHash = String(
    body.signingHash || body.hash || '',
  ).trim();
  const account = await requireAccountContext(c.env, c.req.header('authorization'), body, {
    network,
    requireAuth: false,
  });

  assertStellarAddress(sourceAddress, 'Wallet');
  const sourceWallet = assertAccountWallet({
    account,
    address: sourceAddress,
    network,
    walletId: sourceWalletId,
  });

  const sourceAccount = await loadAccount(c.env, sourceAddress, network);

  if (!sourceAccount) {
    throw makeError(
      'Wallet does not exist on Stellar Testnet. Fund test XLM first.',
      400,
    );
  }

  const { issuer, nftDefinition } = await getDemoNftDefinition(c.env);
  const existingBalance = findIssuedBalance(
    sourceAccount,
    nftDefinition.assetCode,
    nftDefinition.assetIssuer,
  );

  if (existingBalance && Number(existingBalance.balance || '0') > 0) {
    const refreshed = await getAccountBalances(c.env, sourceAddress, network);

    return c.json({
      alreadyClaimed: true,
      balances: refreshed.balances,
      collectibles: (await getCollectibleItems(c.env, sourceAddress, network))
        .collectibles,
      network,
      transaction: null,
      transactions: await getAccountHistory(c.env, sourceAddress, network),
    });
  }

  let trustlineTransaction = null;
  let refreshedSourceAccount = sourceAccount;

  if (!existingBalance) {
    const changeTrust = buildTrustlineTransaction({
      asset: getIssuedAsset(nftDefinition),
      env: c.env,
      network,
      sourceAccount,
    });
    const trustlineToSubmit =
      clientSignatureHex && body.transactionXdr
        ? requireClassicTransaction(
            parseStellarXdr(c.env, body.transactionXdr, network),
          )
        : changeTrust;
    const signingHash = `0x${bytesToHex(
      trustlineToSubmit.hash() as Uint8Array,
    )}`;

    if (
      clientSignatureHex &&
      expectedSigningHash &&
      expectedSigningHash.toLowerCase() !== signingHash.toLowerCase()
    ) {
      throw makeError('Transaction changed before signing. Please try again.', 409);
    }

    if (
      sourceWallet.kind !== 'imported_privy' &&
      !clientSignatureHex &&
      body.clientSigningSupported === true
    ) {
      return c.json(
        {
          alreadyClaimed: false,
          balances: [],
          collectibles: (await getCollectibleItems(c.env, sourceAddress, network))
            .collectibles,
          hash: signingHash,
          network,
          requiresClientSignature: true,
          transaction: null,
          transactionXdr: trustlineToSubmit.toEnvelope().toXDR('base64'),
          transactions: [],
          trustlineTransaction: null,
        },
        202,
      );
    }

    const submittedTrustline = await submitPrivySignedTransaction({
      clientSignatureHex: clientSignatureHex || undefined,
      env: c.env,
      network,
      sourceAddress,
      transaction: trustlineToSubmit,
      wallet: sourceWallet,
      walletId: sourceWalletId,
    });

    trustlineTransaction = buildSubmittedTransactionItem({
      amount: '0',
      assetCode: nftDefinition.assetCode,
      assetIssuer: nftDefinition.assetIssuer,
      direction: 'trustline',
      env: c.env,
      from: sourceAddress,
      network,
      operation: 'change_trust',
      submitted: submittedTrustline,
      to: nftDefinition.assetIssuer || '',
    });
    const reloadedSourceAccount = await loadAccount(c.env, sourceAddress, network);

    if (!reloadedSourceAccount) {
      throw makeError('Wallet became unavailable after trustline creation', 500);
    }

    refreshedSourceAccount = reloadedSourceAccount;
  }

  const issuerAccount = await loadAccount(c.env, issuer.publicKey, network);

  if (!issuerAccount) {
    throw makeError('Demo NFT issuer is not active', 500);
  }

  const { transaction } = buildPaymentTransaction({
    amount: DEMO_NFT_AMOUNT,
    asset: getIssuedAsset(nftDefinition),
    destination: sourceAddress,
    destinationAccount: refreshedSourceAccount,
    env: c.env,
    network,
    sourceAccount: issuerAccount,
  });

  transaction.sign(Keypair.fromSecret(issuer.secret));

  const submitted = await getStellarServer(c.env, network).submitTransaction(
    transaction,
  );
  const refreshed = await getAccountBalances(c.env, sourceAddress, network);
  const nftTransaction = buildSubmittedTransactionItem({
    amount: DEMO_NFT_AMOUNT,
    assetCode: nftDefinition.assetCode,
    assetIssuer: nftDefinition.assetIssuer,
    direction: 'received',
    env: c.env,
    from: issuer.publicKey,
    network,
    operation: 'payment',
    submitted,
    to: sourceAddress,
  });

  return c.json({
    alreadyClaimed: false,
    balances: refreshed.balances,
    collectibles: (await getCollectibleItems(c.env, sourceAddress, network))
      .collectibles,
    network,
    transaction: nftTransaction,
    transactions: await getAccountHistory(c.env, sourceAddress, network),
    trustlineTransaction,
  });
}

export function registerCollectibleRoutes(app: Hono<WorkerBindings>) {
  app.get('/api/collectibles', async c => {
    const network = normalizeNetwork(c.req.query('network'));
    const address = String(c.req.query('address') || '').trim();

    if (address) {
      assertStellarAddress(address, 'Wallet');
    }

    return c.json(await getCollectibleItems(c.env, address, network));
  });

  app.post('/api/stellar/:network/fund-nft', c => handleFundNft(c));
  app.post('/api/stellar/fund-nft', c => handleFundNft(c, 'testnet'));
}
