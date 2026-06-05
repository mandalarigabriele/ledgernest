'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSettingsStore } from '@/stores/settingsStore'

async function clearServerSync() {
  const h = { 'Content-Type': 'application/json' }
  // Send null so the server has nothing to restore on next load
  await Promise.allSettled([
    fetch('/api/sync', { method: 'PUT', headers: h, body: JSON.stringify({ key: 'finance',   data: null }) }),
    fetch('/api/sync', { method: 'PUT', headers: h, body: JSON.stringify({ key: 'portfolio', data: null }) }),
    fetch('/api/sync', { method: 'PUT', headers: h, body: JSON.stringify({ key: 'snapshots', data: null }) }),
  ])
}

export default function DemoBanner() {
  const t = useTranslations('demo')
  const [exiting, setExiting] = useState(false)

  async function exitDemo() {
    setExiting(true)

    // 1. Clear server-side sync so it doesn't restore demo data on next load
    await clearServerSync()

    // 2. Update settings in localStorage BEFORE reload
    useSettingsStore.getState().updateSettings({
      demoMode: false,
      selfName: '',
      targetAllocation: {},
    })

    // 3. Clear the demo bypass cookie
    document.cookie = 'ledgernest-demo=; path=/; max-age=0'

    // 4. Wipe data stores from localStorage
    localStorage.removeItem('ledgernest-portfolio')
    localStorage.removeItem('ledgernest-finance')
    localStorage.removeItem('portfolio-snapshots')

    // 4. Full page reload — stores re-init from (now empty) localStorage,
    //    server sync finds null → pushes fresh empty state, wizard appears.
    window.location.href = '/dashboard'
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
      padding: '7px 16px',
      background: 'color-mix(in oklch, var(--accent) 14%, var(--bg-surface))',
      borderBottom: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
      fontSize: 12, fontWeight: 600,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 14 }}>✨</span>
      <span style={{ color: 'var(--text-secondary)' }}>
        {t('bannerPre')} <span style={{ color: 'var(--accent)' }}>{t('bannerMode')}</span> {t('bannerPost')}
      </span>
      <button
        onClick={exitDemo}
        disabled={exiting}
        style={{
          padding: '4px 12px', borderRadius: 8,
          border: '1.5px solid var(--accent)',
          background: 'transparent',
          color: 'var(--accent)',
          fontSize: 11, fontWeight: 700, cursor: exiting ? 'wait' : 'pointer',
          opacity: exiting ? 0.6 : 1,
          transition: 'all .15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          if (exiting) return
          const b = e.currentTarget
          b.style.background = 'var(--accent)'
          b.style.color = 'var(--text-on-accent, #fff)'
        }}
        onMouseLeave={(e) => {
          const b = e.currentTarget
          b.style.background = 'transparent'
          b.style.color = 'var(--accent)'
        }}
      >
        {exiting ? t('exiting') : t('exit')}
      </button>
    </div>
  )
}
