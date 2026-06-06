import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LedgerNest',
    short_name: 'LedgerNest',
    description: 'Personal finance & portfolio tracker',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#111418',
    theme_color: '#111418',
    orientation: 'portrait',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
