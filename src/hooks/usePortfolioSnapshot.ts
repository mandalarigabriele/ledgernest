'use client'

import { useEffect } from 'react'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePricesStore } from '@/stores/pricesStore'
import { usePortfolioSnapshotStore } from '@/stores/portfolioSnapshotStore'

const MIN_INTERVAL_MS = 60_000  // record at most once per minute

export function usePortfolioSnapshot() {
  const { positions }                        = usePortfolioStore()
  const { getPriceEur, eurUsd, lastUpdated } = usePricesStore()
  const { snapshots, addSnapshot }           = usePortfolioSnapshotStore()

  useEffect(() => {
    if (!lastUpdated || positions.length === 0) return

    // Throttle: skip if last snapshot is too recent
    const lastTs = snapshots.length > 0 ? snapshots[snapshots.length - 1].ts : 0
    if (Date.now() - lastTs < MIN_INTERVAL_MS) return

    const value = positions.reduce((sum, p) => {
      const priceEur = getPriceEur(p.ticker) ?? (p.avgPrice / (p.currency === 'USD' ? eurUsd : 1))
      return sum + priceEur * p.quantity
    }, 0)

    if (value > 0) addSnapshot(value)
  }, [lastUpdated]) // eslint-disable-line react-hooks/exhaustive-deps
}
