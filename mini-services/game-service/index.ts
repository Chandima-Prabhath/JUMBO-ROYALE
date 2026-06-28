// Jumbo Royale - Authoritative game server (Socket.IO mini-service)
import { createServer } from 'http'
import { Server } from 'socket.io'
import { v4 as uuid } from 'uuid'
import {
  GameState, GameMode, PlayerSlot, AnyTeam, CharacterClass,
  Move, EmoteEvent, Piece,
} from '../../src/game/types'
import { createBoard, BOARD_SIZE, TURN_DURATION_SEC, MAX_MOVES_PER_TURN, CHAOS_INTERVAL_SEC } from '../../src/game/board'
import { getLegalMoves, applyMove, getTeamMoves, getAbilityTargets } from '../../src/game/engine'
import { checkWinner, applyChaos, rollChaosEvent, pickBossMove, bossSummon } from '../../src/game/rules'

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
      const idx = state.players.findIndex(p => p.team === 'red' && p.connected)
      state.currentPlayerIndex = idx >= 0 ? idx : state.currentPlayerIndex
    }
  }
  state.turnStartedAt = Date.now()
  state.movesThisTurn = 0
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

  // Make 1-2 moves if raging
  const movesToMake = state.boss?.rage ? 2 : 1
  for (let i = 0; i < movesToMake; i++) {
    const pick = pickBossMove(state)
    if (!pick) break
    const { board, promotedToKing } = applyMove(state.board, pick.move)
    state.board = board
    if (pick.move.capturedPieceIds.length > 0) {
      const playerSlot = state.players.find(p => p.id === 'boss')
      if (playerSlot) playerSlot.captures += pick.move.capturedPieceIds.length
    }
    if (promotedToKing) {
      io.to(state.roomCode).emit('promote', pick.pieceId)
    }
    state.version += 1
  }

  broadcastRoom(state.roomCode)
  setTimeout(() => {
    nextTurn(state)
    broadcastRoom(state.roomCode)
  }, 800)
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
      socket.emit('error', { code: 'NEED_PLAYERS', message: 'Need at least 2 players' })
      return
    }
    if (state.mode === 'coop' && state.players.filter(p => p.connected).length < 2) {
      socket.emit('error', { code: 'NEED_PLAYERS', message: 'Co-op needs at least 2 humans' })
      return
    }
    startGame(state)
    broadcastRoom(meta.roomCode)
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
    if (state.mode === 'pvp') {
      const slot = state.players[state.currentPlayerIndex]
      if (!slot || slot.id !== socket.id) {
        socket.emit('error', { code: 'NOT_YOUR_TURN', message: 'Not your turn' })
        return
      }
    } else if (state.currentTurnTeam !== 'red') {
      socket.emit('error', { code: 'NOT_YOUR_TURN', message: "Boss's turn" })
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
    const { board, promotedToKing } = applyMove(state.board, match)
    state.board = board
    if (match.capturedPieceIds.length > 0) {
      slot.captures += match.capturedPieceIds.length
      slot.score += match.capturedPieceIds.length * 10
      if (match.capturedPieceIds.length > 1) slot.score += 20 // combo bonus
    }
    if (promotedToKing) {
      io.to(state.roomCode).emit('promote', match.pieceId)
    }
    state.movesThisTurn += 1
    state.version += 1
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

    // End turn unless extra_jump power-up or chain capture available
    const movedPiece = state.board.pieces[match.pieceId]
    if (movedPiece && match.kind === 'capture') {
      // Check for chain captures from new position
      const followUps = getLegalMoves(state.board, movedPiece).filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
      if (followUps.length > 0) {
        // Allow chain: don't end turn
        io.to(state.roomCode).emit('chain:available', { pieceId: match.pieceId, moves: followUps })
        return
      }
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
    if (state.mode === 'pvp') {
      const slot = state.players[state.currentPlayerIndex]
      if (!slot || slot.id !== socket.id) return
    } else if (state.currentTurnTeam !== 'red') return
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
    if (piece.character === 'mage') {
      piece.row = targetRow
      piece.col = targetCol
      io.to(state.roomCode).emit('fx', { type: 'teleport', pieceId })
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
    }
    state.version += 1
    broadcastRoom(state.roomCode)
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

const PORT = 3003
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
