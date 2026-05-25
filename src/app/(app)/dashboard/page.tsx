'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useFinanceStore } from '@/stores/financeStore'
import { usePricesStore } from '@/stores/pricesStore'
import { usePrices } from '@/hooks/usePrices'
import { fmtEur, fmtDate } from '@/lib/utils/format'
import { useFormatters } from '@/hooks/useFormatters'
import LineChart from '@/components/charts/LineChart'
import Donut from '@/components/charts/Donut'
import BarChart from '@/components/charts/BarChart'
import Sparkline from '@/components/charts/Sparkline'
import Heatmap from '@/components/charts/Heatmap'
import Treemap from '@/components/charts/Treemap'
import DivCalendar from '@/components/charts/DivCalendar'
import Icon from '@/components/shared/Icon'


const PALETTE = ['#5bc8d0', '#7c6df7', '#f77c3a', '#3fb950', '#f85149', '#d29922']
const RANGES  = ['1S', '1M', '3M', '6M', '1A', 'MAX'] as const

const HEATMAP_ROWS = ['Stocks', 'ETF', 'Crypto', 'Bonds', 'Cash']
const HEATMAP_COLS = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May']

const RANGE_CFG: Record<string, { days: number; pts: number; startPct: number; noise: number }> = {
  '1S':  { days: 7,   pts: 7,   startPct: 0.997, noise: 0.002 },
  '1M':  { days: 30,  pts: 30,  startPct: 0.985, noise: 0.004 },
  '3M':  { days: 90,  pts: 60,  startPct: 0.94,  noise: 0.007 },
  '6M':  { days: 180, pts: 90,  startPct: 0.88,  noise: 0.010 },
  '1A':  { days: 365, pts: 120, startPct: 0.78,  noise: 0.012 },
  'MAX': { days: 730, pts: 150, startPct: 0.65,  noise: 0.014 },
}

function syntheticSeries(
  currentValue: number,
  range: string,
  flat = false,
): { label: string; value: number }[] {
  const { days, pts, startPct, noise } = RANGE_CFG[range] ?? RANGE_CFG['6M']
  const stepDays = days / (pts - 1)
  const startValue = currentValue * (flat ? (0.97 + Math.random() * 0.06) : startPct)
  const step = flat ? 0 : (currentValue - startValue) / (pts - 1)
  const useShortLabel = days <= 90
  const now = new Date()
  const result = []
  let v = startValue
  for (let i = pts - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - Math.round(i * stepDays))
    const n = (Math.random() - (flat ? 0.5 : 0.42)) * currentValue * noise
    v = Math.max(currentValue * 0.05, v + step + n)
    const label = d.toLocaleDateString('en-US', useShortLabel
      ? { day: 'numeric', month: 'short' }
      : { month: 'short', year: '2-digit' })
    result.push({ label, value: v })
  }
  result[result.length - 1].value = currentValue
  return result
}

function syntheticHeatmap(): number[][] {
  const seed = [
    [+3.5, +2.1, -1.2, +4.8, -0.8, +3.1, -2.5, +5.2, +1.8, +3.4, +2.7, +1.5],
    [+3.5, +3.8, -0.7, +5.5, +2.1, +3.8, -1.8, +4.3, +2.4, +3.1, +2.3, +2.0],
    [+5.5, -4.5, +4.5, -1.2, +2.0, +0.0, +1.5, +5.5, +4.5, -3.5, +3.0, -1.5],
    [-0.8, -1.2, +0.5, -2.5, +0.4, -1.5, +0.2, -0.8, +0.4, -1.1, +0.6, -0.3],
    [-1.5, -2.5, +0.5, +4.5, +0.5, -4.8, +0.5, -1.5, +2.5, -2.5, -1.5, +2.5],
  ]
  return seed.map(row => row.map(v => Math.round((v + (Math.random() - 0.5) * 0.8) * 10) / 10))
}

export default function DashboardPage() {
  usePrices()
  const t = useTranslations('dashboard')
  const { fmt0, fmtCpt } = useFormatters()

  const [range, setRange] = useState<string>('6M')
  const [tab, setTab]     = useState<'totale' | 'inv' | 'cash' | 'spese'>('totale')

  const { positions } = usePortfolioStore()
  const { accounts, transactions, monthlyExpenses, monthlyIncome, totalCash, budgetCategories, merchantLogos } = useFinanceStore()
  const { quotes, eurUsd } = usePricesStore()

  const currentMonth = new Date().toISOString().slice(0, 7)

  /* ─── Values ─── */
  const portfolioValue = useMemo(() =>
    positions.reduce((sum, p) => {
      const q     = quotes[p.ticker]
      const price = q?.priceEur ?? q?.price ?? p.avgPrice
      return sum + price * p.quantity
    }, 0), [positions, quotes])

  const cash    = totalCash()
  const netWorth = portfolioValue + cash
  const cost    = useMemo(() =>
    positions.reduce((sum, p) => {
      const q = quotes[p.ticker]
      const avgPriceEur = p.currency === 'USD' ? p.avgPrice / eurUsd : p.avgPrice
      return sum + avgPriceEur * p.quantity
    }, 0), [positions, quotes, eurUsd])
  const pnl     = portfolioValue - cost
  const pnlPct  = cost > 0 ? (pnl / cost) * 100 : 0

  const income   = monthlyIncome(currentMonth)
  const expenses = monthlyExpenses(currentMonth)
  const savings  = income - expenses

  const dayChange = useMemo(() =>
    positions.reduce((sum, p) => {
      const q = quotes[p.ticker]
      if (!q) return sum
      return sum + (q.change * p.quantity * (q.currency === 'EUR' ? 1 : 1 / eurUsd))
    }, 0), [positions, quotes, eurUsd])

  const dayChangePct = portfolioValue > 0 ? (dayChange / (portfolioValue - dayChange + 0.001)) * 100 : 0
  const delta30d     = dayChange * 30
  const delta30dPct  = dayChangePct

  /* ─── Chart data ─── */
  const series = useMemo(() => ({
    totale: syntheticSeries(netWorth,       range),
    inv:    syntheticSeries(portfolioValue, range),
    cash:   syntheticSeries(cash  > 0 ? cash  : 1000, range, true),
    spese:  syntheticSeries(expenses > 0 ? expenses : 500, range, true),
  }), [netWorth, portfolioValue, cash, expenses, range])
  const activeData = series[tab]
  const tabValue = tab === 'totale' ? netWorth : tab === 'inv' ? portfolioValue : tab === 'cash' ? cash : expenses
  const tabDelta = activeData.length > 1 ? activeData[activeData.length - 1].value - activeData[0].value : 0
  const tabDeltaPct = activeData.length > 1 && activeData[0].value > 0 ? (tabDelta / activeData[0].value) * 100 : 0

  const cashflowBars = useMemo(() => {
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      months.push(d.toISOString().slice(0, 7))
    }
    return months.map((m) => ({ label: m.slice(5), income: monthlyIncome(m), expense: monthlyExpenses(m) }))
  }, [transactions])

  /* ─── Allocation ─── */
  const byType = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of positions) {
      const q     = quotes[p.ticker]
      const price = q?.priceEur ?? q?.price ?? p.avgPrice
      map[p.type] = (map[p.type] ?? 0) + price * p.quantity
    }
    if (cash > 0) map['Liquidità'] = (map['Liquidità'] ?? 0) + cash
    return map
  }, [positions, quotes, cash])

  const totalAlloc = Object.values(byType).reduce((s, v) => s + v, 0)
  const donutData  = Object.entries(byType).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }))

  /* ─── Positions table ─── */
  const sortedPositions = useMemo(() =>
    [...positions]
      .map((p) => {
        const q     = quotes[p.ticker]
        const price = q?.priceEur ?? q?.price ?? p.avgPrice
        const value = price * p.quantity
        const chgPct = ((price - p.avgPrice) / p.avgPrice) * 100
        return { ...p, price, value, chgPct }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
  [positions, quotes])

  /* ─── Treemap data ─── */
  const treemapData = useMemo(() =>
    sortedPositions.map((p) => ({
      label: p.ticker,
      value: p.value,
      cat: p.type,
    })),
  [sortedPositions])

  /* ─── Heatmap (synthetic) ─── */
  const heatmapData = useMemo(() => syntheticHeatmap(), [])

  /* ─── Dividend calendar (synthetic from dividends/positions) ─── */
  const divEvents = useMemo(() => {
    const events: { week: number; day: number; ticker: string }[] = []
    positions
      .filter((p) => p.type === 'stock' || p.type === 'etf')
      .forEach((p, pi) => {
        // Place a synthetic dividend event every ~8 weeks, offset by position index
        const baseWeek = (pi * 3) % 12
        events.push({ week: baseWeek, day: pi % 5, ticker: p.ticker })
        if (baseWeek + 4 < 12) events.push({ week: baseWeek + 4, day: (pi + 1) % 5, ticker: p.ticker })
      })
    return events
  }, [positions])

  const recentTx = transactions.slice(0, 7)

  function movIcon(type: string) {
    if (type === 'income') return 'arrow_up'
    if (type === 'investment') return 'azioni'
    return 'movimenti'
  }

  return (
    <div className="ledgernest-canvas">

      {/* ── KPI strip ── */}
      <section className="ledgernest-kpis">
        <div className="ledgernest-kpi is-hl">
          <div className="ledgernest-kpi-label">{t('netWorth')}</div>
          <div className="ledgernest-kpi-value">{fmt0(netWorth)}</div>
          <div className="ledgernest-kpi-foot">
            <span className={`ledgernest-kpi-delta ${dayChangePct >= 0 ? 'is-up' : ''}`}>
              {dayChangePct >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}%
            </span>
            <span className="ledgernest-kpi-sub">{t('last30Days')}</span>
          </div>
        </div>

        <div className="ledgernest-kpi">
          <div className="ledgernest-kpi-label">{t('investments')}</div>
          <div className="ledgernest-kpi-value">{fmt0(portfolioValue)}</div>
          <div className="ledgernest-kpi-foot">
            <span className={`ledgernest-kpi-delta ${pnlPct >= 0 ? 'is-up' : ''}`}>
              {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
            </span>
            <span className="ledgernest-kpi-sub">{netWorth > 0 ? ((portfolioValue / netWorth) * 100).toFixed(0) : 0}% {t('ofNetWorth')}</span>
          </div>
        </div>

        <div className="ledgernest-kpi">
          <div className="ledgernest-kpi-label">{t('cash')}</div>
          <div className="ledgernest-kpi-value">{fmt0(cash)}</div>
          <div className="ledgernest-kpi-foot">
            <span className="ledgernest-kpi-delta">{accounts.length}</span>
            <span className="ledgernest-kpi-sub">{netWorth > 0 ? ((cash / netWorth) * 100).toFixed(0) : 0}% {t('ofNetWorth')}</span>
          </div>
        </div>

        <div className="ledgernest-kpi">
          <div className="ledgernest-kpi-label">{t('savings')}</div>
          <div className="ledgernest-kpi-value">{fmt0(savings)}</div>
          <div className="ledgernest-kpi-foot">
            <span className={`ledgernest-kpi-delta ${savings >= 0 ? 'is-up' : ''}`}>
              {income > 0 ? ((savings / income) * 100).toFixed(0) : 0}% {t('ofIncome')}
            </span>
            <span className="ledgernest-kpi-sub">{t('target')} {fmt0(income * 0.3)}</span>
          </div>
        </div>

        <div className="ledgernest-kpi">
          <div className="ledgernest-kpi-label">{t('expenses')}</div>
          <div className="ledgernest-kpi-value">{fmt0(expenses)}</div>
          <div className="ledgernest-kpi-foot">
            <span className="ledgernest-kpi-delta">—</span>
          </div>
        </div>

        <div className="ledgernest-kpi">
          <div className="ledgernest-kpi-label">{t('totalPnl')}</div>
          <div className="ledgernest-kpi-value">{fmt0(pnl)}</div>
          <div className="ledgernest-kpi-foot">
            <span className={`ledgernest-kpi-delta ${pnl >= 0 ? 'is-up' : ''}`}>
              {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
            </span>
            <span className="ledgernest-kpi-sub">{t('historicalReturn')}</span>
          </div>
        </div>
      </section>

      {/* ── Patrimonio card (full width, edge-to-edge) ── */}
      <div className="ledgernest-card" style={{ padding: 0, gap: 0 }}>
        <div className="ledgernest-chart-tabrow" style={{ display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid var(--border-subtle)', padding: '0 18px' }}>
          <div className="ledgernest-chart-tabs" style={{ display: 'flex', flex: 1, overflowX: 'auto' }}>
            {(['totale', 'inv', 'cash', 'spese'] as const).map((tKey) => (
              <button key={tKey} className={`ledgernest-tab-design${tab === tKey ? ' is-active' : ''}`} onClick={() => setTab(tKey)}>
                {tKey === 'totale' ? t('tabTotal') : tKey === 'inv' ? t('tabInvestments') : tKey === 'cash' ? t('tabCash') : t('tabExpenses')}
              </button>
            ))}
          </div>
          <div className="ledgernest-seg ledgernest-seg--ghost" style={{ paddingBottom: 8 }}>
            {RANGES.map((r) => (
              <button key={r} className={`ledgernest-seg-btn${range === r ? ' is-active' : ''}`} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
        </div>

        <div className="ledgernest-bigval" style={{ padding: '14px 18px 0' }}>
          <div className="ledgernest-bigval-num">{fmtEur(tabValue)}</div>
          <div className="ledgernest-bigval-delta">
            <span className={`ledgernest-tag ${tabDelta >= 0 ? 'ledgernest-tag--up' : 'ledgernest-tag--down'}`}>
              <Icon name={tabDelta >= 0 ? 'arrow_up' : 'arrow_down'} size={12} />
              {fmt0(tabDelta)} · {tabDeltaPct >= 0 ? '+' : ''}{tabDeltaPct.toFixed(2)}%
            </span>
            <span className="ledgernest-bigval-cap">{({ '1S': t('range1S'), '1M': t('range1M'), '3M': t('range3M'), '6M': t('range6M'), '1A': t('range1A'), 'MAX': t('rangeMAX') } as Record<string,string>)[range]} · {t('updatedNow')}</span>
          </div>
        </div>

        <div style={{ padding: '4px 0 0' }}>
          <LineChart data={activeData} height={240} formatValue={fmtEur} />
        </div>
      </div>

      {/* ── Allocation + Cashflow ── */}
      <div className="ledgernest-grid ledgernest-grid--row">
        <div className="ledgernest-card">
          <div className="ledgernest-card-head">
            <div>
              <div className="ledgernest-card-title">{t('allocationTitle')}</div>
              <div className="ledgernest-card-sub">{donutData.length} · {fmt0(totalAlloc)}</div>
            </div>
          </div>
          {donutData.length === 0 ? (
            <div className="ledgernest-empty"><div className="ledgernest-empty-icon">📊</div>{t('noPositions')}</div>
          ) : (
            <div className="ledgernest-alloc">
              <div className="ledgernest-alloc-chart">
                <Donut data={donutData} size={200} label="" sublabel="" />
                <div className="ledgernest-donut-center">
                  <div className="ledgernest-donut-num">{fmtCpt(totalAlloc)}</div>
                  <div className="ledgernest-donut-cap">{t('inPortfolio')}</div>
                </div>
              </div>
              <ul className="ledgernest-alloc-legend">
                {donutData.map((d) => (
                  <li key={d.label}>
                    <span className="ledgernest-swatch" style={{ background: d.color }} />
                    <span className="ledgernest-legend-name">{d.label}</span>
                    <span className="ledgernest-legend-val">{fmt0(d.value)}</span>
                    <span className="ledgernest-legend-pct">{totalAlloc > 0 ? ((d.value / totalAlloc) * 100).toFixed(1) : 0}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="ledgernest-card">
          <div className="ledgernest-card-head">
            <div>
              <div className="ledgernest-card-title">{t('incomeVsExpenses')}</div>
              <div className="ledgernest-card-sub">{t('last6Months')}</div>
            </div>
            <div className="ledgernest-legend-row">
              <span><i style={{ background: 'var(--success)' }} /></span>
              <span><i style={{ background: 'var(--danger)' }} /></span>
            </div>
          </div>
          <BarChart data={cashflowBars} paired formatValue={fmtEur} height={200} />
        </div>
      </div>

      {/* ── Positions + Movements ── */}
      <div className="ledgernest-grid ledgernest-grid--7-5">
        <div className="ledgernest-card">
          <div className="ledgernest-card-head">
            <div>
              <div className="ledgernest-card-title">{t('yourPositions')}</div>
              <div className="ledgernest-card-sub">{positions.length} · {t('sortByValue')}</div>
            </div>
            <button className="ledgernest-btn-ghost">
              <span>{t('viewAll')}</span>
              <Icon name="chevron" size={14} />
            </button>
          </div>
          {positions.length === 0 ? (
            <div className="ledgernest-empty"><div className="ledgernest-empty-icon">📈</div>{t('noPositions')}</div>
          ) : (
            <>
              <div className="ledgernest-thead">
                <div></div>
                <div></div>
                <div className="ta-r"></div>
                <div className="ta-c">7d</div>
                <div className="ta-r"></div>
                <div className="ta-r"></div>
              </div>
              {sortedPositions.map((p) => (
                <div key={p.id} className="ledgernest-trow">
                  <div className="ledgernest-ticker">
                    <div className="ledgernest-ticker-badge">{p.ticker.slice(0, 2)}</div>
                    <div>
                      <div className="ledgernest-ticker-sym">{p.ticker}</div>
                      <div className="ledgernest-ticker-name">{p.name || p.ticker}</div>
                    </div>
                  </div>
                  <div className="ledgernest-cell-mute">{p.quantity.toLocaleString('it-IT')}</div>
                  <div className="ta-r">{fmtEur(p.price)}</div>
                  <div className="ta-c">
                    <Sparkline
                      data={Array.from({ length: 10 }, (_, i) => p.price * (1 + Math.sin(i * 0.8 + p.id.charCodeAt(0)) * 0.015))}
                      positive={p.chgPct >= 0}
                      width={80}
                      height={28}
                    />
                  </div>
                  <div className="ta-r"><b>{fmt0(p.value)}</b></div>
                  <div className="ta-r">
                    <span className={`ledgernest-pct ${p.chgPct >= 0 ? 'is-up' : 'is-down'}`}>
                      {p.chgPct >= 0 ? '+' : ''}{p.chgPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="ledgernest-card">
          <div className="ledgernest-card-head">
            <div>
              <div className="ledgernest-card-title">{t('movements')}</div>
              <div className="ledgernest-card-sub">{recentTx.length} {t('last7Days')}</div>
            </div>
          </div>
          {recentTx.length === 0 ? (
            <div className="ledgernest-empty"><div className="ledgernest-empty-icon">📋</div>{t('noMovements')}</div>
          ) : (
            <ul className="ledgernest-mov-list">
              {recentTx.map((tx) => {
                const logo = tx.merchant ? merchantLogos[tx.merchant] : undefined
                const cat = budgetCategories.find((c) => c.id === tx.category || c.name === tx.category)
                const emoji = cat?.emoji ?? (tx.type === 'income' ? '💰' : '📋')
                const color = cat?.color ?? '#8b949e'
                return (
                <li key={tx.id} className="ledgernest-mov">
                  <div className="ledgernest-mov-icon" style={{
                    background: logo ? 'var(--bg-elevated)' : `${color}22`,
                    borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 36, height: 36, flexShrink: 0, fontSize: 18, overflow: 'hidden',
                  }}>
                    {logo
                      ? <img src={logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 4 }} />
                      : emoji}
                  </div>
                  <div className="ledgernest-mov-text">
                    <div className="ledgernest-mov-merch">{tx.merchant || tx.description}</div>
                    <div className="ledgernest-mov-cat">{tx.category} · {fmtDate(tx.date)}</div>
                  </div>
                  <div className={`ledgernest-mov-amt${tx.type === 'income' ? ' is-up' : ''}`}>
                    {tx.type === 'income' ? '+' : '−'}{fmtEur(tx.amount)}
                  </div>
                </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Heatmap + Dividends calendar + Treemap ── */}
      <div className="ledgernest-grid ledgernest-grid--row ledgernest-grid--3col">
        <div className="ledgernest-card">
          <div className="ledgernest-card-head">
            <div>
              <div className="ledgernest-card-title">{t('returnsByClass')}</div>
              <div className="ledgernest-card-sub">{t('monthly12Months')}</div>
            </div>
          </div>
          <Heatmap rows={HEATMAP_ROWS} cols={HEATMAP_COLS} data={heatmapData} height={210} />
        </div>

        <div className="ledgernest-card">
          <div className="ledgernest-card-head">
            <div>
              <div className="ledgernest-card-title">{t('upcomingDividends')}</div>
              <div className="ledgernest-card-sub">{t('next12Weeks')}</div>
            </div>
          </div>
          <DivCalendar events={divEvents} height={210} />
        </div>

        <div className="ledgernest-card">
          <div className="ledgernest-card-head">
            <div>
              <div className="ledgernest-card-title">{t('positionsWeight')}</div>
              <div className="ledgernest-card-sub">Treemap · top {treemapData.length}</div>
            </div>
          </div>
          {treemapData.length === 0 ? (
            <div className="ledgernest-empty"><div className="ledgernest-empty-icon">🗺️</div>{t('noPositions')}</div>
          ) : (
            <Treemap data={treemapData} height={210} />
          )}
        </div>
      </div>

    </div>
  )
}
