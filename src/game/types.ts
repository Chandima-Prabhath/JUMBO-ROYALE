// ===========================================================================
// Jumbo Royale — Type Definitions
// The ONLY place types are defined. No logic here.
// All game behavior is defined in GAME_CODEX.md and implemented in the engine.
// ===========================================================================

export type Team = 'red' | 'blue'
export type BossTeam = 'boss'
export type AnyTeam = Team | BossTeam

export type CharacterClass = 'tank' | 'speedster' | 'mage' | 'jester'

export type PowerUpType =
  | 'double_move'
  | 'freeze'
  | 'swap'
  | 'bomb'
  | 'shield'
  | 'extra_jump'

export type ChaosEvent =
  | 'ice_age'
  | 'shrink'
  | 'double_trouble'
  | 'frenzy'
  | 'power_rain'

export type GamePhase = 'lobby' | 'playing' | 'ended'
export type GameMode = 'pvp' | 'coop'

export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'brutal'

export type MoveKind = 'simple' | 'capture' | 'multi_capture'

// ===========================================================================
// Core game objects
// ===========================================================================

export interface Position {
  row: number
  col: number
}

export interface Piece {
  id: string
  team: AnyTeam
  character: CharacterClass
  row: number
  col: number
  isKing: boolean
  hp: number
  hasShield: boolean
  frozenTurns: number
  abilityUsed: boolean
  ownerName: string
  ownerAvatar?: string
}

export type CellType = 'normal' | 'powerup' | 'blocked'
export type TileColor = 'dark' | 'light'

export interface Cell {
  row: number
  col: number
  tile: TileColor
  type: CellType
  powerUp?: PowerUpType
  blockedTurns?: number
}

export interface Board {
  size: number
  cells: Cell[][]
  pieces: Record<string, Piece>
}

export interface Move {
  pieceId: string
  fromRow: number
  fromCol: number
  toRow: number
  toCol: number
  kind: MoveKind
  capturedPieceIds: string[]
  pickedUpPowerUp?: PowerUpType
}

export interface PlayerSlot {
  id: string
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
  rage: boolean
}

export interface GameState {
  id: string
  roomCode: string
  mode: GameMode
  phase: GamePhase
  board: Board
  players: PlayerSlot[]
  currentTurnTeam: AnyTeam
  currentPlayerIndex: number
  turnStartedAt: number
  turnDurationSec: number
  movesThisTurn: number
  boss?: BossState
  pendingChaosEvent?: ChaosEvent
  nextChaosAt: number
  chaosCount: number
  turnCount: number
  turnsWithoutCapture: number
  winnerTeam?: AnyTeam
  endedAt?: number
  version: number
}

// ===========================================================================
// Engine result types
// ===========================================================================

export type PowerUpEffectType =
  | 'shield'
  | 'shield_break'
  | 'capture'
  | 'freeze'
  | 'swap'
  | 'bomb'
  | 'double_move'
  | 'extra_jump'

export interface PowerUpEffect {
  type: PowerUpEffectType
  pieceId?: string
  targetPieceIds?: string[]
}

export interface ActionResult {
  success: boolean
  error?: string
  newState?: GameState
  effects?: PowerUpEffect[]
  pickedUpPowerUp?: PowerUpType
  promotedToKing?: boolean
  chainCapturesAvailable?: Move[]
  bonusMoveGranted?: boolean
  turnEnded?: boolean
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

// ===========================================================================
// Configuration types
// ===========================================================================

export interface PlayerConfig {
  id: string
  name: string
  avatar?: string
  team: AnyTeam
  character: CharacterClass
  isHost: boolean
  isBot?: boolean
  botDifficulty?: BotDifficulty
}

export interface GameConfig {
  mode: GameMode
  players: PlayerConfig[]
  roomCode: string
}
