/* eslint-env node */

const fs = require('fs');
const { DB_DRIVER, DB_PATH } = require('../config');
const { closeDb, writeDb } = require('../db');

async function main() {
  if (String(DB_DRIVER).toLowerCase() !== 'mysql') {
    throw new Error('Set DB_DRIVER=mysql in server/.env before migrating.');
  }

  if (!fs.existsSync(DB_PATH)) {
    console.log('No JSON database found. Nothing to migrate.');
    return;
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

  await writeDb(db);
  console.log(
    `Migrated ${db.accounts?.length || 0} accounts, ${
      db.transactions?.length || 0
    } transactions, ${db.contacts?.length || 0} contacts, and ${
      Object.keys(db.issuers || {}).length
    } issuers to MySQL.`,
  );
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  await closeDb();
});
