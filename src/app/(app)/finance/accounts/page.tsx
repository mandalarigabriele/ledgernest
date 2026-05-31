'use client'

import { useMemo, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useFinanceStore } from '@/stores/financeStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePricesStore } from '@/stores/pricesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { useFormatters } from '@/hooks/useFormatters'
import { effectivePriceEur } from '@/lib/utils/price'
import Icon from '@/components/shared/Icon'
import EnableBankingPanel from '@/components/shared/EnableBankingPanel'  // invisible auto-import handler
import type { Account } from '@/types'

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
      // OB accounts: balance is read-only, managed by banking API
      ...(account.bankingUid ? {} : { balance: parseFloat(balance) || 0 }),
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
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div>
            <div style={labelStyle}>{t('editBalance')}</div>
            {account.bankingUid
              ? <div style={{ ...inputStyle, color: 'var(--text-tertiary)', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {balance} <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>— aggiornato dal sync</span>
                </div>
              : <input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} style={inputStyle} />
            }
          </div>
          <div>
            <div style={labelStyle}>{t('editCurrency')}</div>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as 'EUR' | 'USD')} style={inputStyle}>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="CHF">CHF</option>
            </select>
          </div>
        </div>

        {/* Broker */}
        <div>
          <div style={labelStyle}>{t('editInstitution')}</div>
          <input value={broker} onChange={(e) => setBroker(e.target.value)} placeholder="Es. Fineco, DeGiro…" style={inputStyle} />
        </div>

        {/* IBAN — full width, only for bank accounts */}
        {type === 'bank' && (
          <div>
            <div style={labelStyle}>{t('editIban')}</div>
            <input
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase())}
              placeholder="IT60 X054 2811 1010 0000 0123 456"
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
        )}

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

function AccountCard({ account, totalAssets, onEdit, onDelete, onClearTx }: { account: Account; totalAssets: number; onEdit: () => void; onDelete: () => void; onClearTx: () => void }) {
  const t = useTranslations('conti')
  const { fmt } = useFormatters()
  const { transactions, updateAccount, addTransaction, updateTransaction } = useFinanceStore()
  const txCount = transactions.filter((tx) => tx.accountId === account.id).length
  const [syncing, setSyncing]         = useState(false)
  const [syncMsg, setSyncMsg]         = useState<{ text: string; ok: boolean } | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [syncMenuOpen, setSyncMenuOpen] = useState(false)

  const handleObSync = useCallback(async (mode: 'delta' | 'force' | 'hard-reset' = 'delta') => {
    if (!account.bankingUid) return
    setSyncing(true)
    setSyncMsg(null)
    setSyncMenuOpen(false)
    try {
      const res  = await fetch('/api/banking/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountUid: account.bankingUid, financeAccountId: account.id, mode }),
      })
      const data = await res.json() as { newBalance?: number; newTransactions?: Array<Record<string, unknown>>; imported?: number; total?: number; error?: string }
      if (!res.ok) {
        if (res.status === 429) setRateLimited(true)
        setSyncMsg({ text: data.error ?? `Errore ${res.status}`, ok: false })
        return
      }
      setRateLimited(false)
      if (data.newBalance != null) updateAccount(account.id, { balance: data.newBalance })
      let added = 0, fixed = 0
      for (const tx of data.newTransactions ?? []) {
        const { eb_id: _, ...txData } = tx as { eb_id: string } & Parameters<typeof addTransaction>[0]
        const existing = transactions.find(
          (t) => t.date === txData.date && Math.abs(t.amount - (txData.amount as number)) < 0.01
            && t.type === txData.type && t.description === txData.description
        )
        if (existing) {
          const needsFix = existing.accountId !== account.id || !existing.ebId
          if (needsFix) { updateTransaction(existing.id, { accountId: account.id, ebId: (txData as { ebId?: string }).ebId }); fixed++ }
        } else {
          addTransaction({ ...txData, note: undefined }); added++
        }
      }
      const msg = [added > 0 && `+${added} movimenti`, fixed > 0 && `${fixed} corretti`].filter(Boolean).join(', ')
      setSyncMsg({ text: msg || 'Nessun nuovo movimento', ok: true })
    } catch (e) {
      setSyncMsg({ text: e instanceof Error ? e.message : 'Errore di rete', ok: false })
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 5000)
    }
  }, [account.bankingUid, account.id, transactions, updateAccount, addTransaction, updateTransaction])
  const TYPE_CONFIG: Record<Account['type'], {
    label: string; icon: string; color: string; bg: string
  }> = {
    bank:   { label: t('typeBankLabel'),   icon: 'conti',  color: '#58a6ff', bg: 'rgba(88,166,255,.15)' },
    broker: { label: t('typeBrokerLabel'), icon: 'azioni', color: '#2dd4bf', bg: 'rgba(45,212,191,.15)' },
    crypto: { label: t('typeCryptoLabel'), icon: 'crypto', color: '#f77c3a', bg: 'rgba(247,124,58,.15)' },
    other:  { label: t('typeOtherLabel'),  icon: 'wallet', color: '#7c6df7', bg: 'rgba(124,109,247,.15)' },
  }
  const cfg = TYPE_CONFIG[account.type]

  const pct = totalAssets > 0 ? (account.balance / totalAssets) * 100 : 0

  return (
    <div className="ledgernest-card" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden', minWidth: 0 }}>
      {/* Card body */}
      <div style={{ padding: '18px 20px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header: single line — icon + name + type badge + OB badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color,
          }}>
            <Icon name={cfg.icon} size={17} />
          </div>

          <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
            {account.name}
          </div>

          {/* Type badge */}
          <span style={{
            flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
            padding: '2px 7px', borderRadius: 20,
            color: cfg.color, background: cfg.bg,
          }}>
            {cfg.label}
          </span>

          {/* OB badge */}
          {account.bankingUid && (
            <span style={{
              flexShrink: 0, fontSize: 10, fontWeight: 700,
              padding: '2px 7px', borderRadius: 20,
              color: '#2dd4bf', background: 'rgba(45,212,191,.12)',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#2dd4bf' }} />
              OB
            </span>
          )}
        </div>

        {/* Broker subtitle — only if set */}
        {account.broker && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: -8 }}>
            {account.broker}
          </div>
        )}

        {/* Balance */}
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
          {fmt(account.balance)}
        </div>

        {/* Progress bar */}
        {totalAssets > 0 && (
          <div>
            <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: cfg.color, width: `${Math.min(100, pct)}%`, transition: 'width .3s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
              {pct.toFixed(1)}% del patrimonio totale
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        borderTop: '1px solid var(--border-subtle)', padding: '10px 14px', gap: '8px',
      }}>
        <button
          className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm"
          style={{ justifyContent: 'center', fontSize: '12px', gap: '5px' }}
          onClick={onEdit}
        >
          <Icon name="edit" size={13} />
          {t('cardEdit')}
        </button>
        <button
          className="ledgernest-btn ledgernest-btn-sm"
          style={{ justifyContent: 'center', fontSize: '12px', gap: '5px', color: 'var(--danger)', background: 'color-mix(in oklch, var(--danger) 10%, transparent)', border: 'none' }}
          onClick={onDelete}
        >
          <Icon name="trash" size={13} />
          {t('cardDelete')}
        </button>
        {account.bankingUid && (
          <>
            {/* Sync button + mode dropdown */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 4, opacity: rateLimited ? 0.5 : 1 }}>
              <button
                className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm"
                style={{ flex: 1, justifyContent: 'center', fontSize: '12px', gap: '5px' }}
                onClick={() => handleObSync('delta')}
                disabled={syncing || rateLimited}
                title={rateLimited ? 'Limite giornaliero raggiunto — riprova domani' : 'Importa solo movimenti nuovi'}
              >
                <Icon name="refresh" size={12} />
                {syncing ? 'Sincronizzando…' : rateLimited ? 'Limite raggiunto' : 'Sincronizza'}
              </button>
              <div style={{ position: 'relative' }}>
                <button
                  className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm"
                  style={{ padding: '0 8px', fontSize: 12 }}
                  onClick={() => setSyncMenuOpen((v) => !v)}
                  disabled={syncing || rateLimited}
                  title="Opzioni sync"
                >▾</button>
                {syncMenuOpen && (
                  <div
                    style={{
                      position: 'absolute', bottom: '100%', right: 0, marginBottom: 4,
                      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                      borderRadius: 10, padding: '4px', display: 'flex', flexDirection: 'column',
                      gap: 2, zIndex: 50, minWidth: 190, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    }}
                  >
                    {([
                      { mode: 'delta' as const,      label: 'Delta',      desc: 'Solo nuovi, rispetta eliminati' },
                      { mode: 'force' as const,       label: 'Force',      desc: 'Riallinea tutto, salta eliminati' },
                      { mode: 'hard-reset' as const,  label: 'Hard reset', desc: 'Reimporta tutto inclusi eliminati' },
                    ] as const).map(({ mode, label, desc }) => (
                      <button
                        key={mode}
                        className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm"
                        style={{ justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'flex-start', padding: '6px 10px', gap: 1 }}
                        onClick={() => handleObSync(mode)}
                      >
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{label}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 400 }}>{desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {syncMsg && (
              <div style={{
                gridColumn: '1 / -1', fontSize: 11, textAlign: 'center', padding: '4px 8px',
                borderRadius: 6, fontWeight: 500,
                color: syncMsg.ok ? '#2dd4bf' : 'var(--danger)',
                background: syncMsg.ok ? 'rgba(45,212,191,.1)' : 'color-mix(in oklch, var(--danger) 12%, transparent)',
              }}>
                {syncMsg.text}
              </div>
            )}
          </>
        )}
        {txCount > 0 && (
          <button
            className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm"
            style={{ justifyContent: 'center', fontSize: '12px', gap: '5px', gridColumn: '1 / -1', color: 'var(--text-secondary)' }}
            onClick={onClearTx}
          >
            <Icon name="trash" size={12} />
            Svuota movimenti ({txCount})
          </button>
        )}
      </div>
    </div>
  )
}

// ── Balance trend from netWorthSnapshots ─────────────────────
function BalanceTrendChart({ snapshots }: { snapshots: { date: string; totalAssets: number }[] }) {
  const W = 520; const H = 140
  const PAD = { t: 8, r: 4, b: 24, l: 4 }

  if (snapshots.length < 2) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
        Dati insufficienti — lo storico si accumula nel tempo
      </div>
    )
  }

  const vals = snapshots.map((s) => s.totalAssets)
  const minV = Math.min(...vals) * 0.98
  const maxV = Math.max(...vals) * 1.01
  const xS = (i: number) => PAD.l + (i / (snapshots.length - 1)) * (W - PAD.l - PAD.r)
  const yS = (v: number) => PAD.t + (1 - (v - minV) / (maxV - minV)) * (H - PAD.t - PAD.b)

  const line = snapshots.map((s, i) => `${i === 0 ? 'M' : 'L'}${xS(i)},${yS(s.totalAssets)}`).join(' ')
  const area = `${line} L${xS(snapshots.length - 1)},${H - PAD.b} L${xS(0)},${H - PAD.b} Z`

  // X-axis labels: first, mid, last
  const labelIdxs = [0, Math.floor(snapshots.length / 2), snapshots.length - 1]
  const fmtDate = (d: string) => {
    const [, m, day] = d.split('-')
    return `${day}/${m}`
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      <defs>
        <linearGradient id="btg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5bc8d0" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#5bc8d0" stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#btg)" />
      <path d={line} fill="none" stroke="#5bc8d0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {labelIdxs.map((i) => (
        <text key={i} x={xS(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-tertiary)" fontFamily="inherit">
          {fmtDate(snapshots[i].date)}
        </text>
      ))}
    </svg>
  )
}

// ── Cashflow bars from transactions ───────────────────────────
function CashflowChart({ transactions, fmt }: { transactions: { date: string; type: string; amount: number }[]; fmt: (n: number) => string }) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - i))
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('it-IT', { month: 'short' }),
    }
  })

  const data = months.map(({ key, label }) => ({
    label,
    income:   transactions.filter((t) => t.date.startsWith(key) && t.type === 'income').reduce((s, t) => s + t.amount, 0),
    expenses: transactions.filter((t) => t.date.startsWith(key) && t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  }))

  const maxVal = Math.max(...data.flatMap((d) => [d.income, d.expenses]), 1)
  const W = 280; const H = 140; const PAD = { t: 8, r: 8, b: 24, l: 8 }
  const plotH = H - PAD.t - PAD.b
  const colW  = (W - PAD.l - PAD.r) / months.length
  const barW  = colW * 0.35

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      {data.map((d, i) => {
        const x = PAD.l + i * colW + colW / 2
        const incH = (d.income / maxVal) * plotH
        const expH = (d.expenses / maxVal) * plotH
        return (
          <g key={d.label}>
            <rect x={x - barW - 1} y={PAD.t + plotH - incH} width={barW} height={incH} rx="2" fill="#2dd4bf" opacity="0.85" />
            <rect x={x + 1} y={PAD.t + plotH - expH} width={barW} height={expH} rx="2" fill="#f85149" opacity="0.75" />
            <text x={x} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-tertiary)" fontFamily="inherit">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function ContiPage() {
  const t = useTranslations('conti')
  const { fmt } = useFormatters()
  const { accounts, transactions, netWorthSnapshots, deleteAccount, clearAccountTransactions } = useFinanceStore()
  const { positions } = usePortfolioStore()
  const { quotes, eurUsd } = usePricesStore()
  const showPrePostMarket = useSettingsStore((s) => s.settings.showPrePostMarket)
  const { openModal } = useUIStore()

  const portfolioValue = useMemo(() =>
    positions.reduce((sum, p) => sum + effectivePriceEur(quotes[p.ticker], p.avgPrice, showPrePostMarket) * p.quantity, 0),
    [positions, quotes, showPrePostMarket] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [filter, setFilter] = useState<'all' | Account['type']>('all')
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null)
  const [clearingAccountId, setClearingAccountId] = useState<string | null>(null)

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

  // Monthly stats from transactions
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const lastMonth    = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 7)
  }, [])

  const monthIncome   = useMemo(() => transactions.filter((t) => t.date.startsWith(currentMonth) && t.type === 'income').reduce((s, t) => s + t.amount, 0), [transactions, currentMonth])
  const monthExpenses = useMemo(() => transactions.filter((t) => t.date.startsWith(currentMonth) && t.type === 'expense').reduce((s, t) => s + t.amount, 0), [transactions, currentMonth])
  const lastIncome    = useMemo(() => transactions.filter((t) => t.date.startsWith(lastMonth) && t.type === 'income').reduce((s, t) => s + t.amount, 0), [transactions, lastMonth])
  const lastExpenses  = useMemo(() => transactions.filter((t) => t.date.startsWith(lastMonth) && t.type === 'expense').reduce((s, t) => s + t.amount, 0), [transactions, lastMonth])

  const incomePct   = lastIncome > 0   ? ((monthIncome - lastIncome) / lastIncome * 100)       : null
  const expensesPct = lastExpenses > 0 ? ((monthExpenses - lastExpenses) / lastExpenses * 100) : null
  const savingsRate = monthIncome > 0  ? Math.round((monthIncome - monthExpenses) / monthIncome * 100) : null

  // Saldo % change from oldest available snapshot
  const oldSnap  = netWorthSnapshots.length > 1 ? netWorthSnapshots[0] : null
  const saldoPct = oldSnap && oldSnap.totalAssets > 0
    ? ((totalAssets - oldSnap.totalAssets) / oldSnap.totalAssets * 100)
    : null

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
  const clearingAccount = accounts.find((a) => a.id === clearingAccountId)

  return (
    <div className="ledgernest-gap-5">

      {/* KPI strip — 4 cards */}
      <div className="ledgernest-fin-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>

        {/* Saldo totale */}
        <div className="ledgernest-kpi is-hl" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>{t('kpiNetWorth')}</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalAssets)}</div>
          <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {saldoPct != null && (
              <span style={{ fontWeight: 700, color: saldoPct >= 0 ? '#2dd4bf' : '#f85149' }}>
                {saldoPct >= 0 ? '+' : ''}{saldoPct.toFixed(2)}%
              </span>
            )}
            <span style={{ color: 'var(--text-secondary)' }}>{accounts.length} {t('kpiAccounts')}</span>
          </div>
        </div>

        {/* Liquidità */}
        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>{t('kpiLiquidity')}</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalCash)}</div>
          <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {accounts.some((a) => a.bankingUid && a.type === 'bank') && (
              <span style={{ fontWeight: 700, color: '#2dd4bf' }}>● live</span>
            )}
            <span style={{ color: 'var(--text-secondary)' }}>
              {bankAccounts.length} {bankAccounts.length === 1 ? t('kpiAccount') : t('kpiAccounts')}
              {totalBroker > 0 ? ` · ${brokerAccounts.length} broker` : ''}
              {totalCrypto > 0 ? ` · ${cryptoAccounts.length} crypto` : ''}
            </span>
          </div>
        </div>

        {/* Entrate mese */}
        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Entrate · mese</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmt(monthIncome)}</div>
          <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {incomePct != null && (
              <span style={{ fontWeight: 700, color: incomePct > 2 ? '#2dd4bf' : incomePct < -2 ? '#f85149' : 'var(--text-secondary)' }}>
                {incomePct >= 0 ? '+' : ''}{incomePct.toFixed(0)}%
              </span>
            )}
            <span style={{ color: 'var(--text-secondary)' }}>vs mese scorso</span>
          </div>
        </div>

        {/* Uscite mese */}
        <div className="ledgernest-card" style={{ padding: '18px 20px', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Uscite · mese</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{fmt(monthExpenses)}</div>
          <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {expensesPct != null && (
              <span style={{ fontWeight: 700, color: expensesPct > 5 ? '#f85149' : expensesPct < -5 ? '#2dd4bf' : 'var(--text-secondary)' }}>
                {expensesPct >= 0 ? '+' : ''}{expensesPct.toFixed(0)}%
              </span>
            )}
            {savingsRate != null && (
              <span style={{ color: 'var(--text-secondary)' }}>risparmio {savingsRate}%</span>
            )}
          </div>
        </div>

      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        {/* Balance trend */}
        <div className="ledgernest-card" style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Andamento del saldo</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Totale conti, broker e wallet · {netWorthSnapshots.length} snapshot
            </div>
          </div>
          <BalanceTrendChart snapshots={netWorthSnapshots} />
        </div>

        {/* Cashflow */}
        <div className="ledgernest-card" style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Flusso di cassa</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Entrate vs uscite · 6 mesi</div>
          </div>
          <CashflowChart transactions={transactions} fmt={fmt} />
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#2dd4bf', display: 'inline-block' }} />Entrate
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f85149', display: 'inline-block' }} />Uscite
            </span>
          </div>
        </div>
      </div>

      {/* invisible — handles banking_ok auto-import and sync state */}
      <EnableBankingPanel />

      {/* Header + filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '17px' }}>{t('sectionTitle', { n: accounts.length })} · {fmt(totalAssets)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: 8 }}>
            {accounts.some((a) => a.bankingUid) ? 'Manuali e Open Banking' : t('sectionManual')}
            {accounts.some((a) => a.bankingUid) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#2dd4bf', fontSize: 11, fontWeight: 600 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#2dd4bf' }} />
                {accounts.filter((a) => a.bankingUid).length} sincronizzati
              </span>
            )}
          </div>
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
                  {items.length} {items.length === 1 ? t('groupItem') : t('groupItems')} · {fmt(groupTotal)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                {items.map((a) => (
                  <AccountCard
                    key={a.id}
                    account={a}
                    totalAssets={totalAssets}
                    onEdit={() => setEditingAccount(a)}
                    onDelete={() => setDeletingAccountId(a.id)}
                    onClearTx={() => setClearingAccountId(a.id)}
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
      {clearingAccountId && clearingAccount && (
        <DeleteConfirmModal
          title="Svuota movimenti"
          message={`Eliminare tutti i movimenti di "${clearingAccount.name}"? Il conto rimane, solo i movimenti verranno cancellati.`}
          cancelLabel={t('cancel')}
          deleteLabel="Svuota"
          onConfirm={() => { clearAccountTransactions(clearingAccountId); setClearingAccountId(null) }}
          onCancel={() => setClearingAccountId(null)}
        />
      )}
    </div>
  )
}
