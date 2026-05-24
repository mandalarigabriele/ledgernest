'use client'

interface IconProps {
  name: string
  size?: number
  className?: string
}

const icons: Record<string, (size: number) => React.ReactElement> = {
  dashboard: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity=".9"/>
      <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity=".5"/>
      <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity=".5"/>
      <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity=".9"/>
    </svg>
  ),
  azioni: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M2 14l4-4 3 3 5-6 4 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="16" cy="9" r="1.5" fill="currentColor"/>
    </svg>
  ),
  etf: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="10" r="3" fill="currentColor" opacity=".4"/>
    </svg>
  ),
  crypto: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 6v8M12 6v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M8 6h2.5c1.1 0 1.9.7 1.9 1.7S11.6 9.5 10.5 9.5H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 9.5h3c1.2 0 2 .7 2 1.8S12.2 13 11 13H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  dividendi: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 6v8M7.5 8h4a1.5 1.5 0 010 3H8a1.5 1.5 0 010 3H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  conti: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="5" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 9h16" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="5" y="12" width="3" height="2" rx=".5" fill="currentColor"/>
    </svg>
  ),
  movimenti: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M4 5h12M4 10h8M4 15h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M15 13l3 2-3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  budget: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 4v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  patrimonio: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M2 17L6 9l4 5 3-7 5 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M2 17L6 9l4 5 3-7 5 8H2z" fill="currentColor" opacity=".15"/>
    </svg>
  ),
  obiettivi: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
    </svg>
  ),
  ricorrenti: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M4 8a6 6 0 0110.4-3M16 12a6 6 0 01-10.4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14.5 5l-.1 3-3-.1M5.5 15l.1-3 3 .1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  report: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 7h6M7 11h4M7 15h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  impostazioni: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  heatmap: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="4" height="4" rx="1" fill="currentColor" opacity=".3"/>
      <rect x="8" y="2" width="4" height="4" rx="1" fill="currentColor" opacity=".6"/>
      <rect x="14" y="2" width="4" height="4" rx="1" fill="currentColor" opacity=".9"/>
      <rect x="2" y="8" width="4" height="4" rx="1" fill="currentColor" opacity=".6"/>
      <rect x="8" y="8" width="4" height="4" rx="1" fill="currentColor"/>
      <rect x="14" y="8" width="4" height="4" rx="1" fill="currentColor" opacity=".4"/>
      <rect x="2" y="14" width="4" height="4" rx="1" fill="currentColor" opacity=".9"/>
      <rect x="8" y="14" width="4" height="4" rx="1" fill="currentColor" opacity=".3"/>
      <rect x="14" y="14" width="4" height="4" rx="1" fill="currentColor" opacity=".7"/>
    </svg>
  ),
  screener: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M7 9h4M9 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  sun: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  moon: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M17 11a7 7 0 01-8-8 7 7 0 100 15 7 7 0 008-7z" fill="currentColor" opacity=".2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  bell: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M10 2a6 6 0 00-6 6v4l-1.5 2h15L16 12V8a6 6 0 00-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 16a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  search: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  plus: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  close: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  chevron: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  wallet: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M2 7a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M14 11a1 1 0 110-2 1 1 0 010 2z" fill="currentColor"/>
      <path d="M2 9h16" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  logo: (s) => (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="currentColor"/>
      <path d="M8 22l6-8 4 5 3-4 5 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  trending_up: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M2 14l5-5 3 3 5-6h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 6h4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  trending_down: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M2 6l5 5 3-3 5 6h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 14h4v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  arrow_up: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M10 16V4M4 10l6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  arrow_down: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  refresh: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M4 10a6 6 0 0010.5-4M16 10a6 6 0 01-10.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M4 6v4h4M16 14v-4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  download: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M10 3v10M6 9l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 17h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  upload: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M10 13V3M6 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 17h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  trash: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M4 6h12M8 6V4h4v2M16 6l-1 11H5L4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  edit: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M13 3l4 4-9 9H4v-4l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  check: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M4 10l5 5 7-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  info: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10 9v5M10 7v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  kebab: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="5" r="1.5" fill="currentColor"/>
      <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
      <circle cx="10" cy="15" r="1.5" fill="currentColor"/>
    </svg>
  ),
  hamburger: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  globe: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 10h16M10 2a12 12 0 010 16M10 2a12 12 0 000 16" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  logout: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M8 4H5a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M13 14l3-4-3-4M16 10H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  cart: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M2 3h2l2.4 8.5h9L17 6H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="9" cy="16.5" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="16.5" r="1.5" fill="currentColor"/>
    </svg>
  ),
  home: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 18v-6h4v6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  fork: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M7 2v4a2 2 0 002 2v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 2H5M7 2H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M13 2v5a2 2 0 002 2M13 17V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  cross: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  ),
  briefcase: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="7" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M2 12h16" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  music: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M8 15V5l9-2v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6" cy="15" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="15" cy="13" r="2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  bag: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="7" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 7V6a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  car: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M4 10l1.5-4h9L16 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="2" y="10" width="16" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="6" cy="16.5" r="1.5" fill="currentColor"/>
      <circle cx="14" cy="16.5" r="1.5" fill="currentColor"/>
    </svg>
  ),
  zap: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M11 2L3 12h7l-1 6 8-10h-7l1-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity=".18"/>
    </svg>
  ),
  savings: (s) => (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M16 10a6 6 0 01-9 5.2V17h2v1H8v-1H6v1H4v-1h1v-2.5A6 6 0 1116 10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M13 8.5a1.5 1.5 0 00-3 0c0 1 1.5 1.5 1.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="11.5" cy="13" r=".8" fill="currentColor"/>
    </svg>
  ),
}

export default function Icon({ name, size = 18, className }: IconProps) {
  const render = icons[name]
  if (!render) {
    // Fallback square
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
        <rect x="4" y="4" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    )
  }
  const el = render(size)
  if (className) {
    return <el.type {...el.props} className={className} />
  }
  return el
}
