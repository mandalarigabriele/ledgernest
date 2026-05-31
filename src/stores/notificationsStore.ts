import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NotificationsStore {
  dismissedIds: string[]
  dismiss:    (id: string)    => void
  dismissAll: (ids: string[]) => void
}

export const useNotificationsStore = create<NotificationsStore>()(
  persist(
    (set) => ({
      dismissedIds: [],
      dismiss:    (id)  => set((s) => ({ dismissedIds: [...s.dismissedIds, id] })),
      dismissAll: (ids) => set((s) => ({ dismissedIds: Array.from(new Set([...s.dismissedIds, ...ids])) })),
    }),
    { name: 'ledgernest-notifications', skipHydration: true }
  )
)
