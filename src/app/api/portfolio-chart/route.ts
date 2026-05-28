import { NextRequest, NextResponse } from 'next/server'
import { fetchHistory, fetchHourlyHistory } from '@/lib/services/yahooFinance'
import { fetchCryptoHistory, isCryptoTicker, yahooToCgId } from '@/lib/services/coinGecko'

// ── per-ticker price history ──────────────────────────────────
// For days <= 7: returns Map with "YYYY-MM-DDTHH:MM" keys (hourly candles, UTC)
// For days > 7:  returns Map with "YYYY-MM-DD" keys (daily closes)

async function getHistory(ticker: string, days: number): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    if (isCryptoTicker(ticker)) {
      const cgId = yahooToCgId(ticker)
      if (!cgId) return map
      const pts = await fetchCryptoHistory(cgId, Math.min(days, 365))
      for (const { timestamp, price } of pts) {
        map.set(new Date(timestamp).toISOString().slice(0, 10), price)
      }
    } else if (days <= 7) {
      // For 1S: fetch daily closes first as fallback, then overlay hourly candles.
      // This ensures positions with limited intraday history still have a price
      // for every trading day, preventing artificial gaps that inflate portfolio jumps.
      try {
        const hist = await fetchHistory(ticker, '1mo')
        for (const c of hist.candles) map.set(c.date, c.close)
      } catch { /* ignore — hourly may still work */ }
      try {
        const hourly = await fetchHourlyHistory(ticker)
        for (const [dt, price] of hourly) map.set(dt, price)
      } catch { /* ignore */ }
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

// ── bi-directional fill ───────────────────────────────────────
// Forward-fills gaps (weekends/holidays) using the last known price.
// Also back-fills dates before the first known data point using that
// oldest price. This prevents an artificial spike when a ticker has
// no historical data: instead of contributing 0 to past dates and
// full price today, it contributes a constant (oldest known price)
// across the whole range.

function fillBothWays(priceMap: Map<string, number>, sortedDates: string[]): Map<string, number> {
  const sorted = Array.from(priceMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  if (sorted.length === 0) return new Map()

  const firstKnown = sorted[0][1]
  const result = new Map<string, number>()
  let j = 0, lastPrice = 0

  for (const date of sortedDates) {
    while (j < sorted.length && sorted[j][0] <= date) {
      lastPrice = sorted[j][1]
      j++
    }
    // Before first data point → back-fill with oldest price; after → forward-fill
    const price = lastPrice > 0 ? lastPrice : firstKnown
    if (price > 0) result.set(date, price)
  }
  return result
}

// ── handler ───────────────────────────────────────────────────
//
// GET /api/portfolio-chart
//   ?p=TICKER:QTY:PURCHASE_DATE:CURRENCY:LIVE_PRICE_EUR,...
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
      const [ticker, qty, purchaseDate, currency, livePriceEurStr] = s.split(':')
      return {
        ticker,
        quantity:     parseFloat(qty),
        purchaseDate,
        currency:     currency ?? 'USD',
        livePriceEur: parseFloat(livePriceEurStr) || 0,
      }
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

  // Fill each history in both directions so every date has a price.
  // For tickers with zero history (both daily fallback and hourly fetch failed),
  // use the live price as a constant so they contribute the same value to every
  // historical date and to the live terminal — eliminating the end-of-chart spike.
  const filled = histories.map((h, i) => {
    if (h.size === 0 && positions[i].livePriceEur > 0) {
      const fallback = new Map<string, number>()
      for (const date of sortedDates) fallback.set(date, positions[i].livePriceEur)
      return fallback
    }
    return fillBothWays(h, sortedDates)
  })

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
