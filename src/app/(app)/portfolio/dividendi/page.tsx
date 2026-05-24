'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePricesStore } from '@/stores/pricesStore'
import { fmtEur, fmtDateShort } from '@/lib/utils/format'
import type { Dividend, PortfolioPosition } from '@/types'

// ── constants ────────────────────────────────────────────────

const IT_MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const IT_DAYS   = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

// ETF ticker prefixes/suffixes that signal accumulating (no distribution)
const ACC_TICKERS = new Set(['VWCE', 'IWDA', 'CSPX', 'EUNL', 'SWRD', 'IUSQ', 'SPYL', 'LCUW'])

function toYMD(d: Date) { return d.toISOString().slice(0, 10) }
function addMonths(d: Date, m: number) {
  const r = new Date(d); r.setMonth(r.getMonth() + m); return r
}

// ── per-position dividend stats ──────────────────────────────

interface DivRow {
  pos: PortfolioPosition
  recentDivs: Dividend[]
  annualIncome: number
  perShareAnnual: number
  yieldPct: number
  freq: string
  freqMonths: number
  nextDate: string | null
  status: 'confermato' | 'stimato' | 'reinvestito'
}

function computeDivRows(
  positions: PortfolioPosition[],
  dividends: Dividend[],
  eurUsd: number
): DivRow[] {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const oneYearAgo = addMonths(now, -12)

  return positions
    .filter(p => p.type !== 'crypto')
    .map((pos): DivRow => {
      // Accumulating ETF → reinvestito
      const isAcc = pos.type === 'etf' && (
        ACC_TICKERS.has(pos.ticker) ||
        pos.ticker.endsWith('C') && pos.type === 'etf' ||
        pos.name?.toLowerCase().includes(' acc')
      )
      if (isAcc) return {
        pos, recentDivs: [], annualIncome: 0, perShareAnnual: 0,
        yieldPct: 0, freq: 'Acc.', freqMonths: 0, nextDate: null, status: 'reinvestito',
      }

      const posDivs = dividends.filter(d => d.positionId === pos.id)
      const recentDivs = posDivs.filter(d => new Date(d.payDate) >= oneYearAgo)

      const toEur = (d: Dividend) => d.currency === 'EUR' ? d.amount : d.amount / eurUsd
      const annualIncome = recentDivs.reduce((s, d) => s + toEur(d), 0)
      const perShareAnnual = pos.quantity > 0 ? annualIncome / pos.quantity : 0
      const posValEur = pos.currency === 'EUR'
        ? pos.avgPrice * pos.quantity
        : pos.avgPrice * pos.quantity / eurUsd
      const yieldPct = posValEur > 0 ? (annualIncome / posValEur) * 100 : 0

      // Frequency from payment count last 12 months
      const n = recentDivs.length
      let freq = 'Ann.'; let freqMonths = 12
      if (n >= 10) { freq = 'Mens.'; freqMonths = 1 }
      else if (n >= 3) { freq = 'Trim.'; freqMonths = 3 }
      else if (n >= 2) { freq = 'Sem.'; freqMonths = 6 }

      // Next date
      const sortedAll = [...posDivs].sort((a, b) => b.payDate.localeCompare(a.payDate))
      const lastDiv = sortedAll[0]

      let nextDate: string | null = null
      let status: DivRow['status'] = 'stimato'

      if (lastDiv && freqMonths > 0) {
        let next = addMonths(new Date(lastDiv.payDate), freqMonths)
        while (next <= now) next = addMonths(next, freqMonths)
        nextDate = toYMD(next)
      }

      // Override with confirmed future dividend if any
      const futureDivs = posDivs.filter(d => new Date(d.payDate) > now)
      if (futureDivs.length > 0) {
        const nearest = futureDivs.sort((a, b) => a.payDate.localeCompare(b.payDate))[0]
        nextDate = nearest.payDate
        status = 'confermato'
      }

      return { pos, recentDivs, annualIncome, perShareAnnual, yieldPct, freq, freqMonths, nextDate, status }
    })
    .filter(r => r.recentDivs.length > 0 || r.status === 'reinvestito')
}

// ── monthly bar chart ────────────────────────────────────────

function MonthlyChart({ data }: { data: { label: string; value: number; future: boolean }[] }) {
  const maxV = Math.max(...data.map(d => d.value), 1)
  const W = 480; const H = 150
  const P = { t: 24, b: 26, l: 34, r: 4 }
  const cW = W - P.l - P.r; const cH = H - P.t - P.b
  const n = data.length
  const barW = Math.max(8, Math.floor(cW / n) - 4)
  const yTicks = [0, Math.round(maxV / 2), Math.round(maxV)]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      {yTicks.map(v => {
        const y = P.t + cH - (v / maxV) * cH
        return (
          <g key={v}>
            <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={P.l - 4} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-tertiary)" fontFamily="inherit">{v}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const bh = Math.max(2, (d.value / maxV) * cH)
        const x = P.l + (i / n) * cW + ((cW / n - barW) / 2)
        const y = P.t + cH - bh
        return (
          <g key={i}>
            <rect x={x.toFixed(1)} y={y.toFixed(1)} width={barW} height={bh.toFixed(1)}
              rx="3" fill={d.future ? 'rgba(91,200,208,0.3)' : '#5bc8d0'} />
            <text x={(x + barW / 2).toFixed(1)} y={H - 6}
              textAnchor="middle" fontSize="10" fill="var(--text-secondary)" fontFamily="inherit">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── calendar heatmap ─────────────────────────────────────────

function CalendarHeatmap({ events }: { events: { date: string; ticker: string }[] }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monday = new Date(today)
  const dow = today.getDay()
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))

  const weeks: Date[][] = Array.from({ length: 12 }, (_, w) =>
    Array.from({ length: 5 }, (_, d) => {
      const day = new Date(monday)
      day.setDate(monday.getDate() + w * 7 + d)
      return day
    })
  )

  const eventMap = new Map<string, string[]>()
  for (const ev of events) {
    if (!eventMap.has(ev.date)) eventMap.set(ev.date, [])
    eventMap.get(ev.date)!.push(ev.ticker.slice(0, 4))
  }

  const CELL_W = 50; const CELL_H = 28; const ROW_W = 16; const GAP = 3

  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ minWidth: ROW_W + 12 * (CELL_W + GAP) }}>
        {/* Month headers */}
        <div style={{ display: 'flex', marginLeft: ROW_W + 4, marginBottom: 6 }}>
          {weeks.map((week, wi) => {
            const isFirst = wi === 0 || week[0].getMonth() !== weeks[wi - 1][0].getMonth()
            return (
              <div key={wi} style={{ width: CELL_W, marginRight: GAP, fontSize: 10, fontWeight: 600,
                color: isFirst ? 'var(--text-secondary)' : 'transparent', flexShrink: 0 }}>
                {IT_MONTHS[week[0].getMonth()]}
              </div>
            )
          })}
        </div>
        {/* Rows: Mon–Fri */}
        {['L', 'M', 'M', 'G', 'V'].map((label, dayIdx) => (
          <div key={dayIdx} style={{ display: 'flex', alignItems: 'center', marginBottom: GAP }}>
            <div style={{ width: ROW_W, fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, flexShrink: 0, paddingRight: 4 }}>{label}</div>
            {weeks.map((week, wi) => {
              const day = week[dayIdx]
              const ymd = toYMD(day)
              const tickers = eventMap.get(ymd) ?? []
              const isPast = day < today
              const isToday = ymd === toYMD(today)
              const hasEvent = tickers.length > 0

              return (
                <div key={wi} style={{
                  width: CELL_W, height: CELL_H, marginRight: GAP, borderRadius: 5, flexShrink: 0,
                  background: hasEvent
                    ? (isPast ? 'rgba(91,200,208,0.22)' : 'rgba(91,200,208,0.55)')
                    : (isToday ? 'rgba(255,255,255,0.08)' : 'var(--bg-elevated)'),
                  border: isToday ? '1px solid rgba(91,200,208,0.6)' : '1px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1,
                }}>
                  {tickers.slice(0, 2).map((t, ti) => (
                    <span key={ti} style={{ fontSize: 9, fontWeight: 700, lineHeight: 1,
                      color: isPast ? 'rgba(255,255,255,0.5)' : '#fff', letterSpacing: '0.02em' }}>{t}</span>
                  ))}
                  {tickers.length > 2 && (
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>+{tickers.length - 2}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── status badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: 'confermato' | 'stimato' | 'reinvestito' }) {
  const map = {
    confermato:  { bg: 'rgba(63,185,80,0.14)',   color: '#3fb950' },
    stimato:     { bg: 'rgba(230,162,0,0.18)',   color: '#e6a200' },
    reinvestito: { bg: 'rgba(91,200,208,0.18)',  color: '#5bc8d0' },
  }
  const s = map[status]
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
      background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

// ── page ──────────────────────────────────────────────────────

interface ImportState {
  status: 'idle' | 'running' | 'done'
  current: string
  done: number
  total: number
}

function useAutoImport() {
  const { positions, dividends, trades, importDividend } = usePortfolioStore()
  const [state, setState] = useState<ImportState>({ status: 'idle', current: '', done: 0, total: 0 })
  const ran = useRef(false)

  const run = useCallback(async () => {
    const eligible = positions.filter(p =>
      p.type !== 'crypto' &&
      !ACC_TICKERS.has(p.ticker) &&
      !p.name?.toLowerCase().includes(' acc')
    )
    if (eligible.length === 0) return
    const hasDivs = new Set(dividends.map(d => d.positionId))
    const toImport = eligible.filter(p => !hasDivs.has(p.id))
    if (toImport.length === 0) return

    setState({ status: 'running', current: '', done: 0, total: toImport.length })

    for (let i = 0; i < toImport.length; i++) {
      const pos = toImport[i]
      setState(s => ({ ...s, current: pos.ticker, done: i }))

      // Find the earliest buy trade date for this position to use as purchase date
      const positionTrades = trades.filter(t => t.positionId === pos.id && t.type === 'buy')
      const purchaseDate = positionTrades.length > 0
        ? positionTrades.sort((a, b) => a.date.localeCompare(b.date))[0].date
        : pos.createdAt.slice(0, 10)

      try {
        const res = await fetch(`/api/dividends-history?ticker=${encodeURIComponent(pos.ticker)}`)
        if (res.ok) {
          const data = await res.json() as {
            dividends: { exDate: string; payDate: string; amount: number; currency: string }[]
          }
          for (const d of data.dividends) {
            // Only import dividends with ex-date on or after the purchase date
            if (d.exDate >= purchaseDate) {
              importDividend({
                ticker: pos.ticker,
                positionId: pos.id,
                amount: Math.round(d.amount * pos.quantity * 100) / 100,
                payDate: d.payDate,
                exDate: d.exDate,
                currency: d.currency as 'EUR' | 'USD',
              })
            }
          }
        }
      } catch { /* skip */ }
      await new Promise(r => setTimeout(r, 300))
    }
    setState(s => ({ ...s, status: 'done', done: s.total }))
  }, [positions, dividends, trades, importDividend])

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    run()
  }, [run])

  return state
}

export default function DividendiPage() {
  const { dividends, positions } = usePortfolioStore()
  const { eurUsd } = usePricesStore()
  const importState = useAutoImport()

  const now = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const thisYear = now.getFullYear().toString()

  const divRows = useMemo(
    () => computeDivRows(positions, dividends, eurUsd),
    [positions, dividends, eurUsd]
  )

  // ── KPI: 12-month total ──
  const annual12m = divRows.reduce((s, r) => s + r.annualIncome, 0)

  // YoY: previous 12-month window
  const prevYear12m = useMemo(() => {
    const from = addMonths(now, -24); const to = addMonths(now, -12)
    return dividends.reduce((s, d) => {
      const pd = new Date(d.payDate)
      if (pd >= from && pd < to) return s + (d.currency === 'EUR' ? d.amount : d.amount / eurUsd)
      return s
    }, 0)
  }, [dividends, now, eurUsd])

  const yoyPct = prevYear12m > 0 ? ((annual12m - prevYear12m) / prevYear12m) * 100 : 0

  // ── KPI: YTD ──
  const ytdData = useMemo(() => {
    const paid = dividends.filter(d => d.payDate.startsWith(thisYear) && new Date(d.payDate) <= now)
    const total = paid.reduce((s, d) => s + (d.currency === 'EUR' ? d.amount : d.amount / eurUsd), 0)
    const months = new Set(paid.map(d => d.payDate.slice(5, 7))).size
    return { total, months }
  }, [dividends, thisYear, now, eurUsd])

  // ── KPI: next 30 days ──
  const next30Data = useMemo(() => {
    const in30 = new Date(now); in30.setDate(now.getDate() + 30)
    let total = 0; let count = 0
    for (const r of divRows) {
      if (!r.nextDate || r.freqMonths === 0) continue
      const nd = new Date(r.nextDate)
      if (nd >= now && nd <= in30) {
        total += r.annualIncome * r.freqMonths / 12
        count++
      }
    }
    return { total, count }
  }, [divRows, now])

  // ── KPI: weighted yield ──
  const weightedYield = useMemo(() => {
    const tot = divRows.reduce((s, r) => s + r.annualIncome, 0)
    if (tot === 0) return 0
    return divRows.reduce((s, r) => s + r.yieldPct * r.annualIncome, 0) / tot
  }, [divRows])

  // ── monthly bar chart ──
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const d of dividends) {
      const m = d.payDate.slice(0, 7)
      map[m] = (map[m] ?? 0) + (d.currency === 'EUR' ? d.amount : d.amount / eurUsd)
    }
    const result = []
    for (let i = 11; i >= 0; i--) {
      const d = addMonths(now, -i)
      result.push({ label: IT_MONTHS[d.getMonth()], value: map[d.toISOString().slice(0, 7)] ?? 0, future: false })
    }
    for (let i = 1; i <= 2; i++) {
      const d = addMonths(now, i)
      result.push({ label: IT_MONTHS[d.getMonth()], value: map[d.toISOString().slice(0, 7)] ?? 0, future: true })
    }
    return result
  }, [dividends, now, eurUsd])

  // ── calendar events ──
  const calendarEvents = useMemo(() => {
    const evts: { date: string; ticker: string }[] = []
    for (const d of dividends) if (d.exDate) evts.push({ date: d.exDate, ticker: d.ticker })
    for (const r of divRows) if (r.nextDate && r.status === 'stimato') evts.push({ date: r.nextDate, ticker: r.pos.ticker })
    return evts
  }, [dividends, divRows])

  // ── upcoming panel ──
  const upcoming = useMemo(() =>
    divRows
      .filter(r => r.nextDate)
      .sort((a, b) => (a.nextDate ?? '').localeCompare(b.nextDate ?? ''))
      .slice(0, 8)
      .map(r => {
        const nd = new Date(r.nextDate!)
        return {
          ...r,
          day: nd.getDate().toString().padStart(2, '0'),
          month: IT_MONTHS[nd.getMonth()].toUpperCase(),
          weekday: IT_DAYS[nd.getDay()],
          payAmt: r.annualIncome > 0 && r.freqMonths > 0 ? r.annualIncome * r.freqMonths / 12 : 0,
        }
      })
  , [divRows])

  const payingCount = divRows.filter(r => r.status !== 'reinvestito').length
  const yoyLabel = `${yoyPct >= 0 ? '+' : ''}${yoyPct.toFixed(0)}% YoY`

  if (divRows.length === 0 && dividends.length === 0) {
    return (
      <div className="ledgernest-gap-5">
        <div className="ledgernest-card">
          <div className="ledgernest-empty">
            <div className="ledgernest-empty-icon">💰</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Nessun dividendo registrato</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Aggiungi dividendi dalle posizioni per vedere statistiche, storico e calendario cedole
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ledgernest-gap-5">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Dividendi</h1>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
            {payingCount} titoli che pagano
            {upcoming[0] ? ` · prossima cedola ${upcoming[0].day} ${IT_MONTHS[new Date(upcoming[0].nextDate!).getMonth()].toLowerCase()}` : ''}
          </div>
        </div>
        {importState.status === 'running' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10,
            background: 'color-mix(in oklch, var(--accent) 12%, var(--bg-surface))',
            border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
            fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: 'var(--accent)', animation: 'pulse 1s infinite' }} />
            Importo storico {importState.current} · {importState.done}/{importState.total}
          </div>
        )}
        {importState.status === 'done' && importState.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10,
            background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)',
            fontSize: 12, color: '#3fb950' }}>
            ✓ Storico importato · {importState.total} titoli
          </div>
        )}
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5,
          background: 'color-mix(in oklch, var(--accent) 12%, var(--bg-surface))',
          border: '1px solid color-mix(in oklch, var(--accent) 35%, transparent)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>Dividendi 12 mesi</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmtEur(annual12m)}</div>
          <div style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: yoyPct >= 0 ? '#3fb950' : 'var(--danger)' }}>{yoyLabel}</span>
            <span style={{ color: 'var(--text-secondary)' }}>proiezione lordo</span>
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>YTD</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmtEur(ytdData.total)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{ytdData.months} {ytdData.months === 1 ? 'mese' : 'mesi'}</span> già incassati
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>Prossimi 30 giorni</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmtEur(next30Data.total)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 700, color: next30Data.count > 0 ? '#e6a200' : 'var(--text-secondary)' }}>{next30Data.count} {next30Data.count === 1 ? 'evento' : 'eventi'}</span> confermati
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>Yield medio</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{weightedYield.toFixed(1)}%</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>ponderato</span> su {payingCount} titoli
          </div>
        </div>
      </div>

      {/* Bar chart + Calendar */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>
        <div className="ledgernest-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Storico mensile</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Ultimi 12 mesi · lordo</div>
            </div>
            {prevYear12m > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: yoyPct >= 0 ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
                color: yoyPct >= 0 ? '#3fb950' : 'var(--danger)',
              }}>{yoyLabel}</span>
            )}
          </div>
          <MonthlyChart data={monthlyData} />
        </div>

        <div className="ledgernest-card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Calendario · 12 settimane</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>Date stacco</div>
          <CalendarHeatmap events={calendarEvents} />
        </div>
      </div>

      {/* Positions table + Upcoming panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>
        {/* Table */}
        <div className="ledgernest-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Tutte le posizioni · {divRows.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Yield, frequenza, prossima cedola</div>
          </div>
          <table className="ledgernest-table">
            <thead>
              <tr>
                <th>Titolo</th>
                <th className="num">Qty</th>
                <th className="num">€/Azione</th>
                <th className="num">Freq.</th>
                <th className="num">Yield</th>
                <th className="num">Prossima</th>
                <th className="num">€/Anno</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {divRows.map((r) => (
                <tr key={r.pos.id}>
                  <td>
                    <div className="ledgernest-table-ticker">
                      <div className="ledgernest-table-ticker-icon">{r.pos.ticker.slice(0, 2)}</div>
                      <div>
                        <div className="ledgernest-table-ticker-name">{r.pos.ticker}</div>
                        <div className="ledgernest-table-ticker-sub">{r.pos.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num ledgernest-mono" style={{ fontSize: 13 }}>{r.pos.quantity}</td>
                  <td className="num ledgernest-mono" style={{ fontSize: 13 }}>
                    {r.perShareAnnual > 0 ? fmtEur(r.perShareAnnual) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                  <td className="num" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.freq}</td>
                  <td className="num" style={{ fontSize: 13, fontWeight: 600 }}>
                    {r.yieldPct > 0
                      ? <span style={{ color: r.yieldPct >= 5 ? '#3fb950' : 'var(--text-primary)' }}>{r.yieldPct.toFixed(1)}%</span>
                      : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                  <td className="num" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {r.nextDate
                      ? <span>{fmtDateShort(r.nextDate)}</span>
                      : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                  <td className="num ledgernest-mono" style={{ fontSize: 13, fontWeight: 600 }}>
                    {r.annualIncome > 0 ? fmtEur(r.annualIncome) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Upcoming cedole */}
        <div className="ledgernest-card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Prossime cedole</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 18 }}>In ordine cronologico</div>
          {upcoming.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
              Nessuna cedola imminente
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {upcoming.map((r) => (
                <div key={r.pos.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Date pill */}
                  <div style={{ width: 42, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>{r.day}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em', marginTop: 2 }}>{r.month}</div>
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{r.pos.ticker}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.pos.name} · {r.weekday}
                    </div>
                  </div>
                  {/* Amount */}
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#3fb950', whiteSpace: 'nowrap' }}>
                    {r.payAmt > 0 ? `+${fmtEur(r.payAmt)}` : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
