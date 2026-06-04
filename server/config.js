const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const PORT = Number(process.env.PORT || 8787);
const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const PRIVY_API_URL = 'https://api.privy.io/v1';
const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
const HORIZON_TESTNET_URL =
  process.env.HORIZON_TESTNET_URL || 'https://horizon-testnet.stellar.org';
const HORIZON_MAINNET_URL =
  process.env.HORIZON_MAINNET_URL || 'https://horizon.stellar.org';
const FRIENDBOT_URL =
  process.env.FRIENDBOT_URL || 'https://friendbot.stellar.org';
const WALLETCONNECT_PROJECT_ID = process.env.WALLETCONNECT_PROJECT_ID || '';
const DB_DRIVER = process.env.DB_DRIVER || 'json';
const MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1';
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'stellar';
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'demo-db.json');

module.exports = {
  DATA_DIR,
  DB_PATH,
  DB_DRIVER,
  FRIENDBOT_URL,
  HORIZON_MAINNET_URL,
  HORIZON_TESTNET_URL,
  HORIZON_URL,
  MYSQL_DATABASE,
  MYSQL_HOST,
  MYSQL_PASSWORD,
  MYSQL_PORT,
  MYSQL_USER,
  PORT,
  PRIVY_API_URL,
  PRIVY_APP_ID,
  PRIVY_APP_SECRET,
  WALLETCONNECT_PROJECT_ID,
};
