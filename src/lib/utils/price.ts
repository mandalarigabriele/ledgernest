import type { Quote } from '@/types'

/**
 * Returns the best available EUR price for a position.
 * When showPrePost is true, uses pre-market or post-market price if available.
 */
export function effectivePriceEur(
  q: Quote | undefined,
  fallback: number,
  showPrePost: boolean
): number {
  const close = q?.priceEur ?? q?.price ?? fallback
  if (!showPrePost) return close
  return q?.preMarketEur ?? q?.postMarketEur ?? close
}
