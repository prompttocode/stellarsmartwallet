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
  cccd_number TEXT,
  cccd_last4 TEXT,
  cccd_hash TEXT,
  country_code TEXT,
  dob TEXT,
  provider_email TEXT,
  address TEXT,
  home TEXT,
  sex TEXT,
  nationality TEXT,
  kyc_image_front TEXT,
  kyc_image_back TEXT,
  provider_data TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_kyc_provider_user_id
  ON account_kyc(provider_user_id);

CREATE TABLE IF NOT EXISTS account_exchange_profiles (
  account_email TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  country_code TEXT NOT NULL,
  kyc_status TEXT NOT NULL,
  sanctions_status TEXT NOT NULL,
  reason_code TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_exchange_profiles_provider_country
  ON account_exchange_profiles(provider_id, country_code, updated_at);

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

CREATE TABLE IF NOT EXISTS account_feedback (
  id TEXT PRIMARY KEY,
  account_email TEXT NOT NULL,
  wallet_id TEXT,
  wallet_address TEXT,
  network TEXT NOT NULL,
  rating INTEGER,
  category TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  app_version TEXT,
  source TEXT NOT NULL DEFAULT 'settings',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_feedback_account_created
  ON account_feedback(account_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_feedback_created
  ON account_feedback(created_at DESC);
