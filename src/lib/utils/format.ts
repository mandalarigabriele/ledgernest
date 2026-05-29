import type { Currency } from '@/types'

const EUR = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
const PCT = new Intl.NumberFormat('it-IT', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const NUM = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const COMPACT = new Intl.NumberFormat('it-IT', { notation: 'compact', maximumFractionDigits: 1 })

export function fmtCurrency(value: number, currency: Currency = 'EUR'): string {
  if (currency === 'USD') return USD.format(value)
  return EUR.format(value)
}

export function fmtEur(value: number): string {
  return EUR.format(value)
}

export function fmtUsd(value: number): string {
  return USD.format(value)
}

export function fmtPct(value: number, includeSign = true): string {
  const sign = includeSign && value > 0 ? '+' : ''
  return sign + PCT.format(value / 100)
}

export function fmtNum(value: number): string {
  return NUM.format(value)
}

export function fmtCompact(value: number, currency: Currency = 'EUR'): string {
  const c = currency === 'USD' ? '$' : '€'
  if (Math.abs(value) < 1000) return c + Math.round(value).toLocaleString('it-IT')
  return c + COMPACT.format(value)
}

export function fmtDate(dateStr: string, locale = 'it-IT'): string {
  return new Date(dateStr).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateShort(dateStr: string, locale = 'it-IT'): string {
  return new Date(dateStr).toLocaleDateString(locale, { day: '2-digit', month: 'short' })
}

export function fmtDatetime(dateStr: string, locale = 'it-IT'): string {
  return new Date(dateStr).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function fmtQty(value: number): string {
  if (value >= 1000) return NUM.format(value)
  return value.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 8 })
}

export function fmtDelta(value: number, currency: Currency = 'EUR'): string {
  const sign = value >= 0 ? '+' : ''
  return sign + fmtCurrency(value, currency)
}

export function deltaClass(value: number): string {
  if (value > 0) return 'pos'
  if (value < 0) return 'neg'
  return ''
}

export function pctClass(value: number): string {
  if (value > 0) return 'pos'
  if (value < 0) return 'neg'
  return ''
}
