import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/schema'
import { createSessionFromCode, getBalances, getClosingBalance, resolveAccountId, resolveIban } from '@/lib/services/enableBanking'

// Enable Banking redirects here after PSU authenticates.
// Query params: ?code=<code>&state=<oauth_state>
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  if (error || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/finance/accounts?banking_error=${encodeURIComponent(error ?? 'missing_params')}`)
  }

  const db = getDb()
  const row = db.prepare(
    `SELECT id, user_email, bank_name FROM banking_sessions WHERE oauth_state = ? AND status = 'pending'`
  ).get(state) as { id: string; user_email: string; bank_name: string } | undefined

  if (!row) {
    return NextResponse.redirect(`${baseUrl}/finance/accounts?banking_error=unknown_state`)
  }

  try {
    const sessionResult = await createSessionFromCode(code)
    const ebSessionId = sessionResult.session_id ?? sessionResult.sessionId ?? ''

    // Mark session active
    db.prepare(`
      UPDATE banking_sessions SET status = 'active', eb_session_id = ?, updated_at = datetime('now') WHERE id = ?
    `).run(ebSessionId, row.id)

    // Store accounts with balances
    for (const acct of sessionResult.accounts ?? []) {
      const accountId = resolveAccountId(acct)
      if (!accountId) continue

      let balance = 0
      try {
        const balances = await getBalances(accountId)
        balance = getClosingBalance(balances)
      } catch { /* balance will be 0 */ }

      const iban = resolveIban(acct)

      db.prepare(`
        INSERT OR REPLACE INTO banking_accounts
          (uid, session_id, user_email, iban, name, product, currency, balance, last_synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(accountId, row.id, row.user_email, iban, acct.name ?? null, acct.product ?? null, acct.currency, balance)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'session error'
    return NextResponse.redirect(`${baseUrl}/finance/accounts?banking_error=${encodeURIComponent(msg)}`)
  }

  return NextResponse.redirect(`${baseUrl}/finance/accounts?banking_ok=1`)
}
