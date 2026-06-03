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
import type { Liability, Property } from '@/types'

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
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
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

function AddLiabilityModal({ onClose, onAdd, initial }: { onClose: () => void; onAdd: (l: Omit<Liability, 'id' | 'createdAt'>) => void; initial?: Liability }) {
  const tl = useTranslations('patrimonio')
  const [name, setName] = useState(initial?.name ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [type, setType] = useState<Liability['type']>(initial?.type ?? 'mutuo')
  const [residuo, setResiduo] = useState(String(initial?.residuo ?? ''))
  const [monthly, setMonthly] = useState(String(initial?.monthlyPayment ?? ''))
  const [rate, setRate] = useState(String(initial?.interestRate ?? ''))
  const [endYear, setEndYear] = useState(String(initial?.endYear ?? new Date().getFullYear() + 10))
  const [originalAmount, setOriginalAmount] = useState(String(initial?.originalAmount ?? ''))
  const [startYear, setStartYear] = useState(String(initial?.startYear ?? new Date().getFullYear()))

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
      originalAmount: parseFloat(originalAmount) || undefined,
      startYear: parseInt(startYear) || undefined,
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
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('liabilityOriginalAmount')}</div>
              <input className="ledgernest-input" style={inputStyle} type="number" placeholder="0" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('liabilityStartYear')}</div>
              <input className="ledgernest-input" style={inputStyle} type="number" placeholder={String(new Date().getFullYear())} value={startYear} onChange={(e) => setStartYear(e.target.value)} />
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

// ── Property modal ────────────────────────────────────────────────────────────

const PROPERTY_TYPES = ['Appartamento', 'Bilocale', 'Trilocale', 'Villa', 'Pertinenza', 'Box / Cantina', 'Terreno', 'Altro']

function PropertyModal({ initial, onClose, onSave }: {
  initial?: Property
  onClose: () => void
  onSave: (p: Omit<Property, 'id' | 'createdAt'>) => void
}) {
  const tl = useTranslations('patrimonio')
  const [name, setName] = useState(initial?.name ?? '')
  const [propertyType, setPropertyType] = useState(initial?.propertyType ?? 'Appartamento')
  const [city, setCity] = useState(initial?.city ?? '')
  const [country, setCountry] = useState(initial?.country ?? 'IT')
  const [yearAcquired, setYearAcquired] = useState(String(initial?.yearAcquired ?? new Date().getFullYear()))
  const [currentValue, setCurrentValue] = useState(String(initial?.currentValue ?? ''))
  const [linkedLiabilityId, setLinkedLiabilityId] = useState(initial?.linkedLiabilityId ?? '')
  const { liabilities } = useFinanceStore()

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 36, padding: '4px 12px', fontSize: 14,
    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  }

  function handleSave() {
    if (!name.trim() || !currentValue) return
    onSave({
      name: name.trim(),
      propertyType,
      city: city.trim(),
      country: country.trim() || 'IT',
      yearAcquired: parseInt(yearAcquired) || new Date().getFullYear(),
      currentValue: parseFloat(currentValue) || 0,
      linkedLiabilityId: linkedLiabilityId || undefined,
    })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, width: 480, boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{initial ? tl('propertyEditTitle') : tl('propertyAddTitle')}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 6, borderRadius: 8, display: 'flex' }}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('propertyFieldName')}</div>
              <input className="ledgernest-input" style={inputStyle} placeholder={tl('propertyNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('propertyFieldType')}</div>
              <select className="ledgernest-input" style={{ ...inputStyle }} value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('propertyFieldValue')}</div>
              <input className="ledgernest-input" style={inputStyle} type="number" placeholder="0" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('propertyFieldCity')}</div>
              <input className="ledgernest-input" style={inputStyle} placeholder="Milan" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('propertyFieldCountry')}</div>
              <input className="ledgernest-input" style={inputStyle} placeholder="IT" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('propertyFieldYear')}</div>
              <input className="ledgernest-input" style={inputStyle} type="number" placeholder="2020" value={yearAcquired} onChange={(e) => setYearAcquired(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{tl('propertyFieldMortgage')}</div>
              <select className="ledgernest-input" style={{ ...inputStyle }} value={linkedLiabilityId} onChange={(e) => setLinkedLiabilityId(e.target.value)}>
                <option value="">{tl('propertyFieldNone')}</option>
                {liabilities.filter((l) => l.type === 'mutuo').map((l) => (
                  <option key={l.id} value={l.id}>{l.name} · {l.residuo.toLocaleString('it-IT')} €</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 22px 20px' }}>
          <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" onClick={onClose}>{tl('propertyCancel')}</button>
          <button className="ledgernest-btn ledgernest-btn-primary ledgernest-btn-sm" onClick={handleSave} disabled={!name.trim() || !currentValue}>
            <Icon name="plus" size={13} /> {tl('propertySave')}
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
  const { accounts, transactions, liabilities, properties, netWorthSnapshots, addLiability, updateLiability, deleteLiability, addProperty, updateProperty, deleteProperty, takeNetWorthSnapshot } = useFinanceStore()
  const { positions } = usePortfolioStore()
  const { quotes } = usePricesStore()
  const showPrePostMarket = useSettingsStore((s) => s.settings.showPrePostMarket)

  const [showAddLiability, setShowAddLiability] = useState(false)
  const [editingLiability, setEditingLiability] = useState<typeof liabilities[0] | null>(null)
  const [showAddProperty, setShowAddProperty] = useState(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)
  const [chartRange, setChartRange] = useState<'1M' | '3M' | '6M' | '1A' | 'MAX'>('6M')

  const portfolioValue = useMemo(() => {
    return positions.reduce((sum, p) => {
      const q = quotes[p.ticker]
      return sum + effectivePriceEur(q, p.avgPrice, showPrePostMarket) * p.quantity
    }, 0)
  }, [positions, quotes, showPrePostMarket])

  const cashValue = accounts.filter((a) => a.type !== 'broker').reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + l.residuo, 0)
  const propertyValue = properties.reduce((s, p) => s + p.currentValue, 0)
  const totalAssets = portfolioValue + accounts.reduce((s, a) => s + a.balance, 0) + propertyValue
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
    { label: 'Properties',          value: propertyValue, color: '#f59e0b' },
    { label: tl('compStocks'),      value: stockVal,      color: '#5bc8d0' },
    { label: 'ETF',                 value: etfVal,        color: '#7c6df7' },
    { label: 'Crypto',              value: cryptoVal,     color: '#f77c3a' },
    { label: tl('compBonds'),       value: bondVal,       color: '#d29922' },
    { label: tl('compLiquidity'),   value: cashValue,     color: '#3fb950' },
  ].filter((d) => d.value > 0)

  const chartData = useMemo(() => {
    const rangeMonths: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6, '1A': 12, 'MAX': 9999 }
    const months = rangeMonths[chartRange]
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    if (netWorthSnapshots.length >= 2) {
      const filtered = [...netWorthSnapshots]
        .sort((a, b) => a.date.localeCompare(b.date))
        .filter((s) => chartRange === 'MAX' || s.date >= cutoffStr)
      if (filtered.length >= 2)
        return filtered.map((s) => ({
          label: s.date.slice(5, 7) + '/' + s.date.slice(2, 4),
          assets: s.totalAssets,
          liabilities: s.totalLiabilities,
          netWorth: s.netWorth,
        }))
    }
    const pts: { label: string; assets: number; liabilities: number; netWorth: number }[] = []
    for (let i = Math.min(months, 6); i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
      pts.push({
        label: d.toLocaleDateString(undefined, { month: 'short' }).replace('.', ''),
        assets: i === 0 ? totalAssets : 0,
        liabilities: i === 0 ? totalLiabilities : 0,
        netWorth: i === 0 ? netWorth : 0,
      })
    }
    return pts
  }, [netWorthSnapshots, totalAssets, totalLiabilities, netWorth, chartRange])

  // Chart delta: change from first to last point in range
  const chartFirst = chartData[0]
  const chartDeltaAbs = chartFirst ? netWorth - chartFirst.netWorth : 0
  const chartDeltaPct = chartFirst && chartFirst.netWorth !== 0 ? (chartDeltaAbs / Math.abs(chartFirst.netWorth)) * 100 : 0
  const allTimeHigh = netWorthSnapshots.length > 0 && netWorth >= Math.max(...netWorthSnapshots.map((s) => s.netWorth), netWorth)

  // One year ago net worth
  const oneYearAgoStr = useMemo(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10) }, [])
  const snapOneYearAgo = [...netWorthSnapshots].filter((s) => s.date <= oneYearAgoStr).sort((a, b) => b.date.localeCompare(a.date))[0]
  const nwOneYearAgo = snapOneYearAgo?.netWorth ?? null

  // Asset trend: compare first vs last snapshot
  const sortedSnaps = useMemo(() => [...netWorthSnapshots].sort((a, b) => a.date.localeCompare(b.date)), [netWorthSnapshots])
  const liabYearlyChange = sortedSnaps.length >= 2
    ? ((sortedSnaps[sortedSnaps.length - 1].totalLiabilities - sortedSnaps[0].totalLiabilities) / Math.max(1, sortedSnaps.length / 12))
    : 0

  // Financial health indicators
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0
  const investedQuota = totalAssets > 0 ? ((portfolioValue + cryptoVal) / totalAssets) * 100 : 0
  const propertyEquity = properties.reduce((s, p) => {
    const liab = liabilities.find((l) => l.id === p.linkedLiabilityId)
    return s + (p.currentValue - (liab?.residuo ?? 0))
  }, 0)
  const avgMonthlyExpenses = useMemo(() => {
    const sixMoAgo = new Date(); sixMoAgo.setMonth(sixMoAgo.getMonth() - 6)
    const cutStr = sixMoAgo.toISOString().slice(0, 10)
    const total = transactions
      .filter((t) => t.type === 'expense' && t.date >= cutStr)
      .reduce((s, t) => s + t.amount, 0)
    return total / 6
  }, [transactions])
  const safetyMonths = avgMonthlyExpenses > 0 ? cashValue / avgMonthlyExpenses : null

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
        <div style={{ padding: '18px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{tl('chartTitle')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {tl('chartSubtitle')} · {tl('chartUpdated', { time: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['1M', '3M', '6M', '1A', 'MAX'] as const).map((r) => (
              <button key={r} onClick={() => setChartRange(r)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: 'none',
                background: chartRange === r ? 'var(--accent)' : 'transparent',
                color: chartRange === r ? '#fff' : 'var(--text-tertiary)',
                transition: 'all .15s',
              }}>{r}</button>
            ))}
          </div>
        </div>

        {/* Big number + badges */}
        <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(netWorth)}
          </div>
          {chartData.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: chartDeltaAbs >= 0 ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)', border: `1px solid ${chartDeltaAbs >= 0 ? 'rgba(63,185,80,0.25)' : 'rgba(248,81,73,0.25)'}` }}>
              <span style={{ fontSize: 12, color: chartDeltaAbs >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                {chartDeltaAbs >= 0 ? '↑' : '↓'} {chartDeltaAbs >= 0 ? '+' : ''}{fmt(chartDeltaAbs)} · {chartDeltaAbs >= 0 ? '+' : ''}{chartDeltaPct.toFixed(2)}%
              </span>
            </div>
          )}
          {allTimeHigh && (
            <div style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(91,200,208,0.12)', border: '1px solid rgba(91,200,208,0.25)', fontSize: 12, fontWeight: 700, color: '#5bc8d0' }}>
              {tl('chartAllTimeHigh')}
            </div>
          )}
        </div>

        <div style={{ padding: '0 16px 8px', height: 110 }}>
          <NetWorthChart data={chartData} />
        </div>

        {/* Stat row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid var(--border-subtle)', padding: '10px 20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#5bc8d0' }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{tl('chartAssets')}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(totalAssets)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{tl('chartAssetsTrend')}</div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f85149' }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{tl('chartLiabilities')}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--danger)' }}>−{fmt(totalLiabilities)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{tl('chartLiabTrend', { amount: fmt(Math.abs(liabYearlyChange)) })}</div>
          </div>
          {nwOneYearAgo !== null && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{tl('chartOneYearAgo')}</div>
              <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(nwOneYearAgo)}</div>
              <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, marginTop: 1 }}>{tl('chartOneYearGrowth', { amount: fmt(netWorth - nwOneYearAgo) })}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Composizione + Salute finanziaria ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Composition donut */}
        <div className="ledgernest-card">
          <div className="ledgernest-card-header">
            <div>
              <span className="ledgernest-card-title">{tl('compTitle')}</span>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {tl('compSubtitle', { n: compositionItems.length, total: fmt(totalAssets) })}
              </div>
            </div>
          </div>
          {compositionItems.length === 0 ? (
            <div className="ledgernest-empty" style={{ padding: '32px 0' }}>{tl('compositionEmpty')}</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '12px 20px 20px' }}>
              {/* SVG Donut */}
              <div style={{ flexShrink: 0 }}>
                <svg width="180" height="180" viewBox="0 0 180 180">
                  {(() => {
                    const cx = 90, cy = 90, R = 70, r = 48
                    let angle = -Math.PI / 2
                    const segs = compositionItems.map((item) => {
                      const sweep = (item.value / totalAssets) * 2 * Math.PI
                      const sa = angle, ea = angle + sweep
                      angle = ea
                      const x1 = cx + R * Math.cos(sa), y1 = cy + R * Math.sin(sa)
                      const x2 = cx + R * Math.cos(ea), y2 = cy + R * Math.sin(ea)
                      const x3 = cx + r * Math.cos(ea), y3 = cy + r * Math.sin(ea)
                      const x4 = cx + r * Math.cos(sa), y4 = cy + r * Math.sin(sa)
                      const large = sweep > Math.PI ? 1 : 0
                      return { ...item, d: `M${x1},${y1} A${R},${R},0,${large},1,${x2},${y2} L${x3},${y3} A${r},${r},0,${large},0,${x4},${y4}Z` }
                    })
                    const label = totalAssets >= 1e6
                      ? `€${(totalAssets / 1e6).toFixed(1)}M`
                      : `€${(totalAssets / 1e3).toFixed(1)}k`
                    return (
                      <>
                        {segs.map((s) => <path key={s.label} d={s.d} fill={s.color} />)}
                        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={16} fontWeight={800} fill="var(--text-primary)" fontFamily="inherit">{label}</text>
                        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={11} fill="var(--text-tertiary)" fontFamily="inherit">{tl('compCenter')}</text>
                      </>
                    )
                  })()}
                </svg>
              </div>
              {/* Legend */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {compositionItems.map((item) => {
                  const pct = totalAssets > 0 ? (item.value / totalAssets) * 100 : 0
                  return (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, flex: 1 }}>{item.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{fmt(item.value)}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Financial health */}
        <div className="ledgernest-card">
          <div className="ledgernest-card-header">
            <div>
              <span className="ledgernest-card-title">{tl('healthTitle')}</span>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{tl('healthSubtitle')}</div>
            </div>
          </div>
          <div style={{ padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Debt-to-assets */}
            {(() => {
              const over = debtRatio > 40
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{tl('healthDebtRatio')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{tl('healthDebtRatioDesc')}</div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: over ? 'var(--danger)' : 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>{debtRatio.toFixed(1)}%</div>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, debtRatio)}%`, background: over ? 'var(--danger)' : 'var(--success)', borderRadius: 3, transition: 'width .4s' }} />
                  </div>
                </div>
              )
            })()}
            {/* Invested quota */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{tl('healthInvestedQuota')}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{tl('healthInvestedQuotaDesc')}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#7c6df7', fontVariantNumeric: 'tabular-nums' }}>{investedQuota.toFixed(1)}%</div>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, investedQuota)}%`, background: '#7c6df7', borderRadius: 3, transition: 'width .4s' }} />
              </div>
            </div>
            {/* Safety liquidity */}
            {safetyMonths !== null && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{tl('healthSafetyLiquidity')}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{tl('healthSafetyLiquidityDesc')}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#5bc8d0', fontVariantNumeric: 'tabular-nums' }}>{tl('healthSafetyLiquidityUnit', { months: safetyMonths.toFixed(1) })}</div>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (safetyMonths / 12) * 100)}%`, background: '#5bc8d0', borderRadius: 3, transition: 'width .4s' }} />
                </div>
              </div>
            )}
            {/* Property equity */}
            {properties.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{tl('healthPropertyEquity')}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{tl('healthPropertyEquityDesc')}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>{fmt(propertyEquity)}</div>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, propertyValue > 0 ? (propertyEquity / propertyValue) * 100 : 0)}%`, background: '#f59e0b', borderRadius: 3, transition: 'width .4s' }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Immobili ──────────────────────────────────────────── */}
      <div className="ledgernest-card">
        <div className="ledgernest-card-header">
          <div>
            <span className="ledgernest-card-title">{tl('propertiesTitle')}</span>
            {properties.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {tl('propertiesValue', { value: fmt(propertyValue), equity: fmt(properties.reduce((s, p) => {
                  const liab = liabilities.find((l) => l.id === p.linkedLiabilityId)
                  return s + (p.currentValue - (liab?.residuo ?? 0))
                }, 0)) })}
              </div>
            )}
          </div>
          <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" onClick={() => setShowAddProperty(true)} style={{ gap: 6 }}>
            <Icon name="plus" size={13} /> {tl('propertiesAdd')}
          </button>
        </div>

        {properties.length === 0 ? (
          <div className="ledgernest-empty" style={{ padding: '32px 0' }}>{tl('propertiesEmpty')}</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14, padding: '8px 16px 16px' }}>
              {properties.map((p) => {
                const liab = liabilities.find((l) => l.id === p.linkedLiabilityId)
                const debt = liab?.residuo ?? 0
                const equity = p.currentValue - debt
                const equityPct = p.currentValue > 0 ? (equity / p.currentValue) * 100 : 100
                return (
                  <div key={p.id} style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏠</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>{p.propertyType}</span>
                            {p.city && <span>{p.city}{p.country ? ` · ${p.country}` : ''}</span>}
                            {p.yearAcquired && <span>· {tl('propertySince', { year: p.yearAcquired })}</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(p.currentValue)}</div>
                        <button onClick={() => setEditingProperty(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '3px 5px', borderRadius: 6, display: 'inline-flex' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}>
                          <Icon name="edit" size={13} />
                        </button>
                        <button onClick={() => deleteProperty(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '3px 5px', borderRadius: 6, display: 'inline-flex' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}>
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </div>
                    {/* Equity bar */}
                    <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', background: debt > 0 ? '#f85149' : '#3fb950', marginBottom: 8 }}>
                      <div style={{ height: '100%', width: `${Math.min(100, equityPct)}%`, background: '#3fb950', borderRadius: 3, transition: 'width .4s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#3fb950', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(equity)} equity</span>
                      <span style={{ color: debt > 0 ? 'var(--danger)' : 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                        {debt > 0 ? tl('propertyMortgageBalance', { amount: fmt(debt) }) : tl('propertyNoDebt')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Footer equity/LTV */}
            {(() => {
              const totalEquity = properties.reduce((s, p) => {
                const liab = liabilities.find((l) => l.id === p.linkedLiabilityId)
                return s + (p.currentValue - (liab?.residuo ?? 0))
              }, 0)
              const totalDebt = properties.reduce((s, p) => {
                const liab = liabilities.find((l) => l.id === p.linkedLiabilityId)
                return s + (liab?.residuo ?? 0)
              }, 0)
              const ltv = propertyValue > 0 ? (totalDebt / propertyValue) * 100 : 0
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{tl('propertyTotalEquity')}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmt(totalEquity)}</div>
                  </div>
                  {ltv > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Loan-to-value</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, color: ltv > 80 ? 'var(--danger)' : ltv > 60 ? 'var(--warning, #d29922)' : 'var(--success)' }}>{ltv.toFixed(0)}%</div>
                    </div>
                  )}
                </div>
              )
            })()}
          </>
        )}
      </div>

      {/* ── Passività ─────────────────────────────────────────── */}
      <div className="ledgernest-card">
        <div className="ledgernest-card-header">
          <div>
            <span className="ledgernest-card-title">{tl('liabilitiesHeader', { count: liabilities.length })}</span>
            {liabilities.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {tl('liabilitiesTotalPayment', { payment: fmt(liabilities.reduce((s, l) => s + l.monthlyPayment, 0)), balance: fmt(totalLiabilities) })}
              </div>
            )}
          </div>
          <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" onClick={() => setShowAddLiability(true)} style={{ gap: 6 }}>
            <Icon name="plus" size={13} /> {tl('liabilitiesAdd')}
          </button>
        </div>

        {liabilities.length === 0 ? (
          <div className="ledgernest-empty" style={{ padding: '32px 0' }}>{tl('liabilitiesEmpty')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                  {[tl('liabilitiesColItem'), tl('liabilitiesColRepayment'), tl('liabilitiesColBalance'), tl('liabilitiesColPayment'), tl('liabilitiesColRate'), tl('liabilitiesColEnd'), ''].map((h, hi) => (
                    <th key={hi} style={{ padding: '8px 16px', textAlign: hi >= 2 && hi <= 5 ? 'right' : 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liabilities.map((l) => {
                  const repaidPct = l.originalAmount && l.originalAmount > 0
                    ? Math.min(100, ((l.originalAmount - l.residuo) / l.originalAmount) * 100)
                    : null
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background .1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '12px 16px', minWidth: 160 }}>
                        <div style={{ fontWeight: 600 }}>{l.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>{liabTypeLabel[l.type]}</span>
                          {l.startYear && <span>· {tl('liabilitySince', { year: l.startYear })}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', minWidth: 200 }}>
                        {repaidPct !== null ? (
                          <>
                            <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-surface)', overflow: 'hidden', marginBottom: 5 }}>
                              <div style={{ height: '100%', width: `${repaidPct}%`, background: '#3fb950', borderRadius: 3, transition: 'width .4s' }} />
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                              <span style={{ color: '#3fb950', fontWeight: 600 }}>{tl('liabilityRepaid', { pct: repaidPct.toFixed(0) })}</span>
                              {l.originalAmount && <span> · {fmt(l.originalAmount)}</span>}
                            </div>
                          </>
                        ) : <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>{fmt(l.residuo)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(l.monthlyPayment)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>{l.interestRate > 0 ? `${l.interestRate.toFixed(1)}%` : '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>{l.endYear}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button onClick={() => setEditingLiability(l)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px 6px', borderRadius: 6, display: 'inline-flex' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}>
                            <Icon name="edit" size={13} />
                          </button>
                          <button onClick={() => deleteLiability(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px 6px', borderRadius: 6, display: 'inline-flex' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}>
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(showAddLiability || editingLiability) && (
        <AddLiabilityModal
          initial={editingLiability ?? undefined}
          onClose={() => { setShowAddLiability(false); setEditingLiability(null) }}
          onAdd={(data) => {
            if (editingLiability) updateLiability(editingLiability.id, data)
            else addLiability(data)
          }}
        />
      )}
      {(showAddProperty || editingProperty) && (
        <PropertyModal
          initial={editingProperty ?? undefined}
          onClose={() => { setShowAddProperty(false); setEditingProperty(null) }}
          onSave={(data) => {
            if (editingProperty) updateProperty(editingProperty.id, data)
            else addProperty(data)
          }}
        />
      )}
    </div>
  )
}
