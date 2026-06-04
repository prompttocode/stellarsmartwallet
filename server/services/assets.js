/* eslint-env node */

const { getIssuer } = require('../db');
const { normalizeNetwork } = require('./networks');

const NATIVE_ASSET_CODE = 'XLM';
const DEMO_ASSET_CODES = ['USDC', 'USDT'];

const MAINNET_ASSETS = [
  {
    assetCode: 'XLM',
    assetIssuer: null,
    displayName: 'Lumens',
    homeDomain: 'stellar.org',
    iconKey: 'xlm',
    isNative: true,
    network: 'mainnet',
    trustLevel: 'verified',
  },
  {
    assetCode: 'USDC',
    assetIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    displayName: 'USD Coin',
    homeDomain: 'circle.com',
    iconKey: 'usdc',
    isNative: false,
    network: 'mainnet',
    trustLevel: 'verified',
  },
  {
    assetCode: 'EURC',
    assetIssuer: 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2',
    displayName: 'Euro Coin',
    homeDomain: 'circle.com',
    iconKey: 'eurc',
    isNative: false,
    network: 'mainnet',
    trustLevel: 'verified',
  },
  {
    assetCode: 'PYUSD',
    assetIssuer: 'GDQE7IXJ4HUHV6RQHIUPRJSEZE4DRS5WY577O2FY6YQ5LVWZ7JZTU2V5',
    displayName: 'PayPal USD',
    homeDomain: 'paypal.com',
    iconKey: 'pyusd',
    isNative: false,
    network: 'mainnet',
    trustLevel: 'verified',
  },
  {
    assetCode: 'AQUA',
    assetIssuer: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA',
    displayName: 'Aquarius',
    homeDomain: 'aqua.network',
    iconKey: 'aqua',
    isNative: false,
    network: 'mainnet',
    trustLevel: 'verified',
  },
  {
    assetCode: 'yXLM',
    assetIssuer: 'GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55',
    displayName: 'Ultra Capital yXLM',
    homeDomain: 'ultracapital.xyz',
    iconKey: 'yxlm',
    isNative: false,
    network: 'mainnet',
    trustLevel: 'verified',
  },
  {
    assetCode: 'yUSDC',
    assetIssuer: 'GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF',
    displayName: 'Ultra Capital yUSDC',
    homeDomain: 'ultracapital.xyz',
    iconKey: 'yusdc',
    isNative: false,
    network: 'mainnet',
    trustLevel: 'verified',
  },
];

function normalizeAssetCode(assetCode) {
  const value = String(assetCode || NATIVE_ASSET_CODE).trim();

  if (value.toLowerCase() === 'yxlm') {
    return 'yXLM';
  }

  if (value.toLowerCase() === 'yusdc') {
    return 'yUSDC';
  }

  return value.toUpperCase();
}

function getTestnetAssetDefinitions(issuers = {}) {
  return [
    {
      assetCode: NATIVE_ASSET_CODE,
      assetIssuer: null,
      demo: false,
      displayName: 'Lumens',
      homeDomain: 'stellar.org',
      iconKey: 'xlm',
      isNative: true,
      network: 'testnet',
      trustLevel: 'verified',
    },
    ...DEMO_ASSET_CODES.map(assetCode => ({
      assetCode,
      assetIssuer: issuers[assetCode]?.publicKey || null,
      demo: true,
      displayName: `${assetCode} demo`,
      homeDomain: 'demo.local',
      iconKey: assetCode.toLowerCase(),
      isNative: false,
      network: 'testnet',
      trustLevel: 'verified',
    })),
  ];
}

function getKnownAssetDefinitions(network, issuers = {}) {
  const normalizedNetwork = normalizeNetwork(network);

  if (normalizedNetwork === 'mainnet') {
    return MAINNET_ASSETS.map(asset => ({
      ...asset,
      demo: false,
    }));
  }

  return getTestnetAssetDefinitions(issuers);
}

function getIssuerKey(network, assetCode) {
  return `${normalizeNetwork(network)}:${normalizeAssetCode(assetCode)}`;
}

async function getDemoIssuer(assetCode) {
  return (
    (await getIssuer(getIssuerKey('testnet', assetCode))) ||
    (await getIssuer(normalizeAssetCode(assetCode)))
  );
}

function getAssetKey(asset) {
  return asset.isNative || asset.assetCode === NATIVE_ASSET_CODE
    ? `${asset.network}:native`
    : `${asset.network}:${asset.assetCode}:${asset.assetIssuer}`;
}

function getDiscoveredAssetFromBalance(balance, network) {
  const assetCode =
    balance.asset_type === 'native'
      ? NATIVE_ASSET_CODE
      : normalizeAssetCode(balance.asset_code);

  return {
    assetCode,
    assetIssuer:
      assetCode === NATIVE_ASSET_CODE ? null : balance.asset_issuer || null,
    demo: false,
    displayName: assetCode,
    homeDomain: balance.asset_issuer || null,
    iconKey: assetCode.toLowerCase(),
    isNative: assetCode === NATIVE_ASSET_CODE,
    network,
    trustLevel: 'unverified',
  };
}

function mergeKnownAndDiscoveredAssets(knownAssets, account, network) {
  const merged = new Map();

  for (const asset of knownAssets) {
    merged.set(getAssetKey(asset), asset);
  }

  for (const balance of account?.balances || []) {
    const discovered = getDiscoveredAssetFromBalance(balance, network);
    const key = getAssetKey(discovered);

    if (!merged.has(key)) {
      merged.set(key, {
        ...discovered,
        trustLevel: 'discovered',
      });
    }
  }

  return [...merged.values()];
}

function mapStellarExpertRecordToAsset(record, network) {
  const isXlm = record.asset === 'XLM';
  if (isXlm) {
    return {
      assetCode: 'XLM',
      assetIssuer: null,
      displayName: 'Lumens',
      homeDomain: 'stellar.org',
      iconKey: 'xlm',
      isNative: true,
      network: network,
      trustLevel: 'verified',
      image: 'https://stellar.org/images/lumens.svg',
    };
  }

  const toml = record.tomlInfo || {};
  let code = toml.code;
  if (!code) {
    const parts = record.asset.split('-');
    code = parts[0] || 'UNKNOWN';
  }
  code = normalizeAssetCode(code);

  let issuer = toml.issuer;
  if (!issuer) {
    const parts = record.asset.split('-');
    issuer = parts[1] || null;
  }

  const displayName = toml.name || record.orgName || code;
  const homeDomain = record.domain || toml.orgName || 'unknown';
  const image = toml.image || toml.orgLogo || null;

  return {
    assetCode: code,
    assetIssuer: issuer,
    displayName: displayName,
    homeDomain: homeDomain,
    iconKey: code.toLowerCase(),
    isNative: false,
    network: network,
    trustLevel: 'verified',
    image: image,
  };
}

module.exports = {
  DEMO_ASSET_CODES,
  getAssetKey,
  getDemoIssuer,
  getIssuerKey,
  getKnownAssetDefinitions,
  mergeKnownAndDiscoveredAssets,
  mapStellarExpertRecordToAsset,
  NATIVE_ASSET_CODE,
  normalizeAssetCode,
};
