import { NextRequest, NextResponse } from 'next/server'
import { fetchDividendHistory } from '@/lib/services/yahooFinance'

interface DivEvent {
  date: string
  ticker: string
  amount: number
}

// Given historical dividend dates, estimate upcoming ex-div dates within the next 12 weeks.
// Snaps the average interval to standard frequencies (monthly/quarterly/semi-annual/annual).
function predictNextDividends(ticker: string, history: { date: string; amount: number }[]): DivEvent[] {
  if (history.length < 2) return []

  const dates = history.map((h) => new Date(h.date).getTime())
  const intervals: number[] = []
  for (let i = 1; i < dates.length; i++) intervals.push(dates[i] - dates[i - 1])
  const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length

  // Snap to known payout frequencies
  const D = 86400000
  const freqMs =
    avgMs < 45  * D ? 30  * D :
    avgMs < 135 * D ? 91  * D :
    avgMs < 270 * D ? 182 * D : 365 * D

  const avgAmount = history.slice(-4).reduce((s, h) => s + h.amount, 0) / Math.min(4, history.length)
  const now           = Date.now()
  const TWELVE_WEEKS  = 12 * 7 * D

  let nextTs = dates[dates.length - 1] + freqMs
  while (nextTs < now) nextTs += freqMs   // advance past today

  const events: DivEvent[] = []
  while (nextTs <= now + TWELVE_WEEKS) {
    events.push({ date: new Date(nextTs).toISOString().slice(0, 10), ticker, amount: avgAmount })
    nextTs += freqMs
  }
  return events
}

// GET /api/dividends?tickers=AAPL,VOO,MSFT
// Returns { events: DivEvent[] } — predicted upcoming ex-div dates in next 12 weeks
export async function GET(req: NextRequest) {
  const raw     = req.nextUrl.searchParams.get('tickers') ?? ''
  const tickers = raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (tickers.length === 0) return NextResponse.json({ events: [] })

  const allEvents: DivEvent[] = []

  await Promise.allSettled(
    tickers.map(async (ticker) => {
      try {
        const history  = await fetchDividendHistory(ticker)
        const upcoming = predictNextDividends(ticker, history)
        allEvents.push(...upcoming)
      } catch { /* skip */ }
    })
  )

  return NextResponse.json({ events: allEvents }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
