'use client'

interface TreemapItem {
  label: string
  value: number
  cat: 'azioni' | 'etf' | 'crypto' | string
}

interface TreemapProps {
  data: TreemapItem[]
  height?: number
}

const CAT_COLOR: Record<string, string> = {
  stock:     'var(--accent)',
  etf:       'var(--c-violet, #7c6df7)',
  crypto:    'var(--c-amber, #f77c3a)',
  bond:      'var(--success, #3fb950)',
  commodity: 'var(--c-amber, #f77c3a)',
}

export default function Treemap({ data, height = 210 }: TreemapProps) {
  const W = 720
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 8)
  const topCount = Math.ceil(sorted.length / 2)
  const top = sorted.slice(0, topCount)
  const bot = sorted.slice(topCount)
  const topSum = top.reduce((s, d) => s + d.value, 0)
  const botSum = bot.reduce((s, d) => s + d.value, 0)
  const topH = (topSum / (topSum + botSum)) * height
  const botH = height - topH

  function renderRow(items: TreemapItem[], y: number, rowH: number, rowSum: number) {
    let x = 0
    return items.map((d, i) => {
      const w = (d.value / rowSum) * W
      const color = CAT_COLOR[d.cat.toLowerCase()] || 'var(--accent)'
      const opacity = 0.18 + (d.value / total) * 1.8
      const el = (
        <g key={d.label + i}>
          <rect x={x + 2} y={y + 2} width={w - 4} height={rowH - 4} rx="8"
            fill={color} opacity={Math.min(opacity, 1)} />
          <text x={x + 12} y={y + 22} fill="var(--text-primary)"
            fontSize="13" fontWeight="600" fontFamily="inherit">{d.label}</text>
          {rowH > 50 && (
            <text x={x + 12} y={y + 40} fill="var(--text-secondary)"
              fontSize="11" fontFamily="inherit">
              {d.value >= 1_000_000 ? `€${(d.value / 1_000_000).toFixed(1)}M` : d.value >= 1000 ? `€${(d.value / 1000).toFixed(1)}k` : `€${Math.round(d.value)}`}
            </text>
          )}
        </g>
      )
      x += w
      return el
    })
  }

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
      {renderRow(top, 0, topH, topSum)}
      {renderRow(bot, topH, botH, botSum)}
    </svg>
  )
}
