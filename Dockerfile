# =====================================================
# Multi-stage build для Next.js (standalone output)
# Sprint 3: переход на debian-slim для совместимости с LibreOffice
# (DOCX → PDF рендер прямо в app-контейнере, без docker.sock)
# =====================================================

# ---- Этап 1: установка зависимостей ----
FROM node:20-slim AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# ---- Этап 2: сборка ----
FROM node:20-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Этап 3: финальный образ ----
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# LibreOffice headless для DOCX → PDF + кириллические шрифты
# Размер: ~700МБ к образу. Изоляция важнее (без docker.sock из app).
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libreoffice-core libreoffice-writer \
      fonts-liberation fonts-dejavu fonts-dejavu-extra fonts-noto-core \
      ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Пользователь без рута для безопасности
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --no-create-home --home-dir /app nextjs

# Standalone-сборка от Next.js
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Drizzle миграции и схемы (для запуска через one-shot контейнер)
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/lib/db ./lib/db
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# DOCX-шаблоны (fallback если БД пустая)
COPY --from=builder --chown=nextjs:nodejs /app/templates ./templates

# Папки для LibreOffice profile и storage (storage = named volume на prod)
RUN mkdir -p /tmp/lo-profile /app/storage && \
    chown -R nextjs:nodejs /tmp/lo-profile /app/storage

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
