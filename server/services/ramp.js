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
    'Chưa cấu hình provider on/off-ramp. V1 chỉ hỗ trợ deposit on-chain và withdraw qua send.',
  );
  error.status = 501;
  throw error;
}

module.exports = {
  getDisabledRampResponse,
  getRampProviders,
};

