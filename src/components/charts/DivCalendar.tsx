'use client'

import { useState } from 'react'

export interface DivEvent {
  date: string    // "YYYY-MM-DD"
  ticker: string
  amount?: number
}

interface DivCalendarProps {
  events: DivEvent[]
  height?: number
}

const IT_M = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

export default function DivCalendar({ events, height = 210 }: DivCalendarProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  const WEEKS     = 12
  const DAYS      = 5   // Mon–Fri
  const W         = 720
  const pad       = { l: 28, r: 8, t: 22, b: 8 }
  const cw        = (W - pad.l - pad.r) / WEEKS
  const ch        = (height - pad.t - pad.b) / DAYS
  const dayLabels = ['L', 'M', 'M', 'G', 'V']

  // Monday of the current week
  const now = new Date()
  const dow = now.getDay() === 0 ? 6 : now.getDay() - 1   // 0=Mon … 4=Fri
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dow)
  weekStart.setHours(0, 0, 0, 0)

  // Map events to grid cells
  const map = new Map<string, DivEvent[]>()
  for (const ev of events) {
    const evDate      = new Date(ev.date + 'T12:00:00')
    const msFromStart = evDate.getTime() - weekStart.getTime()
    const daysFrom    = Math.floor(msFromStart / 86400000)
    const week        = Math.floor(daysFrom / 7)
    const day         = daysFrom % 7
    if (week < 0 || week >= WEEKS || day < 0 || day >= DAYS) continue
    const k = `${week}-${day}`
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(ev)
  }

  // Month header labels — emit label when month changes across weeks
  const monthLabels: { wi: number; label: string }[] = []
  let lastMonth = -1
  for (let wi = 0; wi < WEEKS; wi++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + wi * 7)
    const m = d.getMonth()
    if (m !== lastMonth) {
      monthLabels.push({ wi, label: IT_M[m] })
      lastMonth = m
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} style={{ display: 'block' }}>

        {/* Day labels (L M M G V) */}
        {dayLabels.map((l, i) => (
          <text key={i}
            x={pad.l - 8} y={pad.t + ch * i + ch / 2 + 3.5}
            textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="inherit"
          >{l}</text>
        ))}

        {/* Month labels */}
        {monthLabels.map(({ wi, label }) => (
          <text key={wi}
            x={pad.l + cw * wi + 3} y={pad.t - 6}
            textAnchor="start" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="inherit"
          >{label}</text>
        ))}

        {/* Grid cells */}
        {Array.from({ length: WEEKS * DAYS }).map((_, k) => {
          const wi  = k % WEEKS
          const d   = Math.floor(k / WEEKS)
          const ev  = map.get(`${wi}-${d}`)
          const key = `${wi}-${d}`
          const isHov = hovered === key
          return (
            <g key={k}
              onMouseEnter={() => ev && setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: ev ? 'pointer' : 'default' }}
            >
              <rect
                x={pad.l + cw * wi + 1.5} y={pad.t + ch * d + 1.5}
                width={cw - 3} height={ch - 3}
                rx="4"
                fill={ev ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}
                opacity={ev ? (isHov ? 1 : Math.min(0.35 + ev.length * 0.2, 1)) : 1}
              />
              {ev && (
                <text
                  x={pad.l + cw * wi + cw / 2} y={pad.t + ch * d + ch / 2 + 3.5}
                  textAnchor="middle" fontSize="9" fontFamily="inherit"
                  fill="var(--bg)" opacity="0.9" fontWeight="600"
                >
                  {ev[0].ticker.replace(/-USD$|-EUR$/, '').slice(0, 4)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hovered && map.has(hovered) && (() => {
        const evs = map.get(hovered)!
        const wi  = parseInt(hovered.split('-')[0])
        const leftPct = ((pad.l + cw * wi) / W) * 100
        return (
          <div style={{
            position: 'absolute', top: 24,
            left: leftPct + '%',
            transform: wi > WEEKS / 2 ? 'translateX(-110%)' : 'translateX(6px)',
            background: '#131c27',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 10px', fontSize: 12,
            pointerEvents: 'none', whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-md)', zIndex: 10,
          }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginBottom: 4 }}>
              {new Date(evs[0].date + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
            </div>
            {evs.map((e, i) => (
              <div key={i} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {e.ticker}{e.amount != null ? ` · $${e.amount.toFixed(3)}` : ''}
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
