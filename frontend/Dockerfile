# COOLIFY FRONTEND DEPLOYMENT (off Vercel)
# ==========================================
# Base Directory:     /  (monorepo root — NOT /frontend)
# Dockerfile Path:    frontend/Dockerfile
# Port:               3000
# Health Check Path:  /
# Domain:             www.leadthur.com  (+ leadthur.com redirect)
# Branch:             main
# ==========================================
# Build-time env (Coolify → Environment Variables → Build):
#   NEXT_PUBLIC_API_URL=https://backend.leadthur.com
#   NEXT_PUBLIC_FRONTEND_URL=https://www.leadthur.com
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# Runtime: same NEXT_PUBLIC_* are already baked into the Next.js bundle.
# ==========================================

FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY shared/package.json shared/tsconfig.json shared/index.ts ./shared/
COPY shared/types ./shared/types
COPY shared/utils ./shared/utils
COPY frontend/package.json frontend/tsconfig.json frontend/next.config.ts ./frontend/
RUN npm install --workspace=@leadthur/shared --workspace=@leadthur/frontend

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY shared ./shared
COPY frontend ./frontend
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_URL=https://backend.leadthur.com
ARG NEXT_PUBLIC_FRONTEND_URL=https://www.leadthur.com
ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=
ARG NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_FRONTEND_URL=$NEXT_PUBLIC_FRONTEND_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=$NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY
RUN npm run build --workspace=@leadthur/shared
RUN npm run build --workspace=@leadthur/frontend

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public
EXPOSE 3000
CMD ["node", "frontend/server.js"]
