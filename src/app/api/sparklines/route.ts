import { NextRequest, NextResponse } from 'next/server'
import { fetchHistory } from '@/lib/services/yahooFinance'
import { fetchCryptoHistory, isCryptoTicker, yahooToCgId } from '@/lib/services/coinGecko'

// GET /api/sparklines?tickers=AAPL,MSFT,BTC-USD
// Returns { AAPL: [150, 152, ...], ... } — last 10 daily closes per ticker
export async function GET(req: NextRequest) {
  const raw     = req.nextUrl.searchParams.get('tickers') ?? ''
  const tickers = raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (tickers.length === 0) return NextResponse.json({})

  const result: Record<string, number[]> = {}

  await Promise.allSettled(
    tickers.map(async (ticker) => {
      try {
        if (isCryptoTicker(ticker)) {
          const cgId = yahooToCgId(ticker)
          if (!cgId) return
          const pts = await fetchCryptoHistory(cgId, 10)
          const closes = pts.slice(-10).map((p) => p.price)
          if (closes.length >= 2) result[ticker] = closes
        } else {
          const hist = await fetchHistory(ticker, '1mo')
          const closes = hist.candles.slice(-10).map((c) => c.close)
          if (closes.length >= 2) result[ticker] = closes
        }
      } catch { /* skip */ }
    })
  )

  return NextResponse.json(result, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
