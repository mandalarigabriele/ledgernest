'use client'

interface DivEvent {
  week: number
  day: number
  ticker: string
}

interface DivCalendarProps {
  events: DivEvent[]
  height?: number
}

export default function DivCalendar({ events, height = 210 }: DivCalendarProps) {
  const weeks = 12
  const days = 5
  const W = 720
  const pad = { l: 28, r: 8, t: 18, b: 8 }
  const cw = (W - pad.l - pad.r) / weeks
  const ch = (height - pad.t - pad.b) / days
  const dayLabels = ['L', 'M', 'M', 'G', 'V']

  const map = new Map<string, DivEvent[]>()
  events.forEach((e) => {
    const k = `${e.week}-${e.day}`
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(e)
  })

  // Week header labels (every 4 weeks)
  const weekHeaders = [0, 4, 8].map((w) => ({
    w,
    label: ['Giu','Lug','Ago','Set','Ott','Nov','Dic','Gen','Feb','Mar','Apr','Mag'][w] ?? '',
  }))

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
      {dayLabels.map((l, i) => (
        <text key={i}
          x={pad.l - 8}
          y={pad.t + ch * i + ch / 2 + 3.5}
          textAnchor="end"
          fill="var(--text-secondary)"
          fontSize="10"
          fontFamily="inherit"
        >{l}</text>
      ))}
      {weekHeaders.map(({ w, label }) => (
        <text key={w}
          x={pad.l + cw * w + cw / 2}
          y={pad.t - 4}
          textAnchor="middle"
          fill="var(--text-secondary)"
          fontSize="10"
          fontFamily="inherit"
        >{label}</text>
      ))}
      {Array.from({ length: weeks * days }).map((_, k) => {
        const wi = k % weeks
        const d = Math.floor(k / weeks)
        const ev = map.get(`${wi}-${d}`)
        return (
          <g key={k}>
            <rect
              x={pad.l + cw * wi + 1.5}
              y={pad.t + ch * d + 1.5}
              width={cw - 3}
              height={ch - 3}
              rx="4"
              fill={ev ? 'var(--accent)' : 'var(--border-subtle)'}
              opacity={ev ? Math.min(0.25 + ev.length * 0.25, 1) : 0.35}
            />
            {ev && (
              <text
                x={pad.l + cw * wi + cw / 2}
                y={pad.t + ch * d + ch / 2 + 3.5}
                textAnchor="middle"
                fontSize="9"
                fontFamily="inherit"
                fill="var(--bg)"
                opacity="0.85"
                fontWeight="600"
              >
                {ev[0].ticker.slice(0, 3)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
