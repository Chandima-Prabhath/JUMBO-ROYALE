# Jumbo Royale — Game Codex

This document is the **single source of truth** for all game rules, mechanics, and balance.
All code (engine, server, AI, client) MUST conform to this document.

---

## 1. Game Modes

### PvP Chaos
- 2–6 players, split into Red and Blue teams (max 3 per team).
- Red starts at rows 6–7 (bottom). Blue starts at rows 0–1 (top).
- Turn order: Red → Blue → Red → Blue (each team gets one turn at a time).
- In multi-player teams, players on the same team cycle (Player A → Player B → Player A).
- **Win condition**: Eliminate all enemy pieces, OR enemy has no legal moves (stalemate).
- **Game pacing**: Game ends after 80 total turns or 20 turns without any capture — team with more pieces wins.

### Co-op vs Boss King
- 2–6 human players, all on Red team, vs AI Boss.
- Red starts at rows 6–7 (bottom). Boss King + minions start at rows 0–2 (top).
- Turn order: Red Player 1 → Boss → Red Player 2 → Boss → ... (red players cycle).
- Boss gets 1 move per turn (2 moves when raging at ≤50% HP).
- Boss summons a minion every 3rd turn when raging.
- **Win condition**: Kill the Boss King (all boss pieces eliminated), OR all humans are dead.
- **Game pacing**: Game ends after 100 total turns — Boss wins.

---

## 2. Pieces

### Piece Composition (Mixed, Chess-like)
Each player controls **8 pieces** in a mixed composition:
- 2 Tanks (back row)
- 2 Speedsters (front row)
- 2 Mages (middle)
- 1 Jester (wildcard)
- 1 of player's chosen character (majority — makes the lobby choice meaningful)

If there aren't enough slots (multi-player), pieces are trimmed from the end.

### Character Stats

| Character | HP | Passive | Active Ability | Ability Uses | Ability Ends Turn? |
|---|---|---|---|---|---|
| **Tank** | 2 | Starts with shield (absorbs 1 capture) | None | — | — |
| **Speedster** | 1 | **Dash**: can move 2 squares forward (if both empty) | None | — | — |
| **Mage** | 1 | None | **Teleport**: move to any empty dark cell within 3 tiles | 1 per game | YES |
| **Jester** | 1 | None | **Swap**: swap places with an adjacent piece (within 2 tiles) | 1 per game | YES |

### King Promotion
- A pawn becomes a King when it reaches the **far row** (row 0 for Red, row 7 for Blue/Boss).
- **ONLY normal moves (simple or capture) trigger king promotion.**
- Abilities (Mage teleport, Jester swap) do **NOT** trigger king promotion.
- Kings can move and capture in ALL diagonal directions (forward and backward).

### Piece State
```typescript
interface Piece {
  id: string
  team: 'red' | 'blue' | 'boss'
  character: 'tank' | 'speedster' | 'mage' | 'jester'
  row: number
  col: number
  isKing: boolean
  hp: number              // Tank starts at 2, others at 1
  hasShield: boolean      // Tank starts with true
  frozenTurns: number     // 0 = not frozen; >0 = can't move, decrements each turn end
  abilityUsed: boolean    // false = ability available; true = used (permanent)
  facing: 'left' | 'right'
  ownerName: string
  ownerAvatar?: string
}
```

---

## 3. Movement Rules

### Simple Moves (non-capture)
- **Pawns** (non-king): move 1 square **diagonally forward** only.
  - Red moves toward row 0 (up): directions `[-1, -1]` and `[-1, 1]`.
  - Blue/Boss moves toward row 7 (down): directions `[1, -1]` and `[1, 1]`.
- **Kings**: move 1 square diagonally in **ALL 4 directions**.
- **Speedster Dash**: Speedster pawns can move **2 squares forward** (same diagonal direction) if BOTH the intermediate and destination squares are empty and not blocked.
- Destination must be:
  - In bounds
  - Empty (no piece)
  - Not a blocked cell

### Capture Moves (American Checkers Rules)
- **Pawns** (non-king): can only capture **FORWARD** (same direction as simple moves).
  - Red pawns capture toward row 0 (up).
  - Blue/Boss pawns capture toward row 7 (down).
- **Kings**: can capture in **ALL 4 diagonal directions** (forward and backward).
- A capture jumps over an adjacent enemy piece to land on the empty square 2 tiles away.
- The captured piece's HP decreases by 1. If HP reaches 0, it's removed.
- If the captured piece has a shield, the shield absorbs the hit (shield breaks, HP stays at minimum 1).

### Chain Captures (Forced)
- If a piece can capture, it **MUST** capture (forced capture rule).
- After a capture, if the same piece can capture again from its new position, it **MUST** continue (chain capture).
- Chain captures continue until no more captures are available from the current position.
- During a chain, the piece can capture in any diagonal direction (not just the initial direction).

### Forced Capture at Team Level
- If ANY piece on the current team can capture, then ONLY capturing moves are legal for the entire team.
- Non-capturing moves are not allowed when a capture is available anywhere on the team.

---

## 4. Power-Ups

Power-ups spawn on random dark cells in the middle rows (2–5) at game start (6 power-ups).

| Power-Up | Effect | Trigger | Duration |
|---|---|---|---|
| 🛡️ Shield | Grants shield to collector | Immediate | Permanent until broken |
| 🧊 Freeze | Freezes nearest enemy piece | Immediate | 1 enemy turn (skips their next turn) |
| 🌀 Swap | Swaps collector with random enemy | Immediate | Instant |
| 💣 Bomb | Destroys adjacent enemy (lowest HP) | Immediate | Instant |
| ⚡ Double Move | Player moves again this turn | On next move end | 1 bonus move |
| 🔁 Extra Jump | Player moves again this turn | On next move end | 1 bonus move |

### Power-Up Pickup
- Picking up a power-up happens when a piece **lands on** the power-up cell via a normal move or capture.
- Mage teleport CAN pick up power-ups at the destination.
- Picking up a power-up gives +5 score bonus.
- The power-up cell is cleared after pickup.

### Freeze Mechanics
- `frozenTurns = 1` when frozen.
- At the end of the frozen team's turn, `frozenTurns` decrements to 0.
- A frozen piece cannot move or capture.
- If ALL pieces on a team are frozen, the turn is **skipped** (not a loss).
- The `turn_skipped` event is emitted with a visual notification.

---

## 5. Abilities

### Mage — Teleport
- **Range**: Any empty dark cell within 3 tiles (Chebyshev distance).
- **Uses**: 1 per game (per piece). `abilityUsed` set to `true` permanently.
- **Effect**: Piece moves to target cell. Picks up power-up at destination if present.
- **King promotion**: Does NOT trigger.
- **Chain captures**: If the teleport lands in a capture position, chain captures ARE allowed.
- **Turn**: Using the ability **ENDS the turn** (unless chain captures or bonus move follows).
- **Bot AI**: Uses teleport only if it enables a capture from the new position.

### Jester — Swap
- **Range**: Adjacent pieces only (within 2 tiles Chebyshev distance).
- **Uses**: 1 per game (per piece). `abilityUsed` set to `true` permanently.
- **Effect**: Swaps positions with target piece (friend or foe).
- **King promotion**: Does NOT trigger.
- **Turn**: Using the ability **ENDS the turn**.
- **Bot AI**: Uses swap only if the piece is vulnerable (can be captured next turn).

### Tank — No ability
### Speedster — No ability (passive Dash always active)

---

## 6. Turn Structure

### Turn Flow
1. **Turn starts**: `turnStartedAt = Date.now()`, timer begins (30 seconds).
2. **Player acts**: Makes a move, uses an ability, or times out.
3. **Move resolution**:
   - Apply move to board
   - Check for captures → update HP/shields
   - Pick up power-up if landed on one
   - Check for king promotion (normal moves only)
   - Check for chain captures → if available, player continues
   - Check for bonus move (double_move/extra_jump) → if collected, player moves again
   - Check for winner
4. **Turn ends**: `nextTurn()` called, decrement frozen turns, switch team/player, check for chaos event.

### Turn Timer
- 30 seconds per turn.
- If timer expires, turn is force-ended (`nextTurn` called by server ticker).
- Timer resets on bonus moves (double_move/extra_jump).

### Chaos Events
- Trigger every 60 seconds.
- Random event from: `ice_age`, `shrink`, `double_trouble`, `frenzy`, `power_rain`.
- `gravity_flip` is **DISABLED** (breaks pawn movement).
- `power_rain`: spawns 4 new power-ups on empty dark cells.
- `shrink`: blocks outer ring for 3 turns.
- Others: affect gameplay rules transiently.

---

## 7. Game Restart ("Play Again")

When the host clicks "Play Again" after a game ends:
1. **Phase** resets to `lobby`.
2. **All players**: `ready = false`, `captures = 0`, `score = 0`.
3. **Board**: Recreated fresh (new power-ups, new piece placement).
4. **Pieces**: All pieces reset — `isKing = false`, `hp` reset to character default, `hasShield` reset (Tank = true, others = false), `frozenTurns = 0`, `abilityUsed = false`.
5. **Boss state** (co-op): Reset to initial HP, `rage = false`.
6. **Game state**: `turnCount = 0`, `turnsWithoutCapture = 0`, `chaosCount = 0`, `winnerTeam = undefined`, `endedAt = undefined`, `emoteLog = []`.
7. **Client state**: `lastMove = null`, `moveLog = []`, `botThinking = null`, `turnSkipped = null`, `bonusMove = null`, `powerupCollected = null`, `selectedPieceId = null`, `legalMoves = []`, `_stateQueue = []`, `_processingQueue = false`.

**CRITICAL**: The board must be completely fresh. No stale piece state from the previous game.

---

## 8. Bot AI

### Difficulty Levels
| Level | Minimax Depth | Randomness | Think Time |
|---|---|---|---|
| Easy | 2 | 40% random move | 600ms |
| Medium | 4 | 15% random move | 900ms |
| Hard | 6 | 3% random move | 1200ms |
| Brutal | 7 | 0% (optimal) | 1500ms |

### Bot Behavior
- Bots use minimax with alpha-beta pruning to pick moves.
- Bots can use abilities (Mage teleport, Jester swap) following the same rules as humans:
  - `abilityUsed` is set to `true` after use — bot CANNOT use ability again.
  - Ability use ends the turn.
- Bot chain captures: bot continues capturing greedily (picks capture with most pieces).
- Bot bonus moves: bot moves again if double_move/extra_jump collected.
- Bot thinking indicator (⚙️) shows while computing.

### Bot Ability Decision (shouldUseAbility)
- **Mage**: Teleport only if it enables a capture from the new position (simulated).
- **Jester**: Swap only if the piece is currently vulnerable (can be captured next turn).
- Both respect range limits (Mage: 3 tiles, Jester: 2 tiles).

---

## 9. Win Conditions

### PvP
- **Elimination**: All pieces of one team eliminated → other team wins.
- **Stalemate**: Current team has no legal moves AND not all pieces frozen → other team wins.
- **All frozen**: All pieces frozen → turn skipped (not a loss).
- **Turn limit**: 80 total turns → team with more pieces wins.
- **No-capture limit**: 20 turns without any capture → team with more pieces wins.

### Co-op
- **Boss dead**: All boss pieces eliminated → Red wins.
- **All humans dead**: All red pieces eliminated → Boss wins.
- **Red stuck**: Red has no legal moves AND not all frozen → Boss wins.
- **Turn limit**: 100 total turns → Boss wins.

---

## 10. Scoring

| Action | Points |
|---|---|
| Capture 1 piece | +10 |
| Chain capture (2+ in one turn) | +10 per piece + 20 combo bonus |
| Pick up power-up | +5 |
| Win the game | — (no score bonus, just victory) |

---

## 11. Client State

### Store Fields
- `state`: GameState (authoritative, from server)
- `selectedPieceId`: currently selected piece
- `legalMoves`: legal moves for selected piece
- `lastMove`: last move made (for board highlight)
- `moveLog`: last 20 moves with player name, notation, AI reasoning
- `botThinking`: { playerName } | null
- `turnSkipped`: { team, reason } | null
- `bonusMove`: { pieceId, powerUp } | null
- `powerupCollected`: { playerName, powerUp, effects } | null
- `_stateQueue`: GameState[] (animation queue)
- `_processingQueue`: boolean

### Animation Queue
- When a state update includes piece movement, it's queued (not applied immediately).
- Each queued state is applied with a 550ms delay.
- This ensures chain captures animate step-by-step.
- States without piece movement (turn changes, ready states) are applied immediately.

### Piece Animation
- Pieces render in an absolutely-positioned overlay layer.
- Jump-arc animation: pieces lift up (30px), move horizontally, land.
- Duration: 0.5s with easeOut timing.
- Same animation in both real game and tutorial.

---

## 12. Visual Identity

### Team Colors
- Red: `#ff4fa3` (hot pink)
- Blue: `#4f7bff` (electric blue)
- Boss: `#9b59b6` (purple)

### Piece Visuals
- Each piece has a team-colored base ring (always visible).
- Character face SVG on top (Tank helmet, Speedster goggles, Mage hat, Jester bells).
- King crown floats above piece.
- Frozen overlay (ice crystal).
- Shield badge.
- HP badge (if HP > 1).

### Board
- 8×8 grid, dark cells are purple, light cells are cream.
- Power-up tiles show colored icon.
- Move targets: green pulsing dots.
- Ability targets: yellow pulsing dots.
- Last move: blue ring on source, yellow ring on destination.
- Blocked cells: red dashed border with countdown number.

---

## 13. Known Disabled Features
- `gravity_flip` chaos event: disabled (breaks pawn movement).
- `ice_age`, `double_trouble`, `frenzy`: declared but have no active effect (future implementation).
