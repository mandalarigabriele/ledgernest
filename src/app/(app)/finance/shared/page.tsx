'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useFinanceStore } from '@/stores/financeStore'
import Icon from '@/components/shared/Icon'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SharedExpense {
  id: string
  group_id: string
  payer_email: string
  amount: number
  currency: string
  description: string
  category: string | null
  date: string
  other_share: number
  notes: string | null
  created_at: string
}

interface Settlement {
  id: string
  group_id: string
  from_email: string
  to_email: string
  amount: number
  currency: string
  date: string
  notes: string | null
  created_at: string
}

interface Balance {
  balance: number
  partnerOwesMe: number
  iOwePartner: number
  received: number
  paid: number
  totalShared: number
  currency: string
  partnerEmail: string
}

// ── Style constants ───────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)',
  background: 'var(--bg-elevated)', color: 'var(--text-primary)', width: '100%',
  boxSizing: 'border-box', fontSize: 13,
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 5,
}
const cardStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
  borderRadius: 16, padding: '24px 28px',
}

function fmt(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function shortEmail(email: string) {
  return email.split('@')[0]
}

// ── Add Expense Modal ─────────────────────────────────────────────────────────

function AddExpenseModal({
  myEmail,
  partnerEmail,
  expense,
  onClose,
  onSaved,
}: {
  myEmail: string
  partnerEmail: string
  expense?: SharedExpense
  onClose: () => void
  onSaved: () => void
}) {
  const { budgetCategories } = useFinanceStore()
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [date, setDate] = useState(expense?.date ?? new Date().toISOString().slice(0, 10))
  const [payerEmail, setPayerEmail] = useState(expense?.payer_email ?? myEmail)
  const [otherShare, setOtherShare] = useState(expense ? String(Math.round(expense.other_share * 100)) : '50')
  const [category, setCategory] = useState(expense?.category ?? '')
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const expenseCategories = budgetCategories.filter(
    (c) => !c.parentId && (c.type === 'expense' || !c.type)
  )

  async function handleSave() {
    if (!description.trim()) { setError('Description is required'); return }
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError('Amount must be a positive number'); return }
    setSaving(true); setError('')
    const share = Math.min(1, Math.max(0, parseFloat(otherShare) / 100))
    const body = { amount: amt, description: description.trim(), date, payerEmail, otherShare: share, category: category || null, notes: notes.trim() || null }
    const url = expense ? `/api/shared-expenses/${expense.id}` : '/api/shared-expenses'
    const method = expense ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed to save'); return }
    onSaved()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '28px 32px', width: 440, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{expense ? 'Edit Shared Expense' : 'Add Shared Expense'}</div>
          <button className="ledgernest-icon-btn" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={labelStyle}>Description</div>
            <input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Grocery shopping" autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={labelStyle}>Amount (€)</div>
              <input style={inputStyle} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <div style={labelStyle}>Date</div>
              <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <div style={labelStyle}>Paid by</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[myEmail, partnerEmail].map((email) => (
                <button
                  key={email}
                  onClick={() => setPayerEmail(email)}
                  style={{
                    flex: 1, padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${payerEmail === email ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    background: payerEmail === email ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'transparent',
                    color: payerEmail === email ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'all .15s',
                  }}
                >
                  {email === myEmail ? 'Me' : shortEmail(email)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={labelStyle}>Split — other person pays {otherShare}%</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range" min={0} max={100} step={5} value={otherShare}
                onChange={(e) => setOtherShare(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                style={{ ...inputStyle, width: 70, textAlign: 'center' }}
                type="number" min={0} max={100} value={otherShare}
                onChange={(e) => setOtherShare(e.target.value)}
              />
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>%</span>
            </div>
          </div>

          <div>
            <div style={labelStyle}>Category (optional)</div>
            <select
              style={{ ...inputStyle, appearance: 'none' }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">— none —</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.name}>{c.emoji ? `${c.emoji} ` : ''}{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={labelStyle}>Notes (optional)</div>
            <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any details…" />
          </div>
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="ledgernest-btn ledgernest-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="ledgernest-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : (expense ? 'Save Changes' : 'Add Expense')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Settle Up Modal ───────────────────────────────────────────────────────────

function SettleUpModal({
  balance,
  myEmail,
  partnerEmail,
  accounts,
  onClose,
  onSaved,
}: {
  balance: number
  myEmail: string
  partnerEmail: string
  accounts: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const { addTransaction } = useFinanceStore()
  const absBalance = Math.abs(balance)
  // If balance > 0, partner owes me → fromEmail = partnerEmail
  // If balance < 0, I owe partner → fromEmail = myEmail
  const defaultFrom = balance >= 0 ? partnerEmail : myEmail
  const [amount, setAmount] = useState(String(absBalance.toFixed(2)))
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [fromEmail, setFromEmail] = useState(defaultFrom)
  const [autoRecord, setAutoRecord] = useState(false)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const receiving = fromEmail !== myEmail // partner is paying me

  async function handleSave() {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError('Amount must be a positive number'); return }
    setSaving(true); setError('')

    const res = await fetch('/api/settlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt, date, fromEmail, notes: notes.trim() || null }),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); setSaving(false); return }

    if (autoRecord && accountId) {
      const type = receiving ? 'income' : 'expense'
      addTransaction({
        date,
        description: receiving ? `Reimbursement from ${shortEmail(partnerEmail)}` : `Reimbursement to ${shortEmail(partnerEmail)}`,
        amount: amt,
        type,
        category: receiving ? 'Income' : 'Transfer',
        accountId,
        note: notes.trim() || `Shared expense settlement`,
      })
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: '28px 32px', width: 420, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Settle Up</div>
          <button className="ledgernest-icon-btn" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={labelStyle}>Direction</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { from: partnerEmail, label: `${shortEmail(partnerEmail)} → Me` },
                { from: myEmail, label: `Me → ${shortEmail(partnerEmail)}` },
              ].map((opt) => (
                <button
                  key={opt.from}
                  onClick={() => setFromEmail(opt.from)}
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${fromEmail === opt.from ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    background: fromEmail === opt.from ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'transparent',
                    color: fromEmail === opt.from ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'all .15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={labelStyle}>Amount (€)</div>
              <input style={inputStyle} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>Date</div>
              <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <div style={labelStyle}>Notes (optional)</div>
            <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Bank transfer" />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={autoRecord} onChange={(e) => setAutoRecord(e.target.checked)} />
            <span style={{ color: 'var(--text-secondary)' }}>
              Auto-create {receiving ? 'income' : 'expense'} transaction in my accounts
            </span>
          </label>

          {autoRecord && accounts.length > 0 && (
            <div>
              <div style={labelStyle}>Account</div>
              <select style={{ ...inputStyle, appearance: 'none' }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="ledgernest-btn ledgernest-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="ledgernest-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Record Settlement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Balance Card ──────────────────────────────────────────────────────────────

function BalanceCard({
  balance,
  loading,
  partnerEmail,
  myEmail,
  onAddExpense,
  onSettleUp,
}: {
  balance: Balance | null
  loading: boolean
  partnerEmail: string
  myEmail: string
  onAddExpense: () => void
  onSettleUp: () => void
}) {
  const absBalance = balance ? Math.abs(balance.balance) : 0
  const balanced = balance ? Math.abs(balance.balance) < 0.01 : true
  const partnerOwes = balance && balance.balance > 0.01

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>
            SHARED EXPENSES · {myEmail && partnerEmail ? `You & ${shortEmail(partnerEmail)}` : 'No partner paired'}
          </div>
          {loading ? (
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-tertiary)' }}>…</div>
          ) : balanced ? (
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)' }}>All settled up ✓</div>
          ) : partnerOwes ? (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>{shortEmail(partnerEmail)} owes you</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--success)' }}>{fmt(absBalance)}</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>You owe {shortEmail(partnerEmail)}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--danger)' }}>{fmt(absBalance)}</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="ledgernest-btn ledgernest-btn-ghost" onClick={onSettleUp} disabled={!partnerEmail}>
            <Icon name="check" size={14} />
            <span style={{ marginLeft: 6 }}>Settle Up</span>
          </button>
          <button className="ledgernest-btn" onClick={onAddExpense} disabled={!partnerEmail}>
            <Icon name="plus" size={14} />
            <span style={{ marginLeft: 6 }}>Add Expense</span>
          </button>
        </div>
      </div>

      {balance && !loading && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total shared</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{fmt(balance.totalShared)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>You paid</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{fmt(balance.partnerOwesMe / (balance.partnerOwesMe > 0 ? (balance.partnerOwesMe / balance.totalShared * 2) : 1) * 2 || 0)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Settlements received</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{fmt(balance.received)}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Expense Row ───────────────────────────────────────────────────────────────

function ExpenseRow({
  expense,
  myEmail,
  partnerEmail,
  onEdit,
  onDelete,
}: {
  expense: SharedExpense
  myEmail: string
  partnerEmail: string
  onEdit: (e: SharedExpense) => void
  onDelete: (id: string) => void
}) {
  const iPaid = expense.payer_email === myEmail
  const myShare = iPaid ? expense.amount * (1 - expense.other_share) : expense.amount * expense.other_share
  const partnerShare = expense.amount - myShare

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '90px 1fr auto auto', alignItems: 'center', gap: 12,
      padding: '14px 0', borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
        {fmtDate(expense.date)}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{expense.description}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {expense.category ? `${expense.category} · ` : ''}
          <span style={{ color: iPaid ? 'var(--success)' : 'var(--text-tertiary)' }}>
            {iPaid ? 'You paid' : `${shortEmail(partnerEmail)} paid`}
          </span>
          {' · '}
          <span style={{ fontWeight: 600 }}>{fmt(expense.amount)}</span>
          {' total'}
        </div>
        {expense.notes && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{expense.notes}</div>}
      </div>
      <div style={{ textAlign: 'right', minWidth: 100 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: iPaid ? 'var(--success)' : 'var(--danger)' }}>
          {iPaid ? '+' : '-'}{fmt(iPaid ? partnerShare : myShare)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
          your share: {fmt(myShare)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="ledgernest-icon-btn ledgernest-icon-btn--sm" onClick={() => onEdit(expense)} title="Edit">
          <Icon name="edit" size={14} />
        </button>
        <button className="ledgernest-icon-btn ledgernest-icon-btn--sm" onClick={() => onDelete(expense.id)} title="Delete"
          style={{ color: 'var(--danger)' }}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  )
}

// ── No Partner State ──────────────────────────────────────────────────────────

function NoPairState({ myEmail, onPaired }: { myEmail: string; onPaired: (partnerEmail: string) => void }) {
  const [partnerEmail, setPartnerEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handlePair() {
    if (!partnerEmail.trim()) { setError('Enter your partner\'s email'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/sharing-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerEmail: partnerEmail.trim() }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
    onPaired(partnerEmail.trim())
  }

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
        <Icon name="shared" size={28} />
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Set up expense sharing</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 360 }}>
          Enter your partner&apos;s email to start tracking shared expenses together.
          They need to be registered in the app (add their email to <code>ALLOWED_EMAILS</code>).
        </div>
      </div>
      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'left' }}>Your email: <strong>{myEmail}</strong></div>
        <input
          style={inputStyle}
          type="email"
          placeholder="partner@email.com"
          value={partnerEmail}
          onChange={(e) => setPartnerEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handlePair()}
        />
        {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
        <button className="ledgernest-btn" onClick={handlePair} disabled={saving}>
          {saving ? 'Pairing…' : 'Pair with partner'}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SharedPage() {
  const { data: session } = useSession()
  const { accounts } = useFinanceStore()
  const myEmail = session?.user?.email ?? ''

  const [partnerEmail, setPartnerEmail] = useState<string | null>(null)
  const [groupLoaded, setGroupLoaded] = useState(false)

  const [expenses, setExpenses] = useState<SharedExpense[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [balance, setBalance] = useState<Balance | null>(null)
  const [loading, setLoading] = useState(false)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editExpense, setEditExpense] = useState<SharedExpense | undefined>()
  const [showSettleUp, setShowSettleUp] = useState(false)
  const [showSettlements, setShowSettlements] = useState(false)

  const [filterPayer, setFilterPayer] = useState<'all' | 'me' | 'partner'>('all')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Load sharing group
  useEffect(() => {
    if (!myEmail) return
    fetch('/api/sharing-group')
      .then((r) => r.json())
      .then((d) => {
        setPartnerEmail(d.group?.partnerEmail ?? null)
        setGroupLoaded(true)
      })
  }, [myEmail])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [eRes, sRes, bRes] = await Promise.all([
      fetch('/api/shared-expenses'),
      fetch('/api/settlements'),
      fetch('/api/shared-expenses/balance'),
    ])
    const [eData, sData, bData] = await Promise.all([eRes.json(), sRes.json(), bRes.json()])
    setExpenses(eData.expenses ?? [])
    setSettlements(sData.settlements ?? [])
    setBalance(bData)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (partnerEmail) loadData()
  }, [partnerEmail, loadData])

  const bankAccounts = accounts.filter((a) => a.type === 'bank')

  const filteredExpenses = expenses.filter((e) => {
    if (filterPayer === 'me') return e.payer_email === myEmail
    if (filterPayer === 'partner') return e.payer_email !== myEmail
    return true
  })

  async function handleDelete(id: string) {
    await fetch(`/api/shared-expenses/${id}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    loadData()
  }

  async function handleDeleteSettlement(id: string) {
    await fetch('/api/settlements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadData()
  }

  if (!groupLoaded) {
    return (
      <div className="ledgernest-page">
        <div className="ledgernest-page-header">
          <h1 className="ledgernest-page-title">Shared Expenses</h1>
        </div>
        <div style={{ color: 'var(--text-tertiary)', padding: 32 }}>Loading…</div>
      </div>
    )
  }

  if (!partnerEmail) {
    return (
      <div className="ledgernest-page">
        <div className="ledgernest-page-header">
          <h1 className="ledgernest-page-title">Shared Expenses</h1>
        </div>
        <NoPairState myEmail={myEmail} onPaired={(email) => { setPartnerEmail(email); loadData() }} />
      </div>
    )
  }

  return (
    <div className="ledgernest-page">
      <div className="ledgernest-page-header">
        <h1 className="ledgernest-page-title">Shared Expenses</h1>
      </div>

      {/* Balance Card */}
      <BalanceCard
        balance={balance}
        loading={loading}
        partnerEmail={partnerEmail}
        myEmail={myEmail}
        onAddExpense={() => { setEditExpense(undefined); setShowAddModal(true) }}
        onSettleUp={() => setShowSettleUp(true)}
      />

      {/* Expenses List */}
      <div style={{ ...cardStyle, marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Expenses ({filteredExpenses.length})</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'me', 'partner'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterPayer(f)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${filterPayer === f ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  background: filterPayer === f ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'transparent',
                  color: filterPayer === f ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {f === 'all' ? 'All' : f === 'me' ? 'Paid by me' : `Paid by ${shortEmail(partnerEmail)}`}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-tertiary)', padding: '20px 0' }}>Loading…</div>
        ) : filteredExpenses.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', padding: '20px 0', textAlign: 'center' }}>
            No shared expenses yet.{' '}
            <button style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => { setEditExpense(undefined); setShowAddModal(true) }}>
              Add the first one
            </button>
          </div>
        ) : (
          filteredExpenses.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              myEmail={myEmail}
              partnerEmail={partnerEmail}
              onEdit={(exp) => { setEditExpense(exp); setShowAddModal(true) }}
              onDelete={(id) => setDeleteConfirm(id)}
            />
          ))
        )}
      </div>

      {/* Settlement History */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <button
          onClick={() => setShowSettlements(!showSettlements)}
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0 }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>Settlement History ({settlements.length})</div>
          <span style={{ display: 'flex', transform: showSettlements ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
            <Icon name="chevron" size={16} />
          </span>
        </button>

        {showSettlements && (
          <div style={{ marginTop: 16 }}>
            {settlements.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No settlements recorded yet.</div>
            ) : (
              settlements.map((s) => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto auto', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtDate(s.date)}</div>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{s.from_email === myEmail ? 'You' : shortEmail(s.from_email)}</span>
                    {' → '}
                    <span style={{ fontWeight: 600 }}>{s.to_email === myEmail ? 'You' : shortEmail(s.to_email)}</span>
                    {s.notes && <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>· {s.notes}</span>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: s.to_email === myEmail ? 'var(--success)' : 'var(--danger)' }}>
                    {s.to_email === myEmail ? '+' : '-'}{fmt(s.amount)}
                  </div>
                  <button className="ledgernest-icon-btn ledgernest-icon-btn--sm" onClick={() => handleDeleteSettlement(s.id)} style={{ color: 'var(--danger)' }} title="Delete">
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddExpenseModal
          myEmail={myEmail}
          partnerEmail={partnerEmail}
          expense={editExpense}
          onClose={() => { setShowAddModal(false); setEditExpense(undefined) }}
          onSaved={loadData}
        />
      )}

      {showSettleUp && (
        <SettleUpModal
          balance={balance?.balance ?? 0}
          myEmail={myEmail}
          partnerEmail={partnerEmail}
          accounts={bankAccounts}
          onClose={() => setShowSettleUp(false)}
          onSaved={loadData}
        />
      )}

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '28px 32px', width: 360, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Delete expense?</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>This action cannot be undone.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ledgernest-btn ledgernest-btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                className="ledgernest-btn"
                style={{ background: 'var(--danger)', color: 'white', border: 'none' }}
                onClick={() => handleDelete(deleteConfirm)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
