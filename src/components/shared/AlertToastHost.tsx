'use client'

import { useEffect } from 'react'
import { useToastStore, type Toast } from '@/stores/toastStore'
import { useTranslations } from 'next-intl'

const AUTO_DISMISS_MS = 6000

function AlertToast({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const tw = useTranslations('watchlist')

  useEffect(() => {
    const id = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(id)
  }, [onDismiss])

  const isAbove = toast.direction === 'above'

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px',
      background: 'var(--bg-elevated)',
      border: `1px solid ${isAbove ? 'var(--success)' : 'var(--danger)'}`,
      borderRadius: 12,
      boxShadow: 'var(--shadow-lg)',
      minWidth: 260, maxWidth: 320,
      animation: 'slideInRight 0.2s ease',
    }}>
      <div style={{
        flex: '0 0 32px', height: 32, borderRadius: 8,
        background: isAbove ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        color: isAbove ? 'var(--success)' : 'var(--danger)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 700, flexShrink: 0,
      }}>
        {isAbove ? '↑' : '↓'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          {toast.ticker}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {isAbove ? tw('above') : tw('below')} {toast.threshold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: toast.threshold < 1 ? 4 : 2 })}
          {' · '}
          <span style={{ color: isAbove ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
            {toast.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: toast.price < 1 ? 4 : 2 })}
          </span>
        </div>
      </div>

      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, fontSize: 13, lineHeight: 1, flexShrink: 0 }}
      >
        ✕
      </button>
    </div>
  )
}

export default function AlertToastHost() {
  const { toasts, dismiss } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <AlertToast toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  )
}
