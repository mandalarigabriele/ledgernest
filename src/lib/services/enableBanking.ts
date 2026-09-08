import crypto from 'crypto'

const BASE_URL = 'https://api.enablebanking.com'

// ---- JWT signing -----------------------------------------------

function buildAppJwt(): string {
  const appId = process.env.ENABLEBANKING_APP_ID
  const rawKey = process.env.ENABLEBANKING_PRIVATE_KEY
  if (!appId || !rawKey) throw new Error('Enable Banking credentials not configured')

  const privateKey = rawKey.replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)

  const keyObject = crypto.createPrivateKey(privateKey)
  const isEC = keyObject.asymmetricKeyType === 'ec'
  const alg = isEC ? 'ES256' : 'RS256'

  const header  = Buffer.from(JSON.stringify({ alg, kid: appId })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: 'enablebanking.com',
    sub: appId,
    aud: 'api.enablebanking.com',
    iat: now,
    exp: now + 3600,
  })).toString('base64url')
  const sigInput = `${header}.${payload}`

  const sig = isEC
    ? crypto.sign('SHA256', Buffer.from(sigInput), { key: privateKey, dsaEncoding: 'ieee-p1363' })
    : crypto.sign('SHA256', Buffer.from(sigInput), { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING })

  return `${sigInput}.${sig.toString('base64url')}`
}

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const jwt = buildAppJwt()
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> ?? {}),
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...opts, headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Enable Banking API ${res.status}: ${body}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '')
    throw new Error(`Enable Banking API returned non-JSON response (${res.status}): ${text.slice(0, 100)}`)
  }
  try {
    return await res.json() as T
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Enable Banking API JSON parse error: ${msg}`)
  }
}

// ---- Step 1: POST /auth — initiate PSU authorization -----------

export async function initiateAuth(opts: {
  redirectUrl: string
  state: string
  bankName: string
  country: string
}): Promise<{ url: string }> {
  const validUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  const data = await apiFetch<{ url?: string; authorizationUri?: string }>('/auth', {
    method: 'POST',
    body: JSON.stringify({
      access: { valid_until: validUntil, balances: true, transactions: true },
      aspsp: { name: opts.bankName, country: opts.country },
      psu_type: 'personal',
      redirect_url: opts.redirectUrl,
      state: opts.state,
    }),
  })
  const url = data.url ?? data.authorizationUri
  if (!url) throw new Error('Enable Banking did not return a redirect URL')
  return { url }
}

// ---- Step 2: POST /sessions — exchange code for session --------

export interface EBSessionAccount {
  uid?: string
  account_id?: string       // some API versions use this
  accountId?: string        // camelCase variant
  iban?: string
  name?: string
  product?: string
  currency: string
  identifications?: { identification: string; scheme_name?: string; schemeName?: string }[]
}

export interface EBSessionResult {
  session_id?: string
  sessionId?: string
  accounts: EBSessionAccount[]
}

export async function createSessionFromCode(code: string): Promise<EBSessionResult> {
  return apiFetch<EBSessionResult>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

// ---- Balances --------------------------------------------------

export interface EBBalance {
  balance_amount?: { amount: string; currency: string }
  balanceAmount?: { amount: string; currency: string }
  balance_type?: string
  balanceType?: string
  credit_debit_indicator?: 'CRDT' | 'DBIT'
  creditDebitIndicator?: 'CRDT' | 'DBIT'
}

export async function getBalances(accountId: string): Promise<EBBalance[]> {
  const data = await apiFetch<{ balances: EBBalance[] }>(`/accounts/${accountId}/balances`)
  return data.balances ?? []
}

export function getClosingBalance(balances: EBBalance[]): number {
  const closing = balances.find((b) => (b.balance_type ?? b.balanceType) === 'CLBD')
    ?? balances.find((b) => (b.balance_type ?? b.balanceType) === 'ITAV')
    ?? balances.find((b) => (b.balance_type ?? b.balanceType) === 'closingBooked')
    ?? balances.find((b) => (b.balance_type ?? b.balanceType) === 'interimAvailable')
    ?? balances[0]

  if (!closing) return 0
  const amt = closing.balance_amount ?? closing.balanceAmount
  if (!amt) return 0
  const value = parseFloat(amt.amount)
  const indicator = closing.credit_debit_indicator ?? closing.creditDebitIndicator
  return indicator === 'DBIT' ? -value : value
}

// ---- Transactions ----------------------------------------------

export interface EBTransaction {
  entry_reference?: string
  entryReference?: string
  transaction_id?: string
  booking_date?: string
  bookingDate?: string
  value_date?: string
  valueDate?: string
  transaction_amount?: { amount: string | number; currency?: string }
  transactionAmount?: { amount: string | number; currency?: string }
  credit_debit_indicator?: 'CRDT' | 'DBIT'
  creditDebitIndicator?: 'CRDT' | 'DBIT'
  creditor_name?: string
  creditor?: { name?: string } | string
  debtor_name?: string
  debtor?: { name?: string } | string
  remittance_information?: string | string[] | { unstructured?: string | string[]; structured?: string } | Array<{ unstructured?: string; structured?: string } | string>
}

export async function getTransactions(
  accountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<EBTransaction[]> {
  const qs = new URLSearchParams({ date_from: dateFrom, date_to: dateTo }).toString()
  const data = await apiFetch<{ transactions: EBTransaction[] }>(
    `/accounts/${accountId}/transactions?${qs}`,
  )
  return data.transactions ?? []
}

// ---- Helpers ---------------------------------------------------

export function resolveAccountId(acct: EBSessionAccount): string {
  return acct.uid ?? acct.account_id ?? acct.accountId ?? ''
}

export function resolveIban(acct: EBSessionAccount): string | null {
  if (acct.iban) return acct.iban
  const id = acct.identifications?.find(
    (i) => (i.scheme_name ?? i.schemeName) === 'IBAN' || (i.scheme_name ?? i.schemeName) === 'BBAN',
  )
  return id?.identification ?? null
}

export function resolveTransactionAmount(tx: EBTransaction): number {
  const amt = tx.transaction_amount ?? tx.transactionAmount
  if (!amt || amt.amount == null) return 0
  const value = typeof amt.amount === 'number' ? amt.amount : parseFloat(String(amt.amount))
  if (isNaN(value)) return 0
  const indicator = tx.credit_debit_indicator ?? tx.creditDebitIndicator
  return indicator === 'DBIT' ? -value : value
}

export function resolveTransactionDate(tx: EBTransaction): string {
  const dateStr = tx.booking_date ?? tx.bookingDate ?? tx.value_date ?? tx.valueDate
  if (typeof dateStr === 'string' && dateStr.length >= 10) return dateStr.slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

export function resolveTransactionId(tx: EBTransaction): string {
  const id = tx.entry_reference ?? tx.entryReference ?? tx.transaction_id
  return id != null ? String(id) : ''
}

export function resolveCreditor(tx: EBTransaction): string | undefined {
  if (tx.creditor_name) return String(tx.creditor_name)
  if (typeof tx.creditor === 'string') return tx.creditor
  if (tx.creditor && typeof tx.creditor === 'object' && 'name' in tx.creditor && tx.creditor.name) {
    return String(tx.creditor.name)
  }
  return undefined
}

export function resolveDebtor(tx: EBTransaction): string | undefined {
  if (tx.debtor_name) return String(tx.debtor_name)
  if (typeof tx.debtor === 'string') return tx.debtor
  if (tx.debtor && typeof tx.debtor === 'object' && 'name' in tx.debtor && tx.debtor.name) {
    return String(tx.debtor.name)
  }
  return undefined
}

export function resolveRemittance(tx: EBTransaction): string {
  const rem = tx.remittance_information
  if (!rem) return ''
  if (typeof rem === 'string') return rem.trim()
  if (Array.isArray(rem)) {
    return rem
      .map((r) => {
        if (typeof r === 'string') return r
        if (r && typeof r === 'object') {
          const obj = r as Record<string, unknown>
          if (typeof obj.unstructured === 'string') return obj.unstructured
          if (typeof obj.structured === 'string') return obj.structured
        }
        return ''
      })
      .filter(Boolean)
      .join(' ')
      .trim()
  }
  if (typeof rem === 'object') {
    const obj = rem as Record<string, unknown>
    if (typeof obj.unstructured === 'string') return obj.unstructured.trim()
    if (Array.isArray(obj.unstructured)) return obj.unstructured.join(' ').trim()
    if (typeof obj.structured === 'string') return obj.structured.trim()
  }
  return ''
}
