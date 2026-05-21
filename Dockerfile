# DEPRECATED — Coolify must use backend/Dockerfile with Base Directory = /
# See DEPLOYMENT.md. This file exists only for backwards compatibility.

FROM node:20-slim AS base

RUN apt-get update && apt-get install -y \
  chromium \
  chromium-sandbox \
  fonts-noto-color-emoji \
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
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils \
  curl \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/tsconfig.json ./backend/
COPY shared/package.json shared/tsconfig.json ./shared/

RUN npm install --workspace=@leadpilot/backend --workspace=@leadpilot/shared --ignore-scripts

COPY shared/ ./shared/
COPY backend/ ./backend/

RUN npm run build --workspace=@leadpilot/shared \
  && npm run build --workspace=@leadpilot/backend

WORKDIR /app/backend

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
