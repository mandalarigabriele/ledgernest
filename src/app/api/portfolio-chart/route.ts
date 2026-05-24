import { NextRequest, NextResponse } from 'next/server'
import { fetchHistory } from '@/lib/services/yahooFinance'
import { fetchCryptoHistory, isCryptoTicker, yahooToCgId } from '@/lib/services/coinGecko'

// ── per-ticker price history ──────────────────────────────────

async function getHistory(ticker: string, days: number): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    if (isCryptoTicker(ticker)) {
      const cgId = yahooToCgId(ticker)
      if (!cgId) return map
      const pts = await fetchCryptoHistory(cgId, Math.min(days, 365))
      for (const { timestamp, price } of pts) {
        // CoinGecko can return multiple points per day; keep last one
        map.set(new Date(timestamp).toISOString().slice(0, 10), price)
      }
    } else {
      const period: '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' =
        days <= 31  ? '1mo'  :
        days <= 92  ? '3mo'  :
        days <= 185 ? '6mo'  :
        days <= 366 ? '1y'   :
        days <= 730 ? '2y'   : '5y'
      const hist = await fetchHistory(ticker, period)
      for (const c of hist.candles) map.set(c.date, c.close)
    }
  } catch { /* return empty map on error */ }
  return map
}

// ── carry-forward fill ────────────────────────────────────────
// For each date in sortedDates, provide the last known price (fills weekends/holidays).

function fillForward(priceMap: Map<string, number>, sortedDates: string[]): Map<string, number> {
  const sorted = Array.from(priceMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  const result = new Map<string, number>()
  let j = 0, lastPrice = 0

  for (const date of sortedDates) {
    while (j < sorted.length && sorted[j][0] <= date) {
      lastPrice = sorted[j][1]
      j++
    }
    if (lastPrice > 0) result.set(date, lastPrice)
  }
  return result
}

// ── handler ───────────────────────────────────────────────────
//
// GET /api/portfolio-chart
//   ?p=TICKER:QTY:PURCHASE_DATE:CURRENCY,...
//   &days=180
//   &eurUsd=1.08
//
// Returns { points: { date: string; value: number }[] }

export async function GET(req: NextRequest) {
  const pParam = req.nextUrl.searchParams.get('p') ?? ''
  const days   = parseInt(req.nextUrl.searchParams.get('days')   ?? '180')
  const eurUsd = parseFloat(req.nextUrl.searchParams.get('eurUsd') ?? '1.08')

  if (!pParam) return NextResponse.json({ points: [] })

  const positions = pParam.split(',')
    .map((s) => {
      const [ticker, qty, purchaseDate, currency] = s.split(':')
      return { ticker, quantity: parseFloat(qty), purchaseDate, currency: currency ?? 'USD' }
    })
    .filter((p) => p.ticker && p.quantity > 0 && p.purchaseDate)

  if (positions.length === 0) return NextResponse.json({ points: [] })

  // Fetch all price histories in parallel
  const histories = await Promise.all(positions.map((p) => getHistory(p.ticker, days)))

  // Build a unified sorted date list within the requested range
  const cutoff    = new Date(); cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const dateSet = new Set<string>()
  for (const h of histories) {
    Array.from(h.keys()).forEach((date) => {
      if (date >= cutoffStr) dateSet.add(date)
    })
  }
  const sortedDates = Array.from(dateSet).sort()
  if (sortedDates.length === 0) return NextResponse.json({ points: [] })

  // Fill each history forward so every date has a price
  const filled = histories.map((h) => fillForward(h, sortedDates))

  // Compute portfolio value for each date
  const points: { date: string; value: number }[] = []

  for (const date of sortedDates) {
    let total = 0, hasAny = false

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]
      // Skip dates before the position was purchased
      if (date < pos.purchaseDate) continue

      const price = filled[i].get(date)
      if (!price) continue

      // Convert to EUR
      const priceEur = pos.currency === 'EUR' ? price : price / eurUsd
      total += pos.quantity * priceEur
      hasAny = true
    }

    if (hasAny) points.push({ date, value: Math.round(total * 100) / 100 })
  }

  return NextResponse.json(
    { points },
    { headers: { 'Cache-Control': 'public, max-age=300' } }
  )
}
