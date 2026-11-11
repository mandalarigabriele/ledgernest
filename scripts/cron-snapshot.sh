#!/bin/bash
# LedgerNest — server-side price snapshot
# Called by PM2 cron or system crontab.
# Required env vars: CRON_SECRET, APP_URL (default http://localhost:3000)

set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:?CRON_SECRET env var is required}"

response=$(curl -sf -X POST \
  "${APP_URL}/api/cron/snapshot" \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  --max-time 30)

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) cron-snapshot: ${response}"
