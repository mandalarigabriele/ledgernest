import type { Quote } from '@/types'

const CG_BASE = 'https://api.coingecko.com/api/v3'
const HEADERS = { Accept: 'application/json' }

// Map from base symbol to CoinGecko coin ID
export const CG_ID_MAP: Record<string, string> = {
  BTC:    'bitcoin',
  ETH:    'ethereum',
  SOL:    'solana',
  BNB:    'binancecoin',
  XRP:    'ripple',
  ADA:    'cardano',
  DOT:    'polkadot',
  LINK:   'chainlink',
  AVAX:   'avalanche-2',
  MATIC:  'matic-network',
  POL:    'matic-network',
  USDC:   'usd-coin',
  USDT:   'tether',
  DAI:    'dai',
  UNI:    'uniswap',
  ATOM:   'cosmos',
  LTC:    'litecoin',
  BCH:    'bitcoin-cash',
  ALGO:   'algorand',
  XLM:    'stellar',
  DOGE:   'dogecoin',
  SHIB:   'shiba-inu',
  NEAR:   'near',
  ICP:    'internet-computer',
  FIL:    'filecoin',
  VET:    'vechain',
  TRX:    'tron',
  ETC:    'ethereum-classic',
  HBAR:   'hedera-hashgraph',
  APT:    'aptos',
  ARB:    'arbitrum',
  OP:     'optimism',
  SUI:    'sui',
  TON:    'the-open-network',
  INJ:    'injective-protocol',
  SEI:    'sei-network',
  WLD:    'worldcoin-wld',
  RENDER: 'render-token',
  FET:    'fetch-ai',
  GRT:    'the-graph',
  SAND:   'the-sandbox',
  MANA:   'decentraland',
  AXS:    'axie-infinity',
  CRV:    'curve-dao-token',
  AAVE:   'aave',
  MKR:    'maker',
  LDO:    'lido-dao',
  RPL:    'rocket-pool',
  PEPE:   'pepe',
  FLOKI:  'floki',
  BONK:   'bonk',
  WIF:    'dogwifcoin',
  JUP:    'jupiter-exchange-solana',
  PYTH:   'pyth-network',
}

/** Convert Yahoo-style ticker (BTC-USD, ETH-EUR) to CoinGecko coin ID */
export function yahooToCgId(ticker: string): string | null {
  const base = ticker.replace(/-USD$|-EUR$|-GBP$|-USDT$/, '').toUpperCase()
  return CG_ID_MAP[base] ?? null
}

/** Returns true if a ticker maps to a known crypto on CoinGecko */
export function isCryptoTicker(ticker: string): boolean {
  return yahooToCgId(ticker) !== null
}

interface CgMarket {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_24h: number
  price_change_percentage_24h: number
  high_24h: number
  low_24h: number
  market_cap: number
  total_volume: number
  sparkline_in_7d?: { price: number[] }
}

/**
 * Fetch live quotes for the given Yahoo-format crypto tickers from CoinGecko.
 * Returns Quote objects with currency='USD' and sparkline populated.
 * priceEur is intentionally omitted (added downstream by the prices route).
 */
export async function fetchCryptoQuotes(yahooTickers: string[]): Promise<Quote[]> {
  if (yahooTickers.length === 0) return []

  // Build ticker→cgId mapping (deduplicate cgIds for the API call)
  const mapping: { yahoo: string; cgId: string }[] = []
  for (const t of yahooTickers) {
    const cgId = yahooToCgId(t)
    if (cgId) mapping.push({ yahoo: t, cgId })
  }
  if (mapping.length === 0) return []

  const ids = Array.from(new Set(mapping.map((m) => m.cgId))).join(',')
  const url =
    `${CG_BASE}/coins/markets?vs_currency=usd&ids=${ids}` +
    `&order=market_cap_desc&per_page=250&sparkline=true`

  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`CoinGecko /markets: ${res.status}`)

  const markets: CgMarket[] = await res.json()
  const byId = new Map(markets.map((m) => [m.id, m]))

  return mapping
    .map(({ yahoo, cgId }): Quote | null => {
      const m = byId.get(cgId)
      if (!m) return null
      const prevClose = m.current_price - (m.price_change_24h ?? 0)
      return {
        ticker: yahoo,
        price: m.current_price ?? 0,
        change: m.price_change_24h ?? 0,
        changePct: m.price_change_percentage_24h ?? 0,
        high: m.high_24h ?? 0,
        low: m.low_24h ?? 0,
        open: prevClose,
        prevClose,
        volume: m.total_volume ?? 0,
        marketCap: m.market_cap ?? 0,
        currency: 'USD',
        name: m.name,
        timestamp: Date.now(),
        sparkline: m.sparkline_in_7d?.price,
      }
    })
    .filter((q): q is Quote => q !== null)
}

/**
 * Fetch historical price series from CoinGecko for a given coin ID.
 * Returns [timestamp_ms, price_usd] pairs.
 * Granularity: 1d→5min, 2-90d→hourly, 91d+→daily (CoinGecko free tier).
 */
export async function fetchCryptoHistory(
  cgId: string,
  days: number
): Promise<{ timestamp: number; price: number }[]> {
  const url = `${CG_BASE}/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`CoinGecko /market_chart (${cgId}, ${days}d): ${res.status}`)
  const data: { prices: [number, number][] } = await res.json()
  return data.prices.map(([ts, price]) => ({ timestamp: ts, price }))
}
