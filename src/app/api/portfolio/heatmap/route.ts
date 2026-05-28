import { NextResponse } from 'next/server'
import { fetchHistory } from '@/lib/services/yahooFinance'
import { yahooToCgId, fetchCryptoHistory } from '@/lib/services/coinGecko'

interface InputPosition {
  ticker: string
  type: 'stock' | 'etf' | 'crypto'
  quantity: number
  currency: string
}

// Build the last N+1 month keys needed to compute N monthly returns
function buildMonthKeys(n: number): string[] {
  const now = new Date()
  const keys: string[] = []
  for (let i = n; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys // length = n+1
}

// Last close price per YYYY-MM from a sorted daily series
function monthlyCloses(points: { date: string; close: number }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of points) map.set(p.date.slice(0, 7), p.close)
  return map
}

// Month-over-month % returns for each of the 12 return months (keys[1..12])
function monthlyReturns(closes: Map<string, number>, keys: string[]): number[] {
  return keys.slice(1).map((ym, i) => {
    const curr = closes.get(ym)
    const prev = closes.get(keys[i])
    if (!curr || !prev || prev === 0) return 0
    return +((curr / prev - 1) * 100).toFixed(1)
  })
}

// Equal-weighted average of per-ticker return arrays; missing months → 0
function avgReturns(allReturns: number[][]): number[] {
  if (allReturns.length === 0) return Array(12).fill(0)
  const len = allReturns[0].length
  return Array.from({ length: len }, (_, i) => {
    const vals = allReturns.map((r) => r[i])
    return +((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
  })
}

export async function POST(req: Request) {
  const { positions }: { positions: InputPosition[] } = await req.json()

  const keys = buildMonthKeys(12) // 13 keys → 12 returns

  // Return month labels for display
  const months = keys.slice(1).map((ym) => {
    const [y, m] = ym.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')
  })

  const byClass: Record<string, InputPosition[]> = { stock: [], etf: [], crypto: [] }
  for (const p of positions) byClass[p.type]?.push(p)

  // ── Stocks + ETF (Yahoo Finance daily → extract monthly closes) ──────────
  async function classReturnsYahoo(cls: 'stock' | 'etf'): Promise<number[]> {
    const tickers = byClass[cls].map((p) => p.ticker)
    if (tickers.length === 0) return Array(12).fill(0)
    const results = await Promise.allSettled(tickers.map((t) => fetchHistory(t, '1y')))
    const allR: number[][] = []
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      const closes = monthlyCloses(r.value.candles)
      allR.push(monthlyReturns(closes, keys))
    }
    return avgReturns(allR)
  }

  // ── Crypto (CoinGecko 365-day daily) ────────────────────────────────────
  async function classReturnsCrypto(): Promise<number[]> {
    const tickers = byClass['crypto']
    if (tickers.length === 0) return Array(12).fill(0)
    const results = await Promise.allSettled(
      tickers.map(async (p) => {
        const cgId = yahooToCgId(p.ticker)
        if (!cgId) throw new Error(`Unknown crypto: ${p.ticker}`)
        const pts = await fetchCryptoHistory(cgId, 365)
        return pts.map((pt) => ({
          date: new Date(pt.timestamp).toISOString().slice(0, 10),
          close: pt.price,
        }))
      })
    )
    const allR: number[][] = []
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      const closes = monthlyCloses(r.value)
      allR.push(monthlyReturns(closes, keys))
    }
    return avgReturns(allR)
  }

  const [stockR, etfR, cryptoR] = await Promise.all([
    classReturnsYahoo('stock'),
    classReturnsYahoo('etf'),
    classReturnsCrypto(),
  ])

  return NextResponse.json({ data: [stockR, etfR, cryptoR], months })
}
