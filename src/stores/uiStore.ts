import { create } from 'zustand'
import type { ModalType } from '@/types'

interface UIStore {
  sidebarOpen: boolean
  searchOpen: boolean
  activeModal: ModalType
  modalProps: Record<string, unknown>
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setSearchOpen: (open: boolean) => void
  openModal: (type: ModalType, props?: Record<string, unknown>) => void
  closeModal: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: false,
  searchOpen: false,
  activeModal: null,
  modalProps: {},

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSearchOpen: (open) => set({ searchOpen: open }),
  openModal: (type, props = {}) => set({ activeModal: type, modalProps: props, sidebarOpen: false }),
  closeModal: () => set({ activeModal: null, modalProps: {} }),
}))
