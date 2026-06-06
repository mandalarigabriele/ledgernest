import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import AuthProvider from '@/components/shared/AuthProvider'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#111418',
}

export const metadata: Metadata = {
  title: 'LedgerNest — Personal Finance',
  description: 'Portfolio e finanza personale',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LedgerNest',
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon', sizes: '180x180' }],
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Blocking script: applies theme class before first paint to prevent white flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var s = localStorage.getItem('ledgernest-settings');
              if (s) {
                var settings = JSON.parse(s).state?.settings;
                var theme = settings?.theme || 'dark';
                if (theme === 'system') {
                  theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                document.documentElement.className = 'ledgernest-theme-' + theme;
                var acc = settings?.accentColor;
                if (acc) document.documentElement.style.setProperty('--accent', acc);
              } else {
                document.documentElement.className = 'ledgernest-theme-dark';
              }
            } catch(e) {
              document.documentElement.className = 'ledgernest-theme-dark';
            }
          })();
        `}} />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
