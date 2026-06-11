'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSettingsStore } from '@/stores/settingsStore'

const TABS: { href: string; label: string; matchPrefix?: string; section?: 'portfolio' | null; icon: React.ReactNode }[] = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/portfolio/stocks',
    label: 'Portfolio',
    matchPrefix: '/portfolio',
    section: 'portfolio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
        <polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
  },
  {
    href: '/finance/transactions',
    label: 'Finanze',
    matchPrefix: '/finance',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/finance/shared',
    label: 'Condivisione',
    matchPrefix: '/finance/shared',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Altro',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { settings } = useSettingsStore()

  const visibleTabs = TABS.filter((tab) => {
    if (tab.section === 'portfolio' && settings.hidePortfolio) return false
    return true
  })

  return (
    <nav className="ledgernest-bottom-nav">
      {visibleTabs.map((tab) => {
        const isActive = tab.matchPrefix
          ? pathname.startsWith(tab.matchPrefix)
          : pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`ledgernest-bottom-nav-item${isActive ? ' active' : ''}`}
          >
            {tab.icon}
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
