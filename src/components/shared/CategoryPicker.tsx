'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFinanceStore } from '@/stores/financeStore'

interface CategoryPickerProps {
  value: string
  onChange: (name: string) => void
  typeFilter?: 'income' | 'expense' | 'all'
  placeholder?: string
  containerRef?: React.RefObject<HTMLDivElement>
}

export function CategoryPicker({
  value,
  onChange,
  typeFilter = 'all',
  placeholder = 'Seleziona categoria…',
  containerRef,
}: CategoryPickerProps) {
  const { budgetCategories, budgetGroups } = useFinanceStore()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 260, height: 400 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const parentIds = useMemo(
    () => new Set(budgetCategories.filter((c) => c.parentId).map((c) => c.parentId!)),
    [budgetCategories]
  )

  const leafCats = useMemo(
    () => budgetCategories.filter((c) => !parentIds.has(c.id)),
    [budgetCategories, parentIds]
  )

  const byType =
    typeFilter === 'all' ? leafCats : leafCats.filter((c) => !c.type || c.type === typeFilter)

  const q = search.trim().toLowerCase()
  const filtered = q ? byType.filter((c) => c.name.toLowerCase().includes(q)) : byType

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const cat of filtered) {
      const g = cat.group ?? 'other'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(cat)
    }
    return Array.from(map.entries()).map(([gid, cats]) => ({
      group: budgetGroups.find((g) => g.id === gid),
      cats,
    }))
  }, [filtered, budgetGroups])

  const selected = budgetCategories.find((c) => c.name === value || c.id === value)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (
        panelRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      )
        return
      setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function handleOpen() {
    setSearch('')
    if (containerRef?.current) {
      // Side panel: appear to the right of the modal container
      const r = containerRef.current.getBoundingClientRect()
      const panelW = 280
      // Prefer right side; fall back to left if no space
      const spaceRight = window.innerWidth - r.right
      const left = spaceRight >= panelW + 12 ? r.right + 12 : r.left - panelW - 12
      setPanelPos({ top: r.top, left, width: panelW, height: r.height })
    } else {
      // Fallback: dropdown below trigger
      const r = triggerRef.current!.getBoundingClientRect()
      const panelH = 360
      const top = window.innerHeight - r.bottom >= panelH ? r.bottom + 4 : r.top - panelH - 4
      setPanelPos({ top, left: r.left, width: Math.max(r.width, 260), height: panelH })
    }
    setOpen((v) => !v)
  }

  function selectCat(name: string) {
    onChange(name)
    setOpen(false)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)',
          background: 'var(--bg-elevated)', cursor: 'pointer', textAlign: 'left',
          color: selected ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 13,
          transition: 'border-color .15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
      >
        {selected ? (
          <span style={{
            width: 24, height: 24, borderRadius: 6, background: `${selected.color}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
          }}>
            {selected.emoji}
          </span>
        ) : (
          <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
            📋
          </span>
        )}
        <span style={{ flex: 1 }}>{selected?.name ?? placeholder}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: panelPos.top,
            left: panelPos.left,
            width: panelPos.width,
            height: panelPos.height,
            zIndex: 9999,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 14,
            boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca categorie..."
              style={{
                width: '100%', padding: '8px 11px', borderRadius: 9,
                border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
                color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                Nessuna categoria trovata
              </div>
            )}
            {groups.map(({ group, cats }) => (
              <div key={group?.id ?? 'other'}>
                <div style={{
                  padding: '10px 14px 3px', fontSize: 10, fontWeight: 800,
                  letterSpacing: '0.09em', textTransform: 'uppercase',
                  color: group?.color ?? 'var(--text-tertiary)',
                }}>
                  {group?.label ?? 'Altro'}
                </div>
                {cats.map((cat) => {
                  const isSelected = value === cat.name || value === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => selectCat(cat.name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '7px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                        background: isSelected ? `${cat.color}18` : 'transparent',
                        color: isSelected ? cat.color : 'var(--text-primary)', fontSize: 13,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'var(--bg-elevated)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isSelected ? `${cat.color}18` : 'transparent'
                      }}
                    >
                      <span style={{
                        width: 26, height: 26, borderRadius: 7, background: `${cat.color}22`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, flexShrink: 0,
                      }}>
                        {cat.emoji}
                      </span>
                      <span style={{ flex: 1 }}>{cat.name}</span>
                      {isSelected && (
                        <svg width="12" height="9" viewBox="0 0 12 9" fill="none" style={{ flexShrink: 0 }}>
                          <path d="M1 4l3.5 3.5L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
