'use client'

import { useTranslations } from 'next-intl'

export default function ScreenerPage() {
  const tl = useTranslations('screener')
  return (
    <div className="ledgernest-card">
      <div className="ledgernest-empty">
        <div className="ledgernest-empty-icon">🔍</div>
        <div style={{ fontSize: '16px', fontWeight: 600 }}>{tl('title')}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', maxWidth: 320, textAlign: 'center' }}>
          {tl('description')}
        </div>
      </div>
    </div>
  )
}
