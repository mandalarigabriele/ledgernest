'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePortfolioStore } from '@/stores/portfolioStore'
import Icon from '../Icon'
import type { Trade } from '@/types'

interface Props {
  trade: Trade
  onClose: () => void
}

export default function EditTradeModal({ trade, onClose }: Props) {
  const t  = useTranslations('modals')
  const tc = useTranslations('common')
  const { updateTrade } = usePortfolioStore()
  const [price,      setPrice]      = useState(String(trade.price))
  const [quantity,   setQuantity]   = useState(String(trade.quantity))
  const [commission, setCommission] = useState(String(trade.commission ?? 0))
  const [date,       setDate]       = useState(trade.date)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const p = parseFloat(price)
    const q = parseFloat(quantity)
    const c = parseFloat(commission) || 0
    if (!p || p < 0 || !q || q <= 0) return
    updateTrade(trade.id, { price: p, quantity: q, commission: c, date })
    onClose()
  }

  const total = (parseFloat(price) || 0) * (parseFloat(quantity) || 0) + (parseFloat(commission) || 0)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-surface)', borderRadius: 14, padding: 24, width: 380, border: '1px solid var(--border-subtle)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {trade.type === 'buy' ? t('editBuyTitle', { ticker: trade.ticker }) : t('editSellTitle', { ticker: trade.ticker })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {t('editTradeSub')}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('tradePrice', { currency: trade.currency })}</label>
              <input
                className="ledgernest-input ledgernest-mono"
                type="number" step="any" min="0" required
                value={price} onChange={(e) => setPrice(e.target.value)}
                style={{ height: 40, fontSize: 14 }}
                autoFocus
              />
            </div>
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('tradeQuantity')}</label>
              <input
                className="ledgernest-input ledgernest-mono"
                type="number" step="any" min="0.000001" required
                value={quantity} onChange={(e) => setQuantity(e.target.value)}
                style={{ height: 40, fontSize: 14 }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('tradeCommissionLabel', { currency: trade.currency })}</label>
              <input
                className="ledgernest-input ledgernest-mono"
                type="number" step="any" min="0"
                value={commission} onChange={(e) => setCommission(e.target.value)}
                style={{ height: 40, fontSize: 14 }}
              />
            </div>
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('tradeDate')}</label>
              <input
                className="ledgernest-input"
                type="date" required
                value={date} onChange={(e) => setDate(e.target.value)}
                style={{ height: 40, fontSize: 14 }}
              />
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t('tradeTotalLabel')}</span>
            <span style={{ fontWeight: 700 }}>{total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {trade.currency}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="ledgernest-btn ledgernest-btn-ghost" onClick={onClose}>
              {tc('cancel')}
            </button>
            <button
              type="submit"
              className="ledgernest-btn ledgernest-btn-primary"
              disabled={!price || !quantity || parseFloat(quantity) <= 0}
            >
              {tc('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
