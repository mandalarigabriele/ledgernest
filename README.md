<div align="center">

# 🪺 LedgerNest

**Personal finance dashboard — portfolio, budget, net worth and cashflow in one place.**

![Version](https://img.shields.io/badge/version-0.3.5-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![License](https://img.shields.io/badge/license-private-lightgrey)

</div>

---

## ✨ Features

### 📊 Dashboard
- Real-time net worth with interactive chart (Total / Investments / Liquidity / Expenses)
- Time ranges: 1W · 1M · 3M · 6M · 1Y · MAX
- KPI strip: net worth, investments, liquidity, monthly savings, P&L, expenses
- Portfolio allocation (donut chart), last-6-months cashflow
- Performance heatmap, position treemap, dividend calendar

### 💼 Portfolio
- **Stocks** — live prices from Yahoo Finance, per-position P&L, 60-day sparklines, sectors
- **ETF** — TER, regional exposure, historical chart, EUR/USD-corrected P&L
- **Crypto** — live prices from CoinGecko, historical charts
- Automatic EUR/USD exchange-rate correction on average cost basis

### 🏦 Finances
- **Accounts** — bank accounts, brokers, crypto wallets with aggregated balance
- **Transactions** — merchant logo, categories, CSV import
- **Budget** — monthly planning by group/category, planned vs actual comparison
- **Recurring** — recurring income and expenses with annual projection
- **Goals** — savings targets with progress tracking
- **Net Worth** — historical net worth with assets and liabilities
- **Report** — expense analysis by category, month over month

### ⚙️ Settings
- **Appearance** — dark/light theme, 8 colour themes, density (comfortable/normal/compact), font
- **Profile** — language (EN/IT), currency display, account holder name for transfer detection
- **Categories** — full category/subcategory manager with emoji, colour and group assignment
- **Merchants** — logo management, name normalisation, merchant merge/alias rules
- **Markets** — price refresh interval, pre/post market display, portfolio visibility
- **Data** — CSV import, portfolio reset, full data reset

### 🌐 Internationalisation
- Full EN/IT support via `next-intl`
- All UI strings in locale files — zero hardcoded text in components
- Language switcher in Settings → Profile

### 🔒 Authentication
- Google OAuth via NextAuth v4
- Configurable email whitelist (only authorised addresses can log in)

### 📱 Mobile-first
- Fully responsive layout
- Bottom navigation bar on mobile
- Charts and tables with intelligent horizontal scroll

---

## 🛠 Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | SQLite via `better-sqlite3` |
| Auth | NextAuth v4 + Google OAuth |
| State | Zustand (client-side, persistent) |
| i18n | next-intl (EN / IT) |
| Prices | Yahoo Finance (`yahoo-finance2`), CoinGecko |
| UI | Custom CSS (no Tailwind), native SVG charts |

---

## 🚀 Quick start (local development)

```bash
# 1. Clone
git clone https://github.com/mandalarigabriele/ledgernest.git
cd ledgernest

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# → edit .env.local with your credentials

# 4. Initialise the database
npm run db:migrate

# 5. Start
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🔧 Environment variables

Copy `.env.example` → `.env.local` and fill in:

| Variable | Description |
|---|---|
| `NEXTAUTH_URL` | Public URL of the app (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Random string — generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Client Secret from Google Cloud Console |
| `ALLOWED_EMAILS` | Comma-separated list of authorised email addresses |

### Configuring Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → **APIs & Services → Credentials → Create OAuth 2.0 Client**
3. Type: **Web application**
4. Authorized redirect URIs: `http://YOUR-HOST:3000/api/auth/callback/google`
5. Copy Client ID and Client Secret into `.env.local`

---

## 🖥 Deploy on a Linux server (Proxmox / LXC / VPS)

> **Prerequisites:** Node.js ≥ 20, PM2 (`npm install -g pm2`)

### First install (manual)

```bash
# 1. Clone on the server
git clone https://github.com/mandalarigabriele/ledgernest.git
cd ledgernest

# 2. Configure environment
cp .env.example .env.local
nano .env.local   # fill in your real values

# 3. First deploy
bash deploy.sh --init
```

### `deploy.sh` — automated deploy script

The repo ships a `deploy.sh` script that handles the full deploy lifecycle.  
Run it from the repo root on the server.

| Command | When to use |
|---|---|
| `bash deploy.sh` | Update to latest version |
| `bash deploy.sh --init` | First install (same flow, flag is informational) |

**What the script does, in order:**

1. `git fetch + reset --hard origin/main` — pulls the latest code, discarding any local changes
2. `rm -rf .next node_modules/.cache` — cleans stale build artefacts
3. `npm install` — installs/updates all dependencies
4. `npm run db:migrate` — applies any pending database migrations (safe to re-run)
5. `npm run build` — builds the Next.js production bundle
6. PM2 restart or start — restarts the app if already running, starts it fresh otherwise; calls `pm2 save`

The script exits immediately on any error (`set -euo pipefail`) and prints the server IP at the end.

> **Note:** before the first run, create `.env.local` manually (see [Environment variables](#-environment-variables)).  
> The script never touches `.env.local`.

```bash
# Enable PM2 auto-start on server reboot (run once after first deploy)
pm2 startup
```

### Nginx reverse proxy (optional)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📁 Project structure

```
ledgernest/
├── src/
│   ├── app/
│   │   ├── (app)/                   # Authenticated pages
│   │   │   ├── dashboard/           # Main dashboard
│   │   │   ├── portfolio/
│   │   │   │   ├── stocks/          # Stock positions
│   │   │   │   ├── etf/             # ETF positions
│   │   │   │   ├── crypto/          # Crypto positions
│   │   │   │   ├── commodity/       # Commodity positions
│   │   │   │   ├── dividends/       # Dividend calendar
│   │   │   │   ├── heatmap/         # Performance heatmap
│   │   │   │   └── screener/        # Market screener
│   │   │   ├── finance/
│   │   │   │   ├── accounts/        # Bank accounts & wallets
│   │   │   │   ├── transactions/    # All transactions
│   │   │   │   ├── budget/          # Monthly budget
│   │   │   │   ├── recurring/       # Recurring income/expenses
│   │   │   │   ├── goals/           # Savings goals
│   │   │   │   ├── net-worth/       # Net worth history
│   │   │   │   └── report/          # Expense reports
│   │   │   └── settings/            # App settings
│   │   ├── api/                     # API routes (prices, sync, auth)
│   │   └── globals.css              # Global styles
│   ├── components/
│   │   ├── charts/                  # LineChart, Donut, Sparkline, …
│   │   ├── layout/                  # Sidebar, Topbar, BottomNav
│   │   └── shared/                  # Modals, Icon, SearchPalette, Wizard
│   ├── hooks/
│   │   └── useFormatters.ts         # Currency-aware number formatters
│   ├── i18n/
│   │   ├── locales/
│   │   │   ├── en.json              # English strings
│   │   │   └── it.json              # Italian strings
│   │   └── request.ts               # next-intl config
│   ├── stores/                      # Zustand stores (finance, portfolio, ui, prices, settings)
│   ├── lib/
│   │   ├── db/                      # SQLite schema + migrations
│   │   ├── services/                # Yahoo Finance, CoinGecko
│   │   └── utils/                   # Formatters, CSV import
│   └── types/                       # TypeScript types
├── .env.example                     # Environment variable template
└── README.md
```

---

## 🗄 Database

The database is SQLite (`ledgernest.db`), created locally on first `db:migrate`.  
**Never commit the `.db` file** — it contains personal data.

Useful commands:

```bash
npm run db:migrate   # create/update schema
npm run db:reset     # ⚠️ FULL RESET (deletes all data)
```

---

## 📝 Changelog

Full release history with notes for every version is available on the [GitHub Releases page](https://github.com/mandalarigabriele/ledgernest/releases).

---

<div align="center">
Made with ☕ by Gabriele Mandalari
</div>
