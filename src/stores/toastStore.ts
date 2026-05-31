import { create } from 'zustand'

export interface Toast {
  id:        string
  ticker:    string
  threshold: number
  direction: 'above' | 'below'
  price:     number
}

interface ToastStore {
  toasts: Toast[]
  push:    (t: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  push: (t) => set((s) => ({ toasts: [...s.toasts, { ...t, id: crypto.randomUUID() }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
