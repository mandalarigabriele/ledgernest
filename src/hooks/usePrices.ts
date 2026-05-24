'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePricesStore } from '@/stores/pricesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Quote } from '@/types'

const STALE_MS = 90_000 // skip fetch if data is < 90 s old

export function usePrices() {
  const { positions } = usePortfolioStore()
  const { setQuotes, setLoading, setError, lastUpdated } = usePricesStore()
  const { settings } = useSettingsStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchPrices = useCallback(async (force = false) => {
    const tickers = Array.from(new Set(positions.map((p) => p.ticker)))
    if (tickers.length === 0) return
    if (!force && lastUpdated && Date.now() - lastUpdated < STALE_MS) return

    setLoading(true)
    try {
      const res = await fetch(`/api/prices?tickers=${tickers.join(',')}`)
      if (!res.ok) throw new Error('Prices API error')
      const data = await res.json() as { quotes: Quote[]; eurUsd: number }
      setQuotes(data.quotes, data.eurUsd)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [positions, lastUpdated, setQuotes, setLoading, setError])

  useEffect(() => {
    fetchPrices()

    if (settings.refreshInterval > 0) {
      intervalRef.current = setInterval(() => fetchPrices(true), settings.refreshInterval * 1000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchPrices, settings.refreshInterval])

  return { refetch: () => fetchPrices(true) }
}
