'use client'

interface CircularProgressProps {
  value: number   // 0-100
  size?: number
  thickness?: number
  color?: string
  label?: string
  sublabel?: string
  fontSize?: number
}

export default function CircularProgress({
  value,
  size = 140,
  thickness = 12,
  color = 'var(--accent)',
  label,
  sublabel,
  fontSize,
}: CircularProgressProps) {
  const R = (size - thickness) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * R
  const pct = Math.min(100, Math.max(0, value))
  const offset = circ - (pct / 100) * circ

  return (
    <div className="ledgernest-circular" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke="var(--bg-elevated)"
          strokeWidth={thickness}
        />
        {/* Progress */}
        <circle
          cx={cx} cy={cy} r={R}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="ledgernest-circular-label">
        <div className="ledgernest-circular-value" style={fontSize ? { fontSize } : undefined}>{label ?? `${pct.toFixed(0)}%`}</div>
        {sublabel && <div className="ledgernest-circular-sub">{sublabel}</div>}
      </div>
    </div>
  )
}
