# syntax=docker/dockerfile:1.7
#
# Sub-projeto 35 — Dockerfile-based build.
#
# Background: Railway's Railpack builder kept failing at
# `apt-get install -y libatomic1` (exit code 100) on consecutive
# deploys. The apt step is auto-injected by Railpack to satisfy
# native modules (e.g. @napi-rs/canvas which dlopens libatomic).
#
# Fix: bypass Railpack by providing a Dockerfile. The base image
# `node:22-bookworm` (non-slim) already includes libatomic1, so we
# don't run apt at all — eliminating the broken step entirely.
#
# Uses Next.js standalone output (configured in next.config.mjs)
# for a small final image.

FROM node:22-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# HOSTNAME=0.0.0.0 is REQUIRED for containers. The Next.js standalone
# server defaults to binding `localhost` (127.0.0.1 only) — Railway's
# proxy can't reach that interface from outside the container, which
# manifests as "Application failed to respond". Binding to all
# interfaces fixes it. PORT comes from env at runtime (Railway sets it).

# Standalone output: only the modules actually imported are bundled.
# Static + public files live next to server.js per Next.js convention.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
