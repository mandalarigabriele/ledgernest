#!/usr/bin/env bash
# LedgerNest — deploy / first-run script. Run it on the Docker host, from the repository folder.
#
# Usage:
#   First install : bash deploy.sh --init   (checks Docker, creates .env.local with generated secrets)
#   Update        : bash deploy.sh          (backup, pull, build, restart, health check)
#
# Also run automatically by .github/workflows/deploy.yml (self-hosted runner, via sudo)
# after CI passes on main.
#
# The app runs in Docker (see docker-compose.yml): dependencies and the build happen inside the
# image, and the database schema is created/migrated by the app on first access, so the server
# only needs git and Docker. Data lives in the "ledgernest-data" Docker volume; secrets live in
# .env.local (never in git).

set -euo pipefail

# Everything lives in main(), called on the last line: bash then parses the whole script
# before running it, so the `git reset --hard` below can safely rewrite this very file.
main() {
  APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  SERVICE="ledgernest"
  BRANCH="${DEPLOY_BRANCH:-main}"
  ENV_FILE=".env.local"
  BACKUP_DIR="$APP_DIR/backups"
  BACKUPS_TO_KEEP=10
  REQUIRED_VARS=(NEXTAUTH_URL NEXTAUTH_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET ALLOWED_EMAILS CRON_SECRET)

  cd "$APP_DIR"

  # ── First install ──────────────────────────────────────────────
  if [[ "${1:-}" == "--init" ]]; then
    log "LedgerNest first install — $(date)"
    check_docker
    if [[ -f "$ENV_FILE" ]]; then
      log "$ENV_FILE already exists, leaving it untouched."
    else
      cp .env.example "$ENV_FILE"
      chmod 600 "$ENV_FILE"
      # -i.bak works with both GNU and BSD sed
      sed -i.bak \
        -e "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$(random_secret)|" \
        -e "s|^CRON_SECRET=.*|CRON_SECRET=$(random_secret)|" \
        "$ENV_FILE"
      rm -f "$ENV_FILE.bak"
      log "Created $ENV_FILE with generated NEXTAUTH_SECRET and CRON_SECRET."
    fi
    echo ""
    echo "Next steps:"
    echo "  1. Edit $ENV_FILE: NEXTAUTH_URL (https://your-hostname), GOOGLE_CLIENT_ID,"
    echo "     GOOGLE_CLIENT_SECRET, ALLOWED_EMAILS and the optional keys:   nano $ENV_FILE"
    echo "  2. In Google Cloud Console add <NEXTAUTH_URL>/api/auth/callback/google to the OAuth client."
    echo "  3. Run:   bash deploy.sh"
    exit 0
  fi

  # ── Update ─────────────────────────────────────────────────────
  log "LedgerNest deploy — $(date)"
  check_docker

  [[ -f "$ENV_FILE" ]] || fail "$ENV_FILE not found. Run: bash deploy.sh --init"
  chmod 600 "$ENV_FILE"
  for var in "${REQUIRED_VARS[@]}"; do
    [[ -n "$(env_value "$var")" ]] || fail "$var is empty in $ENV_FILE"
  done

  # Back up the database while the old version runs. better-sqlite3's online backup gives a
  # consistent copy even with WAL; it is streamed out of the container and gzipped on the host.
  if docker compose ps --status running --services 2>/dev/null | grep -qx "$SERVICE"; then
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/ledgernest-$(date +%Y%m%d-%H%M%S).db.gz"
    log "Backing up the database to ${BACKUP_FILE#"$APP_DIR"/}..."
    docker compose exec -T "$SERVICE" node -e "
      const Database = require('better-sqlite3')
      new Database('/data/ledgernest.db', { readonly: true, fileMustExist: true })
        .backup('/data/.deploy-backup.db')
        .then(() => process.exit(0))
        .catch((e) => { console.error(e); process.exit(1) })
    "
    docker compose exec -T "$SERVICE" sh -c 'cat /data/.deploy-backup.db && rm -f /data/.deploy-backup.db' \
      | gzip >"$BACKUP_FILE"
    # Keep only the most recent backups
    ls -1t "$BACKUP_DIR"/ledgernest-*.db.gz 2>/dev/null | tail -n +$((BACKUPS_TO_KEEP + 1)) | xargs -r rm -f
  else
    log "App not running yet: no backup needed."
  fi

  # The server is deploy-only: tracked files always match origin. .env.local, backups/ and the
  # data volume are not tracked.
  log "Pulling latest code ($BRANCH)..."
  PREVIOUS="$(git rev-parse --short HEAD)"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  CURRENT="$(git rev-parse --short HEAD)"
  if [[ "$PREVIOUS" == "$CURRENT" ]]; then
    log "Already at $CURRENT, rebuilding anyway."
  else
    log "Updating $PREVIOUS → $CURRENT:"
    git --no-pager log --oneline "$PREVIOUS..$CURRENT" | sed 's/^/    /'
  fi

  log "Building image..."
  docker compose build --pull

  log "Starting containers..."
  docker compose up -d --remove-orphans

  log "Waiting for the app to answer..."
  for attempt in $(seq 1 45); do
    if docker compose exec -T "$SERVICE" node -e \
      "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
      >/dev/null 2>&1; then
      break
    fi
    if [[ "$attempt" == 45 ]]; then
      docker compose logs --tail 50 "$SERVICE" >&2 || true
      fail "The app did not become healthy. Logs above; the previous database backup is in backups/."
    fi
    sleep 2
  done

  log "Removing unused images..."
  docker image prune -f >/dev/null

  HOST_PORT="$(grep -E '^HOST_PORT=' .env 2>/dev/null | head -1 | cut -d= -f2- || true)"
  echo ""
  log "Done. LedgerNest $CURRENT is running."
  echo "    Local : http://$(hostname -I | awk '{print $1}'):${HOST_PORT:-3001}"
  echo "    Public: $(env_value NEXTAUTH_URL)"
}

log() { echo "==> $*"; }

fail() {
  echo "==> ERROR: $*" >&2
  exit 1
}

# Value of KEY in .env.local (quotes stripped), empty when missing
env_value() {
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true
}

random_secret() {
  head -c 32 /dev/urandom | base64 | tr -d '\n'
}

check_docker() {
  command -v docker >/dev/null 2>&1 || fail "Docker is not installed. On Debian/Ubuntu: curl -fsSL https://get.docker.com | sh
  (in a Proxmox LXC container, enable Options → Features → nesting=1 and keyctl=1 first)"
  docker compose version >/dev/null 2>&1 || fail "The Docker compose plugin is missing (package docker-compose-plugin)."
  docker info >/dev/null 2>&1 || fail "Cannot talk to the Docker daemon. Is it running, and are you root or in the docker group?"
}

main "$@"
