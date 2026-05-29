'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSession, signOut } from 'next-auth/react'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import Icon from '@/components/shared/Icon'
import type { Locale } from '@/types'

interface NavItem {
  href: string
  icon: string
  labelKey: string
}

const portfolioItems: NavItem[] = [
  { href: '/dashboard',              icon: 'dashboard',  labelKey: 'dashboard' },
  { href: '/portfolio/stocks',       icon: 'azioni',     labelKey: 'azioni' },
  { href: '/portfolio/etf',          icon: 'etf',        labelKey: 'etf' },
  { href: '/portfolio/crypto',       icon: 'crypto',     labelKey: 'crypto' },
  { href: '/portfolio/commodity',    icon: 'commodity',  labelKey: 'commodity' },
  { href: '/portfolio/dividends',    icon: 'dividendi',  labelKey: 'dividendi' },
]

const analisiItems: NavItem[] = [
  { href: '/portfolio/screener',     icon: 'screener',   labelKey: 'screener' },
  { href: '/portfolio/heatmap',      icon: 'heatmap',    labelKey: 'heatmap' },
]

const financeItems: NavItem[] = [
  { href: '/finance/accounts',       icon: 'conti',      labelKey: 'conti' },
  { href: '/finance/transactions',   icon: 'movimenti',  labelKey: 'movimenti' },
  { href: '/finance/budget',         icon: 'budget',     labelKey: 'budget' },
  { href: '/finance/net-worth',      icon: 'patrimonio', labelKey: 'patrimonio' },
  { href: '/finance/goals',          icon: 'obiettivi',  labelKey: 'obiettivi' },
  { href: '/finance/recurring',      icon: 'ricorrenti', labelKey: 'ricorrenti' },
  { href: '/finance/report',         icon: 'report',     labelKey: 'report' },
]

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const { setSidebarOpen } = useUIStore()
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <Link
      href={item.href}
      className={`ledgernest-nav-item${isActive ? ' is-active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => setSidebarOpen(false)}
    >
      <Icon name={item.icon} size={18} />
      <span>{t(item.labelKey)}</span>
    </Link>
  )
}

export default function Sidebar() {
  const t = useTranslations('nav')
  const tc = useTranslations('common')
  const { openModal, sidebarOpen, setSidebarOpen } = useUIStore()
  const { settings, updateSettings } = useSettingsStore()
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user
  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'

  function toggleLocale() {
    const newLocale: Locale = settings.locale === 'it' ? 'en' : 'it'
    updateSettings({ locale: newLocale })
    document.cookie = `ledgernest-locale=${newLocale}; path=/; max-age=31536000`
    window.location.reload()
  }

  return (
    <>
      {sidebarOpen && (
        <div
          className="ledgernest-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    <aside className={`ledgernest-side${sidebarOpen ? ' open' : ''}`}>
      {/* Brand */}
      <div className="ledgernest-brand">
        <div className="ledgernest-logo">
          <Icon name="logo" size={20} />
        </div>
        <div className="ledgernest-brand-text">
          <div className="ledgernest-brand-name">LedgerNest</div>
          <div className="ledgernest-brand-sub">Personale</div>
        </div>
        <button
          className="ledgernest-icon-btn ledgernest-icon-btn--sm"
          onClick={toggleLocale}
          aria-label={settings.locale === 'it' ? 'Switch to English' : 'Passa all\'italiano'}
          title={settings.locale === 'it' ? 'Switch to English' : 'Passa all\'italiano'}
          style={{ fontSize: 14, lineHeight: 1 }}
        >
          {settings.locale === 'it' ? '🇮🇹' : '🇬🇧'}
        </button>
      </div>

      {/* CTA */}
      <button className="ledgernest-cta" onClick={() => openModal('quickAdd')}>
        <Icon name="plus" size={16} />
        <span>{tc('add')}</span>
      </button>

      {/* Nav */}
      <nav className="ledgernest-nav">
        <div className="ledgernest-nav-grp">
          <div className="ledgernest-nav-label">{t('portfolio')}</div>
          {portfolioItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        <div className="ledgernest-nav-grp">
          <div className="ledgernest-nav-label">{t('analisi')}</div>
          {analisiItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        <div className="ledgernest-nav-grp">
          <div className="ledgernest-nav-label">{t('finanze')}</div>
          {financeItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        <div className="ledgernest-nav-grp">
          <div className="ledgernest-nav-label">{t('sistema')}</div>
          <Link
            href="/settings"
            className={`ledgernest-nav-item${pathname === '/settings' ? ' is-active' : ''}`}
            aria-current={pathname === '/settings' ? 'page' : undefined}
          >
            <Icon name="impostazioni" size={18} />
            <span>{t('impostazioni')}</span>
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="ledgernest-side-foot">
        {user?.image ? (
          <img src={user.image} alt={initials} className="ledgernest-avatar" style={{ borderRadius: '50%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
        ) : (
          <div className="ledgernest-avatar">{initials}</div>
        )}
        <div className="ledgernest-side-foot-text">
          <div className="ledgernest-foot-name">{user?.name ?? '…'}</div>
          <div className="ledgernest-foot-sub">{user?.email ?? ''}</div>
        </div>
        <button
          className="ledgernest-icon-btn ledgernest-icon-btn--sm"
          aria-label="Esci"
          title="Esci"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <Icon name="logout" size={16} />
        </button>
      </div>
    </aside>
    </>
  )
}
