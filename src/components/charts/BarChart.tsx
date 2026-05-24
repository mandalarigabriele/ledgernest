'use client'

import { useState } from 'react'

interface BarSeries {
  label: string
  income?: number
  expense?: number
  invested?: number
  value?: number
  color?: string
}

interface BarChartProps {
  data: BarSeries[]
  height?: number
  paired?: boolean
  formatValue?: (v: number) => string
}

export default function BarChart({ data, height = 160, paired = false, formatValue = (v) => `€${v.toFixed(0)}` }: BarChartProps) {
  const [tooltip, setTooltip] = useState<{ idx: number; x: number } | null>(null)

  if (!data || data.length === 0) return null

  const W = 600
  const H = height
  const PAD = { top: 8, right: 8, bottom: 24, left: 8 }
  const barW = ((W - PAD.left - PAD.right) / data.length) * 0.7
  const gap = (W - PAD.left - PAD.right) / data.length

  const hasInvested = paired && data.some((d) => (d.invested ?? 0) > 0)
  const maxVal = paired
    ? Math.max(...data.flatMap((d) => [d.income ?? 0, d.expense ?? 0, d.invested ?? 0]))
    : Math.max(...data.map((d) => d.value ?? 0))

  function barH(v: number) {
    return ((v / (maxVal || 1)) * (H - PAD.top - PAD.bottom))
  }

  function barX(i: number) {
    return PAD.left + i * gap + gap * 0.15
  }

  const hov = tooltip !== null ? data[tooltip.idx] : null

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height, display: 'block' }}
      >
        {data.map((d, i) => {
          const bx = barX(i)
          const isHov = tooltip?.idx === i

          if (paired) {
            const iH = barH(d.income ?? 0)
            const eH = barH(d.expense ?? 0)
            const vH = barH(d.invested ?? 0)
            const slots = hasInvested ? 3 : 2
            const slotW = (barW - (slots - 1)) / slots
            return (
              <g key={i} onMouseEnter={() => setTooltip({ idx: i, x: bx })} onMouseLeave={() => setTooltip(null)}>
                <rect x={bx} y={H - PAD.bottom - iH} width={slotW} height={iH} fill="var(--success)" opacity={isHov ? 1 : 0.75} rx="3" style={{ transition: 'opacity 0.15s' }} />
                <rect x={bx + slotW + 1} y={H - PAD.bottom - eH} width={slotW} height={eH} fill="var(--danger)" opacity={isHov ? 1 : 0.75} rx="3" style={{ transition: 'opacity 0.15s' }} />
                {hasInvested && (
                  <rect x={bx + (slotW + 1) * 2} y={H - PAD.bottom - vH} width={slotW} height={vH} fill="var(--accent)" opacity={isHov ? 1 : 0.75} rx="3" style={{ transition: 'opacity 0.15s' }} />
                )}
                <text x={bx + barW / 2} y={H - 4} textAnchor="middle" fill="var(--text-tertiary)" fontSize="10">{d.label}</text>
              </g>
            )
          }

          const bH = barH(d.value ?? 0)
          return (
            <g key={i} onMouseEnter={() => setTooltip({ idx: i, x: bx })} onMouseLeave={() => setTooltip(null)}>
              <rect
                x={bx}
                y={H - PAD.bottom - bH}
                width={barW}
                height={bH}
                fill={d.color ?? 'var(--accent)'}
                opacity={isHov ? 1 : 0.75}
                rx="3"
                style={{ transition: 'opacity 0.15s' }}
              />
              <text
                x={bx + barW / 2}
                y={H - 4}
                textAnchor="middle"
                fill="var(--text-tertiary)"
                fontSize="10"
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && hov && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: (tooltip.x / W * 100) + '%',
          transform: tooltip.x > W / 2 ? 'translateX(-110%)' : 'translateX(8px)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '6px 10px',
          fontSize: '12px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          boxShadow: 'var(--shadow-md)',
          zIndex: 10,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{hov.label}</div>
          {paired ? (
            <>
              <div style={{ color: 'var(--success)' }}>↑ {formatValue(hov.income ?? 0)}</div>
              <div style={{ color: 'var(--danger)' }}>↓ {formatValue(hov.expense ?? 0)}</div>
              {hasInvested && <div style={{ color: 'var(--accent)' }}>⬡ {formatValue(hov.invested ?? 0)}</div>}
            </>
          ) : (
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatValue(hov.value ?? 0)}</div>
          )}
        </div>
      )}
    </div>
  )
}
