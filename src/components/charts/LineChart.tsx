'use client'

import { useState, useRef, useCallback } from 'react'

interface DataPoint {
  label: string
  value: number
}

interface LineChartProps {
  data: DataPoint[]
  height?: number
  color?: string
  showArea?: boolean
  showCrosshair?: boolean
  showPct?: boolean
  formatValue?: (v: number) => string
  formatLabel?: (l: string) => string
}

export default function LineChart({
  data,
  height = 160,
  color = 'var(--chart-1)',
  showArea = true,
  showCrosshair = true,
  showPct = true,
  formatValue = (v) => v.toFixed(2),
  formatLabel = (l) => l,
}: LineChartProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: DataPoint } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const W = 600
  const H = height
  const PAD = { top: 8, right: 8, bottom: 4, left: 8 }
  const hasData = data && data.length > 0

  const displayData = data
  const values      = displayData.map((d) => d.value)
  const n           = displayData.length

  const minV   = Math.min(...values)
  const maxV   = Math.max(...values)
  const vRange = maxV - minV || 1

  const padBottom = vRange * 0.15
  const padTop    = vRange * 0.08
  const yMin      = minV - padBottom
  const yMax      = maxV + padTop
  const yRange    = yMax - yMin

  const xScale = (i: number) => PAD.left + (i / Math.max(1, n - 1)) * (W - PAD.left - PAD.right)
  const yScale = (v: number) => PAD.top + (1 - (v - yMin) / yRange) * (H - PAD.top - PAD.bottom)

  const points = n > 0 ? displayData.map((d, i) => ({ x: xScale(i), y: yScale(d.value), d })) : []

  function smoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length === 0) return ''
    if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`
    let d = `M${pts[0].x},${pts[0].y}`
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1].x + pts[i].x) / 2
      d += ` C${cpx},${pts[i - 1].y} ${cpx},${pts[i].y} ${pts[i].x},${pts[i].y}`
    }
    return d
  }

  const bottom = H - PAD.bottom

  const linePath = points.length === 1
    ? `M${PAD.left},${points[0].y} L${W - PAD.right},${points[0].y}`
    : smoothPath(points)

  const areaLinePath = points.length === 1
    ? `M${PAD.left},${points[0].y} L${W - PAD.right},${points[0].y}`
    : smoothPath(points)
  const areaPath = points.length === 1
    ? `M${PAD.left},${points[0].y} L${W - PAD.right},${points[0].y} L${W - PAD.right},${bottom} L${PAD.left},${bottom} Z`
    : points.length > 1
      ? `${areaLinePath} L${points[points.length - 1].x},${bottom} L${points[0].x},${bottom} Z`
      : ''

  const gradientId = useRef(`line-grad-${Math.random().toString(36).slice(2)}`).current

  const baseline = displayData.length > 0 ? displayData[0].value : 0
  const displayColor = tooltip && tooltip.point.value < baseline ? '#ef4444' : color

  const numXLabels = Math.min(5, n)
  const xLabelIdxs = numXLabels <= 1
    ? [0]
    : Array.from({ length: numXLabels }, (_, i) => Math.round((i / (numXLabels - 1)) * (n - 1)))

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !showCrosshair || points.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(((relX - PAD.left) / (W - PAD.left - PAD.right)) * (points.length - 1))
    const clamped = Math.max(0, Math.min(points.length - 1, idx))
    setTooltip({ x: points[clamped].x, y: points[clamped].y, point: displayData[clamped] })
  }, [displayData, points, showCrosshair])

  if (!hasData) return null

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block', overflow: 'hidden' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={displayColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={displayColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {showArea && (
          <path d={areaPath} fill={`url(#${gradientId})`} />
        )}

        <path d={linePath} fill="none" stroke={displayColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {points.length > 1 && (
          <line
            x1={PAD.left} y1={points[0].y}
            x2={W - PAD.right} y2={points[0].y}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            strokeDasharray="3,4"
          />
        )}

        {tooltip && (() => {
          const hoverColor = tooltip.point.value >= baseline ? '#22c55e' : '#ef4444'
          return (
            <>
              <line
                x1={tooltip.x} y1={PAD.top}
                x2={tooltip.x} y2={H - PAD.bottom}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <circle cx={tooltip.x} cy={Math.max(PAD.top + 4, Math.min(H - PAD.bottom - 4, tooltip.y))} r="4" fill={hoverColor} />
              <circle cx={tooltip.x} cy={Math.max(PAD.top + 4, Math.min(H - PAD.bottom - 4, tooltip.y))} r="6" fill={hoverColor} fillOpacity="0.2" />
            </>
          )
        })()}
      </svg>

      {/* X-axis labels — first left-aligned, last right-aligned */}
      <div style={{ position: 'relative', height: 20, marginTop: 4 }}>
        {xLabelIdxs.map((idx, i) => {
          const isFirst = i === 0
          const isLast  = i === xLabelIdxs.length - 1
          return (
            <span
              key={idx}
              style={{
                position: 'absolute',
                left: `${(xScale(idx) / W) * 100}%`,
                transform: isFirst ? 'translateX(0)' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
                fontSize: 11,
                color: 'rgba(255,255,255,0.4)',
                whiteSpace: 'nowrap',
                fontWeight: 500,
                userSelect: 'none',
              }}
            >
              {formatLabel(displayData[idx].label)}
            </span>
          )
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (() => {
        const hoverColor = tooltip.point.value >= baseline ? '#22c55e' : '#ef4444'
        const pct = baseline > 0 ? ((tooltip.point.value - baseline) / baseline * 100) : 0
        return (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: (tooltip.x / W) * 100 + '%',
              transform: tooltip.x > W / 2 ? 'translateX(-110%)' : 'translateX(8px)',
              background: '#131c27',
              border: `1px solid ${hoverColor}44`,
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              fontSize: '12px',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              boxShadow: 'var(--shadow-md)',
              zIndex: 10,
            }}
          >
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', marginBottom: 2 }}>
              {formatLabel(tooltip.point.label)}
            </div>
            <div style={{ fontWeight: 700, color: hoverColor, fontVariantNumeric: 'tabular-nums' }}>
              {formatValue(tooltip.point.value)}
            </div>
            {showPct && (
              <div style={{ color: hoverColor, fontSize: '11px', marginTop: 1 }}>
                {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
