#!/bin/sh
# LedgerNest — periodic price snapshot, run by the "snapshot" service in docker-compose.yml.
# Reads CRON_SECRET and SNAPSHOT_INTERVAL (minutes, default 10) from the mounted .env.local.

set -eu

ENV_FILE="${ENV_FILE:-/config/.env.local}"
APP_URL="${APP_URL:-http://ledgernest:3000}"

env_value() {
  sed -n "s/^$1=//p" "$ENV_FILE" | head -n 1 | tr -d "\"'"
}

CRON_SECRET="$(env_value CRON_SECRET)"
INTERVAL="$(env_value SNAPSHOT_INTERVAL)"
INTERVAL="${INTERVAL:-10}"

if [ -z "$CRON_SECRET" ]; then
  echo "CRON_SECRET is not set in .env.local: snapshots disabled."
  while :; do sleep 3600; done
fi

echo "Price snapshot every ${INTERVAL} min against ${APP_URL}"
while :; do
  sleep $((INTERVAL * 60))
  if response=$(curl -sf -X POST "${APP_URL}/api/cron/snapshot" \
      -H "x-cron-secret: ${CRON_SECRET}" \
      -H "Content-Type: application/json" \
      --max-time 30); then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) snapshot: ${response}"
  else
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) snapshot: request failed" >&2
  fi
done
