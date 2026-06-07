'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { usePortfolioChart, Timeframe, ALL_TIMEFRAMES, AssetFilter } from '@/hooks/usePortfolioChart'
import { useFormatters } from '@/hooks/useFormatters'
import { useTranslations } from 'next-intl'

interface Props {
  filter?: AssetFilter
  title?: string
  subtitle?: string
}

export default function PortfolioPerformanceChart({ filter = 'all', title, subtitle }: Props) {
  const t = useTranslations('dashboard')
  const { fmt0, fmt } = useFormatters()
  const [timeframe, setTimeframe] = useState<Timeframe>('MAX')
  const { points, currentValue, totalInvested, gainAbs, gainPct, availableTimeframes } = usePortfolioChart(timeframe, filter)

  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [mode, setMode] = useState<'abs' | 'pct'>('abs')
  const svgRef = useRef<SVGSVGElement>(null)

  // Chart dimensions
  const W = 600
  const H = 200
  const PAD = { top: 16, right: 12, bottom: 8, left: 12 }

  // Active display values (hover or current)
  const activePoint = hoverIdx !== null && points[hoverIdx] ? points[hoverIdx] : null
  const displayValue = activePoint ? activePoint.value : currentValue
  const displayInvested = activePoint ? activePoint.invested : totalInvested
  const displayGain = displayValue - displayInvested
  const displayGainPct = displayInvested > 0 ? (displayGain / displayInvested) * 100 : 0

  // % return per point (for pct mode)
  const pctValues = useMemo(() =>
    points.map(p => p.invested > 0 ? (p.value / p.invested - 1) * 100 : 0),
    [points]
  )

  // Scale calculations — abs mode
  const allValues = useMemo(() => {
    if (points.length === 0) return [0, 1]
    return points.map(p => p.value)
  }, [points])

  const minV = Math.min(...allValues)
  const maxV = Math.max(...allValues)
  const vRange = maxV - minV || 1
  const yMin = minV - vRange * 0.15
  const yMax = maxV + vRange * 0.08
  const yRange = yMax - yMin

  // Scale calculations — pct mode
  const pctMin = pctValues.length ? Math.min(...pctValues) : -1
  const pctMax = pctValues.length ? Math.max(...pctValues) :  1
  const pctVRange = pctMax - pctMin || 1
  const pctYMin = pctMin - pctVRange * 0.15
  const pctYMax = pctMax + pctVRange * 0.08
  const pctYRange = pctYMax - pctYMin

  const n = points.length
  const xScale  = (i: number) => PAD.left + (i / Math.max(1, n - 1)) * (W - PAD.left - PAD.right)
  const yScale  = (v: number) => PAD.top + (1 - (v - yMin)    / yRange)    * (H - PAD.top - PAD.bottom)
  const pScale  = (v: number) => PAD.top + (1 - (v - pctYMin) / pctYRange) * (H - PAD.top - PAD.bottom)

  // Build paths
  const buildSmoothPath = (pts: { x: number; y: number }[]): string => {
    if (pts.length === 0) return ''
    if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`
    let d = `M${pts[0].x},${pts[0].y}`
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1].x + pts[i].x) / 2
      d += ` C${cpx},${pts[i - 1].y} ${cpx},${pts[i].y} ${pts[i].x},${pts[i].y}`
    }
    return d
  }

  const valuePoints = useMemo(() =>
    mode === 'pct'
      ? pctValues.map((pct, i) => ({ x: xScale(i), y: pScale(pct) }))
      : points.map((p, i) => ({ x: xScale(i), y: yScale(p.value) })),
    [points, n, mode] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const investedPoints = useMemo(() =>
    mode === 'pct'
      ? points.map((_, i) => ({ x: xScale(i), y: pScale(0) }))
      : points.map((p, i) => ({ x: xScale(i), y: yScale(p.invested) })),
    [points, n, mode] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const valuePath = buildSmoothPath(valuePoints)
  const investedPath = buildSmoothPath(investedPoints)
  const bottom = H - PAD.bottom

  const areaPath = valuePoints.length > 1
    ? `${valuePath} L${valuePoints[valuePoints.length - 1].x},${bottom} L${valuePoints[0].x},${bottom} Z`
    : ''

  const gradientId = useRef(`perf-grad-${Math.random().toString(36).slice(2)}`).current
  const isPositive = gainAbs >= 0
  const accentColor = isPositive ? '#22c55e' : '#ef4444'

  // Mouse/touch interaction
  const handlePointer = useCallback((e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const relX = ((clientX - rect.left) / rect.width) * W
    const idx = Math.round(((relX - PAD.left) / (W - PAD.left - PAD.right)) * (n - 1))
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)))
  }, [points.length, n]) // eslint-disable-line react-hooks/exhaustive-deps

  // Format date for X-axis labels
  const formatDateLabel = (iso: string) => {
    const d = new Date(iso)
    if (timeframe === '1G') return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  }

  // X-axis labels
  const numLabels = Math.min(5, n)
  const labelIdxs = numLabels <= 1 ? [0] : Array.from({ length: numLabels }, (_, i) => Math.round((i / (numLabels - 1)) * (n - 1)))

  // Default titles
  const chartTitle = title || (filter === 'stocks' ? t('stocksPerformance', { fallback: 'Andamento azioni' })
    : filter === 'etf' ? t('etfPerformance', { fallback: 'Andamento ETF' })
    : filter === 'crypto' ? t('cryptoPerformance', { fallback: 'Andamento crypto' })
    : t('investments'))

  const chartSubtitle = subtitle || (timeframe === '1G' ? t('pfPeriodToday')
    : timeframe === '1S' ? t('pfPeriodWeek')
    : timeframe === '1M' ? t('pfPeriodMonth')
    : timeframe === '1A' ? t('pfPeriodYear')
    : t('pfPeriodAll'))

  if (points.length < 2) {
    return (
      <div className="pfchart">
        <div className="pfchart-header">
          <div className="pfchart-value-section">
            <div className="pfchart-title">{chartTitle}</div>
            <div className="pfchart-subtitle">{t('noData')}</div>
            {currentValue > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>{t('portfolioValueNow')}</div>
                <div className="pfchart-value">{fmt0(currentValue)}</div>
              </>
            )}
          </div>
          <div className="pfchart-tabs">
            {ALL_TIMEFRAMES.map(tf => (
              <button key={tf} className="pfchart-tab is-locked" disabled>{tf}</button>
            ))}
          </div>
        </div>
        <div className="pfchart-empty">
          <div className="pfchart-empty-icon">📈</div>
          <p>{t('chartWaiting')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pfchart">
      {/* ── Header ── */}
      <div className="pfchart-header">
        <div className="pfchart-value-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="pfchart-title">{chartTitle}</div>
            <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 2, gap: 1 }}>
              {(['abs', 'pct'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: mode === m ? 'var(--accent)' : 'transparent',
                    color: mode === m ? 'var(--text-on-accent)' : 'var(--text-tertiary)',
                    transition: 'all .15s',
                  }}
                >{m === 'abs' ? '€' : '%'}</button>
              ))}
            </div>
          </div>
          <div className="pfchart-subtitle">{t('pfSubtitle')} · {chartSubtitle}</div>
          {mode === 'abs' ? (
            <>
              <div className="pfchart-value">{fmt(displayValue)}</div>
              <div className="pfchart-metrics">
                <span className={`pfchart-delta ${displayGain >= 0 ? 'is-up' : 'is-down'}`}>
                  {displayGain >= 0 ? '+' : ''}{fmt(displayGain)}
                  <span className="pfchart-delta-pct">({displayGainPct >= 0 ? '+' : ''}{displayGainPct.toFixed(2)}%)</span>
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="pfchart-value">
                {displayGainPct >= 0 ? '+' : ''}{displayGainPct.toFixed(2)}%
              </div>
              <div className="pfchart-metrics">
                <span className={`pfchart-delta ${displayGain >= 0 ? 'is-up' : 'is-down'}`}>
                  {displayGain >= 0 ? '+' : ''}{fmt(displayGain)}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="pfchart-tabs">
          {ALL_TIMEFRAMES.map(tf => {
            const available = availableTimeframes.includes(tf)
            return (
              <button
                key={tf}
                className={`pfchart-tab ${tf === timeframe ? 'is-active' : ''} ${!available ? 'is-locked' : ''}`}
                onClick={() => available && setTimeframe(tf)}
                disabled={!available}
                title={!available ? 'Non abbastanza dati' : undefined}
              >
                {tf}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="pfchart-canvas">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="pfchart-svg"
          onMouseMove={handlePointer}
          onTouchMove={handlePointer}
          onMouseLeave={() => setHoverIdx(null)}
          onTouchEnd={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.20" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

          {/* Invested line (dashed) */}
          {investedPath && (
            <path
              d={investedPath}
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1.5"
              strokeDasharray="4,4"
              strokeLinecap="round"
            />
          )}

          {/* Portfolio value line */}
          {valuePath && (
            <path
              d={valuePath}
              fill="none"
              stroke={accentColor}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Crosshair */}
          {hoverIdx !== null && valuePoints[hoverIdx] && (
            <>
              <line
                x1={valuePoints[hoverIdx].x}
                y1={PAD.top}
                x2={valuePoints[hoverIdx].x}
                y2={H - PAD.bottom}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <circle cx={valuePoints[hoverIdx].x} cy={valuePoints[hoverIdx].y} r="4.5" fill={accentColor} />
              <circle cx={valuePoints[hoverIdx].x} cy={valuePoints[hoverIdx].y} r="7" fill={accentColor} fillOpacity="0.2" />
              {investedPoints[hoverIdx] && (
                <circle cx={investedPoints[hoverIdx].x} cy={investedPoints[hoverIdx].y} r="3" fill="rgba(255,255,255,0.5)" />
              )}
            </>
          )}
        </svg>

        {/* Hover tooltip */}
        {hoverIdx !== null && valuePoints[hoverIdx] && (() => {
          const hx = valuePoints[hoverIdx].x
          const hy = valuePoints[hoverIdx].y
          const p  = points[hoverIdx]
          const d  = new Date(p.date)
          const dateStr = timeframe === '1G'
            ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          const g    = p.value - p.invested
          const gPct = p.invested > 0 ? (g / p.invested) * 100 : 0
          const isUp = g >= 0
          return (
            <div style={{
              position: 'absolute',
              left: `${(hx / W) * 100}%`,
              top:  `${(hy / H) * 100}%`,
              transform: `translate(${hx > W * 0.65 ? 'calc(-100% - 10px)' : '10px'}, -50%)`,
              pointerEvents: 'none',
              background: 'var(--bg-surface)',
              border: `1px solid ${accentColor}55`,
              borderRadius: 8,
              padding: '6px 12px',
              whiteSpace: 'nowrap',
              zIndex: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>{dateStr}</div>
              <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                {mode === 'pct' ? `${gPct >= 0 ? '+' : ''}${gPct.toFixed(2)}%` : fmt(p.value)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: isUp ? 'var(--success)' : 'var(--danger)', marginTop: 1 }}>
                {isUp ? '+' : ''}{fmt(g)}{mode === 'abs' ? ` (${isUp ? '+' : ''}${gPct.toFixed(2)}%)` : ''}
              </div>
            </div>
          )
        })()}

        {/* X-axis labels */}
        <div className="pfchart-x-labels">
          {labelIdxs.map((idx) => (
            <span key={idx} style={{ left: `${(xScale(idx) / W) * 100}%` }}>
              {formatDateLabel(points[idx]?.date || '')}
            </span>
          ))}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="pfchart-legend">
        <span className="pfchart-legend-item">
          <i className="pfchart-legend-line" style={{ background: accentColor }} />
          {t('pfValueLabel')}
        </span>
        <span className="pfchart-legend-item">
          <i className="pfchart-legend-line pfchart-legend-dashed" />
          {mode === 'pct' ? '0%' : t('invested')}
        </span>
      </div>
    </div>
  )
}
