<div align="center">

# 🪺 LedgerNest

**Personal finance dashboard — portfolio, budget, patrimonio e cashflow in un unico posto.**

![Version](https://img.shields.io/badge/version-0.1--beta-orange)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![License](https://img.shields.io/badge/license-private-lightgrey)

</div>

---

## ✨ Funzionalità

### 📊 Dashboard
- Patrimonio netto in tempo reale con grafico interattivo (Totale / Investimenti / Liquidità / Spese)
- Range temporali: 1S · 1M · 3M · 6M · 1A · MAX
- KPI strip: patrimonio, investimenti, liquidità, risparmio mensile, P&L, spese
- Allocazione portafoglio (donut chart), cashflow ultimi 6 mesi
- Heatmap performance, treemap posizioni, calendario dividendi

### 💼 Portafoglio
- **Azioni** — prezzi live da Yahoo Finance, P&L per posizione, sparkline 60g, settori
- **ETF** — TER, esposizione regionale, grafico storico, P&L corretto EUR/USD
- **Crypto** — prezzi live da CoinGecko, grafici storici
- Correzione cambio EUR/USD automatica sul costo medio

### 🏦 Finanze
- **Conti** — conti bancari, broker, crypto wallet con saldo aggregato
- **Movimenti** — transazioni con merchant logo, categorie, import CSV
- **Budget** — pianificazione mensile per gruppo/categoria, confronto pianificato vs attuale
- **Ricorrenti** — entrate e spese ricorrenti con proiezione annuale
- **Obiettivi** — traguardi di risparmio con progress tracking
- **Patrimonio** — net worth storico con asset e passività
- **Report** — analisi spese per categoria, mese per mese

### 🔒 Autenticazione
- Google OAuth via NextAuth v4
- Whitelist email configurabile (solo gli indirizzi autorizzati possono accedere)

### 📱 Mobile first
- Layout responsive completo
- Bottom navigation bar su mobile
- Grafici e tabelle con scroll orizzontale intelligente

---

## 🛠 Stack

| Layer | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | SQLite via `better-sqlite3` |
| Auth | NextAuth v4 + Google OAuth |
| State | Zustand (client-side, persistente) |
| Prezzi | Yahoo Finance (`yahoo-finance2`), CoinGecko |
| UI | CSS custom (no Tailwind), SVG charts nativi |

---

## 🚀 Quick start (sviluppo locale)

```bash
# 1. Clona
git clone https://github.com/mandalarigabriele/ledgernest.git
cd ledgernest

# 2. Installa dipendenze
npm install

# 3. Configura ambiente
cp .env.example .env.local
# → edita .env.local con le tue credenziali

# 4. Inizializza il database
npm run db:migrate

# 5. Avvia
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

---

## 🔧 Variabili d'ambiente

Copia `.env.example` → `.env.local` e compila:

| Variabile | Descrizione |
|---|---|
| `NEXTAUTH_URL` | URL pubblico dell'app (es. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Stringa casuale — genera con `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Client ID da Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Client Secret da Google Cloud Console |
| `ALLOWED_EMAILS` | Email autorizzate, separate da virgola |

### Configurare Google OAuth

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un progetto → **APIs & Services → Credentials → Create OAuth 2.0 Client**
3. Tipo: **Web application**
4. Authorized redirect URIs: `http://TUO-HOST:3000/api/auth/callback/google`
5. Copia Client ID e Client Secret in `.env.local`

---

## 🖥 Deploy su server Linux (Proxmox / LXC / VPS)

> **Prerequisiti:** Node.js ≥ 20, PM2 (`npm install -g pm2`)

```bash
# 1. Clona sul server
git clone https://github.com/mandalarigabriele/ledgernest.git
cd ledgernest

# 2. Installa dipendenze (solo produzione)
npm install --omit=dev

# 3. Configura ambiente
cp .env.example .env.local
nano .env.local   # compila con i tuoi valori reali

# 4. Inizializza il database
npm run db:migrate

# 5. Build
npm run build

# 6. Avvia con PM2
pm2 start npm --name ledgernest -- start
pm2 save
pm2 startup   # abilita avvio automatico al boot
```

L'app gira su `http://SERVER-IP:3000`.

### Nginx reverse proxy (opzionale)

```nginx
server {
    listen 80;
    server_name tuodominio.com;

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

### Aggiornare a una nuova versione

```bash
cd ledgernest
git pull
npm install --omit=dev
npm run build
pm2 restart ledgernest
```

---

## 📁 Struttura del progetto

```
ledgernest/
├── src/
│   ├── app/
│   │   ├── (app)/               # Pagine autenticate
│   │   │   ├── dashboard/       # Dashboard principale
│   │   │   ├── portfolio/       # Azioni, ETF, Crypto
│   │   │   └── finance/         # Conti, Budget, Movimenti, ...
│   │   ├── api/                 # API Routes (prezzi, sync, auth)
│   │   └── globals.css          # Stili globali
│   ├── components/
│   │   ├── charts/              # LineChart, Donut, Sparkline, ...
│   │   ├── layout/              # Sidebar, Topbar, BottomNav
│   │   └── shared/              # Modali, Icon, Wizard
│   ├── stores/                  # Zustand stores (finance, portfolio, ui)
│   ├── lib/
│   │   ├── db/                  # Schema SQLite + migrations
│   │   ├── services/            # Yahoo Finance, CoinGecko
│   │   └── utils/               # Format, CSV import
│   └── types/                   # TypeScript types
├── .env.example                 # Template variabili d'ambiente
└── README.md
```

---

## 🗄 Database

Il database è SQLite (`ledgernest.db`), creato localmente al primo `db:migrate`.  
**Non committare mai il file `.db`** — contiene dati personali.

Comandi utili:

```bash
npm run db:migrate   # crea/aggiorna lo schema
npm run db:reset     # ⚠️ RESET COMPLETO (cancella tutti i dati)
```

---

## 📝 Note di versione

### v0.1-beta (Maggio 2025)
- Prima release pubblica
- Dashboard con grafici interattivi e range temporali
- Portfolio azioni/ETF/crypto con P&L corretto EUR/USD
- Budget mensile con pianificazione per gruppo/categoria
- Autenticazione Google OAuth con whitelist email
- Layout mobile-first con bottom navigation

---

<div align="center">
Made with ☕ by Gabriele Mandalari
</div>
