'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useFinanceStore } from '@/stores/financeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Account, Theme, Currency } from '@/types'

// ── types ─────────────────────────────────────────────────────

const ACCOUNT_TYPES: { value: Account['type']; label: string; sub: string; emoji: string; color: string; icon: string }[] = [
  { value: 'bank',   label: 'Conto bancario', sub: 'Corrente o deposito',     emoji: '🏦', color: '#58a6ff', icon: 'conti'   },
  { value: 'broker', label: 'Brokerage',       sub: 'IBKR, Degiro, Fineco…',   emoji: '📊', color: '#5bc8d0', icon: 'azioni'  },
  { value: 'crypto', label: 'Crypto wallet',   sub: 'Exchange o self-custody', emoji: '🔐', color: '#f77c3a', icon: 'crypto'  },
  { value: 'other',  label: 'Altro',           sub: 'Fondo, mutuo, altro',     emoji: '💼', color: '#7c6df7', icon: 'wallet'  },
]

// ── shared ────────────────────────────────────────────────────

function NavBtn({ onClick, children, primary, disabled }: { onClick: () => void; children: React.ReactNode; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '11px 28px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        border: primary ? 'none' : '1.5px solid var(--border-subtle)',
        background: primary ? 'var(--accent)' : 'transparent',
        color: primary ? 'var(--text-on-accent, #fff)' : 'var(--text-secondary)',
        opacity: disabled ? 0.45 : 1,
        transition: 'all .15s',
      }}
    >
      {children}
    </button>
  )
}

// ── Step 1: Tema ──────────────────────────────────────────────

function StepTheme({ current, onSelect, onNext }: {
  current: Theme
  onSelect: (t: Theme) => void
  onNext: () => void
}) {
  const THEMES: { value: Theme; label: string; icon: string; desc: string }[] = [
    { value: 'dark',   label: 'Scuro',   icon: '🌙', desc: 'Ideale di notte' },
    { value: 'light',  label: 'Chiaro',  icon: '☀️', desc: 'Alta leggibilità' },
    { value: 'system', label: 'Sistema', icon: '🖥️', desc: 'Segue il SO'      },
  ]

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.5px' }}>
          👋 Benvenuto in LedgerNest
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Il tuo hub finanziario personale. Prima di tutto, scegli come preferisci vedere l&apos;app.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        {THEMES.map((th) => (
          <button
            key={th.value}
            onClick={() => onSelect(th.value)}
            style={{
              borderRadius: 14, overflow: 'hidden', cursor: 'pointer', textAlign: 'left',
              border: `2px solid ${current === th.value ? 'var(--accent)' : 'var(--border-subtle)'}`,
              background: 'transparent', transition: 'border-color .15s',
            }}
          >
            {/* Preview pane */}
            <div style={{ background: th.value === 'light' ? '#f0f2f5' : '#16191f', padding: '14px 12px 12px' }}>
              <div style={{ height: 4, width: '55%', background: '#5bc8d0', borderRadius: 2, marginBottom: 9 }} />
              <div style={{ height: 3, borderRadius: 2, background: th.value === 'light' ? '#d0d5dd' : 'rgba(255,255,255,.18)', marginBottom: 4, width: '80%' }} />
              <div style={{ height: 3, borderRadius: 2, background: th.value === 'light' ? '#e5e7eb' : 'rgba(255,255,255,.10)', width: '60%' }} />
            </div>
            {/* Label */}
            <div style={{ padding: '9px 12px', background: 'var(--bg-surface)' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{th.icon} {th.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{th.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <NavBtn primary onClick={onNext}>Continua →</NavBtn>
      </div>
    </div>
  )
}

// ── Step 2: Nome utente ───────────────────────────────────────

function StepSelfName({ current, suggested, onChange, onBack, onNext }: {
  current: string
  suggested: string
  onChange: (v: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const [value, setValue] = useState(current || suggested)

  function handleChange(raw: string) {
    setValue(raw)
    onChange(raw)
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.4px' }}>
          Come sei intestatario del conto?
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Scrivi il tuo nome come appare nei CSV bancari (di solito Cognome Nome).
          Serve a riconoscere automaticamente i giroconti tra i tuoi conti.
        </div>
      </div>

      <input
        className="ledgernest-input"
        placeholder="Es. Rossi Mario"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        autoFocus
        style={{ height: 46, width: '100%', boxSizing: 'border-box', fontSize: 16, marginBottom: 8 }}
      />
      {suggested && !current && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
          Pre-compilato dal tuo account Google — verifica che cognome e nome siano nell&apos;ordine corretto.
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 32 }}>
        Opzionale — puoi modificarlo in seguito da Impostazioni → Profilo
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <NavBtn onClick={onBack}>← Indietro</NavBtn>
        <NavBtn primary onClick={() => { onChange(value); onNext() }}>Continua →</NavBtn>
      </div>
    </div>
  )
}

// ── Step 3: Valuta ─────────────────────────────────────────────

function StepCurrency({ current, onSelect, onBack, onNext }: {
  current: Currency
  onSelect: (c: Currency) => void
  onBack: () => void
  onNext: () => void
}) {
  const OPTIONS: { value: Currency; flag: string; name: string; symbol: string; desc: string }[] = [
    { value: 'EUR', flag: '🇪🇺', name: 'Euro',      symbol: '€', desc: 'Valuta predefinita per l\'Europa' },
    { value: 'USD', flag: '🇺🇸', name: 'US Dollar', symbol: '$', desc: 'Dollaro statunitense'              },
  ]

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.4px' }}>
          Qual è la tua valuta principale?
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Verrà usata per mostrare saldi, budget e patrimonio netto.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 32 }}>
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            style={{
              padding: '20px 18px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
              border: `2px solid ${current === o.value ? 'var(--accent)' : 'var(--border-subtle)'}`,
              background: current === o.value ? 'color-mix(in oklch, var(--accent) 10%, transparent)' : 'var(--bg-elevated)',
              transition: 'all .15s',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>{o.flag}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: current === o.value ? 'var(--accent)' : 'var(--text-primary)' }}>{o.symbol}</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{o.name}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{o.desc}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <NavBtn onClick={onBack}>← Indietro</NavBtn>
        <NavBtn primary onClick={onNext}>Continua →</NavBtn>
      </div>
    </div>
  )
}

const OB_BANKS = [
  { name: 'Credit Agricole Cariparma', country: 'IT', emoji: '🌾' },
  { name: 'UniCredit',                 country: 'IT', emoji: '🔴' },
  { name: 'Banca Mediolanum',          country: 'IT', emoji: '🔵' },
  { name: 'Banco BPM',                 country: 'IT', emoji: '🏦' },
  { name: 'N26',                       country: 'IT', emoji: '⬛' },
  { name: 'Revolut',                   country: 'IT', emoji: '🌐' },
]

// ── Step 4: Primo conto ───────────────────────────────────────

function StepAccount({ onBack, onFinish }: {
  onBack: () => void
  onFinish: (acct: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => void
}) {
  const [type,        setType]        = useState<Account['type']>('bank')
  const [mode,        setMode]        = useState<'manual' | 'ob'>('manual')
  const [name,        setName]        = useState('')
  const [institution, setInstitution] = useState('')
  const [balance,     setBalance]     = useState('')
  const [currency,    setCurrency]    = useState<'EUR' | 'USD'>('EUR')
  const [obBank,      setObBank]      = useState(OB_BANKS[0])
  const [connecting,  setConnecting]  = useState(false)
  const [obError,     setObError]     = useState<string | null>(null)

  const selected = ACCOUNT_TYPES.find((t) => t.value === type)!
  const canSubmit = name.trim() && balance !== ''

  function submit() {
    if (!canSubmit) return
    onFinish({
      name: name.trim(),
      type,
      icon: selected.icon,
      balance: parseFloat(balance) || 0,
      currency,
      broker: institution.trim() || undefined,
    })
  }

  async function handleOBConnect() {
    setConnecting(true)
    setObError(null)
    try {
      const res = await fetch('/api/banking/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankName: obBank.name, country: obBank.country }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else { setObError(data.error ?? 'Errore'); setConnecting(false) }
    } catch {
      setObError('Errore di rete')
      setConnecting(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.4px' }}>
          Aggiungi il tuo primo conto
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Collega un conto bancario, un broker o un wallet per iniziare a tracciare il tuo patrimonio.
        </div>
      </div>

      {/* Type */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {ACCOUNT_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => { setType(t.value); if (t.value !== 'bank') setMode('manual') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12,
              border: `1.5px solid ${type === t.value ? t.color : 'var(--border-subtle)'}`,
              background: type === t.value ? `color-mix(in oklch, ${t.color} 12%, transparent)` : 'var(--bg-elevated)',
              textAlign: 'left', cursor: 'pointer', transition: 'all .15s',
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>{t.emoji}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: type === t.value ? t.color : 'var(--text-primary)' }}>{t.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{t.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Mode switcher — bank only */}
      {type === 'bank' && (
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 10, padding: 3, marginBottom: 16 }}>
          {(['manual', 'ob'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer', transition: 'all .15s',
              background: mode === m ? 'var(--bg-surface)' : 'transparent',
              color: mode === m ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,.2)' : 'none',
            }}>
              {m === 'manual' ? '✏️ Manuale' : '🏦 Open Banking'}
            </button>
          ))}
        </div>
      )}

      {/* Open Banking */}
      {type === 'bank' && mode === 'ob' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Verrai reindirizzato alla pagina della tua banca per autorizzare l&apos;accesso in sola lettura. Al ritorno il conto verrà creato automaticamente.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {OB_BANKS.map((b) => {
              const active = b.name === obBank.name && b.country === obBank.country
              return (
                <button key={b.name} onClick={() => setObBank(b)} style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  background: active ? 'color-mix(in oklch, var(--accent) 15%, transparent)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}>
                  {b.emoji} {b.name}
                </button>
              )
            })}
          </div>
          {obError && (
            <div style={{ fontSize: 12, color: 'var(--danger)' }}>{obError}</div>
          )}
        </div>
      ) : (
        <>
          {/* Nome */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
              Nome <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              className="ledgernest-input"
              placeholder={type === 'bank' ? 'Conto corrente N26' : type === 'broker' ? 'IBKR · Broker' : type === 'crypto' ? 'Wallet · Ledger' : 'Nome conto'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              style={{ height: 42, width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
              {type === 'bank' ? 'Banca' : type === 'broker' ? 'Broker' : type === 'crypto' ? 'Exchange / Wallet' : 'Istituzione'}{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(opzionale)</span>
            </label>
            <input
              className="ledgernest-input"
              placeholder={type === 'bank' ? 'N26, Fineco, Intesa…' : type === 'broker' ? 'IBKR, Degiro…' : type === 'crypto' ? 'Coinbase, Ledger…' : ''}
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              style={{ height: 42, width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 28 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                Saldo attuale <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                className="ledgernest-input ledgernest-mono"
                type="number" step="0.01" placeholder="0,00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                style={{ height: 42, width: '100%', boxSizing: 'border-box', fontSize: 15 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Valuta</label>
              <select className="ledgernest-input" value={currency} onChange={(e) => setCurrency(e.target.value as 'EUR' | 'USD')} style={{ height: 42, minWidth: 90 }}>
                <option value="EUR">€ EUR</option>
                <option value="USD">$ USD</option>
              </select>
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <NavBtn onClick={onBack}>← Indietro</NavBtn>
        {type === 'bank' && mode === 'ob' ? (
          <NavBtn primary disabled={connecting} onClick={handleOBConnect}>
            {connecting ? 'Reindirizzamento…' : `Connetti ${obBank.name} →`}
          </NavBtn>
        ) : (
          <NavBtn primary disabled={!canSubmit} onClick={submit}>
            Inizia ✓
          </NavBtn>
        )}
      </div>
    </div>
  )
}

// ── wizard ────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const { addAccount } = useFinanceStore()
  const { settings, updateSettings } = useSettingsStore()
  const { data: session } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const TOTAL = 4

  // Derive selfName suggestion from Google: "Gabriele Mandalari" → "Mandalari Gabriele"
  const suggestedSelfName = session?.user?.name
    ? session.user.name.trim().split(/\s+/).reverse().join(' ')
    : ''

  function finish(acct: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) {
    addAccount(acct)
    router.push('/dashboard')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'var(--bg-app, #0d0f12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      {/* Background decoration */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '30%', width: 600, height: 600, borderRadius: '50%', background: 'color-mix(in oklch, var(--accent) 6%, transparent)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '20%', width: 400, height: 400, borderRadius: '50%', background: 'color-mix(in oklch, #7c6df7 5%, transparent)', filter: 'blur(80px)' }} />
      </div>

      {/* Card */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 520,
        background: 'var(--bg-surface)', borderRadius: 24,
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 40px 120px rgba(0,0,0,.55)',
        overflow: 'hidden',
      }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px 0',
        }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--accent)' }}>LEDGERNEST</span>
          <div style={{ display: 'flex', gap: 5 }}>
            {Array.from({ length: TOTAL }, (_, i) => (
              <div key={i} style={{
                height: 6, borderRadius: 3,
                width: i + 1 === step ? 22 : 6,
                background: i + 1 <= step ? 'var(--accent)' : 'var(--bg-elevated)',
                transition: 'all .3s',
              }} />
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{step} / {TOTAL}</span>
        </div>

        {/* Step content */}
        <div style={{ padding: '24px 28px 28px' }}>
          {step === 1 && (
            <StepTheme
              current={settings.theme}
              onSelect={(t) => updateSettings({ theme: t })}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepSelfName
              current={settings.selfName ?? ''}
              suggested={suggestedSelfName}
              onChange={(v) => updateSettings({ selfName: v })}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <StepCurrency
              current={settings.currency}
              onSelect={(c) => updateSettings({ currency: c })}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <StepAccount
              onBack={() => setStep(3)}
              onFinish={finish}
            />
          )}
        </div>
      </div>
    </div>
  )
}
