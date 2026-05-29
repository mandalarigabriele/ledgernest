'use client'

import { useMemo } from 'react'
import { usePortfolioSnapshotStore } from '@/stores/portfolioSnapshotStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePricesStore } from '@/stores/pricesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { effectivePriceEur } from '@/lib/utils/price'

export type Timeframe = '1G' | '1S' | '1M' | '1A' | 'MAX'

const DAYS_MAP: Record<Timeframe, number> = {
  '1G': 1,
  '1S': 7,
  '1M': 30,
  '1A': 365,
  'MAX': 9999,
}

export const ALL_TIMEFRAMES: Timeframe[] = ['1G', '1S', '1M', '1A', 'MAX']

export interface ChartPoint {
  date: string
  value: number
  invested: number
}

export type AssetFilter = 'all' | 'stocks' | 'etf' | 'crypto' | 'commodity'

export interface PortfolioChartData {
  points: ChartPoint[]
  currentValue: number
  totalInvested: number
  gainAbs: number
  gainPct: number
  availableTimeframes: Timeframe[]
}

// AssetFilter uses plural ('stocks') but p.type uses singular ('stock')
const FILTER_TO_TYPE: Record<string, string> = {
  stocks: 'stock',
  etf: 'etf',
  crypto: 'crypto',
  commodity: 'commodity',
}

export function usePortfolioChart(timeframe: Timeframe, filter: AssetFilter = 'all'): PortfolioChartData {
  const { snapshots, oldestTs } = usePortfolioSnapshotStore()
  const { positions } = usePortfolioStore()
  const { quotes, eurUsd } = usePricesStore()
  const showPrePostMarket = useSettingsStore((s) => s.settings.showPrePostMarket)

  // Compute live value as scalar numbers — reactive to quotes/positions changes,
  // and passed as primitive deps to the snapshot useMemo below.
  const filteredPositions = useMemo(
    () => filter === 'all' ? positions : positions.filter(p => p.type === (FILTER_TO_TYPE[filter] ?? filter)),
    [positions, filter]
  )

  const liveValue = useMemo(
    () => filteredPositions.reduce((sum, p) => {
      const q = quotes[p.ticker]
      return sum + effectivePriceEur(q, p.avgPrice, showPrePostMarket) * p.quantity
    }, 0),
    [filteredPositions, quotes, showPrePostMarket]
  )

  const liveInvested = useMemo(
    () => filteredPositions.reduce((sum, p) => {
      const avgPriceEur = p.currency === 'USD' ? p.avgPrice / eurUsd : p.avgPrice
      return sum + avgPriceEur * p.quantity
    }, 0),
    [filteredPositions, eurUsd]
  )

  const data = useMemo(() => {
    const days = DAYS_MAP[timeframe]
    const cutoff = timeframe === 'MAX' ? 0 : Date.now() - days * 24 * 3600_000
    const filtered = snapshots.filter(s => s.ts >= cutoff)

    const points: ChartPoint[] = filtered.map(s => {
      let value: number
      let invested: number
      if (filter === 'stocks') {
        value    = s.stocks || 0
        invested = (s.stocksInvested ?? s.stocks) || 0
      } else if (filter === 'etf') {
        value    = s.etf || 0
        invested = (s.etfInvested ?? s.etf) || 0
      } else if (filter === 'crypto') {
        value    = s.crypto || 0
        invested = (s.cryptoInvested ?? s.crypto) || 0
      } else if (filter === 'commodity') {
        value    = s.commodity || 0
        invested = (s.commodityInvested ?? s.commodity) || 0
      } else {
        value    = s.value || 0
        invested = s.invested || 0
      }

      return {
        date: new Date(s.ts).toISOString(),
        value,
        invested,
      }
    }).filter(p => p.value > 0)

    // Inject live "now" point so the chart always ends at the current price
    if (liveValue > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const nowPoint: ChartPoint = {
        date: new Date().toISOString(),
        value: liveValue,
        invested: liveInvested,
      }
      if (points.length > 0 && points[points.length - 1].date.startsWith(today)) {
        points[points.length - 1] = nowPoint
      } else {
        points.push(nowPoint)
      }
    }

    const currentValue = points.length > 0 ? points[points.length - 1].value : 0
    const totalInvested = points.length > 0 ? points[points.length - 1].invested : 0
    const gainAbs = currentValue - totalInvested
    const gainPct = totalInvested > 0 ? (gainAbs / totalInvested) * 100 : 0

    // Determine which timeframes have enough data
    const dataAge = Date.now() - oldestTs()
    const availableTimeframes: Timeframe[] = ALL_TIMEFRAMES.filter(tf => {
      const needed = DAYS_MAP[tf] * 24 * 3600_000
      if (tf === 'MAX') return snapshots.length > 1
      return dataAge >= needed * 0.5
    })

    return { points, currentValue, totalInvested, gainAbs, gainPct, availableTimeframes }
  }, [snapshots, timeframe, filter, oldestTs, liveValue, liveInvested])

  return data
}
