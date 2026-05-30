'use client'

import { useMemo, useState } from 'react'
import { useFinanceStore } from '@/stores/financeStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePricesStore } from '@/stores/pricesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useFormatters } from '@/hooks/useFormatters'
import Icon from '@/components/shared/Icon'
import { useTranslations } from 'next-intl'
import type { BudgetCategory } from '@/types'

// ── helpers ───────────────────────────────────────────────────

function fmtMonthFull(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long' })
}
function fmtMonthShort(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short' }).replace('.', '')
}

// target % for 50/30/20 rule — keyed by stable group id
const GROUP_TARGETS: Record<string, number> = { needs: 50, lifestyle: 30, finance: 10, investments: 10 }

const ASSET_CLASSES = [
  { key: 'etf',       label: 'ETF',       icon: 'etf',        color: '#5bc8d0' },
  { key: 'stock',     label: 'Azioni',    icon: 'azioni',     color: '#7c6df7' },
  { key: 'crypto',    label: 'Crypto',    icon: 'crypto',     color: '#d29922' },
  { key: 'bond',      label: 'Bond',      icon: 'conti',      color: '#3fb950' },
  { key: 'commodity', label: 'Commodity', icon: 'patrimonio', color: '#f77c3a' },
]

const DEFAULT_ASSET_ALLOC: Record<string, number> = { etf: 60, stock: 30, crypto: 10 }

type SidebarTab = 'riepilogo' | 'confronto' | 'moneyflow' | 'dovevanno'
const SIDEBAR_TABS: SidebarTab[] = ['riepilogo', 'confronto', 'moneyflow', 'dovevanno']

const colLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
  letterSpacing: '0.07em', textTransform: 'uppercase',
}

// ── shared components ─────────────────────────────────────────

function RemPill({ v }: { v: number }) {
  const { fmt } = useFormatters()
  const isNeg = v < 0
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
      padding: '4px 10px', borderRadius: 20, textAlign: 'center', whiteSpace: 'nowrap',
      background: isNeg ? 'var(--danger)' : 'color-mix(in oklch, var(--success) 18%, transparent)',
      color: isNeg ? '#fff' : 'var(--success)',
    }}>
      {isNeg ? '−' : ''}{fmt(Math.abs(v))}
    </div>
  )
}

function AttesoPill({ planned, received }: { planned: number; received: number }) {
  const { fmt } = useFormatters()
  const atteso = Math.max(0, planned - received)
  const isZero = atteso === 0
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
      padding: '4px 10px', borderRadius: 20, textAlign: 'center', whiteSpace: 'nowrap',
      background: isZero ? 'color-mix(in oklch, var(--success) 18%, transparent)' : 'color-mix(in oklch, var(--warning) 22%, transparent)',
      color: isZero ? 'var(--success)' : 'var(--warning)',
    }}>
      {fmt(atteso)}
    </div>
  )
}

function LeafCategoryRow({ cat, budget, spent, onBudgetChange, income = 0 }: {
  cat: BudgetCategory
  budget: number
  spent: number
  onBudgetChange: (v: number) => void
  income?: number
}) {
  const { fmt } = useFormatters()
  const rem     = budget - spent
  const isOver  = budget > 0 && spent > budget
  const incPct  = income > 0 && budget > 0 ? Math.round((budget / income) * 100) : null
  const spentPct = budget > 0 && spent > 0  ? Math.round((spent  / budget) * 100) : null
  return (
    <div
      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background .1s' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 140px 110px 90px', padding: '9px 20px', alignItems: 'center' }}>
        <div />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: `${cat.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
            {cat.emoji}
          </div>
          <span className="ledgernest-budget-cat-name" style={{ fontWeight: 600, fontSize: 13 }}>{cat.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-elevated)', borderRadius: 8, padding: '3px 8px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>€</span>
            <input
              type="number" value={budget} min={0} step={10}
              onChange={(e) => onBudgetChange(parseFloat(e.target.value) || 0)}
              style={{ width: 52, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)' }}
            />
          </div>
          {incPct !== null && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{incPct}%</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 13, color: isOver ? 'var(--danger)' : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(spent)}</span>
          {spentPct !== null && <span style={{ fontSize: 10, color: isOver ? 'var(--danger)' : 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{spentPct}%</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {budget > 0
            ? <RemPill v={rem} />
            : <span style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right', width: '100%', display: 'block' }}>—</span>
          }
        </div>
      </div>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────

export default function BudgetPage() {
  const tl = useTranslations('budget')
  const { fmt } = useFormatters()
  const now = new Date()
  const currentMonthKey = now.toISOString().slice(0, 7)

  const { settings, updateSettings } = useSettingsStore()
  const pinnedMonth = settings.pinnedBudgetMonth ?? null

  const [month, setMonth] = useState(() => pinnedMonth ?? currentMonthKey)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [activeTab, setActiveTab] = useState<SidebarTab>('riepilogo')
  const [groupTab, setGroupTab] = useState<string>('income')

  function togglePin(m: string) {
    updateSettings({ pinnedBudgetMonth: pinnedMonth === m ? null : m })
  }
  const toggleSection = (key: string) => setCollapsed((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n })

  const {
    budgetCategories, budgetGroups, transactions, goals, updateGoal, recurringItems,
    budgetPlans, setMonthPlanIncome, setMonthPlanCategory, setGroupBudget,
    setMonthPlanAssetAllocation, setMonthPlanIncomeSources, setMonthPlanInvestConfig, resetMonthPlan,
  } = useFinanceStore()

  const expenseBudgetGroups = useMemo(
    () => budgetGroups.filter((g) => g.id !== 'income' && g.id !== 'transfers').sort((a, b) => a.order - b.order),
    [budgetGroups]
  )
  const summaryGroups = useMemo(
    () => expenseBudgetGroups.filter((g) => GROUP_TARGETS[g.id] !== undefined).map((g) => ({ ...g, key: g.id, target: GROUP_TARGETS[g.id] })),
    [expenseBudgetGroups]
  )
  const { positions } = usePortfolioStore()
  const { quotes } = usePricesStore()

  const plan = (budgetPlans ?? {})[month] ?? { income: 0, categories: {}, assetAllocation: {} }

  // ── hierarchy: identify subcategory headers ────────────────
  const parentCatIds = useMemo(
    () => new Set(budgetCategories.filter((c) => c.parentId).map((c) => c.parentId!)),
    [budgetCategories]
  )

  const incomeMidCats    = budgetCategories.filter((c) => c.type === 'income' && parentCatIds.has(c.id))
  const incomeLeafCats   = budgetCategories.filter((c) => c.type === 'income' && !!c.parentId)
  const incomeDirectCats = budgetCategories.filter((c) => c.type === 'income' && !c.parentId && !parentCatIds.has(c.id))
  const incomeCats = [...incomeLeafCats, ...incomeDirectCats]

  // ── income plan ───────────────────────────────────────────
  const planIncomeSources = plan.incomeSources ?? {}
  const income = Object.keys(planIncomeSources).some((k) => (planIncomeSources[k] ?? 0) > 0)
    ? Object.values(planIncomeSources).reduce((s, v) => s + v, 0)
    : plan.income

  // ── leaf expense categories (no subcategory headers) ──────
  const leafExpenseCats = useMemo(
    () => budgetCategories.filter((c) => c.type === 'expense' && !parentCatIds.has(c.id)),
    [budgetCategories, parentCatIds]
  )

  // ── first month with data (earliest tx or budget plan, capped at -24 months) ─
  const firstDataMonth = useMemo(() => {
    const candidates: string[] = [currentMonthKey]
    for (const tx of transactions) {
      if (tx.date) candidates.push(tx.date.slice(0, 7))
    }
    for (const key of Object.keys(budgetPlans ?? {})) {
      candidates.push(key)
    }
    const earliest = candidates.reduce((a, b) => a < b ? a : b)
    // Never go back more than 24 months
    const cap = new Date(currentMonthKey + '-01T12:00:00')
    cap.setMonth(cap.getMonth() - 24)
    const capKey = cap.toISOString().slice(0, 7)
    return earliest < capKey ? capKey : earliest
  }, [transactions, budgetPlans, currentMonthKey])

  // ── planning months: from firstDataMonth to +5 future ────────
  const planningMonths = useMemo(() => {
    const months: string[] = []
    const d = new Date(firstDataMonth + '-01T12:00:00')
    const last = new Date(currentMonthKey + '-01T12:00:00')
    last.setMonth(last.getMonth() + 11)
    while (d <= last) {
      months.push(d.toISOString().slice(0, 7))
      d.setMonth(d.getMonth() + 1)
    }
    return months
  }, [firstDataMonth, currentMonthKey])

  const firstMonth = planningMonths[0]
  const lastMonth  = planningMonths[planningMonths.length - 1]

  function getCatBudget(catId: string): number { return plan.categories[catId] ?? 0 }
  function getGroupBudget(key: string): number  { return plan.groupBudgets?.[key] ?? 0 }

  // ── spent by category ─────────────────────────────────────
  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const tx of transactions) {
      if (tx.type === 'expense' && tx.date.startsWith(month)) {
        const cat = budgetCategories.find(
          (c) => c.id === tx.category || c.name === tx.category || c.name.toLowerCase() === tx.category.toLowerCase()
        )
        const key = cat?.id ?? tx.category
        map[key] = (map[key] ?? 0) + tx.amount
      }
    }
    return map
  }, [transactions, month, budgetCategories])

  const receivedByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const tx of transactions) {
      if (tx.type === 'income' && tx.date.startsWith(month)) {
        const cat = budgetCategories.find(
          (c) => c.id === tx.category || c.name === tx.category || c.name.toLowerCase() === tx.category.toLowerCase()
        )
        const key = cat?.id ?? tx.category
        map[key] = (map[key] ?? 0) + tx.amount
      }
    }
    return map
  }, [transactions, month, budgetCategories])

  const totalSpent       = Object.values(spentByCategory).reduce((s, v) => s + v, 0)
  const totalBudget      = leafExpenseCats.reduce((s, c) => s + getCatBudget(c.id), 0)
  const totalGoalContrib = goals.reduce((s, g) => s + (g.monthlyContribution ?? 0), 0)
  const available        = income - totalBudget - totalGoalContrib

  const investBudget = leafExpenseCats.filter((c) => c.group === 'investments').reduce((s, c) => s + getCatBudget(c.id), 0)
  const investSpent  = leafExpenseCats.filter((c) => c.group === 'investments').reduce((s, c) => s + (spentByCategory[c.id] ?? 0), 0)
  const opexBudget   = totalBudget - investBudget
  const opexSpent    = totalSpent - investSpent

  const actualIncome = useMemo(
    () => transactions.filter((t) => t.type === 'income' && t.date.startsWith(month)).reduce((s, t) => s + t.amount, 0),
    [transactions, month]
  )

  const prevMonthSpent = useMemo(() => {
    const pd = new Date(month + '-01T12:00:00')
    pd.setMonth(pd.getMonth() - 1)
    const pm = pd.toISOString().slice(0, 7)
    return transactions.filter((t) => t.type === 'expense' && t.date.startsWith(pm)).reduce((s, t) => s + t.amount, 0)
  }, [transactions, month])

  // ── portfolio value per asset type ────────────────────────
  const portfolioByType = useMemo(() => {
    const map: Record<string, number> = {}
    for (const pos of positions) {
      const price = quotes[pos.ticker]?.price ?? pos.avgPrice
      map[pos.type] = (map[pos.type] ?? 0) + pos.quantity * price
    }
    return map
  }, [positions, quotes])
  const totalPortfolioValue = Object.values(portfolioByType).reduce((s, v) => s + v, 0)

  const assetAlloc: Record<string, number> = plan.assetAllocation && Object.keys(plan.assetAllocation).length > 0
    ? plan.assetAllocation
    : DEFAULT_ASSET_ALLOC

  const activeClasses = ASSET_CLASSES.filter(
    (a) => (portfolioByType[a.key] ?? 0) > 0 || (assetAlloc[a.key] ?? 0) > 0
  )

  function adjustAlloc(key: string, newPct: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(newPct)))
    const others = activeClasses.filter((a) => a.key !== key)
    const rem = 100 - clamped
    const otherTotal = others.reduce((s, a) => s + (assetAlloc[a.key] ?? 0), 0)
    const updated: Record<string, number> = { ...assetAlloc, [key]: clamped }
    if (otherTotal > 0) {
      let distributed = 0
      others.forEach((a, i) => {
        const share = i === others.length - 1
          ? rem - distributed
          : Math.round(((assetAlloc[a.key] ?? 0) / otherTotal) * rem)
        updated[a.key] = share
        distributed += share
      })
    } else if (others.length > 0) {
      const share = Math.floor(rem / others.length)
      others.forEach((a) => { updated[a.key] = share })
    }
    setMonthPlanAssetAllocation(month, updated)
  }

  // ── invest configurator ──────────────────────────────────
  const investLeafCats = leafExpenseCats.filter((c) => c.group === 'investments')
  const investPct = plan.investPct ?? 0
  const defaultInvestCatAlloc = useMemo(() => {
    if (investLeafCats.length === 0) return {} as Record<string, number>
    const base = Math.floor(100 / investLeafCats.length)
    const alloc: Record<string, number> = {}
    investLeafCats.forEach((c, i) => {
      alloc[c.id] = i === investLeafCats.length - 1 ? 100 - base * (investLeafCats.length - 1) : base
    })
    return alloc
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investLeafCats.map((c) => c.id).join(',')])
  const investCatAlloc: Record<string, number> =
    plan.investCatAlloc && Object.keys(plan.investCatAlloc).length > 0
      ? plan.investCatAlloc
      : defaultInvestCatAlloc
  const investTotalPct = investLeafCats.reduce((s, c) => s + (investCatAlloc[c.id] ?? 0), 0)

  function adjustInvestAlloc(catId: string, newPct: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(newPct)))
    setMonthPlanInvestConfig(month, investPct, { ...investCatAlloc, [catId]: clamped })
  }

  function applyInvestConfig() {
    const investAmt = income * investPct / 100
    investLeafCats.forEach((cat) => {
      const pct = investCatAlloc[cat.id] ?? 0
      setMonthPlanCategory(month, cat.id, Math.round(investAmt * pct / 100))
    })
  }

  // ── init from recurring ───────────────────────────────────
  function initFromRecurring() {
    const MULTS: Record<string, number> = { daily: 30, weekly: 4.33, biweekly: 2.17, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }
    recurringItems
      .filter((item) => item.active !== false && item.type === 'expense' && item.nextDate.slice(0, 7) <= month)
      .forEach((item) => {
        const monthly = Math.round(item.amount * (MULTS[item.frequency] ?? 1))
        const itemCatLower = (item.category ?? '').toLowerCase()
        // Try leaf categories first (direct ID or name match)
        let cat = leafExpenseCats.find(
          (c) => c.id === item.category || c.name.toLowerCase() === itemCatLower
        )
        if (!cat) {
          // Fall back: find any expense category (including parents) by ID or name
          const anyMatch = budgetCategories.find(
            (c) => c.type === 'expense' && (c.id === item.category || c.name.toLowerCase() === itemCatLower)
          )
          if (anyMatch) {
            // If it's a parent, use its first leaf child
            cat = parentCatIds.has(anyMatch.id)
              ? leafExpenseCats.find((c) => c.parentId === anyMatch.id)
              : anyMatch
          }
        }
        if (cat) setMonthPlanCategory(month, cat.id, monthly)
      })
  }

  // ── date info ─────────────────────────────────────────────
  const d0 = new Date(month + '-01T12:00:00')
  const monthName = fmtMonthFull(d0)

  // ── month navigation ──────────────────────────────────────
  function prevMonth() {
    if (month <= firstMonth) return
    const pd = new Date(month + '-01')
    pd.setMonth(pd.getMonth() - 1)
    setMonth(pd.toISOString().slice(0, 7))
  }
  function nextMonth() {
    if (month >= lastMonth) return
    const nd = new Date(month + '-01')
    nd.setMonth(nd.getMonth() + 1)
    setMonth(nd.toISOString().slice(0, 7))
  }

  // ── copy previous month ───────────────────────────────────
  const prevMonthPlanKey = (() => {
    const pd = new Date(month + '-01')
    pd.setMonth(pd.getMonth() - 1)
    return pd.toISOString().slice(0, 7)
  })()
  const hasPrevPlan = !!((budgetPlans ?? {})[prevMonthPlanKey])

  function copyPrevMonth() {
    const prev = (budgetPlans ?? {})[prevMonthPlanKey]
    if (!prev) return
    if (prev.incomeSources && Object.keys(prev.incomeSources).length > 0) {
      setMonthPlanIncomeSources(month, prev.incomeSources)
    } else if (prev.income > 0) {
      setMonthPlanIncome(month, prev.income)
    }
    if (prev.groupBudgets) {
      for (const [gk, amt] of Object.entries(prev.groupBudgets)) setGroupBudget(month, gk, amt)
    }
    for (const [catId, amount] of Object.entries(prev.categories ?? {})) {
      setMonthPlanCategory(month, catId, amount)
    }
    if (prev.assetAllocation && Object.keys(prev.assetAllocation).length > 0) {
      setMonthPlanAssetAllocation(month, prev.assetAllocation)
    }
  }

  // ── 50/30/20 preset ───────────────────────────────────────
  function apply5030() {
    if (!income) return
    setGroupBudget(month, 'needs', Math.round(income * 0.5))
    setGroupBudget(month, 'lifestyle', Math.round(income * 0.3))
    setGroupBudget(month, 'investments', Math.round(income * 0.2))
  }

  // ── last 6 months + per-group spending ───────────────────────
  const last6Months = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(month + '-01T12:00:00')
      d.setMonth(d.getMonth() - (5 - i))
      return d.toISOString().slice(0, 7)
    }), [month])

  const spentByGroupByMonth = useMemo(() => {
    const result: Record<string, Record<string, number>> = {}
    for (const m of last6Months) {
      result[m] = {}
      for (const tx of transactions) {
        if (tx.type === 'expense' && tx.date.startsWith(m)) {
          const cat = budgetCategories.find((c) => c.id === tx.category || c.name === tx.category)
          const g = cat?.group ?? 'other'
          result[m][g] = (result[m][g] ?? 0) + tx.amount
        }
      }
    }
    return result
  }, [transactions, last6Months, budgetCategories])

  const prevSpentByGroup = useMemo(() => spentByGroupByMonth[last6Months[4]] ?? {}, [spentByGroupByMonth, last6Months])

  // ── right-panel derived ────────────────────────────────────────
  const needsBudgetTotal     = leafExpenseCats.filter((c) => c.group === 'needs').reduce((s, c) => s + getCatBudget(c.id), 0)
  const lifestyleBudgetTotal = leafExpenseCats.filter((c) => c.group === 'lifestyle').reduce((s, c) => s + getCatBudget(c.id), 0)
  const savingsPct   = income > 0 ? ((investBudget + totalGoalContrib) / income * 100) : 0
  const needsPct     = income > 0 ? (needsBudgetTotal     / income * 100) : 0
  const lifestylePct = income > 0 ? (lifestyleBudgetTotal / income * 100) : 0

  const diagnostica: { type: 'warning' | 'info'; msg: string }[] = []
  if (income === 0) {
    diagnostica.push({ type: 'info', msg: tl('diagNoIncome') })
  } else {
    if (needsPct > 50)     diagnostica.push({ type: 'warning', msg: tl('diagNeeds', { pct: needsPct.toFixed(0) }) })
    if (lifestylePct > 30) diagnostica.push({ type: 'warning', msg: tl('diagLifestyle', { pct: lifestylePct.toFixed(0) }) })
    if (savingsPct < 10)   diagnostica.push({ type: 'warning', msg: tl('diagSavings', { pct: savingsPct.toFixed(0) }) })
    if (available < 0)     diagnostica.push({ type: 'warning', msg: tl('diagOver', { amt: fmt(Math.abs(available)) }) })
    if (totalBudget === 0) diagnostica.push({ type: 'info', msg: tl('diagNoBudget') })
  }

  // ── summary-card derived ──────────────────────────────────
  const isCurrentMonth = month === currentMonthKey
  const daysInMonth = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)), 0).getDate()
  const dayOfMonth  = isCurrentMonth ? now.getDate() : daysInMonth
  const projection  = isCurrentMonth && dayOfMonth > 0 ? Math.round(totalSpent / dayOfMonth * daysInMonth) : totalSpent
  const vsLastMonth = prevMonthSpent > 0 ? ((totalSpent - prevMonthSpent) / prevMonthSpent) * 100 : null
  const overrunCats = leafExpenseCats.filter((c) => { const b = getCatBudget(c.id); const s = spentByCategory[c.id] ?? 0; return b > 0 && s > b })
  const allocPct    = income > 0 ? Math.round(((totalBudget + totalGoalContrib) / income) * 100) : 0

  const navBtn: React.CSSProperties = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10,
    cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16, padding: '0 14px', height: 40,
  }

  return (
    <div className="ledgernest-gap-5">

      {/* ── Month selector ────────────────────────── */}
      <div className="ledgernest-card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{ ...navBtn, flexShrink: 0, height: 'auto', minHeight: 28, padding: '0 12px', opacity: month <= firstMonth ? 0.3 : 1 }} onClick={prevMonth} disabled={month <= firstMonth}>‹</button>
          {/* Scrollable on mobile */}
          <div style={{ flex: 1, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}>
            {planningMonths.map((m, i) => {
              const md = new Date(m + '-01T12:00:00')
              const mName = fmtMonthFull(md)
              const mYear = md.getFullYear()
              const isActive = m === month
              const isCurrent = m === currentMonthKey
              const isPinned = pinnedMonth === m
              return (
                <div key={m} style={{ position: 'relative', flexShrink: 0, minWidth: 100 }}>
                  <button onClick={() => setMonth(m)} style={{
                    width: '100%', padding: '10px 10px 10px', borderRadius: 10, border: 'none',
                    background: isActive ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: isActive ? 'var(--text-on-accent)' : 'var(--text-primary)',
                    cursor: 'pointer', textAlign: 'center', transition: 'all .15s',
                  }}>
                    {(() => {
                      const offset = planningMonths.indexOf(m) - planningMonths.indexOf(currentMonthKey)
                      const label = isCurrent ? tl('monthThis')
                        : offset < 0 ? `${offset} mesi`
                        : `+${offset} ${offset === 1 ? 'mese' : 'mesi'}`
                      return <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', opacity: 0.7, marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
                    })()}
                    <div style={{ fontSize: 15, fontWeight: isActive ? 800 : 600 }}>{mName}</div>
                    <div style={{ fontSize: 11, opacity: 0.6, marginTop: 1 }}>{mYear}</div>
                  </button>
                  {/* Pin button — shown on hover (desktop) or always on active (mobile) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePin(m) }}
                    title={isPinned ? 'Rimuovi pin' : 'Apri sempre questo mese'}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 1,
                      fontSize: 12, opacity: isPinned ? 1 : 0.35,
                      color: isActive ? 'var(--text-on-accent)' : 'var(--text-tertiary)',
                    }}
                  >
                    📌
                  </button>
                </div>
              )
            })}
          </div>
          <button style={{ ...navBtn, flexShrink: 0, height: 'auto', minHeight: 28, padding: '0 12px', opacity: month >= lastMonth ? 0.3 : 1 }}
            onClick={nextMonth} disabled={month >= lastMonth}>›</button>
        </div>
      </div>

      {/* ── 2-col layout 60/40: [Budget + Pianifica] | DA ASSEGNARE (sticky) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, alignItems: 'start' }}>

        {/* Budget header + Pianifica — unica card col 1 */}
        <div className="ledgernest-card ledgernest-budget-table-card" style={{ padding: 0, overflow: 'hidden', gridColumn: 1 }}>

          {/* ── Budget header ── */}
          <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', background: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: 20, padding: '3px 12px' }}>{tl('summaryTitle', { monthName })}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {d0.getDate()} {monthName.slice(0,3).toLowerCase()}
                {isCurrentMonth && ` · giorno ${dayOfMonth} di ${daysInMonth}`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <div className="ledgernest-budget-bignum" style={{ fontSize: 42, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>{fmt(totalSpent)}</div>
              <div style={{ fontSize: 16, color: 'var(--text-secondary)', fontWeight: 600 }}>{tl('summaryOf', { total: fmt(totalBudget) })}</div>
            </div>
            {totalBudget > 0 && (
              <div style={{ position: 'relative', height: 7, background: 'var(--bg-elevated)', borderRadius: 99, marginBottom: 8, overflow: 'visible' }}>
                <div style={{ height: '100%', width: `${Math.min(100, totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0)}%`, background: totalSpent > totalBudget ? 'var(--danger)' : 'var(--accent)', borderRadius: 99, transition: 'width .3s' }} />
                {isCurrentMonth && (
                  <div style={{ position: 'absolute', top: -4, bottom: -4, left: `${Math.min(99, (dayOfMonth / daysInMonth) * 100)}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', marginBottom: 1 }}>{tl('summaryToday')}</div>
                    <div style={{ width: 2, height: 15, background: 'rgba(255,255,255,0.45)', borderRadius: 1 }} />
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: (vsLastMonth !== null || (isCurrentMonth && projection > 0) || overrunCats.length > 0) ? 14 : 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: totalBudget - totalSpent >= 0 ? 'var(--text-secondary)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                {tl('summaryRemaining', { rem: fmt(Math.abs(totalBudget - totalSpent)) })}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {vsLastMonth !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: vsLastMonth <= 0 ? 'color-mix(in oklch, var(--success) 12%, transparent)' : 'color-mix(in oklch, var(--danger) 10%, transparent)', border: `1px solid ${vsLastMonth <= 0 ? 'color-mix(in oklch, var(--success) 30%, transparent)' : 'color-mix(in oklch, var(--danger) 25%, transparent)'}` }}>
                  <span style={{ fontSize: 13, color: vsLastMonth <= 0 ? 'var(--success)' : 'var(--danger)' }}>{vsLastMonth <= 0 ? '↓' : '↑'}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: vsLastMonth <= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {vsLastMonth <= 0 ? tl('badgeOnTrack') : tl('badgeOverLastMonth')} · {vsLastMonth > 0 ? '+' : ''}{vsLastMonth.toFixed(1)}% vs {fmtMonthShort((() => { const pd = new Date(month + '-01T12:00:00'); pd.setMonth(pd.getMonth() - 1); return pd; })())}
                  </span>
                </div>
              )}
              {isCurrentMonth && projection > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: projection > totalBudget ? 'color-mix(in oklch, var(--danger) 10%, transparent)' : 'color-mix(in oklch, var(--success) 10%, transparent)', border: `1px solid ${projection > totalBudget ? 'color-mix(in oklch, var(--danger) 25%, transparent)' : 'color-mix(in oklch, var(--success) 25%, transparent)'}` }}>
                  <span style={{ fontSize: 13, color: projection > totalBudget ? 'var(--danger)' : 'var(--success)' }}>↗</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: projection > totalBudget ? 'var(--danger)' : 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
                    {tl('projectionLabel', { amt: fmt(projection) })}
                  </span>
                </div>
              )}
              {overrunCats.slice(0, 2).map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'color-mix(in oklch, var(--warning) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--warning) 25%, transparent)' }}>
                  <span style={{ fontSize: 13 }}>🔔</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', fontVariantNumeric: 'tabular-nums' }}>
                    {tl('overrunMessage', { category: c.name, amt: fmt((spentByCategory[c.id] ?? 0) - getCatBudget(c.id)) })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Toolbar */}
          <div className="ledgernest-budget-toolbar" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{tl('toolbarTitle')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {tl('toolbarDesc')}
              </div>
            </div>
            <div className="ledgernest-budget-toolbar-btns" style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" onClick={copyPrevMonth} disabled={!hasPrevPlan}>{tl('toolbarCopyPrev')}</button>
              <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" onClick={initFromRecurring} disabled={recurringItems.filter((r) => r.active !== false && r.type === 'expense').length === 0}>{tl('toolbarFromRecurring')}</button>
              <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" onClick={() => resetMonthPlan(month)}>{tl('toolbarReset')}</button>
              <div style={{ width: 1, background: 'var(--border-subtle)', alignSelf: 'stretch' }} />
              <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" onClick={() => setCollapsed(new Set(['income', 'goals', ...budgetGroups.map((g) => g.id)]))}>{tl('toolbarCollapseAll')}</button>
              <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" onClick={() => setCollapsed(new Set())}>{tl('toolbarExpandAll')}</button>
            </div>
          </div>

          {/* ── Group tab strip ─────────────────────── */}
          {(() => {
            const groupTabs = [
              { id: 'income',  label: tl('incomeGroup'), color: '#4ade80', amount: income },
              ...expenseBudgetGroups.map((g) => ({
                id: g.id, label: g.label, color: g.color,
                amount: leafExpenseCats.filter((c) => c.group === g.id).reduce((s, c) => s + getCatBudget(c.id), 0),
              })),
            ]
            return (
              <div className="ledgernest-budget-tab-strip" style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 6, overflowX: 'auto' }}>
                {groupTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setGroupTab(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '6px 13px', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${groupTab === tab.id ? tab.color : 'transparent'}`,
                      background: groupTab === tab.id ? `${tab.color}14` : 'var(--bg-elevated)',
                      color: groupTab === tab.id ? tab.color : 'var(--text-secondary)',
                      whiteSpace: 'nowrap', transition: 'all .15s', fontWeight: 700, fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: tab.color, flexShrink: 0, display: 'inline-block' }} />
                    {tab.label}
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{fmt(tab.amount)}</span>
                  </button>
                ))}
              </div>
            )
          })()}

          {/* ── ENTRATE ─────────────────────────────── */}
          {groupTab === 'income' && <div>
            {/* Header row — same style as expense groups, with column labels */}
            <div
              onClick={() => toggleSection('income')}
              style={{
                display: 'grid', gridTemplateColumns: '36px 1fr 140px 110px 90px',
                padding: '9px 20px', background: 'var(--bg-elevated)',
                alignItems: 'center', cursor: 'pointer', userSelect: 'none',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', justifySelf: 'center' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>{tl('incomeGroup')}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>{tl('incomeGroupDesc')}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', transition: 'transform .2s', transform: collapsed.has('income') ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▾</span>
              </div>
              <div style={colLabelStyle}>{tl('colPlanned')}</div>
              <div style={colLabelStyle}>{tl('colActual')}</div>
              <div style={{ ...colLabelStyle, textAlign: 'right' }}>{tl('colRemaining')}</div>
            </div>

            {/* Totals row — always visible */}
            <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 140px 110px 90px', padding: '9px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
              <div />
              <div style={{ fontWeight: 700, fontSize: 13, paddingLeft: 8 }}>{tl('totalIncome')}</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(income)}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(actualIncome)}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><AttesoPill planned={income} received={actualIncome} /></div>
            </div>

            {!collapsed.has('income') && (
              <>
                {/* Mid-level income categories (Lavoro, Rendite, …) */}
                {incomeMidCats.map((midCat) => {
                  const leaves = incomeLeafCats.filter((c) => c.parentId === midCat.id)
                  const midPlanned  = leaves.reduce((s, c) => s + (planIncomeSources[c.id] ?? 0), 0)
                  const midReceived = leaves.reduce((s, c) => s + (receivedByCategory[c.id] ?? 0), 0)
                  return (
                    <div key={midCat.id}>
                      {/* Category header */}
                      <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 140px 110px 90px', padding: '8px 20px', background: 'color-mix(in oklch, var(--bg-elevated) 60%, transparent)', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${midCat.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{midCat.emoji}</div>
                        <span style={{ fontWeight: 700, fontSize: 13, paddingLeft: 8 }}>{midCat.name}</span>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(midPlanned)}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(midReceived)}</div>
                        <div />
                      </div>
                      {/* Leaf rows */}
                      {leaves.map((cat) => {
                        const planned  = planIncomeSources[cat.id] ?? 0
                        const received = receivedByCategory[cat.id] ?? 0
                        const sharePct = income > 0 && planned > 0 ? Math.round((planned / income) * 100) : null
                        return (
                          <div key={cat.id}
                            style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background .1s' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 140px 110px 90px', padding: '9px 20px', paddingLeft: 44, alignItems: 'center' }}>
                              <div />
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 26, height: 26, borderRadius: 7, background: `${cat.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{cat.emoji}</div>
                                <span className="ledgernest-budget-cat-name" style={{ fontWeight: 600, fontSize: 13 }}>{cat.name}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-elevated)', borderRadius: 8, padding: '3px 8px', border: '1px solid var(--border-subtle)' }}>
                                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>€</span>
                                  <input
                                    type="number" value={planned} min={0} step={10}
                                    onChange={(e) => {
                                      const updated = { ...planIncomeSources, [cat.id]: parseFloat(e.target.value) || 0 }
                                      setMonthPlanIncomeSources(month, updated)
                                    }}
                                    style={{ width: 58, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
                                  />
                                </div>
                                {sharePct !== null && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{sharePct}%</span>}
                              </div>
                              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(received)}</div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><AttesoPill planned={planned} received={received} /></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
                {/* Direct income leaves (no parent — backward compat) */}
                {incomeDirectCats.map((cat) => {
                  const planned  = planIncomeSources[cat.id] ?? 0
                  const received = receivedByCategory[cat.id] ?? 0
                  const sharePct = income > 0 && planned > 0 ? Math.round((planned / income) * 100) : null
                  return (
                    <div key={cat.id}
                      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background .1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 140px 110px 90px', padding: '9px 20px', alignItems: 'center' }}>
                        <div />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: `${cat.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{cat.emoji}</div>
                          <span className="ledgernest-budget-cat-name" style={{ fontWeight: 600, fontSize: 13 }}>{cat.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-elevated)', borderRadius: 8, padding: '3px 8px', border: '1px solid var(--border-subtle)' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>€</span>
                            <input
                              type="number" value={planned} min={0} step={10}
                              onChange={(e) => {
                                const updated = { ...planIncomeSources, [cat.id]: parseFloat(e.target.value) || 0 }
                                setMonthPlanIncomeSources(month, updated)
                              }}
                              style={{ width: 58, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
                            />
                          </div>
                          {sharePct !== null && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{sharePct}%</span>}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(received)}</div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><AttesoPill planned={planned} received={received} /></div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>}

          {/* ── Expense groups ───────────────────────── */}
          {expenseBudgetGroups.filter((g) => groupTab === g.id).map((group) => {
            const allGroupCats = budgetCategories.filter((c) => c.group === group.id)
            const groupParentIds = new Set(allGroupCats.filter((c) => c.parentId).map((c) => c.parentId!))
            const subcats      = allGroupCats.filter((c) => groupParentIds.has(c.id))
            const directLeaves = allGroupCats.filter((c) => !c.parentId && !groupParentIds.has(c.id) && c.type !== 'income')
            const allLeaves    = allGroupCats.filter((c) => !groupParentIds.has(c.id) && c.type !== 'income')

            const catTotal = allLeaves.reduce((s, c) => s + getCatBudget(c.id), 0)
            const catSpent = allLeaves.reduce((s, c) => s + (spentByCategory[c.id] ?? 0), 0)
            const catRem   = catTotal - catSpent

            return (
              <div key={group.id} style={{ borderTop: '2px solid var(--border-subtle)' }}>

                {/* ── Group header row (section divider + column labels) */}
                <div
                  onClick={() => toggleSection(group.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '36px 1fr 140px 110px 90px',
                    padding: '9px 20px',
                    background: 'var(--bg-elevated)',
                    alignItems: 'center', cursor: 'pointer', userSelect: 'none',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: group.color, justifySelf: 'center' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>{group.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', transition: 'transform .2s', transform: collapsed.has(group.id) ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▾</span>
                  </div>
                  <div style={colLabelStyle}>{tl('colPlanned')}</div>
                  <div style={colLabelStyle}>{tl('colActual')}</div>
                  <div style={{ ...colLabelStyle, textAlign: 'right' }}>{tl('colRemaining')}</div>
                </div>

                {/* Totals row — always visible */}
                <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 140px 110px 90px', padding: '9px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                  <div />
                  <div style={{ fontWeight: 700, fontSize: 13, paddingLeft: 8 }}>{tl('totalExpenseGroup', { group: group.label.toLowerCase() })}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(catTotal)}</span>
                    {income > 0 && catTotal > 0 && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{Math.round(catTotal / income * 100)}%</span>}
                  </div>
                  <div style={{ fontSize: 13, color: catSpent > catTotal && catTotal > 0 ? 'var(--danger)' : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(catSpent)}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {catTotal > 0 ? <RemPill v={catRem} /> : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>}
                  </div>
                </div>

                {!collapsed.has(group.id) && (<>

                {/* Subcats → leaves */}
                {subcats.map((sub) => {
                  const subLeaves = allLeaves.filter((c) => c.parentId === sub.id)
                  return (
                    <div key={sub.id}>
                      {/* Subcategory divider — grid-aligned with leaf rows */}
                      <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 140px 110px 90px', padding: '6px 20px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${sub.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, justifySelf: 'center' }}>
                          {sub.emoji}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-tertiary)', paddingLeft: 8 }}>{sub.name}</span>
                        <div /><div /><div />
                      </div>
                      {subLeaves.map((cat) => (
                        <LeafCategoryRow key={cat.id} cat={cat} budget={getCatBudget(cat.id)} spent={spentByCategory[cat.id] ?? 0} onBudgetChange={(v) => setMonthPlanCategory(month, cat.id, v)} income={income} />
                      ))}
                    </div>
                  )
                })}
                {directLeaves.map((cat) => (
                  <LeafCategoryRow key={cat.id} cat={cat} budget={getCatBudget(cat.id)} spent={spentByCategory[cat.id] ?? 0} onBudgetChange={(v) => setMonthPlanCategory(month, cat.id, v)} income={income} />
                ))}

                </>)}
              </div>
            )
          })}

          {/* ── Goals ───────────────────────────────── */}
          {goals.length > 0 && groupTab === 'investments' && (
            <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div
                onClick={() => toggleSection('goals')}
                style={{ padding: '12px 20px', background: 'var(--bg-elevated)', borderBottom: collapsed.has('goals') ? 'none' : '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
              >
                <span style={{ fontSize: 18 }}>🎯</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>{tl('goalsSection')}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 10 }}>{tl('goalsSectionDesc')}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', marginRight: 12 }}>{fmt(totalGoalContrib)}{tl('perMonth')}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', transition: 'transform .2s', transform: collapsed.has('goals') ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▾</span>
              </div>
              {!collapsed.has('goals') && (<>
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 140px 110px 90px', padding: '5px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                <div /><div />
                <div style={colLabelStyle}>{tl('colContribution')}</div>
                <div style={colLabelStyle}>{tl('colPctIncome')}</div>
                <div style={{ ...colLabelStyle, textAlign: 'right' }}>{tl('colProgress')}</div>
              </div>
              {goals.map((goal) => {
                const contrib  = goal.monthlyContribution ?? 0
                const pct      = income > 0 ? (contrib / income) * 100 : 0
                const progress = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0
                return (
                  <div key={goal.id}
                    style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background .1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 140px 110px 90px', padding: '10px 20px', alignItems: 'center' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${goal.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{goal.icon}</div>
                      <div style={{ paddingLeft: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{goal.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{progress.toFixed(0)}% · {fmt(goal.currentAmount)} di {fmt(goal.targetAmount)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-elevated)', borderRadius: 8, padding: '3px 8px', border: '1px solid var(--border-subtle)', width: 'fit-content' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>€</span>
                        <input
                          type="number" value={contrib} min={0} step={10}
                          onChange={(e) => updateGoal(goal.id, { monthlyContribution: parseInt(e.target.value) || 0 })}
                          style={{ width: 58, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)' }}
                        />
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ width: 70, height: 6, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${progress}%`, background: goal.color, borderRadius: 99, transition: 'width .4s' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              </>)}
            </div>
          )}

        </div>{/* end LEFT unified block */}

        {/* DA ASSEGNARE — col 2, rows 1-2 (sticky) */}
        <div className="ledgernest-budget-sidebar" style={{ gridColumn: 2, gridRow: '1 / 3', position: 'sticky', top: 80, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto', borderRadius: 14 }}>
          <div className="ledgernest-card" style={{ padding: 0, overflow: 'hidden' }}>

            {/* Da assegnare header */}
            <div style={{
              padding: '20px 22px',
              background: available >= 0
                ? 'color-mix(in oklch, #22c55e 10%, var(--bg-surface))'
                : 'color-mix(in oklch, var(--danger) 12%, var(--bg-surface))',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: available >= 0 ? '#4ade80' : 'var(--danger)', marginBottom: 4 }}>
                {available >= 0 ? tl('sidebarAssign') : tl('sidebarOver')}
              </div>
              <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: available >= 0 ? '#4ade80' : 'var(--danger)', lineHeight: 1 }}>
                {available < 0 ? '−' : ''}{fmt(Math.abs(available))}
              </div>
              {income > 0 && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>{tl('sidebarPctAllocated', { pct: allocPct })}</div>}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 6px' }}>
              {SIDEBAR_TABS.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  flex: 1, padding: '10px 0', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: 12, fontWeight: activeTab === tab ? 700 : 500,
                  color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`,
                  marginBottom: -1, transition: 'all .15s',
                }}>
                  {tab === 'riepilogo' ? tl('tabSummary') : tab === 'confronto' ? tl('tabComparison') : tab === 'moneyflow' ? tl('tabMoneyFlow') : tl('whereMoneyGoes')}
                </button>
              ))}
            </div>

            {/* ── Riepilogo tab ─────────────────────── */}
            {activeTab === 'riepilogo' && (
              <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {[
                  {
                    label: tl('summaryIncome'),
                    tooltip: `Reddito pianificato per il mese (${fmt(income)}).\n"Attesi" = ancora da incassare = pianificato − già ricevuto (${fmt(actualIncome)}).`,
                    planned: income, actual: actualIncome,
                    rem: income - actualIncome, color: '#4ade80', remLabel: tl('summaryExpected'),
                  },
                  {
                    label: tl('summaryExpenses'),
                    tooltip: `Spese operative pianificate (${fmt(opexBudget)}) = tutte le categorie di spesa esclusi Investimenti.\n"Rimasti" = budget ancora disponibile = pianificato − già speso (${fmt(opexSpent)}).`,
                    planned: opexBudget, actual: opexSpent,
                    rem: opexBudget - opexSpent, color: 'var(--accent)', remLabel: tl('summaryRemain'),
                  },
                  {
                    label: 'Investimenti + Goal',
                    tooltip: `Budget investimenti (${fmt(investBudget)}) + contributi mensili ai goal (${fmt(totalGoalContrib)}) = ${fmt(investBudget + totalGoalContrib)} pianificati.\n"Rimasti" = ancora da investire/versare questo mese = pianificato − già investito (${fmt(investSpent)}).`,
                    planned: investBudget + totalGoalContrib, actual: investSpent,
                    rem: (investBudget + totalGoalContrib) - investSpent, color: '#5bc8d0', remLabel: tl('summaryRemain'),
                  },
                ].map((s) => {
                  const pct  = s.planned > 0 ? Math.min(100, (s.actual / s.planned) * 100) : 0
                  const over = s.actual > s.planned && s.planned > 0
                  return (
                    <div key={s.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                        <span
                          style={{ fontSize: 13, fontWeight: 700, cursor: 'help', borderBottom: '1px dashed var(--border-subtle)' }}
                          title={s.tooltip}
                        >
                          {s.label} ℹ
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                          {s.planned > 0 ? fmt(s.planned) : '—'}
                        </span>
                      </div>
                      <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden', marginBottom: 7 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: over ? 'var(--danger)' : s.color, borderRadius: 99, transition: 'width .3s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: over ? 'var(--danger)' : 'var(--text-primary)' }}>{fmt(s.actual)}</span>
                        <div style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, fontVariantNumeric: 'tabular-nums',
                          background: s.rem < 0 ? 'var(--danger)' : `color-mix(in oklch, ${s.color} 18%, transparent)`,
                          color: s.rem < 0 ? '#fff' : s.color,
                        }}>
                          {s.rem < 0 ? '−' : ''}{fmt(Math.abs(s.rem))} {s.remLabel}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Savings rate */}
                {income > 0 && (
                  <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase' }}>{tl('savingsRateLabel')}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', color: savingsPct >= 20 ? '#4ade80' : savingsPct >= 10 ? '#d29922' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                        {savingsPct.toFixed(0)}%
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{tl('savingsRateTarget')}</span>
                    </div>
                    <div style={{ position: 'relative', height: 5, background: 'var(--bg-surface)', borderRadius: 99, overflow: 'visible' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, savingsPct)}%`, background: savingsPct >= 20 ? '#4ade80' : savingsPct >= 10 ? '#d29922' : 'var(--danger)', borderRadius: 99, transition: 'width .3s' }} />
                      <div style={{ position: 'absolute', top: -3, bottom: -3, left: '20%', width: 2, background: 'rgba(255,255,255,0.35)', borderRadius: 1 }} />
                    </div>
                  </div>
                )}

                {/* Configuratore investimenti */}
                {investLeafCats.length > 0 && (
                  <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 12, textTransform: 'uppercase' }}>{tl('investCardTitle')}</div>

                    {/* % del reddito */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 10px', borderRadius: 9, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{tl('investPctLabel')}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--bg-elevated)', borderRadius: 7, padding: '3px 8px', border: '1px solid var(--border-subtle)' }}>
                        <input
                          type="number" min={0} max={100} step={1} value={investPct}
                          onChange={(e) => setMonthPlanInvestConfig(month, Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)), investCatAlloc)}
                          style={{ width: 36, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)' }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>%</span>
                      </div>
                      {investPct > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {fmt(income * investPct / 100)}
                        </span>
                      )}
                    </div>

                    {/* Ripartizione per categoria */}
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 10, textTransform: 'uppercase' }}>{tl('investSplitLabel')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                      {investLeafCats.map((cat) => {
                        const pct = investCatAlloc[cat.id] ?? 0
                        const amt = Math.round(income * investPct / 100 * pct / 100)
                        return (
                          <div key={cat.id}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                              <span style={{ fontSize: 14, flexShrink: 0 }}>{cat.emoji}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--bg-surface)', borderRadius: 6, padding: '2px 7px', border: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                                <input
                                  type="number" min={0} max={100} step={1} value={pct}
                                  onChange={(e) => adjustInvestAlloc(cat.id, parseFloat(e.target.value) || 0)}
                                  style={{ width: 38, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)' }}
                                />
                                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>%</span>
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 54, textAlign: 'right' }}>
                                {investPct > 0 ? fmt(amt) : '—'}
                              </span>
                            </div>
                            <div style={{ height: 3, background: 'var(--bg-surface)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: cat.color || 'var(--accent)', borderRadius: 99, transition: 'width .2s' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Totale % + bottone Applica */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: investTotalPct === 100 ? '#4ade80' : 'var(--warning)' }}>
                        {investTotalPct === 100 ? tl('investTotalOk') : tl('investTotalWarn', { pct: investTotalPct })}
                      </span>
                      <button
                        onClick={applyInvestConfig}
                        disabled={investTotalPct !== 100 || investPct === 0}
                        style={{
                          background: investTotalPct === 100 && investPct > 0 ? 'var(--accent)' : 'var(--bg-surface)',
                          color: investTotalPct === 100 && investPct > 0 ? 'var(--text-on-accent)' : 'var(--text-tertiary)',
                          border: '1px solid var(--border-subtle)', borderRadius: 9, padding: '6px 16px', fontSize: 12, fontWeight: 700,
                          cursor: investTotalPct === 100 && investPct > 0 ? 'pointer' : 'default',
                        }}
                      >
                        {tl('investApplyBtn')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Diagnostica */}
                {diagnostica.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase' }}>{tl('diagLabel')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {diagnostica.map((d, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', borderRadius: 10,
                          background: d.type === 'warning' ? 'color-mix(in oklch, var(--warning) 12%, transparent)' : 'color-mix(in oklch, #58a6ff 10%, transparent)',
                          border: `1px solid ${d.type === 'warning' ? 'color-mix(in oklch, var(--warning) 28%, transparent)' : 'color-mix(in oklch, #58a6ff 25%, transparent)'}`,
                        }}>
                          <span style={{ fontSize: 12, marginTop: 1 }}>{d.type === 'warning' ? '⚠' : 'ℹ'}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: d.type === 'warning' ? 'var(--warning)' : '#58a6ff', lineHeight: 1.4 }}>{d.msg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Confronto tab ─────────────────────── */}
            {activeTab === 'confronto' && (
              <div style={{ padding: '18px 22px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 18 }}>
                  {tl('comparisonTitle')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                  {expenseBudgetGroups.map((group) => {
                    const monthAmounts = last6Months.map((m) => spentByGroupByMonth[m]?.[group.id] ?? 0)
                    const curAmt  = monthAmounts[5]
                    const prevAmt = monthAmounts[4]
                    const maxAmt  = Math.max(...monthAmounts, 1)
                    const delta   = prevAmt > 0 ? ((curAmt - prevAmt) / prevAmt) * 100 : null
                    return (
                      <div key={group.id}>
                        {/* Group header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{group.label}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(curAmt)}</span>
                          {delta !== null && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: delta <= 0 ? 'var(--success)' : 'var(--danger)', minWidth: 40, textAlign: 'right' }}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
                            </span>
                          )}
                        </div>
                        {/* 6-month tile grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
                          {last6Months.map((m, i) => {
                            const amt        = monthAmounts[i]
                            const isCurrent  = m === month
                            const intensity  = maxAmt > 0 ? Math.max(0.12, amt / maxAmt) : 0
                            const mLabel     = fmtMonthShort(new Date(m + '-01T12:00:00'))
                            return (
                              <div key={m} style={{ textAlign: 'center' }}>
                                <div style={{
                                  height: 38, borderRadius: 8, marginBottom: 5,
                                  background: amt > 0
                                    ? `color-mix(in oklch, ${group.color} ${Math.round(intensity * 100)}%, var(--bg-elevated))`
                                    : 'var(--bg-elevated)',
                                  outline: isCurrent ? `2px solid ${group.color}` : 'none',
                                  outlineOffset: isCurrent ? 1 : 0,
                                }} />
                                <div style={{ fontSize: 9, fontVariantNumeric: 'tabular-nums', color: isCurrent ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: isCurrent ? 700 : 400 }}>
                                  {mLabel}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Money flow tab ───────────────────── */}
            {activeTab === 'moneyflow' && (
              <div style={{ padding: '18px 22px' }}>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{tl('moneyFlowTitle')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{tl('moneyFlowDesc', { income: income > 0 ? fmt(income) : '—' })}</div>
                </div>
                {income > 0 ? (<>
                  <div style={{ height: 22, background: 'var(--bg-elevated)', borderRadius: 8, overflow: 'hidden', display: 'flex', marginBottom: 18 }}>
                    {[
                      { key: 'needs',       color: '#f85149' },
                      { key: 'lifestyle',   color: '#d29922' },
                      { key: 'finance',     color: '#7c6df7' },
                      { key: 'investments', color: '#5bc8d0' },
                    ].map((g) => {
                      const amt = leafExpenseCats.filter((c) => c.group === g.key).reduce((s, c) => s + getCatBudget(c.id), 0)
                      const pct = (amt / income) * 100
                      return pct > 0 ? <div key={g.key} style={{ width: `${pct}%`, background: g.color, flexShrink: 0 }} /> : null
                    })}
                    {totalGoalContrib > 0 && <div style={{ width: `${(totalGoalContrib / income) * 100}%`, background: '#a78bfa', flexShrink: 0 }} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { key: 'needs',       label: tl('flowNeeds'),       color: '#f85149' },
                      { key: 'lifestyle',   label: tl('flowLifestyle'),   color: '#d29922' },
                      { key: 'finance',     label: tl('flowFinances'),    color: '#7c6df7' },
                      { key: 'investments', label: tl('flowInvestments'), color: '#5bc8d0' },
                    ].map((g) => {
                      const amt = leafExpenseCats.filter((c) => c.group === g.key).reduce((s, c) => s + getCatBudget(c.id), 0)
                      const pct = income > 0 ? (amt / income) * 100 : 0
                      return (
                        <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                          <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{g.label}</div>
                          <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmt(amt)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(0)}%</div>
                        </div>
                      )
                    })}
                    {totalGoalContrib > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#a78bfa', flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{tl('flowGoals')}</div>
                        <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmt(totalGoalContrib)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(totalGoalContrib / income * 100).toFixed(0)}%</div>
                      </div>
                    )}
                    {available > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)' }}>{tl('flowUnallocated')}</div>
                        <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--text-tertiary)' }}>{fmt(available)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(available / income * 100).toFixed(0)}%</div>
                      </div>
                    )}
                  </div>
                </>) : (
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: 20 }}>
                    {tl('flowNoIncome')}
                  </div>
                )}
              </div>
            )}

            {/* ── Dove vanno i tuoi soldi tab ──────── */}
            {activeTab === 'dovevanno' && (
              <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Entrate anchor */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Entrate pianificate</span>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--success)' }}>{fmt(income)}</span>
                </div>

                {/* Group rows with mini-bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {summaryGroups.map((g) => {
                    const amt = leafExpenseCats.filter((c) => c.group === g.key).reduce((s, c) => s + getCatBudget(c.id), 0)
                    const pct = income > 0 ? (amt / income) * 100 : 0
                    const delta = pct - g.target
                    const isOver = delta > 3
                    const isUnder = delta < -3
                    const tagColor = isOver ? 'var(--danger)' : isUnder ? 'var(--text-tertiary)' : 'var(--success)'
                    const tagBg = isOver ? 'color-mix(in oklch, var(--danger) 12%, transparent)' : isUnder ? 'var(--bg-elevated)' : 'color-mix(in oklch, var(--success) 12%, transparent)'
                    return (
                      <div key={g.key}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 700, fontSize: 12 }}>{g.label}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 5 }}>{g.desc}</span>
                          </div>
                          <span style={{ fontWeight: 800, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmt(amt)}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: tagBg, color: tagColor, border: `1px solid ${tagColor}40`, whiteSpace: 'nowrap' }}>
                            {pct.toFixed(0)}%/{g.target}%
                          </span>
                        </div>
                        {income > 0 && (
                          <div style={{ position: 'relative', height: 4, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'visible' }}>
                            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: g.color, borderRadius: 4, opacity: 0.85 }} />
                            <div style={{ position: 'absolute', top: -2, left: `${Math.min(g.target, 100)}%`, width: 2, height: 8, background: g.color, borderRadius: 1, opacity: 0.5 }} />
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Goals */}
                  {goals.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f77c3a', flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: 12, flex: 1 }}>Goal mensili</span>
                        <span style={{ fontWeight: 800, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmt(totalGoalContrib)}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 16 }}>
                        {goals.map((goal) => {
                          const goalPct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0
                          return (
                            <div key={goal.id}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                <span style={{ fontSize: 12 }}>{goal.icon}</span>
                                <span style={{ fontSize: 11, flex: 1, fontWeight: 600 }}>{goal.name}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(goal.monthlyContribution ?? 0)}/mese</span>
                              </div>
                              <div style={{ height: 3, background: 'var(--bg-elevated)', borderRadius: 2 }}>
                                <div style={{ height: '100%', width: `${goalPct}%`, background: goal.color, borderRadius: 2 }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Saldo libero */}
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '14px 0' }} />
                {(() => {
                  const free = income - leafExpenseCats.reduce((s, c) => s + getCatBudget(c.id), 0) - totalGoalContrib
                  const freePct = income > 0 ? (free / income) * 100 : 0
                  const isPos = free >= 0
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13 }}>{isPos ? '✓' : '⚠'}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>Saldo libero</div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{allocPct}% allocato</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: isPos ? 'var(--success)' : 'var(--danger)' }}>
                          {isPos ? '+' : ''}{fmt(free)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{freePct.toFixed(0)}% del reddito</div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

          </div>{/* end right card */}
        </div>{/* end DA ASSEGNARE col 2 */}

      </div>{/* end 2-col layout */}

    </div>
  )
}
