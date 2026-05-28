import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PortfolioSnapshot {
  ts: number    // Unix ms
  value: number // portfolio value in EUR (positions only, not cash)
}

interface PortfolioSnapshotStore {
  snapshots: PortfolioSnapshot[]
  addSnapshot: (value: number) => void
}

const RETAIN_MS   = 8 * 24 * 3600_000  // 8 days total
const RECENT_MS   = 24 * 3600_000      // last 24h kept at full resolution
const BUCKET_MS   = 30 * 60_000        // older data: 1 point per 30-min bucket

export const usePortfolioSnapshotStore = create<PortfolioSnapshotStore>()(
  persist(
    (set) => ({
      snapshots: [],

      addSnapshot: (value) => {
        const now    = Date.now()
        const cut8d  = now - RETAIN_MS
        const cut24h = now - RECENT_MS

        set((s) => {
          // Recent (< 24h): keep as-is
          const recent = s.snapshots.filter((p) => p.ts >= cut24h)

          // Older (24h–8d): downsample to 1 point per 30-min bucket (keep latest in bucket)
          const older  = s.snapshots.filter((p) => p.ts >= cut8d && p.ts < cut24h)
          const buckets: Record<number, PortfolioSnapshot> = {}
          for (const snap of older) {
            const b = Math.floor(snap.ts / BUCKET_MS)
            if (!buckets[b] || snap.ts > buckets[b].ts) buckets[b] = snap
          }
          const downsampledOlder = Object.values(buckets).sort((a, b) => a.ts - b.ts)

          return { snapshots: [...downsampledOlder, ...recent, { ts: now, value }] }
        })
      },
    }),
    { name: 'portfolio-snapshots' }
  )
)
