import { NextRequest, NextResponse } from 'next/server'
import { fetchQuotes, fetchEurUsd } from '@/lib/services/yahooFinance'
import { fetchCryptoQuotes, isCryptoTicker } from '@/lib/services/coinGecko'
import { getDb } from '@/lib/db/schema'
import type { Quote } from '@/types'

const CACHE_TTL     = 60_000   // 60 s for regular quotes
const CRYPTO_TTL    = 30_000   // 30 s for crypto (more volatile)
const EURUSD_TTL    = 300_000  // 5 min for EUR/USD rate

// ── SQLite helpers ────────────────────────────────────────────

function getCached(ticker: string): Quote | null {
  try {
    const db  = getDb()
    const row = db
      .prepare('SELECT data, updated_at FROM price_cache WHERE ticker = ?')
      .get(ticker) as { data: string; updated_at: string } | undefined
    if (!row) return null
    const ttl = isCryptoTicker(ticker) ? CRYPTO_TTL : CACHE_TTL
    if (Date.now() - new Date(row.updated_at).getTime() > ttl) return null
    return JSON.parse(row.data) as Quote
  } catch {
    return null
  }
}

function setCache(ticker: string, data: object) {
  try {
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO price_cache (ticker, data, updated_at)
         VALUES (?, ?, datetime('now'))`
      )
      .run(ticker, JSON.stringify(data))
  } catch { /* ignore */ }
}

function getCachedEurUsd(): number | null {
  try {
    const db  = getDb()
    const row = db
      .prepare('SELECT rate, updated_at FROM currency_cache WHERE pair = ?')
      .get('EURUSD') as { rate: number; updated_at: string } | undefined
    if (!row) return null
    if (Date.now() - new Date(row.updated_at).getTime() > EURUSD_TTL) return null
    return row.rate
  } catch {
    return null
  }
}

function setCachedEurUsd(rate: number) {
  try {
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO currency_cache (pair, rate, updated_at)
         VALUES (?, ?, datetime('now'))`
      )
      .run('EURUSD', rate)
  } catch { /* ignore */ }
}

// ── handler ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const tickers = req.nextUrl.searchParams.get('tickers')?.split(',').filter(Boolean) ?? []
  if (tickers.length === 0) {
    return NextResponse.json({ quotes: [], eurUsd: 1.08, updatedAt: new Date().toISOString() })
  }

  // Separate crypto from regular tickers
  const cryptoTickers  = tickers.filter(isCryptoTicker)
  const regularTickers = tickers.filter((t) => !isCryptoTicker(t))

  // Check cache for each ticker
  const cacheMap = new Map(tickers.map((t) => [t, getCached(t)]))
  const cached   = tickers.map((t) => cacheMap.get(t)).filter((q): q is Quote => q !== null)

  const cryptoMissing  = cryptoTickers.filter((t) => !cacheMap.get(t))
  const regularMissing = regularTickers.filter((t) => !cacheMap.get(t))

  let eurUsd = getCachedEurUsd()
  const needEurUsd = eurUsd === null

  // Fetch missing data in parallel
  const [cryptoFresh, regularFresh, newEurUsd] = await Promise.all([
    cryptoMissing.length  > 0 ? fetchCryptoQuotes(cryptoMissing)              : Promise.resolve([] as Quote[]),
    regularMissing.length > 0 ? fetchQuotes(regularMissing)                    : Promise.resolve([] as Quote[]),
    needEurUsd            ? fetchEurUsd()                                       : Promise.resolve(eurUsd as number),
  ])

  const rateVal = typeof newEurUsd === 'number' ? newEurUsd : (eurUsd ?? 1.08)
  eurUsd = rateVal
  if (needEurUsd) setCachedEurUsd(rateVal)

  // Add priceEur to every fresh quote and persist to cache
  const toEur = (v: number, currency: string) => currency === 'EUR' ? v : v / rateVal

  const freshWithEur = [...cryptoFresh, ...regularFresh].map((q) => {
    const enriched: Quote = {
      ...q,
      priceEur:      toEur(q.price, q.currency),
      preMarketEur:  q.preMarket  != null ? toEur(q.preMarket,  q.currency) : undefined,
      postMarketEur: q.postMarket != null ? toEur(q.postMarket, q.currency) : undefined,
    }
    setCache(q.ticker, enriched)
    return enriched
  })

  return NextResponse.json({
    quotes:    [...cached, ...freshWithEur],
    eurUsd:    rateVal,
    updatedAt: new Date().toISOString(),
  })
}
