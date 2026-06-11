'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePricesStore } from '@/stores/pricesStore'
import { usePrices } from '@/hooks/usePrices'
import { useSettingsStore } from '@/stores/settingsStore'
import { fmtPct, fmtNum, deltaClass } from '@/lib/utils/format'
import { useFormatters } from '@/hooks/useFormatters'
import Sparkline from '@/components/charts/Sparkline'
import PortfolioPerformanceChart from '@/components/charts/PortfolioPerformanceChart'
import Icon from '@/components/shared/Icon'
import { useUIStore } from '@/stores/uiStore'

const SECTOR_COLORS: Record<string, string> = {
  Technology: '#5bc8d0',
  'Financial Services': '#7c6df7',
  Energy: '#f77c3a',
  Healthcare: '#3fb950',
  'Consumer Cyclical': '#d29922',
  Industrials: '#58a6ff',
  'Basic Materials': '#e879a8',
  'Communication Services': '#9b8fef',
  Utilities: '#64748b',
  'Consumer Defensive': '#10b981',
  'Real Estate': '#f59e0b',
}
function sectorColor(s: string | undefined) {
  return (s && SECTOR_COLORS[s]) ? SECTOR_COLORS[s] : '#8b949e'
}

function makeSpark(seed: number, positive: boolean, n = 22): number[] {
  const base = 100
  return Array.from({ length: n }, (_, i) => {
    const noise = Math.sin(seed + i * 0.9) * 3 + Math.cos(seed * 1.5 + i * 0.7) * 2
    return base + (positive ? i * 0.35 : -i * 0.35) + noise
  })
}

import type { PortfolioPosition, Quote } from '@/types'

function PositionRowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const tl = useTranslations('azioni')
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen((v) => !v)
  }

  const item: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '7px 12px', borderRadius: 7, border: 'none', background: 'none',
    cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
  }

  return (
    <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
      <button ref={btnRef} onClick={handleToggle}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}>
        <Icon name="kebab" size={15} />
      </button>
      {open && (
        <div ref={menuRef} style={{ position: 'fixed', top: pos.top, right: pos.right, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 4, minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,0.45)', zIndex: 9999 }}>
          <button onClick={() => { setOpen(false); onEdit() }} style={{ ...item, color: 'var(--text-primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
            <Icon name="edit" size={13} /> {tl('menuEdit')}
          </button>
          <button onClick={() => { setOpen(false); onDelete() }} style={{ ...item, color: 'var(--danger)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in oklch, var(--danger) 10%, transparent)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
            <Icon name="trash" size={13} /> {tl('menuDelete')}
          </button>
        </div>
      )}
    </div>
  )
}

type ChartPeriod = '1G' | '1S' | '1M' | '1A' | 'MAX'
const CHART_PERIODS: ChartPeriod[] = ['1G', '1S', '1M', '1A', 'MAX']

const PERIOD_DAYS: Record<Exclude<ChartPeriod, 'MAX'>, number> = {
  '1G': 1, '1S': 7, '1M': 30, '1A': 365,
}

const IT_M = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

function fmtChartLabel(dateStr: string, totalDays: number): string {
  const isDatetime = dateStr.length > 10
  const d = isDatetime ? new Date(dateStr + ':00Z') : new Date(dateStr + 'T12:00:00')
  if (isDatetime) return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
  if (totalDays <= 35)  return `${d.getDate()} ${IT_M[d.getMonth()]}`
  if (totalDays <= 400) return `${IT_M[d.getMonth()]} '${d.getFullYear().toString().slice(2)}`
  return d.getFullYear().toString()
}

function buildChartLabels(pts: { date: string }[], n = 5): string[] {
  if (pts.length < 2) return []
  const totalDays = (new Date(pts.at(-1)!.date).getTime() - new Date(pts[0].date).getTime()) / 86_400_000
  return Array.from({ length: n }, (_, i) => {
    const idx = Math.round(i * (pts.length - 1) / (n - 1))
    return fmtChartLabel(pts[idx].date, totalDays)
  })
}

function PortfolioChart({
  positions, period, quotes, eurUsd, pnl,
}: {
  positions: PortfolioPosition[]
  period: ChartPeriod
  quotes: Record<string, Quote>
  eurUsd: number
  pnl: number
}) {
  const tl = useTranslations('azioni')
  const { fmt } = useFormatters()
  const { trades } = usePortfolioStore()
  const [chartPts, setChartPts] = useState<{ date: string; value: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const posKey = positions.map((p) => `${p.ticker}:${p.quantity}`).join(',')

  // For MAX: use earliest trade date across all positions
  const earliestDate = useMemo(() => {
    let min = new Date().toISOString().slice(0, 10)
    for (const p of positions) {
      const tr = trades.filter(tr => tr.positionId === p.id && tr.type === 'buy').sort((a, b) => a.date.localeCompare(b.date))[0]
      const d = p.purchaseDate ?? tr?.date ?? new Date().toISOString().slice(0, 10)
      if (d < min) min = d
    }
    return min
  }, [posKey, trades]) // eslint-disable-line react-hooks/exhaustive-deps

  const days = period === 'MAX'
    ? Math.max(1, Math.ceil((Date.now() - new Date(earliestDate).getTime()) / 86_400_000) + 1)
    : PERIOD_DAYS[period]

  // 1G: compute directly from live quotes (prev close → current price)
  const oneGPts = useMemo(() => {
    if (period !== '1G') return null
    const today     = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    let prev = 0, curr = 0, hasAny = false
    for (const p of positions) {
      const q = quotes[p.ticker]
      if (!q) continue
      const prevEur = q.prevClose > 0
        ? (q.currency === 'EUR' ? q.prevClose : q.prevClose / eurUsd)
        : (q.priceEur ?? q.price / eurUsd)
      const currEur = q.priceEur ?? q.price / eurUsd
      prev += p.quantity * prevEur
      curr += p.quantity * currEur
      hasAny = true
    }
    if (!hasAny) return []
    return [
      { date: yesterday, value: Math.round(prev * 100) / 100 },
      { date: today,     value: Math.round(curr * 100) / 100 },
    ]
  }, [positions, quotes, eurUsd, period]) // eslint-disable-line react-hooks/exhaustive-deps

  // API fetch for 1S / 1M / 1A / MAX
  useEffect(() => {
    if (period === '1G') { setChartPts([]); setLoading(false); return }
    if (positions.length === 0) return
    let cancelled = false
    setLoading(true)
    const pParam = positions.map((p) => {
      const currency = quotes[p.ticker]?.currency ?? 'USD'
      const tr = trades.filter(tr => tr.positionId === p.id && tr.type === 'buy').sort((a, b) => a.date.localeCompare(b.date))[0]
      const purchaseDate = p.purchaseDate ?? tr?.date ?? new Date().toISOString().slice(0, 10)
      return `${p.ticker}:${p.quantity}:${purchaseDate}:${currency}`
    }).join(',')
    fetch(`/api/portfolio-chart?p=${encodeURIComponent(pParam)}&days=${days}&eurUsd=${eurUsd}`)
      .then((r) => r.json())
      .then((data: { points?: { date: string; value: number }[] }) => {
        if (!cancelled) { setChartPts(data.points ?? []); setLoading(false) }
      })
      .catch(() => { if (!cancelled) { setChartPts([]); setLoading(false) } })
    return () => { cancelled = true }
  }, [posKey, days, eurUsd]) // eslint-disable-line react-hooks/exhaustive-deps

  const pts    = period === '1G' ? (oneGPts ?? []) : chartPts
  const isLoading = period === '1G' ? false : loading

  const W = 500; const H = 160
  const P = { t: 16, r: 8, b: 4, l: 8 }

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <div className="ledgernest-spinner" style={{ width: 20, height: 20, border: '2px solid var(--border-subtle)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{tl('chartLoading')}</span>
      </div>
    )
  }

  if (pts.length < 2) {
    return (
      <div style={{ width: '100%', height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {period === '1G' ? tl('chartNoData') : tl('chartInsufficient')}
        </span>
      </div>
    )
  }

  const values = pts.map((p) => p.value)
  const labels = period === '1G' ? [tl('chartYesterday'), tl('chartToday')] : buildChartLabels(pts)

  const n = values.length
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const vRange = maxV - minV || 1
  const yMin = minV - vRange * 0.15
  const yMax = maxV + vRange * 0.08
  const xS = (i: number) => P.l + (i / (n - 1)) * (W - P.l - P.r)
  const yS = (v: number) => P.t + (1 - (v - yMin) / (yMax - yMin)) * (H - P.t - P.b)

  const chartColor = pnl >= 0 ? '#22c55e' : '#ef4444'

  let linePts = `M${xS(0).toFixed(1)},${yS(values[0]).toFixed(1)}`
  for (let i = 1; i < n; i++) {
    const cpx = ((xS(i - 1) + xS(i)) / 2).toFixed(1)
    linePts += ` C${cpx},${yS(values[i - 1]).toFixed(1)} ${cpx},${yS(values[i]).toFixed(1)} ${xS(i).toFixed(1)},${yS(values[i]).toFixed(1)}`
  }
  const area = `${linePts} L${xS(n - 1).toFixed(1)},${(H - P.b).toFixed(1)} L${xS(0).toFixed(1)},${(H - P.b).toFixed(1)} Z`

  const hoverInfo = hoverIdx !== null ? (() => {
    const hx = xS(hoverIdx), hy = yS(values[hoverIdx])
    const tDays = pts.length >= 2
      ? (new Date(pts.at(-1)!.date).getTime() - new Date(pts[0].date).getTime()) / 86_400_000
      : 1
    const dateLabel = period === '1G' ? (hoverIdx === 0 ? tl('chartYesterday') : tl('chartToday')) : fmtChartLabel(pts[hoverIdx].date, tDays)
    return { hx, hy, dateLabel }
  })() : null

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: H, display: 'block', cursor: 'crosshair' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = ((e.clientX - rect.left) / rect.width) * W
          const idx = Math.max(0, Math.min(n - 1, Math.round((x - P.l) / (W - P.l - P.r) * (n - 1))))
          setHoverIdx(idx)
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={chartColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#ag)" vectorEffect="non-scaling-stroke" />
        <path d={linePts} fill="none" stroke={chartColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <line x1={P.l} y1={yS(values[0]).toFixed(1)} x2={xS(n - 1)} y2={yS(values[0]).toFixed(1)} stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3,4" vectorEffect="non-scaling-stroke" />
        {hoverInfo && (
          <g key="crosshair">
            <line x1={hoverInfo.hx} y1={P.t} x2={hoverInfo.hx} y2={H - P.b} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4,3" vectorEffect="non-scaling-stroke" />
            <circle cx={hoverInfo.hx} cy={hoverInfo.hy} r="5" fill="var(--bg-surface)" stroke={chartColor} strokeWidth="2" />
          </g>
        )}
      </svg>
      {hoverInfo && (
        <div style={{
          position: 'absolute',
          left: `${(hoverInfo.hx / W) * 100}%`,
          top: `${(hoverInfo.hy / H) * 100}%`,
          transform: `translate(${hoverInfo.hx > W * 0.6 ? '-110%' : '10px'}, -50%)`,
          pointerEvents: 'none',
          background: '#131c27',
          border: `1px solid ${chartColor}44`,
          borderRadius: 8,
          padding: '5px 12px',
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>{hoverInfo.dateLabel}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: chartColor, fontVariantNumeric: 'tabular-nums' }}>{fmt(values[hoverIdx!])}</div>
        </div>
      )}
      <div style={{ position: 'relative', height: 24, marginTop: 4 }}>
        {labels.map((m, i) => (
          <span key={i} style={{
            position: 'absolute',
            left: `${((P.l + (i / (labels.length - 1)) * (W - P.l - P.r)) / W) * 100}%`,
            transform: 'translateX(-50%)',
            fontSize: 11,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.5)',
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
          }}>{m}</span>
        ))}
      </div>
    </div>
  )
}

function useAgo(ts: number | null, tl: ReturnType<typeof useTranslations<'azioni'>>) {
  if (!ts) return ''
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 10) return tl('agoNow')
  if (sec < 60) return tl('agoSec', { sec })
  const min = Math.floor(sec / 60)
  return min < 60 ? tl('agoMin', { min }) : tl('agoHour', { h: Math.floor(min / 60) })
}

export default function AzioniPage() {
  const tl = useTranslations('azioni')
  const { fmt, fmtDlt } = useFormatters()
  const { refetch } = usePrices()
  const { positions, updatePosition, deletePosition } = usePortfolioStore()
  const { quotes, eurUsd, lastUpdated, loading } = usePricesStore()
  const showPrePostMarket = useSettingsStore((s) => s.settings.showPrePostMarket)
  const { openModal } = useUIStore()
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState('all')
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('1M')
  const [, setTick] = useState(0)
  const [deletingPositionId, setDeletingPositionId] = useState<string | null>(null)
  const [editingTickerId, setEditingTickerId] = useState<string | null>(null)
  const [editingTickerVal, setEditingTickerVal] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 15_000)
    return () => clearInterval(timer)
  }, [])

  const ago = useAgo(lastUpdated, tl)

  const PERIOD_LABELS: Record<ChartPeriod, string> = {
    '1G': tl('period1D'),
    '1S': tl('period1W'),
    '1M': tl('period1M'),
    '1A': tl('period1Y'),
    'MAX': tl('periodAll'),
  }

  useEffect(() => {
    const missing = positions.filter((p) => p.type === 'stock' && !p.sector)
    missing.forEach((p, i) => {
      setTimeout(async () => {
        try {
          const res = await fetch(`/api/ticker-info?ticker=${encodeURIComponent(p.ticker)}`)
          if (!res.ok) return
          const data = await res.json() as { sector?: string; name?: string }
          if (data.sector) updatePosition(p.id, { sector: data.sector })
        } catch {}
      }, i * 600)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stocks = positions.filter((p) => p.type === 'stock')

  const rows = useMemo(() => stocks.map((p) => {
    const q = quotes[p.ticker]
    const price = q?.priceEur ?? q?.price ?? p.avgPrice        // regular close — for display
    const extPrice = showPrePostMarket ? (q?.preMarketEur ?? q?.postMarketEur) : undefined
    const extLabel = showPrePostMarket ? (q?.preMarketEur != null ? 'PM' : q?.postMarketEur != null ? 'AH' : null) : null
    const extChangePct = extPrice != null && price > 0 ? (extPrice / price - 1) * 100 : undefined
    const effectivePrice = extPrice ?? price                    // best available price for P&L
    const avgPriceEur = p.currency === 'USD' ? p.avgPrice / eurUsd : p.avgPrice
    const value = effectivePrice * p.quantity
    const cost = avgPriceEur * p.quantity
    const pnl = value - cost
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
    const dayChangePct = q?.changePct ?? 0
    const seed = p.ticker.charCodeAt(0) + (p.ticker.charCodeAt(1) ?? 0)
    const spark = makeSpark(seed, dayChangePct >= 0)
    return { ...p, q, price, avgPriceEur, value, cost, pnl, pnlPct, dayChangePct, spark, extPrice, extLabel, extChangePct }
  }), [stocks, quotes, eurUsd])

  const totalValue = rows.reduce((s, r) => s + r.value, 0)
  const totalCost  = rows.reduce((s, r) => s + r.cost, 0)
  const totalPnl   = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0
  const totalDayChg = rows.reduce((s, r) =>
    s + (r.q?.change ?? 0) * r.quantity * (r.q?.currency === 'EUR' ? 1 : 1 / eurUsd), 0)
  const totalDayPct = totalValue > 0 ? (totalDayChg / (totalValue - totalDayChg + 0.001)) * 100 : 0

  const sectorMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of rows) { const s = r.sector ?? 'Altro'; map[s] = (map[s] ?? 0) + r.value }
    return map
  }, [rows])

  const withQ = rows.filter((r) => r.q)
  const topPnl  = [...rows].sort((a, b) => b.pnlPct - a.pnlPct).slice(0, 3)
  const losers  = [...withQ].filter((r) => r.q!.changePct < 0).sort((a, b) => a.q!.changePct - b.q!.changePct).slice(0, 3)

  const sectors = ['all', ...Array.from(new Set(rows.map((r) => r.sector).filter((s): s is string => !!s)))]
  const filtered = (sectorFilter === 'all' ? rows : rows.filter((r) => r.sector === sectorFilter))
    .filter((r) => !search || r.ticker.toLowerCase().includes(search.toLowerCase()) || r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.pnl - a.pnl)

  if (stocks.length === 0) {
    return (
      <div className="ledgernest-card">
        <div className="ledgernest-empty">
          <div className="ledgernest-empty-icon">📈</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{tl('emptyTitle')}</div>
          <button className="ledgernest-btn ledgernest-btn-primary" onClick={() => openModal('buy', { assetType: 'stock' })}>
            <Icon name="plus" size={14} /> {tl('emptyAdd')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ledgernest-gap-5">

      {/* Ticker tape */}
      <div style={{ overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '8px 16px' }}>
        <div style={{ display: 'flex', gap: '28px', alignItems: 'center', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {rows.map((r) => (
            <div key={r.ticker} style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
              {r.q?.exchange && <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>{r.q.exchange}</span>}
              <span style={{ fontWeight: 700, fontSize: '13px' }}>{r.ticker}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '13px' }}>{fmt(r.price)}</span>
              {r.q && (
                <span style={{ fontSize: '12px', fontWeight: 600, color: r.dayChangePct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {r.dayChangePct >= 0 ? '▲' : '▼'} {r.dayChangePct >= 0 ? '+' : ''}{r.dayChangePct.toFixed(2)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="ledgernest-port-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
        <div className="ledgernest-kpi is-hl" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{tl('kpiTotal')}</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalValue)}</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: totalDayPct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {fmtPct(totalDayPct)} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{tl('kpiToday')} · {stocks.length}</span>
          </div>
        </div>
        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{tl('kpiPnl')}</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: totalPnl >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtDlt(totalPnl)}</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: totalPnl >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {fmtPct(totalPnlPct)} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{tl('kpiVsCost')}</span>
          </div>
        </div>
        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{tl('kpiInvested')}</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalCost)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{tl('kpiCapital')}</div>
        </div>
        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{tl('kpiSectors')}</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>{Object.keys(sectorMap).length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{tl('kpiDiversified')}</div>
        </div>
      </div>

      {/* Chart + Sector breakdown */}
      <div className="ledgernest-port-charts" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '12px' }}>
        <div className="ledgernest-card">
          <PortfolioPerformanceChart filter="stocks" title={tl('chartTitle')} />
        </div>

        <div className="ledgernest-card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>{tl('sectorTitle')}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '18px' }}>{tl('sectorCount', { n: Object.keys(sectorMap).length })}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
            {Object.entries(sectorMap).sort((a, b) => b[1] - a[1]).map(([sector, value]) => {
              const pct = totalValue > 0 ? (value / totalValue) * 100 : 0
              const color = sectorColor(sector)
              const label = sector.length > 13 ? sector.slice(0, 12) + '.' : sector
              return (
                <div key={sector} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '82px', fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0, textAlign: 'right' }}>{label}</div>
                  <div style={{ flex: 1, height: '7px', background: 'var(--bg-elevated)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`, borderRadius: '99px',
                      background: `linear-gradient(90deg, ${color}, ${color}bb)`,
                      transition: 'width .4s ease',
                    }} />
                  </div>
                  <div style={{ width: '40px', fontSize: '12px', fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)' }}>{pct.toFixed(1)}%</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Top widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
        {/* Top rendimento (best unrealized P&L%) */}
        <div className="ledgernest-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>{tl('topPnlTitle')}</div>
            <span style={{
              fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
              background: 'var(--success-dim)', color: 'var(--success)',
            }}>
              {topPnl.length ? `+${(topPnl.reduce((s, r) => s + r.pnlPct, 0) / topPnl.length).toFixed(1)}%` : '—'} {tl('topPnlBadge')}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topPnl.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
                  background: 'var(--success-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)' }}>{r.ticker.slice(0, 2)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>{r.ticker}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '13px' }}>{fmt(r.value)}</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: r.pnlPct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {r.pnlPct >= 0 ? '+' : ''}{r.pnlPct.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top in discesa oggi */}
        <div className="ledgernest-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>{tl('moversDown')}</div>
            {losers.length > 0 && (
              <span style={{
                fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
                background: 'var(--danger-dim)', color: 'var(--danger)',
              }}>
                {(losers.reduce((s, r) => s + r.q!.changePct, 0) / losers.length).toFixed(1)}% {tl('moversAvg', { avg: '' }).replace('% ', '')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {losers.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingTop: 8 }}>Nessuna posizione in calo oggi</div>
            ) : losers.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
                  background: 'var(--danger-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--danger)' }}>{r.ticker.slice(0, 2)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>{r.ticker}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '13px' }}>{fmt(r.value)}</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--danger)' }}>
                    {r.q!.changePct.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Positions table */}
      <div className="ledgernest-card ledgernest-port-table-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>{tl('tableTitle', { n: stocks.length })}</div>
            {ago && <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{tl('tableUpdated', { ago })}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-elevated)', borderRadius: '10px', padding: '3px' }}>
              {sectors.slice(0, 5).map((s) => (
                <button key={s} onClick={() => setSectorFilter(s)} style={{
                  padding: '4px 11px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                  border: 'none', cursor: 'pointer',
                  background: sectorFilter === s ? 'var(--bg-surface)' : 'transparent',
                  color: sectorFilter === s ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: sectorFilter === s ? '0 1px 4px rgba(0,0,0,.25)' : 'none',
                }}>
                  {s === 'all' ? tl('filterAll') : (s.length > 9 ? s.slice(0, 8) + '.' : s)}
                </button>
              ))}
            </div>
            <input className="ledgernest-input" placeholder={tl('searchPlaceholder')} value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '120px', height: '32px', padding: '4px 10px', fontSize: '12px' }} />
            <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm"
              onClick={() => refetch()} disabled={loading} style={{ padding: '0 10px', height: '32px' }}>
              <Icon name="refresh" size={14} />
            </button>
            <button className="ledgernest-btn ledgernest-btn-primary ledgernest-btn-sm"
              onClick={() => openModal('buy', { assetType: 'stock' })}>
              <Icon name="plus" size={13} /> {tl('buyButton')}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table className="ledgernest-table">
          <thead>
            <tr>
              <th>{tl('colStock')}</th>
              <th className="num">{tl('colPnl')}</th>
              <th className="num">{tl('colChange')}</th>
              <th>{tl('colSector')}</th>
              <th>{tl('colBroker')}</th>
              <th className="num">{tl('colQty')}</th>
              <th className="num">{tl('colAvgPrice')}</th>
              <th className="num">{tl('colPrice')}</th>
              <th className="num" title={tl('colPmAhTitle')}>{tl('colPmAh')}</th>
              <th style={{ paddingLeft: '12px' }}>{tl('colTrend')}</th>
              <th className="num">{tl('colValue')}</th>
              <th className="num">{tl('colPortPct')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>{tl('emptyTable')}</td></tr>
            ) : filtered.map((r) => {
              const portPct = totalValue > 0 ? (r.value / totalValue) * 100 : 0
              return (
              <tr key={r.id}>
                <td>
                  <div className="ledgernest-table-ticker">
                    <div className="ledgernest-table-ticker-icon">{r.ticker.slice(0, 2)}</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {editingTickerId === r.id ? (
                          <input
                            autoFocus
                            value={editingTickerVal}
                            onChange={(e) => setEditingTickerVal(e.target.value.toUpperCase())}
                            onBlur={() => { if (editingTickerVal) updatePosition(r.id, { ticker: editingTickerVal }); setEditingTickerId(null) }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { if (editingTickerVal) updatePosition(r.id, { ticker: editingTickerVal }); setEditingTickerId(null) }
                              if (e.key === 'Escape') setEditingTickerId(null)
                            }}
                            style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, width: 80, padding: '2px 6px', borderRadius: 5, border: '1px solid var(--accent)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none' }}
                          />
                        ) : (
                          <span className="ledgernest-table-ticker-name" style={{ cursor: 'pointer' }} title="Clicca per modificare" onClick={() => { setEditingTickerId(r.id); setEditingTickerVal(r.ticker) }}>
                            {r.ticker}
                          </span>
                        )}
                        {r.q?.exchange && (
                          <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '4px', background: 'var(--bg-elevated)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                            {r.q.exchange}
                          </span>
                        )}
                      </div>
                      <div className="ledgernest-table-ticker-sub">{r.name}</div>
                    </div>
                  </div>
                </td>
                <td className="num ledgernest-mono" style={{ fontWeight: 600 }}>
                  <span className={deltaClass(r.pnl)}>{fmtDlt(r.pnl)}</span>
                  <div><span className={deltaClass(r.pnlPct)} style={{ fontSize: '11px' }}>{fmtPct(r.pnlPct)}</span></div>
                </td>
                <td className={`num ${deltaClass(r.q?.changePct ?? 0)}`} style={{ fontWeight: 600 }}>
                  {r.q ? fmtPct(r.q.changePct) : '—'}
                </td>
                <td>
                  {r.sector ? (
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px',
                      background: `${sectorColor(r.sector)}22`, color: sectorColor(r.sector), whiteSpace: 'nowrap',
                    }}>
                      {r.sector.length > 11 ? r.sector.slice(0, 10) + '.' : r.sector}
                    </span>
                  ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                </td>
                <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.broker || '—'}</td>
                <td className="num ledgernest-mono" style={{ fontSize: '13px' }}>{fmtNum(r.quantity)}</td>
                <td className="num ledgernest-mono" style={{ fontSize: '13px' }}>{fmt(r.avgPriceEur)}</td>
                <td className="num ledgernest-mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                  {fmt(r.price)}
                  {r.q?.currency === 'USD' && r.q.price > 0 && (
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                      ${r.q.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </td>
                <td className="num">
                  {r.extPrice ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <span className="ledgernest-mono" style={{ fontSize: '13px' }}>{fmt(r.extPrice)}</span>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em',
                        padding: '1px 5px', borderRadius: '4px',
                        background: r.extChangePct != null
                          ? (r.extChangePct >= 0 ? 'color-mix(in oklch, var(--green) 15%, transparent)' : 'color-mix(in oklch, var(--red) 15%, transparent)')
                          : (r.extLabel === 'PM' ? 'color-mix(in oklch, var(--accent) 15%, transparent)' : 'color-mix(in oklch, #7c6df7 15%, transparent)'),
                        color: r.extChangePct != null
                          ? (r.extChangePct >= 0 ? 'var(--green)' : 'var(--red)')
                          : (r.extLabel === 'PM' ? 'var(--accent)' : '#7c6df7'),
                      }}>
                        {r.extLabel}{r.extChangePct != null ? ` ${r.extChangePct >= 0 ? '+' : ''}${r.extChangePct.toFixed(2)}%` : ''}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                  )}
                </td>
                <td style={{ width: '100px', padding: '6px 12px' }}>
                  <Sparkline data={r.spark} height={32} positive={r.dayChangePct >= 0} responsive />
                </td>
                <td className="num ledgernest-mono" style={{ fontWeight: 600 }}>{fmt(r.value)}</td>
                <td className="num">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{portPct.toFixed(1)}%</span>
                    <div style={{ width: 44, height: 3, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${portPct}%`, background: 'var(--accent)', borderRadius: 99 }} />
                    </div>
                  </div>
                </td>
                <td style={{ width: 40 }}>
                  <PositionRowMenu
                    onEdit={() => openModal('editPosition', { position: r })}
                    onDelete={() => setDeletingPositionId(r.id)}
                  />
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Price disclaimer */}
      <div style={{
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: 'var(--text-tertiary)',
        fontSize: '11px',
      }}>
        <span style={{ opacity: 0.5 }}>●</span>
        {lastUpdated
          ? tl('disclaimerUpdated', { ago })
          : tl('disclaimerNotLoaded')
        }
      </div>

      {deletingPositionId && (() => {
        const pos = stocks.find((p) => p.id === deletingPositionId)
        return (
          <div className="ledgernest-modal-overlay" onClick={() => setDeletingPositionId(null)}>
            <div className="ledgernest-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div className="ledgernest-modal-header">
                <div className="ledgernest-modal-title">{tl('deleteTitle', { ticker: pos?.ticker ?? '' })}</div>
              </div>
              <div className="ledgernest-modal-body">
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
                  {tl('deleteBody')}
                </p>
              </div>
              <div className="ledgernest-modal-footer">
                <button className="ledgernest-btn ledgernest-btn-ghost" onClick={() => setDeletingPositionId(null)}>{tl('cancel')}</button>
                <button className="ledgernest-btn" style={{ background: 'var(--danger)', color: '#fff' }}
                  onClick={() => { deletePosition(deletingPositionId); setDeletingPositionId(null) }}>
                  {tl('delete')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
