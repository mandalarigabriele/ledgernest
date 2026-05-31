import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db/schema'
import { initiateAuth } from '@/lib/services/enableBanking'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { bankName?: string; country?: string }
  const bankName = body.bankName ?? 'Credit Agricole'
  const country  = body.country  ?? 'IT'

  const baseUrl     = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const redirectUrl = `${baseUrl}/api/banking/callback`
  const state       = crypto.randomBytes(16).toString('hex')
  const localId     = crypto.randomUUID()

  let result: { url: string }
  try {
    result = await initiateAuth({ redirectUrl, state, bankName, country })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Enable Banking error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const db = getDb()
  db.prepare(`
    INSERT INTO banking_sessions (id, user_email, bank_name, country, status, oauth_state, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, datetime('now'))
  `).run(localId, session.user.email, bankName, country, state)

  return NextResponse.json({ url: result.url })
}
