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

ENV PORT=3000
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Dev deps (e.g. @types/nodemailer) are required for tsc; omit only after build.
RUN npm ci --workspace=backend --workspace=shared --ignore-scripts --include=dev

COPY shared/ ./shared/
COPY backend/ ./backend/

RUN npm run build --workspace=shared
RUN npm run build --workspace=backend
RUN npm prune --omit=dev

ENV NODE_ENV=production

WORKDIR /app/backend

EXPOSE 3000

# Use 127.0.0.1 — `localhost` can resolve to IPv6 while Node listens on IPv4,
# which marks the container unhealthy and Traefik returns 503.
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
  CMD curl -fsS --max-time 3 http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/server.js"]
