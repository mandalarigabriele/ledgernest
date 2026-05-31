'use client'

import { useEffect, useRef } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

const BG_DARK  = '#161a1e'
const BG_LIGHT = '#ffffff'

export default function TradingViewHeatmap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const settings = useSettingsStore((s) => s.settings)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const resolved =
      settings.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        : settings.theme

    el.innerHTML = ''

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    widgetDiv.style.height = '100%'
    el.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js'
    script.async = true
    script.type = 'text/javascript'
    script.innerHTML = JSON.stringify({
      exchanges: [],
      dataSource: 'SPX500',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: settings.locale ?? 'en',
      symbolUrl: '',
      colorTheme: resolved,
      backgroundColor: resolved === 'dark' ? BG_DARK : BG_LIGHT,
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: '100%',
      height: '100%',
    })

    el.appendChild(script)

    return () => { el.innerHTML = '' }
  }, [settings.theme, settings.locale])

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ width: '100%', height: 'calc(100vh - 120px)', minHeight: 500 }}
    />
  )
}
