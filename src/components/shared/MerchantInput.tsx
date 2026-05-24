'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useFinanceStore } from '@/stores/financeStore'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputStyle?: React.CSSProperties
}

export default function MerchantInput({ value, onChange, placeholder = 'Es. Amazon, Esselunga…', inputStyle }: Props) {
  const { transactions } = useFinanceStore()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // All unique non-empty merchants from existing transactions, sorted alphabetically
  const allMerchants = useMemo(() => {
    const set = new Set<string>()
    for (const t of transactions) {
      if (t.merchant?.trim()) set.add(t.merchant.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'it'))
  }, [transactions])

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return allMerchants.slice(0, 8)
    return allMerchants.filter((m) => m.toLowerCase().includes(q)).slice(0, 8)
  }, [value, allMerchants])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const base: React.CSSProperties = {
    padding: '10px 14px', borderRadius: 10,
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-elevated)', color: 'var(--text-primary)',
    width: '100%', boxSizing: 'border-box', fontSize: 13,
    outline: 'none',
    ...inputStyle,
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        style={base}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
      />

      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,.35)',
        }}>
          {suggestions.map((m) => (
            <button
              key={m}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(m); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 14px', border: 'none', background: 'none',
                color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                borderBottom: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover, var(--bg-surface))')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
