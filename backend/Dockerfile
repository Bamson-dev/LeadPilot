# COOLIFY DEPLOYMENT CONFIGURATION
# Base Directory:     /
# Dockerfile Path:    backend/Dockerfile
# Port:               3000
# Health Check Path:  /health
#
# Runtime secrets (SUPABASE_SERVICE_KEY, PAYSTACK_SECRET_KEY, RESEND_API_KEY, etc.)
# must be set in Coolify environment — not baked into the image.
ARG RESEND_API_KEY
ARG EMAIL_FROM

FROM mcr.microsoft.com/playwright:v1.60.0-jammy

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

RUN npm ci --workspace=backend --workspace=shared --ignore-scripts

COPY shared/ ./shared/
COPY backend/ ./backend/

RUN npm run build --workspace=shared
RUN npm run build --workspace=backend
RUN npm prune --omit=dev

WORKDIR /app/backend

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "dist/server.js"]
