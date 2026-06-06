'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useUIStore } from '@/stores/uiStore'
import { useFinanceStore } from '@/stores/financeStore'
import Icon from '../Icon'
import MerchantInput from '../MerchantInput'
import { CategoryPicker } from '../CategoryPicker'

// ─────────────────────────────────────────────────────────────

function shortEmail(email: string) { return email.split('@')[0] }

export default function MovementModal() {
  const t  = useTranslations('modals')
  const tc = useTranslations('common')
  const ts = useTranslations('condivisione')
  const { closeModal } = useUIStore()
  const { accounts, addTransaction } = useFinanceStore()
  const modalRef = useRef<HTMLDivElement>(null)

  const [type, setType]               = useState<'income' | 'expense'>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount]           = useState('')
  const [category, setCategory]       = useState('')
  const [accountId, setAccountId]     = useState(accounts[0]?.id ?? '')
  const [date, setDate]               = useState(new Date().toISOString().slice(0, 10))
  const [merchant, setMerchant]       = useState('')
  const [note, setNote]               = useState('')

  // Sharing
  const [partnerEmail, setPartnerEmail] = useState<string | null>(null)
  const [myEmail,      setMyEmail]      = useState<string>('')
  const [shared,       setShared]       = useState(false)
  const [payerEmail,   setPayerEmail]   = useState('')
  const [otherShare,   setOtherShare]   = useState('50')

  useEffect(() => {
    fetch('/api/sharing-group')
      .then((r) => r.ok ? r.json() : null)
      .then((d: { group: { partnerEmail: string } | null; myEmail: string } | null) => {
        if (d?.group) {
          setPartnerEmail(d.group.partnerEmail ?? null)
          setMyEmail(d.myEmail ?? '')
          setPayerEmail(d.myEmail ?? '')
        }
      })
      .catch(() => {})
  }, [])

  function handleTypeChange(next: 'income' | 'expense') {
    setType(next)
    setCategory('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description || !amount || !accountId) return

    const txId = addTransaction({
      description,
      merchant: merchant.trim() || undefined,
      amount: parseFloat(amount),
      type,
      category,
      accountId,
      date,
      note: note.trim() || undefined,
    })

    if (shared && partnerEmail) {
      const share = Math.min(1, Math.max(0, parseFloat(otherShare) / 100))
      await fetch('/api/shared-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          description,
          category: category || null,
          date,
          payerEmail,
          otherShare: share,
          sourceTxId: txId,
        }),
      })
    }

    closeModal()
  }

  return (
    <div className="ledgernest-modal-overlay">
      <div className="ledgernest-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="ledgernest-modal-header">
          <span className="ledgernest-modal-title">{t('addMovement')}</span>
          <button className="ledgernest-modal-close" onClick={closeModal}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ledgernest-modal-body">

            {/* Type toggle */}
            <div className="ledgernest-toggle-group">
              <button type="button" className={`ledgernest-toggle-btn${type === 'expense' ? ' active' : ''}`} onClick={() => handleTypeChange('expense')}>
                {tc('expense')}
              </button>
              <button type="button" className={`ledgernest-toggle-btn${type === 'income' ? ' active' : ''}`} onClick={() => handleTypeChange('income')}>
                {tc('income')}
              </button>
            </div>

            {/* Amount */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('amount')}</label>
              <input className="ledgernest-input" type="number" step="0.01" min="0" placeholder="0,00"
                value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>

            {/* Description */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('description')}</label>
              <input className="ledgernest-input" type="text" placeholder={t('descriptionPlaceholder')}
                value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>

            {/* Merchant */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">
                {t('merchant')} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({t('optional')})</span>
              </label>
              <MerchantInput value={merchant} onChange={setMerchant} />
            </div>

            {/* Category */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('category')}</label>
              <CategoryPicker value={category} onChange={setCategory} typeFilter={type} containerRef={modalRef} />
            </div>

            {/* Account */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('account')}</label>
              <select className="ledgernest-input ledgernest-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.length === 0
                  ? <option value="">{t('noAccountFallback')}</option>
                  : accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)
                }
              </select>
            </div>

            {/* Date */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('date')}</label>
              <input className="ledgernest-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            {/* Note */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">
                {tc('note')} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({t('optional')})</span>
              </label>
              <textarea
                className="ledgernest-input"
                placeholder={t('notePlaceholder')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                style={{ resize: 'none', lineHeight: 1.5 }}
              />
            </div>

            {/* ── Sharing section — only if partner exists ── */}
            {partnerEmail && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setShared((v) => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    background: shared ? 'color-mix(in oklch, var(--accent) 10%, transparent)' : 'var(--bg-elevated)',
                    border: `1.5px solid ${shared ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    borderRadius: 10, padding: '10px 14px', cursor: 'pointer', transition: 'all .15s',
                  }}
                >
                  <Icon name="shared" size={16} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: shared ? 'var(--accent)' : 'var(--text-secondary)', flex: 1, textAlign: 'left' }}>
                    {ts('toggleShared')}
                  </span>
                  <div style={{
                    width: 32, height: 18, borderRadius: 9, background: shared ? 'var(--accent)' : 'var(--border-subtle)',
                    position: 'relative', transition: 'background .15s',
                  }}>
                    <div style={{
                      position: 'absolute', top: 2, left: shared ? 14 : 2, width: 14, height: 14,
                      borderRadius: '50%', background: '#fff', transition: 'left .15s',
                    }} />
                  </div>
                </button>

                {shared && (
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Paid by */}
                    <div className="ledgernest-field">
                      <label className="ledgernest-label">{ts('fieldPaidBy')}</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[myEmail, partnerEmail].map((email) => (
                          <button key={email} type="button" onClick={() => setPayerEmail(email)} style={{
                            flex: 1, padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            border: `1.5px solid ${payerEmail === email ? 'var(--accent)' : 'var(--border-subtle)'}`,
                            background: payerEmail === email ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'transparent',
                            color: payerEmail === email ? 'var(--accent)' : 'var(--text-secondary)',
                            transition: 'all .15s',
                          }}>
                            {email === myEmail ? ts('fieldPaidByMe') : shortEmail(email)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Split */}
                    <div className="ledgernest-field">
                      <label className="ledgernest-label">{ts('fieldSplit', { pct: otherShare })}</label>
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
                )}
              </div>
            )}

          </div>

          <div className="ledgernest-modal-footer">
            <button type="button" className="ledgernest-btn ledgernest-btn-ghost" onClick={closeModal}>{tc('cancel')}</button>
            <button type="submit" className="ledgernest-btn ledgernest-btn-primary">{tc('save')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
