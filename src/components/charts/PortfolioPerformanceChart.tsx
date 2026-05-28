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

  // Scale calculations
  const allValues = useMemo(() => {
    if (points.length === 0) return [0, 1]
    const vals: number[] = []
    for (const p of points) {
      vals.push(p.value)
      vals.push(p.invested)
    }
    return vals
  }, [points])

  const minV = Math.min(...allValues)
  const maxV = Math.max(...allValues)
  const vRange = maxV - minV || 1
  const yMin = minV - vRange * 0.08
  const yMax = maxV + vRange * 0.06
  const yRange = yMax - yMin

  const n = points.length
  const xScale = (i: number) => PAD.left + (i / Math.max(1, n - 1)) * (W - PAD.left - PAD.right)
  const yScale = (v: number) => PAD.top + (1 - (v - yMin) / yRange) * (H - PAD.top - PAD.bottom)

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
    points.map((p, i) => ({ x: xScale(i), y: yScale(p.value) })),
    [points, n] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const investedPoints = useMemo(() =>
    points.map((p, i) => ({ x: xScale(i), y: yScale(p.invested) })),
    [points, n] // eslint-disable-line react-hooks/exhaustive-deps
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

  const chartSubtitle = subtitle || (timeframe === '1G' ? 'Oggi'
    : timeframe === '1S' ? '1 settimana'
    : timeframe === '1M' ? '1 mese'
    : timeframe === '1A' ? '1 anno'
    : 'Tutto')

  if (points.length < 3) {
    return (
      <div className="pfchart">
        <div className="pfchart-header">
          <div className="pfchart-value-section">
            <div className="pfchart-title">{chartTitle}</div>
            <div className="pfchart-subtitle">{t('noData', { fallback: 'Raccolta dati in corso...' })}</div>
            {currentValue > 0 && <div className="pfchart-value">{fmt0(currentValue)}</div>}
          </div>
          <div className="pfchart-tabs">
            {ALL_TIMEFRAMES.map(tf => (
              <button key={tf} className="pfchart-tab is-locked" disabled>{tf}</button>
            ))}
          </div>
        </div>
        <div className="pfchart-empty">
          <div className="pfchart-empty-icon">📈</div>
          <p>{t('chartWaiting', { fallback: 'Il grafico si costruirà automaticamente. Tieni aperta l\'app per raccogliere dati.' })}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pfchart">
      {/* ── Header ── */}
      <div className="pfchart-header">
        <div className="pfchart-value-section">
          <div className="pfchart-title">{chartTitle}</div>
          <div className="pfchart-subtitle">Valore complessivo · {chartSubtitle}</div>
          <div className="pfchart-value">{fmt0(displayValue)}</div>
          <div className="pfchart-metrics">
            <span className={`pfchart-delta ${displayGain >= 0 ? 'is-up' : 'is-down'}`}>
              {displayGain >= 0 ? '+' : ''}{fmt(displayGain)}
              <span className="pfchart-delta-pct">({displayGainPct >= 0 ? '+' : ''}{displayGainPct.toFixed(2)}%)</span>
            </span>
          </div>
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
          Valore
        </span>
        <span className="pfchart-legend-item">
          <i className="pfchart-legend-line pfchart-legend-dashed" />
          {t('invested', { fallback: 'Investito' })}
        </span>
      </div>
    </div>
  )
}
