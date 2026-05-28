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

    let value = 0, invested = 0, stocks = 0, etf = 0, crypto = 0

    for (const p of positions) {
      const priceEur = getPriceEur(p.ticker) ?? (p.avgPrice / (p.currency === 'USD' ? eurUsd : 1))
      const posValue = priceEur * p.quantity
      const avgEur = p.currency === 'USD' ? p.avgPrice / eurUsd : p.avgPrice
      const posCost = avgEur * p.quantity

      value += posValue
      invested += posCost

      if (p.type === 'stock') stocks += posValue
      else if (p.type === 'etf') etf += posValue
      else if (p.type === 'crypto') crypto += posValue
    }

    if (value > 0) addSnapshot({ value, invested, stocks, etf, crypto })
  }, [lastUpdated]) // eslint-disable-line react-hooks/exhaustive-deps
}
