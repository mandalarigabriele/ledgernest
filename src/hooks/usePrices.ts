'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { usePricesStore } from '@/stores/pricesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Quote } from '@/types'

const STALE_MS = 90_000 // skip fetch if data is < 90 s old

export function usePrices() {
  const { positions }             = usePortfolioStore()
  const { items: watchlistItems } = useWatchlistStore()
  const { setQuotes, setLoading, setError } = usePricesStore()
  const { settings } = useSettingsStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Use refs for values needed inside the callback but that should not
  // cause the callback to be recreated (avoids interval churn).
  const positionsRef      = useRef(positions)
  const watchlistRef      = useRef(watchlistItems)
  positionsRef.current    = positions
  watchlistRef.current    = watchlistItems

  const fetchPrices = useCallback(async (force = false) => {
    const tickers = Array.from(new Set([
      ...positionsRef.current.map((p) => p.ticker),
      ...watchlistRef.current.map((w) => w.ticker),
    ]))
    if (tickers.length === 0) return

    // Read volatile state directly from the store — avoids making the
    // callback depend on lastUpdated/quotes (which change after every fetch).
    const { quotes, lastUpdated } = usePricesStore.getState()
    const hasNewTickers = tickers.some((t) => !quotes[t])
    if (!hasNewTickers && !force && lastUpdated && Date.now() - lastUpdated < STALE_MS) return

    setLoading(true)
    try {
      const res = await fetch(`/api/prices?tickers=${tickers.join(',')}`)
      if (!res.ok) throw new Error('Prices API error')
      const data = await res.json() as { quotes: Quote[]; eurUsd: number }
      setQuotes(data.quotes, data.eurUsd)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [setQuotes, setLoading, setError]) // stable deps only — no positions/watchlist/lastUpdated

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
