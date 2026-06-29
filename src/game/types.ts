// Jumbo Royale - Core Types
// Pure types, no React, no IO — easy to test.

export type Team = 'red' | 'blue'
export type BossTeam = 'boss'
export type AnyTeam = Team | BossTeam

export type CharacterClass = 'tank' | 'speedster' | 'mage' | 'jester'

export type PowerUpType =
  | 'double_move'  // ⚡ take one extra move this turn
  | 'freeze'       // 🧊 freeze an opponent for 1 turn
  | 'swap'         // 🌀 swap places with any piece
  | 'bomb'         // 💣 destroy adjacent pieces (1 use)
  | 'shield'       // 🛡 absorb one capture
  | 'extra_jump'   // 🔁 keep jumping after non-capture move

export type ChaosEvent =
  | 'gravity_flip' // (disabled — breaks pawn movement)
  | 'ice_age'      // all pieces slide one extra square in last direction
  | 'shrink'       // outer ring becomes blocked for 3 turns
  | 'double_trouble' // every capture counts as 2
  | 'frenzy'       // everyone moves twice this round
  | 'power_rain'   // new power-ups spawn on random dark cells

export interface Piece {
  id: string
  team: AnyTeam
  character: CharacterClass
  row: number
  col: number
  isKing: boolean
  hp: number          // tank starts at 2, others 1
  hasShield: boolean
  frozenTurns: number // 0 = not frozen
  abilityUsed: boolean // for one-time abilities (mage teleport, jester swap, etc.)
  // Visual flair
  facing: 'left' | 'right'
  ownerName: string
  ownerAvatar?: string
}

export type CellType = 'normal' | 'dark' | 'light' | 'powerup' | 'blocked'
export type TileColor = 'dark' | 'light' // checkerboard pattern

export interface Cell {
  row: number
  col: number
  tile: TileColor        // checkerboard visual
  type: CellType         // gameplay type
  powerUp?: PowerUpType  // if type === 'powerup'
  blockedTurns?: number  // if type === 'blocked'
}

export interface Board {
  size: number           // 8
  cells: Cell[][]        // [row][col]
  pieces: Record<string, Piece>
}

export type MoveKind = 'simple' | 'capture' | 'multi_capture' | 'special'

export interface Move {
  pieceId: string
  fromRow: number
  fromCol: number
  toRow: number
  toCol: number
  kind: MoveKind
  capturedPieceIds: string[]
  // chain captures
  isChainable: boolean
  // power-up applied at destination
  pickedUpPowerUp?: PowerUpType
  // character ability used
  abilityUsed?: boolean
}

export type GamePhase = 'lobby' | 'starting' | 'playing' | 'ended'
export type GameMode = 'pvp' | 'coop'

export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'brutal'

export interface PlayerSlot {
  id: string              // socket id (or bot_XXX for bots)
  name: string
  avatar?: string
  team: AnyTeam
  character: CharacterClass
  ready: boolean
  isHost: boolean
  isBot?: boolean
  botDifficulty?: BotDifficulty
  connected: boolean
  captures: number
  score: number
}

export interface BossState {
  hp: number
  maxHp: number
  rage: boolean              // active below 50% HP
  nextActionIn: number       // seconds
  lastActionAt: number
}

export interface EmoteEvent {
  id: string
  playerId: string
  playerName: string
  emoji: string
  targetPieceId?: string
  timestamp: number
}

export interface GameState {
  id: string
  roomCode: string
  mode: GameMode
  phase: GamePhase
  board: Board
  players: PlayerSlot[]
  currentTurnTeam: AnyTeam
  currentPlayerIndex: number  // index into players for current turn (pvp)
  turnStartedAt: number
  turnDurationSec: number
  movesThisTurn: number
  maxMovesPerTurn: number
  boss?: BossState
  pendingChaosEvent?: ChaosEvent
  nextChaosAt: number
  chaosCount: number
  emoteLog: EmoteEvent[]
  winnerTeam?: AnyTeam
  endedAt?: number
  version: number // increments on every state mutation
}
