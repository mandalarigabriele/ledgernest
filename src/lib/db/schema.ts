import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'ledgernest.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
    migrateSchema(db)
  }
  return db
}

function migrateSchema(db: Database.Database) {
  // Add columns introduced after initial schema deploy — safe to run repeatedly
  const addIfMissing = (table: string, column: string, def: string) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
    }
  }
  addIfMissing('banking_sessions', 'oauth_state', 'TEXT')
  addIfMissing('banking_sessions', 'eb_session_id', 'TEXT')
  addIfMissing('banking_transactions', 'user_deleted', 'INTEGER NOT NULL DEFAULT 0')
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      total_value REAL NOT NULL,
      total_cost REAL NOT NULL,
      unrealized_pnl REAL NOT NULL,
      pnl_pct REAL NOT NULL,
      by_type TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_date ON portfolio_snapshots(date);

    CREATE TABLE IF NOT EXISTS networth_snapshots (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      total_assets REAL NOT NULL,
      total_liabilities REAL NOT NULL,
      net_worth REAL NOT NULL,
      portfolio_value REAL NOT NULL,
      cash_value REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_nw_date ON networth_snapshots(date);

    CREATE TABLE IF NOT EXISTS price_cache (
      ticker TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS currency_cache (
      pair TEXT PRIMARY KEY,
      rate REAL NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_data (
      user_email TEXT NOT NULL,
      key TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_email, key)
    );

    CREATE TABLE IF NOT EXISTS banking_sessions (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      country TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      oauth_state TEXT,
      eb_session_id TEXT,
      valid_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS banking_accounts (
      uid TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      finance_account_id TEXT,
      iban TEXT,
      name TEXT,
      product TEXT,
      currency TEXT NOT NULL DEFAULT 'EUR',
      balance REAL,
      last_synced_at TEXT,
      FOREIGN KEY (session_id) REFERENCES banking_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS banking_transactions (
      id TEXT PRIMARY KEY,
      account_uid TEXT NOT NULL,
      user_email TEXT NOT NULL,
      finance_transaction_id TEXT,
      booking_date TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      description TEXT,
      creditor_name TEXT,
      debtor_name TEXT,
      status TEXT NOT NULL DEFAULT 'booked',
      raw TEXT,
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (account_uid) REFERENCES banking_accounts(uid) ON DELETE CASCADE
    );
  `)
}
