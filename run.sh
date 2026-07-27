#!/bin/bash
# Smart Recruitment Suite - Unix Development Runner
cd "$(dirname "$0")/.."

if [ ! -d "node_modules" ]; then
    echo "[INFO] node_modules not found. Installing dependencies..."
    # Fallback to standard pnpm or npm
    if command -v pnpm &> /dev/null; then
        pnpm install
    else
        npm install
    fi
fi

echo "[INFO] Launching local development server..."
if command -v pnpm &> /dev/null; then
    pnpm run dev
else
    npm run dev
fi
