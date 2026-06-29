// ===========================================================================
// Jumbo Royale — GameEngine
// The SINGLE API for all game operations. Used by server, tutorial, and AI.
// The engine is the ONLY authority on what's legal.
// Bots CANNOT make illegal moves because they go through this same API.
// ===========================================================================

import {
  GameState, GameMode, GameConfig, PlayerSlot, PlayerConfig,
  Move, AnyTeam, Position, ActionResult, ValidationResult,
  PowerUpType, PowerUpEffect, BotDifficulty, ChaosEvent, Piece,
} from './types'
import { createBoard, BOARD_SIZE } from './board'
import { getLegalMoves, getTeamLegalMoves, getCaptureMoves, hasLegalMoves } from './moves'
import { applyMove, validateMove } from './apply'
import { applyAbility, validateAbility, getAbilityTargets, canUseAbility } from './abilities'
import { checkWinner, isAllFrozen } from './winner'
import { nextTurn, TURN_DURATION_SEC, CHAOS_INTERVAL_SEC, isPlayerTurn, isBotTurn, getCurrentPlayer } from './turn'
import { v4 as uuid } from 'uuid'

const CHAOS_EVENTS: ChaosEvent[] = ['ice_age', 'shrink', 'double_trouble', 'frenzy', 'power_rain']

// ===========================================================================
// GameEngine class
// ===========================================================================

export class GameEngine {
  private state: GameState

  private constructor(state: GameState) {
    this.state = state
  }

  // === Creation ===

  static createGame(config: GameConfig): GameEngine {
    const players: PlayerSlot[] = config.players.map(p => ({
      id: p.id,
      name: p.name.slice(0, 20) || 'Anonymous',
      avatar: p.avatar,
      team: p.team,
      character: p.character,
      ready: p.isBot ?? false,
      isHost: p.isHost,
      isBot: p.isBot,
      botDifficulty: p.botDifficulty,
      connected: true,
      captures: 0,
      score: 0,
    }))

    const board = createBoard(config.mode, players)
    const currentPlayerIndex = players.findIndex(p => p.team === 'red' && p.connected)
    const bossPiece = Object.values(board.pieces).find(p => p.team === 'boss' && p.isKing)

    const state: GameState = {
      id: uuid(),
      roomCode: config.roomCode,
      mode: config.mode,
      phase: 'playing',
      board,
      players,
      currentTurnTeam: 'red',
      currentPlayerIndex: currentPlayerIndex >= 0 ? currentPlayerIndex : 0,
      turnStartedAt: Date.now(),
      turnDurationSec: TURN_DURATION_SEC,
      movesThisTurn: 0,
      boss: config.mode === 'coop' && bossPiece ? {
        hp: bossPiece.hp,
        maxHp: bossPiece.hp,
        rage: false,
      } : undefined,
      nextChaosAt: Date.now() + CHAOS_INTERVAL_SEC * 1000,
      chaosCount: 0,
      turnCount: 0,
      turnsWithoutCapture: 0,
      version: 1,
    }

    return new GameEngine(state)
  }

  static fromState(state: GameState): GameEngine {
    return new GameEngine({ ...state })
  }

  static createLobby(mode: GameMode, host: PlayerConfig, roomCode: string): GameEngine {
    const players: PlayerSlot[] = [{
      id: host.id,
      name: host.name.slice(0, 20) || 'Anonymous',
      avatar: host.avatar,
      team: 'red',
      character: host.character,
      ready: false,
      isHost: true,
      isBot: host.isBot,
      botDifficulty: host.botDifficulty,
      connected: true,
      captures: 0,
      score: 0,
    }]

    const state: GameState = {
      id: uuid(),
      roomCode,
      mode,
      phase: 'lobby',
      board: createBoard(mode, players),
      players,
      currentTurnTeam: 'red',
      currentPlayerIndex: 0,
      turnStartedAt: 0,
      turnDurationSec: TURN_DURATION_SEC,
      movesThisTurn: 0,
      nextChaosAt: 0,
      chaosCount: 0,
      turnCount: 0,
      turnsWithoutCapture: 0,
      version: 1,
    }

    return new GameEngine(state)
  }

  // === Queries (read-only) ===

  getState(): GameState {
    return { ...this.state }
  }

  getLegalMoves(): Move[] {
    if (this.state.phase !== 'playing') return []
    const teamMoves = getTeamLegalMoves(this.state.board, this.state.currentTurnTeam)
    return teamMoves.flatMap(tm => tm.moves)
  }

  getPieceMoves(pieceId: string): Move[] {
    const piece = this.state.board.pieces[pieceId]
    if (!piece) return []
    return getLegalMoves(this.state.board, piece)
  }

  getAbilityTargets(pieceId: string): Position[] {
    const piece = this.state.board.pieces[pieceId]
    if (!piece) return []
    return getAbilityTargets(this.state.board, piece)
  }

  getCurrentPlayer() {
    return getCurrentPlayer(this.state)
  }

  isPlayerTurn(playerId: string): boolean {
    return isPlayerTurn(this.state, playerId)
  }

  isBotTurn(): boolean {
    return isBotTurn(this.state)
  }

  isGameOver(): boolean {
    return this.state.phase === 'ended'
  }

  getWinner(): AnyTeam | undefined {
    return this.state.winnerTeam
  }

  shouldSkipTurn(): boolean {
    return isAllFrozen(this.state, this.state.currentTurnTeam)
  }

  // === Actions (validate + apply) ===

  makeMove(move: Move): ActionResult {
    if (this.state.phase !== 'playing') {
      return { success: false, error: 'Game is not in progress' }
    }

    const result = applyMove(this.state, move)
    if (!result.success || !result.newState) return result

    this.state = result.newState

    // Update player score for captures
    if (move.capturedPieceIds.length > 0) {
      const slot = this.state.players[this.state.currentPlayerIndex]
      if (slot) {
        slot.captures += move.capturedPieceIds.length
        slot.score += move.capturedPieceIds.length * 10
        if (move.capturedPieceIds.length > 1) slot.score += 20
      }
    }

    // Update player score for power-up
    if (result.pickedUpPowerUp) {
      const slot = this.state.players[this.state.currentPlayerIndex]
      if (slot) slot.score += 5
    }

    // Update boss HP
    if (this.state.mode === 'coop' && this.state.boss) {
      const bossPiece = Object.values(this.state.board.pieces).find(p => p.team === 'boss' && p.isKing)
      if (bossPiece) {
        this.state.boss.hp = bossPiece.hp
        if (!this.state.boss.rage && this.state.boss.hp <= this.state.boss.maxHp / 2) {
          this.state.boss.rage = true
        }
      }
    }

    // Check for winner
    const winner = checkWinner(this.state)
    if (winner) {
      this.state.phase = 'ended'
      this.state.winnerTeam = winner
      this.state.endedAt = Date.now()
      this.state.version++
      return { ...result, turnEnded: true }
    }

    // End turn if not chaining or bonus
    if (result.turnEnded) {
      this.state = nextTurn(this.state)
      this.checkChaos()
    }

    return result
  }

  useAbility(pieceId: string, target: Position): ActionResult {
    if (this.state.phase !== 'playing') {
      return { success: false, error: 'Game is not in progress' }
    }

    const result = applyAbility(this.state, pieceId, target)
    if (!result.success || !result.newState) return result

    this.state = result.newState

    // Update player score for power-up
    if (result.pickedUpPowerUp) {
      const slot = this.state.players[this.state.currentPlayerIndex]
      if (slot) slot.score += 5
    }

    // Check for winner
    const winner = checkWinner(this.state)
    if (winner) {
      this.state.phase = 'ended'
      this.state.winnerTeam = winner
      this.state.endedAt = Date.now()
      this.state.version++
      return { ...result, turnEnded: true }
    }

    // End turn if not chaining or bonus
    if (result.turnEnded) {
      this.state = nextTurn(this.state)
      this.checkChaos()
    }

    return result
  }

  endTurnByTimeout(): void {
    if (this.state.phase !== 'playing') return
    this.state = nextTurn(this.state)
    this.checkChaos()
  }

  // === Lobby management ===

  addPlayer(config: PlayerConfig): boolean {
    if (this.state.phase !== 'lobby') return false
    if (this.state.players.length >= 6) return false
    this.state.players.push({
      id: config.id,
      name: config.name.slice(0, 20) || 'Anonymous',
      avatar: config.avatar,
      team: 'red',
      character: config.character,
      ready: false,
      isHost: false,
      isBot: config.isBot,
      botDifficulty: config.botDifficulty,
      connected: true,
      captures: 0,
      score: 0,
    })
    this.state.version++
    return true
  }

  addBot(difficulty: BotDifficulty, team?: AnyTeam): boolean {
    if (this.state.phase !== 'lobby') return false
    if (this.state.players.length >= 6) return false

    let botTeam: AnyTeam
    if (team) {
      botTeam = team
    } else if (this.state.mode === 'coop') {
      botTeam = 'red'
    } else {
      const redCount = this.state.players.filter(p => p.team === 'red').length
      const blueCount = this.state.players.filter(p => p.team === 'blue').length
      botTeam = redCount <= blueCount ? 'red' : 'blue'
    }

    if (this.state.mode === 'pvp') {
      const teamCount = this.state.players.filter(p => p.team === botTeam).length
      if (teamCount >= 3) return false
    }

    const BOT_NAMES = ['RoboRex', 'ByteBot', 'AlphaQ', 'TurboTux', 'Megatron', 'CyberCat']
    const BOT_AVATARS = ['🤖', '👾', '🎮', '🛸', '⚙️', '🔮']

    this.state.players.push({
      id: `bot_${uuid().slice(0, 8)}`,
      name: `${BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]}`,
      avatar: BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)],
      team: botTeam,
      character: (['tank', 'speedster', 'mage', 'jester'] as const)[Math.floor(Math.random() * 4)],
      ready: true,
      isHost: false,
      isBot: true,
      botDifficulty: difficulty,
      connected: true,
      captures: 0,
      score: 0,
    })
    this.state.version++
    return true
  }

  removeBot(botId: string): boolean {
    if (this.state.phase !== 'lobby') return false
    const idx = this.state.players.findIndex(p => p.id === botId && p.isBot)
    if (idx < 0) return false
    this.state.players.splice(idx, 1)
    this.state.version++
    return true
  }

  updatePlayer(playerId: string, updates: Partial<PlayerSlot>): boolean {
    const slot = this.state.players.find(p => p.id === playerId)
    if (!slot) return false
    if (updates.team !== undefined) slot.team = updates.team
    if (updates.character !== undefined) slot.character = updates.character
    if (updates.ready !== undefined) slot.ready = updates.ready
    if (updates.name !== undefined) slot.name = updates.name.slice(0, 20)
    this.state.version++
    return true
  }

  startGame(): boolean {
    const host = this.state.players.find(p => p.isHost)
    if (!host) return false
    const connected = this.state.players.filter(p => p.connected)
    if (connected.length < 2) return false

    // Auto-balance teams for PvP
    if (this.state.mode === 'pvp') {
      connected.forEach((p, i) => { p.team = i % 2 === 0 ? 'red' : 'blue' })
    } else {
      connected.forEach(p => { p.team = 'red' })
    }

    // Create fresh board
    this.state.board = createBoard(this.state.mode, this.state.players.filter(p => p.connected))
    this.state.phase = 'playing'
    this.state.currentTurnTeam = 'red'
    this.state.currentPlayerIndex = Math.max(0, this.state.players.findIndex(p => p.team === 'red' && p.connected))
    this.state.turnStartedAt = Date.now()
    this.state.movesThisTurn = 0
    this.state.nextChaosAt = Date.now() + CHAOS_INTERVAL_SEC * 1000
    this.state.chaosCount = 0
    this.state.turnCount = 0
    this.state.turnsWithoutCapture = 0

    const bossPiece = Object.values(this.state.board.pieces).find(p => p.team === 'boss' && p.isKing)
    if (this.state.mode === 'coop' && bossPiece) {
      this.state.boss = { hp: bossPiece.hp, maxHp: bossPiece.hp, rage: false }
    }

    this.state.version++
    return true
  }

  restart(): void {
    // Full reset per GAME_CODEX.md section 7
    this.state.phase = 'lobby'
    this.state.players.forEach(p => { p.ready = false; p.captures = 0; p.score = 0 })
    this.state.board = createBoard(this.state.mode, this.state.players)
    this.state.winnerTeam = undefined
    this.state.endedAt = undefined
    this.state.boss = undefined
    this.state.turnCount = 0
    this.state.turnsWithoutCapture = 0
    this.state.chaosCount = 0
    this.state.currentTurnTeam = 'red'
    this.state.currentPlayerIndex = 0
    this.state.turnStartedAt = 0
    this.state.movesThisTurn = 0
    this.state.nextChaosAt = 0
    this.state.pendingChaosEvent = undefined
    this.state.version++
  }

  // === Private helpers ===

  private checkChaos(): void {
    if (Date.now() >= this.state.nextChaosAt) {
      const event = CHAOS_EVENTS[Math.floor(Math.random() * CHAOS_EVENTS.length)]
      this.state.pendingChaosEvent = event
      this.applyChaosEvent(event)
      this.state.nextChaosAt = Date.now() + CHAOS_INTERVAL_SEC * 1000
    }
  }

  private applyChaosEvent(event: ChaosEvent): void {
    if (event === 'shrink') {
      const size = this.state.board.size
      for (const c of [0, size - 1]) {
        for (let r = 0; r < size; r++) {
          // Only block empty cells
          const piece = Object.values(this.state.board.pieces).find(p => p.row === r && p.col === c)
          if (!piece) {
            this.state.board.cells[r][c].type = 'blocked'
            this.state.board.cells[r][c].blockedTurns = 3
          }
        }
      }
    } else if (event === 'power_rain') {
      // Spawn 4 power-ups on empty dark cells
      const size = this.state.board.size
      const emptyDarkCells: { r: number; c: number }[] = []
      for (let r = 2; r < size - 2; r++) {
        for (let c = 0; c < size; c++) {
          const cell = this.state.board.cells[r][c]
          if (cell.tile === 'dark' && cell.type === 'normal') {
            const piece = Object.values(this.state.board.pieces).find(p => p.row === r && p.col === c)
            if (!piece) emptyDarkCells.push({ r, c })
          }
        }
      }
      for (let i = emptyDarkCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[emptyDarkCells[i], emptyDarkCells[j]] = [emptyDarkCells[j], emptyDarkCells[i]]
      }
      const POOL: PowerUpType[] = ['double_move', 'freeze', 'swap', 'bomb', 'shield', 'extra_jump']
      for (let i = 0; i < Math.min(4, emptyDarkCells.length); i++) {
        const { r, c } = emptyDarkCells[i]
        this.state.board.cells[r][c].type = 'powerup'
        this.state.board.cells[r][c].powerUp = POOL[Math.floor(Math.random() * POOL.length)]
      }
    }
    // ice_age, double_trouble, frenzy: no active effect yet (future)
    this.state.chaosCount++
    this.state.version++
  }
}
