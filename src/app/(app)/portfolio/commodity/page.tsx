'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePricesStore } from '@/stores/pricesStore'
import { usePrices } from '@/hooks/usePrices'
import { useSettingsStore } from '@/stores/settingsStore'
import { effectivePriceEur } from '@/lib/utils/price'
import { fmtPct, fmtNum, deltaClass } from '@/lib/utils/format'
import { useFormatters } from '@/hooks/useFormatters'
import Sparkline from '@/components/charts/Sparkline'
import Icon from '@/components/shared/Icon'
import { useUIStore } from '@/stores/uiStore'
import { useTranslations } from 'next-intl'
import PortfolioPerformanceChart from '@/components/charts/PortfolioPerformanceChart'
import type { PortfolioPosition, Quote } from '@/types'

// ── commodity categories ──────────────────────────────────────

type CommodityCategory = 'Metalli preziosi' | 'Energia' | 'Agricoltura' | 'Metalli industriali' | 'Altro'

const CATEGORY_COLORS: Record<CommodityCategory, string> = {
  'Metalli preziosi':    '#f0c040',
  'Energia':             '#f77c3a',
  'Agricoltura':         '#3fb950',
  'Metalli industriali': '#58a6ff',
  'Altro':               '#8b949e',
}

// Map common tickers/keywords to category
const PRECIOUS_METALS = new Set(['GC', 'GOLD', 'GLD', 'IAU', 'SI', 'SLV', 'XAG', 'XAU', 'PT', 'PPLT', 'PA', 'PALL', 'SILVER', 'GOLD'])
const ENERGY_KEYWORDS = ['OIL', 'CL', 'USO', 'BRENT', 'GAS', 'NG', 'UNG', 'COAL', 'ENERGY', 'NRGU']
const AGRI_KEYWORDS   = ['CORN', 'ZC', 'WHEAT', 'ZW', 'SOY', 'ZS', 'COFFEE', 'KC', 'SUGAR', 'SB', 'COTTON', 'COCOA', 'AGRI', 'DBA']
const INDUSTRIAL_KEYWORDS = ['COPPER', 'HG', 'ALUMINUM', 'ZINC', 'NICKEL', 'STEEL', 'IRON', 'CPER', 'JJC']

function commodityCategory(ticker: string, name?: string): CommodityCategory {
  const t = ticker.replace(/[=F\-].*/, '').toUpperCase()
  const n = (name ?? '').toLowerCase()
  if (PRECIOUS_METALS.has(t) || n.includes('gold') || n.includes('silver') || n.includes('platinum') || n.includes('pallad')) return 'Metalli preziosi'
  if (ENERGY_KEYWORDS.some((k) => t.includes(k) || n.includes(k.toLowerCase()))) return 'Energia'
  if (AGRI_KEYWORDS.some((k) => t.includes(k) || n.includes(k.toLowerCase()))) return 'Agricoltura'
  if (INDUSTRIAL_KEYWORDS.some((k) => t.includes(k) || n.includes(k.toLowerCase()))) return 'Metalli industriali'
  return 'Altro'
}

// ── sparkline ─────────────────────────────────────────────────

function makeSpark(seed: number, positive: boolean, n = 22): number[] {
  return Array.from({ length: n }, (_, i) => {
    const noise = Math.sin(seed + i * 0.9) * 3 + Math.cos(seed * 1.5 + i * 0.7) * 2
    return 100 + (positive ? i * 0.35 : -i * 0.35) + noise
  })
}


// ── row menu ──────────────────────────────────────────────────

function PositionRowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const tl = useTranslations('commodity')
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

// ── page ──────────────────────────────────────────────────────

type CatFilter = 'Tutte' | CommodityCategory
const CAT_FILTERS: CatFilter[] = ['Tutte', 'Metalli preziosi', 'Energia', 'Agricoltura', 'Metalli industriali', 'Altro']

export default function CommodityPage() {
  const tl = useTranslations('commodity')
  const { fmt, fmtDlt } = useFormatters()
  usePrices()
  const { positions, deletePosition } = usePortfolioStore()
  const { quotes, eurUsd } = usePricesStore()
  const showPrePostMarket = useSettingsStore((s) => s.settings.showPrePostMarket)
  const { openModal } = useUIStore()
  const [filter, setFilter] = useState<CatFilter>('Tutte')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const commodities = positions.filter((p) => p.type === 'commodity')

  const rows = useMemo(() => commodities.map((p) => {
    const q = quotes[p.ticker]
    const price = effectivePriceEur(q, p.avgPrice, showPrePostMarket)
    const avgPriceEur = p.currency === 'USD' ? p.avgPrice / eurUsd : p.avgPrice
    const value = price * p.quantity
    const cost = avgPriceEur * p.quantity
    const pnl = value - cost
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
    const dayChangePct = q?.changePct ?? 0
    const cat = commodityCategory(p.ticker, p.name)
    const seed = p.ticker.charCodeAt(0) + (p.ticker.charCodeAt(1) ?? 0)
    const spark = makeSpark(seed, dayChangePct >= 0)
    return { ...p, q, price, avgPriceEur, value, cost, pnl, pnlPct, dayChangePct, cat, spark }
  }), [commodities, quotes, eurUsd])

  const totalValue  = rows.reduce((s, r) => s + r.value, 0)
  const totalCost   = rows.reduce((s, r) => s + r.cost, 0)
  const totalPnl    = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0
  const totalDayChg = rows.reduce((s, r) => s + (r.q?.change ?? 0) * r.quantity * (r.q?.currency === 'EUR' ? 1 : 1 / eurUsd), 0)
  const totalDayPct = totalValue > 0 ? (totalDayChg / (totalValue - totalDayChg + 0.001)) * 100 : 0

  const bestRow = rows.length > 0 ? [...rows].sort((a, b) => b.pnlPct - a.pnlPct)[0] : null
  const categories = Array.from(new Set(rows.map((r) => r.cat)))

  const catMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of rows) map[r.cat] = (map[r.cat] ?? 0) + r.value
    return map
  }, [rows])

  const filtered = (filter === 'Tutte' ? rows : rows.filter((r) => r.cat === filter))
    .sort((a, b) => b.value - a.value)

  if (commodities.length === 0) {
    return (
      <div className="ledgernest-card">
        <div className="ledgernest-empty">
          <div className="ledgernest-empty-icon">🏅</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{tl('emptyTitle')}</div>
          <button className="ledgernest-btn ledgernest-btn-primary" onClick={() => openModal('buy', { assetType: 'commodity' })}>
            <Icon name="plus" size={14} /> {tl('emptyAdd')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ledgernest-gap-5">

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div className="ledgernest-kpi is-hl" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{tl('kpiTotal')}</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmt(totalValue)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: totalDayPct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {fmtPct(totalDayPct)} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{tl('kpiToday')} · {commodities.length}</span>
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{tl('kpiPnl')}</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: totalPnl >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {fmtDlt(totalPnl)}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: totalPnl >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {fmtPct(totalPnlPct)} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{tl('kpiVsCost')}</span>
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{tl('kpiInvested')}</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmt(totalCost)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tl('kpiCapital')}</div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{tl('kpiBestLabel')}</div>
          {bestRow ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: bestRow.pnlPct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {bestRow.ticker}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <span style={{ fontWeight: 700, color: bestRow.pnlPct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {fmtPct(bestRow.pnlPct)}
                </span> {tl('kpiBestSub')}
              </div>
            </>
          ) : <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>—</div>}
        </div>
      </div>

      {/* Chart + allocation */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 12 }}>
        <div className="ledgernest-card" style={{ padding: '20px 20px 12px' }}>
          <PortfolioPerformanceChart filter="commodity" title={tl('chartTitle')} />
        </div>

        {/* Category allocation */}
        <div className="ledgernest-card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Allocazione</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
              const pct = totalValue > 0 ? (val / totalValue) * 100 : 0
              const color = CATEGORY_COLORS[cat as CommodityCategory] ?? '#8b949e'
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{cat}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99 }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{fmt(val)}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="ledgernest-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{tl('tableTitle', { n: filtered.length })}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{tl('tableSubtitle')}</div>
          </div>
          {/* Category filters */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {CAT_FILTERS.filter((f) => f === 'Tutte' || rows.some((r) => r.cat === f)).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: filter === f ? 'var(--accent)' : 'transparent',
                color: filter === f ? 'var(--text-on-accent)' : 'var(--text-secondary)',
              }}>{f}</button>
            ))}
          </div>
        </div>

        <table className="ledgernest-table">
          <thead>
            <tr>
              <th>{tl('colAsset')}</th>
              <th>{tl('colCategory')}</th>
              <th className="num">{tl('colQty')}</th>
              <th className="num">{tl('colAvgPrice')}</th>
              <th className="num">{tl('colPrice')}</th>
              <th style={{ width: 90 }}>{tl('colTrend')}</th>
              <th className="num">{tl('colValue')}</th>
              <th className="num">{tl('colPnl')}</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const color = CATEGORY_COLORS[r.cat]
              return (
                <tr key={r.id}>
                  <td>
                    <div className="ledgernest-table-ticker">
                      <div className="ledgernest-table-ticker-icon" style={{ background: `${color}22`, color }}>
                        {r.ticker.slice(0, 2)}
                      </div>
                      <div>
                        <div className="ledgernest-table-ticker-name">{r.ticker}</div>
                        <div className="ledgernest-table-ticker-sub">{r.name || r.cat}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                      background: `${color}22`, color }}>
                      {r.cat}
                    </span>
                  </td>
                  <td className="num ledgernest-mono" style={{ fontSize: 13 }}>{fmtNum(r.quantity)}</td>
                  <td className="num ledgernest-mono" style={{ fontSize: 13 }}>{fmt(r.avgPriceEur)}</td>
                  <td className="num ledgernest-mono" style={{ fontSize: 13, fontWeight: 600 }}>
                    {fmt(r.price)}
                    {r.q?.currency === 'USD' && r.q.price > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                        ${r.q.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </td>
                  <td style={{ width: 90, padding: '6px 12px' }}>
                    <Sparkline data={r.spark} height={28} positive={r.dayChangePct >= 0} responsive />
                  </td>
                  <td className="num ledgernest-mono" style={{ fontWeight: 600 }}>{fmt(r.value)}</td>
                  <td className="num">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <span className={`ledgernest-mono ${deltaClass(r.pnl)}`} style={{ fontSize: 13, fontWeight: 600 }}>
                        {fmtDlt(r.pnl)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: r.pnlPct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {r.pnlPct >= 0 ? '+' : ''}{fmtPct(r.pnlPct)}
                      </span>
                    </div>
                  </td>
                  <td style={{ width: 40 }}>
                    <PositionRowMenu
                      onEdit={() => openModal('editPosition', { position: r })}
                      onDelete={() => setDeletingId(r.id)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Delete confirm */}
      {deletingId && (() => {
        const r = rows.find((x) => x.id === deletingId)!
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 14, padding: 24, maxWidth: 380, width: '90%', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{tl('deleteTitle', { ticker: r.ticker })}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{tl('deleteBody')}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setDeletingId(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>
                  {tl('cancel')}
                </button>
                <button onClick={() => { deletePosition(r.id); setDeletingId(null) }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
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
