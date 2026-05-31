import { NextRequest, NextResponse } from 'next/server'

// Yahoo Finance ".SUFFIX" → TradingView exchange hint for the TV search query
const YF_SUFFIX_EXCHANGE: Record<string, string> = {
  MI: 'MIL', L: 'LSE', DE: 'XETRA', PA: 'EURONEXT', AS: 'EURONEXT',
  BR: 'EURONEXT', MC: 'BME', ST: 'OMX', HE: 'OMXHEX', OL: 'OSL',
  TO: 'TSX', V: 'TSXV', AX: 'ASX', NZ: 'NZX', HK: 'HKEX',
  T: 'TSE', SS: 'SSE', SZ: 'SZSE', NS: 'NSE', BO: 'BSE',
  SA: 'BMFBOVESPA', MX: 'BMV',
}

interface TVSymbol {
  symbol:      string
  prefix:      string
  description: string
  type:        string
}

async function resolveViaTradingView(baseSymbol: string, exchangeHint: string): Promise<string | null> {
  const url = `https://symbol-search.tradingview.com/symbol_search/v3/?text=${encodeURIComponent(baseSymbol)}&exchange=${encodeURIComponent(exchangeHint)}&lang=en&search_type=undefined&domain=production`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LedgerNest/1.0)' },
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null

  const json = await res.json() as { symbols?: TVSymbol[] }
  const symbols = json.symbols ?? []

  // prefer exact symbol match; fall back to first result
  const match =
    symbols.find((s) => s.symbol.toUpperCase() === baseSymbol) ??
    symbols[0]

  return match ? `${match.prefix}:${match.symbol}` : null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const raw = params.symbol.toUpperCase()

  // Split Yahoo-format "BASE.SUFFIX" (e.g. NEXI.MI → base=NEXI, hint=MIL)
  const dotIdx = raw.lastIndexOf('.')
  const base   = dotIdx > 0 ? raw.slice(0, dotIdx) : raw
  const suffix = dotIdx > 0 ? raw.slice(dotIdx + 1) : ''
  const hint   = YF_SUFFIX_EXCHANGE[suffix] ?? ''

  try {
    const tvSymbol = await resolveViaTradingView(base, hint)
    if (tvSymbol) return NextResponse.json({ tvSymbol })
  } catch {}

  // Fallback: return base symbol as-is so the page still renders
  return NextResponse.json({ tvSymbol: base })
}
