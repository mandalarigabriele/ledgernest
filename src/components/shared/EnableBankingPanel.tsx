'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useFinanceStore } from '@/stores/financeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Transaction } from '@/types'

interface EBSession { id: string; bank_name: string; status: string }

interface EBAccount {
  uid: string
  session_id: string
  finance_account_id: string | null
  iban: string | null
  name: string | null
  currency: string
  balance: number | null
  last_synced_at: string | null
}

interface SyncResult {
  newBalance: number
  newTransactions: (Omit<Transaction, 'createdAt'> & { eb_id: string })[]
  total: number
  imported: number
  error?: string
}

export default function EnableBankingPanel() {
  const { accounts, addAccount, addTransaction, updateAccount, updateTransaction } = useFinanceStore()
  const bankAccounts = accounts.filter((a) => a.type === 'bank')

  const [sessions, setSessions]     = useState<EBSession[]>([])
  const [ebAccounts, setEbAccounts] = useState<EBAccount[]>([])
  const [syncing, setSyncing]       = useState<string | null>(null)
  const [flash, setFlash]           = useState<string | null>(null)
  const importedRef   = useRef(false)
  const obSyncInterval = useSettingsStore((s) => s.settings.obSyncInterval)

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(null), 4000) }

  const loadData = useCallback(async () => {
    const res = await fetch('/api/banking/accounts')
    if (!res.ok) return
    const data = await res.json() as { sessions: EBSession[]; accounts: EBAccount[] }
    setSessions(data.sessions ?? [])
    setEbAccounts(data.accounts ?? [])

    // Backfill bankingUid on local accounts that were created before the field existed
    for (const acct of data.accounts ?? []) {
      if (!acct.finance_account_id || !acct.uid) continue
      const local = useFinanceStore.getState().accounts.find((a) => a.id === acct.finance_account_id)
      if (local && !local.bankingUid) {
        useFinanceStore.getState().updateAccount(acct.finance_account_id, { bankingUid: acct.uid })
      }
    }
  }, [])

  // Auto-import unlinked accounts when returning from OB auth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isBankingOk = !!params.get('banking_ok')

    loadData().then(async () => {
      if (!isBankingOk) return
      if (importedRef.current) return  // StrictMode double-fire guard
      importedRef.current = true
      window.history.replaceState({}, '', window.location.pathname)

      const res = await fetch('/api/banking/accounts')
      if (!res.ok) return
      const data = await res.json() as { sessions: EBSession[]; accounts: EBAccount[] }
      const unlinked = (data.accounts ?? []).filter((a) => !a.finance_account_id)
      const session  = (data.sessions ?? []).find((s) => s.status === 'active')

      let created = 0
      for (const acct of unlinked) {
        const name = acct.name ?? acct.iban ?? session?.bank_name ?? 'Conto'

        // Skip if a local account with same IBAN or name already exists
        const existing = useFinanceStore.getState().accounts.find(
          (a) => a.type === 'bank' && ((acct.iban && a.iban === acct.iban) || a.name === name)
        )
        if (existing) {
          // Just link it if not already linked
          await fetch('/api/banking/accounts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: acct.uid, financeAccountId: existing.id }),
          })
          continue
        }

        addAccount({
          name,
          type: 'bank',
          icon: 'conti',
          balance: acct.balance ?? 0,
          currency: acct.currency as 'EUR' | 'USD',
          broker: session?.bank_name ?? undefined,
          iban: acct.iban ?? undefined,
          bankingUid: acct.uid,
        })
        const newAcct = useFinanceStore.getState().accounts.findLast(
          (a) => a.type === 'bank' && a.name === name
        )
        if (!newAcct) continue
        await fetch('/api/banking/accounts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: acct.uid, financeAccountId: newAcct.id }),
        })
        created++
      }

      showFlash(created > 0
        ? `${created} conto${created > 1 ? 'i' : ''} importato${created > 1 ? 'i' : ''} via Open Banking`
        : 'Connessione Open Banking attiva')
      await loadData()
    })
  }, [loadData, addAccount])

  async function handleSync(acct: EBAccount, mode: 'delta' | 'force' | 'hard-reset' = 'delta') {
    if (!acct.finance_account_id) {
      showFlash('Collega prima il conto a un conto locale')
      return
    }
    setSyncing(acct.uid)
    try {
      const res  = await fetch('/api/banking/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountUid: acct.uid, financeAccountId: acct.finance_account_id, mode }),
      })
      const data = await res.json() as SyncResult
      if (!res.ok) { showFlash(data.error ?? 'Errore sync'); return }

      // Client-side dedup: update accountId on existing matches, add only truly new ones
      const { transactions } = useFinanceStore.getState()
      let added = 0, fixed = 0
      for (const tx of data.newTransactions) {
        const { eb_id: _, ...txData } = tx
        const existing = transactions.find(
          (t) => t.date === txData.date && Math.abs(t.amount - txData.amount) < 0.01
            && t.type === txData.type && t.description === txData.description
        )
        if (existing) {
          if (existing.accountId !== acct.finance_account_id || !existing.ebId) {
            updateTransaction(existing.id, { accountId: acct.finance_account_id, ebId: txData.ebId })
            fixed++
          }
        } else {
          addTransaction({ ...txData, note: undefined })
          added++
        }
      }

      updateAccount(acct.finance_account_id, { balance: data.newBalance })
      await loadData()
      const msg = [added > 0 && `+${added} movimenti`, fixed > 0 && `${fixed} corretti`].filter(Boolean).join(', ')
      showFlash(msg || 'Nessun nuovo movimento')
    } catch {
      showFlash('Errore di rete')
    } finally {
      setSyncing(null)
    }
  }

  async function handleLinkAccount(uid: string, financeAccountId: string | null) {
    await fetch('/api/banking/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, financeAccountId }),
    })
    setEbAccounts((prev) => prev.map((a) => a.uid === uid ? { ...a, finance_account_id: financeAccountId } : a))
  }

  // Auto-sync on interval (delta only — runs while app is open in browser)
  useEffect(() => {
    if (!obSyncInterval) return
    const id = setInterval(async () => {
      const res = await fetch('/api/banking/accounts')
      if (!res.ok) return
      const data = await res.json() as { accounts: EBAccount[] }
      for (const acct of data.accounts ?? []) {
        if (acct.finance_account_id) await handleSync(acct, 'delta')
      }
    }, obSyncInterval * 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obSyncInterval])

  // Expose sync for external use via window event (used by AccountCard sync button)
  useEffect(() => {
    const handler = (e: Event) => {
      const { uid, mode } = (e as CustomEvent<{ uid: string; mode?: 'delta' | 'force' | 'hard-reset' }>).detail
      const acct = ebAccounts.find((a) => a.uid === uid)
      if (acct) handleSync(acct, mode ?? 'delta')
    }
    window.addEventListener('ob:sync', handler)
    return () => window.removeEventListener('ob:sync', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ebAccounts])

  // Nothing to render — this component only handles side effects
  return null
}
