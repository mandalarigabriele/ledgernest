import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Quote } from '@/types'

interface PricesStore {
  quotes: Record<string, Quote>
  eurUsd: number
  lastUpdated: number | null
  loading: boolean
  error: string | null

  setQuotes: (quotes: Quote[], eurUsd: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  getQuote: (ticker: string) => Quote | undefined
  getPrice: (ticker: string) => number | undefined
  getPriceEur: (ticker: string) => number | undefined
}

export const usePricesStore = create<PricesStore>()(
  persist(
    (set, get) => ({
      quotes: {},
      eurUsd: 1.08,
      lastUpdated: null,
      loading: false,
      error: null,

      setQuotes: (quotes, eurUsd) => {
        const map: Record<string, Quote> = {}
        for (const q of quotes) map[q.ticker] = q
        set({ quotes: map, eurUsd, lastUpdated: Date.now(), loading: false, error: null })
      },

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error, loading: false }),

      getQuote: (ticker) => get().quotes[ticker],
      getPrice: (ticker) => get().quotes[ticker]?.price,
      getPriceEur: (ticker) => {
        const q = get().quotes[ticker]
        if (!q) return undefined
        if (q.priceEur !== undefined) return q.priceEur
        if (q.currency === 'EUR') return q.price
        return q.price / get().eurUsd
      },
    }),
    {
      name: 'ledgernest-prices',
      partialize: (s) => ({ quotes: s.quotes, eurUsd: s.eurUsd, lastUpdated: s.lastUpdated }),
      skipHydration: true,
    }
  )
)
