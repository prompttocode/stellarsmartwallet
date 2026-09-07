CREATE TABLE IF NOT EXISTS account_wallets (
  account_email TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  network TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_email, wallet_id, network)
);

CREATE INDEX IF NOT EXISTS idx_account_wallets_address
  ON account_wallets(network, wallet_address, archived);

CREATE TABLE IF NOT EXISTS account_transactions (
  account_email TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  network TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  direction TEXT NOT NULL,
  operation TEXT NOT NULL,
  asset_code TEXT NOT NULL,
  asset_issuer TEXT,
  amount TEXT NOT NULL,
  from_address TEXT,
  to_address TEXT,
  ledger INTEGER,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_email, wallet_id, network, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_account_transactions_history
  ON account_transactions(account_email, wallet_id, network, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_transactions_hash
  ON account_transactions(network, transaction_hash);

INSERT OR IGNORE INTO account_wallets (
  account_email,
  wallet_id,
  wallet_address,
  network,
  archived,
  updated_at
)
SELECT
  accounts.email,
  TRIM(CAST(json_extract(wallet.value, '$.id') AS TEXT)),
  UPPER(TRIM(CAST(json_extract(wallet.value, '$.address') AS TEXT))),
  CASE LOWER(TRIM(CAST(json_extract(wallet.value, '$.network') AS TEXT)))
    WHEN 'mainnet' THEN 'mainnet'
    ELSE 'testnet'
  END,
  CASE WHEN json_extract(wallet.value, '$.archived') = 1 THEN 1 ELSE 0 END,
  COALESCE(accounts.updated_at, CURRENT_TIMESTAMP)
FROM accounts, json_each(accounts.data, '$.wallets') AS wallet
WHERE json_valid(accounts.data)
  AND json_type(accounts.data, '$.wallets') = 'array'
  AND TRIM(CAST(json_extract(wallet.value, '$.id') AS TEXT)) <> ''
  AND TRIM(CAST(json_extract(wallet.value, '$.address') AS TEXT)) <> '';

INSERT OR IGNORE INTO account_wallets (
  account_email,
  wallet_id,
  wallet_address,
  network,
  archived,
  updated_at
)
SELECT
  accounts.email,
  TRIM(CAST(json_extract(accounts.data, '$.wallet.id') AS TEXT)),
  UPPER(TRIM(CAST(json_extract(accounts.data, '$.wallet.address') AS TEXT))),
  CASE LOWER(TRIM(CAST(json_extract(accounts.data, '$.wallet.network') AS TEXT)))
    WHEN 'mainnet' THEN 'mainnet'
    ELSE 'testnet'
  END,
  CASE WHEN json_extract(accounts.data, '$.wallet.archived') = 1 THEN 1 ELSE 0 END,
  COALESCE(accounts.updated_at, CURRENT_TIMESTAMP)
FROM accounts
WHERE json_valid(accounts.data)
  AND TRIM(CAST(json_extract(accounts.data, '$.wallet.id') AS TEXT)) <> ''
  AND TRIM(CAST(json_extract(accounts.data, '$.wallet.address') AS TEXT)) <> '';
