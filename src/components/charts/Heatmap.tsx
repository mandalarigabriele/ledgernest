'use client'

interface HeatmapProps {
  rows: string[]
  cols: string[]
  data: number[][]
  height?: number
}

export default function Heatmap({ rows, cols, data, height = 210 }: HeatmapProps) {
  const pad = { l: 70, r: 8, t: 18, b: 8 }
  const W = 720
  const H = height - pad.t - pad.b
  const cw = (W - pad.l - pad.r) / cols.length
  const ch = H / rows.length

  function colorFor(v: number) {
    const t = Math.max(-1, Math.min(1, v / 10))
    if (t >= 0) {
      const a = 0.15 + t * 0.85
      return `oklch(0.78 0.16 155 / ${a})`
    } else {
      const a = 0.15 + Math.abs(t) * 0.85
      return `oklch(0.70 0.18 28 / ${a})`
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
      {cols.map((c, i) => (
        <text
          key={i}
          x={pad.l + cw * i + cw / 2}
          y={pad.t - 4}
          textAnchor="middle"
          fill="var(--text-secondary)"
          fontSize="10"
          fontFamily="inherit"
        >{c}</text>
      ))}
      {rows.map((r, ri) => (
        <text
          key={ri}
          x={pad.l - 8}
          y={pad.t + ch * ri + ch / 2 + 4}
          textAnchor="end"
          fill="var(--text-primary)"
          fontSize="11"
          fontFamily="inherit"
        >{r}</text>
      ))}
      {data.map((row, ri) =>
        row.map((v, ci) => (
          <g key={`${ri}-${ci}`}>
            <rect
              x={pad.l + cw * ci + 1.5}
              y={pad.t + ch * ri + 1.5}
              width={cw - 3}
              height={ch - 3}
              rx="4"
              fill={colorFor(v)}
            />
            <text
              x={pad.l + cw * ci + cw / 2}
              y={pad.t + ch * ri + ch / 2 + 3.5}
              textAnchor="middle"
              fontSize="10.5"
              fontFamily="inherit"
              fill={Math.abs(v) > 6 ? '#0b0f12' : 'var(--text-primary)'}
              opacity={Math.abs(v) > 6 ? 0.9 : 0.7}
            >
              {v > 0 ? `+${v}` : v}
            </text>
          </g>
        ))
      )}
    </svg>
  )
}
