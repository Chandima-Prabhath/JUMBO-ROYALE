# ===========================================================================
# Jumbo Royale - Multi-stage Dockerfile
# Builds both the Next.js web app and the Socket.IO game service in one image.
# Use docker-compose for one-command self-hosting.
# ===========================================================================

# ---- Stage 1: Install deps ----
FROM oven/bun:1.3 AS deps
WORKDIR /app

# Copy package manifests first for better caching
COPY package.json bun.lock ./
COPY prisma ./prisma

# Install root deps
RUN bun install --frozen-lockfile

# Copy game-service deps
COPY mini-services/game-service/package.json ./mini-services/game-service/package.json
RUN cd mini-services/game-service && bun install --frozen-lockfile

# ---- Stage 2: Build ----
FROM oven/bun:1.3 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/mini-services/game-service/node_modules ./mini-services/game-service/node_modules
COPY . .

# Build Next.js
RUN bun run db:generate
RUN bun run build

# ---- Stage 3: Runtime ----
FROM oven/bun:1.3 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV GAME_SERVICE_PORT=3003
ENV DATABASE_URL=file:/app/data/jumbo.db

# Install a tiny process manager to run both services
RUN bun add -g pm2 || true

# Copy built artifacts
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/mini-services ./mini-services
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/db ./db
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock

# Ensure data dir exists for SQLite
RUN mkdir -p /app/data

# Expose ports
EXPOSE 3000 3003

# Start both services with a simple shell script (no pm2 dependency)
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
