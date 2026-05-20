#!/usr/bin/env bash
# One-time Contabo VPS setup for LeadPilot backend
set -euo pipefail

APP_DIR="${1:-/opt/leadpilot}"
REPO_URL="${2:-https://github.com/Bamson-dev/LeadPilot.git}"

echo "==> Installing Docker if missing..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

if ! docker compose version &>/dev/null; then
  echo "ERROR: docker compose plugin required"
  exit 1
fi

echo "==> Cloning repository to $APP_DIR..."
mkdir -p "$(dirname "$APP_DIR")"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [[ ! -f .env.production ]]; then
  cp .env.production.example .env.production
  echo ""
  echo "Created .env.production — edit it before first deploy:"
  echo "  nano $APP_DIR/.env.production"
  echo ""
fi

chmod +x scripts/deploy-vps.sh

echo "==> Initial build and start..."
bash scripts/deploy-vps.sh

echo ""
echo "==> VPS setup complete."
echo "Add GitHub secrets: VPS_HOST, VPS_USER, VPS_SSH_KEY"
echo "Optional: VPS_PORT, VPS_APP_DIR ($APP_DIR)"
echo "Health: curl http://127.0.0.1:3000/health"
