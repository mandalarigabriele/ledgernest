'use client'

import { useState } from 'react'

interface BarSeries {
  label: string
  income?: number
  expense?: number
  invested?: number
  value?: number
  color?: string
  budgetIncome?: number  // expected income for budget-vs-actual ghost bar
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

  const W      = 600
  const H      = height
  const PAD    = { top: 20, right: 8, bottom: 28, left: 46 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const baseY  = H - PAD.bottom

  const gap  = innerW / data.length
  const barW = gap * 0.7

  const hasInvested = paired && data.some((d) => (d.invested ?? 0) > 0)
  const rawMax = paired
    ? Math.max(...data.flatMap((d) => [d.income ?? 0, d.expense ?? 0, d.invested ?? 0, d.budgetIncome ?? 0]))
    : Math.max(...data.map((d) => d.value ?? 0))
  const maxVal = rawMax > 0 ? rawMax : 1

  const GRID_TICKS = [0.33, 0.66, 1.0]

  function barH(v: number) { return (v / maxVal) * innerH }
  function barX(i: number) { return PAD.left + i * gap + (gap - barW) / 2 }
  function gridY(frac: number) { return PAD.top + innerH * (1 - frac) }
  function fmtTick(v: number) { return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}` }

  const hov = tooltip !== null ? data[tooltip.idx] : null

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }}>

        {/* Grid lines + y-axis labels */}
        {GRID_TICKS.map((t) => {
          const y = gridY(t)
          return (
            <g key={t}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <text x={PAD.left - 6} y={y + 3.5} textAnchor="end" fill="rgba(255,255,255,0.28)" fontSize="9">
                {fmtTick(maxVal * t)}
              </text>
            </g>
          )
        })}

        {/* Baseline */}
        <line x1={PAD.left} y1={baseY} x2={W - PAD.right} y2={baseY} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

        {/* Bars */}
        {data.map((d, i) => {
          const bx     = barX(i)
          const isHov  = tooltip?.idx === i

          if (paired) {
            const iH    = barH(d.income  ?? 0)
            const eH    = barH(d.expense ?? 0)
            const vH    = barH(d.invested ?? 0)
            const slots = hasInvested ? 3 : 2
            const slotW = (barW - (slots - 1) * 2) / slots
            const net   = (d.income ?? 0) - (d.expense ?? 0)
            const topY  = baseY - Math.max(iH, eH) - 8

            return (
              <g key={i} style={{ cursor: 'default' }}
                onMouseEnter={() => setTooltip({ idx: i, x: bx })}
                onMouseLeave={() => setTooltip(null)}
              >
                {isHov && (
                  <rect x={bx - 4} y={PAD.top} width={barW + 8} height={innerH} fill="rgba(255,255,255,0.04)" rx="4" />
                )}

                {/* Budget income ghost — shown when actual < expected */}
                {d.budgetIncome != null && d.budgetIncome > (d.income ?? 0) && (() => {
                  const bH = barH(d.budgetIncome)
                  return (
                    <rect
                      x={bx} y={baseY - bH}
                      width={slotW} height={bH}
                      fill="var(--success)" opacity={0.12} rx="3"
                      stroke="var(--success)" strokeWidth="1" strokeDasharray="3,2"
                      strokeOpacity={0.4}
                    />
                  )
                })()}

                {/* Income */}
                <rect
                  x={bx} y={baseY - Math.max(iH, iH > 0 ? 2 : 0)}
                  width={slotW} height={Math.max(iH, iH > 0 ? 2 : 0)}
                  fill="var(--success)" opacity={isHov ? 1 : 0.75} rx="3"
                  style={{ transition: 'opacity 0.15s' }}
                />
                {/* Expense */}
                <rect
                  x={bx + slotW + 2} y={baseY - Math.max(eH, eH > 0 ? 2 : 0)}
                  width={slotW} height={Math.max(eH, eH > 0 ? 2 : 0)}
                  fill="var(--danger)" opacity={isHov ? 1 : 0.75} rx="3"
                  style={{ transition: 'opacity 0.15s' }}
                />
                {hasInvested && (
                  <rect
                    x={bx + (slotW + 2) * 2} y={baseY - vH}
                    width={slotW} height={vH}
                    fill="var(--accent)" opacity={isHov ? 1 : 0.75} rx="3"
                    style={{ transition: 'opacity 0.15s' }}
                  />
                )}

                {/* Net savings label above tallest bar */}
                {(d.income ?? 0) + (d.expense ?? 0) > 0 && topY > PAD.top && (
                  <text
                    x={bx + barW / 2} y={topY}
                    textAnchor="middle"
                    fill={net >= 0 ? 'rgba(74,222,128,0.7)' : 'rgba(248,81,73,0.7)'}
                    fontSize="8" fontWeight="600"
                  >
                    {net >= 0 ? '+' : ''}{fmtTick(net)}
                  </text>
                )}

                {/* Month label */}
                <text x={bx + barW / 2} y={H - 8} textAnchor="middle" fill="rgba(255,255,255,0.38)" fontSize="10" fontWeight="500">
                  {d.label}
                </text>
              </g>
            )
          }

          const bH = barH(d.value ?? 0)
          return (
            <g key={i} style={{ cursor: 'default' }}
              onMouseEnter={() => setTooltip({ idx: i, x: bx })}
              onMouseLeave={() => setTooltip(null)}
            >
              {isHov && (
                <rect x={bx - 4} y={PAD.top} width={barW + 8} height={innerH} fill="rgba(255,255,255,0.04)" rx="4" />
              )}
              <rect
                x={bx} y={baseY - Math.max(bH, bH > 0 ? 2 : 0)}
                width={barW} height={Math.max(bH, bH > 0 ? 2 : 0)}
                fill={d.color ?? 'var(--accent)'} opacity={isHov ? 1 : 0.75} rx="3"
                style={{ transition: 'opacity 0.15s' }}
              />
              <text x={bx + barW / 2} y={H - 8} textAnchor="middle" fill="rgba(255,255,255,0.38)" fontSize="10" fontWeight="500">
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
          background: '#131c27',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
          fontSize: '12px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          boxShadow: 'var(--shadow-md)',
          zIndex: 10,
        }}>
          <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 6, fontSize: 11 }}>{hov.label}</div>
          {paired ? (
            <>
              <div style={{ color: 'var(--success)', marginBottom: 2 }}>
                ↑ Entrate &nbsp;{formatValue(hov.income ?? 0)}
                {hov.budgetIncome != null && hov.budgetIncome > (hov.income ?? 0) && (
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, marginLeft: 4 }}>/ {formatValue(hov.budgetIncome)} prev.</span>
                )}
              </div>
              <div style={{ color: 'var(--danger)',  marginBottom: 6 }}>↓ Uscite &nbsp;&nbsp;{formatValue(hov.expense ?? 0)}</div>
              {hasInvested && <div style={{ color: 'var(--accent)', marginBottom: 6 }}>⬡ {formatValue(hov.invested ?? 0)}</div>}
              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: 5,
                fontWeight: 700,
                color: (hov.income ?? 0) - (hov.expense ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)',
              }}>
                = {formatValue((hov.income ?? 0) - (hov.expense ?? 0))}
              </div>
            </>
          ) : (
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatValue(hov.value ?? 0)}</div>
          )}
        </div>
      )}
    </div>
  )
}
