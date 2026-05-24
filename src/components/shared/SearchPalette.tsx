'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/stores/uiStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useFinanceStore } from '@/stores/financeStore'
import { usePricesStore } from '@/stores/pricesStore'
import { fmtEur } from '@/lib/utils/format'
import Icon from './Icon'

// ── static data ───────────────────────────────────────────────

const QUICK_ACTIONS = [
  { id: 'movement', label: 'Nuovo movimento', sub: 'Entrata o uscita',  icon: 'plus',        action: 'movement' as const, primary: true },
  { id: 'buy-az',   label: 'Acquista azione', sub: 'Aggiungi posizione', icon: 'azioni',      action: 'buy'      as const },
  { id: 'buy-cr',   label: 'Acquista crypto', sub: 'BTC, ETH, …',       icon: 'crypto',      action: 'buy'      as const },
  { id: 'goal',     label: 'Nuovo obiettivo', sub: 'Risparmio',          icon: 'obiettivi',   action: 'goal'     as const },
]

const SECTIONS = [
  { id: 'dashboard',  label: 'Dashboard',    sub: 'Portfolio', icon: 'dashboard',    href: '/dashboard' },
  { id: 'azioni',     label: 'Azioni',       sub: 'Portfolio', icon: 'azioni',       href: '/portfolio/azioni' },
  { id: 'dividendi',  label: 'Dividendi',    sub: 'Portfolio', icon: 'dividendi',    href: '/portfolio/dividendi' },
  { id: 'crypto',     label: 'Crypto',       sub: 'Portfolio', icon: 'crypto',       href: '/portfolio/crypto' },
  { id: 'etf',        label: 'ETF',          sub: 'Portfolio', icon: 'etf',          href: '/portfolio/etf' },
  { id: 'screener',   label: 'Screener',     sub: 'Analisi',   icon: 'screener',     href: '/portfolio/screener' },
  { id: 'heatmap',    label: 'Heatmap',      sub: 'Analisi',   icon: 'heatmap',      href: '/portfolio/heatmap' },
  { id: 'conti',      label: 'Conti',        sub: 'Finanze',   icon: 'conti',        href: '/finance/conti' },
  { id: 'movimenti',  label: 'Movimenti',    sub: 'Finanze',   icon: 'movimenti',    href: '/finance/movimenti' },
  { id: 'budget',     label: 'Budget',       sub: 'Finanze',   icon: 'budget',       href: '/finance/budget' },
  { id: 'obiettivi',  label: 'Obiettivi',    sub: 'Finanze',   icon: 'obiettivi',    href: '/finance/obiettivi' },
  { id: 'ricorrenti', label: 'Ricorrenti',   sub: 'Finanze',   icon: 'ricorrenti',   href: '/finance/ricorrenti' },
  { id: 'patrimonio', label: 'Patrimonio',   sub: 'Finanze',   icon: 'patrimonio',   href: '/finance/patrimonio' },
  { id: 'report',     label: 'Report',       sub: 'Finanze',   icon: 'report',       href: '/finance/report' },
  { id: 'settings',   label: 'Impostazioni', sub: 'Sistema',   icon: 'impostazioni', href: '/impostazioni' },
]

// ── helpers ───────────────────────────────────────────────────

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

// ── component ─────────────────────────────────────────────────

export default function SearchPalette() {
  const router = useRouter()
  const { setSearchOpen, openModal } = useUIStore()
  const { positions } = usePortfolioStore()
  const { transactions } = useFinanceStore()
  const { quotes, eurUsd } = usePricesStore()

  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setSearchOpen(false), [setSearchOpen])

  useEffect(() => {
    inputRef.current?.focus()
    const down = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [close])

  // ── build flat navigable items list ─────────────────────────
  const items = useMemo(() => {
    const q = query.toLowerCase().trim()

    if (!q) {
      // Default: quick actions + all sections
      return [
        ...QUICK_ACTIONS.map((a) => ({ kind: 'action' as const, ...a, group: 'Azioni rapide' })),
        ...SECTIONS.map((s) => ({ kind: 'section' as const, ...s, group: 'Sezioni' })),
      ]
    }

    const out: Array<{ kind: string; id: string; label: string; sub?: string; icon: string; href?: string; group: string; value?: number; pct?: number; primary?: boolean }> = []

    // Sections
    const matchSections = SECTIONS.filter(
      (s) => s.label.toLowerCase().includes(q) || s.sub.toLowerCase().includes(q)
    )
    matchSections.forEach((s) => out.push({ kind: 'section', ...s, group: 'Sezioni' }))

    // Positions
    const usd = eurUsd ?? 1.1
    positions.forEach((p) => {
      if (!p.ticker.toLowerCase().includes(q) && !p.name?.toLowerCase().includes(q)) return
      const qt = quotes[p.ticker]
      const rawPrice = qt?.price ?? 0
      const price = p.currency === 'USD' ? rawPrice / usd : rawPrice
      const value = price * p.quantity
      const pct = qt?.changePct ?? 0
      const typeLabel = p.type === 'stock' ? 'Azione' : p.type === 'etf' ? 'ETF' : 'Crypto'
      out.push({
        kind: 'position',
        id: p.id,
        label: `${p.ticker} · ${p.name ?? p.ticker}`,
        sub: `${typeLabel} · ${fmtEur(price)} · ${fmtPct(pct)}`,
        icon: p.type === 'crypto' ? 'crypto' : p.type === 'etf' ? 'etf' : 'azioni',
        href: `/portfolio/${p.type === 'stock' ? 'azioni' : p.type}`,
        group: 'Posizioni',
        value,
        pct,
      })
    })

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
      href: '/finance/movimenti',
      group: 'Movimenti',
      value: t.amount,
      pct: undefined,
    }))

    return out
  }, [query, positions, transactions, quotes, eurUsd])

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
            placeholder="Cerca: posizioni, movimenti, sezioni…"
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
            <div className="ledgernest-cmd-empty">Nessun risultato per &ldquo;{query}&rdquo;</div>
          ) : (
            groups.map(([group, groupItems]) => (
              <div key={group}>
                <div className="ledgernest-cmd-section-label">{group}</div>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(groupItems as any[]).map((item: any) => {
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
                          <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtEur((item as { value?: number }).value ?? 0)}</div>
                          <div style={{ fontSize: 11, color: ((item as { pct?: number }).pct ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {fmtPct((item as { pct?: number }).pct ?? 0)}
                          </div>
                        </div>
                      )}
                      {item.kind === 'transaction' && (
                        <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {fmtEur((item as { value?: number }).value ?? 0)}
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
            <kbd style={kbdStyle}>↑</kbd><kbd style={kbdStyle}>↓</kbd> Naviga
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={kbdStyle}>↵</kbd> Apri
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={kbdStyle}>esc</kbd> Chiudi
          </span>
          <span style={{ marginLeft: 'auto' }}>{items.length} risultati</span>
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
