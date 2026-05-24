import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/schema'

function nanoid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') ?? 'portfolio'
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '365')

  const db = getDb()

  if (type === 'portfolio') {
    const rows = db.prepare(`
      SELECT * FROM portfolio_snapshots ORDER BY date DESC LIMIT ?
    `).all(limit)
    return NextResponse.json({ snapshots: rows.reverse() })
  }

  const rows = db.prepare(`
    SELECT * FROM networth_snapshots ORDER BY date DESC LIMIT ?
  `).all(limit)
  return NextResponse.json({ snapshots: rows.reverse() })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>
  const type = body.type as string ?? 'portfolio'
  const db = getDb()
  const now = new Date().toISOString().slice(0, 10)

  if (type === 'portfolio') {
    const { totalValue, totalCost, unrealizedPnl, pnlPct, byType } = body
    db.prepare(`
      INSERT OR REPLACE INTO portfolio_snapshots
        (id, date, total_value, total_cost, unrealized_pnl, pnl_pct, by_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      nanoid(), now,
      totalValue, totalCost, unrealizedPnl, pnlPct,
      JSON.stringify(byType ?? {})
    )
  } else {
    const { totalAssets, totalLiabilities, netWorth, portfolioValue, cashValue } = body
    db.prepare(`
      INSERT OR REPLACE INTO networth_snapshots
        (id, date, total_assets, total_liabilities, net_worth, portfolio_value, cash_value, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(nanoid(), now, totalAssets, totalLiabilities, netWorth, portfolioValue, cashValue)
  }

  return NextResponse.json({ ok: true })
}
