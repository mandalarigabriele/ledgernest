import { NextRequest, NextResponse } from 'next/server'

export interface TickerSuggestion {
  symbol:   string   // Yahoo Finance symbol (e.g. NEXI.MI)
  tvSymbol: string   // TradingView symbol   (e.g. MIL:NEXI)
  name:     string
  exchange: string
  type:     'stock' | 'etf' | 'crypto' | 'other'
}

const TYPE_MAP: Record<string, TickerSuggestion['type']> = {
  EQUITY:         'stock',
  ETF:            'etf',
  CRYPTOCURRENCY: 'crypto',
}

// Yahoo Finance exchangeName → TradingView exchange prefix
// Only exchanges TV actually supports — anything not listed is filtered out
const YF_EXCHANGE_TO_TV: Record<string, string> = {
  // USA
  NMS: 'NASDAQ', NMM: 'NASDAQ', NCM: 'NASDAQ', NGM: 'NASDAQ',
  NYQ: 'NYSE',   NYS: 'NYSE',
  PCX: 'AMEX',   ASE: 'AMEX',   NYSEArca: 'AMEX',
  // Europe
  MIL: 'MIL',        // Italy (Borsa Italiana)
  LSE: 'LSE',        // UK
  GER: 'XETRA',      XETR: 'XETRA',   // Germany
  PAR: 'EURONEXT',   AMS: 'EURONEXT',  BRU: 'EURONEXT',  // Euronext
  MCE: 'BME',        // Spain
  STO: 'OMX',        // Sweden
  HEL: 'OMXHEX',     // Finland
  OSL: 'OSL',        // Norway
  CPH: 'OMXCOP',     // Denmark
  // Americas
  TOR: 'TSX',    VAN: 'TSXV',
  SAO: 'BMFBOVESPA',
  // Asia-Pacific
  HKG: 'HKEX',
  TYO: 'TSE',
  SES: 'SGX',
  ASX: 'ASX',
  // Crypto (Yahoo uses CCC)
  CCC: 'BINANCE',
}

// Yahoo Finance ".SUFFIX" format → TV exchange (for symbols like NEXI.MI)
const YF_SUFFIX_TO_TV: Record<string, string> = {
  MI: 'MIL',   L: 'LSE',   DE: 'XETRA',
  PA: 'EURONEXT', AS: 'EURONEXT', BR: 'EURONEXT',
  MC: 'BME',   ST: 'OMX',  HE: 'OMXHEX', OL: 'OSL',
  TO: 'TSX',   V:  'TSXV', AX: 'ASX',
  HK: 'HKEX',  T:  'TSE',
}


async function existsOnTV(tvSymbol: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(tvSymbol)}&fields=description`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Origin':  'https://www.tradingview.com',
          'Referer': 'https://www.tradingview.com/',
        },
        next:   { revalidate: 3600 },
        signal: AbortSignal.timeout(600),   // fast: if TV doesn't answer in 600ms, allow through
      }
    )
    return res.ok
  } catch {
    return true  // timeout/network error → don't hide the result
  }
}

function buildTvSymbol(yfSymbol: string, yfExchange: string): string | null {
  const upper  = yfSymbol.toUpperCase()
  const dotIdx = upper.lastIndexOf('.')

  if (dotIdx > 0) {
    // Symbol has a suffix (NEXI.MI → base=NEXI, suffix=MI)
    const base   = upper.slice(0, dotIdx)
    const suffix = upper.slice(dotIdx + 1)
    const tv     = YF_SUFFIX_TO_TV[suffix]
    return tv ? `${tv}:${base}` : null
  }

  // No suffix — use exchangeName mapping
  const tv = YF_EXCHANGE_TO_TV[yfExchange]
  return tv ? `${tv}:${upper}` : null
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) return NextResponse.json([])

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false&showTrendingTickers=false`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LedgerNest/1.0)' },
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error(`YF ${res.status}`)

    const json = await res.json() as {
      quotes?: Array<{
        symbol:     string
        shortname?: string
        longname?:  string
        exchange?:  string
        quoteType?: string
      }>
    }

    const candidates: TickerSuggestion[] = []
    const ALLOWED_TYPES = new Set(['EQUITY', 'ETF', 'CRYPTOCURRENCY'])

    for (const c of json.quotes ?? []) {
      if (!c.symbol) continue
      if (!ALLOWED_TYPES.has(c.quoteType ?? '')) continue

      let tvSymbol: string | null

      if (c.quoteType === 'CRYPTOCURRENCY') {
        // Yahoo: BTC-USD, ETH-USD → TV: COINBASE:BTCUSD, COINBASE:ETHUSD
        const base = c.symbol.replace(/-USD.*$/i, '').replace(/-USDT.*$/i, '')
        tvSymbol = `COINBASE:${base}USD`
      } else {
        tvSymbol = buildTvSymbol(c.symbol, c.exchange ?? '')
      }

      if (!tvSymbol) continue

      candidates.push({
        symbol:   c.symbol,
        tvSymbol,
        name:     c.longname ?? c.shortname ?? c.symbol,
        exchange: c.exchange ?? '',
        type:     TYPE_MAP[c.quoteType ?? ''] ?? 'other',
      })
    }

    // Validate in parallel with a short timeout — invalid symbols (404) are removed
    const validated = await Promise.all(
      candidates.slice(0, 8).map(async (c) => (await existsOnTV(c.tvSymbol) ? c : null))
    )

    return NextResponse.json(validated.filter(Boolean).slice(0, 6))
  } catch {
    return NextResponse.json([])
  }
}
