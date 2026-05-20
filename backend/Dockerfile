# LeadPilot backend — production VPS image with Playwright Chromium
FROM node:20-slim AS base
WORKDIR /app

FROM base AS chromium-deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

FROM base AS builder
COPY package.json package-lock.json ./
COPY shared/package.json shared/tsconfig.json shared/index.ts ./shared/
COPY shared/types ./shared/types
COPY shared/utils ./shared/utils
COPY backend/package.json backend/tsconfig.json ./backend/
RUN npm ci --workspace=@leadpilot/shared --workspace=@leadpilot/backend

COPY shared ./shared
COPY backend ./backend
RUN npm run build --workspace=@leadpilot/shared \
  && npm run build --workspace=@leadpilot/backend \
  && npm prune --omit=dev

FROM chromium-deps AS runner
ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_OPTIONS="--max-old-space-size=768"

RUN groupadd -r leadpilot && useradd -r -g leadpilot -d /app leadpilot

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

WORKDIR /app/backend
USER leadpilot

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/health || exit 1

CMD ["node", "dist/server.js"]
