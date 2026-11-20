#!/usr/bin/env node
// Restores accounts and movements that exist in a database backup but are missing now,
// without touching anything else. Runs inside the app container:
//
//   docker compose exec ledgernest node scripts/restore-accounts.js --from /data/restore-src.db
//   docker compose exec ledgernest node scripts/restore-accounts.js --from /data/restore-src.db --apply
//
// Options:
//   --from <file>      backup database (an unzipped deploy backup copied into /data)
//   --user <email>     only this user (default: every user found in the backup)
//   --account <id>     only movements of this account id (repeatable; default: all)
//   --apply            write the changes (without it, only a preview is printed)
//
// A movement is restored when neither its id nor its bank id (ebId) exists now and the user did
// not delete it from a bank sync. Each restored movement goes back to its original account,
// which is recreated when it was deleted. The current data is saved to
// /data/user_data-finance-<user>-<timestamp>.json before writing.
// Close every LedgerNest tab before --apply: an open tab could overwrite the result.

const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const optAll = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []))
const from = opt('--from')
const onlyUser = opt('--user')
const onlyAccounts = new Set(optAll('--account'))
const apply = args.includes('--apply')
const dataDir = process.env.DATA_DIR || '/data'

if (!from) { console.error('Usage: node scripts/restore-accounts.js --from <backup.db> [--user email] [--account id] [--apply]'); process.exit(1) }

const backup = new Database(from, { readonly: true, fileMustExist: true })
const current = new Database(path.join(dataDir, 'ledgernest.db'), { fileMustExist: true })

const readFinance = (db, email) => {
  const row = db.prepare(`SELECT data, updated_at FROM user_data WHERE user_email = ? AND key = 'finance'`).get(email)
  return row ? { data: JSON.parse(row.data), updatedAt: row.updated_at } : null
}

const users = backup.prepare(`SELECT user_email, updated_at FROM user_data WHERE key = 'finance'`).all()
  .filter((u) => !onlyUser || u.user_email === onlyUser)
if (users.length === 0) { console.log('No finance data in the backup for the selected user.'); process.exit(0) }

for (const { user_email: email } of users) {
  const old = readFinance(backup, email)
  const now = readFinance(current, email)
  if (!now) { console.log(`\n${email}: no current data, skipped`); continue }

  const deletedEbIds = new Set(current.prepare(
    `SELECT id FROM banking_transactions WHERE user_email = ? AND user_deleted = 1`).all(email).map((r) => r.id))
  const nowTxIds = new Set((now.data.transactions || []).map((t) => t.id))
  const nowEbIds = new Set((now.data.transactions || []).filter((t) => t.ebId).map((t) => t.ebId))
  const nowAccounts = new Map((now.data.accounts || []).map((a) => [a.id, a]))
  const oldAccounts = new Map((old.data.accounts || []).map((a) => [a.id, a]))

  const missingTxs = (old.data.transactions || []).filter((t) =>
    !nowTxIds.has(t.id) && !(t.ebId && (nowEbIds.has(t.ebId) || deletedEbIds.has(t.ebId))) &&
    (onlyAccounts.size === 0 || onlyAccounts.has(t.accountId)))

  // Accounts to recreate: deleted since the backup and owning restorable movements (or asked for)
  const accountsToAdd = [...oldAccounts.values()].filter((a) => !nowAccounts.has(a.id) &&
    (missingTxs.some((t) => t.accountId === a.id) || onlyAccounts.has(a.id)))
  const restorable = missingTxs.filter((t) => nowAccounts.has(t.accountId) || accountsToAdd.some((a) => a.id === t.accountId))

  console.log(`\n${email}`)
  console.log(`  backup saved ${old.updatedAt} · current data ${now.updatedAt}`)
  console.log(`  accounts now: ${[...nowAccounts.values()].map((a) => `${a.name} [${a.id}]`).join(', ') || '-'}`)
  console.log(`  accounts in backup but deleted since: ${[...oldAccounts.values()].filter((a) => !nowAccounts.has(a.id)).map((a) => `${a.name} [${a.id}]`).join(', ') || 'none'}`)
  const byAccount = new Map()
  for (const t of restorable) byAccount.set(t.accountId, (byAccount.get(t.accountId) || 0) + 1)
  if (restorable.length === 0) { console.log('  nothing to restore'); continue }
  console.log('  would restore:')
  for (const a of accountsToAdd) console.log(`    + account "${a.name}" [${a.id}]`)
  for (const [id, n] of byAccount) {
    const a = nowAccounts.get(id) || oldAccounts.get(id)
    const dates = restorable.filter((t) => t.accountId === id).map((t) => t.date).sort()
    console.log(`    + ${n} movements → "${a ? a.name : id}" (${dates[0]} … ${dates[dates.length - 1]})`)
  }

  const recurring = (old.data.recurringItems || []).filter((r) =>
    accountsToAdd.some((a) => a.id === r.accountId) && !(now.data.recurringItems || []).some((x) => x.id === r.id))
  if (recurring.length) console.log(`    + ${recurring.length} recurring items`)

  if (!apply) { console.log('  (preview only — add --apply to write)'); continue }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const savedTo = path.join(dataDir, `user_data-finance-${email.replace(/[^a-z0-9]+/gi, '_')}-${stamp}.json`)
  fs.writeFileSync(savedTo, JSON.stringify(now.data))

  const next = {
    ...now.data,
    accounts: [...(now.data.accounts || []), ...accountsToAdd],
    transactions: [...restorable, ...(now.data.transactions || [])],
    recurringItems: [...(now.data.recurringItems || []), ...recurring],
  }

  current.transaction(() => {
    current.prepare(`UPDATE user_data SET data = ?, updated_at = datetime('now') WHERE user_email = ? AND key = 'finance'`)
      .run(JSON.stringify(next), email)
    // A recreated account may be the one the live bank link should point to: relink live rows whose
    // local account no longer exists, following the row they replaced.
    const accountIds = new Set(next.accounts.map((a) => a.id))
    const rows = current.prepare(`SELECT uid, finance_account_id, superseded_by FROM banking_accounts WHERE user_email = ?`).all(email)
    for (const live of rows.filter((r) => !r.superseded_by && r.finance_account_id && !accountIds.has(r.finance_account_id))) {
      const prev = rows.find((r) => r.superseded_by === live.uid && accountIds.has(r.finance_account_id))
      if (prev) {
        current.prepare(`UPDATE banking_accounts SET finance_account_id = ? WHERE uid = ?`).run(prev.finance_account_id, live.uid)
        console.log(`  bank link ${live.uid} → account ${prev.finance_account_id}`)
      }
    }
  })()
  console.log(`  restored. Previous data saved to ${savedTo}`)
}
