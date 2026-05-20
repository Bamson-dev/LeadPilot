# LeadPilot backend — production (Playwright image includes Chromium)
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/tsconfig.json shared/index.ts ./shared/
COPY shared/types ./shared/types
COPY shared/utils ./shared/utils
COPY backend/package.json backend/tsconfig.json ./backend/

RUN npm ci --include=dev --workspace=@leadpilot/shared --workspace=@leadpilot/backend

COPY shared ./shared
COPY backend ./backend

RUN npm run build --workspace=@leadpilot/shared \
  && npm run build --workspace=@leadpilot/backend \
  && npm prune --omit=dev

FROM mcr.microsoft.com/playwright:v1.60.0-jammy AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json

WORKDIR /app/backend

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/health || exit 1

CMD ["npm", "run", "start"]
