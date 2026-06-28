# 🎮 Jumbo Royale

**Silly co-op checkers chaos for friends** — a free, online, multiplayer checkers-variant web game.

Built with Next.js 16 + Socket.IO + TypeScript. 100% free to host. Mobile-first. No signup required.

---

## ✨ Features

- **Two game modes** (equally supported):
  - ⚔️ **PvP Chaos** — 2-6 players, last piece standing
  - 🤝 **Co-op vs Boss King** — 2-6 humans team up against an AI boss with HP bar + rage mode
- **4 character classes**: 🛡️ Tank (2HP + shield), ⚡ Speedster, 🧙 Mage (1× teleport), 🤡 Jester (1× swap)
- **6 power-up tiles**: ⚡ Double Move, 🧊 Freeze, 🌀 Swap, 💣 Bomb, 🛡️ Shield, 🔁 Extra Jump
- **5 chaos events** every 60s: gravity flip, ice age, shrink, double trouble, frenzy
- **Smart AI bots** with 4 difficulty levels (Easy / Medium / Hard / Brutal) using minimax + alpha-beta pruning
- **Sound effects** (procedurally generated via Web Audio API — no asset files needed)
- **Emote wheel**, lobby chat, turn timer, king promotion, chain captures
- **Mobile-first responsive design** with playful cartoonish visual identity
- **Guest names** with localStorage persistence; Prisma schema ready for future account upgrades

---

## 🚀 Quick start (local dev)

### Prerequisites
- [Node.js](https://nodejs.org/) 20+ OR [Bun](https://bun.sh/) 1.1+
- That's it. No external services required.

### Run

```bash
# 1. Install dependencies
bun install
cd mini-services/game-service && bun install && cd ../..

# 2. Set up the database (SQLite — zero config)
cp .env.example .env
bun run db:push

# 3. Start the Socket.IO game service (in a separate terminal)
bun run game-service

# 4. Start the Next.js dev server (in another terminal)
bun run dev
```

Open http://localhost:3000 and play!

> **Note:** The dev sandbox uses a Caddy gateway on port 81 that auto-routes traffic between Next.js (3000) and the game service (3003). The client auto-detects this. For your own dev environment, you may need to set `NEXT_PUBLIC_SOCKET_PORT=3003` in `.env` so the browser knows where to find the socket server.

---

## 🐳 Self-hosting with Docker (recommended)

The easiest way to deploy Jumbo Royale is with Docker Compose — it bundles the web app, game service, and a Caddy reverse proxy into one stack.

### Quick deploy

```bash
# Clone the repo
git clone <your-repo-url> jumbo-royale
cd jumbo-royale

# (Optional) Edit Caddyfile.prod to use your domain instead of :80

# Build and start everything
docker compose up -d --build
```

Your game is now live at **http://localhost** (or your domain if you set one in Caddyfile.prod).

### With a custom domain + automatic HTTPS

Edit `Caddyfile.prod`:

```
jumbo.example.com {
    # ... (same content as :80 block)
}
```

Then:

```bash
docker compose up -d --build
```

Caddy will auto-provision a Let's Encrypt TLS certificate. Your game is now at `https://jumbo.example.com`.

### Docker Compose services

| Service | Port | Purpose |
|---------|------|---------|
| `caddy` | 80, 443 | Reverse proxy + auto-TLS |
| `web` | 3000 (internal) | Next.js app |
| `game-service` | 3003 (internal) | Socket.IO server |

---

## 🛠 Self-hosting without Docker (VPS / bare metal)

For a simple VPS deployment without Docker:

### Option A: Single process (`start:all`)

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Clone and install
git clone <your-repo-url> jumbo-royale
cd jumbo-royale
bun install
cd mini-services/game-service && bun install && cd ../..

# Build
bun run db:push
bun run build

# Run both web + socket in one process group
bun run start:all
```

### Option B: Two processes (recommended for production)

```bash
# Terminal 1: game service
cd mini-services/game-service
NODE_ENV=production bun index.ts

# Terminal 2: web app
NODE_ENV=production bun .next/standalone/server.js
```

### Option C: With a process manager (PM2 / systemd)

Use `ecosystem.config.cjs`:

```js
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'jumbo-web',
      script: '.next/standalone/server.js',
      env: { NODE_ENV: 'production', PORT: 3000 },
    },
    {
      name: 'jumbo-sockets',
      script: 'mini-services/game-service/index.ts',
      env: { NODE_ENV: 'production', GAME_SERVICE_PORT: 3003 },
    },
  ],
}
```

Then `pm2 start ecosystem.config.cjs`.

### Nginx reverse proxy example

```nginx
server {
    listen 80;
    server_name jumbo.example.com;

    # Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO (route by query param)
    location / {
        if ($arg_XTransformPort) {
            proxy_pass http://127.0.0.1:$arg_XTransformPort;
        }
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Or simpler — run the socket server on a subdomain:

```nginx
server {
    listen 80;
    server_name sockets.example.com;
    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Then set `NEXT_PUBLIC_SOCKET_URL=https://sockets.example.com` in `.env` before building.

---

## ☁️ Free cloud hosting options

### Vercel (frontend) + Render (socket service) — free tiers

1. **Frontend on Vercel:**
   - Push repo to GitHub
   - Import to Vercel
   - Set env var `NEXT_PUBLIC_SOCKET_URL=wss://your-render-app.onrender.com`
   - Deploy

2. **Socket service on Render:**
   - Create new Web Service from same repo
   - Build command: `cd mini-services/game-service && bun install`
   - Start command: `cd mini-services/game-service && bun index.ts`
   - Set env var `GAME_SERVICE_PORT=10000` (or whatever Render assigns)
   - Deploy

3. **Database:** SQLite works for a single instance. For multi-instance, use:
   - [Neon](https://neon.tech) Postgres free tier
   - [Supabase](https://supabase.com) free tier
   - [Railway](https://railway.app) Postgres free trial

### Railway (one service, both processes)

Use the `start:all` script as your start command.

### Fly.io

Use the included Dockerfile with `fly launch`.

---

## ⚙️ Configuration

All configuration is via environment variables. See [`.env.example`](./.env.example) for the full list.

### Server-side

| Var | Default | Description |
|-----|---------|-------------|
| `PORT` | `3000` | Next.js port |
| `GAME_SERVICE_PORT` | `3003` | Socket.IO port |
| `DATABASE_URL` | `file:./db/jumbo.db` | Prisma database URL (SQLite or Postgres) |

### Client-side (must start with `NEXT_PUBLIC_`)

| Var | Default | Description |
|-----|---------|-------------|
| `NEXT_PUBLIC_SOCKET_URL` | (auto) | Full URL to socket server (e.g. `https://sockets.example.com`) |
| `NEXT_PUBLIC_SOCKET_PORT` | (auto) | Port on same host as the web app |
| `NEXT_PUBLIC_USE_GATEWAY_QUERY` | `false` | Set to `true` only in the Z.ai dev sandbox |

The client auto-detects the best endpoint:
1. If `NEXT_PUBLIC_SOCKET_URL` is set → use it directly
2. Else if `NEXT_PUBLIC_SOCKET_PORT` is set → use `same-host:that-port`
3. Else if running on `localhost:3000` → fall back to `localhost:81` (dev sandbox gateway)
4. Else → use same origin (production reverse proxy)

---

## 🎯 How to play

1. **Create a room** (PvP or Co-op) or **join with a 4-letter code**
2. **Pick your team** (PvP only) and **character class**
3. (Host only) **Add bots** if you want to fill empty slots — choose difficulty
4. **Tap ready**, host taps **Start Game**
5. **Tap your piece**, then tap a **green tile** to move
6. **Jump enemies** to capture them — chain jumps = combo bonus + sound effects
7. **Reach the far row** to become a 👑 King (moves both directions)
8. **Grab power-ups** for chaos
9. **Emote wheel** (bottom-right) for reactions
10. Every 60s a **chaos event** flips the board

---

## 🏗 Architecture

```
┌─────────────────┐         ┌─────────────────────┐
│  Browser (you)  │ ◄────► │  Caddy reverse proxy │ :80/:443
│  Next.js SPA    │         │  (auto-routes /web   │
│                 │         │   and /sockets)      │
└─────────────────┘         └──────────┬───────────┘
                                       │
                       ┌───────────────┴───────────────┐
                       │                               │
                       ▼                               ▼
              ┌─────────────────┐            ┌─────────────────┐
              │  Next.js (3000) │            │ Socket.IO (3003)│
              │  React UI       │            │ Authoritative   │
              │  Zustand store  │            │ game state, AI  │
              │  Sound manager  │            │ Bot turns       │
              └─────────────────┘            └─────────────────┘
                                                      │
                                                      ▼
                                             ┌─────────────────┐
                                             │  Prisma + DB    │
                                             │  (SQLite/PG)    │
                                             │  Players,       │
                                             │  Matches (future│
                                             │  accounts)      │
                                             └─────────────────┘
```

### Game engine

The game logic lives in `src/game/` as **pure TypeScript** (no React, no IO) — easy to unit-test:

- `types.ts` — All shared types
- `board.ts` — Board setup, piece placement, power-up distribution
- `engine.ts` — Move calculation, captures, chain captures, king promotion, abilities
- `rules.ts` — Win conditions, chaos events, boss AI
- `ai.ts` — Minimax with alpha-beta pruning, bot decision-making, ability usage

### Real-time server

`mini-services/game-service/index.ts` is the authoritative Socket.IO server. It:
- Holds all game state in memory (rooms map)
- Validates every move server-side (clients can't cheat)
- Runs bot AI for bot players
- Auto-cleans empty rooms after 5 minutes
- Persists match results to Prisma DB (groundwork for future leaderboards)

---

## 🧪 Testing

```bash
# Lint
bun run lint

# Type-check
bunx tsc --noEmit
```

(Automated test suite TBD — the game engine is structured for easy unit testing.)

---

## 📂 Project structure

```
jumbo-royale/
├── src/
│   ├── app/                    # Next.js App Router (single page)
│   │   ├── page.tsx            # Main game UI (home / lobby / game / ended)
│   │   ├── layout.tsx          # Root layout with fonts
│   │   └── globals.css         # Tailwind + playful theme
│   ├── game/                   # Pure TS game engine
│   │   ├── types.ts
│   │   ├── board.ts
│   │   ├── engine.ts
│   │   ├── rules.ts
│   │   └── ai.ts               # Minimax AI
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   └── game/
│   │       ├── PieceVisual.tsx
│   │       ├── GameBoard.tsx
│   │       ├── GameHUD.tsx
│   │       ├── LobbyScreen.tsx
│   │       └── SoundToggle.tsx
│   ├── stores/
│   │   └── jumbo.ts            # Zustand store (realtime sync)
│   ├── lib/
│   │   ├── socket/client.ts    # Socket.IO client (env-aware)
│   │   ├── sound.ts            # Procedural SFX via Web Audio
│   │   └── db.ts               # Prisma client
│   └── hooks/
├── mini-services/
│   └── game-service/           # Socket.IO authoritative server
│       ├── index.ts
│       └── package.json
├── prisma/
│   └── schema.prisma           # Player, Match, MatchPlayer models
├── scripts/
│   └── start-all.ts            # Prod entry: starts both services
├── public/
├── Dockerfile                  # Multi-stage build
├── docker-compose.yml          # One-command self-host
├── Caddyfile                   # Dev sandbox gateway
├── Caddyfile.prod              # Production reverse proxy
├── .env.example                # All env vars documented
└── README.md                   # You are here
```

---

## 🗺 Roadmap

- [ ] Persistent accounts (NextAuth + Prisma) — schema already in place
- [ ] Leaderboards
- [ ] Cosmetics (skins, hats)
- [ ] Spectator mode
- [ ] More chaos events
- [ ] Replay system
- [ ] Tournament mode

---

## 📜 License

MIT — do whatever you want. Have fun!

---

## 🙏 Credits

Built with:
- [Next.js](https://nextjs.org) 16
- [Socket.IO](https://socket.io)
- [Tailwind CSS](https://tailwindcss.com) 4
- [shadcn/ui](https://ui.shadcn.com)
- [Framer Motion](https://www.framer.com/motion/)
- [Zustand](https://zustand.docs.pmnd.rs/)
- [Prisma](https://www.prisma.io)
- [Bun](https://bun.sh)
- [Caddy](https://caddyserver.com)

Made with 💖 for friends who want to have silly checkers chaos together.
