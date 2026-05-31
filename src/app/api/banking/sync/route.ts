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

  return {
    eb_id: resolveTransactionId(eb) || `eb-${resolveTransactionDate(eb)}-${amount}`,
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
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { accountUid: string; dateFrom?: string; dateTo?: string; force?: boolean }
  const { accountUid, force } = body
  if (!accountUid) return NextResponse.json({ error: 'Missing accountUid' }, { status: 400 })

  const dateTo   = body.dateTo   ?? new Date().toISOString().slice(0, 10)
  const dateFrom = body.dateFrom ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const db = getDb()
  const acctRow = db.prepare(
    `SELECT uid, session_id, finance_account_id, currency FROM banking_accounts WHERE uid = ? AND user_email = ?`
  ).get(accountUid, session.user.email) as BankingAccountRow | undefined

  if (!acctRow) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (!acctRow.finance_account_id) return NextResponse.json({ error: 'Account not linked to a local account' }, { status: 400 })

  const sessionRow = db.prepare(
    `SELECT id FROM banking_sessions WHERE id = ? AND status = 'active'`
  ).get(acctRow.session_id) as { id: string } | undefined

  if (!sessionRow) return NextResponse.json({ error: 'Banking session not active' }, { status: 400 })

  try {
    // Update balance
    const balances   = await getBalances(accountUid)
    const newBalance = getClosingBalance(balances)
    db.prepare(`UPDATE banking_accounts SET balance = ?, last_synced_at = datetime('now') WHERE uid = ?`).run(newBalance, accountUid)

    // Fetch & import transactions
    const ebTxs = await getTransactions(accountUid, dateFrom, dateTo)
    const newTransactions: (Omit<Transaction, 'createdAt'> & { eb_id: string })[] = []

    // force=true: clear dedup records so all transactions are re-imported
    if (force) {
      db.prepare(`DELETE FROM banking_transactions WHERE account_uid = ? AND user_email = ?`).run(accountUid, session.user.email)
    }

    for (const eb of ebTxs) {
      const mapped  = mapTransaction(eb, acctRow.finance_account_id)
      const already = db.prepare(`SELECT id FROM banking_transactions WHERE id = ? AND user_email = ?`).get(mapped.eb_id, session.user.email)
      if (already) continue

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
