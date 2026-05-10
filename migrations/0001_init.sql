CREATE TABLE IF NOT EXISTS swapfaces_accounts (
  id INTEGER PRIMARY KEY,
  platform TEXT,
  external_id TEXT,
  username TEXT,
  credits REAL,
  website TEXT,
  token TEXT NOT NULL,
  raw_detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_swapfaces_accounts_updated_at
  ON swapfaces_accounts (updated_at DESC);

CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES swapfaces_accounts(id)
);