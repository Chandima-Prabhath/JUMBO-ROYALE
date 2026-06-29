// ===========================================================================
// Jumbo Royale — Game Server (Socket.IO)
// Thin transport layer on top of the GameEngine class.
// ALL game logic goes through the engine. The server only handles:
// - Socket connections
// - Room management
// - State broadcasting
// - Bot/boss scheduling
// - FX event emission
// ===========================================================================

import { createServer } from 'http'
import { Server } from 'socket.io'
import { v4 as uuid } from 'uuid'
import {
  GameState, GameMode, PlayerSlot, AnyTeam, CharacterClass,
  Move, EmoteEvent, Piece, BotDifficulty, PowerUpType, PowerUpEffect,
  PlayerConfig, Position,
} from '../../src/game/types'
import { GameEngine } from '../../src/game/engine'
import { createBoard, BOARD_SIZE } from '../../src/game/board'
import { TURN_DURATION_SEC, CHAOS_INTERVAL_SEC, MAX_MOVES_PER_TURN } from '../../src/game/turn'
import { getLegalMoves } from '../../src/game/moves'
import { applyMove, applyPowerUpEffect } from '../../src/game/apply'
import { getAbilityTargets, applyAbility } from '../../src/game/abilities'
import { checkWinner, isAllFrozen } from '../../src/game/winner'
import { pickBestMove, shouldUseAbility } from '../../src/game/ai'
import { pickBossMove, bossSummon } from '../../src/game/boss'
import { applyChaos, rollChaosEvent } from '../../src/game'

const PORT = parseInt(process.env.GAME_SERVICE_PORT || process.env.PORT || '3003', 10)

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Room storage — each room holds a GameEngine instance
const rooms = new Map<string, GameEngine>()
const socketToRoom = new Map<string, { roomCode: string; playerId: string }>()

// ===========================================================================
// Helpers
// ===========================================================================

function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return rooms.has(code) ? makeRoomCode() : code
}

function broadcastRoom(roomCode: string) {
  const engine = rooms.get(roomCode)
  if (!engine) return
  io.to(roomCode).emit('state', engine.getState())
}

function generateMoveReason(move: Move, team: AnyTeam): string {
  const captureCount = move.capturedPieceIds.length
  if (captureCount > 1) return `Chain capture! Took ${captureCount} pieces.`
  if (captureCount === 1) return `Captured an enemy piece.`
  if (move.pickedUpPowerUp) {
    const names: Record<string, string> = {
      double_move: 'Double Move', freeze: 'Freeze', swap: 'Swap',
      bomb: 'Bomb', shield: 'Shield', extra_jump: 'Extra Jump',
    }
    return `Grabbed ${names[move.pickedUpPowerUp] || move.pickedUpPowerUp} power-up.`
  }
  const forward = team === 'red' ? -1 : 1
  const dr = move.toRow - move.fromRow
  if (dr === forward) return `Advanced forward toward enemy territory.`
  if (dr === -forward) return `Moved backward (king retreat).`
  return `Repositioned to control the board.`
}

// ===========================================================================
// Bot scheduling
// ===========================================================================

function scheduleBotTurnIfApplicable(engine: GameEngine) {
  if (engine.isGameOver()) return
  const state = engine.getState()
  if (state.mode === 'coop' && state.currentTurnTeam === 'boss') return
  const slot = state.players[state.currentPlayerIndex]
  if (!slot?.isBot || !slot.connected) return
  const difficulty = slot.botDifficulty || 'hard'
  const thinkTime = difficulty === 'easy' ? 600 : difficulty === 'medium' ? 900 : difficulty === 'hard' ? 1200 : 1500
  io.to(state.roomCode).emit('bot:thinking', { playerName: slot.name })
  setTimeout(() => runBotMove(engine, slot.id), thinkTime + Math.random() * 400)
}

function runBotMove(engine: GameEngine, botPlayerId: string) {
  if (engine.isGameOver()) return
  const state = engine.getState()
  const slot = state.players.find(p => p.id === botPlayerId)
  if (!slot?.isBot || !slot.connected) return
  if (state.players[state.currentPlayerIndex]?.id !== botPlayerId) return

  const difficulty = slot.botDifficulty || 'hard'
  const team = slot.team

  // Try ability first
  const teamPieces = Object.values(state.board.pieces).filter(p => p.team === team && !p.abilityUsed && p.frozenTurns === 0)
  for (const piece of teamPieces) {
    if (piece.character !== 'mage' && piece.character !== 'jester') continue
    const decision = shouldUseAbility(state, piece, team, difficulty)
    if (decision.shouldUse && decision.targetRow !== undefined && decision.targetCol !== undefined) {
      // Use ability through engine
      const result = engine.useAbility(piece.id, { row: decision.targetRow, col: decision.targetCol })
      if (result.success) {
        // Emit FX
        emitEffects(state.roomCode, result.effects)
        if (piece.character === 'mage') {
          io.to(state.roomCode).emit('fx', { type: 'teleport', pieceId: piece.id })
        }
        // Broadcast move:made
        emitMoveMade(state.roomCode, piece.id, piece.row, piece.col, decision.targetRow, decision.targetCol, slot.name, team, true, 'capture', 0, true, result.pickedUpPowerUp, false)
        broadcastRoom(state.roomCode)

        // Check for chain captures
        if (result.chainCapturesAvailable && result.chainCapturesAvailable.length > 0) {
          setTimeout(() => runBotChainCapture(engine, botPlayerId, piece.id), 600)
          return
        }
        // Check for bonus move
        if (result.bonusMoveGranted) {
          state.turnStartedAt = Date.now()
          io.to(state.roomCode).emit('bonus_move', { pieceId: piece.id, powerUp: result.pickedUpPowerUp })
          setTimeout(() => runBotMove(engine, botPlayerId), 600)
          return
        }
        // Turn ended (engine already called nextTurn)
        scheduleBotTurnIfApplicable(engine)
        return
      }
    }
  }

  // Pick best move
  const best = pickBestMove(state, team, difficulty)
  if (!best) {
    // No moves — engine should have ended the turn via checkWinner
    broadcastRoom(state.roomCode)
    scheduleBotTurnIfApplicable(engine)
    return
  }

  const fromRow = state.board.pieces[best.pieceId]?.row ?? best.move.toRow
  const fromCol = state.board.pieces[best.pieceId]?.col ?? best.move.toCol

  const result = engine.makeMove(best.move)
  if (!result.success) {
    console.error('[bot] move failed:', result.error)
    return
  }

  emitEffects(state.roomCode, result.effects)
  emitMoveMade(state.roomCode, best.pieceId, fromRow, fromCol, best.move.toRow, best.move.toCol, slot.name, team, true, best.move.kind, best.move.capturedPieceIds.length, false, result.pickedUpPowerUp, result.promotedToKing)
  if (result.promotedToKing) io.to(state.roomCode).emit('promote', best.pieceId)
  broadcastRoom(state.roomCode)

  // Chain captures
  if (result.chainCapturesAvailable && result.chainCapturesAvailable.length > 0) {
    setTimeout(() => runBotChainCapture(engine, botPlayerId, best.pieceId), 600)
    return
  }
  // Bonus move
  if (result.bonusMoveGranted) {
    state.turnStartedAt = Date.now()
    io.to(state.roomCode).emit('bonus_move', { pieceId: best.pieceId, powerUp: result.pickedUpPowerUp })
    setTimeout(() => runBotMove(engine, botPlayerId), 600)
    return
  }

  // Turn ended — schedule next bot if applicable
  scheduleBotTurnIfApplicable(engine)
}

function runBotChainCapture(engine: GameEngine, botPlayerId: string, pieceId: string) {
  if (engine.isGameOver()) return
  const state = engine.getState()
  const slot = state.players.find(p => p.id === botPlayerId)
  if (!slot?.isBot) return
  const piece = state.board.pieces[pieceId]
  if (!piece) { scheduleBotTurnIfApplicable(engine); return }

  const captures = getLegalMoves(state.board, piece).filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
  if (captures.length === 0) { scheduleBotTurnIfApplicable(engine); return }

  let best = captures[0]
  for (const m of captures) if (m.capturedPieceIds.length > best.capturedPieceIds.length) best = m

  const fromRow = piece.row
  const fromCol = piece.col
  const result = engine.makeMove(best)
  if (!result.success) return

  emitEffects(state.roomCode, result.effects)
  emitMoveMade(state.roomCode, pieceId, fromRow, fromCol, best.toRow, best.toCol, slot.name, slot.team, true, best.kind, best.capturedPieceIds.length, false, result.pickedUpPowerUp, result.promotedToKing)
  if (result.promotedToKing) io.to(state.roomCode).emit('promote', pieceId)
  broadcastRoom(state.roomCode)

  if (result.chainCapturesAvailable && result.chainCapturesAvailable.length > 0) {
    setTimeout(() => runBotChainCapture(engine, botPlayerId, pieceId), 600)
    return
  }
  if (result.bonusMoveGranted) {
    state.turnStartedAt = Date.now()
    io.to(state.roomCode).emit('bonus_move', { pieceId, powerUp: result.pickedUpPowerUp })
    setTimeout(() => runBotMove(engine, botPlayerId), 600)
    return
  }
  scheduleBotTurnIfApplicable(engine)
}

// ===========================================================================
// Boss AI
// ===========================================================================

function runBossTurn(engine: GameEngine) {
  if (engine.isGameOver()) return
  const state = engine.getState()
  if (state.mode !== 'coop' || state.currentTurnTeam !== 'boss') return

  // Rage check
  if (state.boss && !state.boss.rage && state.boss.hp <= state.boss.maxHp / 2) {
    state.boss.rage = true
    io.to(state.roomCode).emit('boss-rage', true)
  }

  // Summon minion
  if (state.boss?.rage && state.chaosCount % 3 === 0) {
    const { state: ns } = bossSummon(state)
    Object.assign(state, ns)
  }

  const movesToMake = state.boss?.rage ? 2 : 1
  runBossMoveRecursive(engine, movesToMake, 0)
}

function runBossMoveRecursive(engine: GameEngine, movesRemaining: number, depth: number) {
  if (engine.isGameOver() || depth > 10) {
    broadcastRoom(engine.getState().roomCode)
    setTimeout(() => scheduleAfterBoss(engine), 600)
    return
  }

  const state = engine.getState()
  const pick = pickBossMove(state)
  if (!pick) {
    broadcastRoom(state.roomCode)
    setTimeout(() => scheduleAfterBoss(engine), 600)
    return
  }

  const fromRow = state.board.pieces[pick.pieceId]?.row ?? pick.move.toRow
  const fromCol = state.board.pieces[pick.pieceId]?.col ?? pick.move.toCol
  const result = engine.makeMove(pick.move)
  if (!result.success) return

  emitEffects(state.roomCode, result.effects)
  emitMoveMade(state.roomCode, pick.pieceId, fromRow, fromCol, pick.move.toRow, pick.move.toCol, 'BOSS', 'boss', true, pick.move.kind, pick.move.capturedPieceIds.length, false, result.pickedUpPowerUp, result.promotedToKing)
  if (result.promotedToKing) io.to(state.roomCode).emit('promote', pick.pieceId)
  broadcastRoom(state.roomCode)

  // Chain captures
  if (result.chainCapturesAvailable && result.chainCapturesAvailable.length > 0) {
    setTimeout(() => runBossChainCapture(engine, pick.pieceId, movesRemaining, depth + 1), 600)
    return
  }
  // Bonus move
  if (result.bonusMoveGranted) {
    setTimeout(() => runBossMoveRecursive(engine, movesRemaining, depth + 1), 600)
    return
  }
  // Normal: consume one move
  const next = movesRemaining - 1
  if (next > 0) {
    setTimeout(() => runBossMoveRecursive(engine, next, depth + 1), 600)
  } else {
    setTimeout(() => scheduleAfterBoss(engine), 600)
  }
}

function runBossChainCapture(engine: GameEngine, pieceId: string, movesRemaining: number, depth: number) {
  if (engine.isGameOver()) return
  const state = engine.getState()
  const piece = state.board.pieces[pieceId]
  if (!piece) { runBossMoveRecursive(engine, movesRemaining, depth + 1); return }

  const captures = getLegalMoves(state.board, piece).filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
  if (captures.length === 0) { runBossMoveRecursive(engine, movesRemaining, depth + 1); return }

  let best = captures[0]
  for (const m of captures) if (m.capturedPieceIds.length > best.capturedPieceIds.length) best = m

  const fromRow = piece.row, fromCol = piece.col
  const result = engine.makeMove(best)
  if (!result.success) return

  emitEffects(state.roomCode, result.effects)
  emitMoveMade(state.roomCode, pieceId, fromRow, fromCol, best.toRow, best.toCol, 'BOSS', 'boss', true, best.kind, best.capturedPieceIds.length, false, result.pickedUpPowerUp, result.promotedToKing)
  if (result.promotedToKing) io.to(state.roomCode).emit('promote', pieceId)
  broadcastRoom(state.roomCode)

  const movedPiece = engine.getState().board.pieces[pieceId]
  if (movedPiece) {
    const more = getLegalMoves(engine.getState().board, movedPiece).filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
    if (more.length > 0) {
      setTimeout(() => runBossChainCapture(engine, pieceId, movesRemaining, depth + 1), 600)
      return
    }
  }
  runBossMoveRecursive(engine, movesRemaining, depth + 1)
}

function scheduleAfterBoss(engine: GameEngine) {
  // Boss turn ended — engine already called nextTurn
  // Check for all-frozen skip
  const state = engine.getState()
  if (isAllFrozen(state, state.currentTurnTeam)) {
    io.to(state.roomCode).emit('turn_skipped', { team: state.currentTurnTeam, reason: 'All pieces are frozen!' })
    engine.endTurnByTimeout() // force skip
    broadcastRoom(state.roomCode)
  }
  scheduleBotTurnIfApplicable(engine)
}

// ===========================================================================
// FX + event emission helpers
// ===========================================================================

function emitEffects(roomCode: string, effects?: PowerUpEffect[]) {
  if (!effects) return
  for (const eff of effects) {
    if (eff.type === 'freeze') io.to(roomCode).emit('fx', { type: 'freeze', pieceId: eff.pieceId })
    else if (eff.type === 'swap' && eff.targetPieceIds) io.to(roomCode).emit('fx', { type: 'swap', pieceIds: [eff.pieceId, ...eff.targetPieceIds] })
    else if (eff.type === 'bomb') io.to(roomCode).emit('fx', { type: 'bomb', pieceId: eff.pieceId })
    else if (eff.type === 'shield') io.to(roomCode).emit('fx', { type: 'shield', pieceId: eff.pieceId })
    else if (eff.type === 'shield_break') io.to(roomCode).emit('fx', { type: 'shield_break', pieceId: eff.pieceId })
  }
}

function emitMoveMade(
  roomCode: string,
  pieceId: string,
  fromRow: number, fromCol: number,
  toRow: number, toCol: number,
  playerName: string, team: AnyTeam,
  isBot: boolean, kind: string, capturedCount: number,
  abilityUsed: boolean, pickedUpPowerUp?: PowerUpType, promotedToKing?: boolean,
) {
  io.to(roomCode).emit('move:made', {
    pieceId, fromRow, fromCol, toRow, toCol,
    playerName, team, isBot, kind, capturedCount, abilityUsed,
    pickedUpPowerUp, promotedToKing: promotedToKing ?? false,
    reason: isBot ? generateMoveReason({ pieceId, fromRow, fromCol, toRow, toCol, kind, capturedPieceIds: [], pickedUpPowerUp } as Move, team) : undefined,
  })
}

// ===========================================================================
// Socket handlers
// ===========================================================================

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`)

  // === Room creation ===
  socket.on('room:create', ({ name, mode }: { name: string; mode: GameMode }) => {
    const roomCode = makeRoomCode()
    const hostConfig: PlayerConfig = {
      id: socket.id,
      name: name.slice(0, 20) || 'Anonymous',
      team: 'red',
      character: 'tank',
      isHost: true,
    }
    const engine = GameEngine.createLobby(mode, hostConfig, roomCode)
    rooms.set(roomCode, engine)
    socketToRoom.set(socket.id, { roomCode, playerId: socket.id })
    socket.join(roomCode)
    socket.emit('room:created', { roomCode })
    broadcastRoom(roomCode)
  })

  // === Room joining ===
  socket.on('room:join', ({ name, roomCode }: { name: string; roomCode: string }) => {
    const engine = rooms.get(roomCode.toUpperCase())
    if (!engine) { socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' }); return }
    const state = engine.getState()
    if (state.phase !== 'lobby') { socket.emit('error', { code: 'GAME_STARTED', message: 'Game already started' }); return }
    if (state.players.length >= 6) { socket.emit('error', { code: 'ROOM_FULL', message: 'Room is full' }); return }

    const playerConfig: PlayerConfig = {
      id: socket.id,
      name: name.slice(0, 20) || 'Anonymous',
      team: 'red',
      character: 'tank',
      isHost: false,
    }
    engine.addPlayer(playerConfig)
    socketToRoom.set(socket.id, { roomCode: roomCode.toUpperCase(), playerId: socket.id })
    socket.join(roomCode.toUpperCase())
    socket.emit('room:joined', { roomCode: roomCode.toUpperCase() })
    broadcastRoom(roomCode.toUpperCase())
  })

  // === Player update ===
  socket.on('player:update', (data: Partial<Pick<PlayerSlot, 'team' | 'character' | 'ready' | 'name'>>) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const engine = rooms.get(meta.roomCode)
    if (!engine) return
    engine.updatePlayer(socket.id, data)
    broadcastRoom(meta.roomCode)
  })

  // === Bot management ===
  socket.on('bot:add', ({ difficulty, team }: { difficulty: BotDifficulty; team?: AnyTeam }) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const engine = rooms.get(meta.roomCode)
    if (!engine) return
    const state = engine.getState()
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot?.isHost) { socket.emit('error', { code: 'NOT_HOST', message: 'Only host can add bots' }); return }
    if (state.phase !== 'lobby') { socket.emit('error', { code: 'GAME_STARTED', message: 'Game already started' }); return }
    if (state.players.length >= 6) { socket.emit('error', { code: 'ROOM_FULL', message: 'Room is full' }); return }
    if (state.mode === 'pvp' && team) {
      const teamCount = state.players.filter(p => p.team === team).length
      if (teamCount >= 3) { socket.emit('error', { code: 'TEAM_FULL', message: 'Team is full' }); return }
    }
    engine.addBot(difficulty, team)
    broadcastRoom(meta.roomCode)
  })

  socket.on('bot:remove', ({ botId }: { botId: string }) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const engine = rooms.get(meta.roomCode)
    if (!engine) return
    const state = engine.getState()
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot?.isHost) return
    engine.removeBot(botId)
    broadcastRoom(meta.roomCode)
  })

  // === Game start ===
  socket.on('game:start', () => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const engine = rooms.get(meta.roomCode)
    if (!engine) return
    const state = engine.getState()
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot?.isHost) { socket.emit('error', { code: 'NOT_HOST', message: 'Only host can start' }); return }
    if (state.players.filter(p => p.connected).length < 2) { socket.emit('error', { code: 'NEED_PLAYERS', message: 'Need at least 2 players' }); return }
    engine.startGame()
    broadcastRoom(meta.roomCode)
    // Schedule bot turn if first player is a bot
    scheduleBotTurnIfApplicable(engine)
    // Schedule boss turn if co-op and first turn is boss (shouldn't be, but just in case)
    const newState = engine.getState()
    if (newState.mode === 'coop' && newState.currentTurnTeam === 'boss') {
      setTimeout(() => runBossTurn(engine), 1200)
    }
  })

  // === Move list request ===
  socket.on('move:list', ({ pieceId }: { pieceId: string }) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const engine = rooms.get(meta.roomCode)
    if (!engine) return
    const state = engine.getState()
    if (state.phase !== 'playing') return
    const moves = engine.getPieceMoves(pieceId)
    socket.emit('move:list', { pieceId, moves })
  })

  // === Make move ===
  socket.on('move:make', ({ move }: { move: Move }) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const engine = rooms.get(meta.roomCode)
    if (!engine) return
    const state = engine.getState()
    if (state.phase !== 'playing') return

    // Check it's the player's turn
    if (!engine.isPlayerTurn(socket.id)) { socket.emit('error', { code: 'NOT_YOUR_TURN', message: 'Not your turn' }); return }

    const piece = state.board.pieces[move.pieceId]
    if (!piece) return
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot || piece.team !== slot.team) { socket.emit('error', { code: 'NOT_YOUR_PIECE', message: 'Not your piece' }); return }

    // Get original position for move:made event
    const fromRow = piece.row
    const fromCol = piece.col

    // Execute through engine
    const result = engine.makeMove(move)
    if (!result.success) { socket.emit('error', { code: 'ILLEGAL_MOVE', message: result.error || 'Illegal move' }); return }

    // Emit FX + events
    emitEffects(state.roomCode, result.effects)
    if (result.pickedUpPowerUp) {
      io.to(state.roomCode).emit('powerup:collected', {
        pieceId: move.pieceId, powerUp: result.pickedUpPowerUp,
        playerName: slot.name, effects: result.effects || [],
      })
    }
    if (result.promotedToKing) io.to(state.roomCode).emit('promote', move.pieceId)
    emitMoveMade(state.roomCode, move.pieceId, fromRow, fromCol, move.toRow, move.toCol, slot.name, slot.team, !!slot.isBot, move.kind, move.capturedPieceIds.length, false, result.pickedUpPowerUp, result.promotedToKing)
    broadcastRoom(state.roomCode)

    // Handle chain captures
    if (result.chainCapturesAvailable && result.chainCapturesAvailable.length > 0) {
      io.to(state.roomCode).emit('chain:available', { pieceId: move.pieceId, moves: result.chainCapturesAvailable })
      return
    }
    // Handle bonus move
    if (result.bonusMoveGranted) {
      const newState = engine.getState()
      newState.turnStartedAt = Date.now()
      io.to(state.roomCode).emit('bonus_move', { pieceId: move.pieceId, powerUp: result.pickedUpPowerUp })
      return
    }
    // Turn ended — check for all-frozen skip + schedule next
    const newState = engine.getState()
    if (newState.phase === 'playing' && isAllFrozen(newState, newState.currentTurnTeam)) {
      io.to(state.roomCode).emit('turn_skipped', { team: newState.currentTurnTeam, reason: 'All pieces are frozen!' })
      engine.endTurnByTimeout()
      broadcastRoom(state.roomCode)
    }
    // Schedule boss turn if co-op
    if (newState.mode === 'coop' && newState.currentTurnTeam === 'boss') {
      setTimeout(() => runBossTurn(engine), 1200)
    }
    // Schedule bot turn
    scheduleBotTurnIfApplicable(engine)
  })

  // === Use ability ===
  socket.on('ability:use', ({ pieceId, targetRow, targetCol }: { pieceId: string; targetRow: number; targetCol: number }) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const engine = rooms.get(meta.roomCode)
    if (!engine) return
    const state = engine.getState()
    if (state.phase !== 'playing') return
    if (!engine.isPlayerTurn(socket.id)) return

    const piece = state.board.pieces[pieceId]
    if (!piece) return
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot || piece.team !== slot.team) return

    const fromRow = piece.row, fromCol = piece.col
    const result = engine.useAbility(pieceId, { row: targetRow, col: targetCol })
    if (!result.success) { socket.emit('error', { code: 'BAD_TARGET', message: result.error || 'Invalid ability' }); return }

    // Emit FX
    if (piece.character === 'mage') io.to(state.roomCode).emit('fx', { type: 'teleport', pieceId })
    emitEffects(state.roomCode, result.effects)
    if (result.pickedUpPowerUp) {
      io.to(state.roomCode).emit('powerup:collected', {
        pieceId, powerUp: result.pickedUpPowerUp,
        playerName: slot.name, effects: result.effects || [],
      })
    }
    emitMoveMade(state.roomCode, pieceId, fromRow, fromCol, targetRow, targetCol, slot.name, slot.team, !!slot.isBot, 'special', 0, true, result.pickedUpPowerUp, false)
    broadcastRoom(state.roomCode)

    // Chain captures after mage teleport
    if (result.chainCapturesAvailable && result.chainCapturesAvailable.length > 0) {
      io.to(state.roomCode).emit('chain:available', { pieceId, moves: result.chainCapturesAvailable })
      return
    }
    // Bonus move
    if (result.bonusMoveGranted) {
      const newState = engine.getState()
      newState.turnStartedAt = Date.now()
      io.to(state.roomCode).emit('bonus_move', { pieceId, powerUp: result.pickedUpPowerUp })
      return
    }
    // Turn ended
    const newState = engine.getState()
    if (newState.phase === 'playing' && isAllFrozen(newState, newState.currentTurnTeam)) {
      io.to(state.roomCode).emit('turn_skipped', { team: newState.currentTurnTeam, reason: 'All pieces are frozen!' })
      engine.endTurnByTimeout()
      broadcastRoom(state.roomCode)
    }
    if (newState.mode === 'coop' && newState.currentTurnTeam === 'boss') {
      setTimeout(() => runBossTurn(engine), 1200)
    }
    scheduleBotTurnIfApplicable(engine)
  })

  // === Emote ===
  socket.on('emote', ({ emoji, targetPieceId }: { emoji: string; targetPieceId?: string }) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const engine = rooms.get(meta.roomCode)
    if (!engine) return
    const state = engine.getState()
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot) return
    const ev: EmoteEvent = { id: uuid(), playerId: socket.id, playerName: slot.name, emoji, targetPieceId, timestamp: Date.now() }
    io.to(meta.roomCode).emit('emote', ev)
  })

  // === Chat ===
  socket.on('chat', ({ text }: { text: string }) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const engine = rooms.get(meta.roomCode)
    if (!engine) return
    const state = engine.getState()
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot) return
    io.to(meta.roomCode).emit('chat', { playerId: socket.id, name: slot.name, avatar: slot.avatar, text: text.slice(0, 200), timestamp: Date.now() })
  })

  // === Game restart ===
  socket.on('game:restart', () => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const engine = rooms.get(meta.roomCode)
    if (!engine) return
    const state = engine.getState()
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot?.isHost) return
    engine.restart()
    broadcastRoom(meta.roomCode)
  })

  // === Disconnect ===
  socket.on('disconnect', () => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) { console.log(`[socket] disconnected: ${socket.id}`); return }
    const engine = rooms.get(meta.roomCode)
    socketToRoom.delete(socket.id)
    if (!engine) return
    const state = engine.getState()
    const slot = state.players.find(p => p.id === socket.id)
    if (slot) {
      slot.connected = false
      if (slot.isHost) {
        const nextHost = state.players.find(p => p.connected && p.id !== socket.id)
        if (nextHost) nextHost.isHost = true
      }
    }
    if (state.players.every(p => !p.connected)) {
      setTimeout(() => {
        const e = rooms.get(meta.roomCode)
        if (e && e.getState().players.every(p => !p.connected)) {
          rooms.delete(meta.roomCode)
          console.log(`[room] cleaned up: ${meta.roomCode}`)
        }
      }, 5 * 60 * 1000)
    }
    broadcastRoom(meta.roomCode)
    console.log(`[socket] disconnected: ${socket.id} from room ${meta.roomCode}`)
  })

  socket.on('error', (err) => console.error(`[socket] error (${socket.id}):`, err))
})

// ===========================================================================
// Turn timeout ticker
// ===========================================================================

setInterval(() => {
  for (const [roomCode, engine] of rooms.entries()) {
    const state = engine.getState()
    if (state.phase !== 'playing') continue
    if (state.mode === 'coop' && state.currentTurnTeam === 'boss') continue
    const elapsed = Date.now() - state.turnStartedAt
    if (elapsed >= state.turnDurationSec * 1000) {
      engine.endTurnByTimeout()
      const newState = engine.getState()
      // Check for all-frozen skip
      if (newState.phase === 'playing' && isAllFrozen(newState, newState.currentTurnTeam)) {
        io.to(roomCode).emit('turn_skipped', { team: newState.currentTurnTeam, reason: 'All pieces are frozen!' })
        engine.endTurnByTimeout()
      }
      broadcastRoom(roomCode)
      // Schedule boss/bot after timeout
      if (newState.mode === 'coop' && newState.currentTurnTeam === 'boss') {
        setTimeout(() => runBossTurn(engine), 1200)
      }
      scheduleBotTurnIfApplicable(engine)
    }
  }
}, 1000)

// ===========================================================================
// Start server
// ===========================================================================

httpServer.listen(PORT, () => {
  console.log(`[jumbo-royale] game server running on port ${PORT}`)
})

process.on('SIGTERM', () => { httpServer.close(() => process.exit(0)) })
process.on('SIGINT', () => { httpServer.close(() => process.exit(0)) })
