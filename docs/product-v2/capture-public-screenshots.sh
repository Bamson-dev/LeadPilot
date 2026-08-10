#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:3010"
OUT="/Users/donbamz/LeadRush/docs/product-v2/public-journey-screenshots"

pages=(
  "landing:/"
  "freetrial-gate:/freetrial"
  "checkout:/checkout"
  "activate:/activate"
  "about:/about"
  "blog:/blog"
)

viewports=(
  "desktop:1440,900"
  "tablet:768,1024"
  "mobile:390,844"
)

for vp in "${viewports[@]}"; do
  name="${vp%%:*}"
  size="${vp##*:}"
  w="${size%%,*}"
  h="${size##*,}"
  for page in "${pages[@]}"; do
    slug="${page%%:*}"
    path="${page##*:}"
    file="$OUT/$name/${slug}-${name}.png"
    npx --yes playwright@1.49.1 screenshot \
      --viewport-size="$w,$h" \
      --wait-for-timeout=2500 \
      "${BASE}${path}" \
      "$file"
    echo "Saved $file"
  done
done
