'use client'

import { useMemo, useState, useEffect } from 'react'
import { useFinanceStore } from '@/stores/financeStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { usePricesStore } from '@/stores/pricesStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { effectivePriceEur } from '@/lib/utils/price'
import { useFormatters } from '@/hooks/useFormatters'
import Icon from '@/components/shared/Icon'
import { useTranslations } from 'next-intl'
import type { Liability } from '@/types'

// ── SVG net-worth chart ────────────────────────────────────────────────────

function NetWorthChart({
  data,
}: {
  data: { label: string; assets: number; liabilities: number }[]
}) {
  const W = 600, H = 90, PL = 8, PR = 8, PT = 10, PB = 20
  const chartW = W - PL - PR
  const chartH = H - PT - PB

  const maxVal = Math.max(...data.map((d) => d.assets), 1) * 1.12
  const xOf = (i: number) => PL + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW)
  const yOf = (v: number) => PT + chartH - (v / maxVal) * chartH

  const assetsLine = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i)},${yOf(d.assets)}`).join(' ')
  const assetsArea = `${assetsLine} L${xOf(data.length - 1)},${H - PB} L${xOf(0)},${H - PB}Z`
  const liabLine = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i)},${yOf(d.liabilities)}`).join(' ')
  const hasLiab = data.some((d) => d.liabilities > 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5bc8d0" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#5bc8d0" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={assetsArea} fill="url(#nwGrad)" />
      <path d={assetsLine} fill="none" stroke="#5bc8d0" strokeWidth={2} strokeLinejoin="round" />
      {hasLiab && (
        <path d={liabLine} fill="none" stroke="#f85149" strokeWidth={1.5} strokeDasharray="5,3" strokeLinejoin="round" />
      )}
      {data.map((d, i) => (
        <text
          key={i}
          x={xOf(i)}
          y={H - 6}
          textAnchor="middle"
          fontSize={9}
          fill="var(--text-tertiary)"
          fontFamily="inherit"
        >
          {d.label}
        </text>
      ))}
    </svg>
  )
}

// ── Add liability modal ────────────────────────────────────────────────────

const LiabilityTypes: { key: Liability['type']; labelKey: string }[] = [
  { key: 'mutuo', labelKey: 'liabilityMortgage' },
  { key: 'prestito', labelKey: 'liabilityLoan' },
  { key: 'altro', labelKey: 'liabilityOther' },
]

function AddLiabilityModal({ onClose, onAdd }: { onClose: () => void; onAdd: (l: Omit<Liability, 'id' | 'createdAt'>) => void }) {
  const tl = useTranslations('patrimonio')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [type, setType] = useState<Liability['type']>('mutuo')
  const [residuo, setResiduo] = useState('')
  const [monthly, setMonthly] = useState('')
  const [rate, setRate] = useState('')
  const [endYear, setEndYear] = useState(String(new Date().getFullYear() + 10))

  function handleSave() {
    if (!name.trim() || !residuo) return
    onAdd({
      name: name.trim(),
      note: note.trim() || undefined,
      type,
      residuo: parseFloat(residuo) || 0,
      monthlyPayment: parseFloat(monthly) || 0,
      interestRate: parseFloat(rate) || 0,
      endYear: parseInt(endYear) || new Date().getFullYear() + 10,
    })
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 36,
    padding: '4px 12px',
    fontSize: 14,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, width: 460, boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{tl('liabilityTitle')}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 6, borderRadius: 8, display: 'flex' }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{tl('liabilityType')}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {LiabilityTypes.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  style={{
                    flex: 1, padding: '7px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .12s',
                    border: `1.5px solid ${type === t.key ? 'var(--accent)' : 'transparent'}`,
                    background: type === t.key ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                    color: type === t.key ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {tl(t.labelKey as Parameters<typeof tl>[0])}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('liabilityName')}</div>
              <input className="ledgernest-input" style={inputStyle} placeholder="Es. Mutuo casa..." value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('liabilityDebt')}</div>
              <input className="ledgernest-input" style={inputStyle} type="number" placeholder="0" value={residuo} onChange={(e) => setResiduo(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('liabilityInstalment')}</div>
              <input className="ledgernest-input" style={inputStyle} type="number" placeholder="0" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('liabilityRate')}</div>
              <input className="ledgernest-input" style={inputStyle} type="number" step="0.01" placeholder="0.00" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('liabilityEndYear')}</div>
              <input className="ledgernest-input" style={inputStyle} type="number" placeholder="2035" value={endYear} onChange={(e) => setEndYear(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('liabilityNote')}</div>
              <input className="ledgernest-input" style={inputStyle} placeholder="..." value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 22px 20px' }}>
          <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" onClick={onClose}>{tl('cancel')}</button>
          <button className="ledgernest-btn ledgernest-btn-primary ledgernest-btn-sm" onClick={handleSave} disabled={!name.trim() || !residuo}>
            <Icon name="plus" size={13} /> {tl('liabilitySave')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Composition bar ─────────────────────────────────────────────────────────

function CompositionBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const { fmt } = useFormatters()
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</span>
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: color, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PatrimonioPage() {
  const tl = useTranslations('patrimonio')
  const { fmt } = useFormatters()
  const { accounts, transactions, liabilities, netWorthSnapshots, addLiability, deleteLiability, takeNetWorthSnapshot } = useFinanceStore()
  const { positions } = usePortfolioStore()
  const { quotes } = usePricesStore()
  const showPrePostMarket = useSettingsStore((s) => s.settings.showPrePostMarket)

  const [showAddLiability, setShowAddLiability] = useState(false)

  const portfolioValue = useMemo(() => {
    return positions.reduce((sum, p) => {
      const q = quotes[p.ticker]
      return sum + effectivePriceEur(q, p.avgPrice, showPrePostMarket) * p.quantity
    }, 0)
  }, [positions, quotes, showPrePostMarket])

  const cashValue = accounts.filter((a) => a.type !== 'broker').reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + l.residuo, 0)
  const totalAssets = portfolioValue + accounts.reduce((s, a) => s + a.balance, 0)
  const netWorth = totalAssets - totalLiabilities

  const thirtyDaysAgoStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  }, [])

  function acctDelta(accountId: string) {
    return transactions
      .filter((t) => t.accountId === accountId && t.date >= thirtyDaysAgoStr)
      .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0)
  }

  const stockVal = positions.filter((p) => p.type === 'stock').reduce((s, p) => s + effectivePriceEur(quotes[p.ticker], p.avgPrice, showPrePostMarket) * p.quantity, 0)
  const etfVal = positions.filter((p) => p.type === 'etf').reduce((s, p) => s + effectivePriceEur(quotes[p.ticker], p.avgPrice, showPrePostMarket) * p.quantity, 0)
  const cryptoVal = positions.filter((p) => p.type === 'crypto').reduce((s, p) => s + effectivePriceEur(quotes[p.ticker], p.avgPrice, showPrePostMarket) * p.quantity, 0)
  const bondVal = positions.filter((p) => p.type === 'bond').reduce((s, p) => s + effectivePriceEur(quotes[p.ticker], p.avgPrice, showPrePostMarket) * p.quantity, 0)

  const compositionItems = [
    { label: tl('compStocks'),      value: stockVal,  color: '#5bc8d0' },
    { label: 'ETF',                 value: etfVal,    color: '#7c6df7' },
    { label: 'Crypto',              value: cryptoVal, color: '#f77c3a' },
    { label: tl('compBonds'),       value: bondVal,   color: '#d29922' },
    { label: tl('compLiquidity'),   value: cashValue, color: '#3fb950' },
  ].filter((d) => d.value > 0)

  const chartData = useMemo(() => {
    if (netWorthSnapshots.length >= 2) {
      const sorted = [...netWorthSnapshots].sort((a, b) => a.date.localeCompare(b.date)).slice(-6)
      return sorted.map((s) => ({
        label: s.date.slice(5, 7) + '/' + s.date.slice(2, 4),
        assets: s.totalAssets,
        liabilities: s.totalLiabilities,
      }))
    }
    const months: { label: string; assets: number; liabilities: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      months.push({
        label: d.toLocaleDateString(undefined, { month: 'short' }).replace('.', ''),
        assets: i === 0 ? totalAssets : 0,
        liabilities: i === 0 ? totalLiabilities : 0,
      })
    }
    return months
  }, [netWorthSnapshots, totalAssets, totalLiabilities])

  useEffect(() => {
    if (totalAssets > 0) takeNetWorthSnapshot(portfolioValue)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const liabTypeLabel: Record<string, string> = { mutuo: tl('liabMortgage'), prestito: tl('liabLoan'), altro: tl('liabOther') }
  const acctTypeColor: Record<string, string> = { bank: '#58a6ff', broker: '#5bc8d0', crypto: '#f77c3a', other: '#7c6df7' }
  const acctTypeNameMap: Record<string, string> = { bank: tl('acctBank'), broker: tl('acctBroker'), crypto: tl('acctCrypto'), other: tl('acctOther') }

  const snap30d = [...netWorthSnapshots].filter((s) => s.date <= thirtyDaysAgoStr).sort((a, b) => b.date.localeCompare(a.date))[0]
  const nwDelta30d = snap30d && snap30d.netWorth !== 0 ? ((netWorth - snap30d.netWorth) / Math.abs(snap30d.netWorth)) * 100 : null
  const acctTypesPresent = Array.from(new Set(accounts.map((a) => a.type))).map((t) => acctTypeNameMap[t]).join(' · ')
  const liabSubtitle = liabilities.length > 0 ? Array.from(new Set(liabilities.map((l) => l.type))).join(' · ') : tl('kpiNoLiabilities')
  const bankCount = accounts.filter((a) => a.type === 'bank').length
  const cryptoCount = accounts.filter((a) => a.type === 'crypto').length
  const liquidSubtitle = [bankCount > 0 && `${bankCount} ${tl('acctBank')}`, cryptoCount > 0 && `${cryptoCount} wallet`].filter(Boolean).join(' · ') || tl('kpiNoAccounts')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── KPI cards ─────────────────────────────────────────── */}
      <div className="ledgernest-kpi-strip">
        <div className="ledgernest-kpi-cell is-accent">
          <div className="ledgernest-kpi-label">{tl('kpiNetWorth')}</div>
          <div className="ledgernest-kpi-value" style={{ color: netWorth < 0 ? 'var(--danger)' : undefined }}>{fmt(netWorth)}</div>
          <div className="ledgernest-kpi-sub">
            {nwDelta30d !== null && (
              <span style={{ color: nwDelta30d >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {nwDelta30d >= 0 ? '+' : ''}{nwDelta30d.toFixed(2)}%
              </span>
            )}
            <span>{tl('kpiLast30Days')}</span>
          </div>
        </div>
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">{tl('kpiAssets')}</div>
          <div className="ledgernest-kpi-value">{fmt(totalAssets)}</div>
          <div className="ledgernest-kpi-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acctTypesPresent || tl('kpiNoAccounts')}</div>
        </div>
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">{tl('kpiLiabilities')}</div>
          <div className="ledgernest-kpi-value" style={{ color: totalLiabilities > 0 ? 'var(--danger)' : undefined }}>{fmt(totalLiabilities)}</div>
          <div className="ledgernest-kpi-sub">{liabSubtitle}</div>
        </div>
        <div className="ledgernest-kpi-cell">
          <div className="ledgernest-kpi-label">{tl('kpiLiquidity')}</div>
          <div className="ledgernest-kpi-value">{fmt(cashValue)}</div>
          <div className="ledgernest-kpi-sub">{liquidSubtitle}</div>
        </div>
      </div>

      {/* ── Chart ─────────────────────────────────────────────── */}
      <div className="ledgernest-card">
        <div className="ledgernest-card-header">
          <div>
            <div className="ledgernest-card-title">{tl('chartTitle')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{tl('chartSubtitle')}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 20, height: 2, background: '#5bc8d0', borderRadius: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{tl('chartAssets')}</span>
            </div>
            {totalLiabilities > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 20, height: 0, borderTop: '2px dashed #f85149' }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{tl('chartLiabilities')}</span>
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: '8px 16px 16px' }}>
          <NetWorthChart data={chartData} />
        </div>
      </div>

      {/* ── Conti + Composizione ────────────────────────────── */}
      <div className="ledgernest-nw-grid-2col">

        {/* Conti e wallet */}
        <div className="ledgernest-card">
          <div className="ledgernest-card-header">
            <span className="ledgernest-card-title">{tl('accountsTitle')}</span>
          </div>
          <div style={{ padding: '8px 0 12px' }}>
            {accounts.length === 0 ? (
              <div className="ledgernest-empty">{tl('accountsEmpty')}</div>
            ) : (
              accounts.map((a) => {
                const delta = acctDelta(a.id)
                return (
                  <div
                    key={a.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', transition: 'background .1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: `${acctTypeColor[a.type] ?? '#8b949e'}18`,
                      color: acctTypeColor[a.type] ?? '#8b949e',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name={a.icon} size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{a.type}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(a.balance)}</div>
                      {delta !== 0 && (
                        <div style={{ fontSize: 11, color: delta >= 0 ? 'var(--success)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                          {delta >= 0 ? '+' : ''}{fmt(delta)} 30d
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Composizione netta */}
        <div className="ledgernest-card">
          <div className="ledgernest-card-header">
            <span className="ledgernest-card-title">{tl('compositionTitle')}</span>
          </div>
          <div style={{ padding: '12px 20px 16px' }}>
            {compositionItems.length === 0 ? (
              <div className="ledgernest-empty">{tl('compositionEmpty')}</div>
            ) : (
              compositionItems.map((item) => (
                <CompositionBar key={item.label} {...item} total={totalAssets} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Passività ─────────────────────────────────────────── */}
      <div className="ledgernest-card">
        <div className="ledgernest-card-header">
          <span className="ledgernest-card-title">{tl('kpiLiabilities')}</span>
          <button
            className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm"
            onClick={() => setShowAddLiability(true)}
            style={{ gap: 6 }}
          >
            <Icon name="plus" size={13} /> {tl('liabilitiesAdd')}
          </button>
        </div>

        {liabilities.length === 0 ? (
          <div className="ledgernest-empty" style={{ padding: '32px 0' }}>
            {tl('liabilitiesEmpty')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {[tl('liabilitiesColItem'), tl('liabilitiesColType'), tl('liabilitiesColDebt'), tl('liabilitiesColInstalment'), tl('liabilitiesColRate'), tl('liabilitiesColEnd'), ''].map((h, hi) => (
                    <th key={h} style={{
                      padding: '8px 16px',
                      textAlign: hi >= 2 ? 'right' : 'left',
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
                      color: 'var(--text-tertiary)', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liabilities.map((l) => (
                  <tr
                    key={l.id}
                    style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background .1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{l.name}</div>
                      {l.note && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{l.note}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                        {liabTypeLabel[l.type]}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(l.residuo)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(l.monthlyPayment)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                      {l.interestRate > 0 ? `${l.interestRate.toFixed(2)}%` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {l.endYear}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => deleteLiability(l.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px 6px', borderRadius: 6, display: 'inline-flex', transition: 'color .1s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                        title={tl('liabilitiesDelete') ?? ''}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {liabilities.length > 1 && (
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td colSpan={2} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{tl('liabilitiesTotal')}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(totalLiabilities)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(liabilities.reduce((s, l) => s + l.monthlyPayment, 0))}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {showAddLiability && (
        <AddLiabilityModal
          onClose={() => setShowAddLiability(false)}
          onAdd={addLiability}
        />
      )}
    </div>
  )
}
