'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  // Touch devices (phones, foldables, tablets) get a bottom sheet instead of a floating panel:
  // fixed coordinates computed at open time break as soon as the on-screen keyboard appears.
  const [sheet, setSheet] = useState(false)
  // Space covered by the on-screen keyboard (iOS keeps fixed elements behind it)
  const [kbInset, setKbInset] = useState(0)
  const [vvHeight, setVvHeight] = useState<number | null>(null)
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
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open || !sheet) return
    const vv = window.visualViewport
    if (!vv) return
    const viewport = vv
    function update() {
      setKbInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop))
      setVvHeight(viewport.height)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [open, sheet])

  useEffect(() => {
    if (!open || sheet) return
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
  }, [open, sheet])

  function handleOpen() {
    setSearch('')
    const isTouch =
      window.innerWidth <= 640 || window.matchMedia('(hover: none) and (pointer: coarse)').matches
    setSheet(isTouch)
    if (isTouch) {
      // Drop focus from whatever field was active so the keyboard closes before the sheet opens
      ;(document.activeElement as HTMLElement | null)?.blur?.()
    } else if (containerRef?.current) {
      // Desktop: side panel to the right of the modal container
      const r = containerRef.current.getBoundingClientRect()
      const panelW = 280
      const spaceRight = window.innerWidth - r.right
      const left = spaceRight >= panelW + 12 ? r.right + 12 : r.left - panelW - 12
      setPanelPos({ top: r.top, left, width: panelW, height: r.height })
    } else {
      // No container: dropdown below (or above) trigger, clamped to viewport
      const r = triggerRef.current!.getBoundingClientRect()
      const panelH = 320
      const panelW = Math.min(Math.max(r.width, 280), window.innerWidth - 24)
      const top = window.innerHeight - r.bottom >= panelH ? r.bottom + 4 : Math.max(12, r.top - panelH - 4)
      const left = Math.max(12, Math.min(r.left, window.innerWidth - panelW - 12))
      setPanelPos({ top, left, width: panelW, height: panelH })
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

      {open && typeof document !== 'undefined' && createPortal(
        // Portal to <body>: escapes the modal's containing block (backdrop-filter/transform)
        // and its touch-action:none. Stop propagation so React does not bubble clicks
        // through the portal into the modal overlay's close handler.
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {sheet && (
            <div
              onClick={() => setOpen(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 9998,
                background: 'rgba(0,0,0,0.45)',
                animation: 'ledgernest-overlay-in 0.15s ease',
                touchAction: 'none',
              }}
            />
          )}
          <div
            ref={panelRef}
            role="dialog"
            aria-label={placeholder}
            style={sheet ? {
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: kbInset,
              margin: '0 auto',
              width: '100%',
              maxWidth: 560,
              height: vvHeight ? Math.min(vvHeight * 0.75, vvHeight - 24) : '75dvh',
              zIndex: 9999,
              background: 'var(--bg-surface)',
              borderTop: '1px solid var(--border-subtle)',
              borderRadius: '18px 18px 0 0',
              boxShadow: '0 -12px 40px rgba(0,0,0,0.35)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              paddingBottom: kbInset > 0 ? 0 : 'env(safe-area-inset-bottom, 0px)',
              animation: 'ledgernest-slide-up 0.2s ease',
            } : {
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
            {sheet && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 0', flexShrink: 0 }}>
                <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {placeholder.replace(/[….]+$/, '')}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Chiudi"
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none',
                    background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}

            {/* Search */}
            <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
              <input
                // No autofocus on touch: it would pop the keyboard over the list
                autoFocus={!sheet}
                type="search"
                enterKeyHint="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca categorie..."
                style={{
                  width: '100%', padding: sheet ? '10px 12px' : '8px 11px', borderRadius: 9,
                  border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  // 16px minimum, otherwise iOS Safari zooms the page on focus
                  fontSize: sheet ? 16 : 13,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            {/* List */}
            <div style={{
              flex: 1, overflowY: 'auto', minHeight: 0,
              WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y',
            }}>
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
                          padding: sheet ? '10px 16px' : '7px 14px',
                          minHeight: sheet ? 48 : undefined,
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                          background: isSelected ? `${cat.color}18` : 'transparent',
                          color: isSelected ? cat.color : 'var(--text-primary)',
                          fontSize: sheet ? 15 : 13,
                        }}
                        onMouseEnter={(e) => {
                          if (!sheet && !isSelected) e.currentTarget.style.background = 'var(--bg-elevated)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isSelected ? `${cat.color}18` : 'transparent'
                        }}
                      >
                        <span style={{
                          width: sheet ? 30 : 26, height: sheet ? 30 : 26, borderRadius: 7, background: `${cat.color}22`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: sheet ? 15 : 13, flexShrink: 0,
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
        </div>,
        document.body
      )}
    </>
  )
}
