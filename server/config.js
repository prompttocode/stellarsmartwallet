/* eslint-env node */
require('dotenv').config();

const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const PRIVY_API_URL = 'https://api.privy.io/v1';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const FRIENDBOT_URL = 'https://friendbot.stellar.org';
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'demo-db.json');

module.exports = {
  DATA_DIR,
  DB_PATH,
  FRIENDBOT_URL,
  HORIZON_URL,
  PORT,
  PRIVY_API_URL,
  PRIVY_APP_ID,
  PRIVY_APP_SECRET,
};
