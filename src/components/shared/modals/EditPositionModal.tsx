'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useFinanceStore } from '@/stores/financeStore'
import { useUIStore } from '@/stores/uiStore'
import type { AssetType, PortfolioPosition } from '@/types'
import Icon from '../Icon'

export default function EditPositionModal() {
  const t = useTranslations('modals')
  const tc = useTranslations('common')
  const { closeModal, modalProps } = useUIStore()
  const { updatePosition } = usePortfolioStore()
  const { accounts } = useFinanceStore()

  const pos = modalProps.position as PortfolioPosition | undefined

  const ASSET_TYPES: { value: AssetType; label: string; icon: string }[] = [
    { value: 'stock',     label: t('stockLabel'),    icon: 'azioni'  },
    { value: 'etf',       label: 'ETF',              icon: 'etf'     },
    { value: 'crypto',    label: 'Crypto',           icon: 'crypto'  },
    { value: 'bond',      label: t('bond'),          icon: 'report'  },
    { value: 'commodity', label: t('commodityLabel'), icon: 'globe'   },
  ]

  const [name,         setName]         = useState(pos?.name     ?? '')
  const [assetType,    setAssetType]    = useState<AssetType>(pos?.type ?? 'stock')
  const [sector,       setSector]       = useState(pos?.sector   ?? '')
  const [quantity,     setQuantity]     = useState(pos ? String(pos.quantity) : '')
  const [avgPrice,     setAvgPrice]     = useState(pos ? pos.avgPrice.toFixed(6).replace(/\.?0+$/, '') : '')
  const [broker,       setBroker]       = useState(pos?.broker   ?? '')
  const [purchaseDate, setPurchaseDate] = useState(pos?.purchaseDate ?? pos?.createdAt.slice(0, 10) ?? '')

  if (!pos) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseFloat(quantity)
    const price = parseFloat(avgPrice)
    if (!qty || qty <= 0 || price < 0 || !pos) return
    updatePosition(pos.id, {
      name:         name.trim() || pos.ticker,
      type:         assetType,
      sector:       sector.trim() || undefined,
      quantity:     qty,
      avgPrice:     price,
      broker:       broker.trim(),
      purchaseDate: purchaseDate || undefined,
    })
    closeModal()
  }

  const qty   = parseFloat(quantity) || 0
  const price = parseFloat(avgPrice) || 0
  const totalCost = qty * price

  return (
    <div className="ledgernest-modal-overlay">
      <div className="ledgernest-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>

        <div className="ledgernest-modal-header">
          <div>
            <div className="ledgernest-modal-title">{t('editPositionTitle')} · {pos.ticker}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {t('editPositionSub')}
            </div>
          </div>
          <button className="ledgernest-modal-close" onClick={closeModal}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ledgernest-modal-body" style={{ gap: 18 }}>

            <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Nota:</strong> {t('editPositionNote')}
            </div>

            {/* Asset type */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('assetTypeLabel')}</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ASSET_TYPES.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAssetType(a.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 13px', borderRadius: 'var(--radius-md)',
                      border: '1.5px solid',
                      borderColor: assetType === a.value ? 'var(--accent)' : 'var(--border-subtle)',
                      background: assetType === a.value ? 'var(--accent)' : 'transparent',
                      color: assetType === a.value ? '#fff' : 'var(--text-secondary)',
                      fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all .15s',
                    }}
                  >
                    <Icon name={a.icon} size={13} />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('nameLabel')}</label>
              <input
                className="ledgernest-input"
                type="text"
                placeholder={pos.ticker}
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ height: 44, fontSize: 15 }}
              />
            </div>

            {/* Sector */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('sectorLabel')}</label>
              <input
                className="ledgernest-input"
                type="text"
                placeholder={t('sectorPlaceholder')}
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                style={{ height: 44, fontSize: 15 }}
              />
            </div>

            {/* Quantity + Avg Price */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="ledgernest-field">
                <label className="ledgernest-label">
                  {t('quantityLabel')} *
                  {pos.type === 'crypto' && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>(es. 0,18)</span>
                  )}
                </label>
                <input
                  className="ledgernest-input ledgernest-mono"
                  type="number" step="any" min="0.000001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required style={{ height: 44, fontSize: 15 }}
                />
              </div>
              <div className="ledgernest-field">
                <label className="ledgernest-label">
                  {t('avgPriceLabel')} ({pos.currency}) *
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>{t('perUnit')}</span>
                </label>
                <input
                  className="ledgernest-input ledgernest-mono"
                  type="number" step="0.000001" min="0"
                  value={avgPrice}
                  onChange={(e) => setAvgPrice(e.target.value)}
                  required style={{ height: 44, fontSize: 15 }}
                />
              </div>
            </div>

            {/* Broker / Account */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('brokerAccountLabel')}</label>
              {accounts.length > 0 ? (
                <select
                  className="ledgernest-input"
                  value={broker}
                  onChange={(e) => setBroker(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                >
                  <option value="">{t('noAccount')}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                  {broker && !accounts.some((a) => a.name === broker) && (
                    <option value={broker}>{broker}</option>
                  )}
                </select>
              ) : (
                <input
                  className="ledgernest-input"
                  type="text"
                  placeholder="es. Trade Republic"
                  value={broker}
                  onChange={(e) => setBroker(e.target.value)}
                  style={{ height: 44, fontSize: 15 }}
                />
              )}
            </div>

            {/* Purchase date */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">Data primo acquisto</label>
              <input
                className="ledgernest-input ledgernest-mono"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                style={{ height: 44, fontSize: 15 }}
              />
            </div>

            {/* Summary */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
              padding: '12px 16px', background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)', fontSize: 13,
            }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{t('estTotalCost')}</div>
                <div style={{ fontWeight: 700 }}>{totalCost.toFixed(2)} {pos.currency}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{t('pricePerUnit')}</div>
                <div style={{ fontWeight: 700 }}>{price.toFixed(4)} {pos.currency}</div>
              </div>
            </div>
          </div>

          <div className="ledgernest-modal-footer">
            <button type="button" className="ledgernest-btn ledgernest-btn-ghost" onClick={closeModal}>
              {tc('cancel')}
            </button>
            <button
              type="submit"
              className="ledgernest-btn ledgernest-btn-primary"
              disabled={!quantity || !avgPrice || parseFloat(quantity) <= 0}
              style={{ opacity: quantity && avgPrice && parseFloat(quantity) > 0 ? 1 : 0.5 }}
            >
              {t('saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
