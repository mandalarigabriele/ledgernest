'use client'

interface SectorRow {
  label: string
  value: number
  pct: number
  color?: string
}

interface SectorBarsProps {
  data: SectorRow[]
  formatValue?: (v: number) => string
}

export default function SectorBars({ data, formatValue = (v) => `${v.toFixed(1)}%` }: SectorBarsProps) {
  if (!data || data.length === 0) return null

  return (
    <div>
      {data.map((row, i) => (
        <div key={i} className="ledgernest-sector-row">
          <div className="ledgernest-sector-label" title={row.label}>{row.label}</div>
          <div className="ledgernest-sector-bar-wrap">
            <div
              className="ledgernest-sector-bar-fill"
              style={{
                width: `${Math.min(100, row.pct)}%`,
                background: row.color ?? 'var(--accent)',
              }}
            />
          </div>
          <div className="ledgernest-sector-pct">{formatValue(row.pct)}</div>
        </div>
      ))}
    </div>
  )
}
