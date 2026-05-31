'use client'

import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { useFinanceStore } from '@/stores/financeStore'
import { useServerSync } from '@/hooks/useServerSync'
import { usePortfolioSnapshot } from '@/hooks/usePortfolioSnapshot'
import { usePriceAlerts } from '@/hooks/usePriceAlerts'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import BottomNav from '@/components/layout/BottomNav'
import SearchPalette from '@/components/shared/SearchPalette'
import ModalHost from '@/components/shared/ModalHost'
import OnboardingWizard from '@/components/shared/OnboardingWizard'
import AlertToastHost from '@/components/shared/AlertToastHost'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { settings } = useSettingsStore()
  const { searchOpen, sidebarOpen, setSearchOpen, openModal } = useUIStore()
  const { accounts } = useFinanceStore()
  const [mounted, setMounted] = useState(false)
  useServerSync()
  usePortfolioSnapshot()
  usePriceAlerts()

  useEffect(() => { setMounted(true) }, [])

  const needsOnboarding = mounted && accounts.length === 0

  // Apply all appearance settings
  useEffect(() => {
    const root = document.documentElement

    // Theme + utility classes
    const theme = settings.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : settings.theme
    const classes = [`ledgernest-theme-${theme}`]
    if (settings.animations === false) classes.push('no-animations')
    if (settings.showLargeNumbers) classes.push('large-numbers')
    if (settings.hideSensitiveAmounts) classes.push('hide-amounts')
    root.className = classes.join(' ')

    // Accent color + derived tokens
    const acc = settings.accentColor ?? '#5bc8d0'
    const r = parseInt(acc.slice(1, 3), 16)
    const g = parseInt(acc.slice(3, 5), 16)
    const b = parseInt(acc.slice(5, 7), 16)
    root.style.setProperty('--accent', acc)
    root.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.15)`)
    root.style.setProperty('--accent-hover', `color-mix(in srgb, ${acc} 85%, white)`)
    root.style.setProperty('--accent-strong', `color-mix(in srgb, ${acc} 80%, black)`)

    // Font
    const fonts: Record<string, string> = {
      inter:      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      monospace:  "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace",
      system:     '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }
    root.style.fontFamily = fonts[settings.font ?? 'inter']

    // Sidebar color + adaptive text tokens
    const SB_VARS = ['--sidebar-bg','--sb-text','--sb-text-muted','--sb-hover','--sb-active','--sb-border']
    if (settings.sidebarColor) {
      const sr = parseInt(settings.sidebarColor.slice(1,3),16)
      const sg = parseInt(settings.sidebarColor.slice(3,5),16)
      const sb = parseInt(settings.sidebarColor.slice(5,7),16)
      const lum = 0.299*sr + 0.587*sg + 0.114*sb
      const isLight = lum > 140
      root.style.setProperty('--sidebar-bg',    settings.sidebarColor)
      root.style.setProperty('--sb-text',       isLight ? 'rgba(10,12,16,0.90)' : 'rgba(255,255,255,0.92)')
      root.style.setProperty('--sb-text-muted', isLight ? 'rgba(10,12,16,0.45)' : 'rgba(255,255,255,0.42)')
      root.style.setProperty('--sb-hover',      isLight ? 'rgba(0,0,0,0.06)'    : 'rgba(255,255,255,0.08)')
      root.style.setProperty('--sb-active',     isLight ? 'rgba(0,0,0,0.10)'    : 'rgba(255,255,255,0.13)')
      root.style.setProperty('--sb-border',     isLight ? 'rgba(0,0,0,0.07)'    : 'rgba(255,255,255,0.07)')
    } else {
      SB_VARS.forEach(v => root.style.removeProperty(v))
    }
  }, [settings])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K → search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      // Cmd+N → add movement
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        openModal('movement')
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [setSearchOpen, openModal])

  return (
    <div className="ledgernest-app">
      <Sidebar />
      <div className="ledgernest-main">
        <Topbar />
        <main className="ledgernest-page ledgernest-animate-in">
          {mounted && children}
        </main>
      </div>

      {searchOpen && <SearchPalette />}
      <ModalHost />

      {needsOnboarding && <OnboardingWizard />}
      <AlertToastHost />

      {/* Bottom navigation — mobile only */}
      <BottomNav />
    </div>
  )
}
