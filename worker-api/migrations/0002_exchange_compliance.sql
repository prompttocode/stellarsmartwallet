ALTER TABLE account_kyc ADD COLUMN country_code TEXT;

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
