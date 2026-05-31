'use client'

import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

// TradingView requires rgba format with spaces
const THEME_COLORS = {
  dark:  { colorTheme: 'dark'  as const, backgroundColor: 'rgba(13, 15, 17, 1)'   },
  light: { colorTheme: 'light' as const, backgroundColor: 'rgba(240, 242, 245, 1)' },
}

const WIDGET_URL = {
  stocks: 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js',
  crypto: 'https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js',
}

const WIDGET_CONFIG = {
  stocks: {
    exchanges:        [],
    dataSource:       'SPX500',
    grouping:         'sector',
    blockSize:        'market_cap_basic',
    blockColor:       'change',
    hasTopBar:        false,
    isDataSetEnabled: false,
    isZoomEnabled:    true,
    hasSymbolTooltip: true,
    isMonoSize:       false,
  },
  crypto: {
    dataSource:       'Crypto',
    blockSize:        'market_cap_calc',
    blockColor:       'change',
    hasTopBar:        false,
    isDataSetEnabled: false,
    isZoomEnabled:    true,
    hasSymbolTooltip: true,
  },
}

// topbar 56 + page padding 48 + tabs ~40 + gap 20 + buffer 16
const CHROME_HEIGHT = 200

interface Props {
  type: 'stocks' | 'crypto'
}

export default function TradingViewHeatmap({ type }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const settings = useSettingsStore((s) => s.settings)
  const [height, setHeight] = useState(500)

  useEffect(() => {
    const update = () => setHeight(Math.max(400, window.innerHeight - CHROME_HEIGHT))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const resolved =
      settings.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : settings.theme

    const { colorTheme, backgroundColor } = THEME_COLORS[resolved]

    el.innerHTML = ''

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    el.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.src   = WIDGET_URL[type]
    script.async = true
    script.type  = 'text/javascript'
    script.innerHTML = JSON.stringify({
      ...WIDGET_CONFIG[type],
      locale:          settings.locale ?? 'en',
      symbolUrl:       '',
      colorTheme,
      backgroundColor,
      width:           '100%',
      height,
    })

    el.appendChild(script)

    return () => { el.innerHTML = '' }
  }, [settings.theme, settings.locale, type, height])

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{
        width:        '100%',
        height,
        borderRadius: 'var(--radius-lg)',
        border:       '1px solid var(--border-subtle)',
        overflow:     'hidden',
      }}
    />
  )
}
