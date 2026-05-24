'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { useFinanceStore } from '@/stores/financeStore'
import { fmtEur } from '@/lib/utils/format'
import Icon from '@/components/shared/Icon'
import { CategoryPicker } from '@/components/shared/CategoryPicker'
import type { RecurringItem } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────

const MULTIPLIERS: Record<string, number> = {
  daily: 30, weekly: 4.33, biweekly: 2.17, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12,
}

const FREQ_LABEL: Record<string, string> = {
  daily: 'Giornaliero', weekly: 'Settimanale', biweekly: 'Bisettimanale',
  monthly: 'Mensile', quarterly: 'Trimestrale', yearly: 'Annuale',
}

const FREQ_GROUP: Record<string, string> = {
  daily: 'GIORNALIERO', weekly: 'SETTIMANALE', biweekly: 'BISETTIMANALE',
  monthly: 'MENSILE', quarterly: 'TRIMESTRALE', yearly: 'ANNUALE',
}

const IT_MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const IT_MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const IT_DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

// ── Helpers ───────────────────────────────────────────────────────────────

function monthlyNorm(item: RecurringItem): number {
  return item.amount * (MULTIPLIERS[item.frequency] ?? 1)
}

// Returns dates (as YYYY-MM-DD strings) when this item occurs in a given month
function getMonthOccurrences(item: RecurringItem, year: number, month: number): string[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const results: string[] = []
  const base = new Date(item.nextDate + 'T12:00:00')

  for (let d = 1; d <= daysInMonth; d++) {
    const candidate = new Date(year, month, d)
    const diff = Math.round((candidate.getTime() - base.getTime()) / 86400000)

    let hit = false
    if (item.frequency === 'daily') hit = true
    else if (item.frequency === 'weekly') hit = diff % 7 === 0
    else if (item.frequency === 'biweekly') hit = diff % 14 === 0
    else if (item.frequency === 'monthly') hit = candidate.getDate() === base.getDate()
    else if (item.frequency === 'quarterly') {
      hit = candidate.getDate() === base.getDate() &&
        ((candidate.getMonth() - base.getMonth() + 12) % 3 === 0)
    } else if (item.frequency === 'yearly') {
      hit = candidate.getDate() === base.getDate() && candidate.getMonth() === base.getMonth()
    }

    if (hit) {
      results.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
  }
  return results
}

function getNextOccurrences(item: RecurringItem, fromDate: Date, days: number): Date[] {
  const results: Date[] = []
  const end = new Date(fromDate)
  end.setDate(end.getDate() + days)
  const base = new Date(item.nextDate + 'T12:00:00')

  for (let d = 0; d < days; d++) {
    const candidate = new Date(fromDate)
    candidate.setDate(candidate.getDate() + d)
    const diff = Math.round((candidate.getTime() - base.getTime()) / 86400000)

    let hit = false
    if (item.frequency === 'daily') hit = true
    else if (item.frequency === 'weekly') hit = diff % 7 === 0
    else if (item.frequency === 'biweekly') hit = diff % 14 === 0
    else if (item.frequency === 'monthly') hit = candidate.getDate() === base.getDate()
    else if (item.frequency === 'quarterly') {
      hit = candidate.getDate() === base.getDate() &&
        ((candidate.getMonth() - base.getMonth() + 12) % 3 === 0)
    } else if (item.frequency === 'yearly') {
      hit = candidate.getDate() === base.getDate() && candidate.getMonth() === base.getMonth()
    }

    if (hit && candidate <= end) results.push(new Date(candidate))
  }
  return results
}

function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${String(d.getDate()).padStart(2, '0')} ${IT_MONTHS_SHORT[d.getMonth()].toLowerCase()}`
}

function fmtCreatedAt(dateStr: string): string {
  const d = new Date(dateStr)
  return `${IT_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Next occurrence from today (within 90 days), or nextDate as fallback
function getNextOccurrenceDate(item: RecurringItem): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dates = getNextOccurrences(item, today, 90)
  if (dates.length > 0) return toYMD(dates[0])
  return item.nextDate
}

// ── Category icon square ──────────────────────────────────────────────────

function CatIcon({ emoji, color, size = 32 }: { emoji: string; color: string; size?: number }) {
  const inner = Math.round(size * 0.55)
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28), flexShrink: 0,
      background: `${color}28`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: inner,
    }}>
      {emoji || '🔁'}
    </div>
  )
}

// ── Add Modal ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)',
  background: 'var(--bg-elevated)', color: 'var(--text-primary)', width: '100%',
  boxSizing: 'border-box', fontSize: 13,
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 5,
}

function AddModal({ onClose }: { onClose: () => void }) {
  const { addRecurring, accounts, budgetCategories } = useFinanceStore()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<RecurringItem['frequency']>('monthly')
  const [nextDate, setNextDate] = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState(budgetCategories.find((c) => c.type === 'expense')?.name ?? '')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const modalRef = useRef<HTMLDivElement>(null)

  const selectedCat = budgetCategories.find((c) => c.name === category || c.id === category)

  function handleSubmit() {
    if (!name || !amount) return
    const emoji = selectedCat?.emoji ?? '🔁'
    addRecurring({ name, emoji, amount: parseFloat(amount), frequency, nextDate, category, accountId, type, active: true })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 28, width: 480, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Nuovo ricorrente</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Type toggle */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['expense', 'income'] as const).map((t) => (
            <button key={t} onClick={() => { setType(t); setCategory('') }} style={{
              flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid',
              borderColor: type === t ? (t === 'expense' ? 'var(--danger)' : 'var(--success)') : 'var(--border-subtle)',
              background: type === t ? (t === 'expense' ? 'color-mix(in oklch, var(--danger) 15%, transparent)' : 'color-mix(in oklch, var(--success) 15%, transparent)') : 'transparent',
              color: type === t ? (t === 'expense' ? 'var(--danger)' : 'var(--success)') : 'var(--text-secondary)',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
              {t === 'expense' ? '− Uscita' : '+ Entrata'}
            </button>
          ))}
        </div>

        {/* Name */}
        <div>
          <div style={labelStyle}>Nome</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Affitto, Netflix, Stipendio…" style={inputStyle} />
        </div>

        {/* Amount + frequency */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={labelStyle}>Importo (€)</div>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="0,00" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Frequenza</div>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringItem['frequency'])} style={inputStyle}>
              {Object.entries(FREQ_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Next date + account */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={labelStyle}>Prima scadenza</div>
            <input value={nextDate} onChange={(e) => setNextDate(e.target.value)} type="date" style={inputStyle} />
          </div>
          {accounts.length > 0 && (
            <div>
              <div style={labelStyle}>Conto</div>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inputStyle}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Category picker */}
        <div>
          <div style={labelStyle}>Categoria</div>
          <CategoryPicker value={category} onChange={setCategory} typeFilter={type} containerRef={modalRef} />
        </div>

        <button onClick={handleSubmit} className="ledgernest-btn ledgernest-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
          Aggiungi ricorrente
        </button>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────

function DeleteConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '28px 32px', width: 380, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Conferma eliminazione</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="ledgernest-btn ledgernest-btn-ghost" onClick={onCancel}>Annulla</button>
          <button
            className="ledgernest-btn"
            style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '8px 18px', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}
            onClick={onConfirm}
          >
            Elimina
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────────────────

function EditRecurringModal({ item, onClose }: { item: RecurringItem; onClose: () => void }) {
  const { updateRecurring, accounts, budgetCategories } = useFinanceStore()
  const [name, setName] = useState(item.name)
  const [amount, setAmount] = useState(String(item.amount))
  const [frequency, setFrequency] = useState<RecurringItem['frequency']>(item.frequency)
  const [nextDate, setNextDate] = useState(item.nextDate)
  const [category, setCategory] = useState(item.category)
  const [accountId, setAccountId] = useState(item.accountId)
  const [type, setType] = useState<'income' | 'expense'>(item.type)
  const modalRef = useRef<HTMLDivElement>(null)

  const selectedCat = budgetCategories.find((c) => c.name === category || c.id === category)

  function handleSave() {
    if (!name || !amount) return
    const emoji = selectedCat?.emoji ?? item.emoji ?? '🔁'
    updateRecurring(item.id, { name, emoji, amount: parseFloat(amount), frequency, nextDate, category, accountId, type })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 28, width: 480, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Modifica ricorrente</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Type toggle */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['expense', 'income'] as const).map((t) => (
            <button key={t} onClick={() => { setType(t); setCategory('') }} style={{
              flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid',
              borderColor: type === t ? (t === 'expense' ? 'var(--danger)' : 'var(--success)') : 'var(--border-subtle)',
              background: type === t ? (t === 'expense' ? 'color-mix(in oklch, var(--danger) 15%, transparent)' : 'color-mix(in oklch, var(--success) 15%, transparent)') : 'transparent',
              color: type === t ? (t === 'expense' ? 'var(--danger)' : 'var(--success)') : 'var(--text-secondary)',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
              {t === 'expense' ? '− Uscita' : '+ Entrata'}
            </button>
          ))}
        </div>

        {/* Name */}
        <div>
          <div style={labelStyle}>Nome</div>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>

        {/* Amount + frequency */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={labelStyle}>Importo (€)</div>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Frequenza</div>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringItem['frequency'])} style={inputStyle}>
              {Object.entries(FREQ_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Next date + account */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={labelStyle}>Prossima scadenza</div>
            <input value={nextDate} onChange={(e) => setNextDate(e.target.value)} type="date" style={inputStyle} />
          </div>
          {accounts.length > 0 && (
            <div>
              <div style={labelStyle}>Conto</div>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inputStyle}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Category picker */}
        <div>
          <div style={labelStyle}>Categoria</div>
          <CategoryPicker value={category} onChange={setCategory} typeFilter={type} containerRef={modalRef} />
        </div>

        <button onClick={handleSave} className="ledgernest-btn ledgernest-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
          Salva modifiche
        </button>
      </div>
    </div>
  )
}

// ── Calendar ──────────────────────────────────────────────────────────────

function MonthCalendar({ items, year, month }: { items: RecurringItem[]; year: number; month: number }) {
  const today = new Date()
  const todayStr = toYMD(today)
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Monday-first day of week (0=Mon...6=Sun)
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7

  // Build occurrence map: date string → items
  const occMap = useMemo(() => {
    const map: Record<string, RecurringItem[]> = {}
    for (const item of items) {
      if (!item.active) continue
      const dates = getMonthOccurrences(item, year, month)
      for (const d of dates) {
        if (!map[d]) map[d] = []
        map[d].push(item)
      }
    }
    return map
  }, [items, year, month])

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
        Calendario di {IT_MONTHS[month]}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {IT_DAYS.map((d) => (
          <div key={d} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'center', paddingBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayItems = occMap[dateStr] ?? []
          const isToday = dateStr === todayStr
          return (
            <div key={dateStr} style={{
              minHeight: 48, borderRadius: 8, padding: '4px 3px',
              background: isToday ? 'color-mix(in oklch, var(--accent) 12%, var(--bg-elevated))' : 'var(--bg-elevated)',
              border: isToday ? '1.5px solid var(--accent)' : '1px solid transparent',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <div style={{ fontSize: 10, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--accent)' : 'var(--text-secondary)', textAlign: 'right', paddingRight: 3 }}>{day}</div>
              {dayItems.slice(0, 3).map((item) => (
                <div key={item.id} title={item.name} style={{
                  fontSize: 9, borderRadius: 4, padding: '1px 3px',
                  background: item.type === 'expense' ? 'color-mix(in oklch, var(--danger) 20%, transparent)' : 'color-mix(in oklch, var(--success) 20%, transparent)',
                  color: item.type === 'expense' ? 'var(--danger)' : 'var(--success)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  fontWeight: 600,
                }}>
                  {item.emoji} {item.type === 'expense' ? '-' : '+'}{Math.round(item.amount)}
                </div>
              ))}
              {dayItems.length > 3 && (
                <div style={{ fontSize: 8, color: 'var(--text-tertiary)', paddingLeft: 3 }}>+{dayItems.length - 3}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Upcoming panel ────────────────────────────────────────────────────────

function UpcomingPanel({ items }: { items: RecurringItem[] }) {
  const { budgetCategories, accounts } = useFinanceStore()

  const upcoming = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const results: { item: RecurringItem; date: Date }[] = []
    for (const item of items) {
      if (!item.active) continue
      const dates = getNextOccurrences(item, today, 15)
      for (const d of dates) results.push({ item, date: d })
    }
    results.sort((a, b) => a.date.getTime() - b.date.getTime())
    return results.slice(0, 12)
  }, [items])

  function getCatName(id: string) {
    return budgetCategories.find((c) => c.id === id)?.name ?? id
  }
  function getAcctName(id: string) {
    return accounts.find((a) => a.id === id)?.name ?? id
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Prossimi 14 giorni</div>
      {upcoming.length === 0 ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Nessuna scadenza</div>
      ) : upcoming.map(({ item, date }, idx) => (
        <div key={`${item.id}-${idx}`} style={{
          display: 'grid', gridTemplateColumns: '44px 1fr auto',
          alignItems: 'center', gap: 10,
          padding: '9px 0',
          borderBottom: idx < upcoming.length - 1 ? '1px solid var(--border-subtle)' : 'none',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', lineHeight: 1 }}>
              {IT_MONTHS_SHORT[date.getMonth()].toUpperCase()}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)' }}>
              {date.getDate()}
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{item.emoji}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getCatName(item.category)} · {getAcctName(item.accountId)}
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, color: item.type === 'expense' ? 'var(--danger)' : 'var(--success)', whiteSpace: 'nowrap' }}>
            {item.type === 'expense' ? '-' : '+'}{fmtEur(item.amount)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Row kebab menu ────────────────────────────────────────────────────────

function RecurringRowMenu({ item, onEdit, onDelete }: { item: RecurringItem; onEdit: (r: RecurringItem) => void; onDelete: (r: RecurringItem) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen((v) => !v)
  }

  const menuItem: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '7px 12px', borderRadius: 7, border: 'none', background: 'none',
    cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
      >
        <Icon name="kebab" size={14} />
      </button>
      {open && (
        <div ref={menuRef} style={{ position: 'fixed', top: pos.top, right: pos.right, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 4, minWidth: 140, boxShadow: '0 8px 32px rgba(0,0,0,0.45)', zIndex: 9999 }}>
          <button onClick={() => { setOpen(false); onEdit(item) }} style={{ ...menuItem, color: 'var(--text-primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
            <Icon name="edit" size={13} /> Modifica
          </button>
          <button onClick={() => { setOpen(false); onDelete(item) }} style={{ ...menuItem, color: 'var(--danger)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in oklch, var(--danger) 10%, transparent)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
            <Icon name="trash" size={13} /> Elimina
          </button>
        </div>
      )}
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────

const COL = '36px 1fr 140px 100px 90px 80px 95px 120px 72px'

const colHeaderStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
}

function RecurringTable({
  items, freqFilter, typeFilter,
  onFreqFilter, onTypeFilter, onAdd, onEdit, onDelete,
}: {
  items: RecurringItem[]
  freqFilter: string
  typeFilter: string
  onFreqFilter: (f: string) => void
  onTypeFilter: (t: string) => void
  onAdd: () => void
  onEdit: (item: RecurringItem) => void
  onDelete: (item: RecurringItem) => void
}) {
  const { budgetCategories, accounts } = useFinanceStore()
  const today = toYMD(new Date())

  function getCat(id: string) { return budgetCategories.find((c) => c.id === id) }
  function getAcct(id: string) { return accounts.find((a) => a.id === id) }

  const filtered = useMemo(() => {
    return items
      .filter((r) => freqFilter === 'all' || r.frequency === freqFilter)
      .filter((r) => typeFilter === 'all' || r.type === typeFilter)
  }, [items, freqFilter, typeFilter])

  const grouped = useMemo(() => {
    const freqOrder = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']
    const map: Record<string, RecurringItem[]> = {}
    for (const item of filtered) {
      if (!map[item.frequency]) map[item.frequency] = []
      map[item.frequency].push(item)
    }
    return freqOrder.filter((f) => map[f]?.length).map((f) => ({ freq: f, items: map[f] }))
  }, [filtered])

  const FREQ_CHIPS = [
    { key: 'all', label: 'Tutte' },
    { key: 'monthly', label: 'Mensili' },
    { key: 'yearly', label: 'Annuali' },
    { key: 'quarterly', label: 'Trimestrali' },
  ]
  const TYPE_CHIPS = [
    { key: 'all', label: 'Tutti' },
    { key: 'expense', label: 'Uscite' },
    { key: 'income', label: 'Entrate' },
  ]

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Tutte le ricorrenze · {filtered.length}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 10, padding: 3 }}>
            {FREQ_CHIPS.map(({ key, label }) => (
              <button key={key} onClick={() => onFreqFilter(key)} style={{
                padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: freqFilter === key ? 'var(--bg-surface)' : 'transparent',
                color: freqFilter === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontWeight: freqFilter === key ? 700 : 500, fontSize: 12,
                boxShadow: freqFilter === key ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
              }}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 10, padding: 3 }}>
            {TYPE_CHIPS.map(({ key, label }) => (
              <button key={key} onClick={() => onTypeFilter(key)} style={{
                padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: typeFilter === key ? 'var(--bg-surface)' : 'transparent',
                color: typeFilter === key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontWeight: typeFilter === key ? 700 : 500, fontSize: 12,
                boxShadow: typeFilter === key ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
              }}>{label}</button>
            ))}
          </div>
          <button className="ledgernest-btn ledgernest-btn-primary" onClick={onAdd} style={{ gap: 6, padding: '7px 14px' }}>
            <Icon name="plus" size={13} /> Aggiungi
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="ledgernest-empty" style={{ padding: '40px 0' }}>
          <div className="ledgernest-empty-icon">🔁</div>
          Nessun ricorrente
        </div>
      ) : grouped.map(({ freq, items: gItems }) => {
        const groupTotal = gItems.reduce((s, r) => s + (r.type === 'expense' ? -1 : 1) * monthlyNorm(r), 0)
        return (
          <div key={freq}>
            {/* Section header */}
            <div style={{ padding: '7px 20px', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                {FREQ_GROUP[freq]} · {gItems.length} {gItems.length === 1 ? 'VOCE' : 'VOCI'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: groupTotal >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {groupTotal >= 0 ? '+' : '−'}{fmtEur(Math.abs(groupTotal))}
              </div>
            </div>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: COL, gap: 12, padding: '6px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div />
              <div style={colHeaderStyle}>Nome</div>
              <div style={colHeaderStyle}>Categoria</div>
              <div style={colHeaderStyle}>Conto</div>
              <div style={colHeaderStyle}>Frequenza</div>
              <div style={colHeaderStyle}>Prossimo</div>
              <div style={colHeaderStyle}>Stato</div>
              <div style={{ ...colHeaderStyle, textAlign: 'right' }}>Importo</div>
              <div />
            </div>

            {/* Data rows */}
            {gItems.map((r, idx) => {
              const cat = getCat(r.category)
              const acct = getAcct(r.accountId)
              const nextDate = getNextOccurrenceDate(r)
              const isPast = nextDate <= today
              return (
                <div key={r.id} style={{
                  display: 'grid', gridTemplateColumns: COL,
                  gap: 12, alignItems: 'center',
                  padding: '10px 20px',
                  borderBottom: idx < gItems.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  opacity: r.active ? 1 : 0.45,
                }}>
                  {/* Category icon */}
                  <CatIcon emoji={cat?.emoji ?? '🔁'} color={cat?.color ?? '#888'} size={32} />

                  {/* Name + active-from */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                    {r.createdAt && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                        attivo da {fmtCreatedAt(r.createdAt)}
                      </div>
                    )}
                  </div>

                  {/* Category badge */}
                  {cat ? (
                    <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: `${cat.color}20`, color: cat.color, whiteSpace: 'nowrap', width: 'fit-content' }}>
                      {cat.name}
                    </div>
                  ) : <div />}

                  {/* Account */}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {acct?.name ?? '—'}
                  </div>

                  {/* Frequency */}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {FREQ_LABEL[r.frequency]}
                  </div>

                  {/* Next date */}
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {fmtDateShort(nextDate)}
                  </div>

                  {/* Status badge */}
                  <div style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6,
                    background: isPast
                      ? 'color-mix(in oklch, var(--success) 15%, transparent)'
                      : 'color-mix(in oklch, var(--warning) 15%, transparent)',
                    color: isPast ? 'var(--success)' : 'var(--warning)',
                    whiteSpace: 'nowrap', width: 'fit-content',
                  }}>
                    {isPast ? 'pagato' : 'previsto'}
                  </div>

                  {/* Amount */}
                  <div style={{ fontWeight: 700, fontSize: 13, color: r.type === 'expense' ? 'var(--danger)' : 'var(--success)', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {r.type === 'expense' ? '−' : '+'}{fmtEur(r.amount)}
                  </div>

                  {/* Actions kebab */}
                  <RecurringRowMenu item={r} onEdit={onEdit} onDelete={onDelete} />
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function RicorrentiPage() {
  const { recurringItems, deleteRecurring } = useFinanceStore()
  const [showModal, setShowModal] = useState(false)
  const [freqFilter, setFreqFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [editingItem, setEditingItem] = useState<RecurringItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<RecurringItem | null>(null)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const active = recurringItems.filter((r) => r.active)

  const monthlyExpenses = useMemo(() =>
    active.filter((r) => r.type === 'expense').reduce((s, r) => s + monthlyNorm(r), 0),
    [active.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const monthlyIncome = useMemo(() =>
    active.filter((r) => r.type === 'income').reduce((s, r) => s + monthlyNorm(r), 0),
    [active.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const netMonthly = monthlyIncome - monthlyExpenses
  const expenseCount = active.filter((r) => r.type === 'expense').length
  const incomeCount = active.filter((r) => r.type === 'income').length

  const yearlyTotal = useMemo(() =>
    active.filter((r) => r.frequency === 'yearly' || r.frequency === 'quarterly')
      .reduce((s, r) => s + r.amount * (r.frequency === 'yearly' ? 1 : 4), 0),
    [active.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const yearlyCount = active.filter((r) => r.frequency === 'yearly' || r.frequency === 'quarterly').length

  const incomePct = monthlyIncome > 0 ? ((netMonthly / monthlyIncome) * 100).toFixed(0) : '0'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {showModal && <AddModal onClose={() => setShowModal(false)} />}
      {editingItem && <EditRecurringModal item={editingItem} onClose={() => setEditingItem(null)} />}
      {deletingItem && (
        <DeleteConfirmModal
          message={`Eliminare "${deletingItem.name}"? Questa azione non è reversibile.`}
          onConfirm={() => { deleteRecurring(deletingItem.id); setDeletingItem(null) }}
          onCancel={() => setDeletingItem(null)}
        />
      )}

      {/* KPI strip */}
      <div className="ledgernest-kpi-strip">
        <div className="ledgernest-kpi-cell is-accent">
          <div className="ledgernest-kpi-label">Uscite mensili</div>
          <div className="ledgernest-kpi-value" style={{ color: 'var(--danger)' }}>{fmtEur(monthlyExpenses)}</div>
          <div className="ledgernest-kpi-sub">
            <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{expenseCount} addebiti</span>
            <span>ricorrenze fisse</span>
          </div>
        </div>
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">Entrate mensili</div>
          <div className="ledgernest-kpi-value" style={{ color: 'var(--success)' }}>{fmtEur(monthlyIncome)}</div>
          <div className="ledgernest-kpi-sub">
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>{incomeCount} fonti</span>
            <span>stipendio + rimborsi</span>
          </div>
        </div>
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">Saldo netto mensile</div>
          <div className="ledgernest-kpi-value" style={{ color: netMonthly >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {netMonthly >= 0 ? '+' : ''}{fmtEur(netMonthly)}
          </div>
          <div className="ledgernest-kpi-sub">
            <span style={{ color: netMonthly >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
              {netMonthly >= 0 ? '+' : ''}{incomePct}% del reddito
            </span>
          </div>
        </div>
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">Annuale (in scadenza)</div>
          <div className="ledgernest-kpi-value">{fmtEur(yearlyTotal)}</div>
          <div className="ledgernest-kpi-sub">
            <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{yearlyCount} voci</span>
            <span>annuali + trimestrali</span>
          </div>
        </div>
      </div>

      {/* Calendar + Upcoming */}
      <div className="ledgernest-rec-calendar" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <MonthCalendar items={recurringItems} year={year} month={month} />
        <UpcomingPanel items={recurringItems} />
      </div>

      {/* Full table */}
      <RecurringTable
        items={recurringItems}
        freqFilter={freqFilter}
        typeFilter={typeFilter}
        onFreqFilter={setFreqFilter}
        onTypeFilter={setTypeFilter}
        onAdd={() => setShowModal(true)}
        onEdit={setEditingItem}
        onDelete={setDeletingItem}
      />
    </div>
  )
}
