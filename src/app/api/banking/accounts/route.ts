import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db/schema'
import { getBalances, getClosingBalance } from '@/lib/services/enableBanking'

interface BankingSessionRow {
  id: string
  bank_name: string
  country: string
  status: string
  eb_session_id: string | null
  valid_until: string | null
}

interface BankingAccountRow {
  uid: string
  session_id: string
  finance_account_id: string | null
  iban: string | null
  name: string | null
  product: string | null
  currency: string
  balance: number | null
  last_synced_at: string | null
}

// GET — list active sessions + linked accounts
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const sessions = db.prepare(
    `SELECT id, bank_name, country, status, eb_session_id, valid_until
     FROM banking_sessions WHERE user_email = ? ORDER BY rowid DESC`
  ).all(session.user.email) as BankingSessionRow[]

  const accounts = db.prepare(
    `SELECT uid, session_id, finance_account_id, iban, name, product, currency, balance, last_synced_at
     FROM banking_accounts WHERE user_email = ?`
  ).all(session.user.email) as BankingAccountRow[]

  return NextResponse.json({ sessions, accounts })
}

// POST — refresh balances for all accounts in a session
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await req.json() as { sessionId: string }
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

  const db = getDb()
  const row = db.prepare(
    `SELECT id FROM banking_sessions WHERE id = ? AND user_email = ? AND status = 'active'`
  ).get(sessionId, session.user.email)

  if (!row) return NextResponse.json({ error: 'Session not found or not active' }, { status: 404 })

  const accounts = db.prepare(
    `SELECT uid FROM banking_accounts WHERE session_id = ?`
  ).all(sessionId) as { uid: string }[]

  for (const acct of accounts) {
    try {
      const balances = await getBalances(acct.uid)
      const balance  = getClosingBalance(balances)
      db.prepare(
        `UPDATE banking_accounts SET balance = ?, last_synced_at = datetime('now') WHERE uid = ?`
      ).run(balance, acct.uid)
    } catch { /* skip individual failures */ }
  }

  const updated = db.prepare(
    `SELECT uid, session_id, finance_account_id, iban, name, product, currency, balance, last_synced_at
     FROM banking_accounts WHERE session_id = ?`
  ).all(sessionId) as BankingAccountRow[]

  return NextResponse.json({ accounts: updated })
}

// PATCH — link a banking account to a local finance account
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { uid, financeAccountId } = await req.json() as { uid: string; financeAccountId: string | null }
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 })

  const db = getDb()
  db.prepare(
    `UPDATE banking_accounts SET finance_account_id = ? WHERE uid = ? AND user_email = ?`
  ).run(financeAccountId ?? null, uid, session.user.email)

  return NextResponse.json({ ok: true })
}
