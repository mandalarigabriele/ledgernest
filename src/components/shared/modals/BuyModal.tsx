'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useUIStore } from '@/stores/uiStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useFinanceStore } from '@/stores/financeStore'
import { usePricesStore } from '@/stores/pricesStore'
import { usePrices } from '@/hooks/usePrices'
import type { AssetType } from '@/types'
import Icon from '../Icon'

const ACC_TICKERS = new Set(['VWCE', 'IWDA', 'CSPX', 'EUNL', 'SWRD', 'IUSQ', 'SPYL', 'LCUW'])

function quoteTypeToAsset(qt: string): AssetType {
  const map: Record<string, AssetType> = {
    EQUITY: 'stock', ETF: 'etf', CRYPTOCURRENCY: 'crypto',
    BOND: 'bond', MUTUALFUND: 'etf', FUTURE: 'commodity',
  }
  return map[qt] ?? 'stock'
}

interface Suggestion {
  ticker: string
  name: string
  quoteType: string
  exchange: string
  supported?: boolean  // true = priced via CoinGecko
}

export default function BuyModal() {
  const t = useTranslations('modals')
  const tc = useTranslations('common')
  const tn = useTranslations('nav')
  const { closeModal, modalProps } = useUIStore()
  const { addPosition, addTrade, positions } = usePortfolioStore()
  const { accounts } = useFinanceStore()
  const { getPriceEur } = usePricesStore()
  const { refetch } = usePrices()

  const ASSET_TYPE_META: Record<AssetType, { label: string; icon: string }> = {
    stock:     { label: t('stockLabel'),   icon: 'azioni' },
    etf:       { label: tn('etf'),         icon: 'etf'    },
    crypto:    { label: tn('crypto'),      icon: 'crypto' },
    bond:      { label: t('bond'),         icon: 'report' },
    commodity: { label: t('commodity'),    icon: 'globe'  },
  }

  const initialType = (modalProps.assetType as AssetType | undefined) ?? 'stock'
  const [assetType, setAssetType] = useState<AssetType>(initialType)
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [sector, setSector] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [commission, setCommission] = useState('')
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSugg, setShowSugg] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const [infoState, setInfoState] = useState<'idle' | 'loading' | 'done'>('idle')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const brokerAccounts = accounts
  const selectedAccount = accounts.find((a) => a.id === accountId)

  // Close suggestions on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSugg(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const fetchSuggestions = useCallback((q: string, type: AssetType) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 1) { setSuggestions([]); setShowSugg(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ticker-search?q=${encodeURIComponent(q)}&type=${type}`)
        const data: Suggestion[] = await res.json()
        setSuggestions(data)
        setShowSugg(data.length > 0)
        setHighlightIdx(-1)
      } catch { /* ignore */ }
    }, 280)
  }, [])

  async function selectSuggestion(s: Suggestion) {
    setTicker(s.ticker)
    setName(s.name)
    setShowSugg(false)
    setSuggestions([])
    // deduce asset type from Yahoo Finance quoteType
    setAssetType(quoteTypeToAsset(s.quoteType))

    // auto-fill price from store cache
    const cached = getPriceEur(s.ticker)
    if (cached && !price) setPrice(cached.toFixed(2))

    // fetch sector + live price
    setInfoState('loading')
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await fetch(`/api/ticker-info?ticker=${encodeURIComponent(s.ticker)}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error()
      const data = await res.json() as { sector?: string; name?: string }
      if (!ctrl.signal.aborted) {
        if (data.sector) setSector(data.sector)
        if (data.name && !name) setName(data.name)
        setInfoState('done')
      }
    } catch { if (!ctrl.signal.aborted) setInfoState('idle') }
  }

  function onTickerKeyDown(e: React.KeyboardEvent) {
    if (!showSugg) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, -1)) }
    if (e.key === 'Enter' && highlightIdx >= 0) { e.preventDefault(); selectSuggestion(suggestions[highlightIdx]) }
    if (e.key === 'Escape') setShowSugg(false)
  }

  async function onTickerBlur() {
    // small delay so click on suggestion fires first
    await new Promise((r) => setTimeout(r, 150))
    setShowSugg(false)
    if (!ticker) return
    const cached = getPriceEur(ticker)
    if (cached && !price) setPrice(cached.toFixed(2))
    if (infoState === 'idle' && name === '') {
      setInfoState('loading')
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const res = await fetch(`/api/ticker-info?ticker=${encodeURIComponent(ticker)}`, { signal: ctrl.signal })
        if (!res.ok) throw new Error()
        const data = await res.json() as { name?: string; sector?: string }
        if (!ctrl.signal.aborted) {
          if (data.name) setName(data.name)
          if (data.sector) setSector(data.sector)
          setInfoState('done')
        }
      } catch { if (!ctrl.signal.aborted) setInfoState('idle') }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ticker || !quantity || !price || !accountId) return

    const sym = ticker.toUpperCase()
    const qty = parseFloat(quantity)
    const p = parseFloat(price)
    const comm = parseFloat(commission) || 0
    const acct = accounts.find((a) => a.id === accountId)
    const existing = positions.find((pos) => pos.ticker === sym && pos.type === assetType)

    if (!existing) {
      // Create position with qty=0 so addTrade sets the correct quantity (avoids doubling)
      addPosition({
        ticker: sym, name: name || sym, type: assetType,
        quantity: 0, avgPrice: 0,
        currency: acct?.currency ?? 'EUR',
        broker: acct?.name ?? '',
        sector: sector || undefined,
      })
    }

    // For new positions, read positionId from store after addPosition
    const positionId = existing?.id
      ?? usePortfolioStore.getState().positions.find(
          (pos) => pos.ticker === sym && pos.type === assetType
        )?.id
      ?? ''

    addTrade({
      positionId,
      ticker: sym, type: 'buy', quantity: qty, price: p,
      commission: comm, date, currency: acct?.currency ?? 'EUR',
    })

    closeModal()

    // Auto-refresh prices so the new position shows current market data
    refetch()

    // Auto-import dividend history for stocks/distributing ETFs, filtered by purchase date
    const isAcc = assetType === 'etf' && (
      ACC_TICKERS.has(sym) || name.toLowerCase().includes(' acc')
    )
    if ((assetType === 'stock' || assetType === 'etf') && !isAcc && positionId) {
      const purchaseDate = date
      void (async () => {
        try {
          const res = await fetch(`/api/dividends-history?ticker=${encodeURIComponent(sym)}`)
          if (!res.ok) return
          const data = await res.json() as {
            dividends: { exDate: string; payDate: string; amount: number; currency: string }[]
          }
          const store = usePortfolioStore.getState()
          for (const d of data.dividends) {
            // Only import dividends paid after the purchase date
            if (d.exDate >= purchaseDate) {
              store.importDividend({
                ticker: sym,
                positionId,
                amount: Math.round(d.amount * qty * 100) / 100,
                payDate: d.payDate,
                exDate: d.exDate,
                currency: d.currency as 'EUR' | 'USD',
              })
            }
          }
        } catch { /* ignore */ }
      })()
    }
  }

  const qty = parseFloat(quantity) || 0
  const prc = parseFloat(price) || 0
  const comm = parseFloat(commission) || 0
  const total = qty * prc
  const canSubmit = !!ticker && !!quantity && !!price && !!accountId

  return (
    <div className="ledgernest-modal-overlay">
      <div className="ledgernest-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>

        {/* Header */}
        <div className="ledgernest-modal-header">
          <div>
            <div className="ledgernest-modal-title">{t('buyTitle')}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {t('buySub')}
            </div>
          </div>
          <button className="ledgernest-modal-close" onClick={closeModal}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ledgernest-modal-body" style={{ gap: '20px' }}>

            {/* Asset type — deduced from context / ticker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                padding: '6px 12px', borderRadius: 'var(--radius-md)',
                background: 'var(--accent)', color: '#fff',
                fontSize: '13px', fontWeight: 600,
              }}>
                <Icon name={ASSET_TYPE_META[assetType].icon} size={14} />
                {ASSET_TYPE_META[assetType].label}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {t('assetAutoDetected')}
              </span>
            </div>

            {/* Account — required */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">
                {tc('account')} <span style={{ color: 'var(--danger,#f85149)' }}>*</span>
              </label>
              {brokerAccounts.length === 0 ? (
                <div style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px',
                  background: 'color-mix(in oklch, var(--danger,#f85149) 10%, transparent)',
                  color: 'var(--danger,#f85149)',
                }}>
                  {t('accountRequired')}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {brokerAccounts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAccountId(a.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 14px', borderRadius: 'var(--radius-md)',
                        border: '1.5px solid',
                        borderColor: accountId === a.id ? 'var(--accent)' : 'var(--border-subtle)',
                        background: accountId === a.id ? 'var(--accent)' : 'transparent',
                        color: accountId === a.id ? '#fff' : 'var(--text-secondary)',
                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        transition: 'all .15s',
                      }}
                    >
                      <Icon name="azioni" size={13} />
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ticker with autocomplete */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">
                {t('ticker')} <span style={{ color: 'var(--danger,#f85149)' }}>*</span>
                {infoState === 'loading' && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>{t('tickerSearching')}</span>}
                {infoState === 'done' && name && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--success,#3fb950)' }}>✓ {name}{sector ? ` · ${sector}` : ''}</span>}
              </label>
              <div ref={wrapRef} style={{ position: 'relative' }}>
                <input
                  className="ledgernest-input ledgernest-mono"
                  type="text"
                  placeholder={
                    assetType === 'crypto'    ? 'Es. BTC, ETH, SOL, AVAX…' :
                    assetType === 'etf'       ? 'Es. VWCE, IWDA, CSPX, SWRD…' :
                    assetType === 'bond'      ? 'Es. BTP, T-NOTE, BUND…' :
                    assetType === 'commodity' ? 'Es. GC=F, CL=F, SI=F…' :
                                               'Es. AAPL, ENI.MI, MSFT, NVDA…'
                  }
                  value={ticker}
                  autoComplete="off"
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase()
                    setTicker(v)
                    setInfoState('idle')
                    setName('')
                    setSector('')
                    fetchSuggestions(v, assetType)
                  }}
                  onBlur={onTickerBlur}
                  onKeyDown={onTickerKeyDown}
                  onFocus={() => { if (suggestions.length) setShowSugg(true) }}
                  required
                  style={{ fontSize: '15px', height: '44px' }}
                />

                {/* Dropdown suggestions */}
                {showSugg && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,.4)',
                  }}>
                    {suggestions.map((s, i) => (
                      <div
                        key={s.ticker}
                        onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s) }}
                        onMouseEnter={() => setHighlightIdx(i)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 16px', cursor: 'pointer',
                          background: i === highlightIdx ? 'color-mix(in oklch, var(--accent) 8%, transparent)' : 'transparent',
                          borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent)', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.04em', flexShrink: 0 }}>
                          {s.ticker}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </span>
                        {s.exchange && (
                          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', flexShrink: 0, letterSpacing: '0.02em' }}>
                            {s.exchange}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Purchase date */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">
                {t('purchaseDate')} <span style={{ color: 'var(--danger,#f85149)' }}>*</span>
              </label>
              <input
                className="ledgernest-input ledgernest-mono"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                style={{ height: '44px', fontSize: '15px' }}
              />
            </div>

            {/* Quantity + Price */}
            <div className="ledgernest-modal-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="ledgernest-field">
                <label className="ledgernest-label">{t('quantityLabel')} *</label>
                <input
                  className="ledgernest-input"
                  type="number" step="any" min="0" placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required style={{ height: '44px', fontSize: '15px' }}
                />
              </div>
              <div className="ledgernest-field">
                <label className="ledgernest-label">
                  {t('unitPrice')} ({selectedAccount?.currency === 'USD' ? '$' : '€'}) *
                </label>
                <input
                  className="ledgernest-input ledgernest-mono"
                  type="number" step="0.001" min="0"
                  placeholder={selectedAccount?.currency === 'USD' ? '$ 0,00' : '€ 0,00'}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required style={{ height: '44px', fontSize: '15px' }}
                />
              </div>
            </div>

            {/* Commissions */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('commissions')} ({selectedAccount?.currency === 'USD' ? '$' : '€'})</label>
              <input
                className="ledgernest-input ledgernest-mono"
                type="number" step="0.01" min="0" placeholder="0,00"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                style={{ height: '44px' }}
              />
            </div>

            {/* Summary strip */}
            <div className="ledgernest-modal-summary" style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              padding: '14px 18px', gap: '8px',
              background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
              fontSize: '13px',
            }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('summaryTotal')}</div>
                <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {selectedAccount?.currency === 'USD' ? '$' : '€'}{total.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('summaryCommission')}</div>
                <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {selectedAccount?.currency === 'USD' ? '$' : '€'}{comm.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('summaryOrderType')}</div>
                <div style={{ color: 'var(--accent)', fontWeight: 600 }}>{t('marketOrder')}</div>
              </div>
            </div>
          </div>

          <div className="ledgernest-modal-footer">
            <button type="button" className="ledgernest-btn ledgernest-btn-ghost" onClick={closeModal}>
              {tc('cancel')}
            </button>
            <button
              type="submit"
              className="ledgernest-btn ledgernest-btn-primary"
              disabled={!canSubmit}
              style={{ opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed', minWidth: '140px' }}
            >
              {t('buyBtn')} · {selectedAccount?.currency === 'USD' ? '$' : '€'}{(total + comm).toFixed(2)}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
