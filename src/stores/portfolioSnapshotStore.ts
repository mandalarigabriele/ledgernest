import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PortfolioSnapshot {
  ts: number       // Unix ms
  value: number    // total portfolio value in EUR
  invested: number // total cost basis in EUR
  stocks: number   // stocks value
  etf: number      // etf value
  crypto: number   // crypto value
  commodity: number // commodity value
  stocksInvested?: number
  etfInvested?: number
  cryptoInvested?: number
  commodityInvested?: number
}

interface PortfolioSnapshotStore {
  snapshots: PortfolioSnapshot[]
  addSnapshot: (snap: Omit<PortfolioSnapshot, 'ts'>) => void
  getSnapshotsForRange: (days: number) => PortfolioSnapshot[]
  oldestTs: () => number
  clearSnapshots: () => void
  hydrate: (data: Partial<Pick<PortfolioSnapshotStore, 'snapshots'>>) => void
}

// Downsampling: keep detail for recent data, compress old data
const BUCKET_15M = 15 * 60_000
const BUCKET_1H  = 60 * 60_000
const BUCKET_1D  = 24 * 3600_000
const BUCKET_1W  = 7 * 24 * 3600_000

function bucketize(arr: PortfolioSnapshot[], bucketMs: number): PortfolioSnapshot[] {
  const buckets: Record<number, PortfolioSnapshot> = {}
  for (const snap of arr) {
    const b = Math.floor(snap.ts / bucketMs)
    if (!buckets[b] || snap.ts > buckets[b].ts) buckets[b] = snap
  }
  return Object.values(buckets).sort((a, b) => a.ts - b.ts)
}

function downsample(snapshots: PortfolioSnapshot[]): PortfolioSnapshot[] {
  const now = Date.now()
  const cut24h = now - 24 * 3600_000
  const cut7d  = now - 7 * 24 * 3600_000
  const cut30d = now - 30 * 24 * 3600_000
  const cut1y  = now - 365 * 24 * 3600_000

  return [
    ...bucketize(snapshots.filter(s => s.ts < cut1y), BUCKET_1W),
    ...bucketize(snapshots.filter(s => s.ts >= cut1y && s.ts < cut30d), BUCKET_1D),
    ...bucketize(snapshots.filter(s => s.ts >= cut30d && s.ts < cut7d), BUCKET_1H),
    ...bucketize(snapshots.filter(s => s.ts >= cut7d && s.ts < cut24h), BUCKET_15M),
    ...snapshots.filter(s => s.ts >= cut24h),
  ]
}

export const usePortfolioSnapshotStore = create<PortfolioSnapshotStore>()(
  persist(
    (set, get) => ({
      snapshots: [],

      addSnapshot: (snap) => {
        const now = Date.now()
        set((s) => {
          const newSnap: PortfolioSnapshot = { ...snap, ts: now }
          const all = [...s.snapshots, newSnap]
          return { snapshots: downsample(all) }
        })
      },

      getSnapshotsForRange: (days) => {
        const cutoff = Date.now() - days * 24 * 3600_000
        return get().snapshots.filter(s => s.ts >= cutoff)
      },

      oldestTs: () => {
        const snaps = get().snapshots
        return snaps.length > 0 ? snaps[0].ts : Date.now()
      },

      clearSnapshots: () => set({ snapshots: [] }),
      hydrate: (data) => set(data),
    }),
    { name: 'portfolio-snapshots' }
  )
)
