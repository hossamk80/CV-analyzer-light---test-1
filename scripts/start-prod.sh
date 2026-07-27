#!/bin/bash
# Smart Recruitment Suite - Unix Production Runner
cd "$(dirname "$0")/.."

echo "[INFO] Building production client and server bundles..."
if command -v pnpm &> /dev/null; then
    pnpm run build
else
    npm run build
fi

echo "[INFO] Starting production server..."
export NODE_ENV=production
node dist/server.cjs
