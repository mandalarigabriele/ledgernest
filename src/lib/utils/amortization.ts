import type { Liability, Transaction } from '@/types'

export interface AmortizationPayment {
  txId: string
  date: string
  amount: number
  interest: number
  principal: number
  residuoAfter: number
}

export interface AutoResiduo {
  residuo: number
  payments: AmortizationPayment[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** True when the liability is paid down automatically by the movements tagged with its category. */
export function isAutoLiability(l: Liability): boolean {
  return !!l.autoCategory && l.baselineResiduo !== undefined && !!l.baselineDate
}

/**
 * Residual debt of an auto-linked liability (fixed-rate, French amortization).
 *
 * Starts from the residual the user entered (baselineResiduo, valid on baselineDate) and walks
 * every non-income movement in `autoCategory` dated after baselineDate, oldest first. Each one
 * pays the month's interest (residual × annual rate / 12) and the rest goes to principal.
 * Derived from the movements every time, so editing or deleting one never double counts.
 */
export function computeAutoResiduo(l: Liability, transactions: Transaction[]): AutoResiduo | null {
  if (!isAutoLiability(l)) return null
  const monthlyRate = (l.interestRate || 0) / 100 / 12

  const matching = transactions
    .filter((t) => t.category === l.autoCategory && t.type !== 'income' && t.date > l.baselineDate!)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

  let residuo = l.baselineResiduo!
  const payments: AmortizationPayment[] = []
  for (const t of matching) {
    if (residuo <= 0) break
    const amount = Math.abs(t.amount)
    const interest = round2(residuo * monthlyRate)
    const principal = round2(Math.min(residuo, Math.max(0, amount - interest)))
    residuo = round2(residuo - principal)
    payments.push({ txId: t.id, date: t.date, amount, interest, principal, residuoAfter: residuo })
  }
  return { residuo: Math.max(0, residuo), payments }
}

/**
 * Returns `liabilities` with the residual of every auto-linked liability recomputed, or the same
 * array instance when nothing changed (so store subscribers can skip the update).
 */
export function applyAutoResidui(liabilities: Liability[], transactions: Transaction[]): Liability[] {
  let changed = false
  const next = liabilities.map((l) => {
    const auto = computeAutoResiduo(l, transactions)
    if (!auto || auto.residuo === l.residuo) return l
    changed = true
    return { ...l, residuo: auto.residuo }
  })
  return changed ? next : liabilities
}
