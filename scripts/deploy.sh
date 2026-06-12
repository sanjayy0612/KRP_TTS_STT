#!/bin/bash
# ============================================================
# deploy.sh — Build TypeScript + Deploy to Catalyst
# ============================================================

set -e

FUNCTIONS="orchestrator fn-search-fir fn-crime-by-type fn-hotspot-data fn-trend-analysis fn-accused-lookup fn-station-stats fn-summary-stats"

echo "🚀 KSP Datathon — Strix Team Deploy"
echo "======================================"

# Sync shared files into each function before build
echo "📦 Syncing shared/ into each function..."
for fn in $FUNCTIONS; do
  if [ "$fn" != "orchestrator" ]; then
    cp shared/db.ts    functions/$fn/db.ts
    cp shared/tools.ts functions/$fn/tools.ts
    cp -r shared/types functions/$fn/types
  fi
done

# Build + deploy each function
echo ""
echo "🔧 Building & deploying functions..."
for fn in $FUNCTIONS; do
  echo "  → Building $fn ..."
  cd functions/$fn
  npm install --silent
  npm run build
  cd ../..
  echo "  → Deploying $fn ..."
  catalyst deploy function --name $fn
  echo "  ✅ $fn done"
done

# Deploy API Gateway
echo ""
echo "🌐 Updating API Gateway..."
catalyst deploy apigateway

echo ""
echo "======================================"
echo "✅ All done!"
echo "======================================"
