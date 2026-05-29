'use client'

import { useState } from 'react'

const EMOJI_CATS = [
  { icon: '🏠', label: 'Casa',       emojis: ['🏠','🏡','🏘️','🏗️','🏢','🏬','🏦','🛏️','🛋️','🪑','🚿','🛁','🪴','🧹','🧺','💡','🔌','🔒','🗑️','📦','🧰','🔧','🔨','⚙️','🪤','🫙','🧯','🪣','🧲','🪜','🏊','🛖'] },
  { icon: '🍕', label: 'Cibo',       emojis: ['🍕','🍔','🍟','🌮','🌯','🥗','🥘','🍲','🍜','🍝','🍣','🥩','🍗','🥚','🍳','🥐','🧁','🎂','🍰','🍩','🍪','🍫','🍭','🥤','☕','🧃','🍷','🍸','🥂','🍻','🧋','🫖'] },
  { icon: '🚗', label: 'Trasporti',  emojis: ['🚗','🚕','🚙','🏎️','🚌','🚎','🚑','🚒','✈️','🛳️','⛵','🚂','🚇','🏍️','🛵','🚲','🛴','🚁','⛽','🅿️','🚦','🛣️','🗺️','🧭','🏔️','🌊','🌍','🗼','🌐','🛫','🛬','🛟'] },
  { icon: '🎭', label: 'Svago',      emojis: ['🎭','🎬','🎮','🕹️','🎲','♟️','🎯','🎳','🎻','🎸','🎹','🥁','🎤','🎧','📺','📷','📚','📖','🖊️','🖼️','🎨','🧩','🏆','🥇','🎁','🎉','🎊','🎈','🎟️','🎪','🎠','🎡'] },
  { icon: '💰', label: 'Finanza',    emojis: ['💰','💵','💴','💶','💷','💸','💳','🏧','💹','📈','📉','📊','🏦','🧾','💼','📋','🔐','🔑','📌','📎','🗂️','📁','📂','🗃️','🗄️','📑','📃','📜','💡','🏅','🥈','🥉'] },
  { icon: '❤️', label: 'Salute',     emojis: ['❤️','🧡','💛','💚','💙','💜','🤍','🖤','💗','💓','💞','💕','💝','❤️‍🔥','🏥','💊','💉','🩺','🩹','🩻','🦷','🦴','👁️','👂','🫀','🫁','🧠','🦵','🦾','🧘','🏃','🤸'] },
  { icon: '🛍️', label: 'Shopping',   emojis: ['🛍️','👗','👔','👠','👟','🧢','🎒','👜','💄','💍','💎','🪮','🧴','🧼','🪥','🛒','📦','🏷️','🧶','🪡','🧵','👒','🎩','🥿','🧤','🧣','🧥','👘','🩱','🩲','🩳','🩴'] },
  { icon: '🌱', label: 'Natura',     emojis: ['🌱','🌿','🍀','🍃','🌲','🌳','🌴','🌵','🎋','🎍','🌾','🌺','🌸','🌼','🌻','🌹','🌷','🍁','🍂','🍄','🪸','🌊','⛰️','🌋','🏕️','🌅','🌄','🌈','⚡','❄️','🔥','💧'] },
]

const ALL_EMOJIS_FLAT = EMOJI_CATS.flatMap(c => c.emojis)

interface EmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
}

export default function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [catIdx, setCatIdx] = useState(0)
  const [query, setQuery] = useState('')

  const isSearching = query.trim().length > 0
  const searchResults = isSearching
    ? ALL_EMOJIS_FLAT.filter(e => e.startsWith(query.trim()))
    : EMOJI_CATS[catIdx].emojis

  const customEmoji = isSearching && /\p{Emoji}/u.test(query.trim()) && !searchResults.includes(query.trim())
    ? query.trim()
    : null

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Search / manual input */}
      <div style={{ padding: '8px 8px 0', background: 'var(--bg-elevated)' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca o incolla un'emoji…"
          style={{
            width: '100%', padding: '6px 10px', borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13,
            boxSizing: 'border-box', outline: 'none',
          }}
        />
      </div>

      {/* Category tabs — hidden while searching */}
      {!isSearching && (
        <div style={{ display: 'flex', overflowX: 'auto', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', padding: '6px 8px', gap: 4 }}>
          {EMOJI_CATS.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCatIdx(i)}
              title={c.label}
              style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0, cursor: 'pointer', fontSize: 16,
                border: 'none', background: catIdx === i ? 'var(--bg-surface)' : 'transparent',
                outline: catIdx === i ? `2px solid var(--accent)` : 'none',
                outlineOffset: -2, transition: 'background .1s',
              }}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2, padding: 8, maxHeight: 200, overflowY: 'auto', background: 'var(--bg-surface)' }}>
        {customEmoji && (
          <button
            type="button"
            onClick={() => { onChange(customEmoji); setQuery('') }}
            title="Usa questa emoji"
            style={{
              width: '100%', aspectRatio: '1', fontSize: 20, borderRadius: 6, cursor: 'pointer',
              border: '2px dashed var(--accent)',
              background: 'color-mix(in oklch, var(--accent) 15%, transparent)',
            }}
          >
            {customEmoji}
          </button>
        )}
        {searchResults.length > 0
          ? searchResults.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { onChange(e); setQuery('') }}
                style={{
                  width: '100%', aspectRatio: '1', fontSize: 20, borderRadius: 6, cursor: 'pointer', border: 'none',
                  background: value === e ? 'color-mix(in oklch, var(--accent) 20%, transparent)' : 'transparent',
                  outline: value === e ? `2px solid var(--accent)` : 'none',
                  transition: 'background .1s',
                }}
              >
                {e}
              </button>
            ))
          : isSearching && !customEmoji && (
              <div style={{ gridColumn: '1 / -1', padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
                Nessun risultato — incolla un'emoji nel campo
              </div>
            )
        }
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-tertiary)' }}>
        <span>Selezionato: <span style={{ fontSize: 16 }}>{value}</span></span>
        <span>{isSearching ? `${searchResults.length + (customEmoji ? 1 : 0)} risultati` : `${EMOJI_CATS[catIdx].emojis.length} emoji`}</span>
      </div>
    </div>
  )
}
