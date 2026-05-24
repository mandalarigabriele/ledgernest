import { NextRequest, NextResponse } from 'next/server'
import { fetchHistory } from '@/lib/services/yahooFinance'
import { fetchCryptoHistory, isCryptoTicker, yahooToCgId } from '@/lib/services/coinGecko'
import type { OHLCCandle } from '@/types'

const PERIOD_DAYS: Record<string, number> = {
  '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '2y': 730, '5y': 1825,
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker') ?? ''
  const period = req.nextUrl.searchParams.get('period') ?? '1y'
  const daysParam = req.nextUrl.searchParams.get('days')

  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // Route crypto tickers to CoinGecko
  if (isCryptoTicker(ticker)) {
    const cgId = yahooToCgId(ticker)!
    const days = daysParam ? parseInt(daysParam) : (PERIOD_DAYS[period] ?? 365)

    try {
      const points = await fetchCryptoHistory(cgId, days)

      // Deduplicate by date (keep last point per day)
      const byDate = new Map<string, OHLCCandle>()
      for (const { timestamp, price } of points) {
        const date = new Date(timestamp).toISOString().slice(0, 10)
        byDate.set(date, {
          date,
          open: price, high: price, low: price, close: price,
          volume: 0,
        })
      }

      return NextResponse.json(
        { ticker, interval: '1d', candles: Array.from(byDate.values()) },
        { headers: { 'Cache-Control': 'public, max-age=300' } }
      )
    } catch {
      return NextResponse.json({ ticker, interval: '1d', candles: [] })
    }
  }

  // Regular tickers → Yahoo Finance
  const yPeriod = (period ?? '1y') as '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y'
  const history = await fetchHistory(ticker, yPeriod)
  return NextResponse.json(history)
}
