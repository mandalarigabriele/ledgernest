'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useWatchlistStore, type WatchlistItem, type PriceAlert } from '@/stores/watchlistStore'
import { usePricesStore } from '@/stores/pricesStore'
import { usePrices } from '@/hooks/usePrices'
import { useFormatters } from '@/hooks/useFormatters'
import Sparkline from '@/components/charts/Sparkline'
import Icon from '@/components/shared/Icon'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Quote } from '@/types'

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

// ── 52-week range bar ─────────────────────────────────────────────────────────

function RangeBar({ low52, high52, price, currency }: { low52: number; high52: number; price: number; currency: string }) {
  const pct = high52 > low52 ? Math.max(0, Math.min(1, (price - low52) / (high52 - low52))) : 0.5
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 140 }}>
      <div style={{ position: 'relative', height: 4, borderRadius: 4, background: 'var(--bg-elevated)' }}>
        <div style={{
          position: 'absolute', left: `${pct * 100}%`, top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--text-secondary)', border: '2px solid var(--bg-base)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
        <span>{sym}{low52.toLocaleString()}</span>
        <span>{sym}{high52.toLocaleString()}</span>
      </div>
    </div>
  )
}

// ── alert bell ────────────────────────────────────────────────────────────────

function AlertBell({ ticker, alerts }: { ticker: string; alerts: PriceAlert[] }) {
  const tl = useTranslations('watchlist')
  const { addAlert, removeAlert, items, updateItem } = useWatchlistStore()
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top: 0, right: 0 })
  const [dir,  setDir]  = useState<'above' | 'below'>('above')
  const [val,  setVal]  = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)

  const active = alerts.filter((a) => a.ticker === ticker && a.active)

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      const el = document.getElementById(`alert-popup-${ticker}`)
      if (el && !el.contains(e.target as Node) && e.target !== btnRef.current) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open, ticker])

  async function save() {
    const n = parseFloat(val)
    if (isNaN(n)) return
    await addAlert({ ticker, threshold: n, direction: dir })
    const item = items.find((i) => i.ticker === ticker)
    if (item && !item.targetPrice) await updateItem(item.id, { targetPrice: n })
    setVal(''); setOpen(false)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{
          padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer',
          background: active.length > 0 ? 'var(--accent-dim)' : 'transparent',
          color:      active.length > 0 ? 'var(--accent)'     : 'var(--text-tertiary)',
          display: 'flex', alignItems: 'center',
        }}
      >
        <Icon name="bell" size={15} />
      </button>

      {open && (
        <div id={`alert-popup-${ticker}`} style={{
          position: 'fixed', top: pos.top, right: pos.right, zIndex: 200,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 10, padding: 14, width: 220, boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{tl('alertFor')} {ticker}</div>
          {active.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span>{a.direction === 'above' ? '↑' : '↓'} {a.threshold}</span>
              <button onClick={() => removeAlert(a.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 11 }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {(['above', 'below'] as const).map((d) => (
              <button key={d} onClick={() => setDir(d)} style={{
                flex: 1, padding: '4px 0', borderRadius: 6, border: '1px solid var(--border-default)',
                background: dir === d ? 'var(--accent-dim)' : 'transparent',
                color: dir === d ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 11, fontWeight: 600,
              }}>
                {d === 'above' ? `↑ ${tl('above')}` : `↓ ${tl('below')}`}
              </button>
            ))}
          </div>
          <input type="number" placeholder={tl('alertPrice')} value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 12, border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)', boxSizing: 'border-box', marginBottom: 8 }} />
          <button onClick={save} style={{ width: '100%', padding: '6px 0', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {tl('setAlert')}
          </button>
        </div>
      )}
    </>
  )
}

// ── add item modal ────────────────────────────────────────────────────────────

interface SearchSuggestion { symbol: string; tvSymbol: string; name: string; exchange: string; type: string }

export function AddItemModal({ lists, onClose, prefill }: {
  lists: string[]
  onClose: () => void
  prefill?: { ticker: string; name: string; currency: string; refPrice?: { usd: number; eur: number } }
}) {
  const tl = useTranslations('watchlist')
  const { addItem } = useWatchlistStore()
  const [ticker, setTicker]     = useState(prefill?.ticker ?? '')
  const [name, setName]         = useState(prefill?.name ?? '')
  const [currency, setCurrency] = useState(prefill?.currency ?? 'USD')
  const [target, setTarget]     = useState('')
  const [refPrice, setRefPrice] = useState<{ usd: number; eur: number } | undefined>(prefill?.refPrice)
  const [selLists, setSelLists] = useState<string[]>([])
  const [newList, setNewList]   = useState('')
  const [touched, setTouched]   = useState(false)

  // autocomplete
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSug, setShowSug]         = useState(false)
  const sugRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ticker || prefill) { setSuggestions([]); return }
    const id = setTimeout(() => {
      fetch(`/api/ticker/search?q=${encodeURIComponent(ticker)}`)
        .then((r) => r.json())
        .then((d: SearchSuggestion[]) => { setSuggestions(d); setShowSug(d.length > 0) })
        .catch(() => setSuggestions([]))
    }, 300)
    return () => clearTimeout(id)
  }, [ticker, prefill])

  function pickSuggestion(s: SearchSuggestion) {
    const curr = s.exchange?.includes('MIL') || s.exchange?.includes('EUR') ? 'EUR' :
                 s.exchange?.includes('LSE') ? 'GBP' : 'USD'
    setTicker(s.symbol); setName(s.name); setCurrency(curr)
    setSuggestions([]); setShowSug(false)
    setRefPrice(undefined)
    fetch(`/api/prices?tickers=${encodeURIComponent(s.symbol)}`)
      .then((r) => r.json())
      .then((d: { quotes: Array<{ ticker: string; price: number; currency: string; priceEur?: number }>; eurUsd: number }) => {
        const q = d.quotes.find((q) => q.ticker === s.symbol)
        if (!q) return
        const rate   = d.eurUsd || 1.08
        const priceUsd = q.currency === 'EUR' ? q.price * rate : q.price
        const priceEur = q.priceEur ?? (q.currency === 'EUR' ? q.price : q.price / rate)
        setRefPrice({ usd: priceUsd, eur: priceEur })
      })
      .catch(() => {})
  }

  const refForCurrency = refPrice ? (currency === 'EUR' ? refPrice.eur : refPrice.usd) : undefined
  function fmtRef(n: number) { return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

  const allLists = Array.from(new Set([...lists, ...(newList ? [newList] : [])]))
  const isValid  = ticker.trim().length > 0

  async function save() {
    setTouched(true)
    if (!isValid) return
    await addItem({ ticker: ticker.trim().toUpperCase(), name: name.trim() || ticker.trim().toUpperCase(), currency, lists: selLists, targetPrice: target ? parseFloat(target) : null })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 14, padding: 24, width: 380, boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>{tl('addTitle')}</div>

        {/* Ticker with autocomplete */}
        <div style={{ marginBottom: 12, position: 'relative' }} ref={sugRef}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{tl('fieldTicker')} <span style={{ color: 'var(--danger)' }}>*</span></div>
          <input
            value={ticker}
            onChange={(e) => { setTicker(e.target.value.toUpperCase()); setTouched(false) }}
            onFocus={() => suggestions.length > 0 && setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            placeholder="AAPL, NEXI.MI, BTC-USD…"
            autoFocus={!prefill}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, boxSizing: 'border-box', fontSize: 13,
              border: `1px solid ${touched && !isValid ? 'var(--danger)' : 'var(--border-default)'}`,
              background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          />
          {touched && !isValid && (
            <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{tl('fieldTickerRequired')}</div>
          )}
          {showSug && suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', marginTop: 2 }}>
              {suggestions.map((s) => (
                <button key={s.symbol} onMouseDown={() => pickSuggestion(s)}
                  style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                  <div style={{ flex: '0 0 44px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{s.symbol}</div>
                  <div style={{ flex: 1, fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{tl('fieldName')}</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apple Inc."
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{tl('fieldCurrency')}</div>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }}>
              {['USD', 'EUR', 'GBP'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{tl('fieldTarget')}</div>
              {refForCurrency && !target && (
                <button onClick={() => setTarget(refForCurrency.toFixed(2))}
                  style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {tl('useCurrentPrice')}
                </button>
              )}
            </div>
            <input type="number" value={target} onChange={(e) => setTarget(e.target.value)}
              placeholder="—"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
            {refPrice && (
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                ${fmtRef(refPrice.usd)} · €{fmtRef(refPrice.eur)}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('fieldLists')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allLists.map((l) => (
              <button key={l} onClick={() => setSelLists((s) => s.includes(l) ? s.filter((x) => x !== l) : [...s, l])}
                style={{ padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border-default)', cursor: 'pointer', fontSize: 12, background: selLists.includes(l) ? 'var(--accent-dim)' : 'transparent', color: selLists.includes(l) ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {l}
              </button>
            ))}
            <input value={newList} onChange={(e) => setNewList(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newList.trim()) { setSelLists((s) => [...s, newList.trim()]); setNewList('') } }}
              placeholder={`+ ${tl('newList')}`}
              style={{ padding: '3px 10px', borderRadius: 20, border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 12, width: 100 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>{tl('cancel')}</button>
          <button onClick={save} style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{tl('add')}</button>
        </div>
      </div>
    </div>
  )
}

// ── row ───────────────────────────────────────────────────────────────────────

function WatchlistRow({ item, quote, alerts, onRemove, currencySymbol, showPrePost }: {
  item: WatchlistItem; quote: Quote | undefined; alerts: PriceAlert[]
  onRemove: () => void; currencySymbol: string; showPrePost: boolean
}) {
  const price     = quote?.price ?? 0
  const changePct = quote?.changePct ?? 0
  const high52    = quote?.high52
  const low52     = quote?.low52
  const sparkline = quote?.sparkline ?? []

  // pre/post market — same logic as stocks page
  const extPrice    = showPrePost ? (quote?.preMarket ?? quote?.postMarket) : undefined
  const extLabel    = showPrePost ? (quote?.preMarket != null ? 'PM' : quote?.postMarket != null ? 'AH' : null) : null
  const extChangePct = extPrice != null && price > 0 ? (extPrice / price - 1) * 100 : undefined
  const displayPrice = extPrice ?? price

  const toTarget = item.targetPrice && displayPrice > 0 ? ((item.targetPrice - displayPrice) / displayPrice) * 100 : null

  const fmtPrice = (p: number) => `${currencySymbol}${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: p < 1 ? 4 : 2 })}`

  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
            {item.ticker.slice(0, 2)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{item.ticker}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{item.name}</div>
          </div>
        </div>
      </td>

      {/* Price + optional PM/AH */}
      <td className="num">
        {displayPrice > 0 ? (
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{fmtPrice(displayPrice)}</div>
            {extLabel && (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                {extLabel} · {fmtPrice(price)}
              </div>
            )}
          </div>
        ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
      </td>

      {/* Change */}
      <td className="num">
        {quote ? (
          <div>
            <div className={changePct >= 0 ? 'pos' : 'neg'} style={{ fontSize: 13 }}>{fmtPct(changePct)}</div>
            {extLabel && extChangePct != null && (
              <div style={{ fontSize: 10, color: extChangePct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {extLabel} {fmtPct(extChangePct)}
              </div>
            )}
          </div>
        ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
      </td>

      {/* Sparkline */}
      <td style={{ textAlign: 'center' }}>
        {sparkline.length >= 2 ? <Sparkline data={sparkline} width={80} height={28} /> : <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>—</span>}
      </td>

      {/* 52w range */}
      <td style={{ textAlign: 'center' }}>
        {high52 && low52 && displayPrice > 0 ? <RangeBar low52={low52} high52={high52} price={displayPrice} currency={item.currency} /> : <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>—</span>}
      </td>

      {/* Target */}
      <td className="num">
        {item.targetPrice ? (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{currencySymbol}{item.targetPrice.toLocaleString()}</div>
            {toTarget !== null && <div style={{ fontSize: 11, color: toTarget >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtPct(toTarget)}</div>}
          </div>
        ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
      </td>

      <td style={{ textAlign: 'center' }}><AlertBell ticker={item.ticker} alerts={alerts} /></td>
      <td style={{ textAlign: 'center' }}>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, display: 'flex', alignItems: 'center' }}>
          <Icon name="close" size={13} />
        </button>
      </td>
    </tr>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function WatchlistPage() {
  const tl = useTranslations('watchlist')
  usePrices()
  const { items, alerts, removeItem } = useWatchlistStore()
  const { quotes } = usePricesStore()
  const showPrePost = useSettingsStore((s) => s.settings.showPrePostMarket)
  const [activeList, setActiveList] = useState<string | null>(null)
  const [showAdd, setShowAdd]       = useState(false)

  const allLists = useMemo(() => {
    const s = new Set<string>()
    items.forEach((i) => i.lists.forEach((l) => s.add(l)))
    return Array.from(s)
  }, [items])

  const filtered = useMemo(() =>
    activeList ? items.filter((i) => i.lists.includes(activeList)) : items,
    [items, activeList])

  const kpi = useMemo(() => {
    let up = 0, upSum = 0, down = 0, downSum = 0
    items.forEach((i) => {
      const pct = quotes[i.ticker]?.changePct ?? 0
      if (pct >= 0) { up++; upSum += pct } else { down++; downSum += pct }
    })
    return { total: items.length, up, upAvg: up ? upSum / up : 0, down, downAvg: down ? downSum / down : 0, activeAlerts: alerts.filter((a) => a.active).length }
  }, [items, quotes, alerts])

  const symFor = (c: string) => c === 'EUR' ? '€' : c === 'GBP' ? '£' : '$'

  return (
    <div className="ledgernest-gap-5">
      {/* KPI */}
      <div className="ledgernest-kpi-strip">
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">{tl('kpiTotal')}</div>
          <div className="ledgernest-kpi-value">{kpi.total}</div>
          <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>{allLists.length} {tl('kpiLists')}</div>
        </div>
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">{tl('kpiUp')}</div>
          <div className="ledgernest-kpi-value" style={{ color: 'var(--success)' }}>{kpi.up}</div>
          <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>{fmtPct(kpi.upAvg)} {tl('kpiAvg')}</div>
        </div>
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">{tl('kpiDown')}</div>
          <div className="ledgernest-kpi-value" style={{ color: 'var(--danger)' }}>{kpi.down}</div>
          <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>{fmtPct(kpi.downAvg)} {tl('kpiAvg')}</div>
        </div>
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">{tl('kpiAlerts')}</div>
          <div className="ledgernest-kpi-value">{kpi.activeAlerts}</div>
          <div style={{ fontSize: 11, color: kpi.activeAlerts > 0 ? 'var(--accent)' : 'var(--text-tertiary)', marginTop: 2 }}>
            {kpi.activeAlerts > 0 ? tl('kpiAlertsActive') : tl('kpiAlertsNone')}
          </div>
        </div>
      </div>

      {/* Tabs + add */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div className="ledgernest-tabs">
          <button className={`ledgernest-tab${activeList === null ? ' active' : ''}`} onClick={() => setActiveList(null)}>
            {tl('tabAll')} {items.length}
          </button>
          {allLists.map((l) => (
            <button key={l} className={`ledgernest-tab${activeList === l ? ' active' : ''}`} onClick={() => setActiveList(l)}>
              {l} {items.filter((i) => i.lists.includes(l)).length}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> {tl('addButton')}
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="ledgernest-card">
          <div className="ledgernest-empty">
            <div className="ledgernest-empty-icon">👁</div>
            {tl('empty')}
          </div>
        </div>
      ) : (
        <div className="ledgernest-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="ledgernest-table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '22%' }}>{tl('colTicker')}</th>
                <th style={{ width: '10%', textAlign: 'right' }}>{tl('colPrice')}</th>
                <th style={{ width: '9%',  textAlign: 'right' }}>{tl('colChange')}</th>
                <th style={{ width: '12%', textAlign: 'center' }}>{tl('colTrend')}</th>
                <th style={{ width: '22%', textAlign: 'center' }}>{tl('col52w')}</th>
                <th style={{ width: '12%', textAlign: 'right' }}>{tl('colTarget')}</th>
                <th style={{ width: '7%',  textAlign: 'center' }}>{tl('colAlert')}</th>
                <th style={{ width: '6%' }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <WatchlistRow key={item.id} item={item} quote={quotes[item.ticker]} alerts={alerts} onRemove={() => removeItem(item.id)} currencySymbol={symFor(item.currency)} showPrePost={showPrePost} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddItemModal lists={allLists} onClose={() => setShowAdd(false)} />}
    </div>
  )
}
