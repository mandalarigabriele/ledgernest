import { useSettingsStore } from '@/stores/settingsStore'
import { usePricesStore } from '@/stores/pricesStore'
import { fmtCurrency, fmtCompact, fmtDelta } from '@/lib/utils/format'
import type { Currency } from '@/types'

const EUR0 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })

/**
 * Returns currency-aware formatting functions that respect the user's
 * display currency setting. EUR values are converted to USD when needed
 * using the live EUR/USD rate from pricesStore.
 */
export function useFormatters() {
  const { settings } = useSettingsStore()
  const { eurUsd } = usePricesStore()

  const currency = settings.currency as Currency
  const rate = currency === 'USD' ? (eurUsd ?? 1.08) : 1

  return {
    /** Format a EUR-denominated value in the user's display currency (2 decimals) */
    fmt: (n: number) => fmtCurrency(n * rate, currency),
    /** Format with no decimal places — for large KPI values */
    fmt0: (n: number) => currency === 'USD' ? USD0.format(n * rate) : EUR0.format(n * rate),
    /** Compact format (e.g. "1.2K") in the user's display currency */
    fmtCpt: (n: number) => fmtCompact(n * rate, currency),
    /** Signed delta format (+/-) in the user's display currency */
    fmtDlt: (n: number) => fmtDelta(n * rate, currency),
    currency,
    symbol: currency === 'USD' ? '$' : '€',
    rate,
  }
}
