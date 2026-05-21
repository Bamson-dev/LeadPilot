# Use backend/Dockerfile — Base Directory = / , see DEPLOYMENT.md

FROM mcr.microsoft.com/playwright:v1.60.0-jammy

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY package.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

RUN npm install --workspace=backend --workspace=shared

COPY shared/ ./shared/
COPY backend/ ./backend/

RUN npm run build --workspace=shared
RUN npm run build --workspace=backend
RUN npm prune --omit=dev

WORKDIR /app/backend

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
