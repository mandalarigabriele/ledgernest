'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useUIStore } from '@/stores/uiStore'
import { useFinanceStore } from '@/stores/financeStore'
import Icon from '../Icon'

const ICONS = ['🏖️', '🚗', '🏠', '📚', '💍', '✈️', '💻', '🎓', '🏋️', '🌍']
const COLORS = ['#5bc8d0', '#7c6df7', '#f77c3a', '#3fb950', '#f85149', '#d29922', '#58a6ff', '#e879a8']

export default function GoalModal() {
  const t = useTranslations('modals')
  const tc = useTranslations('common')
  const { closeModal } = useUIStore()
  const { addGoal } = useFinanceStore()

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🏖️')
  const [color, setColor] = useState('#5bc8d0')
  const [targetAmount, setTargetAmount] = useState('')
  const [currentAmount, setCurrentAmount] = useState('0')
  const [monthlyContribution, setMonthlyContribution] = useState('')
  const [deadline, setDeadline] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !targetAmount) return
    addGoal({
      name,
      icon,
      color,
      targetAmount: parseFloat(targetAmount),
      currentAmount: parseFloat(currentAmount) || 0,
      monthlyContribution: parseFloat(monthlyContribution) || 0,
      deadline: deadline || undefined,
    })
    closeModal()
  }

  return (
    <div className="ledgernest-modal-overlay">
      <div className="ledgernest-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ledgernest-modal-header">
          <span className="ledgernest-modal-title">{t('addGoal')}</span>
          <button className="ledgernest-modal-close" onClick={closeModal}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ledgernest-modal-body">
            {/* Name */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('goalName')}</label>
              <input
                className="ledgernest-input"
                type="text"
                placeholder="Es. Vacanza a Bali"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Icon picker */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('icon')}</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    style={{
                      fontSize: '20px',
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: icon === ic ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                      border: `1.5px solid ${icon === ic ? 'var(--accent)' : 'transparent'}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => setIcon(ic)}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div className="ledgernest-field">
              <label className="ledgernest-label">{t('color')}</label>
              <div className="ledgernest-accent-swatches">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`ledgernest-accent-swatch${color === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            {/* Target / Current */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="ledgernest-field">
                <label className="ledgernest-label">{t('targetAmount')} (€)</label>
                <input
                  className="ledgernest-input ledgernest-mono"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="10.000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  required
                />
              </div>
              <div className="ledgernest-field">
                <label className="ledgernest-label">Già risparmiato (€)</label>
                <input
                  className="ledgernest-input ledgernest-mono"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                />
              </div>
            </div>

            {/* Monthly / Deadline */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="ledgernest-field">
                <label className="ledgernest-label">{t('monthlyContribution')} (€)</label>
                <input
                  className="ledgernest-input ledgernest-mono"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="200"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(e.target.value)}
                />
              </div>
              <div className="ledgernest-field">
                <label className="ledgernest-label">{t('deadline')}</label>
                <input
                  className="ledgernest-input"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="ledgernest-modal-footer">
            <button type="button" className="ledgernest-btn ledgernest-btn-ghost" onClick={closeModal}>
              {tc('cancel')}
            </button>
            <button type="submit" className="ledgernest-btn ledgernest-btn-primary">
              {tc('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
