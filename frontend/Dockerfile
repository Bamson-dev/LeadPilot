FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY shared/package.json shared/tsconfig.json shared/index.ts ./shared/
COPY shared/types ./shared/types
COPY shared/utils ./shared/utils
COPY frontend/package.json frontend/tsconfig.json frontend/next.config.ts ./frontend/
RUN npm install --workspace=@leadpilot/shared --workspace=@leadpilot/frontend

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY shared ./shared
COPY frontend ./frontend
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1
RUN npm run build --workspace=@leadpilot/shared
RUN npm run build --workspace=@leadpilot/frontend

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public
EXPOSE 3000
CMD ["node", "frontend/server.js"]
