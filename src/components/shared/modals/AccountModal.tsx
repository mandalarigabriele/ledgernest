'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useUIStore } from '@/stores/uiStore'
import { useFinanceStore } from '@/stores/financeStore'
import type { Account } from '@/types'
import Icon from '../Icon'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const

export default function AccountModal() {
  const t = useTranslations('modals')
  const tc = useTranslations('common')
  const { closeModal } = useUIStore()
  const { addAccount } = useFinanceStore()

  const TYPES: { value: Account['type']; label: string; sub: string; icon: string; color: string }[] = [
    { value: 'bank',   label: t('accountTypeBank'),   sub: t('accountTypeBankSub'),   icon: 'conti',  color: '#58a6ff' },
    { value: 'broker', label: t('accountTypeBroker'),  sub: t('accountTypeBrokerSub'), icon: 'azioni', color: 'var(--accent)' },
    { value: 'crypto', label: t('accountTypeCrypto'),  sub: t('accountTypeCryptoSub'), icon: 'crypto', color: '#f77c3a' },
    { value: 'other',  label: t('accountTypeOther'),   sub: t('accountTypeOtherSub'),  icon: 'wallet', color: '#7c6df7' },
  ]

  const [type, setType] = useState<Account['type']>('bank')
  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [balance, setBalance] = useState('')
  const [currency, setCurrency] = useState<'EUR' | 'USD' | 'GBP' | 'CHF'>('EUR')
  const [iban, setIban] = useState('')
  const [note, setNote] = useState('')

  const selected = TYPES.find((tp) => tp.value === type)!

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !balance) return
    addAccount({
      name: name.trim(),
      type,
      icon: selected.icon,
      balance: parseFloat(balance) || 0,
      currency: currency as 'EUR' | 'USD',
      broker: institution.trim() || undefined,
      iban: iban.trim() || undefined,
      note: note.trim() || undefined,
    })
    closeModal()
  }

  const namePlaceholder =
    type === 'bank'   ? t('accountPlaceholderBank') :
    type === 'broker' ? t('accountPlaceholderBroker') :
    type === 'crypto' ? t('accountPlaceholderCrypto') :
                        t('accountPlaceholderOther')

  const institutionLabel =
    type === 'bank'   ? t('accountBank') :
    type === 'broker' ? t('accountTypeBroker') :
    type === 'crypto' ? t('accountExchangeWallet') :
                        t('accountInstitution')

  return (
    <div className="ledgernest-modal-overlay">
      <div className="ledgernest-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>

        <div className="ledgernest-modal-header">
          <div>
            <div className="ledgernest-modal-title">{t('accountTitle')}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {t('accountSub')}
            </div>
          </div>
          <button className="ledgernest-modal-close" onClick={closeModal}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ledgernest-modal-body" style={{ gap: '18px' }}>

            {/* Type */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('accountType')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {TYPES.map((tp) => (
                  <button
                    key={tp.value}
                    type="button"
                    onClick={() => setType(tp.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: 'var(--radius-md)',
                      border: '1.5px solid',
                      borderColor: type === tp.value ? tp.color : 'var(--border)',
                      background: type === tp.value ? `color-mix(in oklch, ${tp.color} 12%, transparent)` : 'transparent',
                      textAlign: 'left', cursor: 'pointer', transition: 'all .15s',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
                      background: type === tp.value ? tp.color : 'var(--bg-elevated)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: type === tp.value ? '#fff' : 'var(--text-secondary)',
                      transition: 'all .15s',
                    }}>
                      <Icon name={tp.icon} size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: type === tp.value ? tp.color : 'var(--text-primary)' }}>{tp.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>{tp.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">
                {t('accountName')} <span style={{ color: 'var(--danger,#f85149)' }}>*</span>
              </label>
              <input
                className="ledgernest-input"
                type="text"
                placeholder={namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ height: '42px' }}
              />
            </div>

            {/* Institution / Broker */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">
                {institutionLabel}
              </label>
              <input
                className="ledgernest-input"
                type="text"
                placeholder={type === 'bank' ? 'N26, Fineco, Intesa…' : type === 'broker' ? 'IBKR, Degiro, Fineco…' : type === 'crypto' ? 'Coinbase, Ledger…' : ''}
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                style={{ height: '42px' }}
              />
            </div>

            {/* Balance + Currency */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div className="ledgernest-field">
                <label className="ledgernest-label">
                  {t('currentBalance')} <span style={{ color: 'var(--danger,#f85149)' }}>*</span>
                </label>
                <input
                  className="ledgernest-input ledgernest-mono"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  required
                  style={{ height: '42px', fontSize: '15px' }}
                />
              </div>
              <div className="ledgernest-field">
                <label className="ledgernest-label">{tc('currency')}</label>
                <select
                  className="ledgernest-input"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as typeof currency)}
                  style={{ height: '42px' }}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* IBAN (bank only) */}
            {type === 'bank' && (
              <div className="ledgernest-field">
                <label className="ledgernest-label">{t('ibanOptional')} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({tc('cancel') /* using optional label */})</span></label>
                <input
                  className="ledgernest-input ledgernest-mono"
                  type="text"
                  placeholder="IT60 X054 2811 1010 0000 0123 456"
                  value={iban}
                  onChange={(e) => setIban(e.target.value.toUpperCase())}
                  style={{ height: '42px', fontSize: '13px' }}
                />
              </div>
            )}

            {/* Note */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('noteOptional')} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({tc('optional')})</span></label>
              <input
                className="ledgernest-input"
                type="text"
                placeholder="Conto principale, conto trading…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ height: '42px' }}
              />
            </div>
          </div>

          <div className="ledgernest-modal-footer">
            <button type="button" className="ledgernest-btn ledgernest-btn-ghost" onClick={closeModal}>
              {tc('cancel')}
            </button>
            <button
              type="submit"
              className="ledgernest-btn ledgernest-btn-primary"
              disabled={!name || !balance}
              style={{ opacity: name && balance ? 1 : 0.5 }}
            >
              <Icon name="plus" size={14} />
              {t('connectAccount')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
