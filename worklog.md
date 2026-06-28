---
Task ID: jumbo-royale-mvp
Agent: main (Super Z)
Task: Build a free, online, multiplayer, co-op checkers-variant web game for friends

Work Log:
- Initialized Next.js 16 fullstack project with Tailwind 4 + shadcn/ui
- Installed socket.io + socket.io-client
- Designed Prisma schema (Player, Match, MatchPlayer) — groundwork for future persistent accounts (currently guest-only)
- Built pure TypeScript game engine: types, board init, move calculation, captures, chain captures, king promotion, character classes (tank/speedster/mage/jester), power-ups, chaos events, boss AI
- Built Socket.IO authoritative game server as a mini-service on port 3003 — handles room create/join, player slots, team balance, turn management, move validation, boss AI turns, chaos events, turn timeouts, emotes, chat
- Built Zustand store on client with realtime sync via Socket.IO
- Designed playful cartoonish visual identity: hot pink + electric blue + sunny yellow + deep purple, Fredoka font, googly-eyed pieces, bouncy shadows, animated emojis
- Built screens: landing (name + create/join), lobby (player list, team pick, character pick, ready, chat), game (mobile-first board, HUD with turn timer + scores + boss HP, emote wheel, chaos event banner, ability targeting), end screen (winner + scores + play again)
- Fixed multiple bugs found via Agent Browser testing:
  - Board tile color formula (was preventing all moves)
  - Piece placement orientation (red at bottom moving up)
  - nextTurn wasn't broadcasting after setTimeout
  - Forced-capture rule was filtering non-capturing pieces incorrectly
  - Selection of opponent pieces is now ignored for better UX
- Verified end-to-end with two parallel browser sessions (PvP and Co-op): both players see synced state, turns switch correctly, moves apply, boss AI acts in co-op, emotes float, chat works

Stage Summary:
- 100% free hosting stack: Next.js on Vercel + Socket.IO mini-service (can deploy on Render/Railway free tier or run embedded)
- Mobile-first responsive design with iPhone 14 viewport tested
- Guest names with localStorage persistence; Prisma schema ready for future account upgrade
- Game features working: PvP (2-6 players), Co-op vs Boss King (2-6 humans vs AI), 4 character classes, 6 power-up types, 5 chaos events, emote wheel (12 emojis), chat, turn timer with auto-skip, king promotion, chain captures, character abilities (mage teleport, jester swap)
- Files: src/game/{types,board,engine,rules}.ts, src/stores/jumbo.ts, src/lib/socket/client.ts, src/components/game/{PieceVisual,GameBoard,GameHUD,LobbyScreen}.tsx, src/app/page.tsx, mini-services/game-service/index.ts, prisma/schema.prisma
- Lint clean, no build errors, dev server running on port 3000, game-service on port 3003

---
Task ID: jumbo-royale-v2-sound-ai-selfhost
Agent: main (Super Z)
Task: Add sound effects, smart AI bots, and self-hosting capability

Work Log:
- Installed howler + @types/howler for audio infrastructure
- Built procedural SFX library (src/lib/sound.ts) using Web Audio API — generates 18 sound types (move, capture, multi_capture, king, select, click, chaos, emote, win, lose, join, leave, error, turn_yours, boss_rage, teleport, swap, freeze, powerup, chat) with zero external asset files (keeps the game self-contained and free to host)
- Hooked sound triggers into Zustand store — fires automatically on state diffs (phase changes, captures, turn changes, chaos events, emotes, boss rage, king promotion, win/lose)
- Added SoundToggle component on home, lobby, and game screens
- Designed BotDifficulty type (easy/medium/hard/brutal) with depth 2/4/6/7 minimax
- Built smart minimax AI in src/game/ai.ts with alpha-beta pruning:
  * Material evaluation (pawn=30, king=50, HP/shield bonuses)
  * Positional: advancement, back-row defense, center control, king mobility
  * Tactical: vulnerability detection (pieces that can be captured)
  * Strategic: power-up proximity bonuses
  * Boss HP weighting for co-op mode
  * Randomness factor (40% for easy, 0% for brutal)
- Added ability-aware bot decision-making (mage teleports to enable captures/promotions, jester swaps to escape danger)
- Added bot infrastructure on server: makeBotSlot, bot:add/bot:remove socket events, runBotMove, runBotChainCapture
- Integrated bot turns into nextTurn() — auto-schedules bot move when current player is a bot, with difficulty-scaled think times (600ms-1500ms)
- Fixed co-op turn rotation: red players now cycle (each gets a turn), so bot teammates actually play
- Added bot management UI in lobby: 4 difficulty buttons (Easy/Medium/Hard/Brutal) with descriptions, bot badge with difficulty, remove button
- Made socket URL env-configurable: NEXT_PUBLIC_SOCKET_URL, NEXT_PUBLIC_SOCKET_PORT, NEXT_PUBLIC_USE_GATEWAY_QUERY
- Made game-service port configurable via GAME_SERVICE_PORT env var
- Created Dockerfile (multi-stage build: deps → build → runtime)
- Created docker-compose.yml with 3 services (caddy reverse proxy + web + game-service)
- Created Caddyfile.prod with auto-HTTPS support (just swap :80 for your domain)
- Created docker-entrypoint.sh for single-container deployments
- Created scripts/start-all.ts for non-Docker production (runs both services in one process group)
- Created .env.example with all env vars documented
- Created comprehensive README.md with 4 deployment paths: Docker Compose, bare metal, free cloud (Vercel+Render), Railway
- Verified end-to-end with Agent Browser:
  * PvP vs Brutal bot: bot moves intelligently, takes turns correctly
  * Co-op with Hard bot teammate: bot plays on red team rotation, boss AI also takes turns
  * Sound effects: Web Audio context available, fires on state changes
  * All 4 bot difficulties available in lobby UI
  * Bots show as 🤖 with difficulty badge
  * Bots can be removed by host before game starts

Stage Summary:
- Sound: 18 procedural SFX, mute toggle on all screens, fires automatically on game events
- AI: minimax depth 7 (brutal) with alpha-beta pruning + smart ability usage; 4 difficulty levels
- Bots: host can add up to 5 bots per room, auto-balanced teams in PvP, join red team in co-op
- Self-hosting: 4 deployment paths documented, env vars for all configuration, Docker one-command deploy
- Files added: src/lib/sound.ts, src/game/ai.ts, src/components/game/SoundToggle.tsx, Dockerfile, docker-compose.yml, Caddyfile.prod, docker-entrypoint.sh, scripts/start-all.ts, .env.example, .dockerignore, README.md
- Files modified: src/game/types.ts (BotDifficulty), src/stores/jumbo.ts (sound + bot actions), src/lib/socket/client.ts (env-aware), src/components/game/{LobbyScreen,GameHUD,GameBoard}.tsx, mini-services/game-service/index.ts (bot support + env port + co-op rotation), package.json (scripts), prisma/schema.prisma unchanged
- Lint clean, dev server healthy, all features verified working in browser
