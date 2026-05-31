'use client'

import { useEffect, useRef } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

const USES_THEME_KEY = new Set(['advanced-chart'])

const BG: Record<'dark' | 'light', string> = {
  dark:  'rgba(13, 15, 17, 1)',
  light: 'rgba(240, 242, 245, 1)',
}

interface Props {
  widget: string
  config: Record<string, unknown>
  height: number
  style?: React.CSSProperties
}

export default function TradingViewWidget({ widget, config, height, style }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const settings = useSettingsStore((s) => s.settings)
  const configStr = JSON.stringify(config)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const resolved =
      settings.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : settings.theme

    // pick the correct theme key for this widget type
    const themeEntry = USES_THEME_KEY.has(widget)
      ? { theme: resolved }
      : { colorTheme: resolved }

    el.innerHTML = ''

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    el.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.src   = `https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`
    script.async = true
    script.type  = 'text/javascript'
    const width = Math.round(el.getBoundingClientRect().width) || 800

    script.innerHTML = JSON.stringify({
      ...themeEntry,
      backgroundColor: BG[resolved],
      locale: 'en',
      width,
      height,
      ...JSON.parse(configStr),
    })

    el.appendChild(script)

    return () => { el.innerHTML = '' }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme, widget, configStr, height])

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{
        width:    '100%',
        height,
        overflow: 'hidden',
        ...style,
      }}
    />
  )
}
