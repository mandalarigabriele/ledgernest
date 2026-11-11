#!/bin/bash
# LedgerNest — deploy / first-run script
# Usage:
#   First install : bash deploy.sh --init
#   Update        : bash deploy.sh
#
# Also run automatically by .github/workflows/deploy.yml (self-hosted runner, via sudo)
# after CI passes on main.

set -euo pipefail

# Everything lives in main(), called on the last line: bash then parses the whole script
# before running it, so the `git reset --hard` below can safely rewrite this very file.
main() {
  APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  APP_NAME="ledgernest"
  PORT="${PORT:-3000}"

  cd "$APP_DIR"

  # sudo resets PATH to secure_path: pick up Node/PM2 installed via nvm or in /usr/local
  export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
  if ! command -v npm >/dev/null 2>&1 && [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  fi
  command -v npm >/dev/null 2>&1 || { echo "==> ERROR: npm not found in PATH" >&2; exit 1; }
  command -v pm2 >/dev/null 2>&1 || { echo "==> ERROR: pm2 not found (npm install -g pm2)" >&2; exit 1; }

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
  PREVIOUS="$(git rev-parse --short HEAD)"
  git fetch origin
  git reset --hard origin/main
  CURRENT="$(git rev-parse --short HEAD)"
  if [ "$PREVIOUS" = "$CURRENT" ]; then
    echo "==> Already at $CURRENT, rebuilding anyway."
  else
    echo "==> Updating $PREVIOUS → $CURRENT:"
    git --no-pager log --oneline "$PREVIOUS..$CURRENT" | sed 's/^/    /'
  fi

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

  # ── Health check ───────────────────────────────────────────────
  echo "==> Waiting for the app to answer on port $PORT..."
  for attempt in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT/" || true)
    if [ -n "$code" ] && [ "$code" != "000" ] && [ "$code" -lt 500 ]; then
      echo "==> App is up (HTTP $code)."
      break
    fi
    if [ "$attempt" = 30 ]; then
      pm2 logs "$APP_NAME" --lines 50 --nostream >&2 || true
      echo "==> ERROR: the app did not become healthy (last HTTP code: ${code:-none})." >&2
      exit 1
    fi
    sleep 2
  done

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
  echo "==> Done. LedgerNest $CURRENT running at http://$(hostname -I | awk '{print $1}'):$PORT"
}

main "$@"
