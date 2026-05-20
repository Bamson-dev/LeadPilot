#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

if [[ ! -f .env.production ]]; then
  echo "ERROR: .env.production not found in $APP_DIR"
  echo "Copy .env.production.example and fill in your values."
  exit 1
fi

echo "==> Rebuilding and restarting backend..."
docker compose --env-file .env.production build backend
docker compose --env-file .env.production up -d --remove-orphans backend

echo "==> Pruning unused images..."
docker image prune -f

echo "==> Backend status:"
docker compose --env-file .env.production ps backend

echo "==> Deploy complete."
