'use client'

import { useMemo, useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePortfolioSnapshotStore } from '@/stores/portfolioSnapshotStore'
import { useFinanceStore } from '@/stores/financeStore'
import { usePricesStore } from '@/stores/pricesStore'
import { usePrices } from '@/hooks/usePrices'
import { useSettingsStore } from '@/stores/settingsStore'
import { effectivePriceEur } from '@/lib/utils/price'
import { fmtDate } from '@/lib/utils/format'
import { useFormatters } from '@/hooks/useFormatters'
import Donut from '@/components/charts/Donut'
import type { DivEvent } from '@/components/charts/DivCalendar'
import BarChart from '@/components/charts/BarChart'
import Sparkline from '@/components/charts/Sparkline'
import Heatmap from '@/components/charts/Heatmap'
import Treemap from '@/components/charts/Treemap'
import DivCalendar from '@/components/charts/DivCalendar'
import PortfolioPerformanceChart from '@/components/charts/PortfolioPerformanceChart'
import Icon from '@/components/shared/Icon'


const PALETTE     = ['#5bc8d0', '#7c6df7', '#f77c3a', '#3fb950', '#f85149', '#d29922']
const HEATMAP_ROWS = ['Stocks', 'ETF', 'Crypto']


export default function DashboardPage() {
  usePrices()
  const t  = useTranslations('dashboard')
  const tn = useTranslations('nav')
  const { fmt, fmt0, fmtCpt, fmtDlt } = useFormatters()

  const { positions } = usePortfolioStore()
  const { snapshots } = usePortfolioSnapshotStore()
  const { accounts, transactions, monthlyExpenses, monthlyIncome, totalCash, budgetCategories, merchantLogos, budgetPlans } = useFinanceStore()
  const { quotes, eurUsd } = usePricesStore()
  const showPrePostMarket  = useSettingsStore((s) => s.settings.showPrePostMarket)
  const targetAllocation   = useSettingsStore((s) => s.settings.targetAllocation ?? {})
  const updateSettings     = useSettingsStore((s) => s.updateSettings)
  const [excludeCash,    setExcludeCash]    = useState(false)
  const [allocView,      setAllocView]      = useState<'actual' | 'target'>('actual')
  const [editingTarget,  setEditingTarget]  = useState(false)
  const [targetDraft,    setTargetDraft]    = useState<Record<string, number>>({})

  const currentMonth = new Date().toISOString().slice(0, 7)

  /* ─── Values ─── */
  const portfolioValue = useMemo(() =>
    positions.reduce((sum, p) => {
      const q = quotes[p.ticker]
      return sum + effectivePriceEur(q, p.avgPrice, showPrePostMarket) * p.quantity
    }, 0), [positions, quotes, showPrePostMarket])

  const cash     = totalCash()
  const netWorth = portfolioValue + cash
  const cost     = useMemo(() =>
    positions.reduce((sum, p) => {
      const avgPriceEur = p.currency === 'USD' ? p.avgPrice / eurUsd : p.avgPrice
      return sum + avgPriceEur * p.quantity
    }, 0), [positions, eurUsd])
  const pnl     = portfolioValue - cost
  const pnlPct  = cost > 0 ? (pnl / cost) * 100 : 0

  const income      = monthlyIncome(currentMonth)
  const expenses    = monthlyExpenses(currentMonth)
  const savings     = income - expenses
  // Use budget planned income as denominator when actual income hasn't arrived yet
  const budgetIncome = budgetPlans[currentMonth]?.income ?? 0
  const refIncome    = budgetIncome > income ? budgetIncome : income
  const savingsRate  = refIncome > 0 ? (savings / refIncome) * 100 : 0

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
    return months.map((m) => {
      const plannedIncome = budgetPlans[m]?.income
      const actualIncome  = monthlyIncome(m)
      return {
        label: m.slice(5),
        income: actualIncome,
        expense: monthlyExpenses(m),
        // show ghost bar only when budget is set and actual < expected
        budgetIncome: plannedIncome != null && plannedIncome > actualIncome ? plannedIncome : undefined,
      }
    })
  }, [transactions, budgetPlans]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Allocation ─── */
  const TYPE_LABEL: Record<string, string> = {
    stock:     tn('azioni'),
    etf:       'ETF',
    crypto:    'Crypto',
    commodity: tn('commodity'),
    bond:      'Bond',
  }

  const TARGET_CATEGORIES = [
    { label: tn('azioni'),    color: '#5bc8d0' },
    { label: 'ETF',           color: '#7c6df7' },
    { label: 'Crypto',        color: '#f77c3a' },
    { label: tn('commodity'), color: '#3fb950' },
  ]

  const byType = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of positions) {
      const q     = quotes[p.ticker]
      const label = p.monetary ? t('cash') : (TYPE_LABEL[p.type] ?? p.type)
      map[label] = (map[label] ?? 0) + effectivePriceEur(q, p.avgPrice, showPrePostMarket) * p.quantity
    }
    if (cash > 0) map[t('cash')] = (map[t('cash')] ?? 0) + cash
    return map
  }, [positions, quotes, cash]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalAlloc = Object.values(byType).reduce((s, v) => s + v, 0)
  const donutData  = Object.entries(byType).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }))

  const cashLabel      = t('cash')
  const donutFiltered  = excludeCash ? donutData.filter(d => d.label !== cashLabel) : donutData
  const totalFiltered  = donutFiltered.reduce((s, d) => s + d.value, 0)

  /* ─── Positions table ─── */
  const sortedPositions = useMemo(() =>
    [...positions]
      .map((p) => {
        const q           = quotes[p.ticker]
        const ep          = effectivePriceEur(q, p.avgPrice, showPrePostMarket)
        const avgPriceEur = p.currency === 'USD' ? p.avgPrice / eurUsd : p.avgPrice
        const value       = ep * p.quantity
        const chgPct      = avgPriceEur > 0 ? ((ep - avgPriceEur) / avgPriceEur) * 100 : 0
        return { ...p, price: ep, value, chgPct }
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

  /* ─── Heatmap — intra-month % per asset class ─── */
  // Current month  → live unrealized P&L % from positions + quotes (no snapshot needed)
  // Past months    → (last_snapshot / first_snapshot - 1) per class; 0 if no data yet
  const { heatmapData, heatmapMonths } = useMemo(() => {
    const IT_M = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
    const now  = new Date()
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const keys: string[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    // First and last snapshot per calendar month
    type Snap = typeof snapshots[0]
    const firstByMonth: Record<string, Snap> = {}
    const lastByMonth:  Record<string, Snap> = {}
    for (const snap of snapshots) {
      const ym = new Date(snap.ts).toISOString().slice(0, 7)
      if (!firstByMonth[ym] || snap.ts < firstByMonth[ym].ts) firstByMonth[ym] = snap
      if (!lastByMonth[ym]  || snap.ts > lastByMonth[ym].ts)  lastByMonth[ym]  = snap
    }

    // Live unrealized P&L % for the current month (works even with 0 historical snapshots)
    function liveReturn(type: string): number {
      let cur = 0, cost = 0
      for (const p of positions) {
        if (p.type !== type) continue
        const q          = quotes[p.ticker]
        const closePriceEur = q?.priceEur ?? (q?.price != null ? (p.currency === 'USD' ? q.price / eurUsd : q.price) : (p.currency === 'USD' ? p.avgPrice / eurUsd : p.avgPrice))
        const ep = showPrePostMarket ? (q?.preMarketEur ?? q?.postMarketEur ?? closePriceEur) : closePriceEur
        const avgPriceEur = p.currency === 'USD' ? p.avgPrice / eurUsd : p.avgPrice
        cur  += ep * p.quantity
        cost += avgPriceEur * p.quantity
      }
      return cost > 0 ? +((cur / cost - 1) * 100).toFixed(1) : 0
    }

    const stockR: number[]  = []
    const etfR:   number[]  = []
    const cryptoR: number[] = []
    const months: string[]  = []

    for (const ym of keys) {
      const [, m] = ym.split('-').map(Number)
      months.push(IT_M[m - 1])

      if (ym === currentYM) {
        stockR.push(liveReturn('stock'))
        etfR.push(liveReturn('etf'))
        cryptoR.push(liveReturn('crypto'))
        continue
      }

      const first = firstByMonth[ym]
      const last  = lastByMonth[ym]
      if (first && last && first.ts !== last.ts && (first.stocks ?? 0) > 0) {
        stockR.push( +((last.stocks  / first.stocks  - 1) * 100).toFixed(1))
        etfR.push(   first.etf    > 0 ? +((last.etf    / first.etf    - 1) * 100).toFixed(1) : 0)
        cryptoR.push(first.crypto > 0 ? +((last.crypto / first.crypto - 1) * 100).toFixed(1) : 0)
      } else {
        stockR.push(0); etfR.push(0); cryptoR.push(0)
      }
    }

    return { heatmapData: [stockR, etfR, cryptoR], heatmapMonths: months }
  }, [snapshots, positions, quotes, eurUsd])

  /* ─── Sparklines — real 10-day closes per ticker ─── */
  const [sparkData, setSparkData] = useState<Record<string, number[]>>({})
  const [showAllPositions, setShowAllPositions] = useState(false)
  const POSITIONS_PREVIEW = 5

  useEffect(() => {
    if (positions.length === 0) return
    const tickers = positions.map((p) => p.ticker).join(',')
    fetch(`/api/sparklines?tickers=${encodeURIComponent(tickers)}`)
      .then((r) => r.json())
      .then((data: Record<string, number[]>) => setSparkData(data))
      .catch(() => {})
  }, [positions.map((p) => p.ticker).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Dividend calendar — predicted upcoming ex-div dates ─── */
  const [divEvents, setDivEvents] = useState<DivEvent[]>([])

  useEffect(() => {
    const divTickers = positions
      .filter((p) => p.type === 'stock' || p.type === 'etf')
      .map((p) => p.ticker)
    if (divTickers.length === 0) { setDivEvents([]); return }
    fetch(`/api/dividends?tickers=${encodeURIComponent(divTickers.join(','))}`)
      .then((r) => r.json())
      .then(({ events }: { events: DivEvent[] }) => setDivEvents(events))
      .catch(() => {})
  }, [positions.filter((p) => p.type === 'stock' || p.type === 'etf').map((p) => p.ticker).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

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
              {fmtDlt(pnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
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
              {refIncome > 0 ? savingsRate.toFixed(0) : '0'}% {t('ofIncome')}
            </span>
            {budgetIncome > income ? (
              <span className="ledgernest-kpi-sub">{fmt0(income)} / {fmt0(budgetIncome)} incassati</span>
            ) : (
              <span className="ledgernest-kpi-sub">{t('target')} {fmt0(refIncome * 0.3)}</span>
            )}
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

      {/* ── Performance + Allocation side by side ── */}
      <div className="ledgernest-grid ledgernest-grid--7-5">
        <div className="ledgernest-card">
          <PortfolioPerformanceChart />
        </div>

        <div className="ledgernest-card" style={{ padding: '20px' }}>
          {/* ── Header row 1: title + tab switch ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t('allocationTitle')}</div>
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 8, padding: 2 }}>
              {(['actual', 'target'] as const).map((v) => (
                <button key={v} type="button"
                  onClick={() => { setAllocView(v); setEditingTarget(false) }}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: allocView === v ? 'var(--accent)' : 'transparent',
                    color: allocView === v ? '#fff' : 'var(--text-secondary)',
                    fontWeight: allocView === v ? 700 : 400, transition: 'all .15s',
                  }}
                >{v === 'actual' ? 'Attuale' : 'vs Target'}</button>
              ))}
            </div>
          </div>
          {/* ── Header row 2: subtitle + controls ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{donutFiltered.length} asset · {fmt0(totalFiltered)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {allocView === 'target' && !editingTarget && (
                <button type="button" onClick={() => {
                  setTargetDraft({ ...targetAllocation })
                  setEditingTarget(true)
                }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, padding: '2px 4px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="edit" size={13} /> <span style={{ fontSize: 11 }}>Modifica target</span>
                </button>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Senza liquidità</span>
                <span onClick={() => setExcludeCash(v => !v)} style={{ display: 'inline-block', width: 28, height: 16, borderRadius: 8, background: excludeCash ? 'var(--accent)' : 'var(--border)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 2, left: excludeCash ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </span>
              </label>
            </div>
          </div>

          {donutFiltered.length === 0 ? (
            <div className="ledgernest-empty"><div className="ledgernest-empty-icon">📊</div>{t('noPositions')}</div>
          ) : editingTarget ? (
            /* ── Inline target editor ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TARGET_CATEGORIES.map((d) => {
                const val = targetDraft[d.label] ?? 0
                return (
                  <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, flex: 1 }}>{d.label}</span>
                    <input
                      type="number" min={0} max={100} step={1}
                      value={val === 0 ? '' : val}
                      placeholder="0"
                      onChange={(e) => setTargetDraft(prev => ({ ...prev, [d.label]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                      style={{ width: 52, textAlign: 'right', padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 12 }}>%</span>
                  </div>
                )
              })}
              {/* Remaining counter */}
              {(() => {
                const used = Object.values(targetDraft).reduce((s, v) => s + v, 0)
                const remaining = 100 - used
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 12, color: remaining === 0 ? 'var(--positive)' : remaining < 0 ? 'var(--negative)' : 'var(--text-secondary)' }}>
                      {remaining === 0 ? '✓ 100%' : remaining > 0 ? `Rimanente: ${remaining}%` : `Eccedenza: ${Math.abs(remaining)}%`}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={() => setEditingTarget(false)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Annulla</button>
                      <button type="button" disabled={remaining !== 0} onClick={() => { updateSettings({ targetAllocation: targetDraft }); setEditingTarget(false) }}
                        style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: remaining === 0 ? 'var(--accent)' : 'var(--border)', color: remaining === 0 ? '#fff' : 'var(--text-tertiary)', cursor: remaining === 0 ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                        Salva
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          ) : allocView === 'actual' ? (
            /* ── Actual donut view ── */
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <Donut data={donutFiltered} size={150} thickness={24} label={fmtCpt(totalFiltered)} sublabel={t('inPortfolio')} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {donutFiltered.map((d) => (
                  <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>{d.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', marginRight: 8 }}>{fmt0(d.value)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {totalFiltered > 0 ? ((d.value / totalFiltered) * 100).toFixed(1) : '0'}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* ── vs Target drift view ── */
            (() => {
              const hasTargets = Object.keys(targetAllocation).length > 0
              if (!hasTargets) return (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>🎯</div>
                  Nessun target definito.<br />
                  <button type="button" onClick={() => { setTargetDraft({}); setEditingTarget(true) }}
                    style={{ marginTop: 10, fontSize: 12, padding: '5px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                    Definisci target
                  </button>
                </div>
              )
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {donutFiltered.map((d) => {
                    const actPct = totalFiltered > 0 ? (d.value / totalFiltered) * 100 : 0
                    const tgtPct = targetAllocation[d.label] ?? 0
                    const delta  = actPct - tgtPct
                    const absDelta = Math.abs(delta)
                    const driftColor = absDelta <= 3 ? 'var(--positive)' : absDelta <= 10 ? '#f0a500' : 'var(--negative)'
                    return (
                      <div key={d.label}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{d.label}</span>
                          <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{actPct.toFixed(1)}%</span>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>→</span>
                          <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{tgtPct > 0 ? `${tgtPct}%` : '—'}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: driftColor, minWidth: 42, textAlign: 'right' }}>
                            {tgtPct > 0 ? (delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`) : ''}
                          </span>
                        </div>
                        {/* Bar: actual fill + target marker */}
                        <div style={{ position: 'relative', height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'visible' }}>
                          <div style={{ width: `${Math.min(actPct, 100)}%`, height: '100%', background: d.color, borderRadius: 3, transition: 'width 0.3s' }} />
                          {tgtPct > 0 && (
                            <div style={{ position: 'absolute', top: -3, left: `${Math.min(tgtPct, 100)}%`, width: 2, height: 12, background: 'var(--text-secondary)', borderRadius: 1, transform: 'translateX(-50%)' }} />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()
          )}
        </div>
      </div>

      {/* ── Heatmap + Dividends calendar ── */}
      <div className="ledgernest-grid ledgernest-grid--row">
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
      </div>

      {/* ── Positions + Movements ── */}
      <div className="ledgernest-grid ledgernest-grid--7-5">
        <div className="ledgernest-card">
          <div className="ledgernest-card-head">
            <div>
              <div className="ledgernest-card-title">{t('yourPositions')}</div>
              <div className="ledgernest-card-sub">{positions.length} · {t('sortByValue')}</div>
            </div>
            {positions.length > POSITIONS_PREVIEW && (
              <button className="ledgernest-btn-ghost" onClick={() => setShowAllPositions(v => !v)}>
                <span>{showAllPositions ? t('showLess') : t('viewAll')}</span>
                <Icon name="chevron" size={14} style={{ transform: showAllPositions ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
            )}
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
              {(showAllPositions ? sortedPositions : sortedPositions.slice(0, POSITIONS_PREVIEW)).map((p) => (
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
                      data={sparkData[p.ticker] ?? []}
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

      {/* ── Cashflow + Treemap side by side ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <div className="ledgernest-card" style={{ flex: '3 1 0', minWidth: 0 }}>
          <div className="ledgernest-card-head">
            <div>
              <div className="ledgernest-card-title">{t('incomeVsExpenses')}</div>
              <div className="ledgernest-card-sub">{t('last6Months')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--success)', display: 'inline-block' }} />
                Entrate
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--danger)', display: 'inline-block' }} />
                Uscite
              </span>
            </div>
          </div>
          <BarChart data={cashflowBars} paired formatValue={fmt} height={180} />
        </div>

        <div className="ledgernest-card" style={{ flex: '2 1 0', minWidth: 0 }}>
          <div className="ledgernest-card-head">
            <div>
              <div className="ledgernest-card-title">{t('positionsWeight')}</div>
              <div className="ledgernest-card-sub">Treemap · top {treemapData.length}</div>
            </div>
          </div>
          {treemapData.length === 0 ? (
            <div className="ledgernest-empty"><div className="ledgernest-empty-icon">🗺️</div>{t('noPositions')}</div>
          ) : (
            <Treemap data={treemapData} height={180} />
          )}
        </div>
      </div>


    </div>
  )
}
