import type { Quote, OHLCCandle, PriceHistory } from '@/types'

const BASE = 'https://query1.finance.yahoo.com'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; LedgerNest/1.0)' }

// Yahoo Finance v8 chart API
async function fetchChart(ticker: string, range = '5d', interval = '1d', includePrePost = false) {
  const url = `${BASE}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}${includePrePost ? '&includePrePost=true' : ''}`
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`YF ${ticker}: ${res.status}`)
  const json = await res.json() as {
    chart: { result: Array<{
      meta: Record<string, unknown>
      timestamp?: number[]
      indicators?: { quote?: Array<Record<string, number[]>> }
    }> | null; error?: unknown }
  }
  if (json.chart.error || !json.chart.result?.length) throw new Error(`YF ${ticker}: no data`)
  return json.chart.result[0]
}

export async function fetchQuotes(tickers: string[]): Promise<Quote[]> {
  if (!tickers || tickers.length === 0) return []

  // Fonte primaria: v8 chart API (affidabile, per-ticker)
  const settled = await Promise.allSettled(
    tickers.map(async (ticker): Promise<Quote | null> => {
      try {
        const result = await fetchChart(ticker, '2d', '1d')
        const meta = result.meta
        const q = result.indicators?.quote?.[0]
        const closes = q?.close ?? []
        const lastIdx = closes.length - 1
        const price = (meta.regularMarketPrice as number) ?? closes[lastIdx] ?? 0
        const prevClose = (closes.length >= 2 && closes[0] != null)
          ? (closes[0] as number)
          : (meta.chartPreviousClose as number) ?? 0
        const change = prevClose ? price - prevClose : 0
        const changePct = prevClose ? (change / prevClose) * 100 : 0

        // Controlla currentTradingPeriod (sempre presente) per PM/AH — non usare marketState (spesso undefined)
        const cp = meta.currentTradingPeriod as { pre?: { start: number; end: number }; post?: { start: number; end: number } } | undefined
        const now = Math.floor(Date.now() / 1000)
        const inExtended = (cp?.pre && now >= cp.pre.start && now < cp.pre.end) ||
                           (cp?.post && now >= cp.post.start && now < cp.post.end)
        const extended = inExtended ? await fetchExtendedPrice(ticker) : {}

        return {
          ticker: (meta.symbol as string) ?? ticker,
          price,
          change,
          changePct,
          high: (meta.regularMarketDayHigh as number) ?? (q?.high?.[lastIdx] ?? 0),
          low: (meta.regularMarketDayLow as number) ?? (q?.low?.[lastIdx] ?? 0),
          open: q?.open?.[lastIdx] ?? 0,
          prevClose,
          volume: (meta.regularMarketVolume as number) ?? (q?.volume?.[lastIdx] ?? 0),
          currency: (meta.currency as string) ?? 'USD',
          name: (meta.longName as string) ?? (meta.shortName as string) ?? ticker,
          exchange: meta.fullExchangeName as string | undefined,
          timestamp: Date.now(),
          ...extended,
        }
      } catch {
        return null
      }
    })
  )

  const quotes = settled
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value)

  return quotes
}

// Legge il prezzo pre/after-hours dalla chart 1m con includePrePost=true
async function fetchExtendedPrice(ticker: string): Promise<{ preMarket?: number; postMarket?: number; preMarketChange?: number; preMarketChangePct?: number; postMarketChange?: number; postMarketChangePct?: number }> {
  try {
    const result = await fetchChart(ticker, '1d', '1m', true)
    const meta = result.meta
    const timestamps = result.timestamp ?? []
    const closes = result.indicators?.quote?.[0]?.close ?? []
    const cp = meta.currentTradingPeriod as { pre?: { start: number; end: number }; post?: { start: number; end: number } } | undefined
    const now = Math.floor(Date.now() / 1000)

    const lastInWindow = (start: number, end: number) => {
      for (let i = timestamps.length - 1; i >= 0; i--) {
        if (timestamps[i] >= start && timestamps[i] < end && closes[i] != null) return closes[i]
      }
      return undefined
    }

    const prevClose = (meta.chartPreviousClose as number) ?? 0

    if (cp?.pre && now >= cp.pre.start && now < cp.pre.end) {
      const pm = lastInWindow(cp.pre.start, cp.pre.end)
      const change = pm && prevClose ? pm - prevClose : undefined
      const changePct = change != null && prevClose ? (change / prevClose) * 100 : undefined
      return { preMarket: pm, preMarketChange: change, preMarketChangePct: changePct }
    }
    if (cp?.post && now >= cp.post.start && now < cp.post.end) {
      const regClose = (meta.regularMarketPrice as number) ?? prevClose
      const pm = lastInWindow(cp.post.start, cp.post.end)
      const change = pm && regClose ? pm - regClose : undefined
      const changePct = change != null && regClose ? (change / regClose) * 100 : undefined
      return { postMarket: pm, postMarketChange: change, postMarketChangePct: changePct }
    }
  } catch { /* ignore */ }
  return {}
}

export async function fetchHistory(
  ticker: string,
  period: '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' = '1y'
): Promise<PriceHistory> {
  const intervalMap: Record<string, '1d' | '1wk' | '1mo'> = {
    '1mo': '1d', '3mo': '1d', '6mo': '1d',
    '1y': '1d', '2y': '1wk', '5y': '1mo',
  }
  const interval = intervalMap[period] ?? '1d'
  const rangeMap: Record<string, string> = {
    '1mo': '1mo', '3mo': '3mo', '6mo': '6mo',
    '1y': '1y', '2y': '2y', '5y': '5y',
  }
  const range = rangeMap[period] ?? '1y'

  try {
    const result = await fetchChart(ticker, range, interval)
    const timestamps = result.timestamp ?? []
    const q = result.indicators?.quote?.[0] ?? {}

    const candles: OHLCCandle[] = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        open: q.open?.[i] ?? 0,
        high: q.high?.[i] ?? 0,
        low: q.low?.[i] ?? 0,
        close: q.close?.[i] ?? 0,
        volume: q.volume?.[i] ?? 0,
      }))
      .filter((c) => c.close > 0)

    return { ticker, interval, candles }
  } catch {
    return { ticker, interval, candles: [] }
  }
}

export async function fetchEurUsd(): Promise<number> {
  try {
    const result = await fetchChart('EURUSD=X', '5d', '1d')
    const price = result.meta.regularMarketPrice as number
    if (price) return price
  } catch {}

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD')
    const json = await res.json() as { rates?: { USD?: number } }
    return json?.rates?.USD ?? 1.08
  } catch {
    return 1.08
  }
}
