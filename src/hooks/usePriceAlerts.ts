'use client'

import { useEffect, useRef } from 'react'
import { usePricesStore } from '@/stores/pricesStore'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { useToastStore } from '@/stores/toastStore'

export function usePriceAlerts() {
  const prevPrices = useRef<Record<string, number>>({})

  useEffect(() => {
    return usePricesStore.subscribe((state) => {
      const { quotes } = state
      const { alerts, markAlertTriggered } = useWatchlistStore.getState()

      for (const alert of alerts) {
        if (!alert.active) continue
        const quote = quotes[alert.ticker]
        if (!quote) continue

        const prev = prevPrices.current[alert.ticker]
        const curr = quote.price

        const triggered =
          alert.direction === 'above'
            ? (prev === undefined || prev < alert.threshold) && curr >= alert.threshold
            : (prev === undefined || prev > alert.threshold) && curr <= alert.threshold

        if (triggered) {
          markAlertTriggered(alert.id)
          useToastStore.getState().push({
            ticker:    alert.ticker,
            threshold: alert.threshold,
            direction: alert.direction,
            price:     curr,
          })
          // mark as triggered in DB
          fetch(`/api/watchlist/alerts/${alert.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: false, triggeredAt: new Date().toISOString() }),
          }).catch(() => {})
          // send email
          fetch('/api/watchlist/alerts/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticker:    alert.ticker,
              threshold: alert.threshold,
              direction: alert.direction,
              price:     curr,
            }),
          }).catch(() => {})
        }
      }

      // update prev prices
      for (const [ticker, q] of Object.entries(quotes)) {
        prevPrices.current[ticker] = q.price
      }
    })
  }, [])
}
