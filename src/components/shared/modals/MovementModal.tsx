'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useUIStore } from '@/stores/uiStore'
import { useFinanceStore } from '@/stores/financeStore'
import Icon from '../Icon'
import MerchantInput from '../MerchantInput'
import { CategoryPicker } from '../CategoryPicker'

// ─────────────────────────────────────────────────────────────

export default function MovementModal() {
  const t = useTranslations('modals')
  const tc = useTranslations('common')
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

  function handleTypeChange(next: 'income' | 'expense') {
    setType(next)
    setCategory('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description || !amount || !accountId) return
    addTransaction({ description, merchant: merchant.trim() || undefined, amount: parseFloat(amount), type, category, accountId, date, note: note.trim() || undefined })
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

            {/* Category picker */}
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
