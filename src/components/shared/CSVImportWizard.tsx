'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { useFinanceStore } from '@/stores/financeStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import {
  parseCSV, detectFormat, guessCategory, BRAND_FAVICON_DOMAINS, normalizeMerchantName,
  type ParsedRow, type ParsedTransaction, type ParsedTrade, type DetectedFormat,
} from '@/lib/utils/csvImport'
import { useSettingsStore } from '@/stores/settingsStore'
import { useFormatters } from '@/hooks/useFormatters'
import { CG_ID_MAP } from '@/lib/services/coinGecko'
import { CategoryPicker } from '@/components/shared/CategoryPicker'
import MerchantInput from '@/components/shared/MerchantInput'

// ── helpers ───────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const ASSET_LABEL: Record<string, string> = {
  stock: 'Azioni', etf: 'ETF', crypto: 'Crypto', commodity: 'Materie prime', bond: 'Obbligazioni',
}

const FORMAT_LABEL: Record<DetectedFormat, string> = {
  traderepublic: 'Trade Republic',
  creditagricole: 'Credit Agricole',
  unknown: 'Sconosciuto',
}

// use ParsedRow directly; casts applied at mutation sites

// ── props ─────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

// ── component ─────────────────────────────────────────────────

export default function CSVImportWizard({ onClose }: Props) {
  const { fmt } = useFormatters()
  const { accounts, transactions, addAccount, addTransaction, updateAccount } = useFinanceStore()
  const { positions, addPosition } = usePortfolioStore()
  const { settings, updateSettings } = useSettingsStore()

  const [step, setStep]         = useState<1 | 2 | 3>(1)
  const [format, setFormat]     = useState<DetectedFormat>('unknown')
  const [rows, setRows]         = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError]       = useState('')

  // Step 2 state
  const [accountId, setAccountId]             = useState<string>('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [newName, setNewName]                 = useState('')
  const [newType, setNewType]                 = useState<'bank' | 'broker' | 'crypto'>('bank')
  const [lookingUp, setLookingUp]             = useState<Record<string, boolean>>({})
  // sourceId → 'loading' | 'valid' | 'invalid' | ''
  const [tickerVal, setTickerVal]             = useState<Record<string, string>>({})
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Step 3 state
  const [txOpen, setTxOpen]       = useState(true)
  const [tradeOpen, setTradeOpen] = useState(true)
  const [importing, setImporting] = useState(false)
  const [done, setDone]           = useState(false)

  // Done screen state
  const [importedAccountId, setImportedAccountId] = useState('')
  const [balanceInput, setBalanceInput]           = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const panelRef     = useRef<HTMLDivElement>(null)

  // ── derived ───────────────────────────────────────────────────


  const txRows    = rows.filter((r): r is ParsedTransaction => r.kind === 'transaction')
  const tradeRows = rows.filter((r): r is ParsedTrade => r.kind === 'trade')

  const includedTx     = txRows.filter((r) => r.include)
  const includedTrades = tradeRows.filter((r) => r.include)
  const dupCount       = rows.filter((r) => (r as ParsedTransaction).isDuplicate).length

  const canImport =
    (includedTx.length > 0 || includedTrades.length > 0) &&
    !!accountId &&
    !includedTrades.some((t) => !t.isFreeReceipt && !t.ticker.trim())

  // ── file handling ─────────────────────────────────────────────

  const readFile = useCallback((file: File) => {
    setError('')
    const reader = new FileReader()

    const process = (text: string) => {
      const fmt = detectFormat(text)
      if (fmt === 'unknown') {
        setError('Formato non riconosciuto. Accetta solo CSV di Trade Republic o Credit Agricole.')
        return
      }
      const existingNotes = transactions.map((t) => t.note ?? '')
      const { ignoredImportIds } = useSettingsStore.getState()
      const ignoredSet = new Set(ignoredImportIds)
      const parsed = parseCSV(text, fmt, existingNotes).map((row) =>
        ignoredSet.has(row.sourceId) ? { ...row, isDuplicate: true, include: false } as ParsedRow : row
      )
      if (parsed.length === 0) {
        setError('Nessuna riga valida trovata nel file.')
        return
      }
      // Apply stored merge rules first (highest priority), then case-insensitive match as fallback
      const { merchantAliases } = useFinanceStore.getState()
      const knownMerchants = transactions.map((t) => t.merchant).filter((m): m is string => !!m).filter((m, i, a) => a.indexOf(m) === i)
      const normalized = parsed.map((row) => {
        if (row.kind !== 'transaction' || !row.merchant) return row
        const canonical = merchantAliases[row.merchant.toLowerCase()]
        if (canonical) return { ...row, merchant: canonical, description: canonical } as ParsedRow
        const match = knownMerchants.find((m) => m.toLowerCase() === row.merchant!.toLowerCase())
        if (match && match !== row.merchant) return { ...row, merchant: match, description: match } as ParsedRow
        return row
      })
      // Self-name detection: merchant matches user → giroconto
      const selfNameNorm = useSettingsStore.getState().settings.selfName?.trim().toLowerCase()
      const withSelfCheck: ParsedRow[] = normalized.map((row) => {
        if (row.kind !== 'transaction' || !selfNameNorm) return row
        const hay = (row.merchant ?? row.description ?? '').toLowerCase()
        if (hay.includes(selfNameNorm)) {
          return { ...row, type: 'transfer' as const, suggestedCategory: 'Trasferimenti', include: false } as ParsedRow
        }
        return row
      })

      // Auto-exclude transfers when ignoreTransfers is enabled
      const { settings: s } = useSettingsStore.getState()
      const withTransferFilter: ParsedRow[] = (s.ignoreTransfers ?? true)
        ? withSelfCheck.map((row) => {
            if (row.kind !== 'transaction') return row
            if ((row as ParsedTransaction).type !== 'transfer') return row
            return { ...row, include: false } as ParsedRow
          })
        : withSelfCheck

      // Final normalization pass on parsed merchant names (brand aliases, casing, suffixes)
      const finalRows: ParsedRow[] = withTransferFilter.map((row) => {
        if (row.kind !== 'transaction' || !row.merchant) return row
        const clean = normalizeMerchantName(row.merchant)
        return clean !== row.merchant ? { ...row, merchant: clean, description: clean } as ParsedRow : row
      })

      // Auto-set favicon for recognized brands (only if not already set by user)
      const { merchantLogos, setMerchantLogo } = useFinanceStore.getState()
      for (const row of finalRows) {
        if (row.kind !== 'transaction' || !row.merchant) continue
        if (merchantLogos[row.merchant]) continue
        const domain = BRAND_FAVICON_DOMAINS[row.merchant]
        if (domain) setMerchantLogo(row.merchant, `https://www.google.com/s2/favicons?sz=128&domain=${domain}`)
      }

      setFormat(fmt)
      setRows(finalRows)
      setFileName(file.name)
    }

    reader.onload = (e) => {
      let text = e.target?.result as string
      // Credit Agricole might be Latin-1 — check for replacement chars
      if (text.includes('�')) {
        const latin1Reader = new FileReader()
        latin1Reader.onload = (e2) => process(e2.target?.result as string)
        latin1Reader.readAsText(file, 'iso-8859-1')
      } else {
        process(text)
      }
    }
    reader.readAsText(file, 'utf-8')
  }, [transactions])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) readFile(file)
  }, [readFile])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) readFile(file)
    e.target.value = ''
  }, [readFile])

  // ── ISIN → ticker lookup via Yahoo Finance ────────────────────

  const lookupISIN = useCallback(async (isin: string, idx: number, sourceId: string) => {
    if (!isin) return
    setLookingUp((p) => ({ ...p, [isin]: true }))
    setTickerVal((p) => ({ ...p, [sourceId]: 'loading' }))
    try {
      const res = await fetch(`/api/ticker-search?q=${encodeURIComponent(isin)}`)
      const results: Array<{ ticker: string; name: string }> = await res.json()
      if (results.length > 0) {
        setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ticker: results[0].ticker } as ParsedRow : r))
        setTickerVal((p) => ({ ...p, [sourceId]: 'valid' }))
      } else {
        setTickerVal((p) => ({ ...p, [sourceId]: 'invalid' }))
      }
    } catch {
      setTickerVal((p) => ({ ...p, [sourceId]: 'invalid' }))
    } finally {
      setLookingUp((p) => { const n = { ...p }; delete n[isin]; return n })
    }
  }, [])

  // ── manual ticker validation (debounced, 500 ms) ──────────────

  const validateTicker = useCallback(async (ticker: string, sourceId: string, assetType: string) => {
    if (!ticker.trim()) { setTickerVal((p) => ({ ...p, [sourceId]: '' })); return }
    setTickerVal((p) => ({ ...p, [sourceId]: 'loading' }))
    if (assetType === 'crypto') {
      // Instant lookup against local CoinGecko ID map — no API call needed
      const valid = ticker.toUpperCase() in CG_ID_MAP
      setTickerVal((p) => ({ ...p, [sourceId]: valid ? 'valid' : 'invalid' }))
      return
    }
    try {
      const res = await fetch(`/api/ticker-search?q=${encodeURIComponent(ticker)}`)
      const results: Array<{ ticker: string }> = await res.json()
      const exact = results.some((r) => r.ticker.toUpperCase() === ticker.toUpperCase())
      setTickerVal((p) => ({ ...p, [sourceId]: exact ? 'valid' : 'invalid' }))
    } catch {
      setTickerVal((p) => ({ ...p, [sourceId]: 'invalid' }))
    }
  }, [])

  function onTickerChange(ticker: string, sourceId: string, rowIdx: number) {
    patchRow(rowIdx, { ticker: ticker.toUpperCase() })
    setTickerVal((p) => ({ ...p, [sourceId]: '' }))
    clearTimeout(debounceTimers.current[sourceId])
    if (ticker.trim()) {
      const row = rows[rowIdx]
      const assetType = row.kind === 'trade' ? (row as ParsedTrade).assetType : 'stock'
      debounceTimers.current[sourceId] = setTimeout(() => validateTicker(ticker.toUpperCase(), sourceId, assetType), 500)
    }
  }

  // ── step navigation ───────────────────────────────────────────

  const goToStep2 = () => {
    if (!fileName) return
    // Validate all trade tickers upfront: lookup missing ISINs and validate pre-filled tickers
    tradeRows.forEach((r) => {
      const globalIdx = rows.indexOf(r)
      if (!r.ticker && r.isin) {
        lookupISIN(r.isin, globalIdx, r.sourceId)
      } else if (r.ticker) {
        validateTicker(r.ticker, r.sourceId, r.assetType)
      }
    })
    // Default to first account
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id)
    setStep(2)
  }

  const goToStep3 = () => {
    if (!accountId && !creatingAccount) return
    setStep(3)
  }

  // ── row mutation helpers ──────────────────────────────────────

  function patchRow(idx: number, patch: object) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } as ParsedRow : r))
  }

  function toggleAll(kind: 'transaction' | 'trade', checked: boolean) {
    setRows((prev) => prev.map((r) => r.kind === kind ? { ...r, include: checked } as ParsedRow : r))
  }

  // ── import execution ─────────────────────────────────────────

  async function doImport() {
    if (!canImport) return
    setImporting(true)

    let resolvedAccountId = accountId
    if (creatingAccount && newName.trim()) {
      addAccount({
        name: newName.trim(), type: newType,
        icon: newType === 'broker' ? 'broker' : newType === 'crypto' ? 'crypto' : 'bank',
        balance: 0, currency: 'EUR',
      })
      // Get the newly added account (it's the last one)
      const acct = useFinanceStore.getState().accounts.at(-1)
      if (acct) resolvedAccountId = acct.id
    }

    // ── Import trades ──────────────────────────────────────────
    const byTicker = new Map<string, ParsedTrade[]>()
    for (const trade of includedTrades) {
      const tk = trade.ticker.trim()
      if (!tk) continue
      if (!byTicker.has(tk)) byTicker.set(tk, [])
      byTicker.get(tk)!.push(trade)
    }

    for (const [ticker, trs] of Array.from(byTicker)) {
      const existingPos = usePortfolioStore.getState().positions.find((p) => p.ticker.toUpperCase() === ticker.toUpperCase())

      if (!existingPos) {
        const totalQty  = trs.reduce((s: number, t) => s + t.quantity, 0)
        const totalCost = trs.reduce((s: number, t) => s + t.amount + t.commission, 0)  // EUR debit + separate commission fee
        const avgPrice  = totalQty > 0 ? totalCost / totalQty : 0
        const sample    = trs[0]

        addPosition({
          ticker,
          name: sample.name || ticker,
          type: sample.assetType === 'commodity' ? 'commodity' : sample.assetType,
          quantity: totalQty,
          avgPrice,
          currency: 'EUR',
          broker: accounts.find((a) => a.id === resolvedAccountId)?.name ?? 'Trade Republic',
        })
      }

      // Finance transaction per trade
      for (const trade of trs) {
        if (trade.isFreeReceipt) continue
        addTransaction({
          date: trade.date,
          description: `Acquisto ${ticker} ×${trade.quantity}`,
          amount: trade.amount,
          type: 'expense',
          category: ASSET_LABEL[trade.assetType] ?? 'Azioni',
          accountId: resolvedAccountId,
          note: `[import:${trade.sourceId}] ${trade.originalDescription ?? ''}`.trim(),
        })
      }
    }

    // FREE_RECEIPT (crypto gifts, rewards)
    for (const trade of includedTrades.filter((t) => t.isFreeReceipt)) {
      const tk = trade.ticker.trim()
      if (!tk) continue
      const existingPos = usePortfolioStore.getState().positions.find((p) => p.ticker.toUpperCase() === tk.toUpperCase())
      if (!existingPos) {
        addPosition({
          ticker: tk,
          name: trade.name || tk,
          type: 'crypto',
          quantity: trade.quantity,
          avgPrice: 0,
          currency: 'EUR',
          broker: accounts.find((a) => a.id === resolvedAccountId)?.name ?? 'Trade Republic',
        })
      }
    }

    // ── Import transactions ────────────────────────────────────
    for (const tx of includedTx) {
      addTransaction({
        date: tx.date,
        description: tx.description,
        merchant: tx.merchant,
        amount: tx.amount,
        type: tx.type,
        category: tx.suggestedCategory,
        accountId: resolvedAccountId,
        note: `[import:${tx.sourceId}] ${tx.originalDescription}`.trim(),
      })
    }

    // Save IDs of rows the user explicitly left unchecked (not already duplicates/ignored)
    const newlyIgnored = rows
      .filter((r): r is ParsedTransaction => r.kind === 'transaction' && !r.include && !r.isDuplicate)
      .map((r) => r.sourceId)
    if (newlyIgnored.length > 0) {
      useSettingsStore.getState().addIgnoredImportIds(newlyIgnored)
    }

    setImporting(false)
    setImportedAccountId(resolvedAccountId)
    setDone(true)
  }

  // ── render ────────────────────────────────────────────────────

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9000,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  const panelStyle: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
    borderRadius: 20, width: '95vw',
    maxHeight: '88vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 32px 80px rgba(0,0,0,.6)',
    overflow: 'hidden', maxWidth: 1100,
  }

  // ── Done state ────────────────────────────────────────────────

  if (done) {
    const importedAccount = accounts.find((a) => a.id === importedAccountId)
    const handleSaveBalance = () => {
      const val = parseFloat(balanceInput.replace(',', '.'))
      if (!isNaN(val) && importedAccountId) {
        updateAccount(importedAccountId, { balance: val })
      }
      onClose()
    }
    return (
      <div style={overlayStyle}>
        <div style={{ ...panelStyle, maxWidth: 440, padding: 36, gap: 0 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{ fontSize: 40 }}>✓</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Import completato</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
              {includedTx.length} moviment{includedTx.length === 1 ? 'o' : 'i'} e{' '}
              {includedTrades.filter((t) => !t.isFreeReceipt).length} investiment{includedTrades.filter((t) => !t.isFreeReceipt).length === 1 ? 'o' : 'i'} importati.
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Aggiorna saldo del conto</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Inserisci il saldo attuale di <strong>{importedAccount?.name ?? 'conto'}</strong> come risulta dall&apos;estratto conto.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveBalance()}
                  style={{
                    width: '100%', padding: '10px 36px 10px 12px', borderRadius: 10,
                    border: '1.5px solid var(--accent)', background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, outline: 'none',
                    boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-tertiary)', pointerEvents: 'none' }}>€</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="ledgernest-btn ledgernest-btn-ghost" style={{ flex: 1 }} onClick={onClose}>Salta</button>
              <button className="ledgernest-btn" style={{ flex: 2 }} onClick={handleSaveBalance}>Salva e chiudi</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={overlayStyle}>
      <div style={panelStyle} ref={panelRef} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ──────────────────────────────────────────── */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>Importa CSV</div>
            {fileName && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>{fileName} · {FORMAT_LABEL[format]}</div>}
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {([1, 2, 3] as const).map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && <div style={{ width: 32, height: 1, background: step > s - 1 ? 'var(--accent)' : 'var(--border-subtle)' }} />}
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: step === s ? 'var(--accent)' : step > s ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                  color: step === s ? '#0b0f12' : step > s ? 'var(--accent)' : 'var(--text-tertiary)',
                  border: `1.5px solid ${step >= s ? 'var(--accent)' : 'var(--border-subtle)'}`,
                }}>
                  {s}
                </div>
              </div>
            ))}
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 22, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* ── Body ────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 0' }}>

          {/* ── STEP 1: Upload ─────────────────────────────────── */}
          {step === 1 && (
            <div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${fileName ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  borderRadius: 14, padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
                  background: fileName ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                  transition: 'all .2s',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>{fileName ? '✓' : '↑'}</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                  {fileName ? fileName : 'Trascina il CSV o clicca per selezionare'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Trade Republic · Credit Agricole
                </div>
                <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onFileChange} />
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.3)', borderRadius: 10, fontSize: 13, color: '#f85149' }}>
                  {error}
                </div>
              )}

              {rows.length > 0 && !error && (
                <div style={{ marginTop: 16, padding: '14px 18px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Riepilogo</div>
                  <div style={{ display: 'flex', gap: 24, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    <span>Formato: <strong style={{ color: 'var(--text-primary)' }}>{FORMAT_LABEL[format]}</strong></span>
                    <span>Righe totali: <strong style={{ color: 'var(--text-primary)' }}>{rows.length}</strong></span>
                    {txRows.length > 0 && <span>Movimenti: <strong style={{ color: 'var(--text-primary)' }}>{txRows.length}</strong></span>}
                    {tradeRows.length > 0 && <span>Investimenti: <strong style={{ color: 'var(--text-primary)' }}>{tradeRows.length}</strong></span>}
                    {dupCount > 0 && <span style={{ color: '#d29922' }}>Duplicati: <strong>{dupCount}</strong></span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Configura ─────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Account selection */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Conto destinazione</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 10 }}>Qualsiasi tipo — banca, broker o wallet crypto</div>
                {!creatingAccount ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {accounts.map((a) => (
                      <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${accountId === a.id ? 'var(--accent)' : 'var(--border-subtle)'}`, cursor: 'pointer', background: accountId === a.id ? 'var(--accent-dim)' : 'var(--bg-elevated)' }}>
                        <input type="radio" name="account" value={a.id} checked={accountId === a.id} onChange={() => setAccountId(a.id)} style={{ accentColor: 'var(--accent)' }} />
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', textTransform: 'capitalize' }}>{a.type}</span>
                        <span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: 13 }}>{fmt(a.balance)}</span>
                      </label>
                    ))}
                    <button
                      style={{ marginTop: 4, padding: '9px 14px', borderRadius: 10, border: '1.5px dashed var(--border-subtle)', background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--text-secondary)', textAlign: 'left' }}
                      onClick={() => { setCreatingAccount(true); setAccountId(''); setNewType(tradeRows.length > 0 ? 'broker' : 'bank') }}
                    >
                      + Crea nuovo conto
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '16px 18px', borderRadius: 12, border: '1.5px solid var(--accent)', background: 'var(--accent-dim)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Nuovo conto</div>
                    <input
                      autoFocus
                      placeholder="Nome (es. Trade Republic, Credit Agricole…)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      {([
                        { value: 'bank',   label: 'Banca',   desc: 'Conto corrente, deposito' },
                        { value: 'broker', label: 'Broker',  desc: 'Investimenti, trading' },
                        { value: 'crypto', label: 'Crypto',  desc: 'Wallet o exchange' },
                      ] as const).map((t) => (
                        <button key={t.value} onClick={() => setNewType(t.value)} title={t.desc} style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          border: `1.5px solid ${newType === t.value ? 'var(--accent)' : 'var(--border-subtle)'}`,
                          background: newType === t.value ? 'var(--accent)' : 'transparent',
                          color: newType === t.value ? '#0b0f12' : 'var(--text-secondary)',
                        }}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                      Tutti i tipi possono contenere azioni, ETF e crypto.
                    </div>
                    <button onClick={() => { setCreatingAccount(false); if (accounts.length > 0) setAccountId(accounts[0].id) }} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', width: 'fit-content' }}>
                      Annulla
                    </button>
                  </div>
                )}
              </div>

              {/* Import options */}
              {txRows.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Opzioni</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>Ignora trasferimenti tra conti</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>Le operazioni di tipo trasferimento non hanno significato nei report di spesa</div>
                    </div>
                    <div
                      onClick={() => {
                        const next = !(settings.ignoreTransfers ?? true)
                        updateSettings({ ignoreTransfers: next })
                        setRows((prev) => prev.map((r) => {
                          if (r.kind !== 'transaction') return r
                          const tx = r as ParsedTransaction
                          if (tx.type !== 'transfer') return r
                          if (tx.isDuplicate) return r
                          return { ...r, include: !next } as ParsedRow
                        }))
                      }}
                      style={{
                        width: 40, height: 22, borderRadius: 11, flexShrink: 0, cursor: 'pointer',
                        background: (settings.ignoreTransfers ?? true) ? 'var(--accent)' : 'var(--bg-surface)',
                        border: '1.5px solid var(--border-subtle)',
                        position: 'relative', transition: 'background .2s',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%', background: '#fff',
                        transition: 'left .2s',
                        left: (settings.ignoreTransfers ?? true) ? 22 : 2,
                      }} />
                    </div>
                  </label>
                </div>
              )}

              {/* Ticker mapping */}
              {tradeRows.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Mappa ticker</div>
                  <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-elevated)' }}>
                          {['Nome', 'ISIN / Symbol', 'Tipo', 'Qtà', 'Prezzo (nat.)', 'Comm. €', 'Totale €', 'Ticker'].map((h, i) => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: i >= 3 && i <= 6 ? 'right' : 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tradeRows.map((trade) => {
                          const idx = rows.indexOf(trade)
                          const isLoading = !!lookingUp[trade.isin]
                          return (
                            <tr key={trade.sourceId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{trade.name}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontFamily: 'monospace', fontSize: 11.5 }}>{trade.isin || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                                  {ASSET_LABEL[trade.assetType] ?? trade.assetType}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                                {trade.quantity.toFixed(trade.assetType === 'crypto' ? 6 : 4)}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11.5 }}>
                                {trade.price > 0 ? trade.price.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                                {trade.commission > 0 ? fmt(trade.commission) : '—'}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11.5, fontWeight: 600 }}>
                                {trade.amount > 0 ? fmt(trade.amount) : '—'}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                {isLoading ? (
                                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Ricerca…</span>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ position: 'relative' }}>
                                      <input
                                        value={trade.ticker}
                                        onChange={(e) => onTickerChange(e.target.value, trade.sourceId, idx)}
                                        placeholder="es. NVDA"
                                        style={{
                                          padding: '4px 26px 4px 8px', borderRadius: 6,
                                          border: `1px solid ${
                                            tickerVal[trade.sourceId] === 'valid'   ? 'var(--success, #3fb950)' :
                                            tickerVal[trade.sourceId] === 'invalid' ? '#f85149' :
                                            !trade.ticker && !trade.isFreeReceipt   ? '#f85149' :
                                            'var(--border-subtle)'
                                          }`,
                                          background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                                          fontSize: 12, fontFamily: 'monospace', width: 100, outline: 'none',
                                        }}
                                      />
                                      {/* Validation badge */}
                                      <span style={{
                                        position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                                        fontSize: 12, lineHeight: 1,
                                        color: tickerVal[trade.sourceId] === 'valid'   ? 'var(--success, #3fb950)' :
                                               tickerVal[trade.sourceId] === 'invalid' ? '#f85149' :
                                               tickerVal[trade.sourceId] === 'loading' ? 'var(--text-tertiary)' : 'transparent',
                                      }}>
                                        {tickerVal[trade.sourceId] === 'loading' ? '…' :
                                         tickerVal[trade.sourceId] === 'valid'   ? '✓' :
                                         tickerVal[trade.sourceId] === 'invalid' ? '✗' : ''}
                                      </span>
                                    </div>
                                    {trade.isin && !trade.ticker && (
                                      <button
                                        onClick={() => lookupISIN(trade.isin, idx, trade.sourceId)}
                                        style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--accent)' }}
                                      >
                                        Cerca
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Revisione ─────────────────────────────── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Transactions section */}
              {txRows.length > 0 && (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
                  <div
                    onClick={() => setTxOpen((o) => !o)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--bg-elevated)', cursor: 'pointer', borderBottom: txOpen ? '1px solid var(--border-subtle)' : 'none' }}
                  >
                    <input type="checkbox" checked={txRows.every((r) => r.include)} onChange={(e) => toggleAll('transaction', e.target.checked)} onClick={(e) => e.stopPropagation()} style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Movimenti ({txRows.length})</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {includedTx.length} selezionati</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12 }}>{txOpen ? '▲' : '▼'}</span>
                  </div>

                  {txOpen && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-elevated)' }}>
                          {['', 'Data', 'Descrizione', 'Merchant', 'Importo', 'Tipo', 'Categoria'].map((h, i) => (
                            <th key={i} style={{ padding: '6px 10px', textAlign: i >= 4 ? 'right' : 'left', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 11, borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {txRows.map((tx) => {
                          const idx = rows.indexOf(tx)
                          const isDup = tx.isDuplicate
                          return (
                            <tr key={tx.sourceId} style={{ borderBottom: '1px solid var(--border-subtle)', background: isDup ? 'rgba(210,153,34,0.06)' : undefined, opacity: tx.include ? 1 : 0.45 }}>
                              <td style={{ padding: '6px 10px', width: 28 }}>
                                <input type="checkbox" checked={tx.include} onChange={(e) => patchRow(idx, { include: e.target.checked })} style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                              </td>
                              <td style={{ padding: '6px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(tx.date)}</td>
                              <td style={{ padding: '6px 10px' }}>
                                <div title={tx.description} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {tx.description}
                                  {isDup && <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(210,153,34,0.2)', color: '#d29922' }}>già presente</span>}
                                </div>
                              </td>
                              <td style={{ padding: '4px 6px', minWidth: 150 }}>
                                <MerchantInput
                                  value={tx.merchant ?? ''}
                                  onChange={(v) => patchRow(idx, { merchant: v || undefined })}
                                  placeholder="—"
                                  inputStyle={{ padding: '4px 8px', fontSize: 11, borderRadius: 6 }}
                                />
                              </td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: tx.type === 'income' ? 'var(--success, #3fb950)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{fmt(tx.amount)}
                              </td>
                              <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                                <select
                                  value={tx.type}
                                  onChange={(e) => {
                                    const newType = e.target.value as 'income' | 'expense' | 'transfer'
                                    const { cat } = guessCategory(tx.description)
                                    const suggestedCategory = newType === 'transfer' ? 'Trasferimenti'
                                      : newType === 'income' ? (cat !== 'Spese personali' ? cat : 'Stipendio')
                                      : cat
                                    patchRow(idx, { type: newType, suggestedCategory })
                                  }}
                                  style={{ fontSize: 11, padding: '2px 4px', borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                >
                                  <option value="income">Entrata</option>
                                  <option value="expense">Uscita</option>
                                  <option value="transfer">Trasferimento</option>
                                </select>
                              </td>
                              <td style={{ padding: '6px 4px', minWidth: 180 }}>
                                <CategoryPicker
                                  value={tx.suggestedCategory}
                                  onChange={(v) => patchRow(idx, { suggestedCategory: v })}
                                  typeFilter={tx.type === 'transfer' ? 'all' : tx.type}
                                  containerRef={panelRef}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Trades section */}
              {tradeRows.length > 0 && (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
                  <div
                    onClick={() => setTradeOpen((o) => !o)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--bg-elevated)', cursor: 'pointer', borderBottom: tradeOpen ? '1px solid var(--border-subtle)' : 'none' }}
                  >
                    <input type="checkbox" checked={tradeRows.every((r) => r.include)} onChange={(e) => toggleAll('trade', e.target.checked)} onClick={(e) => e.stopPropagation()} style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Investimenti ({tradeRows.length})</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {includedTrades.length} selezionati</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12 }}>{tradeOpen ? '▲' : '▼'}</span>
                  </div>

                  {tradeOpen && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-elevated)' }}>
                          {['', 'Data', 'Ticker', 'Nome', 'Quantità', 'Prezzo (nat.)', 'Comm. €', 'Totale €'].map((h, i) => (
                            <th key={i} style={{ padding: '6px 10px', textAlign: i >= 4 ? 'right' : 'left', fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 11, borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tradeRows.map((trade) => {
                          const idx = rows.indexOf(trade)
                          const isDup = false // trades don't track duplicate badge
                          const existingPos = positions.find((p) => p.ticker.toUpperCase() === trade.ticker.toUpperCase())
                          return (
                            <tr key={trade.sourceId} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: trade.include ? 1 : 0.45 }}>
                              <td style={{ padding: '6px 10px', width: 28 }}>
                                <input type="checkbox" checked={trade.include} onChange={(e) => patchRow(idx, { include: e.target.checked })} style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                              </td>
                              <td style={{ padding: '6px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(trade.date)}</td>
                              <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 700, fontSize: 12.5 }}>
                                {trade.ticker || <span style={{ color: 'var(--danger, #f85149)' }}>—</span>}
                                {existingPos && <span style={{ marginLeft: 5, fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--accent-dim)', color: 'var(--accent)' }}>esistente</span>}
                                {trade.isFreeReceipt && <span style={{ marginLeft: 5, fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(63,185,80,0.1)', color: '#3fb950' }}>gratis</span>}
                              </td>
                              <td style={{ padding: '6px 10px' }}>
                                <div title={trade.name} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trade.name}</div>
                              </td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{trade.quantity.toFixed(trade.assetType === 'crypto' ? 6 : 4)}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                {trade.price > 0 ? trade.price.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                              </td>
                              <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={trade.commission}
                                    onChange={(e) => patchRow(idx, { commission: parseFloat(e.target.value) || 0 })}
                                    style={{
                                      width: 56, padding: '3px 6px', borderRadius: 5,
                                      border: '1px solid var(--border-subtle)',
                                      background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                                      fontSize: 11.5, textAlign: 'right', outline: 'none',
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  />
                                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>€</span>
                                </div>
                              </td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{trade.amount > 0 ? fmt(trade.amount) : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>

          {step === 1 && (
            <>
              <button className="ledgernest-btn ledgernest-btn-ghost" onClick={onClose}>Annulla</button>
              <button
                className="ledgernest-btn"
                disabled={!fileName || !!error}
                onClick={goToStep2}
                style={{ marginLeft: 'auto' }}
              >
                Avanti →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button className="ledgernest-btn ledgernest-btn-ghost" onClick={() => setStep(1)}>← Indietro</button>
              {Object.values(tickerVal).some((v) => v === 'invalid') && (
                <span style={{ fontSize: 11.5, color: '#f85149', marginLeft: 8 }}>Alcuni ticker non trovati su Yahoo Finance</span>
              )}
              <button
                className="ledgernest-btn"
                disabled={
                  (!accountId && !(creatingAccount && newName.trim())) ||
                  Object.values(tickerVal).some((v) => v === 'loading') ||
                  tradeRows.some((t) => !t.isFreeReceipt && !t.ticker.trim())
                }
                onClick={goToStep3}
                style={{ marginLeft: 'auto' }}
              >
                Avanti →
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button className="ledgernest-btn ledgernest-btn-ghost" onClick={() => setStep(2)}>← Indietro</button>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  {includedTx.length} moviment{includedTx.length === 1 ? 'o' : 'i'} · {includedTrades.length} investiment{includedTrades.length === 1 ? 'o' : 'i'}
                </span>
                <button
                  className="ledgernest-btn"
                  disabled={!canImport || importing}
                  onClick={doImport}
                >
                  {importing ? 'Importazione…' : 'Importa'}
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
