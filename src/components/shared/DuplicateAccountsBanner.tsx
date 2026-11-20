'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFinanceStore } from '@/stores/financeStore'
import type { Account } from '@/types'

interface BankingRow {
  uid: string
  finance_account_id: string | null
  superseded_by: string | null
}

/** Merges local account `fromId` into `intoId`, locally and in the server-side bank links. */
export async function mergeAccountsEverywhere(fromId: string, intoId: string): Promise<void> {
  useFinanceStore.getState().mergeAccounts(fromId, intoId)
  await fetch('/api/banking/accounts', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mergeFrom: fromId, mergeInto: intoId }),
  }).catch(() => { /* links are repaired again on the next reconnection */ })
}

interface DuplicatePair { keep: Account; dup: Account }

const normIban = (iban?: string) => iban?.replace(/\s+/g, '').toUpperCase() || undefined

/**
 * Pairs of local accounts that are the same bank account:
 * - a reconnection made a new bank link (`dup`) while the old link still points to `keep`;
 * - two bank accounts with the same IBAN (the older one is kept).
 */
function findDuplicates(accounts: Account[], rows: BankingRow[]): DuplicatePair[] {
  const byId = new Map(accounts.map((a) => [a.id, a]))
  const rowByUid = new Map(rows.map((r) => [r.uid, r]))
  const pairs = new Map<string, DuplicatePair>()
  const add = (keep?: Account, dup?: Account) => {
    if (!keep || !dup || keep.id === dup.id || pairs.has(dup.id) || pairs.has(keep.id)) return
    pairs.set(dup.id, { keep, dup })
  }

  for (const old of rows) {
    if (!old.superseded_by || !old.finance_account_id) continue
    const live = rowByUid.get(old.superseded_by)
    if (live?.finance_account_id) add(byId.get(old.finance_account_id), byId.get(live.finance_account_id))
  }

  const bank = accounts.filter((a) => a.type === 'bank' && normIban(a.iban))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (let i = 0; i < bank.length; i++) {
    for (let j = i + 1; j < bank.length; j++) {
      if (normIban(bank[i].iban) === normIban(bank[j].iban)) add(bank[i], bank[j])
    }
  }
  return Array.from(pairs.values())
}

export default function DuplicateAccountsBanner() {
  const accounts = useFinanceStore((s) => s.accounts)
  const transactions = useFinanceStore((s) => s.transactions)
  const [rows, setRows] = useState<BankingRow[]>([])
  const [merging, setMerging] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/banking/accounts')
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d: { accounts?: BankingRow[] }) => setRows(d.accounts ?? []))
      .catch(() => {})
  }, [])

  const pairs = useMemo(() => findDuplicates(accounts, rows), [accounts, rows])
  if (pairs.length === 0) return null

  const count = (id: string) => transactions.filter((t) => t.accountId === id).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {pairs.map(({ keep, dup }) => (
        <div key={dup.id} className="ledgernest-card" style={{
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          border: '1px solid color-mix(in oklch, #d29922 45%, transparent)',
          background: 'color-mix(in oklch, #d29922 8%, var(--bg-surface))',
        }}>
          <div style={{ flex: 1, minWidth: 240, fontSize: 13, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700 }}>Conto doppio: «{dup.name}» e «{keep.name}»</div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Sono lo stesso conto bancario, duplicato quando hai ricollegato la banca.
              Unendoli, i {count(dup.id)} movimenti di «{dup.name}» passano a «{keep.name}»
              ({count(keep.id)} movimenti), che resta collegato alla banca. Nessun movimento viene perso.
            </div>
          </div>
          <button
            className="ledgernest-btn ledgernest-btn-sm"
            style={{ background: '#d29922', color: '#111', border: 'none', fontWeight: 700 }}
            disabled={merging !== null}
            onClick={async () => {
              setMerging(dup.id)
              await mergeAccountsEverywhere(dup.id, keep.id)
              setRows((rs) => rs.map((r) => (r.finance_account_id === dup.id ? { ...r, finance_account_id: keep.id } : r)))
              setMerging(null)
            }}
          >
            {merging === dup.id ? 'Unione…' : `Unisci in «${keep.name}»`}
          </button>
        </div>
      ))}
    </div>
  )
}
