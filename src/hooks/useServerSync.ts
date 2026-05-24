'use client'

import { useEffect, useRef } from 'react'
import { useFinanceStore } from '@/stores/financeStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { usePricesStore } from '@/stores/pricesStore'

type FinanceData = Parameters<ReturnType<typeof useFinanceStore.getState>['hydrate']>[0]
type PortfolioData = Parameters<ReturnType<typeof usePortfolioStore.getState>['hydrate']>[0]

export function useServerSync() {
  const hydratedRef = useRef(false)

  // Carica i dati al mount evitando hydration mismatch:
  // 1. Prima rehydrate da localStorage (sincrono, dopo il mount)
  // 2. Poi sovrascrive con i dati del server se presenti
  useEffect(() => {
    // Ripristina localStorage subito dopo il mount (skipHydration=true in tutti gli store)
    useFinanceStore.persist.rehydrate()
    usePortfolioStore.persist.rehydrate()
    useSettingsStore.persist.rehydrate()
    usePricesStore.persist.rehydrate()

    async function load() {
      try {
        const [finRes, portRes] = await Promise.all([
          fetch('/api/sync?key=finance'),
          fetch('/api/sync?key=portfolio'),
        ])

        if (finRes.ok) {
          const { data } = await finRes.json() as { data: FinanceData | null }
          if (data) {
            // Il server ha dati → usa quelli (fonte di verità)
            useFinanceStore.getState().hydrate(data)
          } else {
            // Il server è vuoto → carica il localStorage sul server (migrazione iniziale)
            const { accounts, transactions, budgetCategories, recurringItems, goals } = useFinanceStore.getState()
            fetch('/api/sync', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: 'finance', data: { accounts, transactions, budgetCategories, recurringItems, goals } }),
            }).catch(console.error)
          }
        }

        if (portRes.ok) {
          const { data } = await portRes.json() as { data: PortfolioData | null }
          if (data) {
            usePortfolioStore.getState().hydrate(data)
          } else {
            const { positions, trades, dividends } = usePortfolioStore.getState()
            fetch('/api/sync', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: 'portfolio', data: { positions, trades, dividends } }),
            }).catch(console.error)
          }
        }
      } catch {
        // Fallback silenzioso: rimangono i dati da localStorage
      } finally {
        hydratedRef.current = true
      }
    }
    load()
  }, [])

  // Sync finance → server con debounce 1.5s
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const unsub = useFinanceStore.subscribe((state) => {
      if (!hydratedRef.current) return
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        const { accounts, transactions, budgetCategories, recurringItems, goals } = state
        fetch('/api/sync', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'finance', data: { accounts, transactions, budgetCategories, recurringItems, goals } }),
        }).catch(console.error)
      }, 1500)
    })
    return () => { unsub(); clearTimeout(timeout) }
  }, [])

  // Sync portfolio → server con debounce 1.5s
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const unsub = usePortfolioStore.subscribe((state) => {
      if (!hydratedRef.current) return
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        const { positions, trades, dividends } = state
        fetch('/api/sync', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'portfolio', data: { positions, trades, dividends } }),
        }).catch(console.error)
      }, 1500)
    })
    return () => { unsub(); clearTimeout(timeout) }
  }, [])
}
