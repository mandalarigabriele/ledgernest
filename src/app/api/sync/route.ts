import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db/schema'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

  const db = getDb()
  const row = db.prepare(
    'SELECT data FROM user_data WHERE user_email = ? AND key = ?'
  ).get(session.user.email, key) as { data: string } | undefined

  return NextResponse.json({ data: row ? JSON.parse(row.data) : null })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { key: string; data: unknown }
  const { key, data } = body
  if (!key || data === undefined) return NextResponse.json({ error: 'Missing key or data' }, { status: 400 })

  const db = getDb()
  db.prepare(`
    INSERT OR REPLACE INTO user_data (user_email, key, data, updated_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(session.user.email, key, JSON.stringify(data))

  return NextResponse.json({ ok: true })
}
