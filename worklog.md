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
