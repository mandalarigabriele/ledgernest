import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getDb } from '@/lib/db/schema'
import { randomUUID } from 'crypto'

function email(session: Awaited<ReturnType<typeof getServerSession>>) {
  return session?.user?.email ?? ''
}

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  const { ticker, threshold, direction } = await req.json()
  const db  = getDb()
  const id  = randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    'INSERT INTO price_alerts (id, user_email, ticker, threshold, direction, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
  ).run(id, email(session), ticker, threshold, direction, now)

  return NextResponse.json({ id, ticker, threshold, direction, active: true, triggeredAt: null, createdAt: now })
}
