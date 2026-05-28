// Pure CSV parsing logic — no React deps

export type DetectedFormat = 'traderepublic' | 'creditagricole' | 'unknown'

export interface ParsedTransaction {
  kind: 'transaction'
  sourceId: string
  date: string
  description: string
  merchant?: string
  originalDescription: string
  amount: number
  type: 'income' | 'expense' | 'transfer'
  suggestedCategory: string
  include: boolean
  isDuplicate: boolean
}

export interface ParsedTrade {
  kind: 'trade'
  sourceId: string
  date: string
  name: string
  isin: string
  ticker: string
  assetType: 'stock' | 'etf' | 'crypto' | 'commodity'
  quantity: number
  price: number
  amount: number
  commission: number
  currency: 'EUR'
  isFreeReceipt: boolean
  include: boolean
  originalDescription: string
  tickerConfirmed?: boolean
}

export type ParsedRow = ParsedTransaction | ParsedTrade

// ── ISIN → ticker lookup ─────────────────────────────────────

const ISIN_LOOKUP: Record<string, string> = {
  'US67066G1040': 'NVDA',
  'US90353T1007': 'UBER',
  'US83406F1021': 'SOFI',
  'US81762P1021': 'NOW',
  'US3168411052': 'FIG',
  'IE00B579F325': 'SGLD',
  'IE00BMVB5R75': 'V80A',
  'US0231351067': 'AMZN',
  'US5949181045': 'MSFT',
  'US0378331005': 'AAPL',
  'US02079K3059': 'GOOGL',
  'US30303M1027': 'META',
  'US88160R1014': 'TSLA',
  'US78462F1030': 'SPY',
  'IE00B4L5Y983': 'IWDA',
  'IE00B3XXRP09': 'VUSA',
  'LU0908500753': 'LGQV',
  'IE00B4ND3602': 'SXRV',
  'US46090E1038': 'IVV',
  'US9229087690': 'VTI',
  'US9220427424': 'VT',
}

// ── Category detection ───────────────────────────────────────

const MCC_CATEGORY: Record<string, string> = {
  '5411': 'Spesa', '5412': 'Spesa',
  '5541': 'Carburante', '5542': 'Carburante',
  '5812': 'Ristoranti', '5813': 'Ristoranti', '5814': 'Caffè',
  '5734': 'Elettronica', '5211': 'Casa e arredo', '0780': 'Casa e arredo',
  '5945': 'Shopping', '5311': 'Shopping', '5999': 'Shopping',
  '5651': 'Abbigliamento',
  '4814': 'Utenze', '4900': 'Utenze',
  '5912': 'Sanità',
  '7011': 'Viaggi', '4511': 'Viaggi',
  '5251': 'Casa e arredo',
}

const CAUSALE_DEFAULTS: Record<string, { cat: string; type: 'income' | 'expense' | 'transfer' }> = {
  'VERSAMENTO CONTANTE/ASSEGNI': { cat: 'Stipendio', type: 'income' },
  'PAGAMENTO TRAMITE POS': { cat: 'Shopping', type: 'expense' },
  'PAGAMENTO UTENZE': { cat: 'Utenze', type: 'expense' },
  'PAGAMENTO RATE FINANZIAMENTO': { cat: 'Mutuo', type: 'expense' },
  'ADDEB. CANONI LOCAZ./PREMI ASSIC.': { cat: 'Assicurazioni', type: 'expense' },
  'GIROCONTO/BONIFICO': { cat: 'Trasferimenti', type: 'transfer' },
  'DISPOSIZIONE DI PAGAMENTO': { cat: 'Trasferimenti', type: 'transfer' },
  'ACCREDITO BONIFICO': { cat: 'Stipendio', type: 'income' },
  'ACCREDITO STIPENDIO': { cat: 'Stipendio', type: 'income' },
}

interface KeywordRule {
  kw: string[]
  cat: string
  type: 'income' | 'expense' | 'transfer'
}

const KEYWORD_RULES: KeywordRule[] = [
  { kw: ['netflix', 'spotify', 'prime video', 'apple.com', 'claude', 'amazon music', 'disney+', 'hbo', 'paramount', 'dazn', 'sky '], cat: 'Intrattenimento', type: 'expense' },
  { kw: ['amazon', 'amzn'], cat: 'Shopping', type: 'expense' },
  { kw: ['esselunga', 'coop ', 'lidl', 'conad', 'aldi', 'eurospin', 'carrefour', 'pam ', 'penny', 'tigros', 'bennet', 'iper '], cat: 'Spesa', type: 'expense' },
  { kw: ['supermercato', 'supermarket'], cat: 'Spesa', type: 'expense' },
  { kw: ['eni ', 'shell ', 'agip', 'q8', 'tamoil', 'ip ', 'carburante', 'benzina'], cat: 'Carburante', type: 'expense' },
  { kw: ['mutuo', 'finanziamento', 'rata'], cat: 'Mutuo', type: 'expense' },
  { kw: ['polizza', 'assicurazione', 'premio assicurativo', 'zurich', 'allianz', 'generali'], cat: 'Assicurazioni', type: 'expense' },
  { kw: ['satispay', 'paypal', 'revolut', 'wise', 'monzo'], cat: 'Trasferimenti', type: 'transfer' },
  { kw: ['trade republic'], cat: 'Trasferimenti', type: 'transfer' },
  { kw: ['directa', 'fineco', 'degiro', 'mediolanum'], cat: 'Azioni', type: 'expense' },
  { kw: ['ikea', 'leroy merlin', 'bricofer', 'brico'], cat: 'Casa e arredo', type: 'expense' },
  { kw: ['farmacia', 'farmacie', 'farmaci'], cat: 'Sanità', type: 'expense' },
  { kw: ['stipendio', 'salary', 'accredito stipendio', 'busta paga'], cat: 'Stipendio', type: 'income' },
  { kw: ['versamento contanti', 'versamento contante'], cat: 'Stipendio', type: 'income' },
  { kw: ['rimborso', 'restituzione'], cat: 'Rimborsi', type: 'income' },
  { kw: ['dividendo', 'dividend'], cat: 'Dividendi', type: 'income' },
  { kw: ['ristorante', 'pizza ', 'sushi', 'trattoria', 'osteria', 'bar ', 'caffè', 'caffe ', 'gelateria', 'kebab'], cat: 'Ristoranti', type: 'expense' },
  { kw: ['hotel', 'airbnb', 'booking.com', 'expedia', 'ryanair', 'easyjet', 'trenitalia', 'italo', 'flixbus'], cat: 'Viaggi', type: 'expense' },
  { kw: ['prelievo', 'bancomat', 'atm prelievo'], cat: 'Spese personali', type: 'expense' },
  { kw: ['telefon', 'internet', 'tim ', 'vodafone', 'windtre', 'fastweb', 'enel ', 'a2a ', 'hera ', 'iren '], cat: 'Utenze', type: 'expense' },
  { kw: ['elettricità', 'gas', 'acqua '], cat: 'Utenze', type: 'expense' },
]

// ── Brand normalization ──────────────────────────────────────

const BRAND_ALIASES: Record<string, string> = {
  // Streaming / Digital
  'spotifyit':                'Spotify',
  'spotify ab':               'Spotify',
  'netflix.com los':          'Netflix',
  'netflix.com':              'Netflix',
  'apple.com/bill':           'Apple',
  'apple services':           'Apple',
  'apple.com':                'Apple',
  'prime video':              'Amazon Prime Video',
  'primevideo':               'Amazon Prime Video',
  'negozio prime video':      'Amazon Prime Video',
  'amazon music':             'Amazon Music',
  'disney+':                  'Disney+',
  'disneyplus':               'Disney+',
  'dazn':                     'DAZN',
  'youtube premium':          'YouTube Premium',
  'chatgpt':                  'ChatGPT',
  'openai':                   'OpenAI',
  'claude.ai subscription':   'Claude.ai',
  'claude.ai':                'Claude.ai',
  'microsoft 365':            'Microsoft 365',
  'microsoft':                'Microsoft',
  // Shopping
  'amzn mktp it':             'Amazon',
  'amzn mktp de':             'Amazon',
  'amzn mktp':                'Amazon',
  'amazon.it':                'Amazon',
  'amazon':                   'Amazon',
  'ikea':                     'IKEA',
  'leroy merlin':             'Leroy Merlin',
  'feltrinelli':              'Feltrinelli',
  // Pagamenti digitali
  'paypal':                   'PayPal',
  'satispay':                 'Satispay',
  'google pay':               'Google Pay',
  'gpay':                     'Google Pay',
  'revolut':                  'Revolut',
  'wise':                     'Wise',
  'pag.rata':                 'Pag.rata',
  'pagrata':                  'Pag.rata',
  // Carburante
  'eni autostrade':           'Eni',
  'eni rete':                 'Eni',
  'q8 easy':                  'Q8',
  // Telecom
  'tim ict':                  'TIM',
  'tim s.p':                  'TIM',
  'vodafone italia':          'Vodafone',
  'windtre':                  'WindTre',
  'fastweb':                  'Fastweb',
  // Travel / Mobility
  'ryanair':                  'Ryanair',
  'booking.com':              'Booking.com',
  'airbnb':                   'Airbnb',
  'trenitalia':               'Trenitalia',
  'italo treno':              'Italo',
  'flixbus':                  'FlixBus',
  'uber':                     'Uber',
  // Food delivery
  'glovo':                    'Glovo',
  'deliveroo':                'Deliveroo',
  'justeat':                  'JustEat',
  'just eat':                 'JustEat',
}

const BRAND_ALIASES_SORTED = Object.entries(BRAND_ALIASES)
  .sort((a, b) => b[0].length - a[0].length)

function normalizeBrand(name: string): string {
  const lower = name.toLowerCase()
  for (const [alias, canonical] of BRAND_ALIASES_SORTED) {
    if (lower === alias || lower.startsWith(alias + ' ') || lower.startsWith(alias + '/') || lower.startsWith(alias + '.')) {
      return canonical
    }
  }
  return name
}

// Favicon domain per brand canonico — usato per auto-caricare logo
export const BRAND_FAVICON_DOMAINS: Record<string, string> = {
  'Spotify':              'spotify.com',
  'Netflix':              'netflix.com',
  'Amazon':               'amazon.it',
  'Amazon Prime Video':   'primevideo.com',
  'Amazon Music':         'music.amazon.it',
  'Apple':                'apple.com',
  'PayPal':               'paypal.com',
  'Satispay':             'satispay.com',
  'Revolut':              'revolut.com',
  'Wise':                 'wise.com',
  'Google Pay':           'pay.google.com',
  'Disney+':              'disneyplus.com',
  'DAZN':                 'dazn.com',
  'YouTube Premium':      'youtube.com',
  'ChatGPT':              'chatgpt.com',
  'OpenAI':               'openai.com',
  'Microsoft 365':        'microsoft.com',
  'Microsoft':            'microsoft.com',
  'TIM':                  'tim.it',
  'Vodafone':             'vodafone.it',
  'WindTre':              'windtre.it',
  'Fastweb':              'fastweb.it',
  'Eni':                  'eni.com',
  'Q8':                   'q8.it',
  'Ryanair':              'ryanair.com',
  'Booking.com':          'booking.com',
  'Airbnb':               'airbnb.com',
  'Trenitalia':           'trenitalia.com',
  'Italo':                'italotreno.it',
  'FlixBus':              'flixbus.it',
  'Uber':                 'uber.com',
  'Glovo':                'glovoapp.com',
  'Deliveroo':            'deliveroo.it',
  'JustEat':              'justeat.it',
  'Claude.ai':            'claude.ai',
  'IKEA':                 'ikea.com',
  'Leroy Merlin':         'leroymerlin.it',
  'Feltrinelli':          'lafeltrinelli.it',
  'Pag.rata':             'pagrata.it',
}

// ── Merchant name cleanup ────────────────────────────────────

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-''(])(\S)/g, (_, sep, c) => sep + c.toUpperCase())
}

function cleanMerchant(raw: string): string | undefined {
  if (!raw.trim()) return undefined
  let s = raw.trim()

  // SDD (SEPA Direct Debit): "SDD A : Satispay Europe S.a. Ricarica Dell App Sat"
  const sddMatch = s.match(/^SDD\s+[A-Z]+\s*:\s*(.+)$/i)
  if (sddMatch) {
    let m = sddMatch[1].trim()
    // Strip legal entity suffixes + everything after (use \s+ not \b to avoid matching inside names)
    m = m.replace(/\s+(?:et\s+cie|s\.?c\.?a\.?|s\.?a\.?r\.?l\.?|s\.?p\.?a\.?|s\.?r\.?l\.?|s\.?a\.?|ltd\.?|gmbh|inc\.?|b\.?v\.?|s\.c\.s\.?)\s*.*/gi, '').trim()
    // Strip parenthetical geo qualifiers: "(europe)" "(italia)"
    m = m.replace(/\s*\([^)]*\)/gi, '').trim()
    const normalized = normalizeBrand(m)
    return (normalized !== m ? normalized : toTitleCase(m)).slice(0, 50) || undefined
  }

  // Credit Agricole POS format — extract what's after C/O, strip trailing "{CITY} {3-LETTER-COUNTRY}"
  const coMatch = s.match(/\bC\/O\s+(.+)$/i)
  if (coMatch) {
    let m = coMatch[1].trim()
    m = m.replace(/\s+\S+\s+[A-Z]{3}$/i, '').trim()
    m = m.replace(/\s+\d{4,}$/, '').trim()   // strip trailing station/ref codes
    const normalized = normalizeBrand(m)
    return (normalized !== m ? normalized : toTitleCase(m)).slice(0, 50) || undefined
  }

  // Discard card-header lines with no C/O — no merchant info extractable
  if (/^(?:AFT|ADT|POS)\s+CARTA/i.test(s)) return undefined

  // Strip leading numeric bank reference codes (e.g. "00760 MANDALARI GABRIELE")
  s = s.replace(/^\d{4,6}\s+/, '')

  // ORD: prefix — strip and truncate at DT.ORD / DESCR.
  if (/^ORD[:.]/i.test(s)) {
    s = s.replace(/^ORD[:.]\s*/i, '')
    s = s.replace(/\s+(?:DT\.ORD|DESCR\.)\S*.*$/i, '').trim()
  }

  // Italian banking verb prefixes
  s = s.replace(/^(?:pagamento\s+(?:tramite\s+)?(?:pos|carta[^-]*)[-–]?\s*)/i, '')
  s = s.replace(/^(?:acquisto\s+(?:presso\s+)?)/i, '')
  s = s.replace(/^(?:bonifico\s+(?:da|a|per)\s+|accredito\s+da\s+|disposizione\s+a\s+)/i, '')

  // Trailing card-number refs: "N. ****1455" or "N. 1234"
  s = s.replace(/\s+N\.\s*\**\d+.*/i, '')
  // Trailing date/time: "DEL 14/05/26 ORE 17:52"
  s = s.replace(/\s+DEL\s+\d{2}[/\-]\d{2}[/\-]\d{2,4}.*/i, '')
  // Trailing multi-asterisk codes (with or without leading space): "Revolut**7778*"
  s = s.replace(/\s*\*{2,}\d+\**$/, '').trim()
  // Inline asterisk card-number patterns no space: "Revolut**7778*" after prefix strip
  s = s.replace(/\*+[\d*]+$/, '').trim()
  // Trailing 4+ digit codes (station IDs, etc.)
  s = s.replace(/\s+\*?\d{4,}.*$/, '')
  // Legal entity suffixes (e.g. "Avanade Italy S.r.l.")
  s = s.replace(/\s*(?:et\s+cie|s\.?c\.?a\.?|s\.?a\.?r\.?l\.?|s\.?p\.?a\.?|s\.?r\.?l\.?|s\.?a\.?|ltd\.?|gmbh|inc\.?|b\.?v\.?)\s*\.?\s*$/gi, '').trim()
  // Trailing apostrophe-dash noise: "MERCATO' -" → "MERCATO"
  s = s.replace(/['']\s*[-–]?\s*$/, '').trim()
  // Trailing punctuation residua
  s = s.replace(/[-–,;:\s]+$/, '').trim()

  s = s.replace(/\s{2,}/g, ' ').trim()
  if (s.length < 2) return undefined

  // Title-case if the input came in ALL CAPS (Credit Agricole exports)
  if (s === s.toUpperCase()) s = toTitleCase(s)

  // Brand normalization — use verbatim to preserve canonical casing (e.g. "PayPal", "DAZN")
  const normalized = normalizeBrand(s)
  if (normalized !== s) return normalized.slice(0, 50) || undefined

  return s.slice(0, 50) || undefined
}

// ── Simple hash for dedup IDs ────────────────────────────────

function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

// ── CSV helpers ──────────────────────────────────────────────

function parseLine(line: string, sep: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseRows(text: string, sep: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = parseLine(lines[0], sep)
  const rows = lines.slice(1).map((line) => {
    const vals = parseLine(line, sep)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
  return { headers, rows }
}

// ── Public API ───────────────────────────────────────────────

export function detectFormat(text: string): DetectedFormat {
  const sample = text.slice(0, 600).toLowerCase()
  if (sample.includes('transaction_id') && sample.includes('asset_class')) return 'traderepublic'
  if (sample.includes('data op') || (sample.includes('causale') && sample.includes('divisa'))) return 'creditagricole'
  return 'unknown'
}

export function guessTicker(isin: string, _name: string): string {
  return ISIN_LOOKUP[isin] ?? ''
}

export function guessCategory(
  description: string,
  mcc?: string,
  causale?: string
): { cat: string; type: 'income' | 'expense' | 'transfer' } {
  const desc = description.toLowerCase()

  // 1. Keyword rules (highest priority)
  for (const rule of KEYWORD_RULES) {
    if (rule.kw.some((kw) => desc.includes(kw))) {
      return { cat: rule.cat, type: rule.type }
    }
  }

  // 2. MCC code
  if (mcc && MCC_CATEGORY[mcc]) {
    return { cat: MCC_CATEGORY[mcc], type: 'expense' }
  }

  // 3. Causale (Credit Agricole)
  if (causale) {
    const upper = causale.toUpperCase()
    for (const [key, val] of Object.entries(CAUSALE_DEFAULTS)) {
      if (upper.includes(key) || key.includes(upper)) return val
    }
  }

  return { cat: 'Spese personali', type: 'expense' }
}

// ── Trade Republic parser ────────────────────────────────────

function parseDatetime(dt: string): string {
  return dt.slice(0, 10)
}

function parseTR(text: string, existingNotes: string[]): ParsedRow[] {
  const { rows } = parseRows(text, ',')
  const result: ParsedRow[] = []

  for (const row of rows) {
    const type = row['type']?.trim()
    const assetClass = row['asset_class']?.trim()
    const name = row['name']?.trim() ?? ''
    const symbol = row['symbol']?.trim() ?? ''
    const sharesStr = row['shares']?.trim() ?? ''
    const priceStr = row['price']?.trim() ?? ''
    const amountStr = row['amount']?.trim() ?? ''
    const feeStr = row['fee']?.trim() ?? ''
    const txId = row['transaction_id']?.trim() ?? ''
    const mcc = row['mcc_code']?.trim() ?? ''
    const datetime = (row['datetime']?.trim() || row['date']?.trim()) ?? ''
    const date = parseDatetime(datetime)

    if (!type) continue

    const sourceId = txId || simpleHash(datetime + amountStr + (name || type))
    const isDuplicate = existingNotes.some((n) => n?.includes(`[import:${sourceId}]`))
    const originalDescription = [type, name, symbol].filter(Boolean).join(' ')

    if (type === 'TRANSFER_INSTANT_INBOUND') {
      const amount = Math.abs(parseFloat(amountStr) || 0)
      const { cat } = guessCategory(name || type)
      result.push({
        kind: 'transaction', sourceId, date,
        description: name || 'Accredito',
        merchant: name || undefined,
        originalDescription, amount,
        type: 'income',
        suggestedCategory: cat === 'Spese personali' ? 'Stipendio' : cat,
        include: !isDuplicate, isDuplicate,
      })
    } else if (type === 'TRANSFER_OUTBOUND' || type === 'TRANSFER_INSTANT_OUTBOUND') {
      const amount = Math.abs(parseFloat(amountStr) || 0)
      result.push({
        kind: 'transaction', sourceId, date,
        description: name || 'Trasferimento uscita',
        merchant: name || undefined,
        originalDescription, amount,
        type: 'transfer',
        suggestedCategory: 'Trasferimenti',
        include: !isDuplicate, isDuplicate,
      })
    } else if (type === 'CARD_TRANSACTION' || type === 'CARD_TRANSACTION_INTERNATIONAL') {
      const amount = Math.abs(parseFloat(amountStr) || 0)
      const { cat, type: txType } = guessCategory(name, mcc, undefined)
      result.push({
        kind: 'transaction', sourceId, date,
        description: name || 'Pagamento carta',
        merchant: name || undefined,
        originalDescription, amount, type: txType,
        suggestedCategory: cat,
        include: !isDuplicate, isDuplicate,
      })
    } else if (type === 'BUY' || type === 'SAVINGS_PLAN_EXECUTE') {
      const quantity = parseFloat(sharesStr) || 0
      const price = parseFloat(priceStr) || 0
      const amount = Math.abs(parseFloat(amountStr) || 0)
      const commission = Math.abs(parseFloat(feeStr) || 0)

      let assetType: 'stock' | 'etf' | 'crypto' | 'commodity' = 'stock'
      if (assetClass === 'CRYPTO') assetType = 'crypto'
      else if (assetClass === 'FUND') assetType = 'etf'
      else if (assetClass === 'COMMODITY') assetType = 'commodity'

      const isin = assetClass !== 'CRYPTO' ? symbol : ''
      const ticker = assetClass === 'CRYPTO' ? symbol : guessTicker(symbol, name)

      result.push({
        kind: 'trade', sourceId, date,
        name, isin, ticker, assetType,
        quantity, price, amount, commission,
        currency: 'EUR', isFreeReceipt: false,
        include: !isDuplicate, originalDescription,
      })
    } else if (type === 'FREE_RECEIPT' && assetClass === 'CRYPTO') {
      const quantity = parseFloat(sharesStr) || 0
      result.push({
        kind: 'trade', sourceId, date,
        name, isin: '', ticker: symbol, assetType: 'crypto',
        quantity, price: 0, amount: 0, commission: 0,
        currency: 'EUR', isFreeReceipt: true,
        include: !isDuplicate, originalDescription,
      })
    } else if (type === 'INTEREST' || type === 'BONUS') {
      const amount = Math.abs(parseFloat(amountStr) || 0)
      result.push({
        kind: 'transaction', sourceId, date,
        description: type === 'INTEREST' ? 'Interessi' : name || 'Bonus',
        originalDescription, amount, type: 'income',
        suggestedCategory: 'Rendite',
        include: !isDuplicate, isDuplicate,
      })
    }
    // Silently skip: DIVIDEND (handled by portfolio), SELL, unknown types
  }

  return result
}

// ── Credit Agricole parser ───────────────────────────────────

function parseItalianAmount(raw: string): number {
  // Strip leading apostrophe (Excel artifact for negative numbers)
  // Italian format: 1.234,56 (dot=thousands, comma=decimal)
  const cleaned = raw.replace(/^'/, '').replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

function parseCADate(raw: string): string {
  // DD/MM/YYYY → YYYY-MM-DD
  const parts = raw.split('/')
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }
  return raw
}

function parseCA(text: string, existingNotes: string[]): ParsedRow[] {
  const { rows } = parseRows(text, ';')
  const result: ParsedRow[] = []

  for (const row of rows) {
    // Handle BOM and header variations
    const dateRaw = (row['Data Op.'] ?? row['﻿Data Op.'] ?? '').trim()
    const causale = (row['Causale'] ?? '').trim()
    const descRaw = (row['Descrizione'] ?? '').trim()
    const importoRaw = (row['Importo'] ?? '').trim()

    if (!dateRaw || !importoRaw) continue

    const date = parseCADate(dateRaw)
    const rawAmount = parseItalianAmount(importoRaw)
    const amount = Math.abs(rawAmount)

    if (amount === 0) continue

    const isNegative = rawAmount < 0
    const sourceId = simpleHash(date + importoRaw + descRaw)
    const isDuplicate = existingNotes.some((n) => n?.includes(`[import:${sourceId}]`))
    const originalDescription = [causale, descRaw].filter(Boolean).join(' ')

    const merchant = descRaw ? cleanMerchant(descRaw) : undefined
    // Use cleaned merchant name as description when available — raw descRaw drives category guessing
    const description = merchant || descRaw || causale || 'Movimento'

    const { cat, type: guessedType } = guessCategory(descRaw || causale || 'Movimento', undefined, causale)

    let type: 'income' | 'expense' | 'transfer'
    if (guessedType === 'transfer') {
      type = 'transfer'
    } else {
      type = isNegative ? 'expense' : 'income'
    }

    result.push({
      kind: 'transaction', sourceId, date,
      description, merchant, originalDescription, amount, type,
      suggestedCategory: cat,
      include: !isDuplicate, isDuplicate,
    })
  }

  return result
}

// ── Retroactive merchant normalizer ─────────────────────────
// Works on already-parsed merchant names (not raw CSV text).

export function normalizeMerchantName(name: string): string {
  if (!name.trim()) return name
  let s = name.trim()
  // Card-number asterisk patterns: "Revolut**7778*" → "Revolut"
  s = s.replace(/\*+[\d*]+\**$/, '').trim()
  // Trailing numeric codes: "ENI 00587" → "ENI"
  s = s.replace(/\s+\d{4,}$/, '').trim()
  // Trailing apostrophe-dash noise: "MERCATO' -" → "MERCATO"
  s = s.replace(/['']\s*[-–]?\s*$/, '').trim()
  // Trailing punctuation
  s = s.replace(/[-–,;:\s]+$/, '').trim()
  // Legal entity suffixes: "Avanade Italy S.r.l." → "Avanade Italy"
  s = s.replace(/\s*(?:et\s+cie|s\.?c\.?a\.?|s\.?a\.?r\.?l\.?|s\.?p\.?a\.?|s\.?r\.?l\.?|s\.?a\.?|ltd\.?|gmbh|inc\.?|b\.?v\.?)\s*\.?\s*$/gi, '').trim()
  s = s.replace(/\s{2,}/g, ' ').trim()
  if (s.length < 2) return name
  // All-caps → title case
  if (s === s.toUpperCase()) s = toTitleCase(s)
  // Brand normalization (verbatim to preserve canonical casing)
  const normalized = normalizeBrand(s)
  if (normalized !== s) return normalized.slice(0, 50)
  return s.slice(0, 50)
}

// ── Main entry ───────────────────────────────────────────────

export function parseCSV(text: string, format: DetectedFormat, existingNotes: string[]): ParsedRow[] {
  if (format === 'traderepublic') return parseTR(text, existingNotes)
  if (format === 'creditagricole') return parseCA(text, existingNotes)
  return []
}
