// Jumbo Royale - Authoritative game server (Socket.IO mini-service)
import { createServer } from 'http'
import { Server } from 'socket.io'
import { v4 as uuid } from 'uuid'
import {
  GameState, GameMode, PlayerSlot, AnyTeam, CharacterClass,
  Move, EmoteEvent, Piece, BotDifficulty, PowerUpType,
} from '../../src/game/types'
import { createBoard, BOARD_SIZE, TURN_DURATION_SEC, MAX_MOVES_PER_TURN, CHAOS_INTERVAL_SEC } from '../../src/game/board'
import { getLegalMoves, applyMove, getTeamMoves, getAbilityTargets, applyPowerUpEffect, PowerUpEffect } from '../../src/game/engine'
import { checkWinner, applyChaos, rollChaosEvent, pickBossMove, bossSummon } from '../../src/game/rules'
import { pickBestMove, shouldUseAbility } from '../../src/game/ai'

// Configurable port (env override for self-hosting)
const PORT = parseInt(process.env.GAME_SERVICE_PORT || process.env.PORT || '3003', 10)

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// In-memory rooms (authoritative)
const rooms = new Map<string, GameState>()
const socketToRoom = new Map<string, { roomCode: string; playerId: string }>()

// Generate a human-readable reason for a bot's move choice
function generateMoveReason(move: Move, team: AnyTeam, difficulty: BotDifficulty): string {
  const captureCount = move.capturedPieceIds.length
  if (move.kind === 'multi_capture' || (captureCount > 1)) {
    return `Chain capture! Took ${captureCount} pieces in one move.`
  }
  if (captureCount === 1) {
    return `Captured an enemy piece.`
  }
  if (move.pickedUpPowerUp) {
    const puNames: Record<string, string> = {
      double_move: 'Double Move (gets another move)',
      freeze: 'Freeze (will freeze nearest enemy)',
      swap: 'Swap (will swap with random enemy)',
      bomb: 'Bomb (will destroy adjacent enemy)',
      shield: 'Shield (gains protective shield)',
      extra_jump: 'Extra Jump (gets another move)',
    }
    return `Grabbed ${puNames[move.pickedUpPowerUp] || move.pickedUpPowerUp} power-up.`
  }
  // Simple move — describe direction
  const forward = team === 'red' ? -1 : 1
  const dr = move.toRow - move.fromRow
  if (dr === forward) {
    return `Advanced forward toward enemy territory.`
  }
  if (dr === -forward) {
    return `Moved backward (king retreat).`
  }
  return `Repositioned to control the board.`
}

function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return rooms.has(code) ? makeRoomCode() : code
}

function makePlayerSlot(socketId: string, name: string, isHost: boolean): PlayerSlot {
  return {
    id: socketId,
    name: name.slice(0, 20) || 'Anonymous',
    avatar: pickAvatar(),
    team: 'red',
    character: 'tank',
    ready: false,
    isHost,
    connected: true,
    captures: 0,
    score: 0,
  }
}

const BOT_NAMES = ['RoboRex', 'ByteBot', 'AlphaQ', 'TurboTux', 'Megatron', 'CyberCat', 'PixelPaw', 'Glitchy', 'NexaBot', 'QuirkBot']
const BOT_AVATARS = ['🤖', '👾', '🎮', '🛸', '⚙️', '🔮', '🦾', '💾']

function makeBotSlot(difficulty: BotDifficulty, team: AnyTeam): PlayerSlot {
  const nameIdx = Math.floor(Math.random() * BOT_NAMES.length)
  const diffTag = difficulty === 'easy' ? '₀₁' : difficulty === 'medium' ? '₀₂' : difficulty === 'hard' ? '₀₃' : '₀₄'
  return {
    id: `bot_${uuid().slice(0, 8)}`,
    name: `${BOT_NAMES[nameIdx]}${diffTag}`,
    avatar: BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)],
    team,
    character: ['tank', 'speedster', 'mage', 'jester'][Math.floor(Math.random() * 4)] as CharacterClass,
    ready: true,
    isHost: false,
    isBot: true,
    botDifficulty: difficulty,
    connected: true,
    captures: 0,
    score: 0,
  }
}

const AVATARS = ['🦄', '🐸', '🐙', '🦊', '🐷', '🐔', '🦖', '🐳', '🦉', '🐝']
function pickAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)]
}

const CHARACTERS: CharacterClass[] = ['tank', 'speedster', 'mage', 'jester']

function broadcastRoom(roomCode: string) {
  const state = rooms.get(roomCode)
  if (!state) return
  io.to(roomCode).emit('state', sanitize(state))
}

// Strip sensitive / unserializable fields
function sanitize(state: GameState): GameState {
  // Send everything except keep emote log small
  return {
    ...state,
    emoteLog: state.emoteLog.slice(-20),
  }
}

function broadcastPresence(roomCode: string) {
  const state = rooms.get(roomCode)
  if (!state) return
  io.to(roomCode).emit('presence', state.players)
}

// --- Game logic helpers ---

function startGame(state: GameState) {
  if (state.phase !== 'lobby') return
  // Auto-balance teams for PvP (assign half red, half blue)
  if (state.mode === 'pvp') {
    const connected = state.players.filter(p => p.connected)
    connected.forEach((p, i) => {
      p.team = i % 2 === 0 ? 'red' : 'blue'
    })
  } else {
    state.players.forEach(p => { if (p.connected) p.team = 'red' })
  }
  state.board = createBoard(state.mode, state.players.filter(p => p.connected))
  state.phase = 'playing'
  state.currentTurnTeam = 'red'
  state.currentPlayerIndex = state.players.findIndex(p => p.team === 'red' && p.connected)
  if (state.currentPlayerIndex < 0) state.currentPlayerIndex = 0
  state.turnStartedAt = Date.now()
  state.turnDurationSec = TURN_DURATION_SEC
  state.movesThisTurn = 0
  state.maxMovesPerTurn = MAX_MOVES_PER_TURN
  state.nextChaosAt = Date.now() + CHAOS_INTERVAL_SEC * 1000
  state.chaosCount = 0
  if (state.mode === 'coop') {
    const bossPiece = Object.values(state.board.pieces).find(p => p.team === 'boss' && p.isKing)
    state.boss = {
      hp: bossPiece?.hp ?? 12,
      maxHp: bossPiece?.hp ?? 12,
      rage: false,
      nextActionIn: 8,
      lastActionAt: Date.now(),
    }
  }
  state.version += 1

  // If the first player is a bot, schedule their move
  scheduleBotTurnIfApplicable(state)
}

function nextTurn(state: GameState) {
  if (state.phase !== 'playing') return
  const winner = checkWinner(state)
  if (winner) {
    state.phase = 'ended'
    state.winnerTeam = winner
    state.endedAt = Date.now()
    state.version += 1
    return
  }
  // Decrement frozen turns for the team that just finished
  for (const p of Object.values(state.board.pieces)) {
    if (p.team === state.currentTurnTeam && p.frozenTurns > 0) {
      p.frozenTurns -= 1
    }
  }
  if (state.mode === 'pvp') {
    // Switch team
    const oldTeam = state.currentTurnTeam
    const newTeam: AnyTeam = oldTeam === 'red' ? 'blue' : 'red'
    state.currentTurnTeam = newTeam
    // Find first connected player on new team
    const idx = state.players.findIndex(p => p.team === newTeam && p.connected)
    state.currentPlayerIndex = idx >= 0 ? idx : state.currentPlayerIndex
  } else {
    // Co-op: red turn, then boss turn
    if (state.currentTurnTeam === 'red') {
      state.currentTurnTeam = 'boss'
      // Run boss AI after a short delay
      setTimeout(() => runBossTurn(state), 1200)
    } else {
      state.currentTurnTeam = 'red'
      // Cycle to NEXT red player (so each red player gets a turn)
      const redPlayers = state.players
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.team === 'red' && p.connected)
      if (redPlayers.length > 0) {
        // Find current index in redPlayers; advance by 1
        const currentRedIdx = redPlayers.findIndex(({ i }) => i === state.currentPlayerIndex)
        const nextRedIdx = (currentRedIdx + 1) % redPlayers.length
        state.currentPlayerIndex = redPlayers[nextRedIdx].i
      }
    }
  }
  state.turnStartedAt = Date.now()
  state.movesThisTurn = 0
  state.turnCount += 1
  state.turnsWithoutCapture += 1
  // Chaos event?
  if (Date.now() >= state.nextChaosAt) {
    const event = rollChaosEvent()
    state.pendingChaosEvent = event
    const newState = applyChaos(state, event)
    Object.assign(state, newState)
    state.nextChaosAt = Date.now() + CHAOS_INTERVAL_SEC * 1000
    io.to(state.roomCode).emit('chaos', event)
  }
  state.version += 1

  // Check if the new current team has all pieces frozen — emit "turn skipped" notification
  const newTeamPieces = Object.values(state.board.pieces).filter(p => p.team === state.currentTurnTeam)
  const allFrozen = newTeamPieces.length > 0 && newTeamPieces.every(p => p.frozenTurns > 0)
  if (allFrozen) {
    io.to(state.roomCode).emit('turn_skipped', {
      team: state.currentTurnTeam,
      reason: 'All pieces are frozen!',
    })
    // Auto-skip the turn after a short delay
    setTimeout(() => {
      nextTurn(state)
      broadcastRoom(state.roomCode)
    }, 1500)
    return
  }

  // If new current player is a bot, schedule their turn
  scheduleBotTurnIfApplicable(state)
}

// Schedule a bot move if the current player is a bot
function scheduleBotTurnIfApplicable(state: GameState) {
  if (state.phase !== 'playing') return
  if (state.mode === 'coop' && state.currentTurnTeam === 'boss') return // boss has own scheduler
  const slot = state.players[state.currentPlayerIndex]
  if (!slot?.isBot || !slot.connected) return
  const difficulty = slot.botDifficulty || 'hard'
  // Faster thinking for easy bots, slower for brutal (feels more deliberate)
  const thinkTime = difficulty === 'easy' ? 600 : difficulty === 'medium' ? 900 : difficulty === 'hard' ? 1200 : 1500
  // Emit 'bot:thinking' so client can show indicator
  io.to(state.roomCode).emit('bot:thinking', { playerName: slot.name })
  setTimeout(() => runBotMove(state, slot.id), thinkTime + Math.random() * 400)
}

// Bot move executor — runs server-side, applies move directly
function runBotMove(state: GameState, botPlayerId: string) {
  if (state.phase !== 'playing') return
  const slot = state.players.find(p => p.id === botPlayerId)
  if (!slot?.isBot || !slot.connected) return
  // Make sure it's still their turn
  if (state.players[state.currentPlayerIndex]?.id !== botPlayerId) return

  const difficulty = slot.botDifficulty || 'hard'
  const team = slot.team

  // First, consider using an ability (mage teleport / jester swap) if beneficial
  // Find a piece with an unused ability
  const teamPieces = Object.values(state.board.pieces).filter(p => p.team === team && !p.abilityUsed && p.frozenTurns === 0)
  for (const piece of teamPieces) {
    if (piece.character !== 'mage' && piece.character !== 'jester') continue
    const decision = shouldUseAbility(state, piece, team, difficulty)
    if (decision.shouldUse && decision.targetRow !== undefined && decision.targetCol !== undefined) {
      // Execute ability directly
      piece.abilityUsed = true
      if (piece.character === 'mage') {
        piece.row = decision.targetRow
        piece.col = decision.targetCol
        io.to(state.roomCode).emit('fx', { type: 'teleport', pieceId: piece.id })
      } else if (piece.character === 'jester') {
        const other = Object.values(state.board.pieces).find(p => p.row === decision.targetRow && p.col === decision.targetCol && p.id !== piece.id)
        if (other) {
          const tr = piece.row, tc = piece.col
          piece.row = decision.targetRow
          piece.col = decision.targetCol
          other.row = tr
          other.col = tc
          io.to(state.roomCode).emit('fx', { type: 'swap', pieceIds: [piece.id, other.id] })
        }
      }
      state.version += 1
      broadcastRoom(state.roomCode)
      // Ability use ENDS the turn — no additional move.
      // (Chain captures are handled by runBotChainCapture if the ability led to a capture position)
      if (piece.character === 'mage') {
        // Check for chain captures from new position
        const followUps = getLegalMoves(state.board, piece).filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
        if (followUps.length > 0) {
          setTimeout(() => runBotChainCapture(state, botPlayerId, piece.id), 600)
          return
        }
      }
      setTimeout(() => {
        nextTurn(state)
        broadcastRoom(state.roomCode)
      }, 600)
      return
    }
  }

  // Pick best move via minimax
  const best = pickBestMove(state, team, difficulty)
  if (!best) {
    // No moves — end turn
    nextTurn(state)
    broadcastRoom(state.roomCode)
    return
  }

  // Capture original position before applying move
  const botPieceBefore = state.board.pieces[best.pieceId]
  const fromRow = botPieceBefore?.row ?? best.move.toRow
  const fromCol = botPieceBefore?.col ?? best.move.toCol

  // Apply the move
  const { board, promotedToKing, pickedUpPowerUp, appliedEffects } = applyMove(state.board, best.move)
  state.board = board
  if (best.move.capturedPieceIds.length > 0) {
    slot.captures += best.move.capturedPieceIds.length
    slot.score += best.move.capturedPieceIds.length * 10
    if (best.move.capturedPieceIds.length > 1) slot.score += 20
  }
  if (promotedToKing) {
    io.to(state.roomCode).emit('promote', best.pieceId)
  }
  // Broadcast power-up collection + effects for client FX/sound
  if (pickedUpPowerUp) {
    io.to(state.roomCode).emit('powerup:collected', {
      pieceId: best.pieceId,
      powerUp: pickedUpPowerUp,
      playerName: slot.name,
      effects: appliedEffects,
    })
    slot.score += 5
  }
  for (const eff of appliedEffects) {
    if (eff.type === 'freeze') io.to(state.roomCode).emit('fx', { type: 'freeze', pieceId: eff.pieceId })
    else if (eff.type === 'swap' && eff.targetPieceIds) io.to(state.roomCode).emit('fx', { type: 'swap', pieceIds: [eff.pieceId, ...eff.targetPieceIds] })
    else if (eff.type === 'bomb') io.to(state.roomCode).emit('fx', { type: 'bomb', pieceId: eff.pieceId })
    else if (eff.type === 'shield') io.to(state.roomCode).emit('fx', { type: 'shield', pieceId: eff.pieceId })
    else if (eff.type === 'shield_break') io.to(state.roomCode).emit('fx', { type: 'shield_break', pieceId: eff.pieceId })
  }
  state.movesThisTurn += 1
  state.version += 1
  // Broadcast move details + AI reasoning
  io.to(state.roomCode).emit('move:made', {
    pieceId: best.pieceId,
    fromRow,
    fromCol,
    toRow: best.move.toRow,
    toCol: best.move.toCol,
    playerName: slot.name,
    team: slot.team,
    isBot: true,
    kind: best.move.kind,
    capturedCount: best.move.capturedPieceIds.length,
    abilityUsed: false,
    pickedUpPowerUp,
    promotedToKing,
    reason: generateMoveReason(best.move, slot.team, difficulty),
  })
  broadcastRoom(state.roomCode)

  // Check winner
  const winner = checkWinner(state)
  if (winner) {
    state.phase = 'ended'
    state.winnerTeam = winner
    state.endedAt = Date.now()
    state.version += 1
    broadcastRoom(state.roomCode)
    return
  }

  // Check for chain captures
  const movedPiece = state.board.pieces[best.pieceId]
  if (movedPiece && best.move.kind === 'capture') {
    const followUps = getLegalMoves(state.board, movedPiece).filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
    if (followUps.length > 0) {
      // Continue chain with another bot move (faster)
      setTimeout(() => runBotChainCapture(state, botPlayerId, movedPiece.id), 500)
      return
    }
  }

  // double_move / extra_jump: bot gets another move
  if (pickedUpPowerUp === 'double_move' || pickedUpPowerUp === 'extra_jump') {
    state.turnStartedAt = Date.now()
    io.to(state.roomCode).emit('bonus_move', { pieceId: best.pieceId, powerUp: pickedUpPowerUp })
    setTimeout(() => runBotMove(state, botPlayerId), 600)
    return
  }

  // End turn after a short pause
  setTimeout(() => {
    nextTurn(state)
    broadcastRoom(state.roomCode)
  }, 400)
}

// Bot chain capture — pick best follow-up move for a specific piece
function runBotChainCapture(state: GameState, botPlayerId: string, pieceId: string) {
  if (state.phase !== 'playing') return
  const slot = state.players.find(p => p.id === botPlayerId)
  if (!slot?.isBot) return
  const piece = state.board.pieces[pieceId]
  if (!piece) {
    nextTurn(state)
    broadcastRoom(state.roomCode)
    return
  }
  const captures = getLegalMoves(state.board, piece).filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
  if (captures.length === 0) {
    nextTurn(state)
    broadcastRoom(state.roomCode)
    return
  }
  // Pick the capture with most captured pieces (greedy for chains)
  let best = captures[0]
  for (const m of captures) {
    if (m.capturedPieceIds.length > best.capturedPieceIds.length) best = m
  }
  const chainFromRow = piece.row
  const chainFromCol = piece.col
  const { board, promotedToKing, pickedUpPowerUp, appliedEffects } = applyMove(state.board, best)
  state.board = board
  slot.captures += best.capturedPieceIds.length
  slot.score += best.capturedPieceIds.length * 10
  if (promotedToKing) io.to(state.roomCode).emit('promote', pieceId)
  // Broadcast power-up collection + effects
  if (pickedUpPowerUp) {
    io.to(state.roomCode).emit('powerup:collected', {
      pieceId, powerUp: pickedUpPowerUp, playerName: slot.name, effects: appliedEffects,
    })
    slot.score += 5
  }
  for (const eff of appliedEffects) {
    if (eff.type === 'freeze') io.to(state.roomCode).emit('fx', { type: 'freeze', pieceId: eff.pieceId })
    else if (eff.type === 'swap' && eff.targetPieceIds) io.to(state.roomCode).emit('fx', { type: 'swap', pieceIds: [eff.pieceId, ...eff.targetPieceIds] })
    else if (eff.type === 'bomb') io.to(state.roomCode).emit('fx', { type: 'bomb', pieceId: eff.pieceId })
    else if (eff.type === 'shield') io.to(state.roomCode).emit('fx', { type: 'shield', pieceId: eff.pieceId })
    else if (eff.type === 'shield_break') io.to(state.roomCode).emit('fx', { type: 'shield_break', pieceId: eff.pieceId })
  }
  state.version += 1
  // Broadcast move details for chain capture
  io.to(state.roomCode).emit('move:made', {
    pieceId,
    fromRow: chainFromRow,
    fromCol: chainFromCol,
    toRow: best.toRow,
    toCol: best.toCol,
    playerName: slot.name,
    team: slot.team,
    isBot: true,
    kind: best.kind,
    capturedCount: best.capturedPieceIds.length,
    abilityUsed: false,
    pickedUpPowerUp,
    promotedToKing,
    reason: `Chain capture! Took ${best.capturedPieceIds.length} piece${best.capturedPieceIds.length > 1 ? 's' : ''}.`,
  })
  broadcastRoom(state.roomCode)

  // Check winner
  const winner = checkWinner(state)
  if (winner) {
    state.phase = 'ended'
    state.winnerTeam = winner
    state.endedAt = Date.now()
    state.version += 1
    broadcastRoom(state.roomCode)
    return
  }

  // Check for further chains
  const movedPiece = state.board.pieces[pieceId]
  if (movedPiece) {
    const more = getLegalMoves(state.board, movedPiece).filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
    if (more.length > 0) {
      setTimeout(() => runBotChainCapture(state, botPlayerId, pieceId), 600)
      return
    }
  }
  // double_move / extra_jump bonus
  if (pickedUpPowerUp === 'double_move' || pickedUpPowerUp === 'extra_jump') {
    state.turnStartedAt = Date.now()
    io.to(state.roomCode).emit('bonus_move', { pieceId, powerUp: pickedUpPowerUp })
    setTimeout(() => runBotMove(state, botPlayerId), 600)
    return
  }
  setTimeout(() => {
    nextTurn(state)
    broadcastRoom(state.roomCode)
  }, 400)
}

function runBossTurn(state: GameState) {
  if (state.phase !== 'playing' || state.mode !== 'coop') return
  if (state.currentTurnTeam !== 'boss') return

  // Rage mode at 50% HP
  if (state.boss && !state.boss.rage && state.boss.hp <= state.boss.maxHp / 2) {
    state.boss.rage = true
    io.to(state.roomCode).emit('boss-rage', true)
  }

  // Boss summons a minion every 3rd turn if raging
  if (state.boss?.rage && state.chaosCount % 3 === 0) {
    const { state: ns } = bossSummon(state)
    Object.assign(state, ns)
  }

  // Make 1-2 moves if raging. Use recursive helper to handle chains + power-ups.
  const movesToMake = state.boss?.rage ? 2 : 1
  runBossMoveRecursive(state, movesToMake, 0)
}

// Helper: make N boss moves, handling chain captures + power-ups + bonus moves
function runBossMoveRecursive(state: GameState, movesRemaining: number, depth: number) {
  if (state.phase !== 'playing' || depth > 10) {
    // End turn
    broadcastRoom(state.roomCode)
    setTimeout(() => {
      nextTurn(state)
      broadcastRoom(state.roomCode)
    }, 600)
    return
  }

  const pick = pickBossMove(state)
  if (!pick) {
    broadcastRoom(state.roomCode)
    setTimeout(() => {
      nextTurn(state)
      broadcastRoom(state.roomCode)
    }, 600)
    return
  }

  const { board, promotedToKing, pickedUpPowerUp, appliedEffects } = applyMove(state.board, pick.move)
  state.board = board

  // Update boss HP if the boss piece itself was involved (shouldn't happen, but just in case)
  const bossPiece = Object.values(state.board.pieces).find(p => p.team === 'boss' && p.isKing)
  if (state.boss && bossPiece) {
    state.boss.hp = bossPiece.hp
  }

  // Record captures (boss doesn't have a player slot, so we just track in state)
  if (pick.move.capturedPieceIds.length > 0) {
    // Find any human player slot to attribute captures to boss (for display)
    // Actually, just update the boss display via state.boss
  }

  if (promotedToKing) {
    io.to(state.roomCode).emit('promote', pick.pieceId)
  }

  // Broadcast power-up collection + effects
  if (pickedUpPowerUp) {
    io.to(state.roomCode).emit('powerup:collected', {
      pieceId: pick.pieceId,
      powerUp: pickedUpPowerUp,
      playerName: 'BOSS',
      effects: appliedEffects,
    })
  }
  for (const eff of appliedEffects) {
    if (eff.type === 'freeze') io.to(state.roomCode).emit('fx', { type: 'freeze', pieceId: eff.pieceId })
    else if (eff.type === 'swap' && eff.targetPieceIds) io.to(state.roomCode).emit('fx', { type: 'swap', pieceIds: [eff.pieceId, ...eff.targetPieceIds] })
    else if (eff.type === 'bomb') io.to(state.roomCode).emit('fx', { type: 'bomb', pieceId: eff.pieceId })
    else if (eff.type === 'shield') io.to(state.roomCode).emit('fx', { type: 'shield', pieceId: eff.pieceId })
    else if (eff.type === 'shield_break') io.to(state.roomCode).emit('fx', { type: 'shield_break', pieceId: eff.pieceId })
  }

  state.version += 1
  broadcastRoom(state.roomCode)

  // Check winner
  const winner = checkWinner(state)
  if (winner) {
    state.phase = 'ended'
    state.winnerTeam = winner
    state.endedAt = Date.now()
    state.version += 1
    broadcastRoom(state.roomCode)
    return
  }

  // Chain captures: if this was a capture, check for follow-ups
  const movedPiece = state.board.pieces[pick.pieceId]
  if (movedPiece && pick.move.kind === 'capture') {
    const followUps = getLegalMoves(state.board, movedPiece).filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
    if (followUps.length > 0) {
      // Continue chain (doesn't consume a move from movesRemaining)
      setTimeout(() => runBossChainCapture(state, pick.pieceId, movesRemaining, depth + 1), 500)
      return
    }
  }

  // double_move / extra_jump: bonus move (doesn't consume from movesRemaining)
  if (pickedUpPowerUp === 'double_move' || pickedUpPowerUp === 'extra_jump') {
    setTimeout(() => runBossMoveRecursive(state, movesRemaining, depth + 1), 500)
    return
  }

  // Normal: consume one move
  const next = movesRemaining - 1
  if (next > 0) {
    setTimeout(() => runBossMoveRecursive(state, next, depth + 1), 500)
  } else {
    setTimeout(() => {
      nextTurn(state)
      broadcastRoom(state.roomCode)
    }, 600)
  }
}

// Boss chain capture helper
function runBossChainCapture(state: GameState, pieceId: string, movesRemaining: number, depth: number) {
  if (state.phase !== 'playing') return
  const piece = state.board.pieces[pieceId]
  if (!piece) {
    runBossMoveRecursive(state, movesRemaining, depth + 1)
    return
  }
  const captures = getLegalMoves(state.board, piece).filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
  if (captures.length === 0) {
    runBossMoveRecursive(state, movesRemaining, depth + 1)
    return
  }
  // Pick the capture with most captured pieces
  let best = captures[0]
  for (const m of captures) {
    if (m.capturedPieceIds.length > best.capturedPieceIds.length) best = m
  }
  const { board, promotedToKing, pickedUpPowerUp, appliedEffects } = applyMove(state.board, best)
  state.board = board
  if (promotedToKing) io.to(state.roomCode).emit('promote', pieceId)
  if (pickedUpPowerUp) {
    io.to(state.roomCode).emit('powerup:collected', {
      pieceId, powerUp: pickedUpPowerUp, playerName: 'BOSS', effects: appliedEffects,
    })
  }
  for (const eff of appliedEffects) {
    if (eff.type === 'freeze') io.to(state.roomCode).emit('fx', { type: 'freeze', pieceId: eff.pieceId })
    else if (eff.type === 'swap' && eff.targetPieceIds) io.to(state.roomCode).emit('fx', { type: 'swap', pieceIds: [eff.pieceId, ...eff.targetPieceIds] })
    else if (eff.type === 'bomb') io.to(state.roomCode).emit('fx', { type: 'bomb', pieceId: eff.pieceId })
    else if (eff.type === 'shield') io.to(state.roomCode).emit('fx', { type: 'shield', pieceId: eff.pieceId })
  }
  state.version += 1
  broadcastRoom(state.roomCode)

  // Check for further chains
  const movedPiece = state.board.pieces[pieceId]
  if (movedPiece) {
    const more = getLegalMoves(state.board, movedPiece).filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
    if (more.length > 0) {
      setTimeout(() => runBossChainCapture(state, pieceId, movesRemaining, depth + 1), 500)
      return
    }
  }
  // Chain done — continue with remaining moves
  runBossMoveRecursive(state, movesRemaining, depth + 1)
}

// --- Socket events ---

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`)

  socket.on('room:create', ({ name, mode }: { name: string; mode: GameMode }) => {
    const roomCode = makeRoomCode()
    const slot = makePlayerSlot(socket.id, name, true)
    const state: GameState = {
      id: uuid(),
      roomCode,
      mode,
      phase: 'lobby',
      board: createBoard(mode, [slot]), // placeholder; will rebuild on start
      players: [slot],
      currentTurnTeam: 'red',
      currentPlayerIndex: 0,
      turnStartedAt: 0,
      turnDurationSec: TURN_DURATION_SEC,
      movesThisTurn: 0,
      maxMovesPerTurn: MAX_MOVES_PER_TURN,
      nextChaosAt: 0,
      chaosCount: 0,
      turnCount: 0,
      turnsWithoutCapture: 0,
      emoteLog: [],
      version: 1,
    }
    rooms.set(roomCode, state)
    socketToRoom.set(socket.id, { roomCode, playerId: socket.id })
    socket.join(roomCode)
    socket.emit('room:created', { roomCode })
    broadcastRoom(roomCode)
  })

  socket.on('room:join', ({ name, roomCode }: { name: string; roomCode: string }) => {
    const state = rooms.get(roomCode.toUpperCase())
    if (!state) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' })
      return
    }
    if (state.phase !== 'lobby') {
      socket.emit('error', { code: 'GAME_STARTED', message: 'Game already started' })
      return
    }
    if (state.players.length >= 6) {
      socket.emit('error', { code: 'ROOM_FULL', message: 'Room is full (max 6)' })
      return
    }
    const slot = makePlayerSlot(socket.id, name, false)
    // If joining, don't be host even if old host left
    if (state.players.length === 0) slot.isHost = true
    state.players.push(slot)
    socketToRoom.set(socket.id, { roomCode, playerId: socket.id })
    socket.join(roomCode)
    socket.emit('room:joined', { roomCode })
    broadcastRoom(roomCode)
  })

  socket.on('player:update', (data: Partial<Pick<PlayerSlot, 'team' | 'character' | 'ready' | 'name'>>) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const state = rooms.get(meta.roomCode)
    if (!state) return
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot) return
    if (data.team !== undefined) {
      // For PvP, ensure teams are balanced (max 3 per side)
      const teamCount = state.players.filter(p => p.team === data.team && p.id !== slot.id).length
      if (state.mode === 'pvp' && teamCount >= 3) {
        socket.emit('error', { code: 'TEAM_FULL', message: 'Team is full' })
        return
      }
      slot.team = data.team
    }
    if (data.character !== undefined) slot.character = data.character
    if (data.ready !== undefined) slot.ready = data.ready
    if (data.name !== undefined) slot.name = data.name.slice(0, 20)
    broadcastRoom(meta.roomCode)
  })

  socket.on('game:start', () => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const state = rooms.get(meta.roomCode)
    if (!state) return
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot?.isHost) {
      socket.emit('error', { code: 'NOT_HOST', message: 'Only host can start' })
      return
    }
    if (state.players.filter(p => p.connected).length < 2) {
      socket.emit('error', { code: 'NEED_PLAYERS', message: 'Need at least 2 players (add a bot!)' })
      return
    }
    startGame(state)
    broadcastRoom(meta.roomCode)
  })

  socket.on('bot:add', ({ difficulty, team }: { difficulty: BotDifficulty; team?: AnyTeam }) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const state = rooms.get(meta.roomCode)
    if (!state) return
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot?.isHost) {
      socket.emit('error', { code: 'NOT_HOST', message: 'Only host can add bots' })
      return
    }
    if (state.phase !== 'lobby') {
      socket.emit('error', { code: 'GAME_STARTED', message: 'Game already started' })
      return
    }
    if (state.players.length >= 6) {
      socket.emit('error', { code: 'ROOM_FULL', message: 'Room is full (max 6)' })
      return
    }
    // Pick team: if specified, use it; else pick team with fewer players
    let botTeam: AnyTeam
    if (team) {
      botTeam = team
    } else if (state.mode === 'coop') {
      botTeam = 'red'
    } else {
      const redCount = state.players.filter(p => p.team === 'red').length
      const blueCount = state.players.filter(p => p.team === 'blue').length
      botTeam = redCount <= blueCount ? 'red' : 'blue'
    }
    // Team balance check for PvP
    if (state.mode === 'pvp') {
      const teamCount = state.players.filter(p => p.team === botTeam).length
      if (teamCount >= 3) {
        socket.emit('error', { code: 'TEAM_FULL', message: 'Team is full' })
        return
      }
    }
    const botSlot = makeBotSlot(difficulty, botTeam)
    state.players.push(botSlot)
    broadcastRoom(meta.roomCode)
  })

  socket.on('bot:remove', ({ botId }: { botId: string }) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const state = rooms.get(meta.roomCode)
    if (!state) return
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot?.isHost) return
    if (state.phase !== 'lobby') return
    const idx = state.players.findIndex(p => p.id === botId && p.isBot)
    if (idx >= 0) {
      state.players.splice(idx, 1)
      broadcastRoom(meta.roomCode)
    }
  })

  socket.on('move:list', ({ pieceId }: { pieceId: string }) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const state = rooms.get(meta.roomCode)
    if (!state || state.phase !== 'playing') return
    const piece = state.board.pieces[pieceId]
    if (!piece) return
    const moves = getLegalMoves(state.board, piece)
    socket.emit('move:list', { pieceId, moves })
  })

  socket.on('move:make', ({ move }: { move: Move }) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const state = rooms.get(meta.roomCode)
    if (!state || state.phase !== 'playing') return
    // It's the player's turn?
    const currentSlot = state.players[state.currentPlayerIndex]
    if (!currentSlot || currentSlot.id !== socket.id) {
      socket.emit('error', { code: 'NOT_YOUR_TURN', message: 'Not your turn' })
      return
    }
    const piece = state.board.pieces[move.pieceId]
    if (!piece) return
    // Only your own pieces (or any red piece in coop)
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot || piece.team !== slot.team) {
      socket.emit('error', { code: 'NOT_YOUR_PIECE', message: 'Not your piece' })
      return
    }
    if (piece.frozenTurns > 0) {
      socket.emit('error', { code: 'FROZEN', message: 'Piece is frozen' })
      return
    }
    // Validate against legal moves
    const legal = getLegalMoves(state.board, piece)
    const match = legal.find(m =>
      m.toRow === move.toRow && m.toCol === move.toCol &&
      m.capturedPieceIds.length === move.capturedPieceIds.length,
    )
    if (!match) {
      socket.emit('error', { code: 'ILLEGAL_MOVE', message: 'Illegal move' })
      return
    }
    // Apply
    const { board, promotedToKing, pickedUpPowerUp, appliedEffects } = applyMove(state.board, match)
    state.board = board
    if (match.capturedPieceIds.length > 0) {
      slot.captures += match.capturedPieceIds.length
      slot.score += match.capturedPieceIds.length * 10
      if (match.capturedPieceIds.length > 1) slot.score += 20 // combo bonus
      state.turnsWithoutCapture = 0 // reset capture counter
    }
    if (promotedToKing) {
      io.to(state.roomCode).emit('promote', match.pieceId)
    }
    // Broadcast power-up collection + effects for client FX/sound
    if (pickedUpPowerUp) {
      io.to(state.roomCode).emit('powerup:collected', {
        pieceId: match.pieceId,
        powerUp: pickedUpPowerUp,
        playerName: slot.name,
        effects: appliedEffects,
      })
      // Power-up score bonus
      slot.score += 5
    }
    // Broadcast individual effects (freeze, swap, bomb) for FX
    for (const eff of appliedEffects) {
      if (eff.type === 'freeze') io.to(state.roomCode).emit('fx', { type: 'freeze', pieceId: eff.pieceId })
      else if (eff.type === 'swap' && eff.targetPieceIds) io.to(state.roomCode).emit('fx', { type: 'swap', pieceIds: [eff.pieceId, ...eff.targetPieceIds] })
      else if (eff.type === 'bomb') io.to(state.roomCode).emit('fx', { type: 'bomb', pieceId: eff.pieceId })
      else if (eff.type === 'shield') io.to(state.roomCode).emit('fx', { type: 'shield', pieceId: eff.pieceId })
      else if (eff.type === 'shield_break') io.to(state.roomCode).emit('fx', { type: 'shield_break', pieceId: eff.pieceId })
    }
    state.movesThisTurn += 1
    state.version += 1
    // Broadcast move details for the move log + animation
    io.to(state.roomCode).emit('move:made', {
      pieceId: match.pieceId,
      fromRow: piece.row, // original position (before move — piece object was already updated)
      fromCol: piece.col,
      toRow: match.toRow,
      toCol: match.toCol,
      playerName: slot.name,
      team: slot.team,
      isBot: !!slot.isBot,
      kind: match.kind,
      capturedCount: match.capturedPieceIds.length,
      abilityUsed: false,
      pickedUpPowerUp,
      promotedToKing,
    })
    broadcastRoom(state.roomCode)

    // Check winner immediately after move
    const winner = checkWinner(state)
    if (winner) {
      state.phase = 'ended'
      state.winnerTeam = winner
      state.endedAt = Date.now()
      state.version += 1
      broadcastRoom(state.roomCode)
      return
    }

    // Chain captures: if this was a capture, check for follow-ups
    const movedPiece = state.board.pieces[match.pieceId]
    if (movedPiece && match.kind === 'capture') {
      const followUps = getLegalMoves(state.board, movedPiece).filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
      if (followUps.length > 0) {
        // Allow chain: don't end turn
        io.to(state.roomCode).emit('chain:available', { pieceId: match.pieceId, moves: followUps })
        return
      }
    }

    // double_move / extra_jump: don't end turn — let player move again
    if (pickedUpPowerUp === 'double_move' || pickedUpPowerUp === 'extra_jump') {
      // Reset turn timer for the bonus move
      state.turnStartedAt = Date.now()
      io.to(state.roomCode).emit('bonus_move', { pieceId: match.pieceId, powerUp: pickedUpPowerUp })
      return
    }

    // End turn
    setTimeout(() => {
      nextTurn(state)
      broadcastRoom(state.roomCode)
    }, 300)
  })

  socket.on('ability:use', ({ pieceId, targetRow, targetCol }: { pieceId: string; targetRow: number; targetCol: number }) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const state = rooms.get(meta.roomCode)
    if (!state || state.phase !== 'playing') return
    const currentSlot = state.players[state.currentPlayerIndex]
    if (!currentSlot || currentSlot.id !== socket.id) return
    const piece = state.board.pieces[pieceId]
    if (!piece) return
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot || piece.team !== slot.team) return
    if (piece.abilityUsed) {
      socket.emit('error', { code: 'ABILITY_USED', message: 'Ability already used' })
      return
    }
    const targets = getAbilityTargets(state.board, piece)
    if (!targets.some(t => t.row === targetRow && t.col === targetCol)) {
      socket.emit('error', { code: 'BAD_TARGET', message: 'Invalid target' })
      return
    }
    piece.abilityUsed = true
    let pickedUpPowerUp: PowerUpType | undefined
    let promotedToKing = false
    let appliedEffects: PowerUpEffect[] = []

    if (piece.character === 'mage') {
      // Teleport to target tile
      piece.row = targetRow
      piece.col = targetCol
      io.to(state.roomCode).emit('fx', { type: 'teleport', pieceId })
      // Pick up power-up at destination (if any) — apply directly
      const landCell = state.board.cells[targetRow]?.[targetCol]
      if (landCell && landCell.type === 'powerup' && landCell.powerUp) {
        pickedUpPowerUp = landCell.powerUp
        // Apply the power-up effect directly to the board state
        appliedEffects = applyPowerUpEffect(piece, pickedUpPowerUp, state.board.pieces, state.board.cells)
        // Clear the power-up cell
        landCell.type = 'normal'
        landCell.powerUp = undefined
        // Broadcast power-up collection
        io.to(state.roomCode).emit('powerup:collected', {
          pieceId, powerUp: pickedUpPowerUp, playerName: slot.name, effects: appliedEffects,
        })
        slot.score += 5
        for (const eff of appliedEffects) {
          if (eff.type === 'freeze') io.to(state.roomCode).emit('fx', { type: 'freeze', pieceId: eff.pieceId })
          else if (eff.type === 'swap' && eff.targetPieceIds) io.to(state.roomCode).emit('fx', { type: 'swap', pieceIds: [eff.pieceId, ...eff.targetPieceIds] })
          else if (eff.type === 'bomb') io.to(state.roomCode).emit('fx', { type: 'bomb', pieceId: eff.pieceId })
          else if (eff.type === 'shield') io.to(state.roomCode).emit('fx', { type: 'shield', pieceId: eff.pieceId })
          else if (eff.type === 'shield_break') io.to(state.roomCode).emit('fx', { type: 'shield_break', pieceId: eff.pieceId })
        }
      }
      // NOTE: Abilities do NOT trigger king promotion.
      // King promotion only happens via NORMAL MOVES (see applyMove in engine.ts).
      // This prevents mage teleport and jester swap from being "instant king" exploits.
    } else if (piece.character === 'jester') {
      const other = Object.values(state.board.pieces).find(p => p.row === targetRow && p.col === targetCol && p.id !== piece.id)
      if (other) {
        const tr = piece.row, tc = piece.col
        piece.row = targetRow
        piece.col = targetCol
        other.row = tr
        other.col = tc
        io.to(state.roomCode).emit('fx', { type: 'swap', pieceIds: [pieceId, other.id] })
      }
      // NOTE: Jester swap does NOT trigger king promotion (same as mage).
    }

    if (promotedToKing) io.to(state.roomCode).emit('promote', pieceId)
    state.version += 1
    broadcastRoom(state.roomCode)

    // After mage teleport, check for chain captures from new position
    if (piece.character === 'mage') {
      const followUps = getLegalMoves(state.board, piece).filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
      if (followUps.length > 0) {
        io.to(state.roomCode).emit('chain:available', { pieceId, moves: followUps })
        return
      }
      // double_move/extra_jump bonus — ability + bonus move = 2 actions, then turn ends
      if (pickedUpPowerUp === 'double_move' || pickedUpPowerUp === 'extra_jump') {
        state.turnStartedAt = Date.now()
        io.to(state.roomCode).emit('bonus_move', { pieceId, powerUp: pickedUpPowerUp })
        return
      }
    }
    // Ability use ENDS the turn — using your special power is your action for this turn.
    // This prevents mage from teleporting AND moving in the same turn (too strong).
    setTimeout(() => {
      nextTurn(state)
      broadcastRoom(state.roomCode)
    }, 400)
  })

  socket.on('emote', ({ emoji, targetPieceId }: { emoji: string; targetPieceId?: string }) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const state = rooms.get(meta.roomCode)
    if (!state) return
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot) return
    const ev: EmoteEvent = {
      id: uuid(),
      playerId: socket.id,
      playerName: slot.name,
      emoji,
      targetPieceId,
      timestamp: Date.now(),
    }
    state.emoteLog.push(ev)
    io.to(state.roomCode).emit('emote', ev)
  })

  socket.on('chat', ({ text }: { text: string }) => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const state = rooms.get(meta.roomCode)
    if (!state) return
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot) return
    const safe = text.slice(0, 200)
    io.to(meta.roomCode).emit('chat', { playerId: socket.id, name: slot.name, avatar: slot.avatar, text: safe, timestamp: Date.now() })
  })

  socket.on('game:restart', () => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) return
    const state = rooms.get(meta.roomCode)
    if (!state) return
    const slot = state.players.find(p => p.id === socket.id)
    if (!slot?.isHost) return
    state.phase = 'lobby'
    state.players.forEach(p => { p.ready = false; p.captures = 0; p.score = 0 })
    state.board = createBoard(state.mode, state.players)
    state.winnerTeam = undefined
    state.endedAt = undefined
    state.boss = undefined
    state.emoteLog = []
    state.version += 1
    broadcastRoom(meta.roomCode)
  })

  socket.on('disconnect', () => {
    const meta = socketToRoom.get(socket.id)
    if (!meta) {
      console.log(`[socket] disconnected (no room): ${socket.id}`)
      return
    }
    const state = rooms.get(meta.roomCode)
    socketToRoom.delete(socket.id)
    if (!state) return
    const slot = state.players.find(p => p.id === socket.id)
    if (slot) {
      slot.connected = false
      // If host left, promote next connected player
      if (slot.isHost) {
        const nextHost = state.players.find(p => p.connected && p.id !== socket.id)
        if (nextHost) nextHost.isHost = true
      }
    }
    // Clean up empty rooms after 5 minutes
    if (state.players.every(p => !p.connected)) {
      setTimeout(() => {
        if (state.players.every(p => !p.connected)) {
          rooms.delete(meta.roomCode)
          console.log(`[room] cleaned up: ${meta.roomCode}`)
        }
      }, 5 * 60 * 1000)
    }
    broadcastRoom(meta.roomCode)
    console.log(`[socket] disconnected: ${socket.id} from room ${meta.roomCode}`)
  })

  socket.on('error', (err) => {
    console.error(`[socket] error (${socket.id}):`, err)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[jumbo-royale] game server running on port ${PORT}`)
})

// Turn timeout ticker — every 1s, check all active games for expired turns
setInterval(() => {
  for (const state of rooms.values()) {
    if (state.phase !== 'playing') continue
    // Skip if boss turn is in progress (it has its own setTimeout)
    if (state.mode === 'coop' && state.currentTurnTeam === 'boss') continue
    const elapsed = Date.now() - state.turnStartedAt
    if (elapsed >= state.turnDurationSec * 1000) {
      // Force end turn
      nextTurn(state)
      broadcastRoom(state.roomCode)
    }
  }
}, 1000)

process.on('SIGTERM', () => {
  console.log('[jumbo-royale] SIGTERM, shutting down...')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('[jumbo-royale] SIGINT, shutting down...')
  httpServer.close(() => process.exit(0))
})
