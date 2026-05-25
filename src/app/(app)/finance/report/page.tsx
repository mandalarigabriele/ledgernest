'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useFinanceStore } from '@/stores/financeStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePricesStore } from '@/stores/pricesStore'
import { fmtEur, deltaClass } from '@/lib/utils/format'
import BarChart from '@/components/charts/BarChart'
import LineChart from '@/components/charts/LineChart'
import Donut from '@/components/charts/Donut'
import Sparkline from '@/components/charts/Sparkline'
import { BRAND_FAVICON_DOMAINS } from '@/lib/utils/csvImport'

// ── Module-level constants ────────────────────────────────────

const PALETTE = ['#7c6df7', '#5bc8d0', '#f77c3a', '#3fb950', '#f85149', '#d29922', '#58a6ff', '#e879a8']
const INVEST_CATS = new Set(['Azioni', 'ETF', 'Crypto', 'Obbligazioni', 'Materie prime', 'Investimenti'])
const PERIODS = ['1M', '3M', '6M', '1A', 'MAX'] as const

type Period = typeof PERIODS[number]

// ── Pure helpers ──────────────────────────────────────────────

function fmtMonthShort(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short' }).replace('.', '')
}

function yoyPct(curr: number, prev: number): number | null {
  if (!prev) return null
  return ((curr - prev) / prev) * 100
}

function getMerchantFavicon(name: string): string | null {
  for (const [merchant, domain] of Object.entries(BRAND_FAVICON_DOMAINS)) {
    if (name.toLowerCase().includes(merchant.toLowerCase())) {
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    }
  }
  return null
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  const d = new Date(parseInt(y), parseInt(m, 10) - 1, 1)
  return fmtMonthShort(d)
}

function periodStartDate(period: Period, allDates: string[]): string {
  if (period === 'MAX') return allDates[0] ?? '2000-01-01'
  const d = new Date()
  if (period === '1M') d.setMonth(d.getMonth() - 1)
  else if (period === '3M') d.setMonth(d.getMonth() - 3)
  else if (period === '6M') d.setMonth(d.getMonth() - 6)
  else if (period === '1A') d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

function monthsBetween(start: string, end: string): string[] {
  const result: string[] = []
  const s = new Date(start.slice(0, 7) + '-01')
  const e = new Date(end.slice(0, 7) + '-01')
  while (s <= e) {
    result.push(s.toISOString().slice(0, 7))
    s.setMonth(s.getMonth() + 1)
  }
  return result
}

// ── Sub-components ────────────────────────────────────────────

function YoYBadge({ curr, prev }: { curr: number; prev: number }) {
  const pct = yoyPct(curr, prev)
  if (pct === null) return null
  const color = pct >= 0 ? 'var(--success)' : 'var(--danger)'
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color }}>
      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}% YoY
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function ReportPage() {
  const tl = useTranslations('report')
  const { transactions } = useFinanceStore()
  const { positions } = usePortfolioStore()
  const { quotes, eurUsd } = usePricesStore()
  const [period, setPeriod] = useState<Period>('1A')

  const allDates = useMemo(() => transactions.map((t) => t.date).sort(), [transactions])
  const periodStart = useMemo(() => periodStartDate(period, allDates), [period, allDates])
  const periodEnd = new Date().toISOString().slice(0, 10)
  const periodTx = useMemo(() => transactions.filter((t) => t.date >= periodStart), [transactions, periodStart])

  // ── KPI aggregates ───────────────────────────────────────────
  const income   = useMemo(() => periodTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0), [periodTx])
  const expenses = useMemo(() => periodTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [periodTx])
  const invested = useMemo(() => periodTx.filter((t) => t.type === 'expense' && INVEST_CATS.has(t.category)).reduce((s, t) => s + t.amount, 0), [periodTx])
  const saved    = income - (expenses - invested)
  const savingsRate = income > 0 ? (saved / income) * 100 : 0

  // ── Period label ─────────────────────────────────────────────
  const periodLabelKey: Record<Period, Parameters<typeof tl>[0]> = {
    '1M': 'period1M', '3M': 'period3M', '6M': 'period6M', '1A': 'period1A', 'MAX': 'periodMAX',
  }
  const currentPeriodLabel = tl(periodLabelKey[period])

  // ── YoY comparison ───────────────────────────────────────────
  const yoyStart = useMemo(() => {
    const d = new Date(periodStart); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10)
  }, [periodStart])
  const yoyEnd = useMemo(() => {
    const d = new Date(periodEnd); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10)
  }, [periodEnd])
  const yoyTx       = useMemo(() => transactions.filter((t) => t.date >= yoyStart && t.date <= yoyEnd), [transactions, yoyStart, yoyEnd])
  const yoyIncome   = yoyTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const yoyExpenses = yoyTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const yoyInvested = yoyTx.filter((t) => t.type === 'expense' && INVEST_CATS.has(t.category)).reduce((s, t) => s + t.amount, 0)

  // ── Monthly bars ─────────────────────────────────────────────
  const months = useMemo(() => monthsBetween(periodStart, periodEnd), [periodStart, periodEnd])
  const monthlyBars = useMemo(() => months.map((m) => {
    const mtx = transactions.filter((t) => t.date.startsWith(m))
    return {
      label: monthLabel(m),
      income:   mtx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense:  mtx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      invested: mtx.filter((t) => t.type === 'expense' && INVEST_CATS.has(t.category)).reduce((s, t) => s + t.amount, 0),
    }
  }), [months, transactions])

  // ── Savings rate line ────────────────────────────────────────
  const savingsLine = useMemo(() => months.map((m) => {
    const mtx = transactions.filter((t) => t.date.startsWith(m))
    const mInc = mtx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const mExp = mtx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const mInv = mtx.filter((t) => t.type === 'expense' && INVEST_CATS.has(t.category)).reduce((s, t) => s + t.amount, 0)
    return { label: monthLabel(m), value: mInc > 0 ? ((mInc - (mExp - mInv)) / mInc) * 100 : 0 }
  }), [months, transactions])

  // ── Top merchant (last 3 months) ─────────────────────────────
  const merchantStart = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10) }, [])
  const topMerchants = useMemo(() => {
    const map: Record<string, { category: string; total: number; count: number; byMonth: number[] }> = {}
    const last3 = monthsBetween(merchantStart, periodEnd).slice(-3)
    for (const tx of transactions.filter((t) => t.type === 'expense' && t.date >= merchantStart && !INVEST_CATS.has(t.category))) {
      const key = tx.merchant ?? tx.description
      if (!map[key]) map[key] = { category: tx.category, total: 0, count: 0, byMonth: [0, 0, 0] }
      map[key].total += tx.amount
      map[key].count += 1
      const mi = last3.indexOf(tx.date.slice(0, 7))
      if (mi >= 0) map[key].byMonth[mi] += tx.amount
    }
    return Object.entries(map).sort(([, a], [, b]) => b.total - a.total).slice(0, 7).map(([name, v]) => ({ name, ...v }))
  }, [transactions, merchantStart])

  // ── Expense by category ──────────────────────────────────────
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const tx of periodTx.filter((t) => t.type === 'expense' && !INVEST_CATS.has(t.category))) {
      map[tx.category] = (map[tx.category] ?? 0) + tx.amount
    }
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map).sort(([, a], [, b]) => b - a).map(([label, value], i) => ({
      label, value, color: PALETTE[i % PALETTE.length], pct: total > 0 ? (value / total) * 100 : 0,
    }))
  }, [periodTx])

  // ── Portfolio performance ─────────────────────────────────────
  const perfRows = useMemo(() => positions.map((p) => {
    const q = quotes[p.ticker]
    const price = q?.priceEur ?? q?.price ?? p.avgPrice
    const avgPriceEur = p.currency === 'USD' ? p.avgPrice / eurUsd : p.avgPrice
    const value = price * p.quantity
    const cost  = avgPriceEur * p.quantity
    const pnl   = value - cost
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
    return { ticker: p.ticker, name: p.name, value, cost, pnl, pnlPct }
  }).filter((r) => r.cost > 0), [positions, quotes, eurUsd])

  const bestRows  = [...perfRows].sort((a, b) => b.pnlPct - a.pnlPct).slice(0, 5)
  const worstRows = [...perfRows].sort((a, b) => a.pnlPct - b.pnlPct).slice(0, 5)
  const avgBest   = bestRows.length  ? bestRows.reduce((s, r) => s + r.pnlPct, 0) / bestRows.length : 0
  const avgWorst  = worstRows.length ? worstRows.reduce((s, r) => s + r.pnlPct, 0) / worstRows.length : 0

  // ── KPI data (extracted from JSX to avoid SWC as-cast bug) ───
  const kpis = [
    { label: tl('kpiIncome'),   value: income,   prev: yoyIncome   as number | null, count: periodTx.filter((t) => t.type === 'income').length,                                               sub: tl('kpiMovements'),        color: 'var(--success)', hl: true  },
    { label: tl('kpiExpenses'), value: expenses, prev: yoyExpenses as number | null, count: periodTx.filter((t) => t.type === 'expense').length,                                              sub: tl('kpiInclRecurring'),    color: 'var(--danger)',  hl: false },
    { label: tl('kpiInvested'), value: invested, prev: yoyInvested as number | null, count: periodTx.filter((t) => t.type === 'expense' && INVEST_CATS.has(t.category)).length,               sub: tl('kpiOperations'),       color: 'var(--accent)',  hl: false },
    { label: tl('kpiSaved'),    value: saved,    prev: null        as number | null, count: null,                                                                                              sub: tl('kpiSavingsRate', { rate: savingsRate.toFixed(0) }), color: deltaClass(saved) === 'pos' ? 'var(--success)' : 'var(--danger)', hl: false },
  ]

  // ── Performance panels ────────────────────────────────────────
  const perfPanels = [
    { title: tl('perfBestTitle'),  subKey: tl('perfBestSub'),  rows: bestRows,  avg: avgBest,  positive: true  },
    { title: tl('perfWorstTitle'), subKey: tl('perfWorstSub'), rows: worstRows, avg: avgWorst, positive: false },
  ]

  // ── Chart legend ──────────────────────────────────────────────
  const chartLegend = [
    { color: 'var(--success)', label: tl('legendIncome') },
    { color: 'var(--danger)', label: tl('legendExpenses') },
    { color: 'var(--accent)', label: tl('legendInvested') },
  ]

  // ── Export CSV ───────────────────────────────────────────────
  const exportCSV = () => {
    const header = 'Data,Descrizione,Tipo,Categoria,Importo'
    const csvRows = periodTx.map((t) =>
      [t.date, `"${t.description}"`, t.type, t.category, t.amount.toFixed(2)].join(',')
    )
    const blob = new Blob([[header, ...csvRows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `report-${period.toLowerCase()}.csv`
    a.click()
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="ledgernest-gap-5">

      {/* ── Header ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>{tl('headerTitle', { period: currentPeriodLabel })}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{tl('headerSubtitle', { n: months.length })}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="ledgernest-tabs">
            {PERIODS.map((p) => (
              <button key={p} className={`ledgernest-tab${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>{p}</button>
            ))}
          </div>
          <button className="ledgernest-btn ledgernest-btn-ghost" style={{ fontSize: 12 }} onClick={exportCSV}>{tl('exportCsv')}</button>
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────────────── */}
      <div className="ledgernest-kpi-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className={kpi.hl ? 'ledgernest-kpi is-hl' : 'ledgernest-kpi'} style={{ padding: '18px 20px', gap: 5 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: kpi.hl ? undefined : kpi.color }}>
              {fmtEur(kpi.value)}
            </div>
            <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {kpi.count !== null
                ? <span style={{ fontWeight: 600, color: kpi.color }}>{kpi.count} {kpi.sub}</span>
                : <span style={{ color: 'var(--text-secondary)' }}>{kpi.sub}</span>
              }
              {kpi.prev !== null && <YoYBadge curr={kpi.value} prev={kpi.prev} />}
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts row ───────────────────────────────────────── */}
      <div className="ledgernest-grid-2">
        <div className="ledgernest-card">
          <div className="ledgernest-card-header">
            <span className="ledgernest-card-title">{tl('chartIncomeExpenses')}</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
              {chartLegend.map(({ color, label }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="ledgernest-card-body">
            <BarChart data={monthlyBars} paired formatValue={fmtEur} height={180} />
          </div>
        </div>

        <div className="ledgernest-card">
          <div className="ledgernest-card-header">
            <span className="ledgernest-card-title">{tl('chartSavingsRate')}</span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'var(--accent)', color: '#000' }}>
              {tl('chartAvg', { n: savingsRate.toFixed(0) })}
            </span>
          </div>
          <div className="ledgernest-card-body" style={{ paddingTop: 8 }}>
            {savingsLine.length > 1 ? (
              <LineChart data={savingsLine} color="var(--accent)" height={180} formatValue={(v) => `${v.toFixed(1)}%`} formatLabel={(l) => l} />
            ) : (
              <div className="ledgernest-empty">{tl('perfInsufficient')}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Top merchant + Uscite per categoria ──────────────── */}
      <div className="ledgernest-grid-2">

        {/* Top merchant */}
        <div className="ledgernest-card">
          <div className="ledgernest-card-header">
            <div>
              <span className="ledgernest-card-title">{tl('merchantTitle')}</span>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{tl('merchantSubtitle')}</div>
            </div>
          </div>
          <div className="ledgernest-table-wrap">
            <table className="ledgernest-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>{tl('merchantColMerchant')}</th>
                  <th>{tl('merchantColCategory')}</th>
                  <th className="num">{tl('merchantColOps')}</th>
                  <th className="num">{tl('merchantColTrend')}</th>
                  <th className="num">{tl('merchantColTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {topMerchants.length === 0
                  ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>{tl('merchantEmpty')}</td></tr>
                  : topMerchants.map((m) => {
                      const favicon = getMerchantFavicon(m.name)
                      return (
                        <tr key={m.name}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                {favicon
                                  ? <img src={favicon} width={18} height={18} style={{ borderRadius: 4 }} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                  : <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>{m.name.slice(0, 2).toUpperCase()}</span>
                                }
                              </div>
                              <span style={{ fontWeight: 500 }}>{m.name}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                              {m.category}
                            </span>
                          </td>
                          <td className="num" style={{ color: 'var(--text-secondary)' }}>{m.count}</td>
                          <td className="num" style={{ width: 60 }}>
                            <Sparkline data={m.byMonth} width={56} height={24} color="var(--danger)" positive={false} />
                          </td>
                          <td className="num ledgernest-mono" style={{ fontWeight: 600 }}>{fmtEur(m.total)}</td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* Expenses by category */}
        <div className="ledgernest-card">
          <div className="ledgernest-card-header">
            <div>
              <span className="ledgernest-card-title">{tl('expensesByCatTitle')}</span>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{tl('expensesByCatSubtitle', { period: currentPeriodLabel.toLowerCase() })}</div>
            </div>
          </div>
          {byCategory.length === 0 ? (
            <div className="ledgernest-card-body"><div className="ledgernest-empty">{tl('expensesByCatEmpty')}</div></div>
          ) : (
            <>
              <div className="ledgernest-card-body" style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
                <Donut
                  data={byCategory}
                  size={140}
                  label={fmtEur(byCategory.reduce((s, c) => s + c.value, 0))}
                  sublabel={tl('expensesByCatSpent')}
                />
              </div>
              <div className="ledgernest-table-wrap">
                <table className="ledgernest-table" style={{ fontSize: 12 }}>
                  <tbody>
                    {byCategory.slice(0, 8).map((c) => (
                      <tr key={c.label}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                            <span>{c.label}</span>
                          </div>
                        </td>
                        <td className="num" style={{ color: 'var(--text-tertiary)' }}>{c.pct.toFixed(0)}%</td>
                        <td className="num ledgernest-mono" style={{ fontWeight: 600 }}>{fmtEur(c.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

      </div>

      {/* ── Performance best / worst ──────────────────────────── */}
      {perfRows.length > 0 && (
        <div className="ledgernest-grid-2">
          {perfPanels.map(({ title, subKey, rows, avg, positive }) => (
            <div key={title} className="ledgernest-card">
              <div className="ledgernest-card-header">
                <div>
                  <span className="ledgernest-card-title">{title}</span>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {subKey}
                  </div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: positive ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
                  color: positive ? 'var(--success)' : 'var(--danger)',
                }}>
                  {tl('perfAvg', { avg: `${avg >= 0 ? '+' : ''}${avg.toFixed(0)}` })}
                </span>
              </div>
              <div style={{ padding: '8px 16px 16px' }}>
                {rows.map((r, i) => {
                  const maxAbs = Math.max(...rows.map((x) => Math.abs(x.pnlPct)))
                  const barPct = maxAbs > 0 ? (Math.abs(r.pnlPct) / maxAbs) * 100 : 0
                  return (
                    <div key={r.ticker} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ width: 20, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>#{i + 1}</span>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                        {r.ticker.slice(0, 2)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>{r.ticker}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtEur(r.value)}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden', marginBottom: 2 }}>
                          <div style={{ height: '100%', width: `${barPct}%`, background: positive ? 'var(--success)' : 'var(--danger)', borderRadius: 99, transition: 'width 0.4s' }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{r.name}</div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r.pnlPct >= 0 ? 'var(--success)' : 'var(--danger)', minWidth: 60, textAlign: 'right' }}>
                        {r.pnlPct >= 0 ? '+' : ''}{r.pnlPct.toFixed(2)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
