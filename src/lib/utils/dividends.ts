import type { Dividend, PortfolioPosition } from '@/types'
import type { Trade } from '@/types'

export const ACC_TICKERS = new Set(['VWCE', 'IWDA', 'CSPX', 'EUNL', 'SWRD', 'IUSQ', 'SPYL', 'LCUW'])

export function toYMD(d: Date) { return d.toISOString().slice(0, 10) }
export function addMonths(d: Date, m: number) {
  const r = new Date(d); r.setMonth(r.getMonth() + m); return r
}

export interface DivRow {
  pos: PortfolioPosition
  recentDivs: Dividend[]
  annualIncome: number
  perShareAnnual: number
  yieldPct: number
  freq: string
  freqMonths: number
  nextDate: string | null
  lastDivAmtEur: number
  status: 'confermato' | 'stimato' | 'reinvestito'
}

export function computeDivRows(
  positions: PortfolioPosition[],
  dividends: Dividend[],
  trades: Trade[],
  eurUsd: number
): DivRow[] {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const oneYearAgo = addMonths(now, -12)

  return positions
    .filter(p => p.type !== 'crypto')
    .map((pos): DivRow => {
      const isAcc = pos.type === 'etf' && (
        ACC_TICKERS.has(pos.ticker) ||
        (pos.ticker.endsWith('C') && pos.type === 'etf') ||
        pos.name?.toLowerCase().includes(' acc')
      )
      if (isAcc) return {
        pos, recentDivs: [], annualIncome: 0, perShareAnnual: 0,
        yieldPct: 0, freq: 'acc', freqMonths: 0, nextDate: null, lastDivAmtEur: 0, status: 'reinvestito',
      }

      const posTrades = trades.filter(t => t.positionId === pos.id && t.type === 'buy')
      const purchaseDate = posTrades.length > 0
        ? [...posTrades].sort((a, b) => a.date.localeCompare(b.date))[0].date
        : pos.createdAt.slice(0, 10)

      const posDivs = dividends.filter(d => d.positionId === pos.id)
      const sortedAll = [...posDivs].sort((a, b) => b.payDate.localeCompare(a.payDate))
      const lastDiv = sortedAll[0]

      const twoYearsAgo = addMonths(now, -24)
      const last2y = posDivs.filter(d => new Date(d.payDate) >= twoYearsAgo)
      const nPerYear = Math.round(last2y.length / 2)
      let freq = 'ann'; let freqMonths = 12
      if (nPerYear >= 10) { freq = 'mens'; freqMonths = 1 }
      else if (nPerYear >= 3) { freq = 'trim'; freqMonths = 3 }
      else if (nPerYear >= 2) { freq = 'sem'; freqMonths = 6 }

      let nextDate: string | null = null
      let status: DivRow['status'] = 'stimato'

      if (lastDiv && freqMonths > 0) {
        let next = addMonths(new Date(lastDiv.payDate), freqMonths)
        while (next <= now) next = addMonths(next, freqMonths)
        nextDate = toYMD(next)
      }

      const futureDivs = posDivs.filter(d => new Date(d.payDate) > now)
      if (futureDivs.length > 0) {
        const nearest = futureDivs.sort((a, b) => a.payDate.localeCompare(b.payDate))[0]
        nextDate = nearest.payDate
        status = 'confermato'
      }

      const receivedDivs = posDivs.filter(d => d.exDate >= purchaseDate && new Date(d.payDate) <= now)
      const recentDivs = receivedDivs.filter(d => new Date(d.payDate) >= oneYearAgo)

      const toEur = (d: Dividend) => d.currency === 'EUR' ? d.amount : d.amount / eurUsd

      let annualIncome: number
      if (recentDivs.length > 0) {
        annualIncome = recentDivs.reduce((s, d) => s + toEur(d), 0)
      } else {
        const paymentsPerYear = freqMonths > 0 ? Math.round(12 / freqMonths) : 1
        const histSlice = sortedAll.slice(0, Math.max(paymentsPerYear, 1))
        annualIncome = histSlice.reduce((s, d) => s + toEur(d), 0)
      }
      const perShareAnnual = pos.quantity > 0 ? annualIncome / pos.quantity : 0
      const posValEur = pos.currency === 'EUR'
        ? pos.avgPrice * pos.quantity
        : pos.avgPrice * pos.quantity / eurUsd
      const yieldPct = posValEur > 0 ? (annualIncome / posValEur) * 100 : 0

      const confirmedFuture = futureDivs.length > 0
        ? futureDivs.sort((a, b) => a.payDate.localeCompare(b.payDate))[0]
        : null
      const lastHistorical = posDivs
        .filter(d => new Date(d.payDate) <= now)
        .sort((a, b) => b.payDate.localeCompare(a.payDate))[0]
      const nextCouponDiv = confirmedFuture ?? lastHistorical
      const lastDivAmtEur = nextCouponDiv ? toEur(nextCouponDiv) : 0

      return { pos, recentDivs, annualIncome, perShareAnnual, yieldPct, freq, freqMonths, nextDate, lastDivAmtEur, status }
    })
    .filter(r => r.recentDivs.length > 0 || r.nextDate !== null || r.status === 'reinvestito')
}
