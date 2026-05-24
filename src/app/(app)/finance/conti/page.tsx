'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { useFinanceStore } from '@/stores/financeStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useUIStore } from '@/stores/uiStore'
import { fmtEur } from '@/lib/utils/format'
import Icon from '@/components/shared/Icon'
import Sparkline from '@/components/charts/Sparkline'
import type { Account } from '@/types'

const TYPE_CONFIG: Record<Account['type'], {
  label: string; group: string; icon: string; color: string; bg: string
}> = {
  bank:   { label: 'Conto bancario', group: 'CONTO BANCARIO', icon: 'conti',  color: '#58a6ff', bg: 'rgba(88,166,255,.15)' },
  broker: { label: 'Brokerage',      group: 'BROKERAGE',      icon: 'azioni', color: '#2dd4bf', bg: 'rgba(45,212,191,.15)' },
  crypto: { label: 'Crypto wallet',  group: 'CRYPTO WALLET',  icon: 'crypto', color: '#f77c3a', bg: 'rgba(247,124,58,.15)' },
  other:  { label: 'Altro',          group: 'ALTRO',          icon: 'wallet', color: '#7c6df7', bg: 'rgba(124,109,247,.15)' },
}

const FILTER_TABS = [
  { key: 'all',    label: 'Tutti' },
  { key: 'bank',   label: 'Conti' },
  { key: 'broker', label: 'Broker' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'other',  label: 'Altro' },
] as const

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

function EditAccountModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const { updateAccount } = useFinanceStore()
  const [name, setName] = useState(account.name)
  const [type, setType] = useState<Account['type']>(account.type)
  const [balance, setBalance] = useState(String(account.balance))
  const [currency, setCurrency] = useState<'EUR' | 'USD'>(account.currency)
  const [broker, setBroker] = useState(account.broker ?? '')
  const [iban, setIban] = useState(account.iban ?? '')
  const [note, setNote] = useState(account.note ?? '')

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
          <div style={{ fontWeight: 700, fontSize: 16 }}>Modifica conto</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Type */}
        <div>
          <div style={labelStyle}>Tipo</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {(['bank', 'broker', 'crypto', 'other'] as Account['type'][]).map((t) => (
              <button key={t} onClick={() => setType(t)} style={{
                padding: '8px 4px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${type === t ? TYPE_CONFIG[t].color : 'var(--border-subtle)'}`,
                background: type === t ? TYPE_CONFIG[t].bg : 'transparent',
                color: type === t ? TYPE_CONFIG[t].color : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all .12s',
              }}>
                {TYPE_CONFIG[t].label}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <div style={labelStyle}>Nome</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Fineco, Banca Sella…" style={inputStyle} />
        </div>

        {/* Balance + Currency */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={labelStyle}>Saldo</div>
            <input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Valuta</div>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as 'EUR' | 'USD')} style={inputStyle}>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* Broker / IBAN */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={labelStyle}>Istituto</div>
            <input value={broker} onChange={(e) => setBroker(e.target.value)} placeholder="Es. Fineco, DeGiro…" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>IBAN</div>
            <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IT60 …" style={inputStyle} />
          </div>
        </div>

        {/* Note */}
        <div>
          <div style={labelStyle}>Note</div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opzionale" style={inputStyle} />
        </div>

        <button
          onClick={handleSave}
          className="ledgernest-btn ledgernest-btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          disabled={!name.trim()}
        >
          Salva modifiche
        </button>
      </div>
    </div>
  )
}

function AccountCard({ account, onEdit, onDelete }: { account: Account; onEdit: () => void; onDelete: () => void }) {
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
                <Icon name="edit" size={13} /> Modifica
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete() }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13, fontWeight: 500 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in oklch, var(--danger) 12%, transparent)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <Icon name="trash" size={13} /> Elimina
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
          Trasferisci
        </button>
        <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" style={{ justifyContent: 'center', fontSize: '12px', gap: '4px' }}>
          Dettagli
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
  const { accounts, deleteAccount } = useFinanceStore()
  const { positions } = usePortfolioStore()
  const { openModal } = useUIStore()
  const [filter, setFilter] = useState<'all' | Account['type']>('all')
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null)

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
  }, [filtered])

  const groupOrder = ['CONTO BANCARIO', 'BROKERAGE', 'CRYPTO WALLET', 'ALTRO']
  const deletingAccount = accounts.find((a) => a.id === deletingAccountId)

  return (
    <div className="ledgernest-gap-5">

      {/* KPI strip — 4 cards */}
      <div className="ledgernest-fin-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
        <div className="ledgernest-kpi is-hl" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>PATRIMONIO NETTO</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(totalAssets)}</div>
          <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>+2.34% <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>ultimi 30 giorni</span></div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>LIQUIDITÀ DISPONIBILE</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(totalCash)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{bankAccounts.length} {bankAccounts.length === 1 ? 'conto' : 'conti'}</div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>INVESTITO</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmtEur(totalBroker + totalCrypto)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {brokerAccounts.length} broker · {cryptoAccounts.length} wallet
          </div>
        </div>

        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>POSIZIONI</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>{positions.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>titoli in portafoglio</div>
        </div>
      </div>

      {/* Area chart */}
      <div className="ledgernest-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>Patrimonio · attività vs passività</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Ultimi 6 mesi · netto in crescita</div>
          </div>
          <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 3, background: '#2dd4bf', borderRadius: 2, display: 'inline-block' }} />Attività</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 3, background: '#f85149', borderRadius: 2, display: 'inline-block' }} />Passività</span>
          </div>
        </div>
        <PatrimonioChart totalAssets={totalAssets} />
      </div>

      {/* Header + filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '17px' }}>Conti e wallet · {accounts.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Gestiti manualmente</div>
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
            Collega conto
          </button>
        </div>
      </div>

      {/* Account groups */}
      {accounts.length === 0 ? (
        <div className="ledgernest-card">
          <div className="ledgernest-empty">
            <div className="ledgernest-empty-icon">🏦</div>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Nessun conto collegato</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Aggiungi i tuoi conti bancari, broker e wallet per tracciare il patrimonio
            </div>
            <button className="ledgernest-btn ledgernest-btn-primary" onClick={() => openModal('account')}>
              <Icon name="plus" size={14} />
              Collega il primo conto
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
                  {items.length} {items.length === 1 ? 'voce' : 'voci'} · {fmtEur(groupTotal)}
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
          message={`Eliminare il conto "${deletingAccount.name}"? Questa azione non è reversibile.`}
          onConfirm={() => { deleteAccount(deletingAccountId); setDeletingAccountId(null) }}
          onCancel={() => setDeletingAccountId(null)}
        />
      )}
    </div>
  )
}
