'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useFinanceStore } from '@/stores/financeStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useUIStore } from '@/stores/uiStore'
import { fmtEur } from '@/lib/utils/format'
import Icon from '@/components/shared/Icon'
import Sparkline from '@/components/charts/Sparkline'
import type { Account } from '@/types'

// Deterministic synthetic sparkline (no random each render)
function buildSparkline(seed: number, positive: boolean): number[] {
  const base = 100
  return Array.from({ length: 14 }, (_, i) => {
    const x = Math.sin(seed + i * 0.7) * 3 + Math.cos(seed * 2 + i * 1.2) * 2
    const trend = positive ? i * 0.3 : -i * 0.3
    return base + trend + x
  })
}

const inputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)',
  background: 'var(--bg-elevated)', color: 'var(--text-primary)', width: '100%',
  boxSizing: 'border-box', fontSize: 13,
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 5,
}

function DeleteConfirmModal({ message, onConfirm, onCancel, title, cancelLabel, deleteLabel }: { message: string; onConfirm: () => void; onCancel: () => void; title: string; cancelLabel: string; deleteLabel: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '28px 32px', width: 380, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="ledgernest-btn ledgernest-btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button
            className="ledgernest-btn"
            style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '8px 18px', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}
            onClick={onConfirm}
          >
            {deleteLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditAccountModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const t = useTranslations('conti')
  const { updateAccount } = useFinanceStore()
  const [name, setName] = useState(account.name)
  const [type, setType] = useState<Account['type']>(account.type)
  const [balance, setBalance] = useState(String(account.balance))
  const [currency, setCurrency] = useState<'EUR' | 'USD'>(account.currency)
  const [broker, setBroker] = useState(account.broker ?? '')
  const [iban, setIban] = useState(account.iban ?? '')
  const [note, setNote] = useState(account.note ?? '')

  const TYPE_CONFIG_LOCAL: Record<Account['type'], { label: string; color: string; bg: string }> = {
    bank:   { label: t('typeBankLabel'),   color: '#58a6ff', bg: 'rgba(88,166,255,.15)' },
    broker: { label: t('typeBrokerLabel'), color: '#2dd4bf', bg: 'rgba(45,212,191,.15)' },
    crypto: { label: t('typeCryptoLabel'), color: '#f77c3a', bg: 'rgba(247,124,58,.15)' },
    other:  { label: t('typeOtherLabel'),  color: '#7c6df7', bg: 'rgba(124,109,247,.15)' },
  }

  function handleSave() {
    if (!name.trim()) return
    updateAccount(account.id, {
      name: name.trim(),
      type,
      balance: parseFloat(balance) || 0,
      currency,
      broker: broker.trim() || undefined,
      iban: iban.trim() || undefined,
      note: note.trim() || undefined,
    })
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, padding: 28, width: 480, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{t('editTitle')}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Type */}
        <div>
          <div style={labelStyle}>{t('editType')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {(['bank', 'broker', 'crypto', 'other'] as Account['type'][]).map((tp) => (
              <button key={tp} onClick={() => setType(tp)} style={{
                padding: '8px 4px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${type === tp ? TYPE_CONFIG_LOCAL[tp].color : 'var(--border-subtle)'}`,
                background: type === tp ? TYPE_CONFIG_LOCAL[tp].bg : 'transparent',
                color: type === tp ? TYPE_CONFIG_LOCAL[tp].color : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all .12s',
              }}>
                {TYPE_CONFIG_LOCAL[tp].label}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <div style={labelStyle}>{t('editName')}</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Fineco, Banca Sella…" style={inputStyle} />
        </div>

        {/* Balance + Currency */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={labelStyle}>{t('editBalance')}</div>
            <input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>{t('editCurrency')}</div>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as 'EUR' | 'USD')} style={inputStyle}>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* Broker / IBAN */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={labelStyle}>{t('editInstitution')}</div>
            <input value={broker} onChange={(e) => setBroker(e.target.value)} placeholder="Es. Fineco, DeGiro…" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>{t('editIban')}</div>
            <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IT60 …" style={inputStyle} />
          </div>
        </div>

        {/* Note */}
        <div>
          <div style={labelStyle}>{t('editNote')}</div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('editOptional')} style={inputStyle} />
        </div>

        <button
          onClick={handleSave}
          className="ledgernest-btn ledgernest-btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          disabled={!name.trim()}
        >
          {t('editSave')}
        </button>
      </div>
    </div>
  )
}

function AccountCard({ account, onEdit, onDelete }: { account: Account; onEdit: () => void; onDelete: () => void }) {
  const t = useTranslations('conti')
  const TYPE_CONFIG: Record<Account['type'], {
    label: string; icon: string; color: string; bg: string
  }> = {
    bank:   { label: t('typeBankLabel'),   icon: 'conti',  color: '#58a6ff', bg: 'rgba(88,166,255,.15)' },
    broker: { label: t('typeBrokerLabel'), icon: 'azioni', color: '#2dd4bf', bg: 'rgba(45,212,191,.15)' },
    crypto: { label: t('typeCryptoLabel'), icon: 'crypto', color: '#f77c3a', bg: 'rgba(247,124,58,.15)' },
    other:  { label: t('typeOtherLabel'),  icon: 'wallet', color: '#7c6df7', bg: 'rgba(124,109,247,.15)' },
  }
  const cfg = TYPE_CONFIG[account.type]
  const seed = account.id.charCodeAt(0) + account.id.charCodeAt(1)
  const positive = account.balance >= 0
  const spark = useMemo(() => buildSparkline(seed, positive), [seed, positive])
  const fakeChange = ((seed % 17) - 5) * 12

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <div className="ledgernest-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
      {/* Row 1: icon + name + kebab */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '10px', flexShrink: 0,
            background: cfg.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: cfg.color,
          }}>
            <Icon name={cfg.icon} size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {account.name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>
              {account.broker ? `${cfg.label} · ${account.broker}` : cfg.label}
            </div>
          </div>
        </div>
        {/* Kebab menu */}
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px', display: 'flex' }}
          >
            <Icon name="kebab" size={16} />
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
              borderRadius: 10, padding: 4, minWidth: 130,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 100,
            }}>
              <button
                onClick={() => { setMenuOpen(false); onEdit() }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <Icon name="edit" size={13} /> {t('cardEdit')}
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete() }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13, fontWeight: 500 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in oklch, var(--danger) 12%, transparent)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <Icon name="trash" size={13} /> {t('cardDelete')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: balance + trend */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
          {fmtEur(account.balance)}
        </div>
        <div style={{
          fontSize: '12px', fontWeight: 600,
          color: fakeChange >= 0 ? 'var(--success)' : 'var(--danger)',
          whiteSpace: 'nowrap',
        }}>
          {fakeChange >= 0 ? '+' : ''}{fmtEur(fakeChange)} · 30g
        </div>
      </div>

      {/* Row 3: sparkline full-width */}
      <Sparkline data={spark} height={36} positive={positive} responsive />

      {/* Row 4: actions */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', gap: '8px',
      }}>
        <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" style={{ justifyContent: 'center', fontSize: '12px', gap: '5px' }}>
          <Icon name="refresh" size={13} />
          {t('cardTransfer')}
        </button>
        <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" style={{ justifyContent: 'center', fontSize: '12px', gap: '4px' }}>
          {t('cardDetails')}
          <span style={{ display: 'inline-flex', transform: 'rotate(-90deg)', lineHeight: 1 }}>
            <Icon name="chevron" size={13} />
          </span>
        </button>
      </div>
    </div>
  )
}

// Two-series area chart (Assets vs Liabilities)
function PatrimonioChart({ totalAssets }: { totalAssets: number }) {
  const months = ['Dic', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag']
  const base = totalAssets || 50000
  const assets  = months.map((_, i) => base * (0.88 + i * 0.024 + Math.sin(i) * 0.01))
  const liab    = months.map(() => base * 0.28)

  const W = 600; const H = 160
  const PAD = { t: 12, r: 8, b: 28, l: 8 }
  const allVals = [...assets, ...liab]
  const minV = Math.min(...allVals) * 0.95
  const maxV = Math.max(...allVals) * 1.02
  const xS = (i: number) => PAD.l + (i / (months.length - 1)) * (W - PAD.l - PAD.r)
  const yS = (v: number) => PAD.t + (1 - (v - minV) / (maxV - minV)) * (H - PAD.t - PAD.b)

  const aLine = assets.map((v, i) => `${i === 0 ? 'M' : 'L'}${xS(i)},${yS(v)}`).join(' ')
  const aArea = `${aLine} L${xS(months.length-1)},${H-PAD.b} L${xS(0)},${H-PAD.b} Z`
  const lLine = liab.map((v, i) => `${i === 0 ? 'M' : 'L'}${xS(i)},${yS(v)}`).join(' ')
  const lArea = `${lLine} L${xS(months.length-1)},${H-PAD.b} L${xS(0)},${H-PAD.b} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      <defs>
        <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.03"/>
        </linearGradient>
        <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f85149" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#f85149" stopOpacity="0.03"/>
        </linearGradient>
      </defs>
      <path d={aArea} fill="url(#ga)" />
      <path d={aLine} fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d={lArea} fill="url(#gl)" />
      <path d={lLine} fill="none" stroke="#f85149" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5,4" />
      {months.map((m, i) => (
        <text key={m} x={xS(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--text-secondary)" fontFamily="inherit">{m}</text>
      ))}
    </svg>
  )
}

export default function ContiPage() {
  const t = useTranslations('conti')
  const { accounts, deleteAccount } = useFinanceStore()
  const { positions } = usePortfolioStore()
  const { openModal } = useUIStore()
  const [filter, setFilter] = useState<'all' | Account['type']>('all')
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null)

  const TYPE_CONFIG: Record<Account['type'], {
    label: string; group: string; icon: string; color: string; bg: string
  }> = {
    bank:   { label: t('typeBankLabel'),   group: t('typeBankGroup'),   icon: 'conti',  color: '#58a6ff', bg: 'rgba(88,166,255,.15)' },
    broker: { label: t('typeBrokerLabel'), group: t('typeBrokerGroup'), icon: 'azioni', color: '#2dd4bf', bg: 'rgba(45,212,191,.15)' },
    crypto: { label: t('typeCryptoLabel'), group: t('typeCryptoGroup'), icon: 'crypto', color: '#f77c3a', bg: 'rgba(247,124,58,.15)' },
    other:  { label: t('typeOtherLabel'),  group: t('typeOtherGroup'),  icon: 'wallet', color: '#7c6df7', bg: 'rgba(124,109,247,.15)' },
  }

  const FILTER_TABS = [
    { key: 'all',    label: t('filterAll') },
    { key: 'bank',   label: t('filterBank') },
    { key: 'broker', label: t('filterBroker') },
    { key: 'crypto', label: t('filterCrypto') },
    { key: 'other',  label: t('filterOther') },
  ] as const

  const bankAccounts   = accounts.filter((a) => a.type === 'bank')
  const brokerAccounts = accounts.filter((a) => a.type === 'broker')
  const cryptoAccounts = accounts.filter((a) => a.type === 'crypto')

  const totalCash   = bankAccounts.reduce((s, a) => s + a.balance, 0)
  const totalBroker = brokerAccounts.reduce((s, a) => s + a.balance, 0)
  const totalCrypto = cryptoAccounts.reduce((s, a) => s + a.balance, 0)
  const totalAssets = accounts.reduce((s, a) => s + a.balance, 0)

  const filtered = filter === 'all' ? accounts : accounts.filter((a) => a.type === filter)

  const grouped = useMemo(() => {
    const map: Record<string, Account[]> = {}
    for (const a of filtered) {
      const g = TYPE_CONFIG[a.type].group
      if (!map[g]) map[g] = []
      map[g].push(a)
    }
    return map
  }, [filtered]) // eslint-disable-line react-hooks/exhaustive-deps

  const groupOrder = [t('typeBankGroup'), t('typeBrokerGroup'), t('typeCryptoGroup'), t('typeOtherGroup')]
  const deletingAccount = accounts.find((a) => a.id === deletingAccountId)

  return (
    <div className="ledgernest-gap-5">

      {/* KPI strip — 4 cards */}
      <div className="ledgernest-fin-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
        <div className="ledgernest-kpi is-hl" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>{t('kpiNetWorth')}</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(totalAssets)}</div>
          <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>+2.34% <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{t('kpiLast30Days')}</span></div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>{t('kpiLiquidity')}</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(totalCash)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{bankAccounts.length} {bankAccounts.length === 1 ? t('kpiAccount') : t('kpiAccounts')}</div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>{t('kpiInvested')}</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(totalBroker + totalCrypto)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {brokerAccounts.length} {t('kpiBroker')} · {cryptoAccounts.length} {t('kpiWallet')}
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>{t('kpiPositions')}</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>{positions.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('kpiSecurities')}</div>
        </div>
      </div>

      {/* Area chart */}
      <div className="ledgernest-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{t('chartTitle')}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{t('chartSubtitle')}</div>
          </div>
          <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 3, background: '#2dd4bf', borderRadius: 2, display: 'inline-block' }} />{t('chartAssets')}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 3, background: '#f85149', borderRadius: 2, display: 'inline-block' }} />{t('chartLiabilities')}</span>
          </div>
        </div>
        <PatrimonioChart totalAssets={totalAssets} />
      </div>

      {/* Header + filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '17px' }}>{t('sectionTitle', { n: accounts.length })}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{t('sectionManual')}</div>
        </div>
        <div className="ledgernest-conti-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-elevated)', borderRadius: '10px', padding: '3px' }}>
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as typeof filter)}
                style={{
                  padding: '5px 13px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                  border: 'none', cursor: 'pointer', transition: 'all .15s',
                  background: filter === tab.key ? 'var(--bg-elevated)' : 'transparent',
                  color: filter === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: filter === tab.key ? '0 1px 4px rgba(0,0,0,.25)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            className="ledgernest-btn ledgernest-btn-primary"
            onClick={() => openModal('account')}
            style={{ gap: '6px', height: '36px', fontSize: '13px' }}
          >
            <Icon name="plus" size={13} />
            {t('sectionConnect')}
          </button>
        </div>
      </div>

      {/* Account groups */}
      {accounts.length === 0 ? (
        <div className="ledgernest-card">
          <div className="ledgernest-empty">
            <div className="ledgernest-empty-icon">🏦</div>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>{t('emptyTitle')}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {t('emptyDesc')}
            </div>
            <button className="ledgernest-btn ledgernest-btn-primary" onClick={() => openModal('account')}>
              <Icon name="plus" size={14} />
              {t('emptyButton')}
            </button>
          </div>
        </div>
      ) : (
        groupOrder.map((group) => {
          const items = grouped[group]
          if (!items || items.length === 0) return null
          const groupTotal = items.reduce((s, a) => s + a.balance, 0)
          return (
            <div key={group}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
                  {group}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {items.length} {items.length === 1 ? t('groupItem') : t('groupItems')} · {fmtEur(groupTotal)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                {items.map((a) => (
                  <AccountCard
                    key={a.id}
                    account={a}
                    onEdit={() => setEditingAccount(a)}
                    onDelete={() => setDeletingAccountId(a.id)}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}

      {editingAccount && (
        <EditAccountModal account={editingAccount} onClose={() => setEditingAccount(null)} />
      )}
      {deletingAccountId && deletingAccount && (
        <DeleteConfirmModal
          title={t('deleteTitle')}
          message={t('deleteMessage', { name: deletingAccount.name })}
          cancelLabel={t('cancel')}
          deleteLabel={t('delete')}
          onConfirm={() => { deleteAccount(deletingAccountId); setDeletingAccountId(null) }}
          onCancel={() => setDeletingAccountId(null)}
        />
      )}
    </div>
  )
}
