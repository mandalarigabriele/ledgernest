'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePricesStore } from '@/stores/pricesStore'
import { usePrices } from '@/hooks/usePrices'
import { fmtUsd, fmtPct, deltaClass } from '@/lib/utils/format'
import { useFormatters } from '@/hooks/useFormatters'
import Donut from '@/components/charts/Donut'
import Sparkline from '@/components/charts/Sparkline'
import PortfolioPerformanceChart from '@/components/charts/PortfolioPerformanceChart'
import Icon from '@/components/shared/Icon'
import { useUIStore } from '@/stores/uiStore'
import { useTranslations } from 'next-intl'
import type { PortfolioPosition, Quote } from '@/types'

// ── palette ──────────────────────────────────────────────────

const COIN_COLORS: Record<string, string> = {
  BTC: '#5bc8d0', ETH: '#7c6df7', SOL: '#f0a500', BNB: '#f0c040',
  XRP: '#3f86f7', ADA: '#0ea5e9', DOT: '#3fb950', LINK: '#f85149',
  AVAX: '#e84142', MATIC: '#8247e5', USDC: '#58a6ff', USDT: '#26a17b',
  DAI: '#f5ac37', UNI: '#ff007a', ATOM: '#6f4e7c', LTC: '#bfbbbb',
}
const PALETTE = ['#5bc8d0', '#7c6df7', '#f0a500', '#3fb950', '#f85149', '#58a6ff', '#f0c040', '#e84142']

function coinColor(ticker: string, idx: number) {
  const base = ticker.replace(/-USD$|-EUR$|\..*/, '')
  return COIN_COLORS[base] ?? PALETTE[idx % PALETTE.length]
}

const STABLECOINS = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'LUSD', 'USDS', 'PYUSD'])
function isStable(ticker: string) {
  return STABLECOINS.has(ticker.replace(/-USD$|-EUR$|\..*/, ''))
}

// ── chart ────────────────────────────────────────────────────

type CryptoPeriod = '1G' | '1S' | '1M' | '1A' | 'MAX'
const CRYPTO_PERIODS: CryptoPeriod[] = ['1G', '1S', '1M', '1A', 'MAX']

const PERIOD_DAYS: Record<Exclude<CryptoPeriod, 'MAX'>, number> = {
  '1G': 1, '1S': 7, '1M': 30, '1A': 365,
}

function buildLabels(period: '1G' | '1S'): string[] {
  if (period === '1G') return ['00:00', '06:00', '12:00', '18:00', 'Ora']
  return ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
}

// Dynamic labels from real date range (for 1M+ periods using portfolio-chart API)
const IT_M2 = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
function fmtCL(dateStr: string, totalDays: number): string {
  const isDatetime = dateStr.length > 10
  const d = isDatetime ? new Date(dateStr + ':00Z') : new Date(dateStr + 'T12:00:00')
  if (isDatetime) return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
  if (totalDays <= 35)  return `${d.getDate()} ${IT_M2[d.getMonth()]}`
  if (totalDays <= 400) return `${IT_M2[d.getMonth()]} '${d.getFullYear().toString().slice(2)}`
  return d.getFullYear().toString()
}
function buildRealLabels(pts: { date: string }[], n = 5): string[] {
  if (pts.length < 2) return []
  const totalDays = (new Date(pts.at(-1)!.date).getTime() - new Date(pts[0].date).getTime()) / 86_400_000
  return Array.from({ length: n }, (_, i) => {
    const idx = Math.round(i * (pts.length - 1) / (n - 1))
    return fmtCL(pts[idx].date, totalDays)
  })
}

function CryptoChart({
  cryptoPositions, biggest, totalValue, period, eurUsd, quotes, quotesLoading, pnl,
}: {
  cryptoPositions: PortfolioPosition[]
  biggest: { ticker: string; q?: { sparkline?: number[] } } | null
  totalValue: number
  period: CryptoPeriod
  eurUsd: number
  quotes: Record<string, Quote>
  quotesLoading: boolean
  pnl: number
}) {
  const tl = useTranslations('crypto')
  const { fmt } = useFormatters()
  const { trades } = usePortfolioStore()
  const [apiPoints, setApiPoints] = useState<{ date: string; value: number }[]>([])
  const [apiLoading, setApiLoading] = useState(false)
  const base = totalValue || 10000
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const posKey = cryptoPositions.map((p) => `${p.ticker}:${p.quantity}`).join(',')

  const earliestDate = useMemo(() => {
    let min = new Date().toISOString().slice(0, 10)
    for (const p of cryptoPositions) {
      const t = trades.filter(t => t.positionId === p.id && t.type === 'buy').sort((a, b) => a.date.localeCompare(b.date))[0]
      const d = p.purchaseDate ?? t?.date ?? new Date().toISOString().slice(0, 10)
      if (d < min) min = d
    }
    return min
  }, [posKey, trades]) // eslint-disable-line react-hooks/exhaustive-deps

  // 1G / 1S — use sparkline data already in the quote (no extra API call)
  const sparkSeries = useMemo((): number[] | null => {
    if (period !== '1G' && period !== '1S') return null
    const spark = biggest?.q?.sparkline
    if (!spark || spark.length < 10) return null
    const pts = period === '1G' ? spark.slice(-24) : spark
    const last = pts[pts.length - 1]
    return last > 0 ? pts.map((v) => base * (v / last)) : null
  }, [biggest, period, base])

  // 1M+ — fetch real portfolio history from the API
  useEffect(() => {
    if (period === '1G' || period === '1S') { setApiPoints([]); return }
    if (cryptoPositions.length === 0) return
    let cancelled = false
    setApiLoading(true)
    const days = period === 'MAX'
      ? Math.max(1, Math.ceil((Date.now() - new Date(earliestDate).getTime()) / 86_400_000) + 1)
      : PERIOD_DAYS[period]
    const pParam = cryptoPositions.map((p) => {
      const currency = quotes[p.ticker]?.currency ?? 'USD'
      const t = trades.filter(t => t.positionId === p.id && t.type === 'buy').sort((a, b) => a.date.localeCompare(b.date))[0]
      const purchaseDate = p.purchaseDate ?? t?.date ?? new Date().toISOString().slice(0, 10)
      return `${p.ticker}:${p.quantity}:${purchaseDate}:${currency}`
    }).join(',')
    fetch(`/api/portfolio-chart?p=${encodeURIComponent(pParam)}&days=${days}&eurUsd=${eurUsd}`)
      .then((r) => r.json())
      .then((data: { points?: { date: string; value: number }[] }) => {
        if (!cancelled) { setApiPoints(data.points ?? []); setApiLoading(false) }
      })
      .catch(() => { if (!cancelled) { setApiPoints([]); setApiLoading(false) } })
    return () => { cancelled = true }
  }, [posKey, period, eurUsd]) // eslint-disable-line react-hooks/exhaustive-deps

  const W = 500; const H = 180
  const P = { t: 16, r: 8, b: 4, l: 8 }

  const isLoading = (period === '1G' || period === '1S') ? quotesLoading : apiLoading
  const hasData   = (period === '1G' || period === '1S') ? sparkSeries !== null : apiPoints.length >= 2

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <div className="ledgernest-spinner" style={{ width: 20, height: 20, border: '2px solid var(--border-subtle)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{tl('chartLoading')}</span>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div style={{ width: '100%', height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{tl('chartInsufficient')}</span>
      </div>
    )
  }

  const values = (period === '1G' || period === '1S') ? sparkSeries! : apiPoints.map((p) => p.value)
  const labels  = (period === '1G' || period === '1S') ? buildLabels(period) : buildRealLabels(apiPoints)

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
    const isSparkline = period === '1G' || period === '1S'
    const dateLabel = isSparkline
      ? labels[Math.round((hoverIdx / (n - 1)) * (labels.length - 1))]
      : (() => {
          const tDays = apiPoints.length >= 2
            ? (new Date(apiPoints.at(-1)!.date).getTime() - new Date(apiPoints[0].date).getTime()) / 86_400_000
            : 1
          return fmtCL(apiPoints[hoverIdx]?.date ?? '', tDays)
        })()
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
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={chartColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#cg)" vectorEffect="non-scaling-stroke" />
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
          <span key={m} style={{
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

// ── sparkline ─────────────────────────────────────────────────

function downsample(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr
  const step = arr.length / n
  return Array.from({ length: n }, (_, i) => arr[Math.round(i * step)])
}

function makeSpark(seed: number, positive: boolean, n = 60): number[] {
  const base = 100
  return Array.from({ length: n }, (_, i) => {
    const noise = Math.sin(seed + i * 0.7) * 4 + Math.cos(seed * 1.3 + i * 0.5) * 3
    return base + (positive ? i * 0.25 : -i * 0.25) + noise
  })
}

// ── page ──────────────────────────────────────────────────────

function PositionRowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const tl = useTranslations('crypto')
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

export default function CryptoPage() {
  const tl = useTranslations('crypto')
  const { fmt, fmtDlt } = useFormatters()
  const { refetch } = usePrices()
  const { positions, deletePosition, updatePosition } = usePortfolioStore()
  const { quotes, eurUsd, loading: quotesLoading } = usePricesStore()
  const { openModal } = useUIStore()
  const [period, setPeriod] = useState<CryptoPeriod>('1M')
  const [deletingPositionId, setDeletingPositionId] = useState<string | null>(null)
  const [editingTickerId, setEditingTickerId] = useState<string | null>(null)
  const [editingTickerVal, setEditingTickerVal] = useState('')

  const cryptos = positions.filter((p) => p.type === 'crypto')

  const rows = useMemo(() => cryptos.map((p, i) => {
    const q = quotes[p.ticker]
    const price = q?.priceEur ?? q?.price ?? p.avgPrice
    const avgPriceEur = p.currency === 'USD' ? p.avgPrice / eurUsd : p.avgPrice
    const value = price * p.quantity
    const cost = avgPriceEur * p.quantity
    const pnl = value - cost
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
    const dayChangePct = q?.changePct ?? 0
    const seed = p.ticker.charCodeAt(0) * 3 + (p.ticker.charCodeAt(1) ?? 0)
    // Use real 7-day sparkline from CoinGecko when available
    const rawSpark = q?.sparkline
    const spark = rawSpark && rawSpark.length >= 10 ? downsample(rawSpark, 60) : makeSpark(seed, dayChangePct >= 0)
    const color = coinColor(p.ticker, i)
    return { ...p, q, price, avgPriceEur, value, cost, pnl, pnlPct, dayChangePct, spark, color }
  }), [cryptos, quotes, eurUsd])

  const totalValue  = rows.reduce((s, r) => s + r.value, 0)
  const totalCost   = rows.reduce((s, r) => s + r.cost, 0)
  const totalPnl    = totalValue - totalCost
  const totalDayChg = rows.reduce((s, r) =>
    s + (r.q?.change ?? 0) * r.quantity * (r.q?.currency === 'EUR' ? 1 : 1 / eurUsd), 0)
  const totalDayPct = totalValue > 0 ? (totalDayChg / (totalValue - totalDayChg)) * 100 : 0

  // KPI: stablecoins
  const stableCount = rows.filter(r => isStable(r.ticker)).length

  // KPI: biggest holding
  const biggest = rows.length > 0 ? rows.reduce((a, b) => b.value > a.value ? b : a) : null

  // Custody label (most common broker)
  const custodyMap: Record<string, number> = {}
  for (const r of rows) if (r.broker) custodyMap[r.broker] = (custodyMap[r.broker] ?? 0) + 1
  const custody = Object.entries(custodyMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const donutData = rows.map((r) => ({ label: r.ticker, value: r.value, color: r.color }))

  if (cryptos.length === 0) {
    return (
      <div className="ledgernest-gap-5">
        <div className="ledgernest-card">
          <div className="ledgernest-empty">
            <div className="ledgernest-empty-icon">₿</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{tl('emptyTitle')}</div>
            <button className="ledgernest-btn ledgernest-btn-primary" onClick={() => openModal('buy', { assetType: 'crypto' })}>
              <Icon name="plus" size={14} /> {tl('emptyAdd')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ledgernest-gap-5">

      {/* KPI strip */}
      <div className="ledgernest-port-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div className="ledgernest-kpi is-hl" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{tl('kpiTotal')}</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmt(totalValue)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: totalDayPct >= 0 ? '#3fb950' : 'var(--danger)' }}>
            {totalDayPct >= 0 ? '+' : ''}{totalDayPct.toFixed(2)}% <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{tl('kpiToday')}</span>
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{tl('kpiPnl')}</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: totalPnl >= 0 ? '#3fb950' : 'var(--danger)' }}>
            {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 700, color: totalPnl >= 0 ? '#3fb950' : 'var(--danger)' }}>
              {totalPnl >= 0 ? '+' : ''}{totalCost > 0 ? ((totalPnl / totalCost) * 100).toFixed(2) : '0.00'}%
            </span> {tl('kpiVsCost')}
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{tl('kpiHoldings')}</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{cryptos.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {stableCount > 0
              ? <><span style={{ fontWeight: 700, color: '#f0a500' }}>{tl('kpiStablecoins', { n: stableCount })}</span> {tl('kpiLowDiv')}</>
              : <span style={{ color: '#3fb950', fontWeight: 600 }}>{tl('kpiNoStable')}</span>}
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{tl('kpiTop')}</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{biggest?.ticker ?? '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {biggest && totalValue > 0
              ? <><span style={{ fontWeight: 700 }}>{((biggest.value / totalValue) * 100).toFixed(0)}% {tl('kpiOfPortfolio')}</span> {fmt(biggest.value)}</>
              : '—'}
          </div>
        </div>

      </div>

      {/* Chart + Allocation */}
      <div className="ledgernest-port-charts" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>
        {/* Line chart */}
        <div className="ledgernest-card">
          <PortfolioPerformanceChart filter="crypto" title={tl('chartTitle')} />
        </div>

        {/* Allocazione */}
        <div className="ledgernest-card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{tl('allocationTitle')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{tl('allocationSubtitle', { n: cryptos.length })}</div>

          {/* Donut */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Donut data={donutData} size={160} thickness={26}
                label={`€${totalValue >= 1000 ? (totalValue / 1000).toFixed(1) + 'k' : totalValue.toFixed(0)}`}
                sublabel={tl('allocationTotal')} />
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.sort((a, b) => b.value - a.value).map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, width: 50 }}>{r.ticker.replace(/-USD$|-EUR$|\..*/, '')}</span>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.value)}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {totalValue > 0 ? ((r.value / totalValue) * 100).toFixed(1) : '0'}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Holdings table */}
      <div className="ledgernest-card ledgernest-port-table-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{tl('tableTitle', { n: cryptos.length })}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {custody ? tl('tableCustody', { custody }) : tl('tableSubtitle')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm"
              onClick={() => refetch()} style={{ padding: '0 10px', height: 32 }}>
              <Icon name="refresh" size={14} />
            </button>
            <button className="ledgernest-btn ledgernest-btn-primary ledgernest-btn-sm"
              onClick={() => openModal('buy', { assetType: 'crypto' })}>
              <Icon name="plus" size={13} /> {tl('buyButton')}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table className="ledgernest-table">
          <thead>
            <tr>
              <th>{tl('colAsset')}</th>
              <th className="num">{tl('colPnl')}</th>
              <th className="num">{tl('col24h')}</th>
              <th className="num">{tl('colQty')}</th>
              <th className="num">{tl('colAvgPrice')}</th>
              <th className="num">{tl('colPrice')}</th>
              <th style={{ paddingLeft: 12 }}>{tl('colTrend')}</th>
              <th className="num">{tl('colValue')}</th>
              <th className="num">{tl('colPortPct')}</th>
              <th>{tl('colCustody')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...rows].sort((a, b) => b.pnl - a.pnl).map((r) => {
              const portPct = totalValue > 0 ? (r.value / totalValue) * 100 : 0
              return (
                <tr key={r.id}>
                  <td>
                    <div className="ledgernest-table-ticker">
                      <div className="ledgernest-table-ticker-icon" style={{ background: `${r.color}22`, color: r.color }}>
                        {r.ticker.slice(0, 2)}
                      </div>
                      <div>
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
                            style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, width: 90, padding: '2px 6px', borderRadius: 5, border: '1px solid var(--accent)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none' }}
                          />
                        ) : (
                          <div className="ledgernest-table-ticker-name" style={{ cursor: 'pointer' }} title={tl('tickerEditTooltip')} onClick={() => { setEditingTickerId(r.id); setEditingTickerVal(r.ticker) }}>
                            {r.ticker.replace(/-USD$|-EUR$|\..*/, '')}
                          </div>
                        )}
                        <div className="ledgernest-table-ticker-sub">{r.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num ledgernest-mono" style={{ fontWeight: 600 }}>
                    <span className={deltaClass(r.pnl)}>{r.pnl >= 0 ? '+' : ''}{fmt(r.pnl)}</span>
                    <div><span className={deltaClass(r.pnlPct)} style={{ fontSize: 11 }}>{r.pnlPct >= 0 ? '+' : ''}{r.pnlPct.toFixed(2)}%</span></div>
                  </td>
                  <td className={`num ${deltaClass(r.dayChangePct)}`} style={{ fontWeight: 700, fontSize: 13 }}>
                    {r.q ? `${r.dayChangePct >= 0 ? '+' : ''}${r.dayChangePct.toFixed(2)}%` : '—'}
                  </td>
                  <td className="num ledgernest-mono" style={{ fontSize: 13 }}>
                    {r.quantity.toLocaleString('it-IT', { maximumFractionDigits: 6 })}
                  </td>
                  <td className="num ledgernest-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {fmt(r.avgPriceEur)}
                  </td>
                  <td className="num ledgernest-mono" style={{ fontSize: 13, fontWeight: 600 }}>
                    {fmt(r.price)}
                    {r.q?.price > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                        ${r.q.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </td>
                  <td style={{ width: 90, padding: '6px 12px' }}>
                    <Sparkline data={r.spark} height={28} positive={r.dayChangePct >= 0} responsive />
                  </td>
                  <td className="num ledgernest-mono" style={{ fontSize: 13, fontWeight: 600 }}>
                    {fmt(r.value)}
                  </td>
                  <td className="num">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{portPct.toFixed(1)}%</span>
                      <div style={{ width: 50, height: 3, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${portPct}%`, background: r.color, borderRadius: 99 }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {r.broker || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
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

      {deletingPositionId && (() => {
        const pos = cryptos.find((p) => p.id === deletingPositionId)
        return (
          <div className="ledgernest-modal-overlay" onClick={() => setDeletingPositionId(null)}>
            <div className="ledgernest-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div className="ledgernest-modal-header">
                <div className="ledgernest-modal-title">{tl('deleteTitle', { ticker: pos?.ticker ?? '' })}</div>
              </div>
              <div className="ledgernest-modal-body">
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
                  {tl('deleteBody', { name: pos?.name ?? pos?.ticker ?? '' })}
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
