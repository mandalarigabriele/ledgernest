import { NextRequest, NextResponse } from 'next/server'
import { fetchHistory, fetchHourlyHistory } from '@/lib/services/yahooFinance'
import { fetchCryptoHistory, isCryptoTicker, yahooToCgId } from '@/lib/services/coinGecko'

// ── per-ticker price history ──────────────────────────────────
// For days <= 7: returns Map with "YYYY-MM-DDTHH:MM" keys (hourly candles, UTC)
// For days > 7:  returns Map with "YYYY-MM-DD" keys (daily closes)
// Also returns the native currency of the price data.

interface HistoryResult {
  prices: Map<string, number>
  currency: string // e.g. 'USD', 'EUR', 'GBp'
}

async function getHistory(ticker: string, days: number): Promise<HistoryResult> {
  const map = new Map<string, number>()
  let currency = 'USD'
  try {
    if (isCryptoTicker(ticker)) {
      const cgId = yahooToCgId(ticker)
      if (!cgId) return { prices: map, currency: 'EUR' } // CoinGecko returns EUR
      const pts = await fetchCryptoHistory(cgId, Math.min(days, 365))
      for (const { timestamp, price } of pts) {
        map.set(new Date(timestamp).toISOString().slice(0, 10), price)
      }
      return { prices: map, currency: 'EUR' }
    } else if (days <= 7) {
      try {
        const hist = await fetchHistory(ticker, '1mo')
        currency = hist.currency || 'USD'
        for (const c of hist.candles) map.set(c.date, c.close)
      } catch { /* ignore */ }
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
      currency = hist.currency || 'USD'
      for (const c of hist.candles) map.set(c.date, c.close)
    }
  } catch { /* return empty map on error */ }
  return { prices: map, currency }
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

  const result = new Map<string, number>()
  let j = 0, lastPrice = 0

  for (const date of sortedDates) {
    while (j < sorted.length && sorted[j][0] <= date) {
      lastPrice = sorted[j][1]
      j++
    }
    // Only forward-fill: once we have a known price, carry it forward (weekends/holidays).
    // Do NOT back-fill dates before the first known data point — the ticker simply
    // won't contribute to the portfolio total for those dates.
    if (lastPrice > 0) result.set(date, lastPrice)
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
  const debug  = req.nextUrl.searchParams.get('debug') === '1'

  if (!pParam) return NextResponse.json({ points: [] })

  const positions = pParam.split(',')
    .map((s) => {
      const [ticker, qty, purchaseDate, currency, livePriceEurStr, avgPriceStr] = s.split(':')
      return {
        ticker,
        quantity:     parseFloat(qty),
        purchaseDate,
        currency:     currency ?? 'USD',
        livePriceEur: parseFloat(livePriceEurStr) || 0,
        avgPrice:     parseFloat(avgPriceStr) || 0,
      }
    })
    .filter((p) => p.ticker && p.quantity > 0 && p.purchaseDate)

  if (positions.length === 0) return NextResponse.json({ points: [] })

  // Fetch all price histories in parallel
  const historyResults = await Promise.all(positions.map((p) => getHistory(p.ticker, days)))

  // Build a unified sorted date list within the requested range
  const cutoff    = new Date(); cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const dateSet = new Set<string>()
  for (const h of historyResults) {
    Array.from(h.prices.keys()).forEach((date) => {
      if (date >= cutoffStr) dateSet.add(date)
    })
  }

  const sortedDates = Array.from(dateSet).sort()
  if (sortedDates.length === 0) return NextResponse.json({ points: [] })

  // Fill gaps (weekends/holidays) with forward-fill only.
  // Tickers with zero history simply won't contribute to any date.
  const filled = historyResults.map((h) => {
    if (h.prices.size === 0) return new Map<string, number>()
    return fillBothWays(h.prices, sortedDates)
  })

  // Determine the actual currency of each ticker's price data from Yahoo/CoinGecko.
  // This overrides the client-supplied currency which may be incorrect.
  const priceCurrencies = historyResults.map((h) => h.currency)

  // Compute portfolio value AND invested cost for each date.
  // A position only contributes to BOTH value and invested when it has a known price.
  // This keeps the two lines in sync — no invested without corresponding value.
  const points: { date: string; value: number; invested: number }[] = []

  for (const date of sortedDates) {
    let total = 0, invested = 0, hasAny = false
    const debugEntries: { ticker: string; qty: number; price: number; priceEur: number; cost: number; purchaseDate: string; priceCurrency: string }[] = []

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]
      // Skip dates before the position was purchased
      if (date < pos.purchaseDate) continue

      const price = filled[i].get(date)
      if (!price) continue

      // Use the actual currency from Yahoo/CoinGecko, not the client-supplied one
      const priceCurrency = priceCurrencies[i]
      const isEur = priceCurrency === 'EUR'
      // GBp (pence) needs special handling: divide by 100 to get GBP, then convert
      const isGBp = priceCurrency === 'GBp' || priceCurrency === 'GBX'

      let priceEur: number
      if (isEur) {
        priceEur = price
      } else if (isGBp) {
        // GBp → GBP → EUR (approximate: GBP ≈ EUR * 1.17)
        priceEur = (price / 100) / (eurUsd * 0.87) // rough GBP/EUR via USD
      } else {
        // Assume USD for anything else
        priceEur = price / eurUsd
      }

      total += pos.quantity * priceEur

      // Cost basis: use CLIENT-supplied currency since avgPrice is stored
      // in whatever currency the user's position uses (may already be EUR)
      const clientIsEur = pos.currency === 'EUR'
      let costEur: number
      if (clientIsEur) {
        costEur = pos.avgPrice
      } else {
        costEur = pos.avgPrice / eurUsd
      }
      invested += pos.quantity * costEur

      hasAny = true
      if (debug) debugEntries.push({ ticker: pos.ticker, qty: pos.quantity, price, priceEur, cost: costEur * pos.quantity, purchaseDate: pos.purchaseDate, priceCurrency })
    }

    if (hasAny) points.push({
      date,
      value: Math.round(total * 100) / 100,
      invested: Math.round(invested * 100) / 100,
      ...(debug ? { details: debugEntries } : {}),
    } as any)
  }

  return NextResponse.json(
    { points },
    { headers: { 'Cache-Control': 'public, max-age=300' } }
  )
}
