import { NextRequest, NextResponse } from 'next/server'

const BASE = 'https://query1.finance.yahoo.com'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; LedgerNest/1.0)' }

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')
  if (!ticker) return NextResponse.json({ error: 'missing ticker' }, { status: 400 })

  try {
    const url = `${BASE}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=3mo&range=10y&events=div`
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`YF ${res.status}`)

    const json = await res.json() as {
      chart: {
        result: Array<{
          meta: { currency?: string }
          events?: { dividends?: Record<string, { amount: number; date: number }> }
        }> | null
      }
    }

    const result = json.chart.result?.[0]
    if (!result) return NextResponse.json({ dividends: [], currency: 'USD' })

    const currency = (result.meta.currency ?? 'USD') as string
    const rawDivs = result.events?.dividends ?? {}

    const dividends = Object.values(rawDivs)
      .map(({ amount, date }) => {
        const exDate = new Date(date * 1000).toISOString().slice(0, 10)
        const pay = new Date(date * 1000)
        pay.setDate(pay.getDate() + 21)
        return { exDate, payDate: pay.toISOString().slice(0, 10), amount: Math.round(amount * 10000) / 10000, currency }
      })
      .sort((a, b) => a.exDate.localeCompare(b.exDate))

    return NextResponse.json({ dividends, currency })
  } catch (e) {
    return NextResponse.json({ error: String(e), dividends: [], currency: 'USD' }, { status: 200 })
  }
}
