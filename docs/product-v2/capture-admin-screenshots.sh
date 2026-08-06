#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:3010}"
OUT="${OUT:-/Users/donbamz/LeadRush/docs/product-v2/admin-polish-screenshots/after}"

mkdir -p "$OUT"

npx --yes playwright@1.49.1 screenshot \
  --viewport-size=1440,900 \
  --wait-for-timeout=3000 \
  "${BASE}/admin" \
  "$OUT/admin-login-desktop.png"

echo "Saved $OUT/admin-login-desktop.png"
echo "Authenticated sections require ADMIN JWT — capture manually after login."
