'use client'

export default function ScreenerPage() {
  return (
    <div className="ledgernest-card">
      <div className="ledgernest-empty">
        <div className="ledgernest-empty-icon">🔍</div>
        <div style={{ fontSize: '16px', fontWeight: 600 }}>Screener</div>
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', maxWidth: 320, textAlign: 'center' }}>
          Lo screener di titoli sarà disponibile prossimamente.
          Potrai filtrare azioni per settore, capitalizzazione, P/E e altri indicatori fondamentali.
        </div>
      </div>
    </div>
  )
}
