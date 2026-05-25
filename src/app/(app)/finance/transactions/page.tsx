'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useFinanceStore } from '@/stores/financeStore'
import { useUIStore } from '@/stores/uiStore'
import { useFormatters } from '@/hooks/useFormatters'
import BarChart from '@/components/charts/BarChart'
import Icon from '@/components/shared/Icon'
import { CategoryPicker } from '@/components/shared/CategoryPicker'
import MerchantInput from '@/components/shared/MerchantInput'
import type { Transaction } from '@/types'

// ── shared helpers ────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)',
  background: 'var(--bg-elevated)', color: 'var(--text-primary)', width: '100%',
  boxSizing: 'border-box', fontSize: 13,
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 5,
}

function DeleteConfirmModal({ message, onConfirm, onCancel, title, cancelLabel, deleteLabel }: { message: string; onConfirm: () => void; onCancel: () => void; title: string; cancelLabel: string; deleteLabel: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '28px 32px', width: 380, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="ledgernest-btn ledgernest-btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button
            className="ledgernest-btn"
            style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '8px 18px', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}
            onClick={onConfirm}
          >
            {deleteLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditMovementModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const tl = useTranslations('movimenti')
  const { updateTransaction, accounts } = useFinanceStore()
  const [date, setDate] = useState(tx.date)
  const [description, setDescription] = useState(tx.description)
  const [amount, setAmount] = useState(String(tx.amount))
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>(tx.type)
  const [category, setCategory] = useState(tx.category)
  const [accountId, setAccountId] = useState(tx.accountId)
  const [merchant, setMerchant] = useState(tx.merchant ?? '')
  const [note, setNote] = useState(tx.note ?? '')
  const modalRef = useRef<HTMLDivElement>(null)

  function handleSave() {
    if (!description.trim() || !amount) return
    updateTransaction(tx.id, {
      date,
      description: description.trim(),
      merchant: merchant.trim() || undefined,
      amount: parseFloat(amount) || 0,
      type,
      category,
      accountId,
      note: note.trim() || undefined,
    })
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}
    >
      <div ref={modalRef} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 28, width: 480, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{tl('editTitle')}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Type */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['expense', 'income', 'transfer'] as const).map((typ) => {
            const colors = { expense: 'var(--danger)', income: 'var(--success)', transfer: 'var(--accent)' }
            const labels = { expense: tl('typeExpense'), income: tl('typeIncome'), transfer: tl('typeTransfer') }
            const c = colors[typ]
            return (
              <button key={typ} onClick={() => { setType(typ); setCategory('') }} style={{
                flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid',
                borderColor: type === typ ? c : 'var(--border-subtle)',
                background: type === typ ? `color-mix(in oklch, ${c} 15%, transparent)` : 'transparent',
                color: type === typ ? c : 'var(--text-secondary)',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>
                {labels[typ]}
              </button>
            )
          })}
        </div>

        {/* Description */}
        <div>
          <div style={labelStyle}>{tl('editDescription')}</div>
          <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
        </div>

        {/* Merchant */}
        <div>
          <div style={labelStyle}>{tl('editMerchant')}</div>
          <MerchantInput value={merchant} onChange={setMerchant} />
        </div>

        {/* Amount + Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={labelStyle}>{tl('editAmount')}</div>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>{tl('editDate')}</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Category */}
        <div>
          <div style={labelStyle}>{tl('editCategory')}</div>
          <CategoryPicker
            value={category}
            onChange={setCategory}
            typeFilter={type === 'transfer' ? 'all' : type}
            containerRef={modalRef}
          />
        </div>

        {/* Account */}
        {accounts.length > 0 && (
          <div>
            <div style={labelStyle}>{tl('editAccount')}</div>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inputStyle}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}

        {/* Note */}
        <div>
          <div style={labelStyle}>{tl('editNote')}</div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tl('editOptional')} style={inputStyle} />
        </div>

        <button
          onClick={handleSave}
          className="ledgernest-btn ledgernest-btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          disabled={!description.trim()}
        >
          {tl('editSave')}
        </button>
      </div>
    </div>
  )
}

// ── constants ─────────────────────────────────────────────────

const WINDOW = 28
const IT_MON = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

// Maps portfolio asset-type keys → budget category names
const ASSET_CAT_ALIAS: Record<string, string> = {
  stock: 'Azioni', etf: 'ETF', crypto: 'Crypto',
  bond: 'Obbligazioni', commodity: 'Materie prime',
}

function catEmoji(cat: string, budgetCats: { id?: string; name: string; emoji: string }[]): string {
  const resolved = ASSET_CAT_ALIAS[cat.toLowerCase()] ?? cat
  return budgetCats.find((c) => c.id === cat || c.name.toLowerCase() === resolved.toLowerCase())?.emoji ?? '📋'
}
function catColor(cat: string, budgetCats: { id?: string; name: string; color: string }[]): string {
  const resolved = ASSET_CAT_ALIAS[cat.toLowerCase()] ?? cat
  return budgetCats.find((c) => c.id === cat || c.name.toLowerCase() === resolved.toLowerCase())?.color ?? '#8b949e'
}

function fmtGroupDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getDate()} ${IT_MON[d.getMonth()].toUpperCase()}`
}

const FREQ_OPTS = [
  { value: 'daily',     labelKey: 'freqDaily' },
  { value: 'weekly',    labelKey: 'freqWeekly' },
  { value: 'biweekly',  labelKey: 'freqBiweekly' },
  { value: 'monthly',   labelKey: 'freqMonthly' },
  { value: 'quarterly', labelKey: 'freqQuarterly' },
  { value: 'yearly',    labelKey: 'freqYearly' },
]

function nextMonthSameDay(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

type TxSnap = { id: string; description: string; amount: number; type: string; category: string; accountId: string }

function AddAsRecurringModal({ tx, onClose }: { tx: TxSnap; onClose: () => void }) {
  const tl = useTranslations('movimenti')
  const tr = useTranslations('ricorrenti')
  const { addRecurring } = useFinanceStore()
  const [name, setName] = useState(tx.description)
  const [amount, setAmount] = useState(String(tx.amount))
  const [frequency, setFrequency] = useState('monthly')
  const [nextDate, setNextDate] = useState(nextMonthSameDay)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addRecurring({ name, amount: parseFloat(amount) || 0, type: (tx.type === 'income' ? 'income' : 'expense') as 'income' | 'expense', frequency: frequency as 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly', nextDate, category: tx.category, accountId: tx.accountId, active: true, emoji: '' })
    onClose()
  }

  return (
    <div className="ledgernest-modal-overlay">
      <div className="ledgernest-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ledgernest-modal-header">
          <span className="ledgernest-modal-title">{tl('recurringTitle')}</span>
          <button className="ledgernest-modal-close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="ledgernest-modal-body">
            <div className="ledgernest-field">
              <label className="ledgernest-label">{tl('recurringName')}</label>
              <input className="ledgernest-input" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="ledgernest-field">
                <label className="ledgernest-label">{tl('recurringAmount')}</label>
                <input className="ledgernest-input ledgernest-mono" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div className="ledgernest-field">
                <label className="ledgernest-label">{tl('recurringFrequency')}</label>
                <select className="ledgernest-input ledgernest-select" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  {FREQ_OPTS.map((o) => <option key={o.value} value={o.value}>{tr(o.labelKey as Parameters<typeof tr>[0])}</option>)}
                </select>
              </div>
            </div>
            <div className="ledgernest-field">
              <label className="ledgernest-label">{tl('recurringNextDate')}</label>
              <input className="ledgernest-input" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
            </div>
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-elevated)', fontSize: 12, color: 'var(--text-secondary)' }}>
              {tl('recurringCategory')} <strong style={{ color: 'var(--text-primary)' }}>{tx.category}</strong>
            </div>
          </div>
          <div className="ledgernest-modal-footer">
            <button type="button" className="ledgernest-btn ledgernest-btn-ghost" onClick={onClose}>{tl('cancel')}</button>
            <button type="submit" className="ledgernest-btn ledgernest-btn-primary">{tl('recurringAdd')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tx row kebab ──────────────────────────────────────────────

type TxActions = {
  onAddRecurring: () => void
  onEdit: () => void
  onDelete: () => void
}

function TxRowMenu({ actions }: { actions: TxActions }) {
  const tl = useTranslations('movimenti')
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen((v) => !v)
  }

  const menuItem: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '7px 12px', borderRadius: 7, border: 'none', background: 'none',
    cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
  }

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
      >
        <Icon name="kebab" size={15} />
      </button>
      {open && (
        <div ref={menuRef} style={{ position: 'fixed', top: pos.top, right: pos.right, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 4, minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.45)', zIndex: 9999 }}>
          <button onClick={() => { setOpen(false); actions.onAddRecurring() }} style={{ ...menuItem, color: 'var(--text-primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
            {tl('menuRecurring')}
          </button>
          <button onClick={() => { setOpen(false); actions.onEdit() }} style={{ ...menuItem, color: 'var(--text-primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
            <Icon name="edit" size={13} /> {tl('menuEdit')}
          </button>
          <button onClick={() => { setOpen(false); actions.onDelete() }} style={{ ...menuItem, color: 'var(--danger)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in oklch, var(--danger) 10%, transparent)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
            <Icon name="trash" size={13} /> {tl('menuDelete')}
          </button>
        </div>
      )}
    </div>
  )
}

// ── types ─────────────────────────────────────────────────────

type TxFilter = 'all' | 'income' | 'expense' | 'transfer' | 'invest'

const INVEST_CATS = new Set(Object.values(ASSET_CAT_ALIAS))

// ── page ──────────────────────────────────────────────────────

export default function MovimentiPage() {
  const tl = useTranslations('movimenti')
  const { fmt } = useFormatters()
  const { transactions, accounts, budgetCategories, budgetGroups, monthlyIncome, monthlyExpenses, deleteTransaction, merchantLogos } = useFinanceStore()
  const { openModal } = useUIStore()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TxFilter>('all')
  const [addingRecurring, setAddingRecurring] = useState<TxSnap | null>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null)

  const FILTERS: Array<[TxFilter, string]> = [
    ['all',      tl('filterAll')],
    ['income',   tl('filterIncome')],
    ['expense',  tl('filterExpense')],
    ['transfer', tl('filterTransfer')],
    ['invest',   tl('filterInvest')],
  ]

  const today = new Date().toISOString().slice(0, 10)
  const since = new Date(Date.now() - WINDOW * 86_400_000).toISOString().slice(0, 10)
  const currentMonth = today.slice(0, 7)
  const currentMonthLabel = IT_MON[new Date().getMonth()].toLowerCase()

  // ── 28-day window ──────────────────────────────────────────
  const txs28 = useMemo(
    () => transactions.filter((tx) => tx.date.slice(0, 10) >= since),
    [transactions, since]
  )

  // ── KPIs ───────────────────────────────────────────────────
  const income28  = useMemo(() => txs28.filter((tx) => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0), [txs28])
  const expense28 = useMemo(() => txs28.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0), [txs28])
  const saldo28   = income28 - expense28
  const incCount  = txs28.filter((tx) => tx.type === 'income').length
  const expCount  = txs28.filter((tx) => tx.type === 'expense').length

  const incCats = useMemo(() => {
    const map: Record<string, number> = {}
    for (const tx of txs28) if (tx.type === 'income') map[tx.category] = (map[tx.category] ?? 0) + tx.amount
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k.toLowerCase())
  }, [txs28])

  const topCat = useMemo(() => {
    const map: Record<string, number> = {}
    for (const tx of txs28) if (tx.type === 'expense') map[tx.category] = (map[tx.category] ?? 0) + tx.amount
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1])
    if (!entries.length) return null
    const [name, val] = entries[0]
    return { name, val, pct: expense28 > 0 ? (val / expense28) * 100 : 0 }
  }, [txs28, expense28])

  // ── 6-month bar chart ──────────────────────────────────────
  const cashflowData = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (5 - i))
      const m = d.toISOString().slice(0, 7)
      return { label: IT_MON[d.getMonth()], income: monthlyIncome(m), expense: monthlyExpenses(m) }
    }),
  [transactions]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── group breakdown (current month) ────────────────────────
  const catBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    for (const tx of transactions) {
      if (tx.date.slice(0, 7) !== currentMonth || tx.type !== 'expense') continue
      const cat = budgetCategories.find((c) => c.name === tx.category || c.id === tx.category)
      const groupId = cat?.group ?? 'other'
      map[groupId] = (map[groupId] ?? 0) + tx.amount
    }
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([gid, val]) => {
        const group = budgetGroups.find((g) => g.id === gid)
        return { name: group?.label ?? 'Altro', val, pct: total > 0 ? (val / total) * 100 : 0, color: group?.color ?? '#8b949e' }
      })
  }, [transactions, currentMonth, budgetCategories, budgetGroups])

  // ── filtered + grouped ────────────────────────────────────
  const filtered = useMemo(() => txs28.filter((tx) => {
    const q = search.toLowerCase()
    if (q) {
      const inDesc     = tx.description.toLowerCase().includes(q)
      const inMerchant = (tx.merchant ?? '').toLowerCase().includes(q)
      const inCat      = tx.category.toLowerCase().includes(q)
      if (!inDesc && !inMerchant && !inCat) return false
    }
    if (typeFilter === 'income')   return tx.type === 'income'
    if (typeFilter === 'expense')  return tx.type === 'expense' && !INVEST_CATS.has(tx.category)
    if (typeFilter === 'transfer') return tx.type === 'transfer'
    if (typeFilter === 'invest')   return tx.type === 'expense' && INVEST_CATS.has(tx.category)
    return true
  }), [txs28, search, typeFilter])

  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {}
    for (const tx of filtered) {
      const key = tx.date.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(tx)
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? ''
  const accountCount = new Set(txs28.map((tx) => tx.accountId)).size

  return (
    <div className="ledgernest-gap-5">

      {/* KPI strip */}
      <div className="ledgernest-fin-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>

        <div className="ledgernest-kpi is-hl" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
            {tl('kpiIncome', { window: WINDOW })}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {fmt(income28)}
          </div>
          <div style={{ fontSize: 12 }}>
            <span style={{ fontWeight: 600, color: 'var(--success)' }}>{incCount} {tl('kpiMovements')}</span>
            {incCats.length > 0 && (
              <span style={{ color: 'var(--text-secondary)' }}> · {incCats.join(' + ')}</span>
            )}
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
            {tl('kpiExpense', { window: WINDOW })}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {fmt(expense28)}
          </div>
          <div style={{ fontSize: 12 }}>
            <span style={{ fontWeight: 600, color: 'var(--danger)' }}>{expCount} {tl('kpiMovements')}</span>
            <span style={{ color: 'var(--text-secondary)' }}> · {tl('kpiInclInvest')}</span>
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
            {tl('kpiBalance')}
          </div>
          <div style={{
            fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
            color: saldo28 >= 0 ? 'var(--success)' : 'var(--danger)',
          }}>
            {saldo28 >= 0 ? '+' : ''}{fmt(saldo28)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600, color: saldo28 >= 0 ? 'var(--success)' : 'var(--danger)' }}>{tl('kpiSavings')}</span>
            {' · '}{tl('kpiLastDays', { window: WINDOW })}
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
            {tl('kpiTopCat')}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {topCat?.name ?? '—'}
          </div>
          {topCat ? (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(topCat.val)}</span>
              {' · '}{topCat.pct.toFixed(0)}% {tl('kpiPctExpenses')}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{tl('kpiNoExpense')}</div>
          )}
        </div>

      </div>

      {/* Chart + Category breakdown */}
      <div className="ledgernest-fin-charts" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>

        <div className="ledgernest-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{tl('chartTitle')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{tl('chartSubtitle')}</div>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 12, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                {tl('chartIncome')}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />
                {tl('chartExpense')}
              </span>
            </div>
          </div>
          <BarChart data={cashflowData} paired formatValue={fmt} height={160} />
        </div>

        <div className="ledgernest-card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
            {tl('breakdownTitle', { month: currentMonthLabel })}.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 18 }}>{tl('breakdownSubtitle')}</div>
          {catBreakdown.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: 24 }}>
              {tl('breakdownEmpty')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {catBreakdown.slice(0, 8).map(({ name, pct, color }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 90, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </div>
                  <div style={{ flex: 1, height: 7, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: color, transition: 'width .4s ease' }} />
                  </div>
                  <div style={{ width: 40, fontSize: 12, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)' }}>
                    {pct.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Transaction list */}
      <div className="ledgernest-card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          padding: '14px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid var(--border-subtle)',
          flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {tl('listTitle', { n: filtered.length })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {tl('listTitleFiltered', { window: WINDOW, n: accountCount })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="ledgernest-input"
              placeholder={tl('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 230, height: 32, padding: '4px 12px', fontSize: 12 }}
            />
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 10, padding: 3 }}>
              {FILTERS.map(([val, label]) => (
                <button key={val} onClick={() => setTypeFilter(val)} style={{
                  padding: '4px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                  border: 'none', cursor: 'pointer',
                  background: typeFilter === val ? 'var(--bg-surface)' : 'transparent',
                  color: typeFilter === val ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: typeFilter === val ? '0 1px 4px rgba(0,0,0,.25)' : 'none',
                  whiteSpace: 'nowrap',
                }}>{label}</button>
              ))}
            </div>
            <button className="ledgernest-btn ledgernest-btn-primary ledgernest-btn-sm"
              onClick={() => openModal('movement')}>
              <Icon name="plus" size={13} /> Nuovo
            </button>
          </div>
        </div>

        {/* Grouped rows */}
        {grouped.length === 0 ? (
          <div className="ledgernest-empty" style={{ padding: '48px 20px' }}>
            <div className="ledgernest-empty-icon">📋</div>
            <div>{tl('emptyTitle')}</div>
            <button className="ledgernest-btn ledgernest-btn-primary" onClick={() => openModal('movement')}>
              <Icon name="plus" size={14} /> {tl('emptyAdd')}
            </button>
          </div>
        ) : (
          grouped.map(([date, txs]) => {
            const daySum = txs.reduce((s, tx) => s + (tx.type === 'income' ? tx.amount : -tx.amount), 0)
            return (
              <div key={date}>
                {/* Date header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 20px 6px',
                  borderTop: '1px solid var(--border-subtle)',
                  background: 'var(--bg-elevated)',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
                    {fmtGroupDate(date)}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: daySum >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {daySum >= 0 ? '+' : ''}{fmt(daySum)}
                  </span>
                </div>

                {/* Transaction rows */}
                {txs.map((tx) => {
                  const emoji = catEmoji(tx.category, budgetCategories)
                  const color = catColor(tx.category, budgetCategories)
                  const acct = accountName(tx.accountId)
                  const logo = tx.merchant ? merchantLogos[tx.merchant] : undefined
                  return (
                    <div
                      key={tx.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 20px',
                        borderTop: '1px solid var(--border-subtle)',
                        transition: 'background .1s',
                        cursor: 'default',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      {/* Merchant logo or category emoji */}
                      <div style={{
                        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                        background: logo ? 'var(--bg-elevated)' : `${color}22`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, overflow: 'hidden',
                      }}>
                        {logo
                          ? <img src={logo} alt="" style={{ width: 26, height: 26, objectFit: 'contain', borderRadius: 4 }} />
                          : emoji}
                      </div>

                      {/* Description + meta */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.merchant || tx.description}
                        </div>
                        {tx.merchant && tx.merchant !== tx.description && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.description}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {tx.category}{acct && <span> · {acct}</span>}
                        </div>
                      </div>

                      {/* Category label */}
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        {tx.category}
                      </span>

                      {/* Amount */}
                      <div style={{
                        fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums',
                        color: tx.type === 'income' ? 'var(--success)' : 'var(--text-primary)',
                        flexShrink: 0, minWidth: 80, textAlign: 'right',
                      }}>
                        {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
                      </div>

                      {/* Kebab — always visible, always last */}
                      <TxRowMenu actions={{
                        onAddRecurring: () => setAddingRecurring(tx),
                        onEdit: () => setEditingTx(transactions.find((tx2) => tx2.id === tx.id) ?? null),
                        onDelete: () => setDeletingTxId(tx.id),
                      }} />
                    </div>
                  )
                })}
              </div>
            )
          })
        )}

      </div>

      {addingRecurring && (
        <AddAsRecurringModal tx={addingRecurring} onClose={() => setAddingRecurring(null)} />
      )}
      {editingTx && (
        <EditMovementModal tx={editingTx} onClose={() => setEditingTx(null)} />
      )}
      {deletingTxId && (
        <DeleteConfirmModal
          title={tl('deleteTitle')}
          message={tl('deleteMessage', { description: transactions.find((tx) => tx.id === deletingTxId)?.description ?? '' })}
          cancelLabel={tl('cancel')}
          deleteLabel={tl('delete')}
          onConfirm={() => { deleteTransaction(deletingTxId); setDeletingTxId(null) }}
          onCancel={() => setDeletingTxId(null)}
        />
      )}
    </div>
  )
}
