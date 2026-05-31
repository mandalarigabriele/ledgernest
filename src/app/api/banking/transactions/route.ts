import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db/schema'

// PATCH /api/banking/transactions — mark a banking transaction as user-deleted (or restore it)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { ebId: string; userDeleted: boolean }
  const { ebId, userDeleted } = body
  if (!ebId) return NextResponse.json({ error: 'Missing ebId' }, { status: 400 })

  const db = getDb()
  const result = db.prepare(
    `UPDATE banking_transactions SET user_deleted = ? WHERE id = ? AND user_email = ?`
  ).run(userDeleted ? 1 : 0, ebId, session.user.email)

  if (result.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
