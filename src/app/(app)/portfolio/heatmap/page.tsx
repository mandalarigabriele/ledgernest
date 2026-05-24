'use client'

import { useMemo } from 'react'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePricesStore } from '@/stores/pricesStore'
import { usePrices } from '@/hooks/usePrices'
import { fmtEur, fmtPct, deltaClass } from '@/lib/utils/format'

function getHeatColor(pct: number): string {
  if (pct >= 3)   return '#16a34a'
  if (pct >= 1)   return '#22c55e'
  if (pct >= 0.2) return '#4ade80'
  if (pct >= -0.2)return '#6b7280'
  if (pct >= -1)  return '#f87171'
  if (pct >= -3)  return '#ef4444'
  return '#dc2626'
}

export default function HeatmapPage() {
  usePrices()
  const { positions } = usePortfolioStore()
  const { quotes } = usePricesStore()

  const cells = useMemo(() => {
    return positions.map((p) => {
      const q = quotes[p.ticker]
      const price = q?.priceEur ?? q?.price ?? p.avgPrice
      const value = price * p.quantity
      const changePct = q?.changePct ?? 0
      return { ...p, value, changePct, color: getHeatColor(changePct) }
    }).sort((a, b) => b.value - a.value)
  }, [positions, quotes])

  const totalValue = cells.reduce((s, c) => s + c.value, 0)

  return (
    <div className="ledgernest-gap-5">
      <div className="ledgernest-kpi-strip">
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">Posizioni nella heatmap</div>
          <div className="ledgernest-kpi-value">{cells.length}</div>
        </div>
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">Valore totale</div>
          <div className="ledgernest-kpi-value">{fmtEur(totalValue)}</div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}>
        <span>Peggiore</span>
        {['#dc2626', '#ef4444', '#f87171', '#6b7280', '#4ade80', '#22c55e', '#16a34a'].map((c) => (
          <div key={c} style={{ width: 24, height: 14, background: c, borderRadius: 3 }} />
        ))}
        <span>Migliore</span>
      </div>

      {cells.length === 0 ? (
        <div className="ledgernest-card">
          <div className="ledgernest-empty">
            <div className="ledgernest-empty-icon">🗺️</div>
            Nessuna posizione nella heatmap
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
          }}
        >
          {cells.map((c) => {
            const weight = totalValue > 0 ? c.value / totalValue : 1 / cells.length
            const minSize = 80
            const maxSize = 280
            const size = Math.max(minSize, Math.min(maxSize, weight * maxSize * cells.length))

            return (
              <div
                key={c.id}
                style={{
                  width: size,
                  height: size * 0.7,
                  background: c.color,
                  borderRadius: 8,
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  cursor: 'pointer',
                  transition: 'filter 0.15s',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
                title={`${c.ticker}: ${fmtEur(c.value)} (${fmtPct(c.changePct)})`}
              >
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'white', opacity: 0.95 }}>{c.ticker}</div>
                <div style={{ fontSize: '10px', color: 'white', opacity: 0.75 }}>{fmtPct(c.changePct)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
