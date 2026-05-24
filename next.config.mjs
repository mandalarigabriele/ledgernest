import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  webpack: (config) => {
    // better-sqlite3 è un modulo nativo CommonJS — deve essere esternalizzato esplicitamente
    config.externals.push({ 'better-sqlite3': 'commonjs better-sqlite3' })
    // yahoo-finance2 è ESM-only: gestito da serverComponentsExternalPackages,
    // NON va aggiunto come commonjs external altrimenti webpack prova require() e blocca il build
    return config
  },
}

export default withNextIntl(nextConfig)
