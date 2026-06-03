/* eslint-env node */

const fs = require('fs');
const { DATA_DIR, DB_PATH } = require('./config');
const { getExplorerUrl, normalizeNetwork } = require('./services/networks');
const { normalizeEmail } = require('./utils/validation');

function emptyDb() {
  return {
    accounts: [],
    contacts: [],
    issuers: {},
    transactions: [],
  };
}

function readDb() {
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

function writeDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, `${JSON.stringify(db, null, 2)}\n`);
}

function saveAccount(account) {
  const db = readDb();
  const normalized = {
    ...account,
    email: normalizeEmail(account.email),
    updatedAt: new Date().toISOString(),
  };
  const existingIndex = db.accounts.findIndex(
    item => item.email === normalized.email || item.id === normalized.id,
  );

  if (existingIndex >= 0) {
    db.accounts[existingIndex] = {
      ...db.accounts[existingIndex],
      ...normalized,
    };
  } else {
    db.accounts.unshift({
      ...normalized,
      createdAt: new Date().toISOString(),
    });
  }

  writeDb(db);
  return normalized;
}

function getAccountByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return (
    readDb().accounts.find(account => account.email === normalizedEmail) || null
  );
}

function getAccountTransactions(account, network = 'testnet') {
  const normalizedNetwork = normalizeNetwork(network);

  if (!account?.wallet?.address) {
    return [];
  }

  return readDb().transactions.filter(
    transaction =>
      (transaction.network || 'testnet') === normalizedNetwork &&
      (transaction.from === account.wallet.address ||
        transaction.to === account.wallet.address),
  );
}

function saveTransaction(transaction) {
  const db = readDb();
  const network = normalizeNetwork(transaction.network);
  const item = {
    id: transaction.hash,
    createdAt: new Date().toISOString(),
    explorerUrl: getExplorerUrl(network, 'tx', transaction.hash),
    network,
    ...transaction,
  };

  db.transactions = [
    item,
    ...db.transactions.filter(existing => existing.hash !== item.hash),
  ];
  writeDb(db);
  return item;
}

function saveContact(contact) {
  const db = readDb();
  const item = {
    id: contact.wallet.id,
    label: contact.label,
    wallet: contact.wallet,
    funded: Boolean(contact.funded),
    updatedAt: new Date().toISOString(),
  };

  db.contacts = [
    item,
    ...db.contacts.filter(existing => existing.id !== item.id),
  ];
  writeDb(db);
  return item;
}

function getIssuer(assetCode) {
  return readDb().issuers?.[assetCode] || null;
}

function saveIssuer(assetCode, issuer) {
  const db = readDb();
  const item = {
    ...issuer,
    assetCode,
    updatedAt: new Date().toISOString(),
  };

  db.issuers = {
    ...(db.issuers || {}),
    [assetCode]: {
      ...(db.issuers?.[assetCode] || {}),
      ...item,
    },
  };

  writeDb(db);
  return db.issuers[assetCode];
}

module.exports = {
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
