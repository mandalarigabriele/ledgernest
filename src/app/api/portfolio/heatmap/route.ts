import { NextResponse } from 'next/server'
import { fetchHistory } from '@/lib/services/yahooFinance'
import { yahooToCgId, fetchCryptoHistory } from '@/lib/services/coinGecko'

interface InputPosition {
  ticker: string
  type: 'stock' | 'etf' | 'crypto'
  quantity: number
  currency: string
  purchaseDate: string  // "YYYY-MM-DD"
}

function buildMonthKeys(n: number): string[] {
  const now = new Date()
  const keys: string[] = []
  for (let i = n; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

// Last close price per YYYY-MM from a daily candle series
function monthlyCloses(points: { date: string; close: number }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of points) map.set(p.date.slice(0, 7), p.close)
  return map
}

interface TickerData { returns: number[]; weights: number[] }

// Standard calendar M/M returns, weighted by value (qty × prev_close).
// Months before purchaseYM get weight 0 (not invested yet).
// Purchase month and all later months use the previous month's end-of-month close
// as the opening reference — same as Bloomberg/Morningstar convention.
function computeTickerData(
  closes: Map<string, number>,
  keys: string[],
  purchaseYM: string,
  quantity: number,
): TickerData {
  const returns: number[] = []
  const weights: number[] = []

  for (let i = 0; i < keys.length - 1; i++) {
    const prevYM = keys[i]
    const currYM = keys[i + 1]

    if (currYM < purchaseYM) {
      // Not yet invested in this period
      returns.push(0)
      weights.push(0)
    } else {
      // Purchase month and onwards: standard M/M from prev-month close
      const curr = closes.get(currYM)
      const prev = closes.get(prevYM)
      if (curr && prev && prev > 0) {
        returns.push(+((curr / prev - 1) * 100).toFixed(1))
        weights.push(quantity * prev)
      } else {
        returns.push(0)
        weights.push(0)
      }
    }
  }

  return { returns, weights }
}

// Value-weighted aggregate across tickers for each month independently
function aggregateWeighted(data: TickerData[]): number[] {
  if (data.length === 0) return Array(12).fill(0)
  const len = data[0].returns.length
  return Array.from({ length: len }, (_, i) => {
    const totalWeight = data.reduce((s, d) => s + d.weights[i], 0)
    if (totalWeight === 0) return 0
    const weightedSum = data.reduce((s, d) => s + d.returns[i] * d.weights[i], 0)
    return +((weightedSum / totalWeight).toFixed(1))
  })
}

// Fetch with one retry on 429 rate-limit (waits 1s before retrying)
async function fetchCryptoHistoryWithRetry(cgId: string, days: number) {
  try {
    return await fetchCryptoHistory(cgId, days)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('429')) {
      await new Promise((r) => setTimeout(r, 1200))
      return await fetchCryptoHistory(cgId, days)
    }
    throw e
  }
}

export async function POST(req: Request) {
  const { positions }: { positions: InputPosition[] } = await req.json()

  const keys   = buildMonthKeys(12)
  const months = keys.slice(1).map((ym) => {
    const [y, m] = ym.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')
  })

  const byClass: Record<string, InputPosition[]> = { stock: [], etf: [], crypto: [] }
  for (const p of positions) byClass[p.type]?.push(p)

  // ── Stocks + ETF (parallel, Yahoo Finance) ───────────────────
  async function classReturnsYahoo(cls: 'stock' | 'etf'): Promise<number[]> {
    const pos = byClass[cls]
    if (pos.length === 0) return Array(12).fill(0)

    const results = await Promise.allSettled(pos.map((p) => fetchHistory(p.ticker, '1y')))
    const data: TickerData[] = []

    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status !== 'fulfilled') continue
      const closes     = monthlyCloses(r.value.candles)
      const purchaseYM = pos[i].purchaseDate.slice(0, 7)
      data.push(computeTickerData(closes, keys, purchaseYM, pos[i].quantity))
    }

    return aggregateWeighted(data)
  }

  // ── Crypto (sequential to avoid CoinGecko rate limits) ───────
  async function classReturnsCrypto(): Promise<number[]> {
    const pos = byClass['crypto']
    if (pos.length === 0) return Array(12).fill(0)

    const data: TickerData[] = []

    for (let i = 0; i < pos.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 600)) // throttle
      try {
        const cgId = yahooToCgId(pos[i].ticker)
        if (!cgId) continue
        const pts    = await fetchCryptoHistoryWithRetry(cgId, 365)
        const candles = pts.map((pt) => ({
          date:  new Date(pt.timestamp).toISOString().slice(0, 10),
          close: pt.price,
        }))
        const closes     = monthlyCloses(candles)
        const purchaseYM = pos[i].purchaseDate.slice(0, 7)
        data.push(computeTickerData(closes, keys, purchaseYM, pos[i].quantity))
      } catch { /* skip this ticker */ }
    }

    return aggregateWeighted(data)
  }

  const [stockR, etfR, cryptoR] = await Promise.all([
    classReturnsYahoo('stock'),
    classReturnsYahoo('etf'),
    classReturnsCrypto(),
  ])

  return NextResponse.json({ data: [stockR, etfR, cryptoR], months })
}
