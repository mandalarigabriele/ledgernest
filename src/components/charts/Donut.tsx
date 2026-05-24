'use client'

import { useState } from 'react'

interface Slice {
  label: string
  value: number
  color: string
}

interface DonutProps {
  data: Slice[]
  size?: number
  thickness?: number
  label?: string
  sublabel?: string
}

export default function Donut({ data, size = 180, thickness = 28, label, sublabel }: DonutProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  if (!data || data.length === 0) return null

  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const R = size / 2
  const innerR = R - thickness
  const cx = R
  const cy = R
  const GAP = 1.5 // degrees gap between slices

  // Build arcs
  const slices: { d: string; color: string; label: string; value: number; pct: number }[] = []
  let angle = -90

  for (let i = 0; i < data.length; i++) {
    const slice = data[i]
    const pct = slice.value / total
    const deg = pct * 360 - GAP
    if (deg <= 0) { angle += pct * 360; continue }

    const startRad = (angle * Math.PI) / 180
    const endRad = ((angle + deg) * Math.PI) / 180

    const x1 = cx + R * Math.cos(startRad)
    const y1 = cy + R * Math.sin(startRad)
    const x2 = cx + R * Math.cos(endRad)
    const y2 = cy + R * Math.sin(endRad)
    const ix1 = cx + innerR * Math.cos(startRad)
    const iy1 = cy + innerR * Math.sin(startRad)
    const ix2 = cx + innerR * Math.cos(endRad)
    const iy2 = cy + innerR * Math.sin(endRad)
    const large = deg > 180 ? 1 : 0

    const d = `M${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${innerR},${innerR} 0 ${large},0 ${ix1},${iy1} Z`
    slices.push({ d, color: slice.color, label: slice.label, value: slice.value, pct })
    angle += pct * 360
  }

  const hov = hovered !== null ? data[hovered] : null

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill={s.color}
            opacity={hovered === null || hovered === i ? 1 : 0.4}
            style={{ transition: 'opacity 0.15s', cursor: 'pointer' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>

      {/* Center label */}
      <div style={{
        position: 'absolute',
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: size > 140 ? '15px' : '12px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
        }}>
          {hov ? `${(hov.value / total * 100).toFixed(1)}%` : (label ?? '')}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          {hov ? hov.label : (sublabel ?? '')}
        </div>
      </div>
    </div>
  )
}
