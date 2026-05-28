'use client'

import { useTranslations } from 'next-intl'
import { useUIStore } from '@/stores/uiStore'
import Icon from '@/components/shared/Icon'
import type { ModalType } from '@/types'

export default function QuickAddModal() {
  const t = useTranslations('quickAdd')
  const { closeModal, openModal } = useUIStore()

  const ACTIONS: {
    key: string
    icon: string
    iconBg: string
    iconColor: string
    title: string
    subtitle: string
    modal: ModalType
    modalProps?: Record<string, unknown>
  }[] = [
    {
      key: 'movement',
      icon: 'movimenti',
      iconBg: 'color-mix(in oklch, #5bc8d0 18%, #0a1628)',
      iconColor: '#5bc8d0',
      title: t('movement'),
      subtitle: t('movementSub'),
      modal: 'movement',
    },
    {
      key: 'stock',
      icon: 'trending_up',
      iconBg: 'color-mix(in oklch, #7c6df7 18%, #0a1628)',
      iconColor: '#7c6df7',
      title: t('buyStock'),
      subtitle: t('buyStockSub'),
      modal: 'buy',
      modalProps: { assetType: 'stock' },
    },
    {
      key: 'etf',
      icon: 'etf',
      iconBg: 'color-mix(in oklch, #3b82f6 18%, #0a1628)',
      iconColor: '#3b82f6',
      title: t('buyEtf'),
      subtitle: t('buyEtfSub'),
      modal: 'buy',
      modalProps: { assetType: 'etf' },
    },
    {
      key: 'crypto',
      icon: 'crypto',
      iconBg: 'color-mix(in oklch, #f77c3a 18%, #0a1628)',
      iconColor: '#f77c3a',
      title: t('buyCrypto'),
      subtitle: t('buyCryptoSub'),
      modal: 'buy',
      modalProps: { assetType: 'crypto' },
    },
    {
      key: 'goal',
      icon: 'obiettivi',
      iconBg: 'color-mix(in oklch, #3fb950 18%, #0a1628)',
      iconColor: '#3fb950',
      title: t('goal'),
      subtitle: t('goalSub'),
      modal: 'goal',
    },
    {
      key: 'csvImport',
      icon: 'report',
      iconBg: 'color-mix(in oklch, #d29922 18%, #0a1628)',
      iconColor: '#d29922',
      title: t('importCsv'),
      subtitle: t('importCsvSub'),
      modal: 'csvImport',
    },
  ]

  function handleAction(modal: ModalType, props?: Record<string, unknown>) {
    closeModal()
    if (modal) openModal(modal, props)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 18,
          paddingTop: 20,
          paddingBottom: 10,
          width: 360,
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          color: 'var(--text-tertiary)', padding: '0 22px 14px',
          textTransform: 'uppercase',
        }}>
          {t('header')}
        </div>

        {ACTIONS.map((item) => (
          <button
            key={item.key}
            onClick={() => handleAction(item.modal, item.modalProps)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              width: '100%', padding: '13px 22px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              textAlign: 'left', transition: 'background .12s',
              color: 'inherit',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: item.iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: item.iconColor,
            }}>
              <Icon name={item.icon} size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
                {item.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {item.subtitle}
              </div>
            </div>
            <svg width={18} height={18} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: 'var(--text-tertiary)' }}>
              <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
