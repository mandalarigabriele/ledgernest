import { NextRequest, NextResponse } from 'next/server'
import { isCryptoTicker, yahooToCgId } from '@/lib/services/coinGecko'

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; LedgerNest/1.0)' }
const CG_HEADERS = { Accept: 'application/json' }
const CG_BASE    = 'https://api.coingecko.com/api/v3'

// ── CoinGecko coin detail ─────────────────────────────────────

async function fetchCgInfo(cgId: string) {
  const res = await fetch(
    `${CG_BASE}/coins/markets?vs_currency=usd&ids=${cgId}&per_page=1`,
    { headers: CG_HEADERS, next: { revalidate: 3600 } }
  )
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
  const [coin] = await res.json() as Array<{
    id: string; name: string; symbol: string
    market_cap_rank: number | null
    categories?: string[]
  }>
  if (!coin) throw new Error('not found')
  return coin
}

// ── Yahoo Finance fallbacks ───────────────────────────────────

async function fetchQuoteSummary(ticker: string) {
  const url =
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}` +
    `?modules=assetProfile,price`
  const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`status ${res.status}`)
  const json = await res.json() as {
    quoteSummary?: {
      result?: Array<{
        assetProfile?: { sector?: string; industry?: string; country?: string }
        price?: { shortName?: string; longName?: string; exchange?: string; quoteType?: string }
      }>
      error?: unknown
    }
  }
  if (json.quoteSummary?.error || !json.quoteSummary?.result?.length) throw new Error('no data')
  return json.quoteSummary.result[0]
}

async function fetchYfSearch(ticker: string) {
  const url =
    `https://query1.finance.yahoo.com/v1/finance/search` +
    `?q=${encodeURIComponent(ticker)}&quotesCount=1&newsCount=0&enableFuzzyQuery=false`
  const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`status ${res.status}`)
  const json = await res.json() as {
    quotes?: Array<{
      symbol?: string; shortname?: string; longname?: string
      sector?: string; industry?: string; exchange?: string; quoteType?: string
    }>
  }
  const hit = json.quotes?.find((q) => q.symbol?.toUpperCase() === ticker) ?? json.quotes?.[0]
  if (!hit) throw new Error('not found')
  return hit
}

// ── handler ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.trim().toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'missing ticker' }, { status: 400 })

  // ── Crypto: source from CoinGecko ──
  if (isCryptoTicker(ticker)) {
    const cgId = yahooToCgId(ticker)
    if (cgId) {
      try {
        const coin = await fetchCgInfo(cgId)
        return NextResponse.json(
          {
            ticker,
            name: coin.name,
            sector: null,
            industry: null,
            exchange: 'CoinGecko',
            quoteType: 'CRYPTOCURRENCY',
          },
          { headers: { 'Cache-Control': 'public, max-age=3600' } }
        )
      } catch { /* fall through to Yahoo */ }
    }
  }

  // ── Regular: source from Yahoo Finance ──
  try {
    const qs      = await fetchQuoteSummary(ticker)
    const profile = qs.assetProfile
    const price   = qs.price
    return NextResponse.json(
      {
        ticker,
        name: price?.longName ?? price?.shortName ?? ticker,
        sector: profile?.sector ?? null,
        industry: profile?.industry ?? null,
        exchange: price?.exchange ?? null,
        quoteType: price?.quoteType ?? null,
      },
      { headers: { 'Cache-Control': 'public, max-age=3600' } }
    )
  } catch {
    try {
      const hit = await fetchYfSearch(ticker)
      return NextResponse.json(
        {
          ticker,
          name: hit.longname ?? hit.shortname ?? ticker,
          sector: hit.sector ?? null,
          industry: hit.industry ?? null,
          exchange: hit.exchange ?? null,
          quoteType: hit.quoteType ?? null,
        },
        { headers: { 'Cache-Control': 'public, max-age=3600' } }
      )
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  }
}
