import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getDb } from '@/lib/db/schema'

function email(session: Awaited<ReturnType<typeof getServerSession>>) {
  return session?.user?.email ?? ''
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  const { lists, targetPrice } = await req.json()
  const db = getDb()

  db.prepare(
    'UPDATE watchlist_items SET lists = ?, target_price = ? WHERE id = ? AND user_email = ?'
  ).run(JSON.stringify(lists ?? []), targetPrice ?? null, params.id, email(session))

  const row = db.prepare('SELECT * FROM watchlist_items WHERE id = ?').get(params.id) as {
    id: string; ticker: string; name: string; currency: string
    lists: string; target_price: number | null; created_at: string
  }

  return NextResponse.json({
    id: row.id, ticker: row.ticker, name: row.name, currency: row.currency,
    lists: JSON.parse(row.lists ?? '[]'), targetPrice: row.target_price, createdAt: row.created_at,
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  const db = getDb()
  db.prepare('DELETE FROM watchlist_items WHERE id = ? AND user_email = ?').run(params.id, email(session))
  // also remove alerts for that ticker if no other watchlist items reference it
  return NextResponse.json({ ok: true })
}
