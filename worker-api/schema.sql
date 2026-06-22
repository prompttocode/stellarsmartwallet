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

CREATE TABLE IF NOT EXISTS account_payment_methods (
  id TEXT PRIMARY KEY,
  account_email TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  account_type INTEGER NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_payment_methods_unique_bank
  ON account_payment_methods(account_email, bank_id, account_number);

CREATE INDEX IF NOT EXISTS idx_account_payment_methods_account_default
  ON account_payment_methods(account_email, is_default, updated_at DESC);

CREATE TABLE IF NOT EXISTS account_favorite_assets (
  id TEXT PRIMARY KEY,
  account_email TEXT NOT NULL,
  network TEXT NOT NULL,
  asset_code TEXT NOT NULL,
  asset_issuer TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL,
  home_domain TEXT,
  image TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_favorite_assets_unique_asset
  ON account_favorite_assets(account_email, network, asset_code, asset_issuer);

CREATE INDEX IF NOT EXISTS idx_account_favorite_assets_account_network
  ON account_favorite_assets(account_email, network, updated_at DESC);
