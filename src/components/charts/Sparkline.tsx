'use client'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  positive?: boolean
}

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  positive?: boolean
  responsive?: boolean
}

export default function Sparkline({ data, width = 80, height = 32, color, positive, responsive = false }: SparklineProps) {
  if (!data || data.length < 2) return null

  const W = 100 // internal viewBox units always 100
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const trend = data[data.length - 1] >= data[0]
  const c = color ?? (positive !== undefined ? (positive ? 'var(--success)' : 'var(--danger)') : (trend ? 'var(--success)' : 'var(--danger)'))

  function x(i: number) { return (i / (data.length - 1)) * W }
  function y(v: number) { return height - ((v - min) / range) * height }

  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ')

  if (responsive) {
    return (
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }} className="ledgernest-spark">
        <path d={line} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    )
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${W} ${height}`} className="ledgernest-spark">
      <path d={line} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
