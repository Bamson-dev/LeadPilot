#!/bin/bash
set -euo pipefail

BACKEND_URL=${1:-"http://localhost:3000"}
BACKEND_URL="${BACKEND_URL%/}"

echo "Testing LeadThur backend at $BACKEND_URL"
echo "============================================"

echo ""
echo "Test 1 — Health check"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")
if [ "$RESPONSE" = "200" ]; then
  echo "PASS — /health returned 200"
else
  echo "FAIL — /health returned $RESPONSE"
fi

echo ""
echo "Test 2 — API health check"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/health")
if [ "$RESPONSE" = "200" ]; then
  echo "PASS — /api/health returned 200"
else
  echo "FAIL — /api/health returned $RESPONSE"
fi

echo ""
echo "Test 3 — Confirm NOT serving Next.js"
CONTENT=$(curl -s "$BACKEND_URL/health")
if echo "$CONTENT" | grep -qi "Next.js"; then
  echo "FAIL — Response contains Next.js. Wrong container is running."
  echo "       Coolify: Base Directory = / , Dockerfile Path = backend/Dockerfile"
else
  echo "PASS — Response does not contain Next.js"
fi

echo ""
echo "Test 4 — Health response body"
curl -s "$BACKEND_URL/health" | head -c 200
echo ""

echo ""
echo "Test 5 — Ready endpoint"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health/ready")
if [ "$RESPONSE" = "200" ]; then
  echo "PASS — /health/ready returned 200"
else
  echo "FAIL — /health/ready returned $RESPONSE"
fi

echo ""
echo "============================================"
echo "Run against production:"
echo "  bash backend/scripts/verify-deployment.sh https://backend.leadthur.com"
