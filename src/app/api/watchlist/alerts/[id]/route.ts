import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getDb } from '@/lib/db/schema'

function email(session: Awaited<ReturnType<typeof getServerSession>>) {
  return session?.user?.email ?? ''
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  const db = getDb()
  db.prepare('DELETE FROM price_alerts WHERE id = ? AND user_email = ?').run(params.id, email(session))
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  const { active, triggeredAt } = await req.json()
  const db = getDb()
  db.prepare(
    'UPDATE price_alerts SET active = ?, triggered_at = ? WHERE id = ? AND user_email = ?'
  ).run(active ? 1 : 0, triggeredAt ?? null, params.id, email(session))
  return NextResponse.json({ ok: true })
}
