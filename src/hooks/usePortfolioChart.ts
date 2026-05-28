'use client'

import { useMemo } from 'react'
import { usePortfolioSnapshotStore, PortfolioSnapshot } from '@/stores/portfolioSnapshotStore'

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

export type AssetFilter = 'all' | 'stocks' | 'etf' | 'crypto'

export interface PortfolioChartData {
  points: ChartPoint[]
  currentValue: number
  totalInvested: number
  gainAbs: number
  gainPct: number
  availableTimeframes: Timeframe[]
}

export function usePortfolioChart(timeframe: Timeframe, filter: AssetFilter = 'all'): PortfolioChartData {
  const { snapshots, oldestTs } = usePortfolioSnapshotStore()

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
      } else {
        value    = s.value || 0
        invested = s.invested || 0
      }

      return {
        date: new Date(s.ts).toISOString(),
        value,
        invested,
      }
    }).filter(p => p.value > 0) // skip zero-value points (incomplete old data)

    const currentValue = points.length > 0 ? points[points.length - 1].value : 0
    const totalInvested = points.length > 0 ? points[points.length - 1].invested : 0
    const gainAbs = currentValue - totalInvested
    const gainPct = totalInvested > 0 ? (gainAbs / totalInvested) * 100 : 0

    // Determine which timeframes have enough data
    const dataAge = Date.now() - oldestTs()
    const availableTimeframes: Timeframe[] = ALL_TIMEFRAMES.filter(tf => {
      const needed = DAYS_MAP[tf] * 24 * 3600_000
      if (tf === 'MAX') return snapshots.length > 1
      return dataAge >= needed * 0.5 // allow if we have at least 50% of the range
    })

    return { points, currentValue, totalInvested, gainAbs, gainPct, availableTimeframes }
  }, [snapshots, timeframe, filter, oldestTs])

  return data
}
