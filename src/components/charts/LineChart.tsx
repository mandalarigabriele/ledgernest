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
  formatValue?: (v: number) => string
  formatLabel?: (l: string) => string
}

export default function LineChart({
  data,
  height = 160,
  color = 'var(--chart-1)',
  showArea = true,
  showCrosshair = true,
  formatValue = (v) => v.toFixed(2),
  formatLabel = (l) => l,
}: LineChartProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: DataPoint } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  if (!data || data.length === 0) return null

  const W = 600
  const H = height
  const PAD = { top: 8, right: 8, bottom: 24, left: 8 }

  const values = data.map((d) => d.value)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const range = maxV - minV || 1

  function xScale(i: number) {
    return PAD.left + (i / (data.length - 1)) * (W - PAD.left - PAD.right)
  }

  function yScale(v: number) {
    return PAD.top + (1 - (v - minV) / range) * (H - PAD.top - PAD.bottom)
  }

  const points = data.map((d, i) => ({ x: xScale(i), y: yScale(d.value), d }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1].x},${H - PAD.bottom} L${points[0].x},${H - PAD.bottom} Z`

  const gradientId = `line-grad-${Math.random().toString(36).slice(2)}`

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !showCrosshair) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(((relX - PAD.left) / (W - PAD.left - PAD.right)) * (data.length - 1))
    const clamped = Math.max(0, Math.min(data.length - 1, idx))
    setTooltip({ x: points[clamped].x, y: points[clamped].y, point: data[clamped] })
  }, [data, points, showCrosshair])

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block', overflow: 'visible' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Area */}
        {showArea && (
          <path d={areaPath} fill={`url(#${gradientId})`} />
        )}

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Crosshair */}
        {tooltip && (
          <>
            <line
              x1={tooltip.x} y1={PAD.top}
              x2={tooltip.x} y2={H - PAD.bottom}
              stroke="var(--border-default)"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            <circle cx={tooltip.x} cy={tooltip.y} r="4" fill={color} />
            <circle cx={tooltip.x} cy={tooltip.y} r="6" fill={color} fillOpacity="0.2" />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: (tooltip.x / W) * 100 + '%',
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
          }}
        >
          <div style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
            {formatLabel(tooltip.point.label)}
          </div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {formatValue(tooltip.point.value)}
          </div>
        </div>
      )}
    </div>
  )
}
