'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useSettingsStore } from '@/stores/settingsStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useFinanceStore } from '@/stores/financeStore'
import Icon from '@/components/shared/Icon'
import CSVImportWizard from '@/components/shared/CSVImportWizard'
import { BRAND_FAVICON_DOMAINS, normalizeMerchantName } from '@/lib/utils/csvImport'
import type { BudgetCategory, BudgetGroup, Currency, Theme, Locale } from '@/types'

// ── constants ────────────────────────────────────────────────

const COLOR_THEMES = [
  { id: 'carbonio',  name: 'Carbonio',  accent: '#5bc8d0', sidebar: '#111418' },
  { id: 'notte',     name: 'Notte',     accent: '#60a5fa', sidebar: '#1c2a4a' },
  { id: 'indaco',    name: 'Indaco',    accent: '#818cf8', sidebar: '#1e1b4b' },
  { id: 'viola',     name: 'Viola',     accent: '#c084fc', sidebar: '#2d1654' },
  { id: 'ametista',  name: 'Ametista',  accent: '#e879a8', sidebar: '#32134a' },
  { id: 'rubino',    name: 'Rubino',    accent: '#f87171', sidebar: '#3a0f0f' },
  { id: 'tramonto',  name: 'Tramonto',  accent: '#fb923c', sidebar: '#2d1a08' },
  { id: 'smeraldo',  name: 'Smeraldo',  accent: '#34d399', sidebar: '#0d2e22' },
  { id: 'ardesia',   name: 'Ardesia',   accent: '#94a3b8', sidebar: '#161b22' },
  { id: 'chiaro',    name: 'Chiaro',    accent: '#0891b2', sidebar: '#f0f4f8' },
]

type ThemeOption = [Theme, string, string]
const THEME_OPTIONS: ThemeOption[] = [
  ['dark',   'Scuro',  '🌙'],
  ['light',  'Chiaro', '☀️'],
  ['system', 'Sistema','🖥️'],
]

const CAT_COLORS = [
  '#5bc8d0', '#7c6df7', '#3fb950', '#f77c3a', '#f85149', '#58a6ff',
  '#d29922', '#e879a8', '#84cc16', '#06b6d4', '#a78bfa', '#fb923c',
]

const EMOJI_CATS = [
  { icon: '🏠', label: 'Casa',      emojis: ['🏠','🏡','🏘️','🏗️','🏢','🏬','🏦','🛏️','🛋️','🪑','🚿','🛁','🪴','🧹','🧺','💡','🔌','🔒','🗑️','📦','🧰','🔧','🔨','⚙️','🪤','🫙','🧯','🪣','🧲','🪜','🏊','🛖'] },
  { icon: '🍕', label: 'Cibo',      emojis: ['🍕','🍔','🍟','🌮','🌯','🥗','🥘','🍲','🍜','🍝','🍣','🥩','🍗','🥚','🍳','🥐','🧁','🎂','🍰','🍩','🍪','🍫','🍭','🥤','☕','🧃','🍷','🍸','🥂','🍻','🧋','🫖'] },
  { icon: '🚗', label: 'Trasporti', emojis: ['🚗','🚕','🚙','🏎️','🚌','🚎','🚑','🚒','✈️','🛳️','⛵','🚂','🚇','🏍️','🛵','🚲','🛴','🚁','⛽','🅿️','🚦','🛣️','🗺️','🧭','🏔️','🌊','🌍','🗼','🌐','🛫','🛬','🛟'] },
  { icon: '🎭', label: 'Svago',     emojis: ['🎭','🎬','🎮','🕹️','🎲','🎯','🎳','⛳','🎸','🎹','🎺','🎻','🎤','🎧','🎼','📚','📖','🖌️','🎨','🎪','🏆','🥇','🎫','🎟️','🎡','🎢','🎠','🎉','🎊','🎁','🎀','🎑'] },
  { icon: '💰', label: 'Finanza',   emojis: ['💰','💵','💶','💷','💸','💳','💹','📈','📉','📊','🪙','💎','🏷️','🧾','📄','📋','📌','🔑','🏧','💼','🗂️','📦','📨','📧','📬','🖊️','✏️','📝','📁','🗃️','🗄️','🔐'] },
  { icon: '❤️', label: 'Salute',    emojis: ['❤️','🩺','💊','💉','🩻','🏥','🏃','🚶','🧘','🤸','⚽','🏀','🎾','🏊','🚴','🧗','🥊','⚾','🏈','🎿','🏄','🛹','🏋️','🤽','🧩','🎯','🧸','🪆','🫶','🦷','🦴','🩹'] },
  { icon: '🛍️', label: 'Shopping',  emojis: ['🛍️','👗','👔','👕','👖','🧥','🧣','🧤','🧦','👠','👟','👜','👛','🎒','🧳','💄','💍','💎','🪮','🛒','🏪','🎀','🪞','🩱','🩲','🩳','🥻','🥽','🪭','🕶️','👓','🌂'] },
  { icon: '🌱', label: 'Natura',    emojis: ['🌱','🌿','🌲','🌳','🌴','🌵','🍀','🍁','🍂','🍃','🌸','🌺','🌻','🌹','🌷','🪷','🌼','💐','🍄','🌾','🌊','🏔️','🏕️','🌅','🌄','🌠','⛅','🌈','❄️','🔥','⭐','🌙'] },
]

// ── helpers ───────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 26, borderRadius: 13, cursor: 'pointer', position: 'relative', flexShrink: 0,
        background: checked ? 'var(--accent)' : 'var(--bg-elevated)',
        border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-subtle)'}`,
        transition: 'background .2s, border-color .2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: checked ? '#fff' : 'var(--text-tertiary)',
        transition: 'left .2s, background .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,.3)',
      }} />
    </div>
  )
}

function TabGroup<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: `1.5px solid ${value === o.value ? 'var(--accent)' : 'var(--border-subtle)'}`,
            background: value === o.value ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'transparent',
            color: value === o.value ? 'var(--accent)' : 'var(--text-secondary)',
            transition: 'all .15s',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 24 }}>{children}</div>
    </div>
  )
}

// ── emoji picker ──────────────────────────────────────────────

function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  const [catIdx, setCatIdx] = useState(0)
  const cat = EMOJI_CATS[catIdx]
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Category tabs */}
      <div style={{ display: 'flex', overflowX: 'auto', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', padding: '6px 8px', gap: 4 }}>
        {EMOJI_CATS.map((c, i) => (
          <button
            key={i}
            onClick={() => setCatIdx(i)}
            style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0, cursor: 'pointer', fontSize: 16,
              border: 'none', background: catIdx === i ? 'var(--bg-surface)' : 'transparent',
              outline: catIdx === i ? `2px solid var(--accent)` : 'none',
              outlineOffset: -2, transition: 'background .1s',
            }}
            title={c.label}
          >
            {c.icon}
          </button>
        ))}
      </div>
      {/* Emoji grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2, padding: 8, maxHeight: 200, overflowY: 'auto', background: 'var(--bg-surface)' }}>
        {cat.emojis.map((e) => (
          <button
            key={e}
            onClick={() => onChange(e)}
            style={{
              width: '100%', aspectRatio: '1', fontSize: 20, borderRadius: 6, cursor: 'pointer', border: 'none',
              background: value === e ? 'color-mix(in oklch, var(--accent) 20%, transparent)' : 'transparent',
              outline: value === e ? `2px solid var(--accent)` : 'none',
              transition: 'background .1s',
            }}
          >
            {e}
          </button>
        ))}
      </div>
      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-tertiary)' }}>
        <span>Selezionato: <span style={{ fontSize: 16 }}>{value}</span></span>
        <span>{cat.emojis.length} emoji</span>
      </div>
    </div>
  )
}

// ── merchant helpers ──────────────────────────────────────────

function merchantHue(name: string) {
  return name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
}

function MerchantAvatar({ name, logo, size = 40 }: { name: string; logo?: string; size?: number }) {
  const hue = merchantHue(name)
  const r   = Math.round(size * 0.28)
  return (
    <div style={{
      width: size, height: size, borderRadius: r, flexShrink: 0, overflow: 'hidden',
      background: logo ? '#fff' : `hsl(${hue},52%,38%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, color: '#fff',
      border: '1.5px solid var(--border-subtle)',
    }}>
      {logo
        ? <img src={logo} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        : (name[0]?.toUpperCase() ?? '?')}
    </div>
  )
}

function MerchantLogoModal({ merchant, current, onClose, onSave }: {
  merchant: string; current?: string
  onClose: () => void; onSave: (logo: string) => void
}) {
  const extractDomain = (url: string) => {
    const m = url.match(/domain=([^&]+)/)
    return m ? m[1] : ''
  }
  const isFavicon = (s: string) => s.includes('google.com/s2/favicons')

  const [domain,    setDomain]    = useState(() => current && isFavicon(current) ? extractDomain(current) : '')
  const [customUrl, setCustomUrl] = useState(() => current && !isFavicon(current) ? current : '')
  const [preview,   setPreview]   = useState(current ?? '')
  const [tab,       setTab]       = useState<'domain' | 'url'>(current && !isFavicon(current) && current ? 'url' : 'domain')
  const [imgError,  setImgError]  = useState(false)

  const faviconUrl = (d: string) =>
    `https://www.google.com/s2/favicons?sz=128&domain=${d.trim().replace(/^https?:\/\//, '')}`

  const applyDomain = () => { if (domain.trim()) { setPreview(faviconUrl(domain)); setImgError(false) } }
  const applyUrl    = () => { if (customUrl.trim()) { setPreview(customUrl.trim()); setImgError(false) } }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, width: 440, boxShadow: '0 32px 80px rgba(0,0,0,.6)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '18px 22px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Live preview */}
          <div style={{ width: 64, height: 64, borderRadius: 16, background: preview && !imgError ? '#fff' : `hsl(${merchantHue(merchant)},52%,38%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1.5px solid var(--border-subtle)', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,.18)' }}>
            {preview && !imgError
              ? <img src={preview} alt="" style={{ width: '75%', height: '75%', objectFit: 'contain' }} onError={() => setImgError(true)} />
              : <span style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{merchant[0]?.toUpperCase()}</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Logo esercente</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{merchant}</div>
            {preview && imgError && <div style={{ fontSize: 11, color: '#f85149', marginTop: 4 }}>Immagine non valida o non caricabile</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 22px' }}>
          {(['domain', 'url'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 0', marginRight: 20, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: tab === t ? 700 : 500,
              color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1, transition: 'all .12s',
            }}>
              {t === 'domain' ? 'Da dominio (favicon)' : 'URL immagine'}
            </button>
          ))}
        </div>

        <div style={{ padding: '20px 22px' }}>
          {tab === 'domain' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Inserisci il dominio del sito dell&apos;esercente per caricare il logo automaticamente.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="ledgernest-input"
                  placeholder="es. esselunga.it o amazon.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyDomain() }}
                  autoFocus
                  style={{ flex: 1, height: 38, fontSize: 13 }}
                />
                <button className="ledgernest-btn ledgernest-btn-ghost" onClick={applyDomain} style={{ flexShrink: 0 }}>
                  Carica
                </button>
              </div>
            </div>
          )}

          {tab === 'url' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Incolla l&apos;URL diretto di un&apos;immagine (PNG, JPG, SVG, WebP).
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="ledgernest-input"
                  placeholder="https://..."
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyUrl() }}
                  autoFocus
                  style={{ flex: 1, height: 38, fontSize: 13 }}
                />
                <button className="ledgernest-btn ledgernest-btn-ghost" onClick={applyUrl} style={{ flexShrink: 0 }}>
                  Usa
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border-subtle)' }}>
          {current && (
            <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm"
              style={{ color: 'var(--text-tertiary)' }}
              onClick={() => { onSave(''); onClose() }}>
              Rimuovi logo
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="ledgernest-btn ledgernest-btn-ghost" onClick={onClose}>Annulla</button>
          <button
            className="ledgernest-btn ledgernest-btn-primary"
            disabled={!preview || imgError}
            onClick={() => { if (preview && !imgError) { onSave(preview); onClose() } }}
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  )
}

// ── generic item modal (group / categoria / sotto-categoria) ──

function ItemModal({ title, subtitle, initialName = '', initialEmoji = '📋', initialColor = '#5bc8d0', onClose, onSave }: {
  title: string; subtitle?: string
  initialName?: string; initialEmoji?: string; initialColor?: string
  onClose: () => void
  onSave: (name: string, emoji: string, color: string) => void
}) {
  const [name,  setName]  = useState(initialName)
  const [emoji, setEmoji] = useState(initialEmoji)
  const [color, setColor] = useState(initialColor)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, width: 420, boxShadow: '0 32px 80px rgba(0,0,0,.6)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 22px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20, lineHeight: 1, padding: 2 }}>×</button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Nome</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 20 }}>{emoji}</span>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { onSave(name.trim(), emoji, color); onClose() } }}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Icona</div>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Colore</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CAT_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} style={{ width: 34, height: 34, borderRadius: 9, background: c, border: 'none', cursor: 'pointer', flexShrink: 0, outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: 2, opacity: color === c ? 1 : 0.65, transition: 'all .12s' }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border-subtle)' }}>
          <button onClick={onClose} className="ledgernest-btn ledgernest-btn-ghost">Annulla</button>
          <button onClick={() => { if (name.trim()) { onSave(name.trim(), emoji, color); onClose() } }} className="ledgernest-btn ledgernest-btn-primary" disabled={!name.trim()}>Salva</button>
        </div>
      </div>
    </div>
  )
}

function ConfirmDeleteModal({ msg, onClose, onConfirm }: { msg: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, width: 360, padding: '24px 24px 18px', boxShadow: '0 32px 80px rgba(0,0,0,.6)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>{msg}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm">Annulla</button>
          <button onClick={() => { onConfirm(); onClose() }} className="ledgernest-btn ledgernest-btn-danger ledgernest-btn-sm">Elimina</button>
        </div>
      </div>
    </div>
  )
}

// ── nuova categoria modal ─────────────────────────────────────

type NewCatType  = 'expense' | 'income'
type NewCatGroup = string

function NuovaCategoriaModal({ onClose, onSave, initialType = 'expense' }: {
  onClose: () => void
  onSave: (name: string, catType: NewCatType, group: NewCatGroup, emoji: string, color: string) => void
  initialType?: NewCatType
}) {
  const { budgetGroups } = useFinanceStore()
  const expenseGroups = budgetGroups.filter((g) => g.id !== 'income' && g.id !== 'transfers').sort((a, b) => a.order - b.order)
  const defaultGroup = expenseGroups[0]?.id ?? 'lifestyle'
  const [catType, setCatType] = useState<NewCatType>(initialType)
  const [name,    setName]    = useState('')
  const [group,   setGroup]   = useState<NewCatGroup>(defaultGroup)
  const [emoji,   setEmoji]   = useState('📋')
  const [color,   setColor]   = useState('#5bc8d0')

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, width: 440, boxShadow: '0 32px 80px rgba(0,0,0,.6)', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 22px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Nuova categoria</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Crea una categoria per organizzare i movimenti</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20, lineHeight: 1, padding: 2 }}>×</button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Tipo */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Tipo</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['expense', 'income'] as NewCatType[]).map((t) => (
                <button key={t} onClick={() => setCatType(t)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  border: `1.5px solid ${catType === t ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  background: catType === t ? 'var(--accent)' : 'transparent',
                  color: catType === t ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                  transition: 'all .15s',
                }}>
                  {t === 'expense' ? '↑ Uscita' : '↓ Entrata'}
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Nome</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 20 }}>{emoji}</span>
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder={catType === 'income' ? 'Es. Stipendio' : 'Es. Spesa alimentare'}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Gruppo (solo uscite) */}
          {catType === 'expense' && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Gruppo</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {expenseGroups.map((g) => (
                <button key={g.id} onClick={() => setGroup(g.id)} style={{
                  padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${group === g.id ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  background: group === g.id ? 'color-mix(in oklch, var(--accent) 12%, transparent)' : 'transparent',
                  color: group === g.id ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all .15s',
                }}>{g.emoji} {g.label}</button>
              ))}
            </div>
          </div>
          )}

          {/* Icona */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Icona</div>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>

          {/* Colore */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Colore</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CAT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 34, height: 34, borderRadius: 9, background: c, border: 'none', cursor: 'pointer', flexShrink: 0,
                    outline: color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2,
                    opacity: color === c ? 1 : 0.65,
                    transition: 'all .12s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border-subtle)' }}>
          <button onClick={onClose} className="ledgernest-btn ledgernest-btn-ghost">Annulla</button>
          <button
            onClick={() => { if (name.trim()) { onSave(name.trim(), catType, group, emoji, color); onClose() } }}
            className="ledgernest-btn ledgernest-btn-primary"
            disabled={!name.trim()}
          >
            Crea categoria
          </button>
        </div>
      </div>
    </div>
  )
}

// ── edit categoria modal ──────────────────────────────────────

function EditCategoriaModal({ cat, onClose, onSave, onDelete }: {
  cat: BudgetCategory
  onClose: () => void
  onSave: (id: string, patch: Partial<BudgetCategory>) => void
  onDelete: (id: string) => void
}) {
  const [name,          setName]          = useState(cat.name)
  const [emoji,         setEmoji]         = useState(cat.emoji)
  const [color,         setColor]         = useState(cat.color)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, width: 440, boxShadow: '0 32px 80px rgba(0,0,0,.6)', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 22px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: `${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{emoji}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Modifica categoria</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{cat.name}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20, lineHeight: 1, padding: 2 }}>×</button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Nome */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Nome</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 20 }}>{emoji}</span>
              <input
                value={name} onChange={(e) => setName(e.target.value)} autoFocus
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Icona */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Icona</div>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>

          {/* Colore */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Colore</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CAT_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 34, height: 34, borderRadius: 9, background: c, border: 'none', cursor: 'pointer', flexShrink: 0,
                  outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: 2,
                  opacity: color === c ? 1 : 0.65, transition: 'all .12s',
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border-subtle)' }}>
          {confirmDelete ? (
            <>
              <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600, flex: 1 }}>Eliminare &ldquo;{cat.name}&rdquo;?</span>
              <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" onClick={() => setConfirmDelete(false)}>Annulla</button>
              <button className="ledgernest-btn ledgernest-btn-danger ledgernest-btn-sm" onClick={() => { onDelete(cat.id); onClose() }}>Elimina</button>
            </>
          ) : (
            <>
              <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>🗑 Elimina</button>
              <div style={{ flex: 1 }} />
              <button className="ledgernest-btn ledgernest-btn-ghost" onClick={onClose}>Annulla</button>
              <button
                className="ledgernest-btn ledgernest-btn-primary"
                disabled={!name.trim()}
                onClick={() => { if (name.trim()) { onSave(cat.id, { name: name.trim(), emoji, color }); onClose() } }}
              >
                Salva modifiche
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── MergeModal ────────────────────────────────────────────────

function MergeModal({ merchants, counts, onClose, onMerge }: {
  merchants: string[]
  counts: Map<string, number>
  onClose: () => void
  onMerge: (aliases: string[], canonical: string) => void
}) {
  const [choice, setChoice]       = useState(merchants[0])
  const [custom, setCustom]       = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const canonical = useCustom ? custom.trim() : choice

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, width: 420, boxShadow: '0 32px 80px rgba(0,0,0,.6)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Unisci esercenti</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Scegli il nome canonico da mantenere</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20, lineHeight: 1, padding: 2 }}>×</button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {merchants.map((m) => (
            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${!useCustom && choice === m ? 'var(--accent)' : 'var(--border-subtle)'}`, background: !useCustom && choice === m ? 'var(--accent-dim)' : 'var(--bg-elevated)', cursor: 'pointer' }}>
              <input type="radio" checked={!useCustom && choice === m} onChange={() => { setChoice(m); setUseCustom(false) }} style={{ accentColor: 'var(--accent)' }} />
              <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{m}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{counts.get(m) ?? 0} mov.</span>
            </label>
          ))}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${useCustom ? 'var(--accent)' : 'var(--border-subtle)'}`, background: useCustom ? 'var(--accent-dim)' : 'var(--bg-elevated)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="radio" checked={useCustom} onChange={() => setUseCustom(true)} style={{ accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Nome personalizzato</span>
            </div>
            <input
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setUseCustom(true) }}
              placeholder="Es. Tabaccheria Musine"
              onClick={(e) => { e.stopPropagation(); setUseCustom(true) }}
              style={{ marginLeft: 24, padding: '7px 11px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border-subtle)' }}>
          <button onClick={onClose} className="ledgernest-btn ledgernest-btn-ghost">Annulla</button>
          <button
            onClick={() => { if (canonical) onMerge(merchants, canonical) }}
            disabled={!canonical}
            className="ledgernest-btn ledgernest-btn-primary"
          >
            Unisci
          </button>
        </div>
      </div>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────

const SIDEBAR_ITEMS = [
  { id: 'profilo',    label: 'Profilo',        icon: 'briefcase' },
  { id: 'categorie',  label: 'Categorie',       icon: 'movimenti' },
  { id: 'aspetto',    label: 'Aspetto',         icon: 'impostazioni' },
  { id: 'conti',      label: 'Conti e broker',  icon: 'conti' },
  { id: 'esercenti',  label: 'Esercenti',       icon: 'wallet' },
  { id: 'notifiche',  label: 'Notifiche',       icon: 'bell' },
  { id: 'privacy',    label: 'Privacy e sicur.', icon: 'report' },
  { id: 'piano',      label: 'Piano · Pro',     icon: 'obiettivi' },
  { id: 'dati',       label: 'Dati ed export',  icon: 'download' },
]

export default function ImpostazioniPage() {
  const t = useTranslations('settings')
  const { settings, updateSettings } = useSettingsStore()
  const { resetPortfolio } = usePortfolioStore()
  const {
    budgetCategories, addBudgetCategory, updateBudgetCategory, deleteBudgetCategory, reorderBudgetCategories,
    budgetGroups, addBudgetGroup, updateBudgetGroup, deleteBudgetGroup,
    transactions, merchantAliases, merchantLogos, mergeMerchants, deleteMerchantAlias, setMerchantLogo, normalizeMerchants,
    resetAll: resetAllFinance,
  } = useFinanceStore()

  const [section, setSection]             = useState('aspetto')
  const [showNewCat, setShowNewCat]       = useState(false)
  const [newCatInitialType, setNewCatInitialType] = useState<NewCatType>('expense')
  const [editingCat, setEditingCat]       = useState<BudgetCategory | null>(null)
  const [collapsedCatGroups, setCollapsedCatGroups] = useState<Set<string>>(() => new Set())
  const toggleCatGroup = (key: string) => setCollapsedCatGroups((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n })
  const [resetConfirm, setResetConfirm]           = useState(false)
  const [confirmFullReset, setConfirmFullReset]   = useState(false)
  const [importOpen, setImportOpen]               = useState(false)

  // esercenti
  const [merchantSearch, setMerchantSearch]       = useState('')
  const [selectedMerchants, setSelectedMerchants] = useState<Set<string>>(() => new Set())
  const [showMergeModal, setShowMergeModal]       = useState(false)
  const [editLogoMerchant, setEditLogoMerchant]   = useState<string | null>(null)
  const dragId = useRef<string | null>(null)

  // group/category/subcategory modals
  const [groupModal,  setGroupModal]  = useState<{ group?: BudgetGroup } | null>(null)
  const [catModal,    setCatModal]    = useState<{ groupId: string; cat?: BudgetCategory } | null>(null)
  const [subcatModal, setSubcatModal] = useState<{ groupId: string; parentId: string; cat?: BudgetCategory } | null>(null)
  const [confirmDel,  setConfirmDel]  = useState<{ msg: string; onConfirm: () => void } | null>(null)

  const parentCatIds = new Set(budgetCategories.filter((c) => c.parentId).map((c) => c.parentId!))
  const expenseCats  = budgetCategories.filter((c) => c.type === 'expense' && !parentCatIds.has(c.id))
  const transferCats = budgetCategories.filter((c) => c.type === 'transfer')

  function handleImportDefaults() {
    // no-op placeholder — would merge default categories
  }

  // ── section content ─────────────────────────────────────────

  function renderSection() {
    switch (section) {

      // ── Profilo ──────────────────────────────────────────────
      case 'profilo':
        return (
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Profilo</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>
              Preferenze personali e riconoscimento movimenti
            </p>
            <SettingRow
              label="Nome intestatario conto"
              desc="Come appare nel CSV bancario (es. ROSSI MARIO). Usato per riconoscere i giroconti come trasferimenti."
            >
              <input
                className="ledgernest-input"
                placeholder="Es. ROSSI MARIO"
                value={settings.selfName ?? ''}
                onChange={(e) => updateSettings({ selfName: e.target.value.toUpperCase() })}
                style={{ width: 240, textTransform: 'uppercase' }}
              />
            </SettingRow>
            <SettingRow
              label="Ignora trasferimenti interni"
              desc="Durante l'import, esclude automaticamente i movimenti riconosciuti come giroconto (nome intestatario o tipo trasferimento). Non impattano entrate/uscite reali."
            >
              <Toggle
                checked={settings.ignoreTransfers ?? true}
                onChange={(v) => updateSettings({ ignoreTransfers: v })}
              />
            </SettingRow>
          </div>
        )

      // ── Categorie ─────────────────────────────────────────────
      case 'categorie': {
        const incomeCats  = budgetCategories.filter((c) => c.type === 'income')
        const midLevelCats = budgetCategories.filter((c) => parentCatIds.has(c.id))
        const leafCats    = budgetCategories.filter((c) => !!c.parentId)
        const directLeaves = budgetCategories.filter((c) => !c.parentId && !parentCatIds.has(c.id) && c.type !== 'income')
        const expenseGroups = budgetGroups.filter((g) => g.id !== 'income' && g.id !== 'transfers').sort((a, b) => a.order - b.order)
        const transferGroup = budgetGroups.find((g) => g.id === 'transfers')

        const actionBtn = (label: string, onClick: (e: React.MouseEvent) => void, danger = false) => (
          <button
            onClick={onClick}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', cursor: 'pointer', color: danger ? 'var(--danger)' : 'var(--text-secondary)', padding: '4px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, flexShrink: 0, transition: 'all .1s', whiteSpace: 'nowrap' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = danger ? 'color-mix(in oklch, var(--danger) 12%, transparent)' : 'color-mix(in oklch, var(--accent) 12%, transparent)'; e.currentTarget.style.color = danger ? 'var(--danger)' : 'var(--accent)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = danger ? 'var(--danger)' : 'var(--text-secondary)' }}
          >{label}</button>
        )

        const PROTECTED_CAT_IDS = new Set(['cat-azioni', 'cat-etf', 'cat-obblig', 'cat-crypto', 'cat-matprime', 'sub-merc', 'sub-alt'])

        const renderLeaf = (cat: BudgetCategory, indented = false) => {
          const isProtected = PROTECTED_CAT_IDS.has(cat.id)
          return (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: indented ? '8px 14px 8px 52px' : '8px 14px', borderBottom: '1px solid var(--border-subtle)', transition: 'background .1s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${cat.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{cat.emoji}</div>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{cat.name}</span>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
              {isProtected
                ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 10px', border: '1px solid var(--border-subtle)', borderRadius: 7 }}>Sistema</span>
                : <>
                    {actionBtn('Modifica', (e) => { e.stopPropagation(); cat.parentId ? setSubcatModal({ groupId: cat.group, parentId: cat.parentId, cat }) : setCatModal({ groupId: cat.group, cat }) })}
                    {actionBtn('✕', (e) => { e.stopPropagation(); setConfirmDel({ msg: `Eliminare "${cat.name}"?`, onConfirm: () => deleteBudgetCategory(cat.id) }) }, true)}
                  </>
              }
            </div>
          )
        }

        const renderMidCat = (cat: BudgetCategory) => {
          const subs = leafCats.filter((c) => c.parentId === cat.id)
          const isProtected = PROTECTED_CAT_IDS.has(cat.id)
          return (
            <div key={cat.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'color-mix(in oklch, var(--bg-elevated) 60%, transparent)', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${cat.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{cat.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{cat.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{subs.length} sotto-{subs.length === 1 ? 'categoria' : 'categorie'}</div>
                </div>
                {isProtected
                  ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 10px', border: '1px solid var(--border-subtle)', borderRadius: 7 }}>Sistema</span>
                  : <>
                      {actionBtn('+ Sotto-cat', (e) => { e.stopPropagation(); setSubcatModal({ groupId: cat.group, parentId: cat.id }) })}
                      {actionBtn('Modifica', (e) => { e.stopPropagation(); setCatModal({ groupId: cat.group, cat }) })}
                      {actionBtn('✕', (e) => { e.stopPropagation(); setConfirmDel({ msg: `Eliminare "${cat.name}" e le sue ${subs.length} sotto-categorie?`, onConfirm: () => deleteBudgetCategory(cat.id) }) }, true)}
                    </>
                }
              </div>
              {subs.map((s) => renderLeaf(s, true))}
            </div>
          )
        }

        return (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Categorie</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {expenseGroups.length} gruppi · {midLevelCats.length} categorie · {leafCats.length} sotto-categorie
                </p>
              </div>
              <button className="ledgernest-btn ledgernest-btn-primary" onClick={() => setGroupModal({})}>+ Nuovo gruppo</button>
            </div>

            {/* Expense groups */}
            {expenseGroups.map((group) => {
              const groupMidCats = midLevelCats.filter((c) => c.group === group.id)
              const groupDirLeaves = directLeaves.filter((c) => c.group === group.id && c.type === 'expense')
              const totalCats = groupMidCats.length + groupDirLeaves.length
              return (
                <div key={group.id} style={{ marginBottom: 24 }}>
                  {/* Group header */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '10px 14px', borderRadius: collapsedCatGroups.has(group.id) ? 14 : '14px 14px 0 0', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleCatGroup(group.id)}>
                    <span style={{ fontSize: 18 }}>{group.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{group.label}</div>
                      {group.desc && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{group.desc}</div>}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{totalCats} cat.</span>
                    {actionBtn('+ Categoria', (e) => { e.stopPropagation(); setCatModal({ groupId: group.id }) })}
                    {actionBtn('Modifica', (e) => { e.stopPropagation(); setGroupModal({ group }) })}
                    {actionBtn('✕', (e) => { e.stopPropagation(); setConfirmDel({ msg: `Eliminare il gruppo "${group.label}" e tutte le sue categorie?`, onConfirm: () => deleteBudgetGroup(group.id) }) }, true)}
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', transition: 'transform .15s', transform: collapsedCatGroups.has(group.id) ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block', marginLeft: 4 }}>▾</span>
                  </div>
                  {!collapsedCatGroups.has(group.id) && (
                    <div style={{ border: '1px solid var(--border-subtle)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>
                      {groupMidCats.map(renderMidCat)}
                      {groupDirLeaves.map((c) => renderLeaf(c, false))}
                      {totalCats === 0 && (
                        <div style={{ padding: '18px 14px', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>Nessuna categoria · usa "+ Categoria" per aggiungerne una</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Transfers group */}
            {transferGroup && (() => {
              const transferMidCats    = midLevelCats.filter((c) => c.type === 'transfer')
              const transferDirectLeaves = budgetCategories.filter((c) => c.type === 'transfer' && !c.parentId && !parentCatIds.has(c.id))
              const totalTransferCats = transferMidCats.length + transferDirectLeaves.length
              return (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '10px 14px', borderRadius: collapsedCatGroups.has('transfers') ? 14 : '14px 14px 0 0', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleCatGroup('transfers')}>
                    <span style={{ fontSize: 18 }}>{transferGroup.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{transferGroup.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Non appaiono nel budget</div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{totalTransferCats} cat.</span>
                    {actionBtn('+ Categoria', (e) => { e.stopPropagation(); setCatModal({ groupId: 'transfers' }) })}
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', transition: 'transform .15s', transform: collapsedCatGroups.has('transfers') ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block', marginLeft: 4 }}>▾</span>
                  </div>
                  {!collapsedCatGroups.has('transfers') && (
                    <div style={{ border: '1px solid var(--border-subtle)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>
                      {transferMidCats.map(renderMidCat)}
                      {transferDirectLeaves.map((c) => renderLeaf(c, false))}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Income section */}
            {(() => {
              const incomeMidCats    = midLevelCats.filter((c) => c.type === 'income')
              const incomeDirectLeaves = budgetCategories.filter((c) => c.type === 'income' && !c.parentId && !parentCatIds.has(c.id))
              const incomeGroup = budgetGroups.find((g) => g.id === 'income')
              return (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '10px 14px', borderRadius: collapsedCatGroups.has('income') ? 14 : '14px 14px 0 0', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleCatGroup('income')}>
                    <span style={{ fontSize: 18 }}>{incomeGroup?.emoji ?? '🟢'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>Entrate</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Fonti di reddito</div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{incomeMidCats.length} cat.</span>
                    {actionBtn('+ Categoria', (e) => { e.stopPropagation(); setCatModal({ groupId: 'income' }) })}
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', transition: 'transform .15s', transform: collapsedCatGroups.has('income') ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-block', marginLeft: 4 }}>▾</span>
                  </div>
                  {!collapsedCatGroups.has('income') && (
                    <div style={{ border: '1px solid var(--border-subtle)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>
                      {incomeMidCats.map(renderMidCat)}
                      {incomeDirectLeaves.map((c) => renderLeaf(c, false))}
                    </div>
                  )}
                </div>
              )
            })()}

            <div style={{ padding: '16px 18px', borderRadius: 12, background: 'color-mix(in oklch, var(--accent) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--accent) 20%, transparent)', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
              <span>Il budget mensile per ogni categoria si gestisce dalla scheda Budget. I trasferimenti non appaiono nel budget.</span>
            </div>
          </div>
        )
      }

      // ── Aspetto ───────────────────────────────────────────────
      case 'aspetto':
        return (
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Aspetto</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>Tema, colori e densità dell&apos;interfaccia</p>

            {/* Tema */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Tema</div>
              <div className="ledgernest-settings-theme-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {THEME_OPTIONS.map(([th, label, icon]) => (
                  <div
                    key={th}
                    onClick={() => updateSettings({ theme: th })}
                    style={{
                      borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                      border: `2px solid ${settings.theme === th ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      transition: 'border-color .15s',
                    }}
                  >
                    <div style={{ background: th === 'light' ? '#f0f2f5' : '#16191f', padding: '16px 14px 14px' }}>
                      <div style={{ height: 4, width: '55%', background: '#5bc8d0', borderRadius: 2, marginBottom: 10 }} />
                      <div style={{ height: 3, borderRadius: 2, background: th === 'light' ? '#d0d5dd' : 'rgba(255,255,255,.18)', marginBottom: 5, width: '80%' }} />
                      <div style={{ height: 3, borderRadius: 2, background: th === 'light' ? '#e5e7eb' : 'rgba(255,255,255,.10)', width: '60%' }} />
                    </div>
                    <div style={{ padding: '8px 14px 10px', background: 'var(--bg-surface)' }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{icon} {label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tema colori */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Tema colori</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>Accento e sidebar coordinati</div>
              <div className="ledgernest-settings-color-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                {COLOR_THEMES.map((th) => {
                  const isSelected = settings.accentColor === th.accent && (settings.sidebarColor ?? '#111418') === th.sidebar
                  const sbIsLight = parseInt(th.sidebar.slice(1,3),16)*0.299 + parseInt(th.sidebar.slice(3,5),16)*0.587 + parseInt(th.sidebar.slice(5,7),16)*0.114 > 140
                  const contentBg = sbIsLight ? '#f4f6f9' : '#181c22'
                  const textFaint  = sbIsLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)'
                  const textFainter = sbIsLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.09)'
                  const sbNavDot   = sbIsLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.28)'
                  return (
                    <button
                      key={th.id}
                      onClick={() => updateSettings({ accentColor: th.accent, sidebarColor: th.sidebar })}
                      style={{
                        borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: 'none', padding: 0,
                        outline: isSelected ? `2.5px solid ${th.accent}` : '1.5px solid var(--border-subtle)',
                        outlineOffset: isSelected ? 2 : 0,
                        transition: 'all .15s',
                        background: 'none',
                        boxShadow: isSelected ? `0 0 0 3px ${th.accent}28` : 'none',
                      }}
                    >
                      {/* App preview */}
                      <div style={{ display: 'flex', height: 68 }}>
                        {/* Sidebar */}
                        <div style={{
                          width: 28, background: th.sidebar, flexShrink: 0,
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          paddingTop: 10, gap: 6,
                        }}>
                          {/* Logo dot */}
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: th.accent, marginBottom: 4 }} />
                          {/* Nav items */}
                          {[1,0,0,0,0].map((active, i) => (
                            <div key={i} style={{
                              width: 18, height: 4, borderRadius: 2,
                              background: active ? th.accent : sbNavDot,
                            }} />
                          ))}
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, background: contentBg, padding: '9px 8px 7px', display: 'flex', flexDirection: 'column', gap: 4.5 }}>
                          <div style={{ height: 3.5, width: '50%', background: th.accent, borderRadius: 2, marginBottom: 1 }} />
                          <div style={{ height: 2.5, width: '85%', background: textFaint,  borderRadius: 2 }} />
                          <div style={{ height: 2.5, width: '70%', background: textFainter, borderRadius: 2 }} />
                          <div style={{ height: 2.5, width: '55%', background: textFainter, borderRadius: 2 }} />
                          <div style={{ display: 'flex', gap: 3, marginTop: 1 }}>
                            <div style={{ height: 8, width: '35%', background: `${th.accent}30`, borderRadius: 3 }} />
                            <div style={{ height: 8, width: '25%', background: textFainter, borderRadius: 3 }} />
                          </div>
                        </div>
                      </div>
                      {/* Label */}
                      <div style={{
                        padding: '6px 6px 7px',
                        background: isSelected ? `${th.accent}14` : 'var(--bg-elevated)',
                        fontSize: 11, fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? th.accent : 'var(--text-secondary)',
                        borderTop: `1px solid ${isSelected ? th.accent + '30' : 'var(--border-subtle)'}`,
                        textAlign: 'center', letterSpacing: '0.01em',
                        transition: 'all .15s',
                      }}>
                        {th.name}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Densità */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Densità</div>
              <TabGroup
                value={settings.density}
                onChange={(v) => updateSettings({ density: v })}
                options={[
                  { value: 'comfortable', label: 'Spaziosa' },
                  { value: 'normal',      label: 'Comoda'   },
                  { value: 'compact',     label: 'Compatta' },
                ]}
              />
            </div>

            {/* Font */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Font</div>
              <TabGroup
                value={settings.font ?? 'inter'}
                onChange={(v) => updateSettings({ font: v as 'inter' | 'monospace' | 'system' })}
                options={[
                  { value: 'inter',     label: 'Inter (default)' },
                  { value: 'monospace', label: 'Monospace'        },
                  { value: 'system',    label: 'Sistema'          },
                ]}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 24, display: 'flex', flexDirection: 'column' }}>
              <SettingRow label="Animazioni" desc="Transizioni e micro-interazioni">
                <Toggle checked={settings.animations ?? true} onChange={(v) => updateSettings({ animations: v })} />
              </SettingRow>
              <SettingRow label="Mostra valori in numeri grandi" desc="Aumenta la dimensione tipografica dei totali">
                <Toggle checked={settings.showLargeNumbers ?? false} onChange={(v) => updateSettings({ showLargeNumbers: v })} />
              </SettingRow>
              <SettingRow label="Nascondi importi sensibili" desc="Mostra ●●●● al posto dei numeri quando inattivo">
                <Toggle checked={settings.hideSensitiveAmounts ?? false} onChange={(v) => updateSettings({ hideSensitiveAmounts: v })} />
              </SettingRow>
            </div>
          </div>
        )

      // ── Conti e broker ────────────────────────────────────────
      case 'conti':
        return (
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Conti e broker</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>Valuta, aggiornamenti prezzi e connessioni</p>
            <SettingRow label={t('currency')} desc="Valuta principale visualizzata">
              <select
                className="ledgernest-input ledgernest-select"
                value={settings.currency}
                onChange={(e) => updateSettings({ currency: e.target.value as Currency })}
                style={{ width: 130 }}
              >
                <option value="EUR">€ EUR</option>
                <option value="USD">$ USD</option>
              </select>
            </SettingRow>
            <SettingRow label={t('language')} desc="Lingua dell'interfaccia">
              <select
                className="ledgernest-input ledgernest-select"
                value={settings.locale}
                onChange={(e) => updateSettings({ locale: e.target.value as Locale })}
                style={{ width: 150 }}
              >
                <option value="it">🇮🇹 Italiano</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </SettingRow>
            <SettingRow label={t('refreshInterval')} desc="Con quale frequenza aggiornare i prezzi">
              <select
                className="ledgernest-input ledgernest-select"
                value={settings.refreshInterval}
                onChange={(e) => updateSettings({ refreshInterval: parseInt(e.target.value) })}
                style={{ width: 150 }}
              >
                <option value={0}>Manuale</option>
                <option value={30}>30 secondi</option>
                <option value={60}>1 minuto</option>
                <option value={300}>5 minuti</option>
                <option value={600}>10 minuti</option>
              </select>
            </SettingRow>
            <SettingRow label={t('showPrePostMarket')} desc="Prezzi pre-market e post-market">
              <Toggle checked={settings.showPrePostMarket} onChange={(v) => updateSettings({ showPrePostMarket: v })} />
            </SettingRow>
            <SettingRow label="Mostra valore portfolio" desc="Visibile nella panoramica principale">
              <Toggle checked={settings.showPortfolioValue} onChange={(v) => updateSettings({ showPortfolioValue: v })} />
            </SettingRow>
          </div>
        )

      // ── Esercenti ─────────────────────────────────────────────
      case 'esercenti': {
        const merchantCounts   = new Map<string, number>()
        const merchantLastDate = new Map<string, string>()
        for (const t of transactions) {
          if (t.merchant?.trim()) {
            merchantCounts.set(t.merchant, (merchantCounts.get(t.merchant) ?? 0) + 1)
            const prev = merchantLastDate.get(t.merchant)
            if (!prev || t.date > prev) merchantLastDate.set(t.merchant, t.date)
          }
        }
        const allMerchants = Array.from(merchantCounts.entries())
          .sort((a, b) => b[1] - a[1])
        const filteredMerchants = merchantSearch.trim()
          ? allMerchants.filter(([m]) => m.toLowerCase().includes(merchantSearch.toLowerCase()))
          : allMerchants

        const aliasEntries = Object.entries(merchantAliases).sort((a, b) => a[0].localeCompare(b[0]))

        const toggleMerchant = (name: string) =>
          setSelectedMerchants((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })

        const allFiltered = filteredMerchants.map(([n]) => n)
        const allSelected = allFiltered.length > 0 && allFiltered.every((n) => selectedMerchants.has(n))
        const toggleAll = () => setSelectedMerchants(
          allSelected ? new Set() : new Set(allFiltered)
        )

        const fmtDate = (d: string) => {
          const [y, m, day] = d.split('-')
          return `${day}/${m}/${y}`
        }

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Esercenti</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {allMerchants.length} esercenti · unisci varianti dello stesso nome per normalizzare i dati
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="ledgernest-btn ledgernest-btn-ghost"
                  title="Normalizza i nomi degli esercenti: rimuove codici, suffissi legali, uniforma brand noti"
                  onClick={() => normalizeMerchants(normalizeMerchantName)}
                >
                  Normalizza nomi
                </button>
                <button
                  className="ledgernest-btn ledgernest-btn-ghost"
                  title="Carica automaticamente il favicon per i brand riconosciuti senza logo"
                  onClick={() => {
                    const uniqueMerchants = transactions
                      .map((t) => t.merchant)
                      .filter((m): m is string => !!m)
                      .filter((m, i, a) => a.indexOf(m) === i)
                    let count = 0
                    for (const m of uniqueMerchants) {
                      if (!merchantLogos[m] && BRAND_FAVICON_DOMAINS[m]) {
                        setMerchantLogo(m, `https://www.google.com/s2/favicons?sz=128&domain=${BRAND_FAVICON_DOMAINS[m]}`)
                        count++
                      }
                    }
                    if (count === 0) alert('Nessun logo da caricare (tutti già impostati o brand non riconosciuti)')
                  }}
                >
                  Auto-carica loghi
                </button>
                {selectedMerchants.size >= 2 && (
                  <button className="ledgernest-btn ledgernest-btn-primary" onClick={() => setShowMergeModal(true)}>
                    Unisci {selectedMerchants.size}
                  </button>
                )}
                {selectedMerchants.size > 0 && (
                  <button className="ledgernest-btn ledgernest-btn-ghost" onClick={() => setSelectedMerchants(new Set())}>
                    Deseleziona
                  </button>
                )}
              </div>
            </div>

            {/* Search */}
            <input
              className="ledgernest-input"
              placeholder="Cerca esercente..."
              value={merchantSearch}
              onChange={(e) => setMerchantSearch(e.target.value)}
              style={{ width: '100%', marginBottom: 14 }}
            />

            {/* Table */}
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '36px 52px 1fr 90px 90px 60px', alignItems: 'center', padding: '8px 14px 8px 12px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
                />
                <div />
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>NOME</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textAlign: 'center' }}>MOVIMENTI</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textAlign: 'right' }}>ULTIMA DATA</div>
                <div />
              </div>

              {filteredMerchants.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                  {allMerchants.length === 0 ? 'Nessun esercente trovato nei movimenti' : 'Nessun risultato'}
                </div>
              ) : filteredMerchants.map(([name, count], i) => {
                const checked  = selectedMerchants.has(name)
                const isAlias  = name.toLowerCase() in merchantAliases
                const logo     = merchantLogos[name]
                const lastDate = merchantLastDate.get(name) ?? ''
                return (
                  <div
                    key={name}
                    style={{
                      display: 'grid', gridTemplateColumns: '36px 52px 1fr 90px 90px 60px',
                      alignItems: 'center', padding: '10px 14px 10px 12px',
                      borderBottom: i < filteredMerchants.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      background: checked ? 'color-mix(in oklch, var(--accent) 7%, transparent)' : undefined,
                      transition: 'background .1s', cursor: 'default',
                    }}
                    onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = 'var(--bg-elevated)' }}
                    onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = '' }}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMerchant(name)}
                      style={{ accentColor: 'var(--accent)', width: 15, height: 15, cursor: 'pointer' }}
                    />

                    {/* Avatar (click to edit logo) */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button
                        onClick={() => setEditLogoMerchant(name)}
                        title="Cambia logo"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: 11, position: 'relative' }}
                      >
                        <MerchantAvatar name={name} logo={logo} size={38} />
                        <div style={{
                          position: 'absolute', inset: 0, borderRadius: 11,
                          background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, color: '#fff', fontWeight: 700, opacity: 0, transition: 'all .15s',
                        }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(0,0,0,0.45)'
                            e.currentTarget.style.opacity = '1'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(0,0,0,0)'
                            e.currentTarget.style.opacity = '0'
                          }}
                        >✎</div>
                      </button>
                    </div>

                    {/* Name + tags */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      {isAlias && (
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>alias</span>
                      )}
                    </div>

                    {/* Count */}
                    <div style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', minWidth: 36, padding: '3px 8px',
                        borderRadius: 20, background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
                      }}>{count}</span>
                    </div>

                    {/* Last date */}
                    <div style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                      {lastDate ? fmtDate(lastDate) : '—'}
                    </div>

                    {/* Edit logo shortcut */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button
                        onClick={() => setEditLogoMerchant(name)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px 6px', borderRadius: 6, fontSize: 13, transition: 'color .1s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                        title="Modifica logo"
                      >✎</button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Merge rules */}
            {aliasEntries.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Regole di merge</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Applicate automaticamente ai prossimi import CSV
                </div>
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
                  {aliasEntries.map(([alias, canonical], i) => (
                    <div key={alias} style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr 32px', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: i < aliasEntries.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alias}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>→</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <MerchantAvatar name={canonical} logo={merchantLogos[canonical]} size={22} />
                        <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{canonical}</span>
                      </div>
                      <button
                        onClick={() => deleteMerchantAlias(alias)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16, lineHeight: 1, padding: '0 4px', textAlign: 'center' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                        title="Rimuovi regola"
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showMergeModal && (
              <MergeModal
                merchants={Array.from(selectedMerchants)}
                counts={merchantCounts}
                onClose={() => setShowMergeModal(false)}
                onMerge={(aliases, canonical) => {
                  mergeMerchants(aliases, canonical)
                  setSelectedMerchants(new Set())
                  setShowMergeModal(false)
                }}
              />
            )}

            {editLogoMerchant && (
              <MerchantLogoModal
                merchant={editLogoMerchant}
                current={merchantLogos[editLogoMerchant]}
                onClose={() => setEditLogoMerchant(null)}
                onSave={(logo) => setMerchantLogo(editLogoMerchant, logo)}
              />
            )}
          </div>
        )
      }

      // ── Notifiche ─────────────────────────────────────────────
      case 'notifiche':
        return (
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Notifiche</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>Avvisi e promemoria</p>
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Presto disponibile</div>
          </div>
        )

      // ── Privacy ───────────────────────────────────────────────
      case 'privacy':
        return (
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Privacy e sicurezza</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>Gestisci i tuoi dati e la tua privacy</p>
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Presto disponibile</div>
          </div>
        )

      // ── Piano ─────────────────────────────────────────────────
      case 'piano':
        return (
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Piano · Pro</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>Gestisci il tuo abbonamento</p>
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Presto disponibile</div>
          </div>
        )

      // ── Dati ed export ────────────────────────────────────────
      case 'dati':
        return (
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Dati ed export</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>Esporta, importa o resetta i tuoi dati</p>

            <SettingRow label="Importa CSV" desc="Trade Republic · Credit Agricole">
              <button className="ledgernest-btn ledgernest-btn-ghost" onClick={() => setImportOpen(true)}>
                ↑ Importa
              </button>
            </SettingRow>

            <SettingRow label={t('exportData')} desc="Scarica un backup completo in formato JSON">
              <button
                className="ledgernest-btn ledgernest-btn-ghost"
                onClick={() => {
                  const blob = new Blob([JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url
                  a.download = `ledgernest-backup-${new Date().toISOString().slice(0, 10)}.json`
                  a.click(); URL.revokeObjectURL(url)
                }}
              >
                ↓ {t('exportJson')}
              </button>
            </SettingRow>

            <SettingRow
              label="Reset Portfolio"
              desc="Elimina tutte le posizioni, trade e dividendi — azione irreversibile"
            >
              {resetConfirm ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" onClick={() => setResetConfirm(false)}>Annulla</button>
                  <button className="ledgernest-btn ledgernest-btn-danger ledgernest-btn-sm" onClick={() => { resetPortfolio(); setResetConfirm(false) }}>Conferma</button>
                </div>
              ) : (
                <button className="ledgernest-btn ledgernest-btn-danger ledgernest-btn-sm" onClick={() => setResetConfirm(true)}>Reset Portfolio</button>
              )}
            </SettingRow>

            <SettingRow
              label="Reset completo"
              desc="Elimina tutti i dati finanziari e del portafoglio — azione irreversibile"
            >
              {confirmFullReset ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="ledgernest-btn ledgernest-btn-ghost ledgernest-btn-sm" onClick={() => setConfirmFullReset(false)}>Annulla</button>
                  <button className="ledgernest-btn ledgernest-btn-danger ledgernest-btn-sm" onClick={() => { resetAllFinance(); resetPortfolio(); setConfirmFullReset(false) }}>Conferma reset</button>
                </div>
              ) : (
                <button className="ledgernest-btn ledgernest-btn-danger ledgernest-btn-sm" onClick={() => setConfirmFullReset(true)}>Reset completo</button>
              )}
            </SettingRow>
          </div>
        )

      default: return null
    }
  }

  return (
    <>
      <div className="ledgernest-settings-layout" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <div className="ledgernest-card" style={{ padding: '8px 0', position: 'sticky', top: 0 }}>
          {SIDEBAR_ITEMS.map((item) => {
            const active = section === item.id
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                  background: active ? 'color-mix(in oklch, var(--accent) 14%, transparent)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  border: 'none', cursor: 'pointer', borderRadius: 0, fontSize: 13, fontWeight: active ? 700 : 500,
                  textAlign: 'left', transition: 'all .12s',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-elevated)' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)', display: 'flex', flexShrink: 0 }}>
                  <Icon name={item.icon} size={16} />
                </span>
                {item.label}
              </button>
            )
          })}
        </div>

        {/* ── Content ───────────────────────────────────────── */}
        <div className="ledgernest-card" style={{ padding: '28px 32px', minHeight: 500 }}>
          {renderSection()}
        </div>
      </div>

      {/* Edit category modal */}
      {editingCat && (
        <EditCategoriaModal
          cat={editingCat}
          onClose={() => setEditingCat(null)}
          onSave={(id, patch) => updateBudgetCategory(id, patch)}
          onDelete={(id) => deleteBudgetCategory(id)}
        />
      )}

      {/* New category modal */}
      {showNewCat && (
        <NuovaCategoriaModal
          initialType={newCatInitialType}
          onClose={() => setShowNewCat(false)}
          onSave={(name, catType, group, emoji, color) => {
            if (catType === 'income') {
              addBudgetCategory({ name, emoji, color, monthlyBudget: 0, group: 'income', type: 'income' })
            } else if (group === 'transfers') {
              addBudgetCategory({ name, emoji, color, monthlyBudget: 0, group: 'transfers', type: 'transfer' })
            } else {
              addBudgetCategory({ name, emoji, color, monthlyBudget: 0, group, type: 'expense' })
            }
          }}
        />
      )}

      {/* Group modal (add / edit) */}
      {groupModal !== null && (
        <ItemModal
          title={groupModal.group ? 'Modifica gruppo' : 'Nuovo gruppo'}
          subtitle={groupModal.group ? groupModal.group.label : 'Crea un nuovo gruppo di categorie'}
          initialName={groupModal.group?.label ?? ''}
          initialEmoji={groupModal.group?.emoji ?? '📂'}
          initialColor={groupModal.group?.color ?? '#5bc8d0'}
          onClose={() => setGroupModal(null)}
          onSave={(name, emoji, color) => {
            if (groupModal.group) {
              updateBudgetGroup(groupModal.group.id, { label: name, emoji, color })
            } else {
              addBudgetGroup({ label: name, emoji, color })
            }
          }}
        />
      )}

      {/* Category modal (mid-level, add / edit) */}
      {catModal !== null && (
        <ItemModal
          title={catModal.cat ? 'Modifica categoria' : 'Nuova categoria'}
          subtitle={catModal.cat ? catModal.cat.name : `Categoria nel gruppo ${budgetGroups.find((g) => g.id === catModal.groupId)?.label ?? ''}`}
          initialName={catModal.cat?.name ?? ''}
          initialEmoji={catModal.cat?.emoji ?? '📁'}
          initialColor={catModal.cat?.color ?? '#5bc8d0'}
          onClose={() => setCatModal(null)}
          onSave={(name, emoji, color) => {
            if (catModal.cat) {
              updateBudgetCategory(catModal.cat.id, { name, emoji, color })
            } else {
              const catType = catModal.groupId === 'income' ? 'income' : catModal.groupId === 'transfers' ? 'transfer' : 'expense'
              addBudgetCategory({ name, emoji, color, monthlyBudget: 0, group: catModal.groupId, type: catType })
            }
          }}
        />
      )}

      {/* Subcategory modal (leaf, add / edit) */}
      {subcatModal !== null && (
        <ItemModal
          title={subcatModal.cat ? 'Modifica sotto-categoria' : 'Nuova sotto-categoria'}
          subtitle={subcatModal.cat ? subcatModal.cat.name : `Sotto ${budgetCategories.find((c) => c.id === subcatModal.parentId)?.name ?? ''}`}
          initialName={subcatModal.cat?.name ?? ''}
          initialEmoji={subcatModal.cat?.emoji ?? '📋'}
          initialColor={subcatModal.cat?.color ?? '#5bc8d0'}
          onClose={() => setSubcatModal(null)}
          onSave={(name, emoji, color) => {
            if (subcatModal.cat) {
              updateBudgetCategory(subcatModal.cat.id, { name, emoji, color })
            } else {
              const parentType = budgetCategories.find((c) => c.id === subcatModal.parentId)?.type ?? 'expense'
              addBudgetCategory({ name, emoji, color, monthlyBudget: 0, group: subcatModal.groupId, type: parentType, parentId: subcatModal.parentId })
            }
          }}
        />
      )}

      {/* Confirm delete modal */}
      {confirmDel !== null && (
        <ConfirmDeleteModal
          msg={confirmDel.msg}
          onClose={() => setConfirmDel(null)}
          onConfirm={confirmDel.onConfirm}
        />
      )}

      {importOpen && <CSVImportWizard onClose={() => setImportOpen(false)} />}
    </>
  )
}
