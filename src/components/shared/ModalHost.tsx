'use client'

import { useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import MovementModal from './modals/MovementModal'
import BuyModal from './modals/BuyModal'
import GoalModal from './modals/GoalModal'
import AccountModal from './modals/AccountModal'
import EditPositionModal from './modals/EditPositionModal'
import QuickAddModal from './modals/QuickAddModal'
import CategoryManagerModal from './modals/CategoryManagerModal'
import CSVImportWizard from './CSVImportWizard'

export default function ModalHost() {
  const { activeModal, closeModal } = useUIStore()

  // Close on Escape
  useEffect(() => {
    if (!activeModal) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [activeModal, closeModal])

  // iOS body scroll lock: prevents the page from shifting behind the overlay
  useEffect(() => {
    if (!activeModal) return
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.overflowY = 'scroll'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.body.style.overflowY = ''
      window.scrollTo(0, scrollY)
    }
  }, [activeModal])

  if (!activeModal) return null

  return (
    <>
      {activeModal === 'movement' && <MovementModal />}
      {activeModal === 'buy' && <BuyModal />}
      {activeModal === 'goal' && <GoalModal />}
      {activeModal === 'account' && <AccountModal />}
      {activeModal === 'editPosition' && <EditPositionModal />}
      {activeModal === 'quickAdd' && <QuickAddModal />}
      {activeModal === 'categoryManager' && <CategoryManagerModal />}
      {activeModal === 'csvImport' && <CSVImportWizard onClose={closeModal} />}
    </>
  )
}
