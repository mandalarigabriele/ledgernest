import type { Transaction } from '@/types'

/** Category given to bank movements that no rule recognises. */
export const UNCATEGORIZED = 'Da categorizzare'
/** Category used for transfers between the user's own accounts. */
export const TRANSFER_CATEGORY = 'Trasferimenti'
/** Category for cash taken out at an ATM: counted as spent when withdrawn. */
export const CASH_CATEGORY = 'Contanti'

export type TxType = Transaction['type']

/** A category the user chose for every movement of one counterparty. */
export interface CategoryRule {
  category: string
  type: TxType
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Key that identifies a counterparty across movements: the merchant, or the description. */
export function counterpartyKey(tx: Pick<Transaction, 'merchant' | 'description'>): string {
  return normalize(tx.merchant || tx.description || '')
}

/**
 * True when `text` names the user: every word of selfName appears in it, in any order
 * ("Mandalari Gabriele" and "Gabriele Mandalari" both match "Gabriele Mandalari").
 * Requires at least two words, so a lone first name never matches.
 */
export function isSelfCounterparty(text: string | undefined, selfName: string | undefined): boolean {
  if (!text || !selfName) return false
  const nameWords = normalize(selfName).split(' ').filter((w) => w.length > 1)
  if (nameWords.length < 2) return false
  const words = new Set(normalize(text).split(' '))
  return nameWords.every((w) => words.has(w))
}

/**
 * Applies a user rule to a movement. The category always follows the rule; the type follows it
 * when either side is a transfer, otherwise the movement keeps its own direction (a rule made on
 * a refund must not turn every payment to that merchant into income).
 */
export function applyRule<T extends Pick<Transaction, 'type' | 'category'>>(tx: T, rule: CategoryRule): T {
  const type = rule.type === 'transfer' || tx.type === 'transfer' ? rule.type : tx.type
  return { ...tx, type, category: rule.category }
}

/**
 * Classification for a movement coming from the bank (or a CSV), in priority order:
 * 1. the user's rule for that counterparty;
 * 2. a counterparty with the user's own name → transfer between own accounts;
 * 3. whatever the keyword rules guessed.
 */
export function classifyImported<T extends Pick<Transaction, 'type' | 'category' | 'merchant' | 'description'>>(
  tx: T,
  rules: Record<string, CategoryRule>,
  selfName: string | undefined,
): T {
  const rule = rules[counterpartyKey(tx)]
  if (rule) return applyRule(tx, rule)
  if (isSelfCounterparty(tx.merchant || tx.description, selfName)) {
    return { ...tx, type: 'transfer', category: TRANSFER_CATEGORY }
  }
  return tx
}

/** Merchant codes for cash withdrawals (6011 = ATM, 6010 = cash at a bank counter). */
const CASH_MCC = new Set(['6010', '6011'])

// Withdrawal wording used by banks (Italian, English, German, French, Spanish).
// A plain "bancomat" also names the Italian debit network, so card payments ("pagamento POS
// bancomat") must not count.
const CASH_WORDS = /\b(prelievo|prelevamento|prelievi|atm|cash withdrawal|withdrawal|geldautomat|bargeldauszahlung|bargeld|retrait|cajero)\b|\bbancomat\b/
const CARD_PAYMENT_WORDS = /\b(pagamento|pagam|pos|acquisto)\b/

// Some banks (Trade Republic) name an ATM withdrawal only after the ATM's street address,
// e.g. "Via San Pancrazio 6". A shop never has just an address as its name.
const STREET_ADDRESS = /^(via|viale|v le|piazza|p za|piazzale|corso|c so|largo|vicolo|strada|contrada|lungomare|lungotevere|borgo|calle|rue|avenue|street|strasse)\s+[a-z ]+\s\d+[a-z]?$/

/**
 * True when a movement is a cash withdrawal. `texts` are every description the bank gave
 * (counterparty, remittance, transaction code); `merchant` is the counterparty name alone.
 */
export function isCashWithdrawal(texts: Array<string | undefined>, merchant?: string, mcc?: string): boolean {
  if (mcc && CASH_MCC.has(mcc.trim())) return true
  if (merchant && STREET_ADDRESS.test(normalize(merchant))) return true
  const text = normalize(texts.filter(Boolean).join(' '))
  if (!CASH_WORDS.test(text)) return false
  return !CARD_PAYMENT_WORDS.test(text) || /\b(prelievo|prelevamento|atm|withdrawal)\b/.test(text)
}
