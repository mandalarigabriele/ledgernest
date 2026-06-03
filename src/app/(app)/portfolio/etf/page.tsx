'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePricesStore } from '@/stores/pricesStore'
import { usePrices } from '@/hooks/usePrices'
import { useSettingsStore } from '@/stores/settingsStore'
import { effectivePriceEur } from '@/lib/utils/price'
import { fmtUsd, fmtPct, fmtNum, deltaClass } from '@/lib/utils/format'
import { useFormatters } from '@/hooks/useFormatters'
import Sparkline from '@/components/charts/Sparkline'
import PortfolioPerformanceChart from '@/components/charts/PortfolioPerformanceChart'
import Icon from '@/components/shared/Icon'
import { useUIStore } from '@/stores/uiStore'
import { useTranslations } from 'next-intl'
import type { PortfolioPosition, Quote } from '@/types'

// ── region colors ─────────────────────────────────────────────

const REGION_COLORS: Record<string, string> = {
  Globale:    '#5bc8d0',
  USA:        '#7c6df7',
  Sviluppato: '#3fb950',
  Emergenti:  '#d29922',
  'Bond':     '#58a6ff',
  REIT:       '#e879a8',
  Europa:     '#f77c3a',
  Asia:       '#9b8fef',
}

function regionColor(r: string | undefined): string {
  if (!r) return '#8b949e'
  for (const [key, color] of Object.entries(REGION_COLORS)) {
    if (r.toLowerCase().includes(key.toLowerCase())) return color
  }
  return '#8b949e'
}

type EtfCategory = 'Azionari' | 'Bond' | 'REIT'

function etfCategory(region?: string): EtfCategory {
  if (!region) return 'Azionari'
  const r = region.toLowerCase()
  if (r.includes('bond')) return 'Bond'
  if (r === 'reit') return 'REIT'
  return 'Azionari'
}

// ── simulated sparkline (no intraday data from Yahoo) ─────────

function makeSpark(seed: number, positive: boolean, n = 22): number[] {
  return Array.from({ length: n }, (_, i) => {
    const noise = Math.sin(seed + i * 0.9) * 3 + Math.cos(seed * 1.5 + i * 0.7) * 2
    return 100 + (positive ? i * 0.35 : -i * 0.35) + noise
  })
}

// ── page ──────────────────────────────────────────────────────

function PositionRowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const tl = useTranslations('etf')
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

type EtfFilter = 'Tutti' | 'Azionari' | 'Bond' | 'REIT'
const ETF_FILTERS: EtfFilter[] = ['Tutti', 'Azionari', 'Bond', 'REIT']

export default function EtfPage() {
  const tl = useTranslations('etf')
  const { fmt, fmtDlt } = useFormatters()
  const { refetch } = usePrices()
  const { positions, deletePosition, updatePosition } = usePortfolioStore()
  const { quotes, eurUsd, loading } = usePricesStore()
  const showPrePostMarket = useSettingsStore((s) => s.settings.showPrePostMarket)
  const { openModal } = useUIStore()
const [filter, setFilter] = useState('Tutti' as EtfFilter)
  const [deletingPositionId, setDeletingPositionId] = useState<string | null>(null)
  const [editingTickerId, setEditingTickerId] = useState<string | null>(null)
  const [editingTickerVal, setEditingTickerVal] = useState('')

  const etfs = positions.filter((p) => p.type === 'etf')

  const rows = useMemo(() => etfs.map((p) => {
    const q = quotes[p.ticker]
    const price = effectivePriceEur(q, p.avgPrice, showPrePostMarket)
    const avgPriceEur = p.currency === 'USD' ? p.avgPrice / eurUsd : p.avgPrice
    const value = price * p.quantity
    const cost  = avgPriceEur * p.quantity
    const pnl   = value - cost
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
    const dayChangePct = q?.changePct ?? 0
    const seed  = p.ticker.charCodeAt(0) + (p.ticker.charCodeAt(1) ?? 0)
    const spark = makeSpark(seed, dayChangePct >= 0)
    return { ...p, q, price, avgPriceEur, value, cost, pnl, pnlPct, dayChangePct, spark }
  }), [etfs, quotes, eurUsd])

  const totalValue  = rows.reduce((s, r) => s + r.value, 0)
  const totalCost   = rows.reduce((s, r) => s + r.cost,  0)
  const totalPnl    = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0
  const totalDayChg = rows.reduce((s, r) =>
    s + (r.q?.change ?? 0) * r.quantity * (r.q?.currency === 'EUR' ? 1 : 1 / eurUsd), 0)
  const totalDayPct = totalValue > 0 ? (totalDayChg / (totalValue - totalDayChg + 0.001)) * 100 : 0

  const weightedTer = totalValue > 0
    ? rows.reduce((s, r) => s + (r.ter ?? 0) * r.value, 0) / totalValue
    : 0
  const annualCost  = totalValue * weightedTer

  const regionMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of rows) {
      const region = r.region ?? 'Globale'
      map[region] = (map[region] ?? 0) + r.value
    }
    return map
  }, [rows])

  const regionCount = Object.keys(regionMap).length
  const hasEquity   = rows.some((r) => etfCategory(r.region) === 'Azionari')
  const hasBond     = rows.some((r) => etfCategory(r.region) === 'Bond')
  const hasReit     = rows.some((r) => etfCategory(r.region) === 'REIT')
  const exposureDesc = [hasEquity && 'azionario', hasBond && 'bond', hasReit && 'REIT'].filter(Boolean).join(' + ')

  const filtered = (filter === 'Tutti' ? rows : rows.filter((r) => etfCategory(r.region) === filter))
    .sort((a, b) => b.pnl - a.pnl)

  if (etfs.length === 0) {
    return (
      <div className="ledgernest-card">
        <div className="ledgernest-empty">
          <div className="ledgernest-empty-icon">🌐</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{tl('emptyTitle')}</div>
          <button className="ledgernest-btn ledgernest-btn-primary" onClick={() => openModal('buy', { assetType: 'etf' })}>
            <Icon name="plus" size={14} /> {tl('emptyAdd')}
          </button>
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
          <div style={{ fontSize: 12, fontWeight: 600, color: totalDayPct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {fmtPct(totalDayPct)} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{tl('kpiToday')} · {etfs.length}</span>
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
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{tl('kpiTer')}</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{(weightedTer * 100).toFixed(2)}%</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {tl('kpiWeightedTer', { annualCost: `${fmt(annualCost)}` })}
          </div>
        </div>
      </div>

      {/* Chart + Esposizione regionale */}
      <div className="ledgernest-port-charts" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>
        <div className="ledgernest-card">
          <PortfolioPerformanceChart filter="etf" title={tl('chartTitle')} />
        </div>

        <div className="ledgernest-card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{tl('exposureTitle')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 18 }}>{tl('exposureCount', { n: regionCount })}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {Object.entries(regionMap).sort((a, b) => b[1] - a[1]).map(([region, value]) => {
              const pct   = totalValue > 0 ? (value / totalValue) * 100 : 0
              const color = regionColor(region)
              return (
                <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 76, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0, textAlign: 'right' }}>
                    {region.length > 11 ? region.slice(0, 10) + '.' : region}
                  </div>
                  <div style={{ flex: 1, height: 7, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`, borderRadius: 99,
                      background: `linear-gradient(90deg, ${color}, ${color}bb)`,
                      transition: 'width .4s ease',
                    }} />
                  </div>
                  <div style={{ width: 42, fontSize: 12, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)' }}>{pct.toFixed(1)}%</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="ledgernest-card ledgernest-port-table-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{tl('tableTitle', { n: etfs.length })}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{tl('tableSubtitle')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 10, padding: 3 }}>
              {ETF_FILTERS.map((f) => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '4px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                  border: 'none', cursor: 'pointer',
                  background: filter === f ? 'var(--bg-surface)' : 'transparent',
                  color: filter === f ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: filter === f ? '0 1px 4px rgba(0,0,0,.25)' : 'none',
                }}>{f}</button>
              ))}
            </div>
            <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm"
              onClick={() => refetch()} disabled={loading} style={{ padding: '0 10px', height: 32 }}>
              <Icon name="refresh" size={14} />
            </button>
            <button className="ledgernest-btn ledgernest-btn-primary ledgernest-btn-sm"
              onClick={() => openModal('buy', { assetType: 'etf' })}>
              <Icon name="plus" size={13} /> {tl('addButton')}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table className="ledgernest-table">
          <thead>
            <tr>
              <th>{tl('colEtf')}</th>
              <th className="num">{tl('colPnl')}</th>
              <th>{tl('colRegion')}</th>
              <th className="num">{tl('colQty')}</th>
              <th className="num">{tl('colAvgPrice')}</th>
              <th className="num">{tl('colPrice')}</th>
              <th style={{ paddingLeft: 12 }}>{tl('colTrend')}</th>
              <th className="num">{tl('colTer')}</th>
              <th className="num">{tl('colValue')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>{tl('emptyTable')}</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="ledgernest-table-ticker">
                    <div className="ledgernest-table-ticker-icon">{r.ticker.slice(0, 2)}</div>
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
                        <div className="ledgernest-table-ticker-name" style={{ cursor: 'pointer' }} title={tl('menuEdit')} onClick={() => { setEditingTickerId(r.id); setEditingTickerVal(r.ticker) }}>
                          {r.ticker}
                        </div>
                      )}
                      <div className="ledgernest-table-ticker-sub">{r.name}</div>
                    </div>
                  </div>
                </td>
                <td className="num ledgernest-mono" style={{ fontWeight: 600 }}>
                  <span className={deltaClass(r.pnl)}>{fmtDlt(r.pnl)}</span>
                  <div><span className={deltaClass(r.pnlPct)} style={{ fontSize: 11 }}>{fmtPct(r.pnlPct)}</span></div>
                </td>
                <td>
                  {r.region ? (
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, whiteSpace: 'nowrap',
                      background: `${regionColor(r.region)}22`, color: regionColor(r.region),
                    }}>{r.region}</span>
                  ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                </td>
                <td className="num ledgernest-mono" style={{ fontSize: 13 }}>{fmtNum(r.quantity)}</td>
                <td className="num ledgernest-mono" style={{ fontSize: 13 }}>{fmt(r.avgPriceEur)}</td>
                <td className="num ledgernest-mono" style={{ fontSize: 13, fontWeight: 600 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <span>{fmt(r.price)}</span>
                    {r.q && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: r.dayChangePct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {r.dayChangePct >= 0 ? '+' : ''}{r.dayChangePct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ width: 100, padding: '6px 12px' }}>
                  <Sparkline data={r.spark} height={32} positive={r.dayChangePct >= 0} responsive />
                </td>
                <td className="num" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {r.ter != null ? `${(r.ter * 100).toFixed(2)}%` : '—'}
                </td>
                <td className="num ledgernest-mono" style={{ fontWeight: 600 }}>{fmt(r.value)}</td>
                <td style={{ width: 40 }}>
                  <PositionRowMenu
                    onEdit={() => openModal('editPosition', { position: r })}
                    onDelete={() => setDeletingPositionId(r.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deletingPositionId && (() => {
        const pos = etfs.find((p) => p.id === deletingPositionId)
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

      {/* Daily change footer */}
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: 11 }}>
        {tl('footerDayChange')}{' '}
        <span style={{ fontWeight: 600, color: totalDayChg >= 0 ? 'var(--success)' : 'var(--danger)' }}>
          {totalDayChg >= 0 ? '+' : ''}{fmt(totalDayChg)}
        </span>
        · {tl('footerSource')}
      </div>
    </div>
  </div>
  )
}
