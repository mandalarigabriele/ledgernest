import { NextRequest, NextResponse } from 'next/server'
import { CG_ID_MAP } from '@/lib/services/coinGecko'

const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; LedgerNest/1.0)' }
const CG_HEADERS = { Accept: 'application/json' }
const CG_BASE = 'https://api.coingecko.com/api/v3'

// ── CoinGecko crypto search ───────────────────────────────────

interface CgCoin {
  id: string
  name: string
  symbol: string
  market_cap_rank: number | null
}

async function searchCoinGecko(q: string) {
  const res = await fetch(
    `${CG_BASE}/search?query=${encodeURIComponent(q)}`,
    { headers: CG_HEADERS, next: { revalidate: 0 } }
  )
  if (!res.ok) return []
  const data = await res.json() as { coins?: CgCoin[] }
  return (data.coins ?? [])
    .sort((a, b) => (a.market_cap_rank ?? 9999) - (b.market_cap_rank ?? 9999))
    .slice(0, 7)
    .map((c) => ({
      ticker: `${c.symbol.toUpperCase()}-USD`,
      name: c.name,
      quoteType: 'CRYPTOCURRENCY',
      exchange: c.market_cap_rank ? `#${c.market_cap_rank} market cap` : 'CoinGecko',
      cgId: c.id,
    }))
}

// ── Yahoo Finance stock/ETF search ────────────────────────────

async function searchYahoo(q: string) {
  const url =
    `https://query1.finance.yahoo.com/v1/finance/search` +
    `?q=${encodeURIComponent(q)}&quotesCount=7&newsCount=0&enableFuzzyQuery=false`
  const res = await fetch(url, { headers: YF_HEADERS, next: { revalidate: 0 } })
  if (!res.ok) return []
  const json = await res.json() as {
    quotes?: Array<{
      symbol?: string
      shortname?: string
      longname?: string
      quoteType?: string
      exchange?: string
    }>
  }
  return (json.quotes ?? [])
    .filter((q) => q.symbol && q.quoteType !== 'MUTUALFUND' && q.quoteType !== 'FUTURE')
    .slice(0, 7)
    .map((q) => ({
      ticker: q.symbol!,
      name: q.longname ?? q.shortname ?? q.symbol!,
      quoteType: q.quoteType ?? 'EQUITY',
      exchange: q.exchange ?? '',
    }))
}

// ── handler ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const q    = req.nextUrl.searchParams.get('q')?.trim()
  const type = req.nextUrl.searchParams.get('type')

  if (!q || q.length < 1) return NextResponse.json([])

  try {
    if (type === 'crypto') {
      const results = await searchCoinGecko(q)

      // Mark coins that are in our CG_ID_MAP (prices guaranteed via CoinGecko)
      // Coins outside the map still appear but will use Yahoo Finance as price fallback
      const withSupport = results.map((r) => {
        const sym = r.ticker.replace(/-USD$/, '')
        return { ...r, supported: sym in CG_ID_MAP }
      })

      return NextResponse.json(withSupport)
    }

    return NextResponse.json(await searchYahoo(q))
  } catch {
    return NextResponse.json([])
  }
}
