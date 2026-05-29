import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/schema'
import { fetchQuotes, fetchEurUsd } from '@/lib/services/yahooFinance'
import { fetchCryptoQuotes, isCryptoTicker } from '@/lib/services/coinGecko'
import type { PortfolioPosition, AssetType } from '@/types'

interface StoredPortfolio {
  positions?: PortfolioPosition[]
}

interface StoredSettings {
  settings?: { refreshInterval?: number; snapshotInterval?: number }
}

interface StoredSnapshots {
  snapshots?: Array<{
    ts: number; value: number; invested: number
    stocks: number; etf: number; crypto: number; commodity: number
    stocksInvested?: number; etfInvested?: number; cryptoInvested?: number; commodityInvested?: number
  }>
}

const BUCKET_15M = 15 * 60_000
const BUCKET_1H  = 60 * 60_000
const BUCKET_1D  = 24 * 3_600_000
const BUCKET_1W  = 7 * 24 * 3_600_000

function bucketize<T extends { ts: number }>(arr: T[], ms: number): T[] {
  const b: Record<number, T> = {}
  for (const s of arr) {
    const k = Math.floor(s.ts / ms)
    if (!b[k] || s.ts > b[k].ts) b[k] = s
  }
  return Object.values(b).sort((a, c) => a.ts - c.ts)
}

function downsample<T extends { ts: number }>(snaps: T[]): T[] {
  const now = Date.now()
  const cut24h = now - 24 * 3_600_000
  const cut7d  = now - 7 * 24 * 3_600_000
  const cut30d = now - 30 * 24 * 3_600_000
  const cut1y  = now - 365 * 24 * 3_600_000
  return [
    ...bucketize(snaps.filter(s => s.ts < cut1y), BUCKET_1W),
    ...bucketize(snaps.filter(s => s.ts >= cut1y && s.ts < cut30d), BUCKET_1D),
    ...bucketize(snaps.filter(s => s.ts >= cut30d && s.ts < cut7d), BUCKET_1H),
    ...bucketize(snaps.filter(s => s.ts >= cut7d && s.ts < cut24h), BUCKET_15M),
    ...snaps.filter(s => s.ts >= cut24h),
  ]
}

export async function POST(req: NextRequest) {
  // Auth via secret header
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()

  // Find all users that have portfolio data
  const users = db
    .prepare("SELECT DISTINCT user_email FROM user_data WHERE key = 'portfolio'")
    .all() as { user_email: string }[]

  if (users.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No users with portfolio data' })
  }

  // Fetch EUR/USD once for all users
  let eurUsd = 1.08
  try { eurUsd = await fetchEurUsd() } catch { /* use fallback */ }

  const results: string[] = []

  for (const { user_email } of users) {
    try {
      // Load portfolio
      const portRow = db
        .prepare("SELECT data FROM user_data WHERE user_email = ? AND key = 'portfolio'")
        .get(user_email) as { data: string } | undefined
      if (!portRow) continue

      const { positions = [] } = JSON.parse(portRow.data) as StoredPortfolio
      if (positions.length === 0) continue

      // Load settings to check refresh interval
      const settRow = db
        .prepare("SELECT data FROM user_data WHERE user_email = ? AND key = 'settings'")
        .get(user_email) as { data: string } | undefined
      const { settings } = settRow ? JSON.parse(settRow.data) as StoredSettings : { settings: undefined }
      const intervalMs = (settings?.snapshotInterval ?? settings?.refreshInterval ?? 600) * 1_000

      // Load existing snapshots — skip if last snapshot is too recent
      const snapRow = db
        .prepare("SELECT data FROM user_data WHERE user_email = ? AND key = 'snapshots'")
        .get(user_email) as { data: string } | undefined
      const { snapshots: existing = [] } = snapRow ? JSON.parse(snapRow.data) as StoredSnapshots : { snapshots: [] }
      const lastTs = existing.length > 0 ? existing[existing.length - 1].ts : 0
      if (Date.now() - lastTs < intervalMs) {
        results.push(`${user_email}: skipped (last snapshot ${Math.round((Date.now() - lastTs) / 1000)}s ago)`)
        continue
      }

      // Separate tickers
      const cryptoTickers  = [...new Set(positions.filter(p => isCryptoTicker(p.ticker)).map(p => p.ticker))]
      const regularTickers = [...new Set(positions.filter(p => !isCryptoTicker(p.ticker)).map(p => p.ticker))]

      // Fetch prices
      const [cryptoQuotes, regularQuotes] = await Promise.all([
        cryptoTickers.length  > 0 ? fetchCryptoQuotes(cryptoTickers)  : Promise.resolve([]),
        regularTickers.length > 0 ? fetchQuotes(regularTickers)        : Promise.resolve([]),
      ])

      const quoteMap = new Map([...cryptoQuotes, ...regularQuotes].map(q => [q.ticker, q]))

      // Update price_cache for fetched quotes
      const toEur = (price: number, currency: string) => currency === 'EUR' ? price : price / eurUsd
      for (const q of [...cryptoQuotes, ...regularQuotes]) {
        const enriched = { ...q, priceEur: toEur(q.price, q.currency) }
        db.prepare(`INSERT OR REPLACE INTO price_cache (ticker, data, updated_at) VALUES (?, ?, datetime('now'))`)
          .run(q.ticker, JSON.stringify(enriched))
      }

      // Calculate portfolio breakdown
      const byType: Record<AssetType, { value: number; invested: number }> = {
        stock: { value: 0, invested: 0 }, etf:  { value: 0, invested: 0 },
        crypto: { value: 0, invested: 0 }, bond: { value: 0, invested: 0 },
        commodity: { value: 0, invested: 0 },
      }
      // already includes commodity via byType['commodity']

      for (const pos of positions) {
        const q = quoteMap.get(pos.ticker)
        const priceEur = q
          ? toEur(q.price, q.currency)
          : (pos.currency === 'EUR' ? pos.avgPrice : pos.avgPrice / eurUsd)
        const avgEur = pos.currency === 'EUR' ? pos.avgPrice : pos.avgPrice / eurUsd
        const type   = pos.type as AssetType
        byType[type].value    += priceEur * pos.quantity
        byType[type].invested += avgEur   * pos.quantity
      }

      const totalValue    = Object.values(byType).reduce((s, v) => s + v.value, 0)
      const totalInvested = Object.values(byType).reduce((s, v) => s + v.invested, 0)

      const newSnap = {
        ts: Date.now(),
        value:          Math.round(totalValue    * 100) / 100,
        invested:       Math.round(totalInvested * 100) / 100,
        stocks:    Math.round(byType.stock.value     * 100) / 100,
        etf:       Math.round(byType.etf.value       * 100) / 100,
        crypto:    Math.round(byType.crypto.value    * 100) / 100,
        commodity: Math.round(byType.commodity.value * 100) / 100,
        stocksInvested:    Math.round(byType.stock.invested     * 100) / 100,
        etfInvested:       Math.round(byType.etf.invested       * 100) / 100,
        cryptoInvested:    Math.round(byType.crypto.invested    * 100) / 100,
        commodityInvested: Math.round(byType.commodity.invested * 100) / 100,
      }

      const updated = downsample([...existing, newSnap])

      db.prepare(`INSERT OR REPLACE INTO user_data (user_email, key, data, updated_at) VALUES (?, ?, ?, datetime('now'))`)
        .run(user_email, 'snapshots', JSON.stringify({ snapshots: updated }))

      results.push(`${user_email}: snapshot saved (value=${newSnap.value})`)
    } catch (err) {
      results.push(`${user_email}: error — ${String(err)}`)
    }
  }

  return NextResponse.json({ ok: true, processed: users.length, results })
}
