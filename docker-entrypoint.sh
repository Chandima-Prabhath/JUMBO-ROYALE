#!/bin/sh
# Jumbo Royale - Docker entrypoint
# Starts both the Next.js web app and the Socket.IO game service.
set -e

echo "[entrypoint] Starting Jumbo Royale..."
echo "[entrypoint] Web app on port ${PORT:-3000}"
echo "[entrypoint] Game service on port ${GAME_SERVICE_PORT:-3003}"

# Initialize database (creates SQLite file if needed)
cd /app
bunx prisma db push --skip-generate || true

# Start game service in background
cd /app/mini-services/game-service
bun index.ts &
GAME_PID=$!
echo "[entrypoint] Game service PID: $GAME_PID"

# Start Next.js in foreground
cd /app
NODE_ENV=production exec bun .next/standalone/server.js
