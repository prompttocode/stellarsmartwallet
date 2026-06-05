/* eslint-env node */

function getRampProviders() {
  return [
    {
      configured: false,
      id: 'onchain-deposit',
      name: 'On-chain deposit',
      supports: ['deposit', 'withdraw'],
      type: 'deposit',
    },
    {
      configured: false,
      id: 'fiat-adapter',
      name: 'Fiat on/off-ramp adapter',
      supports: ['buy', 'sell'],
      type: 'fiat',
    },
  ];
}

function getDisabledRampResponse() {
  const error = new Error(
    'On/off-ramp provider is not configured. V1 only supports on-chain deposits and withdrawals through send.',
  );
  error.status = 501;
  throw error;
}

module.exports = {
  getDisabledRampResponse,
  getRampProviders,
};
