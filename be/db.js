/* eslint-env node */

const fs = require('fs');
const mysql = require('mysql2/promise');
const {
  DATA_DIR,
  DB_DRIVER,
  DB_PATH,
  MYSQL_DATABASE,
  MYSQL_HOST,
  MYSQL_PASSWORD,
  MYSQL_PORT,
  MYSQL_USER,
} = require('./config');
const { getExplorerUrl, normalizeNetwork } = require('./services/networks');
const { normalizeEmail } = require('./utils/validation');

let mysqlPool = null;
let mysqlSchemaReady = null;

function emptyDb() {
  return {
    accounts: [],
    contacts: [],
    issuers: {},
    transactions: [],
  };
}

function usesMysql() {
  return String(DB_DRIVER || '').toLowerCase() === 'mysql';
}

function escapeIdentifier(value) {
  return `\`${String(value || '').replace(/`/g, '``')}\``;
}

function serialize(value) {
  return JSON.stringify(value || null);
}

function parseJson(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function getMysqlPool() {
  if (mysqlPool) {
    return mysqlPool;
  }

  const admin = await mysql.createConnection({
    host: MYSQL_HOST,
    password: MYSQL_PASSWORD,
    port: MYSQL_PORT,
    user: MYSQL_USER,
  });

  await admin.query(
    `CREATE DATABASE IF NOT EXISTS ${escapeIdentifier(
      MYSQL_DATABASE,
    )} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await admin.end();

  mysqlPool = mysql.createPool({
    connectionLimit: 10,
    database: MYSQL_DATABASE,
    host: MYSQL_HOST,
    password: MYSQL_PASSWORD,
    port: MYSQL_PORT,
    user: MYSQL_USER,
  });

  return mysqlPool;
}

async function ensureMysqlSchema() {
  if (!usesMysql()) {
    return;
  }

  if (!mysqlSchemaReady) {
    mysqlSchemaReady = (async () => {
      const pool = await getMysqlPool();

      await pool.query(`
        CREATE TABLE IF NOT EXISTS accounts (
          email VARCHAR(191) NOT NULL PRIMARY KEY,
          account_id VARCHAR(191) NULL,
          data LONGTEXT NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_accounts_account_id (account_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          hash VARCHAR(191) NOT NULL PRIMARY KEY,
          network VARCHAR(16) NOT NULL,
          from_address VARCHAR(64) NULL,
          to_address VARCHAR(64) NULL,
          data LONGTEXT NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_transactions_account (network, from_address, to_address)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS contacts (
          id VARCHAR(191) NOT NULL PRIMARY KEY,
          data LONGTEXT NOT NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS issuers (
          asset_code VARCHAR(191) NOT NULL PRIMARY KEY,
          data LONGTEXT NOT NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })();
  }

  await mysqlSchemaReady;
}

function readJsonDb() {
  if (!fs.existsSync(DB_PATH)) {
    return emptyDb();
  }

  try {
    return {
      ...emptyDb(),
      ...JSON.parse(fs.readFileSync(DB_PATH, 'utf8')),
    };
  } catch {
    return emptyDb();
  }
}

function writeJsonDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, `${JSON.stringify(db, null, 2)}\n`);
}

async function readMysqlDb() {
  await ensureMysqlSchema();
  const pool = await getMysqlPool();
  const [accountRows] = await pool.query(
    'SELECT data FROM accounts ORDER BY updated_at DESC',
  );
  const [contactRows] = await pool.query(
    'SELECT data FROM contacts ORDER BY updated_at DESC',
  );
  const [issuerRows] = await pool.query('SELECT asset_code, data FROM issuers');
  const [transactionRows] = await pool.query(
    'SELECT data FROM transactions ORDER BY created_at DESC',
  );
  const db = emptyDb();

  db.accounts = accountRows
    .map(row => parseJson(row.data))
    .filter(Boolean);
  db.contacts = contactRows
    .map(row => parseJson(row.data))
    .filter(Boolean);
  db.transactions = transactionRows
    .map(row => parseJson(row.data))
    .filter(Boolean);

  for (const row of issuerRows) {
    const issuer = parseJson(row.data);

    if (issuer) {
      db.issuers[row.asset_code] = issuer;
    }
  }

  return db;
}

async function readDb() {
  if (usesMysql()) {
    return readMysqlDb();
  }

  return readJsonDb();
}

async function writeMysqlDb(db) {
  await ensureMysqlSchema();
  const pool = await getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM transactions');
    await connection.query('DELETE FROM contacts');
    await connection.query('DELETE FROM issuers');
    await connection.query('DELETE FROM accounts');

    for (const account of db.accounts || []) {
      const email = normalizeEmail(account.email);

      if (email) {
        await connection.execute(
          'INSERT INTO accounts (email, account_id, data) VALUES (?, ?, ?)',
          [email, account.id || null, serialize({ ...account, email })],
        );
      }
    }

    for (const transaction of db.transactions || []) {
      const network = normalizeNetwork(transaction.network);

      await connection.execute(
        'INSERT INTO transactions (hash, network, from_address, to_address, data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          transaction.hash,
          network,
          transaction.from || null,
          transaction.to || null,
          serialize({ ...transaction, network }),
          transaction.createdAt
            ? new Date(transaction.createdAt)
            : new Date(),
        ],
      );
    }

    for (const contact of db.contacts || []) {
      await connection.execute(
        'INSERT INTO contacts (id, data) VALUES (?, ?)',
        [contact.id, serialize(contact)],
      );
    }

    for (const [assetCode, issuer] of Object.entries(db.issuers || {})) {
      await connection.execute(
        'INSERT INTO issuers (asset_code, data) VALUES (?, ?)',
        [assetCode, serialize(issuer)],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function writeDb(db) {
  if (usesMysql()) {
    await writeMysqlDb({
      ...emptyDb(),
      ...db,
    });
    return;
  }

  writeJsonDb({
    ...emptyDb(),
    ...db,
  });
}

async function saveAccount(account) {
  const now = new Date().toISOString();
  const normalized = {
    ...account,
    email: normalizeEmail(account.email),
    updatedAt: now,
  };

  if (usesMysql()) {
    await ensureMysqlSchema();
    const pool = await getMysqlPool();
    const [rows] = await pool.execute(
      'SELECT data FROM accounts WHERE email = ? OR account_id = ? LIMIT 1',
      [normalized.email, normalized.id || ''],
    );
    const existing = parseJson(rows[0]?.data);
    const item = existing
      ? {
          ...existing,
          ...normalized,
          createdAt: existing.createdAt || now,
        }
      : {
          ...normalized,
          createdAt: now,
        };

    await pool.execute(
      `INSERT INTO accounts (email, account_id, data)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         account_id = VALUES(account_id),
         data = VALUES(data),
         updated_at = CURRENT_TIMESTAMP`,
      [item.email, item.id || null, serialize(item)],
    );

    return item;
  }

  const db = readJsonDb();
  const existingIndex = db.accounts.findIndex(
    item => item.email === normalized.email || item.id === normalized.id,
  );
  const item =
    existingIndex >= 0
      ? {
          ...db.accounts[existingIndex],
          ...normalized,
        }
      : {
          ...normalized,
          createdAt: now,
        };

  if (existingIndex >= 0) {
    db.accounts[existingIndex] = item;
  } else {
    db.accounts.unshift(item);
  }

  writeJsonDb(db);
  return item;
}

async function getAccountByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (usesMysql()) {
    await ensureMysqlSchema();
    const pool = await getMysqlPool();
    const [rows] = await pool.execute(
      'SELECT data FROM accounts WHERE email = ? LIMIT 1',
      [normalizedEmail],
    );

    return parseJson(rows[0]?.data);
  }

  return readJsonDb().accounts.find(
    account => account.email === normalizedEmail,
  ) || null;
}

async function getAccountTransactions(account, network = 'testnet') {
  const normalizedNetwork = normalizeNetwork(network);

  if (!account?.wallet?.address) {
    return [];
  }

  if (usesMysql()) {
    await ensureMysqlSchema();
    const pool = await getMysqlPool();
    const [rows] = await pool.execute(
      `SELECT data FROM transactions
       WHERE network = ? AND (from_address = ? OR to_address = ?)
       ORDER BY created_at DESC`,
      [
        normalizedNetwork,
        account.wallet.address,
        account.wallet.address,
      ],
    );

    return rows.map(row => parseJson(row.data)).filter(Boolean);
  }

  return readJsonDb().transactions.filter(
    transaction =>
      (transaction.network || 'testnet') === normalizedNetwork &&
      (transaction.from === account.wallet.address ||
        transaction.to === account.wallet.address),
  );
}

async function saveTransaction(transaction) {
  const network = normalizeNetwork(transaction.network);
  const item = {
    id: transaction.hash,
    createdAt: new Date().toISOString(),
    explorerUrl: getExplorerUrl(network, 'tx', transaction.hash),
    network,
    ...transaction,
  };

  if (usesMysql()) {
    await ensureMysqlSchema();
    const pool = await getMysqlPool();

    await pool.execute(
      `INSERT INTO transactions (hash, network, from_address, to_address, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         network = VALUES(network),
         from_address = VALUES(from_address),
         to_address = VALUES(to_address),
         data = VALUES(data),
         created_at = VALUES(created_at)`,
      [
        item.hash,
        network,
        item.from || null,
        item.to || null,
        serialize(item),
        new Date(item.createdAt),
      ],
    );

    return item;
  }

  const db = readJsonDb();

  db.transactions = [
    item,
    ...db.transactions.filter(existing => existing.hash !== item.hash),
  ];
  writeJsonDb(db);
  return item;
}

async function saveContact(contact) {
  const item = {
    id: contact.wallet.id,
    label: contact.label,
    wallet: contact.wallet,
    funded: Boolean(contact.funded),
    updatedAt: new Date().toISOString(),
  };

  if (usesMysql()) {
    await ensureMysqlSchema();
    const pool = await getMysqlPool();

    await pool.execute(
      `INSERT INTO contacts (id, data)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE
         data = VALUES(data),
         updated_at = CURRENT_TIMESTAMP`,
      [item.id, serialize(item)],
    );

    return item;
  }

  const db = readJsonDb();

  db.contacts = [
    item,
    ...db.contacts.filter(existing => existing.id !== item.id),
  ];
  writeJsonDb(db);
  return item;
}

async function getIssuer(assetCode) {
  if (usesMysql()) {
    await ensureMysqlSchema();
    const pool = await getMysqlPool();
    const [rows] = await pool.execute(
      'SELECT data FROM issuers WHERE asset_code = ? LIMIT 1',
      [assetCode],
    );

    return parseJson(rows[0]?.data);
  }

  return readJsonDb().issuers?.[assetCode] || null;
}

async function saveIssuer(assetCode, issuer) {
  const item = {
    ...issuer,
    assetCode,
    updatedAt: new Date().toISOString(),
  };

  if (usesMysql()) {
    await ensureMysqlSchema();
    const pool = await getMysqlPool();

    await pool.execute(
      `INSERT INTO issuers (asset_code, data)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE
         data = VALUES(data),
         updated_at = CURRENT_TIMESTAMP`,
      [assetCode, serialize(item)],
    );

    return item;
  }

  const db = readJsonDb();

  db.issuers = {
    ...(db.issuers || {}),
    [assetCode]: {
      ...(db.issuers?.[assetCode] || {}),
      ...item,
    },
  };

  writeJsonDb(db);
  return db.issuers[assetCode];
}

async function closeDb() {
  if (mysqlPool) {
    await mysqlPool.end();
    mysqlPool = null;
    mysqlSchemaReady = null;
  }
}

module.exports = {
  closeDb,
  getAccountByEmail,
  getAccountTransactions,
  getIssuer,
  readDb,
  saveAccount,
  saveContact,
  saveIssuer,
  saveTransaction,
  writeDb,
};
