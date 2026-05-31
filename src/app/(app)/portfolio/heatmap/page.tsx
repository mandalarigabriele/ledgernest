'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import TradingViewHeatmap from '@/components/charts/TradingViewHeatmap'

type Tab = 'stocks' | 'crypto'

export default function HeatmapPage() {
  const tl = useTranslations('heatmap')
  const [tab, setTab] = useState<Tab>('stocks')

  return (
    <div className="ledgernest-gap-5">
      <div className="ledgernest-tabs">
        <button
          className={`ledgernest-tab${tab === 'stocks' ? ' active' : ''}`}
          onClick={() => setTab('stocks')}
        >
          {tl('tabStocks')}
        </button>
        <button
          className={`ledgernest-tab${tab === 'crypto' ? ' active' : ''}`}
          onClick={() => setTab('crypto')}
        >
          {tl('tabCrypto')}
        </button>
      </div>

      <TradingViewHeatmap type={tab} />
    </div>
  )
}
