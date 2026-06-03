<div align="center">

# 🪺 LedgerNest

**Personal finance dashboard — portfolio, budget, net worth and cashflow in one place.**

![Version](https://img.shields.io/badge/version-0.5.7-blue)
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
- **Heatmap** — TradingView stock heatmap widget (S&P 500, by sector, size = market cap, colour = 1D change)

### 📈 Watchlist & Alerts
- Add any ticker (stocks, ETF, crypto) with autocomplete search — Yahoo Finance symbol resolved automatically
- Per-ticker price alerts (above/below threshold) with **in-app toast notification** and **email via Resend**
- Notification bell in the topbar with badge count and dismissable alert history
- Target price per item with distance-to-target percentage
- Lists (tags) for grouping watchlist items, 52-week range bar, 7-day sparkline
- Clicking a watchlist ticker opens a full TradingView ticker page (chart, fundamentals, technical analysis, news)

### 🔔 TradingView Integration
- **Ticker page** (`/ticker/[symbol]`) — advanced chart, symbol info, company profile, financials, technical analysis, timeline news — all via TradingView embeds
- Symbols resolved from Yahoo Finance format → TradingView exchange:symbol (e.g. `NEXI.MI` → `MIL:NEXI`, `BTC-USD` → `COINBASE:BTCUSD`)
- Search palette opens ticker page directly

### 🏦 Finances
- **Accounts** — bank accounts, brokers, crypto wallets with aggregated balance; Open Banking (PSD2) connection via Enable Banking
- **Transactions** — merchant logo, categories, CSV import, automatic import from connected bank accounts
- **Budget** — monthly planning by group/category, planned vs actual, 50/30/20 targets, per-category notes, pinnable default month, dynamic date range (first data month → +11 months)
- **Recurring** — recurring income and expenses with annual projection
- **Goals** — savings targets with progress tracking
- **Net Worth** — historical net worth with assets and liabilities
- **Report** — expense analysis by category, month over month

### ⚙️ Settings
- **Appearance** — dark/light theme, 8 colour themes, density (comfortable/normal/compact), font
- **Profile** — language (EN/IT), currency display, account holder name for transfer detection
- **Categories** — full category/subcategory manager with emoji, colour and group assignment
- **Merchants** — logo management, name normalisation, merchant merge/alias rules
- **Markets** — price refresh interval (UI), snapshot interval (server cron), Open Banking auto-sync interval (1h / 4h / daily), pre/post market prices, portfolio visibility
- **Data** — CSV import, portfolio reset, snapshot reset, full data reset

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
| Open Banking | Enable Banking API (PSD2, JWT RS256/ES256) |
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

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_URL` | ✅ | Public URL of the app (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | ✅ | Random string — generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | ✅ | Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | ✅ | Client Secret from Google Cloud Console |
| `ALLOWED_EMAILS` | ✅ | Comma-separated list of authorised email addresses |
| `CRON_SECRET` | ✅ | Secret for protecting `POST /api/cron/snapshot` — generate with `openssl rand -base64 32` |
| `RESEND_API_KEY` | ➖ | API key from [resend.com](https://resend.com) — enables email delivery for price alert notifications |
| `ENABLEBANKING_APP_ID` | ➖ | Enable Banking application ID (Open Banking only) |
| `ENABLEBANKING_PRIVATE_KEY` | ➖ | RSA/EC private key in PEM format for Enable Banking JWT signing |

### Configuring Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → **APIs & Services → Credentials → Create OAuth 2.0 Client**
3. Type: **Web application**
4. Authorized redirect URIs: `http://YOUR-HOST:3000/api/auth/callback/google`
5. Copy Client ID and Client Secret into `.env.local`

---

## 🔔 Price Alert Emails (Resend)

LedgerNest uses [Resend](https://resend.com) to send email notifications when a watchlist price alert triggers. This is **optional** — alerts still fire in-app (toast + notification bell) without it.

### Setup

#### 1. Create a Resend account

1. Sign up at [resend.com](https://resend.com) — the free tier allows 3 000 emails/month
2. Go to **API Keys** → **Create API Key** with *Sending access*
3. Copy the key (starts with `re_`)

#### 2. Add to `.env.local`

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

#### 3. (Optional) Verify a custom sender domain

By default emails are sent from `onboarding@resend.dev` (Resend's shared domain). To send from your own domain (e.g. `alerts@yourdomain.com`):

1. In Resend → **Domains** → **Add Domain** → follow DNS instructions (SPF, DKIM, DMARC)
2. Once verified, update the `from` field in `src/app/api/watchlist/alerts/notify/route.ts`:

```ts
from: 'LedgerNest Alerts <alerts@yourdomain.com>',
```

### How it works

| Event | What happens |
|---|---|
| Price crosses alert threshold | `usePriceAlerts` hook detects the crossing on next price refresh |
| In-app | Toast notification pops up (bottom-right, 6 s auto-dismiss) + bell badge increments |
| Email | `POST /api/watchlist/alerts/notify` → Resend sends HTML email to the logged-in user's address |
| Persistence | Alert marked `active: false` + `triggeredAt` timestamp saved to SQLite |
| Bell history | Triggered alerts visible in topbar bell dropdown — individually dismissable |

> **Note:** price refreshes happen at the interval set in **Settings → Markets → Refresh interval** (default: every 90 seconds while the app is open in a browser tab). Alerts are client-side only — they do not fire if no browser session is active.

---

## 🏦 Open Banking (PSD2)

LedgerNest integrates with [Enable Banking](https://enablebanking.com) to connect bank accounts and automatically import transactions via PSD2. The integration is **optional** — the app works fully without it.

### Supported banks

Any bank available in the Enable Banking catalogue. Italian accounts confirmed working:

| Bank | Country |
|---|---|
| Credit Agricole Cariparma | IT |
| UniCredit | IT |
| Banca Mediolanum | IT |
| Banco BPM | IT |
| Banca Nazionale del Lavoro | IT |
| BPER Banca | IT |
| N26 | IT |
| Revolut | IT |

To see the full list for your country, call `GET /api/banking/aspsps?country=IT` (or `FR`, `DE`, etc.) while logged in.

### Setup

#### 1. Create an Enable Banking application

1. Register at [enablebanking.com](https://enablebanking.com) and create a **production** application
2. Fill in:
   - **Application name:** LedgerNest
   - **Allowed redirect URLs:** `https://YOUR-DOMAIN/api/banking/callback`
   - **Privacy URL:** `https://YOUR-DOMAIN/privacy`
   - **Terms URL:** `https://YOUR-DOMAIN/terms`
   - **Email for data protection:** your email
3. Download the generated **RSA private key** (`.pem` file)

#### 2. Add credentials to `.env.local`

```bash
ENABLEBANKING_APP_ID=your-application-id

# Paste the full PEM content — multi-line is supported inside double quotes
ENABLEBANKING_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQ...
-----END PRIVATE KEY-----"
```

> **HTTPS required** for production. For local development use [ngrok](https://ngrok.com):
> ```bash
> winget install ngrok.ngrok     # Windows
> ngrok config add-authtoken YOUR_TOKEN
> ngrok http 3000
> ```
> Then set `NEXTAUTH_URL=https://YOUR-NGROK-URL` and add the ngrok callback URL to Enable Banking and Google OAuth.

#### 3. Connect a bank account

1. Go to **Finance → Accounts**
2. Click **+ Conto** → select **Banca** → switch to the **Open Banking** tab
3. Pick your bank and click **Connetti**
4. Authenticate on your bank's website and grant read-only access
5. On return, LedgerNest auto-creates and links the account

#### 4. Sync transactions

- Click **Sync Open Banking** on the account card to import transactions on demand
- Or set an automatic interval in **Settings → Markets → Sync Open Banking** (1h / 4h / daily)

> **Note:** The first sync imports up to 90 days of history. Subsequent syncs only fetch new transactions (deduplication by transaction ID).

### Architecture

| Component | Purpose |
|---|---|
| `POST /api/banking/connect` | Creates an Enable Banking auth session and returns the bank redirect URL |
| `GET /api/banking/callback` | Receives the OAuth callback, exchanges the code for a session, imports accounts |
| `GET/POST/PATCH /api/banking/accounts` | Lists connected accounts, refreshes balances, updates local ↔ EB links |
| `POST /api/banking/sync` | Fetches new transactions, cleans descriptions using CSV import rules, stores in finance store |
| `GET /api/banking/aspsps` | Proxies the Enable Banking ASPSP catalogue (bank list) |
| `EnableBankingPanel` | Invisible background component: auto-imports accounts on return from auth, drives auto-sync interval |

JWT authentication uses RS256 (RSA) or ES256 (EC) depending on the key type, detected automatically at runtime.

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
│   │   │   │   └── watchlist/       # Watchlist & price alerts
│   │   │   ├── finance/
│   │   │   │   ├── accounts/        # Bank accounts, wallets & OB sync
│   │   │   │   ├── transactions/    # All transactions
│   │   │   │   ├── budget/          # Monthly budget
│   │   │   │   ├── recurring/       # Recurring income/expenses
│   │   │   │   ├── goals/           # Savings goals
│   │   │   │   ├── net-worth/       # Net worth history
│   │   │   │   └── report/          # Expense reports
│   │   │   └── settings/            # App settings
│   │   ├── api/
│   │   │   ├── auth/                # NextAuth Google OAuth
│   │   │   ├── banking/             # Open Banking (PSD2) via Enable Banking
│   │   │   │   ├── connect/         # POST — create auth session → redirect URL
│   │   │   │   ├── callback/        # GET  — OAuth return, import accounts
│   │   │   │   ├── accounts/        # GET/POST/PATCH — list, refresh, link accounts
│   │   │   │   ├── sync/            # POST — import new transactions
│   │   │   │   └── aspsps/          # GET  — available banks catalogue
│   │   │   ├── cron/snapshot/       # POST — scheduled portfolio snapshot (CRON_SECRET)
│   │   │   ├── data/export/         # GET  — full data export
│   │   │   ├── dividends/           # Dividend data
│   │   │   ├── portfolio-chart/     # Portfolio performance data
│   │   │   ├── portfolio/heatmap/   # Heatmap data
│   │   │   ├── prices/              # Live stock/crypto quotes + history
│   │   │   ├── snapshots/           # Portfolio & net worth snapshots
│   │   │   ├── sparklines/          # 7-day sparklines
│   │   │   ├── sync/                # Server-side Zustand state sync
│   │   │   ├── ticker/
│   │   │   │   ├── [symbol]/        # GET — resolve Yahoo symbol → TradingView symbol
│   │   │   │   └── search/          # GET — ticker autocomplete (Yahoo Finance → TV symbols)
│   │   │   └── watchlist/
│   │   │       ├── route.ts         # GET/POST — list + add watchlist items
│   │   │       ├── [id]/route.ts    # PATCH/DELETE — update/remove item
│   │   │       └── alerts/
│   │   │           ├── route.ts     # GET/POST — list + add price alerts
│   │   │           ├── [id]/route.ts# PATCH/DELETE — mark triggered / remove alert
│   │   │           └── notify/      # POST — send Resend email on alert trigger
│   │   ├── privacy/                 # Privacy policy page (public)
│   │   ├── terms/                   # Terms of use page (public)
│   │   ├── login/                   # Login page
│   │   └── globals.css              # Global styles
│   ├── components/
│   │   ├── charts/                  # LineChart, Donut, Sparkline, Heatmap, …
│   │   ├── layout/                  # Sidebar, Topbar, BottomNav
│   │   └── shared/
│   │       ├── modals/              # AccountModal (+ Open Banking tab), BuyModal, …
│   │       ├── EnableBankingPanel   # Background: auto-import on OB callback, auto-sync
│   │       ├── CSVImportWizard      # CSV import flow
│   │       ├── OnboardingWizard     # First-run setup (includes OB connect option)
│   │       ├── EmojiPicker, CategoryPicker, SearchPalette, Icon, …
│   ├── hooks/
│   │   ├── useFormatters.ts         # Currency-aware number formatters
│   │   ├── usePortfolioChart.ts     # Portfolio chart data with live now-point
│   │   ├── usePortfolioSnapshot.ts  # Snapshot polling & persistence
│   │   ├── usePriceAlerts.ts        # Detects alert thresholds crossing → toast + email
│   │   └── useServerSync.ts         # Server-side state sync hook
│   ├── i18n/
│   │   ├── locales/
│   │   │   ├── en.json              # English strings
│   │   │   └── it.json              # Italian strings
│   │   └── request.ts               # next-intl config
│   ├── stores/                      # Zustand stores (finance, portfolio, ui, prices, settings, watchlist, notifications, toast)
│   ├── lib/
│   │   ├── db/                      # SQLite schema + migrations
│   │   ├── services/
│   │   │   ├── yahooFinance.ts      # Yahoo Finance quotes & history
│   │   │   ├── coinGecko.ts         # CoinGecko crypto prices
│   │   │   └── enableBanking.ts     # Enable Banking API client (JWT signing, PSD2 calls)
│   │   └── utils/                   # Formatters, CSV import (+ merchant cleaning rules), price helpers
│   └── types/                       # TypeScript types (Account, Transaction, AppSettings, …)
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

### Tables

| Table | Purpose |
|---|---|
| `portfolio_snapshots` | Daily portfolio value history |
| `networth_snapshots` | Daily net worth history |
| `price_cache` | Live price cache with TTL |
| `currency_cache` | EUR/USD exchange rate cache |
| `user_data` | Server-side Zustand state mirror (key/value per user) |
| `banking_sessions` | Enable Banking OAuth sessions (pending → active) |
| `banking_accounts` | Bank accounts fetched from Enable Banking, linked to local accounts |
| `banking_transactions` | Deduplication ledger for imported OB transactions |
| `watchlist_items` | Watchlist entries with ticker, currency, target price and list tags |
| `watchlist_alerts` | Per-ticker price alerts with threshold, direction, triggered state and timestamp |

---

## 📝 Changelog

Full release history with notes for every version is available on the [GitHub Releases page](https://github.com/mandalarigabriele/ledgernest/releases).

---

<div align="center">
Made with ☕ by Gabriele Mandalari
</div>
