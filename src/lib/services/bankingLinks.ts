import type Database from 'better-sqlite3'

export interface SessionAccountInput {
  uid: string
  iban: string | null
  name: string | null
  product: string | null
  currency: string
  balance: number
}

interface LinkRow {
  uid: string
  session_id: string
  finance_account_id: string | null
  iban: string | null
  name: string | null
  currency: string
  superseded_by: string | null
  bank_name: string
  session_order: number
}

/**
 * Stores the accounts of a freshly authorised session. An account seen before keeps its link to
 * the local account (a plain INSERT OR REPLACE would wipe it); an account that comes back under a
 * new uid (new session, or a new Enable Banking application) takes over its predecessor's link.
 */
export function storeSessionAccounts(db: Database.Database, sessionId: string, email: string, accounts: SessionAccountInput[]): void {
  const update = db.prepare(`
    UPDATE banking_accounts
       SET session_id = ?, user_email = ?, iban = ?, name = ?, product = ?, currency = ?, balance = ?,
           last_synced_at = datetime('now'), superseded_by = NULL
     WHERE uid = ?`)
  const insert = db.prepare(`
    INSERT INTO banking_accounts (uid, session_id, user_email, iban, name, product, currency, balance, last_synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)

  db.transaction(() => {
    for (const a of accounts) {
      const changed = update.run(sessionId, email, a.iban, a.name, a.product, a.currency, a.balance, a.uid).changes
      if (!changed) insert.run(a.uid, sessionId, email, a.iban, a.name, a.product, a.currency, a.balance)
    }
    reconcileBankingAccounts(db, email)
  })()
}

/** Same bank account across sessions: by IBAN, or by bank + name + currency when the bank gives no IBAN. */
function accountKey(r: LinkRow): string {
  const iban = r.iban?.replace(/\s+/g, '').toUpperCase()
  return iban ? `iban:${iban}` : `name:${r.bank_name.toLowerCase()}|${(r.name ?? '').toLowerCase()}|${r.currency}`
}

/**
 * When the same bank account is present under several sessions, the row of the newest session is
 * the live one. Each older row is marked superseded_by the live uid and hands over its dedup
 * history (so a sync does not reimport everything) and its local-account link when the live row
 * has none. A session left with only superseded rows is marked 'replaced', so nothing calls the
 * bank with it any more. Idempotent: safe to run on every read.
 */
export function reconcileBankingAccounts(db: Database.Database, email: string): void {
  const rows = db.prepare(`
    SELECT a.uid, a.session_id, a.finance_account_id, a.iban, a.name, a.currency, a.superseded_by,
           s.bank_name, s.rowid AS session_order
      FROM banking_accounts a JOIN banking_sessions s ON s.id = a.session_id
     WHERE a.user_email = ?`).all(email) as LinkRow[]

  const groups = new Map<string, LinkRow[]>()
  for (const r of rows) {
    const k = accountKey(r)
    groups.set(k, [...(groups.get(k) ?? []), r])
  }

  const setLink = db.prepare(`UPDATE banking_accounts SET finance_account_id = ? WHERE uid = ?`)
  const moveDedup = db.prepare(`UPDATE banking_transactions SET account_uid = ? WHERE account_uid = ?`)
  const supersede = db.prepare(`UPDATE banking_accounts SET superseded_by = ? WHERE uid = ?`)

  db.transaction(() => {
    for (const group of Array.from(groups.values())) {
      if (group.length < 2) continue
      const live = group.reduce((a, b) => (b.session_order > a.session_order ? b : a))
      for (const old of group) {
        if (old.uid === live.uid || old.session_order === live.session_order) continue
        if (!live.finance_account_id && old.finance_account_id) {
          setLink.run(old.finance_account_id, live.uid)
          live.finance_account_id = old.finance_account_id
        }
        moveDedup.run(live.uid, old.uid)
        if (old.superseded_by !== live.uid) supersede.run(live.uid, old.uid)
      }
    }
    db.prepare(`
      UPDATE banking_sessions SET status = 'replaced', updated_at = datetime('now')
       WHERE user_email = ? AND status = 'active'
         AND id IN (SELECT session_id FROM banking_accounts WHERE user_email = ?
                     GROUP BY session_id HAVING SUM(superseded_by IS NULL) = 0)`).run(email, email)
  })()
}
