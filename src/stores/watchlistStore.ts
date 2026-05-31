import { create } from 'zustand'

export interface WatchlistItem {
  id:          string
  ticker:      string
  name:        string
  currency:    string
  lists:       string[]
  targetPrice: number | null
  createdAt:   string
}

export interface PriceAlert {
  id:          string
  ticker:      string
  threshold:   number
  direction:   'above' | 'below'
  active:      boolean
  triggeredAt: string | null
  createdAt:   string
}

interface WatchlistStore {
  items:  WatchlistItem[]
  alerts: PriceAlert[]

  hydrate: (data: { items: WatchlistItem[]; alerts: PriceAlert[] }) => void

  addItem:    (payload: { ticker: string; name: string; currency: string; lists: string[]; targetPrice: number | null }) => Promise<void>
  removeItem: (id: string) => Promise<void>
  updateItem: (id: string, patch: Partial<Pick<WatchlistItem, 'lists' | 'targetPrice'>>) => Promise<void>

  addAlert:    (payload: { ticker: string; threshold: number; direction: 'above' | 'below' }) => Promise<void>
  removeAlert: (id: string) => Promise<void>
  markAlertTriggered: (id: string) => void
}

export const useWatchlistStore = create<WatchlistStore>()((set) => ({
  items:  [],
  alerts: [],

  hydrate: ({ items, alerts }) => set({ items, alerts }),

  addItem: async (payload) => {
    const res  = await fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const item = await res.json() as WatchlistItem
    set((s) => ({ items: [...s.items, item] }))
  },

  removeItem: async (id) => {
    await fetch(`/api/watchlist/${id}`, { method: 'DELETE' })
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
  },

  updateItem: async (id, patch) => {
    const res  = await fetch(`/api/watchlist/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    const item = await res.json() as WatchlistItem
    set((s) => ({ items: s.items.map((i) => i.id === id ? item : i) }))
  },

  addAlert: async (payload) => {
    const res   = await fetch('/api/watchlist/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const alert = await res.json() as PriceAlert
    set((s) => ({ alerts: [...s.alerts, alert] }))
  },

  removeAlert: async (id) => {
    await fetch(`/api/watchlist/alerts/${id}`, { method: 'DELETE' })
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }))
  },

  markAlertTriggered: (id) => {
    set((s) => ({
      alerts: s.alerts.map((a) => a.id === id ? { ...a, active: false, triggeredAt: new Date().toISOString() } : a),
    }))
  },
}))
