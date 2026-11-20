import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db/schema'
import {
  getTransactions, getBalances, getClosingBalance,
  resolveTransactionAmount, resolveTransactionDate, resolveTransactionId,
  resolveCreditor, resolveDebtor, resolveRemittance, resolveKindHints,
  type EBTransaction,
} from '@/lib/services/enableBanking'
import { cleanMerchant, guessCategory } from '@/lib/utils/csvImport'
import { CASH_CATEGORY, UNCATEGORIZED, isCashWithdrawal } from '@/lib/utils/classify'
import type { Transaction } from '@/types'
import crypto from 'crypto'

interface BankingAccountRow {
  uid: string
  session_id: string
  finance_account_id: string | null
  currency: string
  superseded_by: string | null
}

function mapTransaction(
  eb: EBTransaction,
  financeAccountId: string,
): Omit<Transaction, 'id' | 'createdAt'> & { eb_id: string } {
  const amount = resolveTransactionAmount(eb)

  // Raw counterparty name — creditor for expenses, debtor for income
  const rawCounterparty = amount < 0 ? resolveCreditor(eb) : resolveDebtor(eb)

  // Remittance info as fallback description
  const remittance = resolveRemittance(eb)

  // Clean the best available raw string using the same rules as CSV import
  const rawForClean = rawCounterparty || remittance
  const merchant = rawForClean ? cleanMerchant(rawForClean) : undefined

  // Description: prefer cleaned merchant, fall back to remittance, then generic
  const description = merchant || remittance || rawCounterparty || 'Transazione'

  // Category + type from keyword rules (same as CSV import)
  const guess = guessCategory(description)
  let cat = guess.cat
  let guessedType = guess.type
  // Cash withdrawals: also look at the remittance, the bank's transaction code and the MCC,
  // which the merchant name alone often lacks.
  if (amount < 0 && isCashWithdrawal([description, rawCounterparty, remittance, ...resolveKindHints(eb)], rawCounterparty, eb.merchant_category_code)) {
    cat = CASH_CATEGORY
    guessedType = 'expense'
  } else if (amount > 0 && cat === CASH_CATEGORY) {
    cat = UNCATEGORIZED // money coming in is never a withdrawal
  }
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
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: {
      accountUid?: string
      dateFrom?: string
      dateTo?: string
      mode?: 'delta' | 'force' | 'hard-reset'
      financeAccountId?: string
    }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
    }

    const { accountUid, mode = 'delta' } = body
    if (!accountUid) return NextResponse.json({ error: 'Missing accountUid' }, { status: 400 })

    const dateTo   = body.dateTo   ?? new Date().toISOString().slice(0, 10)
    const dateFrom = body.dateFrom ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const db = getDb()
    const acctRow = db.prepare(
      `SELECT uid, session_id, finance_account_id, currency, superseded_by FROM banking_accounts WHERE uid = ? AND user_email = ?`
    ).get(accountUid, session.user.email) as BankingAccountRow | undefined

    if (!acctRow) return NextResponse.json({ error: 'Conto bancario non trovato' }, { status: 404 })
    if (acctRow.superseded_by) {
      return NextResponse.json({ error: 'Questo collegamento è stato sostituito quando hai ricollegato la banca. Ricarica la pagina.' }, { status: 409 })
    }

    // Allow caller to override finance_account_id (e.g. after re-link)
    const financeAccountId = body.financeAccountId ?? acctRow.finance_account_id
    if (!financeAccountId) return NextResponse.json({ error: 'Conto non collegato a un conto locale' }, { status: 400 })

    // Persist the link if caller supplied an override
    if (body.financeAccountId && body.financeAccountId !== acctRow.finance_account_id) {
      db.prepare(`UPDATE banking_accounts SET finance_account_id = ? WHERE uid = ?`).run(body.financeAccountId, accountUid)
    }

    const sessionRow = db.prepare(
      `SELECT id FROM banking_sessions WHERE id = ? AND status = 'active'`
    ).get(acctRow.session_id) as { id: string } | undefined

    if (!sessionRow) return NextResponse.json({ error: 'Sessione Open Banking scaduta o non attiva. Ricollega il conto.' }, { status: 400 })

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
    const ebStatus = Number(msg.match(/Enable Banking API (\d{3})/)?.[1] ?? 0)
    const isRateLimit = ebStatus === 429 || msg.includes('RATE_LIMIT') || msg.includes('multiplicity') || msg.includes('rate limit')
    // 401/403: session expired or revoked; 404/422: the account belongs to another session or
    // Enable Banking application (e.g. after switching account) — both need a reconnection.
    const isSessionExpired = [401, 403, 404, 422].includes(ebStatus) || msg.includes('SESSION_EXPIRED') || msg.includes('invalid_grant')
    console.error('[banking/sync]', msg)

    let userMsg = msg
    if (isRateLimit) {
      userMsg = 'Limite giornaliero raggiunto: la banca consente massimo 4 sync al giorno (PSD2). Riprova domani.'
    } else if (isSessionExpired) {
      userMsg = 'La sessione con la banca è scaduta o non valida. Ricollega il conto nelle Impostazioni Open Banking.'
    } else if (msg.includes('non-JSON') || msg.includes('<!DOCTYPE')) {
      userMsg = 'La banca o il servizio Open Banking ha restituito una risposta non valida. Riprova più tardi.'
    }

    return NextResponse.json(
      { error: userMsg },
      { status: isRateLimit ? 429 : isSessionExpired ? 409 : 502 }
    )
  }
}
