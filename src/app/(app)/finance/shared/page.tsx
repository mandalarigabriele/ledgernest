'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useFinanceStore } from '@/stores/financeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import Icon from '@/components/shared/Icon'
import MerchantInput from '@/components/shared/MerchantInput'
import { CategoryPicker } from '@/components/shared/CategoryPicker'

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
  minWidth: 0, boxSizing: 'border-box', fontSize: 13,
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

// ── Add / Edit Expense Modal ──────────────────────────────────────────────────

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
  const t  = useTranslations('condivisione')
  const tm = useTranslations('modals')
  const tc = useTranslations('common')
  const { accounts, addTransaction } = useFinanceStore()
  const modalRef = useRef<HTMLDivElement>(null)

  // Movement fields — same order as MovementModal
  const [type, setType]               = useState<'income' | 'expense'>('expense')
  const [amount, setAmount]           = useState(expense ? String(expense.amount) : '')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [merchant, setMerchant]       = useState('')
  const [category, setCategory]       = useState(expense?.category ?? '')
  const [accountId, setAccountId]     = useState(accounts[0]?.id ?? '')
  const [date, setDate]               = useState(expense?.date ?? new Date().toISOString().slice(0, 10))
  const [note, setNote]               = useState(expense?.notes ?? '')

  // Sharing fields
  const [payerEmail, setPayerEmail]   = useState(expense?.payer_email ?? myEmail)
  const [otherShare, setOtherShare]   = useState(expense ? String(Math.round(expense.other_share * 100)) : '50')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSave() {
    if (!description.trim()) { setError(t('errorDescription')); return }
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError(t('errorAmount')); return }
    setSaving(true); setError('')

    const share = Math.min(1, Math.max(0, parseFloat(otherShare) / 100))

    if (expense) {
      // Edit: update only the shared_expense record
      const res = await fetch(`/api/shared-expenses/${expense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, description: description.trim(), date, payerEmail, otherShare: share, category: category || null, notes: note.trim() || null }),
      })
      setSaving(false)
      if (!res.ok) { const d = await res.json(); setError(d.error ?? t('errorGeneric')); return }
    } else {
      // New: if I'm the payer, create a personal transaction first
      let sourceTxId: string | undefined
      if (payerEmail === myEmail) {
        sourceTxId = addTransaction({ description: description.trim(), merchant: merchant.trim() || undefined, amount: amt, type, category, accountId, date, note: note.trim() || undefined })
      }
      const res = await fetch('/api/shared-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, description: description.trim(), date, payerEmail, otherShare: share, category: category || null, notes: note.trim() || null, sourceTxId }),
      })
      setSaving(false)
      if (!res.ok) { const d = await res.json(); setError(d.error ?? t('errorGeneric')); return }
    }

    onSaved()
    onClose()
  }

  return (
    <div className="ledgernest-modal-overlay">
      <div className="ledgernest-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="ledgernest-modal-header">
          <span className="ledgernest-modal-title">{expense ? t('editModalTitle') : t('addModalTitle')}</span>
          <button className="ledgernest-modal-close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <div className="ledgernest-modal-body">

            {/* Type toggle — only for new expenses */}
            {!expense && (
              <div className="ledgernest-toggle-group">
                <button type="button" className={`ledgernest-toggle-btn${type === 'expense' ? ' active' : ''}`} onClick={() => { setType('expense'); setCategory('') }}>
                  {tc('expense')}
                </button>
                <button type="button" className={`ledgernest-toggle-btn${type === 'income' ? ' active' : ''}`} onClick={() => { setType('income'); setCategory('') }}>
                  {tc('income')}
                </button>
              </div>
            )}

            {/* Amount */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{tm('amount')}</label>
              <input className="ledgernest-input" type="number" step="0.01" min="0" placeholder="0,00"
                value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus={!expense} />
            </div>

            {/* Description */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{tm('description')}</label>
              <input className="ledgernest-input" type="text" placeholder={tm('descriptionPlaceholder')}
                value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {/* Merchant — only for new */}
            {!expense && (
              <div className="ledgernest-field">
                <label className="ledgernest-label">
                  {tm('merchant')} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({tm('optional')})</span>
                </label>
                <MerchantInput value={merchant} onChange={setMerchant} />
              </div>
            )}

            {/* Category */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{tm('category')}</label>
              <CategoryPicker value={category} onChange={setCategory} typeFilter={expense ? 'expense' : type} containerRef={modalRef} />
            </div>

            {/* Account — only for new and only when I'm the payer */}
            {!expense && payerEmail === myEmail && (
              <div className="ledgernest-field">
                <label className="ledgernest-label">{tm('account')}</label>
                <select className="ledgernest-input ledgernest-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.length === 0
                    ? <option value="">{tm('noAccountFallback')}</option>
                    : accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)
                  }
                </select>
              </div>
            )}

            {/* Date */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{tm('date')}</label>
              <input className="ledgernest-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            {/* Note */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">
                {tc('note')} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({tm('optional')})</span>
              </label>
              <textarea className="ledgernest-input" placeholder={tm('notePlaceholder')} value={note}
                onChange={(e) => setNote(e.target.value)} rows={2} style={{ resize: 'none', lineHeight: 1.5 }} />
            </div>

            {/* ── Sharing fields ── */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Paid by */}
              <div className="ledgernest-field">
                <label className="ledgernest-label">{t('fieldPaidBy')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[myEmail, partnerEmail].map((email) => (
                    <button key={email} type="button" onClick={() => setPayerEmail(email)} style={{
                      flex: 1, padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: `1.5px solid ${payerEmail === email ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      background: payerEmail === email ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'transparent',
                      color: payerEmail === email ? 'var(--accent)' : 'var(--text-secondary)',
                      transition: 'all .15s',
                    }}>
                      {email === myEmail ? t('fieldPaidByMe') : shortEmail(email)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split */}
              <div className="ledgernest-field">
                <label className="ledgernest-label">{t('fieldSplit', { pct: otherShare })}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="range" min={0} max={100} step={5} value={otherShare}
                    onChange={(e) => setOtherShare(e.target.value)} style={{ flex: 1 }} />
                  <input className="ledgernest-input" style={{ width: 70, textAlign: 'center' }}
                    type="number" min={0} max={100} value={otherShare}
                    onChange={(e) => setOtherShare(e.target.value)} />
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>%</span>
                </div>
              </div>

            </div>
          </div>

          {error && <div style={{ padding: '0 24px 4px', color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

          <div className="ledgernest-modal-footer">
            <button type="button" className="ledgernest-btn ledgernest-btn-ghost" onClick={onClose}>{tc('cancel')}</button>
            <button type="button" className="ledgernest-btn ledgernest-btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? '…' : tc('save')}
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
  partnerName,
  accounts,
  onClose,
  onSaved,
}: {
  balance: number
  myEmail: string
  partnerEmail: string
  partnerName: string
  accounts: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('condivisione')
  const { addTransaction } = useFinanceStore()
  const absBalance = Math.abs(balance)
  const defaultFrom = balance >= 0 ? partnerEmail : myEmail
  const [amount, setAmount] = useState(String(absBalance.toFixed(2)))
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [fromEmail, setFromEmail] = useState(defaultFrom)
  const [autoRecord, setAutoRecord] = useState(false)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const receiving = fromEmail !== myEmail

  async function handleSave() {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError(t('errorAmount')); return }
    setSaving(true); setError('')

    const res = await fetch('/api/settlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt, date, fromEmail, notes: notes.trim() || null }),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error ?? t('errorFailed')); setSaving(false); return }

    if (autoRecord && accountId) {
      const type = receiving ? 'income' : 'expense'
      addTransaction({
        date,
        description: receiving
          ? t('reimbFromPartner', { partner: partnerName })
          : t('reimbToPartner', { partner: partnerName }),
        amount: amt,
        type,
        category: receiving ? 'Income' : 'Transfer',
        accountId,
        note: notes.trim() || t('sharedSettlement'),
      })
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="ledgernest-modal-overlay">
      <div className="ledgernest-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ledgernest-modal-header">
          <span className="ledgernest-modal-title">{t('settleModalTitle')}</span>
          <button className="ledgernest-modal-close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <div className="ledgernest-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={labelStyle}>{t('fieldDirection')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { from: partnerEmail, label: t('directionPartnerToMe', { partner: partnerName }) },
                { from: myEmail, label: t('directionMeToPartner', { partner: partnerName }) },
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
              <div style={labelStyle}>{t('fieldAmount')}</div>
              <input style={inputStyle} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>{t('fieldDate')}</div>
              <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <div style={labelStyle}>{t('fieldNotes')}</div>
            <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={receiving ? t('reimbFromPartner', { partner: partnerName }) : t('reimbToPartner', { partner: partnerName })} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={autoRecord} onChange={(e) => setAutoRecord(e.target.checked)} />
            <span style={{ color: 'var(--text-secondary)' }}>
              {t('autoRecord', { type: receiving ? t('autoRecordIncome') : t('autoRecordExpense') })}
            </span>
          </label>

          {autoRecord && accounts.length > 0 && (
            <div>
              <div style={labelStyle}>{t('fieldAccount')}</div>
              <select style={{ ...inputStyle, appearance: 'none' }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {error && <div style={{ padding: '0 24px 4px', color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

        <div className="ledgernest-modal-footer">
          <button className="ledgernest-btn ledgernest-btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="ledgernest-btn ledgernest-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t('saving') : t('recordSettlement')}
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
  partnerName,
  myEmail,
  onAddExpense,
  onSettleUp,
}: {
  balance: Balance | null
  loading: boolean
  partnerEmail: string
  partnerName: string
  myEmail: string
  onAddExpense: () => void
  onSettleUp: () => void
}) {
  const t = useTranslations('condivisione')
  const absBalance = balance ? Math.abs(balance.balance) : 0
  const balanced = balance ? Math.abs(balance.balance) < 0.01 : true
  const partnerOwes = balance && balance.balance > 0.01

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>
            {myEmail && partnerEmail
              ? t('subtitle', { partner: partnerName }).toUpperCase()
              : t('title').toUpperCase()}
          </div>
          {loading ? (
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-tertiary)' }}>…</div>
          ) : balanced ? (
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)' }}>{t('allSettled')}</div>
          ) : partnerOwes ? (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>{t('partnerOwes', { partner: partnerName })}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--success)' }}>{fmt(absBalance)}</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>{t('youOwe', { partner: partnerName })}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--danger)' }}>{fmt(absBalance)}</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="ledgernest-btn ledgernest-btn-ghost" onClick={onSettleUp} disabled={!partnerEmail}>
            <Icon name="check" size={14} />
            <span style={{ marginLeft: 6 }}>{t('settleUp')}</span>
          </button>
          <button className="ledgernest-btn" onClick={onAddExpense} disabled={!partnerEmail}>
            <Icon name="plus" size={14} />
            <span style={{ marginLeft: 6 }}>{t('addExpense')}</span>
          </button>
        </div>
      </div>

      {balance && !loading && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('totalShared')}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{fmt(balance.totalShared)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('youPaid')}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{fmt(balance.partnerOwesMe / 0.5)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('settlementsReceived')}</div>
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
  partnerName,
  onEdit,
  onDelete,
}: {
  expense: SharedExpense
  myEmail: string
  partnerEmail: string
  partnerName: string
  onEdit: (e: SharedExpense) => void
  onDelete: (id: string) => void
}) {
  const t = useTranslations('condivisione')
  const iPaid = expense.payer_email === myEmail
  const myShare = iPaid ? expense.amount * (1 - expense.other_share) : expense.amount * expense.other_share
  const partnerShare = expense.amount - myShare

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {expense.description}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.5 }}>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDate(expense.date)}</span>
          {expense.category ? ` · ${expense.category}` : ''}
          {' · '}
          <span style={{ color: iPaid ? 'var(--success)' : 'var(--text-tertiary)' }}>
            {iPaid ? t('paidByMe') : t('paidByPartner', { partner: partnerName })}
          </span>
          {' · '}<span style={{ fontWeight: 600 }}>{fmt(expense.amount)}</span> {t('expenseTotal')}
        </div>
        {expense.notes && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{expense.notes}</div>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: iPaid ? 'var(--success)' : 'var(--danger)' }}>
          {iPaid ? '+' : '-'}{fmt(iPaid ? partnerShare : myShare)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {t('yourShare', { amount: fmt(myShare) })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
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
  const t = useTranslations('condivisione')
  const [partnerEmail, setPartnerEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handlePair() {
    if (!partnerEmail.trim()) { setError(t('errorPartnerEmail')); return }
    setSaving(true); setError('')
    const res = await fetch('/api/sharing-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerEmail: partnerEmail.trim() }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? t('errorPairFailed')); return }
    onPaired(partnerEmail.trim())
  }

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
        <Icon name="shared" size={28} />
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{t('noPairTitle')}</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 360 }}>{t('noPairDesc')}</div>
      </div>
      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'left' }}>{t('yourEmail')} <strong>{myEmail}</strong></div>
        <input
          style={inputStyle}
          type="email"
          placeholder={t('partnerEmailPlaceholder')}
          value={partnerEmail}
          onChange={(e) => setPartnerEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handlePair()}
        />
        {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
        <button className="ledgernest-btn" onClick={handlePair} disabled={saving}>
          {saving ? t('pairing') : t('pairBtn')}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SharedPage() {
  const t = useTranslations('condivisione')
  const { data: session } = useSession()
  const { accounts } = useFinanceStore()
  const { settings } = useSettingsStore()
  const myEmail = session?.user?.email ?? ''

  const [partnerEmail,       setPartnerEmail]       = useState<string | null>(null)
  const [partnerDisplayName, setPartnerDisplayName] = useState<string | null>(null)
  const [groupLoaded,        setGroupLoaded]        = useState(false)

  const [expenses, setExpenses] = useState<SharedExpense[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [balance, setBalance] = useState<Balance | null>(null)
  const [loading, setLoading] = useState(false)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editExpense, setEditExpense] = useState<SharedExpense | undefined>()
  const [showSettleUp, setShowSettleUp] = useState(false)
  const [showSettlements, setShowSettlements] = useState(false)

  const [filterPayer, setFilterPayer] = useState<'all' | 'me' | 'partner'>('all')
  const [filterMonth, setFilterMonth] = useState<string>('all') // 'all' | 'YYYY-MM'
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (!myEmail) return
    fetch('/api/sharing-group')
      .then((r) => r.json())
      .then((d) => {
        setPartnerEmail(d.group?.partnerEmail ?? null)
        setPartnerDisplayName(d.group?.partnerDisplayName ?? null)
        setGroupLoaded(true)
      })
  }, [myEmail])

  // Effective partner name: local override > deduced from their account > email prefix
  const effectivePartnerName = (email: string) =>
    settings.partnerName?.trim()
    || partnerDisplayName
    || email.split('@')[0]

  const loadData = useCallback(async () => {
    setLoading(true)
    const [eRes, sRes, bRes] = await Promise.all([
      fetch('/api/shared-expenses'),
      fetch('/api/settlements'),
      fetch('/api/shared-expenses/balance'),
    ])
    const [eData, sData, bData] = await Promise.all([eRes.json(), sRes.json(), bRes.json()])
    const expList = eData.expenses ?? []
    const setList = sData.settlements ?? []
    setExpenses(expList)
    setSettlements(setList)
    setBalance(bData)
    setLoading(false)
    // Auto-expand settlement history when settlements exist but no expenses (orphaned records)
    if (setList.length > 0 && expList.length === 0) setShowSettlements(true)
  }, [])

  useEffect(() => {
    if (partnerEmail) loadData()
  }, [partnerEmail, loadData])

  const bankAccounts = accounts.filter((a) => a.type === 'bank')

  // Build sorted list of months present in expenses (YYYY-MM)
  const availableMonths = useMemo(() => {
    const set = new Set(expenses.map((e) => e.date.slice(0, 7)))
    return Array.from(set).sort().reverse()
  }, [expenses])

  // Default to current month when expenses load
  useEffect(() => {
    if (availableMonths.length > 0 && filterMonth === 'all') {
      const currentMonth = new Date().toISOString().slice(0, 7)
      if (availableMonths.includes(currentMonth)) setFilterMonth(currentMonth)
      else setFilterMonth(availableMonths[0])
    }
  }, [availableMonths]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredExpenses = expenses.filter((e) => {
    if (filterMonth !== 'all' && !e.date.startsWith(filterMonth)) return false
    if (filterPayer === 'me') return e.payer_email === myEmail
    if (filterPayer === 'partner') return e.payer_email !== myEmail
    return true
  })

  async function handleDelete(id: string) {
    const res = await fetch(`/api/shared-expenses/${id}`, { method: 'DELETE' })
    const data = await res.json() as { ok: boolean; sourceTxId?: string | null }
    setDeleteConfirm(null)
    if (data.sourceTxId) {
      useFinanceStore.getState().deleteTransaction(data.sourceTxId)
    }
    loadData()
  }

  async function handleDeleteSettlement(id: string) {
    await fetch('/api/settlements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadData()
  }

  if (!groupLoaded) {
    return (
      <div className="ledgernest-gap-5">
        <div style={{ color: 'var(--text-tertiary)', padding: 32 }}>{t('loading')}</div>
      </div>
    )
  }

  if (!partnerEmail) {
    return (
      <div className="ledgernest-gap-5">
        <NoPairState myEmail={myEmail} onPaired={(email) => { setPartnerEmail(email); loadData() }} />
      </div>
    )
  }

  return (
    <div className="ledgernest-gap-5">

      <BalanceCard
        balance={balance}
        loading={loading}
        partnerEmail={partnerEmail}
        partnerName={effectivePartnerName(partnerEmail)}
        myEmail={myEmail}
        onAddExpense={() => { setEditExpense(undefined); setShowAddModal(true) }}
        onSettleUp={() => setShowSettleUp(true)}
      />

      <div style={{ ...cardStyle, marginTop: 20 }}>
        {/* Month selector row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <button
            onClick={() => {
              if (filterMonth === 'all') return
              const idx = availableMonths.indexOf(filterMonth)
              if (idx < availableMonths.length - 1) setFilterMonth(availableMonths[idx + 1])
            }}
            disabled={filterMonth === 'all' || availableMonths.indexOf(filterMonth) >= availableMonths.length - 1}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, opacity: (filterMonth === 'all' || availableMonths.indexOf(filterMonth) >= availableMonths.length - 1) ? 0.3 : 1 }}
          >‹</button>

          <div style={{ flex: 1, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {[...availableMonths].reverse().map((m) => {
              const d = new Date(m + '-01T12:00:00')
              const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
              const isActive = filterMonth === m
              return (
                <button key={m} onClick={() => setFilterMonth(m)} style={{
                  flexShrink: 0, padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: isActive ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: isActive ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                  transition: 'all .15s',
                }}>{label}</button>
              )
            })}
          </div>

          <button
            onClick={() => {
              if (filterMonth === 'all') return
              const idx = availableMonths.indexOf(filterMonth)
              if (idx > 0) setFilterMonth(availableMonths[idx - 1])
            }}
            disabled={filterMonth === 'all' || availableMonths.indexOf(filterMonth) <= 0}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1, opacity: (filterMonth === 'all' || availableMonths.indexOf(filterMonth) <= 0) ? 0.3 : 1 }}
          >›</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t('expensesCount', { count: filteredExpenses.length })}</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {(['all', 'me', 'partner'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterPayer(f)}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${filterPayer === f ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  background: filterPayer === f ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'transparent',
                  color: filterPayer === f ? 'var(--accent)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {f === 'all' ? t('filterAll') : f === 'me' ? t('filterMe') : t('filterPartner', { partner: effectivePartnerName(partnerEmail) })}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-tertiary)', padding: '20px 0' }}>{t('loading')}</div>
        ) : filteredExpenses.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', padding: '20px 0', textAlign: 'center' }}>
            {t('noExpenses')}{' '}
            <button style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => { setEditExpense(undefined); setShowAddModal(true) }}>
              {t('noExpensesAdd')}
            </button>
          </div>
        ) : (
          filteredExpenses.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              myEmail={myEmail}
              partnerEmail={partnerEmail}
              partnerName={effectivePartnerName(partnerEmail)}
              onEdit={(exp) => { setEditExpense(exp); setShowAddModal(true) }}
              onDelete={(id) => setDeleteConfirm(id)}
            />
          ))
        )}
      </div>

      <div style={{ ...cardStyle, marginTop: 16 }}>
        <button
          onClick={() => setShowSettlements(!showSettlements)}
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0 }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>{t('settlementHistory', { count: settlements.length })}</div>
          <span style={{ display: 'flex', transform: showSettlements ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
            <Icon name="chevron" size={16} />
          </span>
        </button>

        {showSettlements && (
          <div style={{ marginTop: 16 }}>
            {settlements.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{t('noExpenses')}</div>
            ) : (
              settlements.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{s.from_email === myEmail ? t('fieldPaidByMe') : shortEmail(s.from_email)}</span>
                      {' → '}
                      <span style={{ fontWeight: 600 }}>{s.to_email === myEmail ? t('fieldPaidByMe') : shortEmail(s.to_email)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {fmtDate(s.date)}{s.notes ? ` · ${s.notes}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, flexShrink: 0, color: s.to_email === myEmail ? 'var(--success)' : 'var(--danger)' }}>
                    {s.to_email === myEmail ? '+' : '-'}{fmt(s.amount)}
                  </div>
                  <button className="ledgernest-icon-btn ledgernest-icon-btn--sm" onClick={() => handleDeleteSettlement(s.id)} style={{ color: 'var(--danger)', flexShrink: 0 }} title="Delete">
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

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
          partnerName={effectivePartnerName(partnerEmail)}
          accounts={bankAccounts}
          onClose={() => setShowSettleUp(false)}
          onSaved={loadData}
        />
      )}

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '28px 32px', width: 360, maxWidth: 'calc(100vw - 32px)', display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{t('deleteTitle')}</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{t('deleteBody')}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ledgernest-btn ledgernest-btn-ghost" onClick={() => setDeleteConfirm(null)}>{t('cancel')}</button>
              <button
                className="ledgernest-btn"
                style={{ background: 'var(--danger)', color: 'white', border: 'none' }}
                onClick={() => handleDelete(deleteConfirm)}
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
