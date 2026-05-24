'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePricesStore } from '@/stores/pricesStore'
import { usePrices } from '@/hooks/usePrices'
import { fmtEur, fmtUsd, fmtPct, deltaClass } from '@/lib/utils/format'
import Donut from '@/components/charts/Donut'
import Sparkline from '@/components/charts/Sparkline'
import Icon from '@/components/shared/Icon'
import { useUIStore } from '@/stores/uiStore'
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
  const d = new Date(dateStr + 'T12:00:00')
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
  cryptoPositions, biggest, totalValue, period, eurUsd, quotes, quotesLoading,
}: {
  cryptoPositions: PortfolioPosition[]
  biggest: { ticker: string; q?: { sparkline?: number[] } } | null
  totalValue: number
  period: CryptoPeriod
  eurUsd: number
  quotes: Record<string, Quote>
  quotesLoading: boolean
}) {
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
      const d = t?.date ?? p.createdAt.slice(0, 10)
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
      const purchaseDate = t?.date ?? p.createdAt.slice(0, 10)
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
  const P = { t: 16, r: 8, b: 26, l: 8 }

  const isLoading = (period === '1G' || period === '1S') ? quotesLoading : apiLoading
  const hasData   = (period === '1G' || period === '1S') ? sparkSeries !== null : apiPoints.length >= 2

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <div className="ledgernest-spinner" style={{ width: 20, height: 20, border: '2px solid var(--border-subtle)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Caricamento dati storici…</span>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div style={{ width: '100%', height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Dati insufficienti per il periodo selezionato</span>
      </div>
    )
  }

  const values = (period === '1G' || period === '1S') ? sparkSeries! : apiPoints.map((p) => p.value)
  const labels  = (period === '1G' || period === '1S') ? buildLabels(period) : buildRealLabels(apiPoints)

  const n = values.length
  const minV = Math.min(...values) * 0.982
  const maxV = Math.max(...values) * 1.008
  const xS = (i: number) => P.l + (i / (n - 1)) * (W - P.l - P.r)
  const yS = (v: number) => P.t + (1 - (v - minV) / (maxV - minV)) * (H - P.t - P.b)

  const linePts = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xS(i).toFixed(1)},${yS(v).toFixed(1)}`).join(' ')
  const area = `${linePts} L${xS(n - 1).toFixed(1)},${(H - P.b).toFixed(1)} L${xS(0).toFixed(1)},${(H - P.b).toFixed(1)} Z`

  const dotRows = 4; const dotCols = 18
  const dots = Array.from({ length: dotRows }, (_, r) =>
    Array.from({ length: dotCols }, (_, c) => ({
      x: P.l + (c / (dotCols - 1)) * (W - P.l - P.r),
      y: P.t + (r / (dotRows - 1)) * (H - P.t - P.b),
    }))
  ).flat()

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
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
          <stop offset="0%" stopColor="#5bc8d0" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#5bc8d0" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {dots.map((d, i) => <circle key={i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r="0.9" fill="rgba(255,255,255,0.07)" />)}
      <path d={area} fill="url(#cg)" />
      <path d={linePts} fill="none" stroke="#5bc8d0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {labels.map((m, i) => (
        <text key={m} x={(P.l + (i / (labels.length - 1)) * (W - P.l - P.r)).toFixed(1)} y={H - 6}
          textAnchor="middle" fontSize="11" fill="var(--text-secondary)" fontFamily="inherit">{m}</text>
      ))}
      {hoverIdx !== null && (() => {
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
        const tw = 110, th = 38
        const tx = Math.max(P.l, Math.min(W - P.r - tw, hx - tw / 2))
        const ty = Math.max(P.t + 4, hy - th - 10)
        return (
          <g key="crosshair">
            <line x1={hx} y1={P.t} x2={hx} y2={H - P.b} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4,3" />
            <circle cx={hx} cy={hy} r="5" fill="var(--bg-surface)" stroke="#5bc8d0" strokeWidth="2" />
            <rect x={tx} y={ty} width={tw} height={th} rx="7" fill="#1a2332" stroke="rgba(91,200,208,0.3)" strokeWidth="1" />
            <text x={tx + tw / 2} y={ty + 13} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)" fontFamily="inherit">{dateLabel}</text>
            <text x={tx + tw / 2} y={ty + 28} textAnchor="middle" fontSize="12" fontWeight="700" fill="#5bc8d0" fontFamily="inherit">{fmtEur(values[hoverIdx])}</text>
          </g>
        )
      })()}
    </svg>
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
            <Icon name="edit" size={13} /> Modifica
          </button>
          <button onClick={() => { setOpen(false); onDelete() }} style={{ ...item, color: 'var(--danger)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in oklch, var(--danger) 10%, transparent)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
            <Icon name="trash" size={13} /> Elimina
          </button>
        </div>
      )}
    </div>
  )
}

export default function CryptoPage() {
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
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Nessuna crypto nel portafoglio</div>
            <button className="ledgernest-btn ledgernest-btn-primary" onClick={() => openModal('buy', { assetType: 'crypto' })}>
              <Icon name="plus" size={14} /> Aggiungi la prima posizione
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
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>Totale Crypto</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmtEur(totalValue)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: totalDayPct >= 0 ? '#3fb950' : 'var(--danger)' }}>
            {totalDayPct >= 0 ? '+' : ''}{totalDayPct.toFixed(2)}% <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>oggi</span>
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>P&amp;L</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: totalPnl >= 0 ? '#3fb950' : 'var(--danger)' }}>
            {totalPnl >= 0 ? '+' : ''}{fmtEur(totalPnl)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 700, color: totalPnl >= 0 ? '#3fb950' : 'var(--danger)' }}>
              {totalPnl >= 0 ? '+' : ''}{totalCost > 0 ? ((totalPnl / totalCost) * 100).toFixed(2) : '0.00'}%
            </span> vs costo storico
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>Holdings</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{cryptos.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {stableCount > 0
              ? <><span style={{ fontWeight: 700, color: '#f0a500' }}>{stableCount} stablecoin</span> diversificazione bassa</>
              : <span style={{ color: '#3fb950', fontWeight: 600 }}>nessuna stablecoin</span>}
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>Maggiore</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{biggest?.ticker ?? '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {biggest && totalValue > 0
              ? <><span style={{ fontWeight: 700 }}>{((biggest.value / totalValue) * 100).toFixed(0)}% del portafoglio</span> {fmtEur(biggest.value)}</>
              : '—'}
          </div>
        </div>

      </div>

      {/* Chart + Allocation */}
      <div className="ledgernest-port-charts" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>
        {/* Line chart */}
        <div className="ledgernest-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Andamento crypto</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Valore complessivo ·{' '}
                {period === '1G' ? '1 giorno' : period === '1S' ? '1 settimana' : period === '1M' ? '1 mese' : period === '1A' ? '1 anno' : 'da inizio'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 8, padding: 3 }}>
              {CRYPTO_PERIODS.map((t) => (
                <button key={t} onClick={() => setPeriod(t)} style={{
                  padding: '3px 9px', borderRadius: 6, fontSize: '11px', fontWeight: 600,
                  border: 'none', cursor: 'pointer', transition: 'all .15s',
                  background: period === t ? 'var(--accent)' : 'transparent',
                  color: period === t ? '#fff' : 'var(--text-secondary)',
                }}>{t}</button>
              ))}
            </div>
          </div>
          <CryptoChart
            cryptoPositions={cryptos}
            biggest={biggest}
            totalValue={totalValue}
            period={period}
            eurUsd={eurUsd}
            quotes={quotes}
            quotesLoading={quotesLoading}
          />
        </div>

        {/* Allocazione */}
        <div className="ledgernest-card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Allocazione</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>Per asset · {cryptos.length} holdings</div>

          {/* Donut */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Donut data={donutData} size={160} thickness={26}
                label={`€${totalValue >= 1000 ? (totalValue / 1000).toFixed(1) + 'k' : totalValue.toFixed(0)}`}
                sublabel="totale" />
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.sort((a, b) => b.value - a.value).map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, width: 50 }}>{r.ticker.replace(/-USD$|-EUR$|\..*/, '')}</span>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(r.value)}</span>
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
            <div style={{ fontWeight: 700, fontSize: 14 }}>Holdings · {cryptos.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Prezzi in tempo reale{custody ? ` · custody ${custody}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm"
              onClick={() => refetch()} style={{ padding: '0 10px', height: 32 }}>
              <Icon name="refresh" size={14} />
            </button>
            <button className="ledgernest-btn ledgernest-btn-primary ledgernest-btn-sm"
              onClick={() => openModal('buy', { assetType: 'crypto' })}>
              <Icon name="plus" size={13} /> Acquista
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table className="ledgernest-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th className="num">Qty</th>
              <th className="num">Pr. medio</th>
              <th className="num">Prezzo</th>
              <th className="num">24H</th>
              <th style={{ paddingLeft: 12 }}>Trend 60g</th>
              <th className="num">Valore</th>
              <th className="num">P&amp;L</th>
              <th className="num">% Port.</th>
              <th>Custody</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.sort((a, b) => b.value - a.value).map((r) => {
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
                          <div className="ledgernest-table-ticker-name" style={{ cursor: 'pointer' }} title="Clicca per modificare" onClick={() => { setEditingTickerId(r.id); setEditingTickerVal(r.ticker) }}>
                            {r.ticker.replace(/-USD$|-EUR$|\..*/, '')}
                          </div>
                        )}
                        <div className="ledgernest-table-ticker-sub">{r.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num ledgernest-mono" style={{ fontSize: 13 }}>
                    {r.quantity.toLocaleString('it-IT', { maximumFractionDigits: 6 })}
                  </td>
                  <td className="num ledgernest-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {fmtEur(r.avgPriceEur)}
                  </td>
                  <td className="num ledgernest-mono" style={{ fontSize: 13, fontWeight: 600 }}>{fmtEur(r.price)}</td>
                  <td className={`num ${deltaClass(r.dayChangePct)}`} style={{ fontWeight: 700, fontSize: 13 }}>
                    {r.q ? `${r.dayChangePct >= 0 ? '+' : ''}${r.dayChangePct.toFixed(2)}%` : '—'}
                  </td>
                  <td style={{ width: 90, padding: '6px 12px' }}>
                    <Sparkline data={r.spark} height={28} positive={r.dayChangePct >= 0} responsive />
                  </td>
                  <td className="num ledgernest-mono" style={{ fontSize: 13, fontWeight: 600 }}>
                    {fmtEur(r.value)}
                  </td>
                  <td className="num">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <span className={`ledgernest-mono ${deltaClass(r.pnl)}`} style={{ fontSize: 13, fontWeight: 600 }}>
                        {r.pnl >= 0 ? '+' : ''}{fmtEur(r.pnl)}
                      </span>
                      <span className={deltaClass(r.pnlPct)} style={{ fontSize: 11 }}>
                        {r.pnlPct >= 0 ? '+' : ''}{r.pnlPct.toFixed(2)}%
                      </span>
                    </div>
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
                <div className="ledgernest-modal-title">Elimina crypto · {pos?.ticker}</div>
              </div>
              <div className="ledgernest-modal-body">
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
                  Elimini la posizione <strong>{pos?.name ?? pos?.ticker}</strong> e tutti i movimenti finanziari correlati.
                </p>
              </div>
              <div className="ledgernest-modal-footer">
                <button className="ledgernest-btn ledgernest-btn-ghost" onClick={() => setDeletingPositionId(null)}>Annulla</button>
                <button className="ledgernest-btn" style={{ background: 'var(--danger)', color: '#fff' }}
                  onClick={() => { deletePosition(deletingPositionId); setDeletingPositionId(null) }}>
                  Elimina
                </button>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
