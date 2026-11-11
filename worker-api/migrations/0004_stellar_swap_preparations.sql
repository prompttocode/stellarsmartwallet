CREATE TABLE IF NOT EXISTS stellar_swap_preparations (
  signing_hash TEXT PRIMARY KEY,
  transaction_xdr TEXT NOT NULL,
  network TEXT NOT NULL,
  source_address TEXT NOT NULL,
  source_wallet_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  from_asset_code TEXT NOT NULL,
  from_asset_issuer TEXT NOT NULL DEFAULT '',
  to_asset_code TEXT NOT NULL,
  to_asset_issuer TEXT NOT NULL DEFAULT '',
  quote_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stellar_swap_preparations_expires
  ON stellar_swap_preparations(expires_at);
