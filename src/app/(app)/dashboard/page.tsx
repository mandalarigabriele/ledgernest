'use client'

import { useMemo, useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useFinanceStore } from '@/stores/financeStore'
import { usePricesStore } from '@/stores/pricesStore'
import { usePrices } from '@/hooks/usePrices'
import { fmtDate } from '@/lib/utils/format'
import { useFormatters } from '@/hooks/useFormatters'
import Donut from '@/components/charts/Donut'
import BarChart from '@/components/charts/BarChart'
import Sparkline from '@/components/charts/Sparkline'
import Heatmap from '@/components/charts/Heatmap'
import Treemap from '@/components/charts/Treemap'
import DivCalendar from '@/components/charts/DivCalendar'
import Icon from '@/components/shared/Icon'


const PALETTE     = ['#5bc8d0', '#7c6df7', '#f77c3a', '#3fb950', '#f85149', '#d29922']
const HEATMAP_ROWS = ['Stocks', 'ETF', 'Crypto']


export default function DashboardPage() {
  usePrices()
  const t = useTranslations('dashboard')
  const { fmt, fmt0, fmtCpt } = useFormatters()

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

  const cash     = totalCash()
  const netWorth = portfolioValue + cash
  const cost     = useMemo(() =>
    positions.reduce((sum, p) => {
      const avgPriceEur = p.currency === 'USD' ? p.avgPrice / eurUsd : p.avgPrice
      return sum + avgPriceEur * p.quantity
    }, 0), [positions, eurUsd])
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

  const cashflowBars = useMemo(() => {
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      months.push(d.toISOString().slice(0, 7))
    }
    return months.map((m) => ({ label: m.slice(5), income: monthlyIncome(m), expense: monthlyExpenses(m) }))
  }, [transactions]) // eslint-disable-line react-hooks/exhaustive-deps

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
        const q           = quotes[p.ticker]
        const price       = q?.priceEur ?? q?.price ?? p.avgPrice
        const avgPriceEur = p.currency === 'USD' ? p.avgPrice / eurUsd : p.avgPrice
        const value       = price * p.quantity
        const chgPct      = avgPriceEur > 0 ? ((price - avgPriceEur) / avgPriceEur) * 100 : 0
        return { ...p, price, value, chgPct }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
  [positions, quotes, eurUsd])

  /* ─── Treemap data ─── */
  const treemapData = useMemo(() =>
    sortedPositions.map((p) => ({
      label: p.ticker,
      value: p.value,
      cat: p.type,
    })),
  [sortedPositions])

  /* ─── Heatmap (real data from API) ─── */
  const [heatmapData, setHeatmapData]     = useState<number[][]>([[], [], []])
  const [heatmapMonths, setHeatmapMonths] = useState<string[]>([])

  useEffect(() => {
    if (positions.length === 0) return
    const body = { positions: positions.map((p) => ({ ticker: p.ticker, type: p.type, quantity: p.quantity, currency: p.currency })) }
    fetch('/api/portfolio/heatmap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => r.json())
      .then(({ data, months }: { data: number[][]; months: string[] }) => {
        setHeatmapData(data)
        setHeatmapMonths(months)
      })
      .catch(() => {})
  }, [positions])

  /* ─── Dividend calendar (synthetic from positions) ─── */
  const divEvents = useMemo(() => {
    const events: { week: number; day: number; ticker: string }[] = []
    positions
      .filter((p) => p.type === 'stock' || p.type === 'etf')
      .forEach((p, pi) => {
        const baseWeek = (pi * 3) % 12
        events.push({ week: baseWeek, day: pi % 5, ticker: p.ticker })
        if (baseWeek + 4 < 12) events.push({ week: baseWeek + 4, day: (pi + 1) % 5, ticker: p.ticker })
      })
    return events
  }, [positions])

  const recentTx = transactions.slice(0, 7)

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

      {/* ── Allocation ── */}
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
              <Donut data={donutData} size={160} label="" sublabel="" />
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

      {/* ── Cashflow ── */}
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
        <BarChart data={cashflowBars} paired formatValue={fmt} height={160} />
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
                  <div className="ta-r">{fmt(p.price)}</div>
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
                const cat  = budgetCategories.find((c) => c.id === tx.category || c.name === tx.category)
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
                      {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
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
          <Heatmap rows={HEATMAP_ROWS} cols={heatmapMonths} data={heatmapData} height={210} />
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
