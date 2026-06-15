CREATE TABLE IF NOT EXISTS accounts (
  email TEXT PRIMARY KEY,
  account_id TEXT,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accounts_account_id
  ON accounts(account_id);

CREATE TABLE IF NOT EXISTS account_kyc (
  account_email TEXT PRIMARY KEY,
  provider_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  cccd_last4 TEXT,
  cccd_hash TEXT,
  dob TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_kyc_provider_user_id
  ON account_kyc(provider_user_id);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS issuers (
  asset_code TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  hash TEXT PRIMARY KEY,
  network TEXT NOT NULL,
  from_address TEXT,
  to_address TEXT,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_account
  ON transactions(network, from_address, to_address);

CREATE TABLE IF NOT EXISTS ramp_orders (
  payment_code TEXT PRIMARY KEY,
  provider_order_id TEXT,
  account_key TEXT NOT NULL,
  account_email TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  network TEXT NOT NULL,
  direction TEXT NOT NULL,
  asset_code TEXT NOT NULL,
  state INTEGER,
  processing_state INTEGER,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ramp_orders_history
  ON ramp_orders(account_email, wallet_id, network, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ramp_orders_provider_id
  ON ramp_orders(provider_order_id);
