'use client'

import { useMemo, useState } from 'react'
import { useFinanceStore } from '@/stores/financeStore'
import { useUIStore } from '@/stores/uiStore'
import { fmtEur } from '@/lib/utils/format'
import CircularProgress from '@/components/charts/CircularProgress'
import Icon from '@/components/shared/Icon'
import { useTranslations } from 'next-intl'
import type { Goal } from '@/types'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDeadlineShort(deadline: string): string {
  const d = new Date(deadline + 'T12:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }).replace('.', '')
}

function monthsToCompletion(g: Goal): number | null {
  const remaining = g.targetAmount - g.currentAmount
  if (remaining <= 0) return 0
  if (!g.monthlyContribution) return null
  return Math.ceil(remaining / g.monthlyContribution)
}

function monthsUntilDeadline(deadline?: string): number | null {
  if (!deadline) return null
  const now = new Date()
  const d = new Date(deadline + 'T12:00:00')
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth())
}

function isShortTerm(g: Goal): boolean {
  const deadlineMonths = monthsUntilDeadline(g.deadline)
  const completionMonths = monthsToCompletion(g)
  const effective = deadlineMonths !== null ? deadlineMonths : (completionMonths ?? Infinity)
  return effective <= 24
}

function fmtScadenza(g: Goal, monthsLabel: string): string {
  if (g.deadline) return fmtDeadlineShort(g.deadline)
  const months = monthsToCompletion(g)
  if (months === null || months === 0) return '—'
  if (months > 120) return `~${new Date().getFullYear() + Math.round(months / 12)}`
  return `${months} ${monthsLabel}`
}

// ── Edit Modal ─────────────────────────────────────────────────────────────

const ICONS = ['🏖️', '🚗', '🏠', '📚', '💍', '✈️', '💻', '🎓', '🏋️', '🌍', '🎯', '🏕️', '🎸', '🐕', '👶', '🛥️']
const COLORS = ['#5bc8d0', '#7c6df7', '#f77c3a', '#3fb950', '#f85149', '#d29922', '#58a6ff', '#e879a8']

function EditGoalModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const tl = useTranslations('obiettivi')
  const { updateGoal } = useFinanceStore()
  const [name, setName] = useState(goal.name)
  const [icon, setIcon] = useState(goal.icon)
  const [color, setColor] = useState(goal.color)
  const [targetAmount, setTargetAmount] = useState(String(goal.targetAmount))
  const [currentAmount, setCurrentAmount] = useState(String(goal.currentAmount))
  const [monthlyContribution, setMonthlyContribution] = useState(String(goal.monthlyContribution))
  const [deadline, setDeadline] = useState(goal.deadline ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !targetAmount) return
    updateGoal(goal.id, {
      name, icon, color,
      targetAmount: parseFloat(targetAmount),
      currentAmount: parseFloat(currentAmount) || 0,
      monthlyContribution: parseFloat(monthlyContribution) || 0,
      deadline: deadline || undefined,
    })
    onClose()
  }

  return (
    <div className="ledgernest-modal-overlay" onClick={onClose}>
      <div className="ledgernest-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ledgernest-modal-header">
          <span className="ledgernest-modal-title">{tl('editTitle')}</span>
          <button className="ledgernest-modal-close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="ledgernest-modal-body">
            <div className="ledgernest-field">
              <label className="ledgernest-label">{tl('editName')}</label>
              <input className="ledgernest-input" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="ledgernest-field">
              <label className="ledgernest-label">{tl('editIcon')}</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ICONS.map((ic) => (
                  <button key={ic} type="button"
                    style={{ fontSize: 20, padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: icon === ic ? 'var(--accent-dim)' : 'var(--bg-elevated)', border: `1.5px solid ${icon === ic ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer' }}
                    onClick={() => setIcon(ic)}>{ic}</button>
                ))}
              </div>
            </div>
            <div className="ledgernest-field">
              <label className="ledgernest-label">{tl('editColor')}</label>
              <div className="ledgernest-accent-swatches">
                {COLORS.map((c) => (
                  <button key={c} type="button"
                    className={`ledgernest-accent-swatch${color === c ? ' active' : ''}`}
                    style={{ background: c }} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="ledgernest-field">
                <label className="ledgernest-label">{tl('editTarget')}</label>
                <input className="ledgernest-input ledgernest-mono" type="number" step="1" min="0" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} required />
              </div>
              <div className="ledgernest-field">
                <label className="ledgernest-label">{tl('editSaved')}</label>
                <input className="ledgernest-input ledgernest-mono" type="number" step="1" min="0" value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="ledgernest-field">
                <label className="ledgernest-label">{tl('editMonthly')}</label>
                <input className="ledgernest-input ledgernest-mono" type="number" step="1" min="0" value={monthlyContribution} onChange={(e) => setMonthlyContribution(e.target.value)} />
              </div>
              <div className="ledgernest-field">
                <label className="ledgernest-label">{tl('editDeadline')}</label>
                <input className="ledgernest-input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="ledgernest-modal-footer">
            <button type="button" className="ledgernest-btn ledgernest-btn-ghost" onClick={onClose}>{tl('cancel')}</button>
            <button type="submit" className="ledgernest-btn ledgernest-btn-primary">{tl('editSave')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Goal card (grid) ──────────────────────────────────────────────────────

function GoalCard({
  g, isFeatured,
  onEdit, onDelete, onSetFeatured,
}: {
  g: Goal
  isFeatured: boolean
  onEdit: () => void
  onDelete: () => void
  onSetFeatured: () => void
}) {
  const tl = useTranslations('obiettivi')
  const [hovered, setHovered] = useState(false)
  const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0
  const remaining = Math.max(0, g.targetAmount - g.currentAmount)
  const months = monthsToCompletion(g)
  const completed = remaining <= 0

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${isFeatured ? g.color : 'var(--border-subtle)'}`,
        borderRadius: 16,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transition: 'border-color .15s',
        position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Action buttons */}
      {hovered && (
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4, zIndex: 10 }}>
          <button
            onClick={onSetFeatured}
            title={isFeatured ? tl('featuredAlready') : tl('featuredSet')}
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: isFeatured ? `${g.color}30` : 'var(--bg-elevated)',
              color: isFeatured ? g.color : 'var(--text-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>★</button>
          <button
            onClick={onEdit}
            title={tl('cardEdit')}
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Icon name="edit" size={13} />
          </button>
          <button
            onClick={onDelete}
            title={tl('cardDelete')}
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--bg-elevated)', color: 'var(--danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Icon name="trash" size={13} />
          </button>
        </div>
      )}

      {/* Top: donut + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flexShrink: 0 }}>
          <CircularProgress value={pct} size={78} thickness={7} color={g.color} label={`${Math.round(pct)}%`} fontSize={13} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: `${g.color}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
            }}>
              {g.icon}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {g.name}
            </div>
          </div>
          {completed ? (
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', background: 'var(--success-dim)', padding: '2px 8px', borderRadius: 5, display: 'inline-block' }}>
              {tl('statusCompleted')}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {isShortTerm(g) ? (
                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{tl('statusShortTerm')}</span>
              ) : (
                <span>{tl('statusLongTerm')}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: tl('statsActual'),   value: fmtEur(g.currentAmount) },
          { label: tl('statsTarget'),   value: fmtEur(g.targetAmount) },
          { label: tl('statsMonthly'),  value: g.monthlyContribution > 0 ? fmtEur(g.monthlyContribution) : '—' },
          { label: tl('statsDeadline'), value: fmtScadenza(g, tl('statsMonths')) },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: 3, whiteSpace: 'nowrap' }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar + mancano */}
      <div>
        <div style={{ height: 5, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: g.color, borderRadius: 99, transition: 'width 0.6s' }} />
        </div>
        {!completed && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
            {tl('statsRemaining', { rem: fmtEur(remaining), months: months ?? 0 })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Delete confirm ─────────────────────────────────────────────────────────

function DeleteConfirm({ goal, onConfirm, onCancel }: { goal: Goal; onConfirm: () => void; onCancel: () => void }) {
  const tl = useTranslations('obiettivi')
  return (
    <div className="ledgernest-modal-overlay" onClick={onCancel}>
      <div className="ledgernest-modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <div className="ledgernest-modal-header">
          <span className="ledgernest-modal-title">{tl('deleteTitle')}</span>
          <button className="ledgernest-modal-close" onClick={onCancel}><Icon name="close" size={16} /></button>
        </div>
        <div className="ledgernest-modal-body">
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
            {tl('deleteMessage', { icon: goal.icon, name: goal.name })}
          </p>
        </div>
        <div className="ledgernest-modal-footer">
          <button className="ledgernest-btn ledgernest-btn-ghost" onClick={onCancel}>{tl('cancel')}</button>
          <button className="ledgernest-btn" style={{ background: 'var(--danger)', color: '#fff' }} onClick={onConfirm}>{tl('delete')}</button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ObiettiviPage() {
  const tl = useTranslations('obiettivi')
  const { goals, featuredGoalId, deleteGoal, setFeaturedGoal } = useFinanceStore()
  const { openModal } = useUIStore()
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null)

  const active = goals.filter((g) => g.currentAmount < g.targetAmount)
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
  const totalMonthly = goals.reduce((s, g) => s + g.monthlyContribution, 0)
  const shortTermCount = active.filter(isShortTerm).length
  const longTermCount = active.length - shortTermCount

  const avgMonths = useMemo(() => {
    const withMonthly = active.filter((g) => g.monthlyContribution > 0)
    if (withMonthly.length === 0) return null
    const total = withMonthly.reduce((s, g) => s + (monthsToCompletion(g) ?? 0), 0)
    return Math.round(total / withMonthly.length)
  }, [active.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Featured: explicit choice, else first goal
  const featured = (featuredGoalId ? goals.find((g) => g.id === featuredGoalId) : null) ?? goals[0] ?? null
  const featuredPct = featured ? Math.min(100, (featured.currentAmount / featured.targetAmount) * 100) : 0
  const featuredMonths = featured ? monthsToCompletion(featured) : null

  function handleDelete(goal: Goal) {
    deleteGoal(goal.id)
    setDeletingGoal(null)
  }

  if (goals.length === 0) {
    return (
      <div className="ledgernest-card" style={{ marginTop: 40 }}>
        <div className="ledgernest-empty">
          <div className="ledgernest-empty-icon">🎯</div>
          <div>{tl('emptyTitle')}</div>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', maxWidth: 320, textAlign: 'center' }}>
            {tl('emptyDesc')}
          </p>
          <button className="ledgernest-btn ledgernest-btn-primary" onClick={() => openModal('goal')}>
            <Icon name="plus" size={14} /> {tl('emptyButton')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {editingGoal && <EditGoalModal goal={editingGoal} onClose={() => setEditingGoal(null)} />}
      {deletingGoal && (
        <DeleteConfirm
          goal={deletingGoal}
          onConfirm={() => handleDelete(deletingGoal)}
          onCancel={() => setDeletingGoal(null)}
        />
      )}

      {/* ── KPI strip ─────────────────────────────────────────── */}
      <div className="ledgernest-kpi-strip">
        <div className="ledgernest-kpi-cell is-accent">
          <div className="ledgernest-kpi-label">{tl('kpiSaved')}</div>
          <div className="ledgernest-kpi-value">{fmtEur(totalSaved)}</div>
          <div className="ledgernest-kpi-sub">
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
              {totalTarget > 0 ? ((totalSaved / totalTarget) * 100).toFixed(1) : '0'}% {tl('kpiOfTarget')}
            </span>
            <span>{tl('kpiOfTargetAmount', { target: fmtEur(totalTarget) })}</span>
          </div>
        </div>
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">{tl('kpiActive')}</div>
          <div className="ledgernest-kpi-value">{active.length}</div>
          <div className="ledgernest-kpi-sub">
            {shortTermCount > 0 && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{tl('kpiShortTerm', { n: shortTermCount })}</span>}
            {shortTermCount > 0 && longTermCount > 0 && <span style={{ color: 'var(--text-tertiary)' }}>&nbsp;&nbsp;</span>}
            {longTermCount > 0 && <span>{tl('kpiLongTerm', { n: longTermCount })}</span>}
          </div>
        </div>
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">{tl('kpiMonthly')}</div>
          <div className="ledgernest-kpi-value">{fmtEur(totalMonthly)}</div>
          <div className="ledgernest-kpi-sub">
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>{tl('kpiAutomatic')}</span>
            <span>{tl('kpiAllGoals')}</span>
          </div>
        </div>
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">{tl('kpiTime')}</div>
          <div className="ledgernest-kpi-value">{avgMonths !== null ? `${avgMonths} ${tl('statsMonths')}` : '—'}</div>
          <div className="ledgernest-kpi-sub">
            <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{tl('kpiToCompletion')}</span>
            <span>{tl('kpiWeightedAvg')}</span>
          </div>
        </div>
      </div>

      {/* ── Featured goal ──────────────────────────────────────── */}
      {featured && (
        <div style={{
          background: `linear-gradient(135deg, color-mix(in oklch, ${featured.color} 10%, var(--bg-surface)) 0%, var(--bg-surface) 55%)`,
          border: `1px solid color-mix(in oklch, ${featured.color} 35%, var(--border-subtle))`,
          borderRadius: 18,
          padding: '28px 32px',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 40,
          alignItems: 'center',
        }} className="ledgernest-obj-featured">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 99, background: featured.color, color: '#fff', whiteSpace: 'nowrap' }}>
                {tl('featuredTitle')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {goals.length > 1 && (
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                    {tl('featuredEmpty')}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{featured.name}</div>
              <div style={{ fontSize: 28, flexShrink: 0 }}>{featured.icon}</div>
            </div>
            <div className="ledgernest-obj-stats" style={{ display: 'flex', gap: 40 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmtEur(featured.currentAmount)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{tl('featuredOf', { target: fmtEur(featured.targetAmount) })}</div>
              </div>
              {featured.monthlyContribution > 0 && (
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmtEur(featured.monthlyContribution)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{tl('featuredMonthly')}</div>
                </div>
              )}
              {featuredMonths !== null && featuredMonths > 0 && (
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{featuredMonths} {tl('statsMonths')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
                    {featured.deadline ? tl('featuredBy', { date: fmtDeadlineShort(featured.deadline) }) : tl('featuredPace')}
                  </div>
                </div>
              )}
            </div>
            <div style={{ height: 6, borderRadius: 99, background: `${featured.color}28`, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, featuredPct)}%`, background: featured.color, borderRadius: 99, transition: 'width 0.6s' }} />
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <CircularProgress value={featuredPct} size={180} thickness={14} color={featured.color} label={`${Math.round(featuredPct)}%`} sublabel={tl('featuredCompleted')} fontSize={32} />
          </div>
        </div>
      )}

      {/* ── All goals ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{tl('sectionTitle', { n: goals.length })}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{tl('sectionSubtitle')}</div>
        </div>
        <button className="ledgernest-btn ledgernest-btn-primary" onClick={() => openModal('goal')} style={{ gap: 6 }}>
          <Icon name="plus" size={13} /> {tl('newButton')}
        </button>
      </div>

      <div className="ledgernest-obj-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            g={g}
            isFeatured={featured?.id === g.id}
            onEdit={() => setEditingGoal(g)}
            onDelete={() => setDeletingGoal(g)}
            onSetFeatured={() => setFeaturedGoal(g.id)}
          />
        ))}
      </div>
    </div>
  )
}
