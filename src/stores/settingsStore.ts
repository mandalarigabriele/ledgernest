import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings } from '@/types'

interface SettingsStore {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
  ignoredImportIds: string[]
  addIgnoredImportIds: (ids: string[]) => void
  clearIgnoredImportIds: () => void
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  locale: 'it',
  currency: 'EUR',
  refreshInterval: 600,
  showPrePostMarket: true,
  accentColor: '#5bc8d0',
  density: 'normal',
  showPortfolioValue: true,
  snapshotFrequency: 'daily',
  font: 'inter',
  animations: true,
  showLargeNumbers: false,
  hideSensitiveAmounts: false,
  sidebarColor: undefined,
  selfName: '',
  ignoreTransfers: true,
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),
      ignoredImportIds: [],
      addIgnoredImportIds: (ids) =>
        set((state) => {
          const existing = new Set(state.ignoredImportIds)
          ids.forEach((id) => existing.add(id))
          return { ignoredImportIds: Array.from(existing) }
        }),
      clearIgnoredImportIds: () => set({ ignoredImportIds: [] }),
    }),
    { name: 'ledgernest-settings', skipHydration: true }
  )
)
