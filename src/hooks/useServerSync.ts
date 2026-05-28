'use client'

import { useEffect, useRef } from 'react'
import { useFinanceStore } from '@/stores/financeStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { usePricesStore } from '@/stores/pricesStore'
import { usePortfolioSnapshotStore } from '@/stores/portfolioSnapshotStore'

type FinanceData = Parameters<ReturnType<typeof useFinanceStore.getState>['hydrate']>[0]
type PortfolioData = Parameters<ReturnType<typeof usePortfolioStore.getState>['hydrate']>[0]
type SnapshotData = Parameters<ReturnType<typeof usePortfolioSnapshotStore.getState>['hydrate']>[0]
type SettingsData = Parameters<ReturnType<typeof useSettingsStore.getState>['hydrate']>[0]

async function syncPut(key: string, data: unknown) {
  return fetch('/api/sync', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, data }),
  }).catch(console.error)
}

export function useServerSync() {
  const hydratedRef = useRef(false)

  useEffect(() => {
    useFinanceStore.persist.rehydrate()
    usePortfolioStore.persist.rehydrate()
    useSettingsStore.persist.rehydrate()
    usePricesStore.persist.rehydrate()
    usePortfolioSnapshotStore.persist.rehydrate()

    async function load() {
      try {
        const [finRes, portRes, snapRes, settRes] = await Promise.all([
          fetch('/api/sync?key=finance'),
          fetch('/api/sync?key=portfolio'),
          fetch('/api/sync?key=snapshots'),
          fetch('/api/sync?key=settings'),
        ])

        if (finRes.ok) {
          const { data } = await finRes.json() as { data: FinanceData | null }
          if (data) {
            useFinanceStore.getState().hydrate(data)
          } else {
            const { accounts, transactions, budgetCategories, recurringItems, goals } = useFinanceStore.getState()
            syncPut('finance', { accounts, transactions, budgetCategories, recurringItems, goals })
          }
        }

        if (portRes.ok) {
          const { data } = await portRes.json() as { data: PortfolioData | null }
          if (data) {
            usePortfolioStore.getState().hydrate(data)
          } else {
            const { positions, trades, dividends } = usePortfolioStore.getState()
            syncPut('portfolio', { positions, trades, dividends })
          }
        }

        if (snapRes.ok) {
          const { data } = await snapRes.json() as { data: SnapshotData | null }
          if (data) {
            usePortfolioSnapshotStore.getState().hydrate(data)
          } else {
            const { snapshots } = usePortfolioSnapshotStore.getState()
            syncPut('snapshots', { snapshots })
          }
        }

        if (settRes.ok) {
          const { data } = await settRes.json() as { data: SettingsData | null }
          if (data) {
            useSettingsStore.getState().hydrate(data)
          } else {
            const { settings, ignoredImportIds } = useSettingsStore.getState()
            syncPut('settings', { settings, ignoredImportIds })
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
        syncPut('finance', { accounts, transactions, budgetCategories, recurringItems, goals })
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
        syncPut('portfolio', { positions, trades, dividends })
      }, 1500)
    })
    return () => { unsub(); clearTimeout(timeout) }
  }, [])

  // Sync snapshots → server con debounce 5s (cambiano meno spesso)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const unsub = usePortfolioSnapshotStore.subscribe((state) => {
      if (!hydratedRef.current) return
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        const { snapshots } = state
        syncPut('snapshots', { snapshots })
      }, 5000)
    })
    return () => { unsub(); clearTimeout(timeout) }
  }, [])

  // Sync settings → server con debounce 1.5s
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const unsub = useSettingsStore.subscribe((state) => {
      if (!hydratedRef.current) return
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        const { settings, ignoredImportIds } = state
        syncPut('settings', { settings, ignoredImportIds })
      }, 1500)
    })
    return () => { unsub(); clearTimeout(timeout) }
  }, [])
}
