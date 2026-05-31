'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useUIStore } from '@/stores/uiStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useFinanceStore } from '@/stores/financeStore'
import { usePricesStore } from '@/stores/pricesStore'
import { useFormatters } from '@/hooks/useFormatters'
import Icon from './Icon'
import type { TickerSuggestion } from '@/app/api/ticker/search/route'

// ── static data (hrefs and icons only — labels come from translations) ────

const SECTION_META = [
  { id: 'dashboard',  icon: 'dashboard',    href: '/dashboard',              navKey: 'dashboard',  groupKey: 'portfolio' },
  { id: 'azioni',     icon: 'azioni',       href: '/portfolio/stocks',       navKey: 'azioni',     groupKey: 'portfolio' },
  { id: 'dividendi',  icon: 'dividendi',    href: '/portfolio/dividends',    navKey: 'dividendi',  groupKey: 'portfolio' },
  { id: 'crypto',     icon: 'crypto',       href: '/portfolio/crypto',       navKey: 'crypto',     groupKey: 'portfolio' },
  { id: 'etf',        icon: 'etf',          href: '/portfolio/etf',          navKey: 'etf',        groupKey: 'portfolio' },
  { id: 'screener',   icon: 'screener',     href: '/portfolio/watchlist',    navKey: 'screener',   groupKey: 'analisi'   },
  { id: 'heatmap',    icon: 'heatmap',      href: '/portfolio/heatmap',      navKey: 'heatmap',    groupKey: 'analisi'   },
  { id: 'conti',      icon: 'conti',        href: '/finance/accounts',       navKey: 'conti',      groupKey: 'finanze'   },
  { id: 'movimenti',  icon: 'movimenti',    href: '/finance/transactions',   navKey: 'movimenti',  groupKey: 'finanze'   },
  { id: 'budget',     icon: 'budget',       href: '/finance/budget',         navKey: 'budget',     groupKey: 'finanze'   },
  { id: 'obiettivi',  icon: 'obiettivi',    href: '/finance/goals',          navKey: 'obiettivi',  groupKey: 'finanze'   },
  { id: 'ricorrenti', icon: 'ricorrenti',   href: '/finance/recurring',      navKey: 'ricorrenti', groupKey: 'finanze'   },
  { id: 'patrimonio', icon: 'patrimonio',   href: '/finance/net-worth',      navKey: 'patrimonio', groupKey: 'finanze'   },
  { id: 'report',     icon: 'report',       href: '/finance/report',         navKey: 'report',     groupKey: 'finanze'   },
  { id: 'settings',   icon: 'impostazioni', href: '/settings',               navKey: 'impostazioni', groupKey: 'sistema' },
] as const

// ── helpers ───────────────────────────────────────────────────

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

// ── component ─────────────────────────────────────────────────

export default function SearchPalette() {
  const ts = useTranslations('search')
  const tn = useTranslations('nav')
  const router = useRouter()
  const { setSearchOpen, openModal } = useUIStore()
  const { positions } = usePortfolioStore()
  const { transactions } = useFinanceStore()
  const { quotes, eurUsd } = usePricesStore()
  const { fmt } = useFormatters()

  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(0)
  const [tickerSuggestions, setTickerSuggestions] = useState<TickerSuggestion[]>([])
  const [tickerLoading, setTickerLoading]         = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  // debounced Yahoo Finance ticker search — show nothing until resolved
  useEffect(() => {
    const q = query.trim()
    if (!q) { setTickerSuggestions([]); setTickerLoading(false); return }
    setTickerLoading(true)
    setTickerSuggestions([])
    const id = setTimeout(() => {
      fetch(`/api/ticker/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d: TickerSuggestion[]) => { setTickerSuggestions(d); setTickerLoading(false) })
        .catch(() => { setTickerSuggestions([]); setTickerLoading(false) })
    }, 300)
    return () => clearTimeout(id)
  }, [query])

  const close = useCallback(() => setSearchOpen(false), [setSearchOpen])

  useEffect(() => {
    inputRef.current?.focus()
    const down = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [close])

  // ── build flat navigable items list ─────────────────────────
  const items = useMemo(() => {
    const QUICK_ACTIONS = [
      { id: 'movement', label: ts('qaNewMovement'), sub: ts('qaNewMovementSub'), icon: 'plus',      action: 'movement' as const, primary: true },
      { id: 'buy-az',   label: ts('qaBuyStock'),    sub: ts('qaBuyStockSub'),    icon: 'azioni',    action: 'buy'      as const },
      { id: 'buy-cr',   label: ts('qaBuyCrypto'),   sub: ts('qaBuyCryptoSub'),   icon: 'crypto',    action: 'buy'      as const },
      { id: 'goal',     label: ts('qaNewGoal'),      sub: ts('qaNewGoalSub'),     icon: 'obiettivi', action: 'goal'     as const },
    ]

    const SECTIONS = SECTION_META.map((s) => ({
      ...s,
      label: tn(s.navKey),
      sub: tn(s.groupKey),
    }))

    const q = query.toLowerCase().trim()

    if (!q) {
      return [
        ...QUICK_ACTIONS.map((a) => ({ kind: 'action' as const, ...a, group: ts('quickActions') })),
        ...SECTIONS.map((s) => ({ kind: 'section' as const, ...s, group: ts('sections') })),
      ]
    }

    const out: Array<{ kind: string; id: string; label: string; sub?: string; icon: string; href?: string; group: string; value?: number; pct?: number; primary?: boolean }> = []

    // Sections
    const matchSections = SECTIONS.filter(
      (s) => s.label.toLowerCase().includes(q) || s.sub.toLowerCase().includes(q)
    )
    matchSections.forEach((s) => out.push({ kind: 'section', ...s, group: ts('sections') }))

    // Positions
    const usd = eurUsd ?? 1.1
    positions.forEach((p) => {
      if (!p.ticker.toLowerCase().includes(q) && !p.name?.toLowerCase().includes(q)) return
      const qt = quotes[p.ticker]
      const rawPrice = qt?.price ?? 0
      const price = p.currency === 'USD' ? rawPrice / usd : rawPrice
      const value = price * p.quantity
      const pct = qt?.changePct ?? 0
      const typeLabel = p.type === 'stock' ? tn('azioni') : p.type === 'etf' ? tn('etf') : tn('crypto')
      out.push({
        kind: 'position',
        id: p.id,
        label: `${p.ticker} · ${p.name ?? p.ticker}`,
        sub: `${typeLabel} · ${fmt(price)} · ${fmtPct(pct)}`,
        icon: p.type === 'crypto' ? 'crypto' : p.type === 'etf' ? 'etf' : 'azioni',
        href: `/portfolio/${p.type === 'stock' ? 'stocks' : p.type}`,
        group: ts('positions'),
        value,
        pct,
      })
    })

    // Ticker suggestions — shown only after API resolves (no flicker)
    const iconFor = (t: TickerSuggestion['type']) =>
      t === 'crypto' ? 'crypto' : t === 'etf' ? 'etf' : 'azioni'

    if (tickerLoading) {
      out.push({
        kind:  'ticker-loading',
        id:    'ticker-loading',
        label: '…',
        sub:   '',
        icon:  'screener',
        href:  undefined,
        group: ts('openTickerGroup'),
      })
    } else if (tickerSuggestions.length > 0) {
      tickerSuggestions.forEach((s) => out.push({
        kind:  'ticker',
        id:    `ticker-${s.symbol}`,
        label: s.symbol,
        sub:   s.name,
        icon:  iconFor(s.type),
        href:  `/ticker/${encodeURIComponent(s.tvSymbol)}`,
        group: ts('openTickerGroup'),
      }))
    }

    // Transactions
    const matchTx = transactions
      .filter((t) => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
      .slice(0, 8)
    matchTx.forEach((t) => out.push({
      kind: 'transaction',
      id: t.id,
      label: t.description,
      sub: `${t.category} · ${t.date}`,
      icon: t.type === 'income' ? 'movimenti' : 'movimenti',
      href: '/finance/transactions',
      group: ts('movements'),
      value: t.amount,
      pct: undefined,
    }))

    return out
  }, [query, positions, transactions, quotes, eurUsd, tickerSuggestions, tickerLoading, ts, tn])

  // Group items for display
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups = useMemo((): [string, any[]][] => {
    const map = new Map<string, any[]>()
    for (const item of items) {
      if (!map.has(item.group)) map.set(item.group, [])
      map.get(item.group)!.push(item)
    }
    return Array.from(map.entries())
  }, [items])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleSelect(item: any) {
    if (item.kind === 'action') {
      openModal(item.action as 'movement' | 'buy' | 'goal')
      close()
    } else if (item.href) {
      router.push(item.href as string)
      close()
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocused((f) => Math.min(f + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocused((f) => Math.max(f - 1, 0))
    } else if (e.key === 'Enter') {
      if (items[focused]) handleSelect(items[focused])
    }
  }

  let globalIdx = 0

  return (
    <div className="ledgernest-cmd-overlay" onClick={close}>
      <div className="ledgernest-cmd-panel" onClick={(e) => e.stopPropagation()}>

        {/* Search input */}
        <div className="ledgernest-cmd-search">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            className="ledgernest-cmd-search-input"
            placeholder={ts('placeholder')}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setFocused(0) }}
            onKeyDown={onKeyDown}
          />
          {query
            ? <button onClick={() => setQuery('')} style={{ color: 'var(--text-tertiary)', display: 'flex' }}><Icon name="close" size={14} /></button>
            : <kbd style={{ fontSize: 11, color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '2px 6px', fontFamily: 'inherit' }}>esc</kbd>
          }
        </div>

        {/* Results */}
        <div ref={listRef} className="ledgernest-cmd-list">
          {items.length === 0 ? (
            <div className="ledgernest-cmd-empty">{ts('noResults')} &ldquo;{query}&rdquo;</div>
          ) : (
            groups.map(([group, groupItems]) => (
              <div key={group}>
                <div className="ledgernest-cmd-section-label">{group}</div>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(groupItems as any[]).map((item: any) => {
                  if (item.kind === 'ticker-loading') {
                    return (
                      <div key="ticker-loading" style={{ padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div style={{ height: 12, width: '30%', borderRadius: 4, background: 'var(--bg-elevated)', animation: 'ledgernest-pulse 1.4s ease-in-out infinite' }} />
                          <div style={{ height: 10, width: '55%', borderRadius: 4, background: 'var(--bg-elevated)', animation: 'ledgernest-pulse 1.4s ease-in-out infinite 0.2s' }} />
                        </div>
                      </div>
                    )
                  }

                  const li = globalIdx++
                  const isFocused = li === focused
                  const isPrimary = item.kind === 'action' && (item as { primary?: boolean }).primary

                  return (
                    <button
                      key={item.id}
                      className={`ledgernest-cmd-item${isFocused ? ' focused' : ''}${isPrimary ? ' is-primary' : ''}`}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setFocused(li)}
                    >
                      <div className={`ledgernest-cmd-item-icon${isPrimary ? ' is-primary' : ''}`}>
                        <Icon name={item.icon} size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: isPrimary ? 600 : 500, color: isPrimary ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.label}
                        </div>
                        {item.sub && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.sub}
                          </div>
                        )}
                      </div>
                      {/* Value for positions / transactions */}
                      {item.kind === 'position' && (item as { value?: number; pct?: number }).value !== undefined && (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt((item as { value?: number }).value ?? 0)}</div>
                          <div style={{ fontSize: 11, color: ((item as { pct?: number }).pct ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {fmtPct((item as { pct?: number }).pct ?? 0)}
                          </div>
                        </div>
                      )}
                      {item.kind === 'transaction' && (
                        <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {fmt((item as { value?: number }).value ?? 0)}
                        </div>
                      )}
                      <div style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        <Icon name="chevron" size={12} />
                      </div>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '8px 14px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 11, color: 'var(--text-tertiary)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={kbdStyle}>↑</kbd><kbd style={kbdStyle}>↓</kbd> {ts('navigate')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={kbdStyle}>↵</kbd> {ts('open')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={kbdStyle}>esc</kbd> {ts('close')}
          </span>
          <span style={{ marginLeft: 'auto' }}>{items.length} {ts('results')}</span>
        </div>
      </div>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  fontSize: 10, border: '1px solid var(--border-subtle)',
  borderRadius: 4, padding: '1px 5px', fontFamily: 'inherit',
  background: 'var(--bg-elevated)',
}
