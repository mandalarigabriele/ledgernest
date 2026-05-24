'use client'

import { useState } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useFinanceStore } from '@/stores/financeStore'
import type { Account } from '@/types'
import Icon from '../Icon'

const TYPES: { value: Account['type']; label: string; sub: string; icon: string; color: string }[] = [
  { value: 'bank',   label: 'Conto bancario',  sub: 'Corrente o deposito', icon: 'conti',  color: '#58a6ff' },
  { value: 'broker', label: 'Brokerage',        sub: 'IBKR, Degiro, Fineco…', icon: 'azioni', color: 'var(--accent)' },
  { value: 'crypto', label: 'Crypto wallet',    sub: 'Exchange o self-custody', icon: 'crypto', color: '#f77c3a' },
  { value: 'other',  label: 'Altro',            sub: 'Fondo, mutuo, altro', icon: 'wallet', color: '#7c6df7' },
]

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const

export default function AccountModal() {
  const { closeModal } = useUIStore()
  const { addAccount } = useFinanceStore()

  const [type, setType] = useState<Account['type']>('bank')
  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [balance, setBalance] = useState('')
  const [currency, setCurrency] = useState<'EUR' | 'USD' | 'GBP' | 'CHF'>('EUR')
  const [iban, setIban] = useState('')
  const [note, setNote] = useState('')

  const selected = TYPES.find((t) => t.value === type)!

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

  return (
    <div className="ledgernest-modal-overlay">
      <div className="ledgernest-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>

        <div className="ledgernest-modal-header">
          <div>
            <div className="ledgernest-modal-title">Collega conto</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Aggiungi un conto al tuo patrimonio
            </div>
          </div>
          <button className="ledgernest-modal-close" onClick={closeModal}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ledgernest-modal-body" style={{ gap: '18px' }}>

            {/* Tipo */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">Tipo di conto</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: 'var(--radius-md)',
                      border: '1.5px solid',
                      borderColor: type === t.value ? t.color : 'var(--border)',
                      background: type === t.value ? `color-mix(in oklch, ${t.color} 12%, transparent)` : 'transparent',
                      textAlign: 'left', cursor: 'pointer', transition: 'all .15s',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
                      background: type === t.value ? t.color : 'var(--bg-elevated)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: type === t.value ? '#fff' : 'var(--text-secondary)',
                      transition: 'all .15s',
                    }}>
                      <Icon name={t.icon} size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: type === t.value ? t.color : 'var(--text-primary)' }}>{t.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>{t.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Nome */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">
                Nome <span style={{ color: 'var(--danger,#f85149)' }}>*</span>
              </label>
              <input
                className="ledgernest-input"
                type="text"
                placeholder={type === 'bank' ? 'Conto corrente N26' : type === 'broker' ? 'Broker · IBKR' : type === 'crypto' ? 'Wallet · Ledger' : 'Nome conto'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ height: '42px' }}
              />
            </div>

            {/* Istituzione / Broker */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">
                {type === 'bank' ? 'Banca' : type === 'broker' ? 'Broker' : type === 'crypto' ? 'Exchange / Wallet' : 'Istituzione'}
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

            {/* Saldo + Valuta */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div className="ledgernest-field">
                <label className="ledgernest-label">
                  Saldo attuale <span style={{ color: 'var(--danger,#f85149)' }}>*</span>
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
                <label className="ledgernest-label">Valuta</label>
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

            {/* IBAN (solo bank) */}
            {type === 'bank' && (
              <div className="ledgernest-field">
                <label className="ledgernest-label">IBAN <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(opzionale)</span></label>
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
              <label className="ledgernest-label">Note <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(opzionale)</span></label>
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
              Annulla
            </button>
            <button
              type="submit"
              className="ledgernest-btn ledgernest-btn-primary"
              disabled={!name || !balance}
              style={{ opacity: name && balance ? 1 : 0.5 }}
            >
              <Icon name="plus" size={14} />
              Collega conto
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
