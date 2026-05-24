# LedgerNest

Personal finance dashboard — portfolio, budget, net worth, and cashflow in one place.

> **Beta 0.1** — work in progress.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **SQLite** via `better-sqlite3`
- **NextAuth v4** with Google OAuth
- **Zustand** for client state
- **Yahoo Finance** for live quotes

## Quick start (development)

```bash
npm install
cp .env.example .env.local   # fill in your values
npm run db:migrate
npm run dev
```

## Deploy on a Linux server (Node.js + PM2)

```bash
git clone https://github.com/mandalarigabriele/ledgernest.git
cd ledgernest
npm install
cp .env.example .env.local   # fill in your values
npm run db:migrate
npm run build
pm2 start npm --name ledgernest -- start
pm2 save
```

Access at `http://<server-ip>:3000`.  
For HTTPS, put Nginx or Caddy in front.

## Environment variables

| Variable | Description |
|---|---|
| `NEXTAUTH_URL` | Public URL of the app |
| `NEXTAUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `ALLOWED_EMAILS` | Comma-separated list of allowed emails |
