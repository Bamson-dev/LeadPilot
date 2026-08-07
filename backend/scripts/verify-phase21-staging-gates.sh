#!/usr/bin/env bash
# Phase 2.1 staging release-gate probe (read-only checks + health).
# Usage: bash backend/scripts/verify-phase21-staging-gates.sh
set -euo pipefail

BE="${STAGING_BACKEND_URL:-https://staging-backend.leadthur.com}"
FE="${STAGING_FRONTEND_URL:-https://staging.leadthur.com}"
EXPECTED_SHA="${EXPECTED_GIT_SHA:-}"

echo "== Phase 2.1 staging gate probe =="
echo "Backend: $BE"
echo "Frontend: $FE"

health="$(curl -fsS "$BE/health")"
echo "$health" | head -c 2000
echo

sha="$(python3 - <<'PY' "$health"
import json,sys
print(json.loads(sys.argv[1]).get("gitCommitSha",""))
PY
)"

echo "Deployed backend SHA: $sha"
if [[ -n "$EXPECTED_SHA" ]]; then
  if [[ "$sha" != "$EXPECTED_SHA"* && "$EXPECTED_SHA" != "$sha"* ]]; then
    echo "FAIL: expected SHA prefix $EXPECTED_SHA, got $sha"
    exit 1
  fi
  echo "PASS: backend SHA matches expected"
else
  echo "NOTE: set EXPECTED_GIT_SHA to enforce revision match"
fi

fe_code="$(curl -sS -o /dev/null -w "%{http_code}" "$FE/" || true)"
echo "Frontend HTTP: $fe_code (302 often means Vercel SSO protection)"

# Observability routes require admin auth — probe unauthenticated shape only
obs_code="$(curl -sS -o /dev/null -w "%{http_code}" "$BE/admin/observability/overview" || true)"
echo "Admin observability (no auth) HTTP: $obs_code (expect 401/403 when route exists)"

pub_code="$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BE/public/events" \
  -H 'Content-Type: application/json' \
  -d '{"events":[{"eventName":"landing_viewed","occurredAt":"2026-08-07T00:00:00.000Z","sessionId":"gate","anonymousId":"gate","idempotencyKey":"phase21:gate:public"}]}' || true)"
echo "POST /public/events HTTP: $pub_code (expect 202 when Phase 2 deployed; 404 if not)"

echo "Done."
