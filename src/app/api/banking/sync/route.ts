import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db/schema'
import {
  getTransactions, getBalances, getClosingBalance,
  resolveTransactionAmount, resolveTransactionDate, resolveTransactionId,
  resolveCreditor, resolveDebtor,
  type EBTransaction,
} from '@/lib/services/enableBanking'
import { cleanMerchant, guessCategory } from '@/lib/utils/csvImport'
import type { Transaction } from '@/types'
import crypto from 'crypto'

interface BankingAccountRow {
  uid: string
  session_id: string
  finance_account_id: string | null
  currency: string
}

function mapTransaction(
  eb: EBTransaction,
  financeAccountId: string,
): Omit<Transaction, 'id' | 'createdAt'> & { eb_id: string } {
  const amount = resolveTransactionAmount(eb)

  // Raw counterparty name — creditor for expenses, debtor for income
  const rawCounterparty = amount < 0 ? resolveCreditor(eb) : resolveDebtor(eb)

  // Remittance info as fallback description
  const remittance = eb.remittance_information?.join(' ').trim() || ''

  // Clean the best available raw string using the same rules as CSV import
  const rawForClean = rawCounterparty || remittance
  const merchant = rawForClean ? cleanMerchant(rawForClean) : undefined

  // Description: prefer cleaned merchant, fall back to remittance, then generic
  const description = merchant || remittance || rawCounterparty || 'Transazione'

  // Category + type from keyword rules (same as CSV import)
  const { cat, type: guessedType } = guessCategory(description)
  const type: 'income' | 'expense' | 'transfer' =
    guessedType === 'transfer' ? 'transfer' : amount < 0 ? 'expense' : 'income'

  const eb_id = resolveTransactionId(eb) || `eb-${resolveTransactionDate(eb)}-${amount}`

  return {
    eb_id,
    ebId: eb_id,
    date: resolveTransactionDate(eb),
    description,
    merchant,
    amount: Math.abs(amount),
    type,
    category: cat,
    accountId: financeAccountId,
  }
}

// POST /api/banking/sync
// Body: { accountUid, financeAccountId?, dateFrom?, dateTo?, mode?: 'delta' | 'force' | 'hard-reset' }
//   delta      — only new transactions, skip user-deleted (default)
//   force      — clear dedup for non-deleted rows, reimport all except user-deleted
//   hard-reset — clear entire dedup including user-deleted, reimport everything
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    accountUid: string
    dateFrom?: string
    dateTo?: string
    mode?: 'delta' | 'force' | 'hard-reset'
    financeAccountId?: string
  }
  const { accountUid, mode = 'delta' } = body
  if (!accountUid) return NextResponse.json({ error: 'Missing accountUid' }, { status: 400 })

  const dateTo   = body.dateTo   ?? new Date().toISOString().slice(0, 10)
  const dateFrom = body.dateFrom ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const db = getDb()
  const acctRow = db.prepare(
    `SELECT uid, session_id, finance_account_id, currency FROM banking_accounts WHERE uid = ? AND user_email = ?`
  ).get(accountUid, session.user.email) as BankingAccountRow | undefined

  if (!acctRow) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  // Allow caller to override finance_account_id (e.g. after re-link)
  const financeAccountId = body.financeAccountId ?? acctRow.finance_account_id
  if (!financeAccountId) return NextResponse.json({ error: 'Account not linked to a local account' }, { status: 400 })

  // Persist the link if caller supplied an override
  if (body.financeAccountId && body.financeAccountId !== acctRow.finance_account_id) {
    db.prepare(`UPDATE banking_accounts SET finance_account_id = ? WHERE uid = ?`).run(body.financeAccountId, accountUid)
  }

  const sessionRow = db.prepare(
    `SELECT id FROM banking_sessions WHERE id = ? AND status = 'active'`
  ).get(acctRow.session_id) as { id: string } | undefined

  if (!sessionRow) return NextResponse.json({ error: 'Banking session not active' }, { status: 400 })

  try {
    // Update balance
    const balances   = await getBalances(accountUid)
    const newBalance = getClosingBalance(balances)
    db.prepare(`UPDATE banking_accounts SET balance = ?, last_synced_at = datetime('now') WHERE uid = ?`).run(newBalance, accountUid)

    // Clear dedup table according to mode
    if (mode === 'hard-reset') {
      // Wipe everything — user-deleted entries are also reset
      db.prepare(`DELETE FROM banking_transactions WHERE account_uid = ? AND user_email = ?`).run(accountUid, session.user.email)
    } else if (mode === 'force') {
      // Wipe only non-deleted entries so user-deleted ones are still skipped
      db.prepare(`DELETE FROM banking_transactions WHERE account_uid = ? AND user_email = ? AND user_deleted = 0`).run(accountUid, session.user.email)
    }
    // delta: no clearing — dedup table is authoritative

    // Fetch & import transactions
    const ebTxs = await getTransactions(accountUid, dateFrom, dateTo)
    const newTransactions: (Omit<Transaction, 'createdAt'> & { eb_id: string })[] = []

    for (const eb of ebTxs) {
      const mapped = mapTransaction(eb, financeAccountId)

      const existing = db.prepare(
        `SELECT id, user_deleted FROM banking_transactions WHERE id = ? AND account_uid = ? AND user_email = ?`
      ).get(mapped.eb_id, accountUid, session.user.email) as { id: string; user_deleted: number } | undefined

      // Skip if already in dedup (includes user-deleted entries in delta/force modes)
      if (existing) continue

      const txId = crypto.randomUUID()
      db.prepare(`
        INSERT OR IGNORE INTO banking_transactions
          (id, account_uid, user_email, booking_date, amount, currency, description, creditor_name, debtor_name, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'booked')
      `).run(
        mapped.eb_id, accountUid, session.user.email,
        mapped.date, mapped.amount, acctRow.currency,
        mapped.description, resolveCreditor(eb) ?? null, resolveDebtor(eb) ?? null,
      )

      newTransactions.push({ ...mapped, id: txId })
    }

    return NextResponse.json({
      newBalance,
      newTransactions,
      total: ebTxs.length,
      imported: newTransactions.length,
      mode,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync error'
    const isRateLimit = msg.includes('429') || msg.includes('RATE_LIMIT') || msg.includes('multiplicity')
    return NextResponse.json(
      { error: isRateLimit ? 'Limite giornaliero raggiunto: la banca consente massimo 4 sync al giorno (PSD2). Riprova domani.' : msg },
      { status: isRateLimit ? 429 : 502 }
    )
  }
}
