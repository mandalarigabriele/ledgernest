'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useFinanceStore } from '@/stores/financeStore'
import { useUIStore } from '@/stores/uiStore'
import Icon from '@/components/shared/Icon'

const CAT_COLORS = [
  '#5bc8d0', '#7c6df7', '#f77c3a', '#3fb950', '#f85149', '#d29922',
  '#58a6ff', '#e879a8', '#9b8fef', '#06b6d4', '#84cc16', '#a78bfa',
  '#f43f5e', '#fb7185', '#22c55e', '#38bdf8', '#64748b', '#78716c',
  '#d97706', '#db2777', '#6d28d9', '#8b949e',
]

const ICON_OPTIONS = [
  'cart', 'home', 'fork', 'cross', 'briefcase', 'music',
  'bag', 'car', 'zap', 'savings', 'trending_up', 'dividendi',
  'wallet', 'globe', 'obiettivi', 'report', 'conti', 'movimenti',
  'arrow_up', 'ricorrenti', 'budget', 'patrimonio',
]

type CatTab = 'expense' | 'income'
type CatGroup = 'needs' | 'lifestyle' | 'finance' | 'investments' | 'transfers'

export default function CategoryManagerModal() {
  const t = useTranslations('modals')
  const tc = useTranslations('common')
  const { budgetCategories, addBudgetCategory, deleteBudgetCategory } = useFinanceStore()
  const { closeModal } = useUIStore()

  const GROUPS: { key: CatGroup; label: string; color: string }[] = [
    { key: 'needs',       label: t('groupNeeds'),       color: '#7c6df7' },
    { key: 'lifestyle',   label: t('groupLifestyle'),   color: '#f77c3a' },
    { key: 'finance',     label: t('groupFinance'),     color: '#d29922' },
    { key: 'investments', label: t('groupInvestments'), color: '#5bc8d0' },
    { key: 'transfers',   label: t('groupTransfers'),   color: '#94a3b8' },
  ]

  function groupLabel(g?: string) {
    return GROUPS.find((x) => x.key === g)?.label ?? ''
  }
  function groupColor(g?: string) {
    return GROUPS.find((x) => x.key === g)?.color ?? 'var(--text-tertiary)'
  }

  const [tab, setTab]           = useState<CatTab>('expense')
  const [showAdd, setShowAdd]   = useState(false)
  const [name, setName]         = useState('')
  const [color, setColor]       = useState('#5bc8d0')
  const [iconName, setIconName] = useState('movimenti')
  const [group, setGroup]       = useState<CatGroup>('lifestyle')

  const visible = budgetCategories.filter((c) =>
    tab === 'income' ? c.type === 'income' : c.type === 'expense'
  )

  function handleAdd() {
    const n = name.trim()
    if (!n) return
    addBudgetCategory({
      name: n,
      emoji: '📋',
      color,
      monthlyBudget: 0,
      group: tab === 'income' ? 'income' : group,
      type: tab === 'income' ? 'income' : (group === 'transfers' ? 'transfer' : 'expense'),
      iconName,
    })
    setName('')
    setColor('#5bc8d0')
    setIconName('movimenti')
    setGroup('lifestyle')
    setShowAdd(false)
  }

  function resetAdd() {
    setShowAdd(false)
    setName('')
    setColor('#5bc8d0')
    setIconName('movimenti')
    setGroup('lifestyle')
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 18,
          width: 520,
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 22px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{t('catManagerTitle')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {visible.length} {tab === 'income' ? t('catTabIncome').toLowerCase() : t('catTabExpense').toLowerCase()} · {t('catManagerSub')}
            </div>
          </div>
          <button onClick={closeModal} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', padding: 6, borderRadius: 8,
            display: 'flex',
          }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '14px 22px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
            {(['expense', 'income'] as CatTab[]).map((tp) => (
              <button key={tp} onClick={() => { setTab(tp); resetAdd() }} style={{
                padding: '5px 22px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                background: tab === tp ? 'var(--bg-surface)' : 'transparent',
                color: tab === tp ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: tab === tp ? '0 1px 4px rgba(0,0,0,.25)' : 'none',
                transition: 'all .12s',
              }}>
                {tp === 'expense' ? t('catTabExpense') : t('catTabIncome')}
              </button>
            ))}
          </div>
        </div>

        {/* Category list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '10px 14px' }}>
          {visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
              {t('catEmpty')}
            </div>
          )}
          {visible.map((cat) => (
            <div
              key={cat.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 8px', borderRadius: 10, transition: 'background .1s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: `${cat.color}22`, color: cat.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={cat.iconName ?? 'movimenti'} size={17} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{cat.name}</div>
                {tab === 'expense' && cat.group && cat.group !== 'income' && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: groupColor(cat.group), marginTop: 1 }}>
                    {groupLabel(cat.group)}
                  </div>
                )}
              </div>
              <button
                onClick={() => deleteBudgetCategory(cat.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', padding: '4px 6px', borderRadius: 6,
                  display: 'flex', alignItems: 'center', transition: 'color .1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                title={tc('delete')}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Add form */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 22px 18px', flexShrink: 0 }}>
          {showAdd ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Name */}
              <input
                className="ledgernest-input"
                placeholder={t('catNamePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                autoFocus
                style={{ height: 36, padding: '4px 12px', fontSize: 14 }}
              />

              {/* Group picker (only for expenses) */}
              {tab === 'expense' && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{t('catGroupLabel')}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {GROUPS.map((g) => (
                      <button
                        key={g.key}
                        onClick={() => setGroup(g.key)}
                        style={{
                          flex: 1, padding: '6px 4px', borderRadius: 8, cursor: 'pointer',
                          border: `1.5px solid ${group === g.key ? g.color : 'transparent'}`,
                          background: group === g.key ? `${g.color}18` : 'var(--bg-elevated)',
                          color: group === g.key ? g.color : 'var(--text-secondary)',
                          fontSize: 11, fontWeight: 700, transition: 'all .12s',
                        }}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Icon picker */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{t('catIconLabel')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ICON_OPTIONS.map((ic) => (
                    <button key={ic} onClick={() => setIconName(ic)} style={{
                      width: 36, height: 36, borderRadius: 9, cursor: 'pointer',
                      background: iconName === ic ? `${color}28` : 'var(--bg-elevated)',
                      border: iconName === ic ? `1.5px solid ${color}` : '1.5px solid transparent',
                      color: iconName === ic ? color : 'var(--text-tertiary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .12s',
                    }}>
                      <Icon name={ic} size={16} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{t('catColorLabel')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {CAT_COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} style={{
                      width: 22, height: 22, borderRadius: '50%', background: c,
                      border: 'none', cursor: 'pointer',
                      outline: color === c ? `2.5px solid ${c}` : 'none',
                      outlineOffset: 2,
                      opacity: color === c ? 1 : 0.5,
                      transition: 'opacity .12s',
                    }} />
                  ))}
                </div>
              </div>

              {/* Preview + actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {name.trim() && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 14px 6px 8px', borderRadius: 10,
                    background: `${color}18`, border: `1px solid ${color}38`,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: `${color}28`, color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name={iconName} size={14} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {name.trim()}
                    </span>
                  </div>
                )}
                <div style={{ flex: 1 }} />
                <button
                  className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm"
                  onClick={resetAdd}
                >
                  {tc('cancel')}
                </button>
                <button
                  className="ledgernest-btn ledgernest-btn-primary ledgernest-btn-sm"
                  onClick={handleAdd}
                  disabled={!name.trim()}
                >
                  <Icon name="plus" size={13} /> {t('catAdd')}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm"
              onClick={() => setShowAdd(true)}
              style={{ width: '100%', justifyContent: 'center', gap: 6 }}
            >
              <Icon name="plus" size={13} />
              {tab === 'income' ? t('catNewIncome') : t('catNewExpense')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
