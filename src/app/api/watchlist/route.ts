import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getDb } from '@/lib/db/schema'
import { randomUUID } from 'crypto'

function email(session: Awaited<ReturnType<typeof getServerSession>>) {
  return session?.user?.email ?? ''
}

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  const db = getDb()

  const items = db.prepare(
    'SELECT * FROM watchlist_items WHERE user_email = ? ORDER BY created_at ASC'
  ).all(email(session)) as Array<{
    id: string; ticker: string; name: string; currency: string
    lists: string; target_price: number | null; created_at: string
  }>

  const alerts = db.prepare(
    'SELECT * FROM price_alerts WHERE user_email = ? ORDER BY created_at ASC'
  ).all(email(session)) as Array<{
    id: string; ticker: string; threshold: number; direction: string
    active: number; triggered_at: string | null; created_at: string
  }>

  return NextResponse.json({
    items: items.map((i) => ({
      id:          i.id,
      ticker:      i.ticker,
      name:        i.name,
      currency:    i.currency,
      lists:       JSON.parse(i.lists ?? '[]'),
      targetPrice: i.target_price,
      createdAt:   i.created_at,
    })),
    alerts: alerts.map((a) => ({
      id:          a.id,
      ticker:      a.ticker,
      threshold:   a.threshold,
      direction:   a.direction,
      active:      Boolean(a.active),
      triggeredAt: a.triggered_at,
      createdAt:   a.created_at,
    })),
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  const { ticker, name, currency, lists, targetPrice } = await req.json()
  const db  = getDb()
  const id  = randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    'INSERT INTO watchlist_items (id, user_email, ticker, name, currency, lists, target_price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, email(session), ticker, name ?? ticker, currency ?? 'USD', JSON.stringify(lists ?? []), targetPrice ?? null, now)

  return NextResponse.json({ id, ticker, name: name ?? ticker, currency: currency ?? 'USD', lists: lists ?? [], targetPrice: targetPrice ?? null, createdAt: now })
}
