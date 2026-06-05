/* eslint-env node */

const { Networks } = require('@stellar/stellar-sdk');
const {
  FRIENDBOT_URL,
  HORIZON_MAINNET_URL,
  HORIZON_TESTNET_URL,
} = require('../config');

const STELLAR_NETWORKS = {
  mainnet: {
    explorerSlug: 'public',
    friendbotUrl: null,
    horizonUrl: HORIZON_MAINNET_URL,
    label: 'Stellar Mainnet',
    network: 'mainnet',
    passphrase: Networks.PUBLIC,
    supportsFriendbot: false,
  },
  testnet: {
    explorerSlug: 'testnet',
    friendbotUrl: FRIENDBOT_URL,
    horizonUrl: HORIZON_TESTNET_URL,
    label: 'Stellar Testnet',
    network: 'testnet',
    passphrase: Networks.TESTNET,
    supportsFriendbot: true,
  },
};

function normalizeNetwork(value, fallback = 'testnet') {
  const network = String(value || fallback).trim().toLowerCase();

  if (network === 'public' || network === 'pubnet') {
    return 'mainnet';
  }

  return STELLAR_NETWORKS[network] ? network : fallback;
}

function assertNetwork(value) {
  const network = normalizeNetwork(value, '');

  if (!network || !STELLAR_NETWORKS[network]) {
    const error = new Error('Invalid Stellar network');
    error.status = 400;
    throw error;
  }

  return network;
}

function getNetworkConfig(value = 'testnet') {
  return STELLAR_NETWORKS[assertNetwork(value)];
}

function getExplorerUrl(network, type, id) {
  const config = getNetworkConfig(network);
  const safeType = type === 'account' ? 'account' : 'tx';

  return `https://stellar.expert/explorer/${config.explorerSlug}/${safeType}/${id}`;
}

function listNetworks() {
  return Object.values(STELLAR_NETWORKS).map(config => ({
    horizonUrl: config.horizonUrl,
    label: config.label,
    network: config.network,
    supportsFriendbot: config.supportsFriendbot,
  }));
}

module.exports = {
  assertNetwork,
  getExplorerUrl,
  getNetworkConfig,
  listNetworks,
  normalizeNetwork,
  STELLAR_NETWORKS,
};
