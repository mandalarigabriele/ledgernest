# syntax=docker/dockerfile:1

# ── Dependencies ────────────────────────────────────────────────
# Build tools are needed when better-sqlite3 has no prebuilt binary for this Node version.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ── Build ───────────────────────────────────────────────────────
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build \
  && npm prune --omit=dev \
  && rm -rf .next/cache

# ── Runtime ─────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
# HOSTNAME must be set explicitly: Docker sets it to the container id, and server.js binds to it.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data
WORKDIR /app

# server.js, next.config.mjs and src/i18n are read at runtime, so the whole pruned app is copied.
COPY --from=build --chown=node:node /app ./

RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
