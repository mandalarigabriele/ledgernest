#!/bin/bash
# LedgerNest — deploy / first-run script
# Usage:
#   First install : bash deploy.sh --init
#   Update        : bash deploy.sh

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="ledgernest"

cd "$APP_DIR"

# Load CRON_SECRET and SNAPSHOT_INTERVAL from .env.local if not already in environment
if [ -f "$APP_DIR/.env.local" ]; then
  _val=$(grep -E '^CRON_SECRET=' "$APP_DIR/.env.local" 2>/dev/null | head -1 | sed 's/^CRON_SECRET=//' | tr -d '"' | tr -d "'") || true
  [ -n "$_val" ] && export CRON_SECRET="$_val"
  _val=$(grep -E '^SNAPSHOT_INTERVAL=' "$APP_DIR/.env.local" 2>/dev/null | head -1 | sed 's/^SNAPSHOT_INTERVAL=//' | tr -d '"' | tr -d "'") || true
  [ -n "$_val" ] && export SNAPSHOT_INTERVAL="$_val"
  unset _val
fi

echo "==> LedgerNest deploy — $(date)"

# ── Pull latest code ───────────────────────────────────────────
echo "==> Pulling latest code..."
git fetch origin
git reset --hard origin/main

# ── Clean stale artifacts ──────────────────────────────────────
echo "==> Cleaning build cache..."
rm -rf .next
rm -rf node_modules/.cache

# ── Dependencies ───────────────────────────────────────────────
echo "==> Installing dependencies..."
npm install

# ── Database ───────────────────────────────────────────────────
echo "==> Running database migrations..."
npm run db:migrate

# ── Build ──────────────────────────────────────────────────────
echo "==> Building..."
npm run build

# ── Start / restart with PM2 ──────────────────────────────────
echo "==> Starting app with PM2..."
if pm2 describe "$APP_NAME" &>/dev/null; then
  pm2 restart "$APP_NAME"
else
  pm2 start npm --name "$APP_NAME" -- start
fi
pm2 save

# ── Price snapshot cron ────────────────────────────────────────
# Runs every 10 minutes by default; override with SNAPSHOT_INTERVAL (minutes).
SNAPSHOT_INTERVAL="${SNAPSHOT_INTERVAL:-10}"
CRON_EXPR="*/${SNAPSHOT_INTERVAL} * * * *"

chmod +x "$APP_DIR/scripts/cron-snapshot.sh"

if pm2 describe "ledgernest-snapshot" &>/dev/null; then
  pm2 delete "ledgernest-snapshot"
fi

if [ -n "${CRON_SECRET:-}" ]; then
  pm2 start "$APP_DIR/scripts/cron-snapshot.sh" \
    --name "ledgernest-snapshot" \
    --cron "$CRON_EXPR" \
    --no-autorestart
  pm2 save
  echo "==> Snapshot cron registered (every ${SNAPSHOT_INTERVAL} min)"
else
  echo "==> WARNING: CRON_SECRET not set — snapshot cron not registered."
  echo "    Set CRON_SECRET in .env.local and re-run deploy.sh to enable it."
fi

echo ""
echo "==> Done. App running at http://$(hostname -I | awk '{print $1}'):3000"
