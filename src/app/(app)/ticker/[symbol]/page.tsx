'use client'

import { useMemo, useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import TradingViewWidget from '@/components/charts/TradingViewWidget'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { AddItemModal } from '@/app/(app)/portfolio/watchlist/page'

interface Props {
  params: { symbol: string }
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      color: 'var(--text-tertiary)',
      marginBottom: 8,
    }}>
      {label}
    </div>
  )
}

export default function TickerPage({ params }: Props) {
  const raw = decodeURIComponent(params.symbol).toUpperCase()
  const tl  = useTranslations('ticker')
  const tlW = useTranslations('watchlist')

  const [tvSymbol, setTvSymbol]     = useState<string | null>(null)
  const [showAddWL, setShowAddWL]   = useState(false)
  const [refPrice, setRefPrice] = useState<{ usd: number; eur: number } | undefined>()

  const { items: wlItems } = useWatchlistStore()

  // extract Yahoo Finance-compatible ticker from TV symbol
  // e.g. COINBASE:BTCUSD → BTC-USD, NASDAQ:AAPL → AAPL, MIL:NEXI → NEXI.MI
  function toYahooTicker(tvSym: string): string {
    const exchange = tvSym.split(':')[0]
    const base     = tvSym.replace(/^[^:]+:/, '')
    if (exchange === 'COINBASE' || exchange === 'BINANCE' || exchange === 'CRYPTOCAP') {
      if (base.endsWith('USDT')) return base.slice(0, -4) + '-USD'
      if (base.endsWith('USD'))  return base.slice(0, -3) + '-USD'
    }
    return base
  }
  const baseTicker = tvSymbol ? toYahooTicker(tvSymbol) : raw.replace(/^[^:]+:/, '')
  const inWatchlist = wlItems.some((i) => i.ticker === baseTicker)

  useEffect(() => {
    setTvSymbol(null)
    if (raw.includes(':')) { setTvSymbol(raw); return }
    fetch(`/api/ticker/${encodeURIComponent(raw)}`)
      .then((r) => r.json())
      .then((d: { tvSymbol: string }) => setTvSymbol(d.tvSymbol || raw))
      .catch(() => setTvSymbol(raw))
  }, [raw])

  // fetch current price for watchlist modal prefill
  useEffect(() => {
    if (!baseTicker) return
    fetch(`/api/prices?tickers=${baseTicker}`)
      .then((r) => r.json())
      .then((d: { quotes: Array<{ ticker: string; price: number; currency: string; priceEur?: number }>; eurUsd: number }) => {
        const q = d.quotes.find((q) => q.ticker === baseTicker)
        if (!q) return
        const rate     = d.eurUsd || 1.08
        const priceUsd = q.currency === 'EUR' ? q.price * rate : q.price
        const priceEur = q.priceEur ?? (q.currency === 'EUR' ? q.price : q.price / rate)
        setRefPrice({ usd: priceUsd, eur: priceEur })
      })
      .catch(() => {})
  }, [baseTicker])

  const sym = tvSymbol ?? raw   // use raw only as fallback in memos; widgets wait for tvSymbol

  const symCfg = useMemo(() => ({ symbol: sym }), [sym])

  const chartCfg = useMemo(() => ({
    symbol:              sym,
    interval:            'D',
    timezone:            'exchange',
    style:               '1',
    allow_symbol_change: false,
    hide_top_toolbar:    false,
    hide_legend:         false,
    save_image:          false,
    calendar:            false,
    support_host:        'https://www.tradingview.com',
  }), [tvSymbol])

  const profileCfg = useMemo(() => ({
    symbol:        sym,
    isTransparent: false,
  }), [tvSymbol])

  const financialsCfg = useMemo(() => ({
    symbol:        sym,
    displayMode:   'regular',
    isTransparent: false,
  }), [tvSymbol])

  const techCfg = useMemo(() => ({
    symbol:           sym,
    interval:         '1D',
    showIntervalTabs: true,
    isTransparent:    false,
  }), [tvSymbol])

  const newsCfg = useMemo(() => ({
    symbol:        sym,
    feedMode:      'symbol',
    isTransparent: false,
    displayMode:   'regular',
  }), [tvSymbol])

  if (!tvSymbol) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
        {raw}…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Watchlist button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => !inWatchlist && setShowAddWL(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8, border: 'none', cursor: inWatchlist ? 'default' : 'pointer',
            background: inWatchlist ? 'var(--bg-elevated)' : 'var(--accent)',
            color: inWatchlist ? 'var(--text-secondary)' : '#fff',
            fontSize: 13, fontWeight: 600,
          }}
        >
          {inWatchlist ? '✓' : '+'} {inWatchlist ? tlW('inWatchlist') : tlW('addToWatchlist')}
        </button>
      </div>

      <TradingViewWidget widget="symbol-info" config={symCfg} height={165} />

      <div>
        <SectionLabel label={tl('chart')} />
        <TradingViewWidget widget="advanced-chart" config={chartCfg} height={520} />
      </div>

      <div>
        <SectionLabel label={tl('companyProfile')} />
        <TradingViewWidget widget="symbol-profile" config={profileCfg} height={420} />
      </div>

      <div>
        <SectionLabel label={tl('fundamentals')} />
        <TradingViewWidget widget="financials" config={financialsCfg} height={550} />
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: '0 0 420px' }}>
          <SectionLabel label={tl('technicalAnalysis')} />
          <TradingViewWidget widget="technical-analysis" config={techCfg} height={450} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SectionLabel label={tl('news')} />
          <TradingViewWidget widget="timeline" config={newsCfg} height={450} />
        </div>
      </div>

      {showAddWL && (
        <AddItemModal
          lists={Array.from(new Set(wlItems.flatMap((i) => i.lists)))}
          onClose={() => setShowAddWL(false)}
          prefill={{
            ticker: baseTicker,
            name: baseTicker,
            currency: tvSymbol?.includes('MIL:') || tvSymbol?.includes('EURONEXT:') || tvSymbol?.includes('XETRA:') ? 'EUR'
                    : tvSymbol?.includes('LSE:') ? 'GBP'
                    : 'USD',
            refPrice,
          }}
        />
      )}
    </div>
  )
}
