// Jumbo Royale - Zustand store
'use client'
import { create } from 'zustand'
import { GameState, Move, PlayerSlot, EmoteEvent, GameMode, ChaosEvent, CharacterClass, AnyTeam, BotDifficulty, PowerUpType } from '@/game/types'
import { getSocket } from '@/lib/socket/client'
import { playSfx } from '@/lib/sound'

interface JumboStore {
  connected: boolean
  roomId: string | null
  myPlayerId: string | null
  state: GameState | null
  error: { code: string; message: string } | null
  selectedPieceId: string | null
  legalMoves: Move[]
  pendingChaos: ChaosEvent | null
  lastEmotes: EmoteEvent[]
  chatMessages: { playerId: string; name: string; avatar?: string; text: string; timestamp: number }[]
  fxQueue: { id: string; type: string; pieceId?: string; pieceIds?: string[] }[]
  powerupCollected: { id: string; playerName: string; powerUp: PowerUpType; effects: any[]; timestamp: number } | null
  bonusMove: { pieceId: string; powerUp: PowerUpType } | null

  // actions
  init: () => void
  createRoom: (name: string, mode: GameMode) => void
  joinRoom: (name: string, roomCode: string) => void
  updatePlayer: (data: Partial<Pick<PlayerSlot, 'team' | 'character' | 'ready' | 'name'>>) => void
  startGame: () => void
  restartGame: () => void
  addBot: (difficulty: BotDifficulty, team?: AnyTeam) => void
  removeBot: (botId: string) => void
  selectPiece: (pieceId: string | null) => void
  requestMoves: (pieceId: string) => void
  makeMove: (move: Move) => void
  useAbility: (pieceId: string, targetRow: number, targetCol: number) => void
  sendEmote: (emoji: string, targetPieceId?: string) => void
  sendChat: (text: string) => void
  clearError: () => void
}

export const useJumbo = create<JumboStore>((set, get) => ({
  connected: false,
  roomId: null,
  myPlayerId: null,
  state: null,
  error: null,
  selectedPieceId: null,
  legalMoves: [],
  pendingChaos: null,
  lastEmotes: [],
  chatMessages: [],
  fxQueue: [],
  powerupCollected: null,
  bonusMove: null,

  init: () => {
    if (get().connected) return
    const socket = getSocket()
    socket.on('connect', () => {
      set({ connected: true, myPlayerId: socket.id })
    })
    socket.on('disconnect', () => {
      set({ connected: false })
    })
    socket.on('state', (state: GameState) => {
      const prev = get().state
      // Sound triggers based on state diff
      if (prev) {
        // Phase transitions
        if (prev.phase === 'lobby' && state.phase === 'playing') {
          playSfx('join')
        }
        if (prev.phase === 'playing' && state.phase === 'ended') {
          const myId = get().myPlayerId
          const mySlot = state.players.find(p => p.id === myId)
          if (mySlot && state.winnerTeam === mySlot.team) playSfx('win')
          else playSfx('lose')
        }
        // Turn change → "your turn" ping
        if (state.phase === 'playing' && prev.currentTurnTeam !== state.currentTurnTeam) {
          const myId = get().myPlayerId
          const mySlot = state.players.find(p => p.id === myId)
          if (mySlot && state.currentTurnTeam === mySlot.team) {
            playSfx('turn_yours')
          }
        }
        // Captures happened
        const prevPieceCount = Object.keys(prev.board.pieces).length
        const newPieceCount = Object.keys(state.board.pieces).length
        if (newPieceCount < prevPieceCount) {
          // Was it a multi-capture? Check score increase
          const captured = prevPieceCount - newPieceCount
          if (captured >= 2) playSfx('multi_capture')
          else playSfx('capture')
        } else if (newPieceCount === prevPieceCount && state.version > prev.version + 0 && state.movesThisTurn > prev.movesThisTurn) {
          // A move was made (no capture)
          playSfx('move')
        }
        // Boss rage
        if (state.boss && prev.boss && !prev.boss.rage && state.boss.rage) {
          playSfx('boss_rage')
        }
        // Player count change
        const prevConnected = prev.players.filter(p => p.connected).length
        const newConnected = state.players.filter(p => p.connected).length
        if (newConnected > prevConnected) playSfx('join')
        else if (newConnected < prevConnected) playSfx('leave')
      }
      set({ state })
    })
    socket.on('error', (err) => {
      set({ error: err })
      playSfx('error')
      // auto-clear after 4s
      setTimeout(() => set({ error: null }), 4000)
    })
    socket.on('room:created', ({ roomCode }) => { set({ roomId: roomCode }); playSfx('click') })
    socket.on('room:joined', ({ roomCode }) => { set({ roomId: roomCode }); playSfx('click') })
    socket.on('move:list', ({ pieceId, moves }) => {
      if (get().selectedPieceId === pieceId) {
        set({ legalMoves: moves })
      }
    })
    socket.on('chain:available', ({ pieceId, moves }) => {
      set({ selectedPieceId: pieceId, legalMoves: moves })
      playSfx('select')
    })
    socket.on('emote', (ev: EmoteEvent) => {
      set(s => ({ lastEmotes: [...s.lastEmotes.slice(-30), ev] }))
      playSfx('emote')
    })
    socket.on('chat', (msg) => {
      set(s => ({ chatMessages: [...s.chatMessages.slice(-100), msg] }))
      playSfx('chat')
    })
    socket.on('chaos', (event: ChaosEvent) => {
      set({ pendingChaos: event })
      playSfx('chaos')
      setTimeout(() => set({ pendingChaos: null }), 4000)
    })
    socket.on('fx', (fx) => {
      const id = `${Date.now()}_${Math.random()}`
      set(s => ({ fxQueue: [...s.fxQueue, { ...fx, id }] }))
      // Play sound matching fx type
      if (fx.type === 'teleport') playSfx('teleport')
      else if (fx.type === 'swap') playSfx('swap')
      else if (fx.type === 'freeze') playSfx('freeze')
      else if (fx.type === 'bomb') playSfx('capture')
      else if (fx.type === 'shield') playSfx('powerup')
      else if (fx.type === 'shield_break') playSfx('capture')
      setTimeout(() => {
        set(s => ({ fxQueue: s.fxQueue.filter(f => f.id !== id) }))
      }, 1200)
    })
    socket.on('boss-rage', () => {
      playSfx('boss_rage')
    })
    socket.on('promote', () => {
      playSfx('king')
    })
    socket.on('powerup:collected', (data: { pieceId: string; powerUp: PowerUpType; playerName: string; effects: any[] }) => {
      const id = `${Date.now()}_${Math.random()}`
      set({
        powerupCollected: {
          id,
          playerName: data.playerName,
          powerUp: data.powerUp,
          effects: data.effects || [],
          timestamp: Date.now(),
        },
      })
      playSfx('powerup')
      // Auto-clear after 2.5s
      setTimeout(() => {
        const cur = get().powerupCollected
        if (cur && cur.id === id) set({ powerupCollected: null })
      }, 2500)
    })
    socket.on('bonus_move', (data: { pieceId: string; powerUp: PowerUpType }) => {
      set({ bonusMove: data })
      playSfx('powerup')
      // Clear bonus move banner after 3s
      setTimeout(() => {
        const cur = get().bonusMove
        if (cur && cur.pieceId === data.pieceId) set({ bonusMove: null })
      }, 3000)
    })
  },

  createRoom: (name, mode) => {
    const socket = getSocket()
    socket.emit('room:create', { name, mode })
  },

  joinRoom: (name, roomCode) => {
    const socket = getSocket()
    socket.emit('room:join', { name, roomCode: roomCode.toUpperCase() })
  },

  updatePlayer: (data) => {
    const socket = getSocket()
    socket.emit('player:update', data)
  },

  startGame: () => {
    const socket = getSocket()
    socket.emit('game:start')
  },

  restartGame: () => {
    const socket = getSocket()
    socket.emit('game:restart')
  },

  addBot: (difficulty, team) => {
    const socket = getSocket()
    socket.emit('bot:add', { difficulty, team })
    playSfx('click')
  },

  removeBot: (botId) => {
    const socket = getSocket()
    socket.emit('bot:remove', { botId })
    playSfx('click')
  },

  selectPiece: (pieceId) => {
    set({ selectedPieceId: pieceId, legalMoves: [] })
    if (pieceId) playSfx('select')
  },

  requestMoves: (pieceId) => {
    const socket = getSocket()
    socket.emit('move:list', { pieceId })
  },

  makeMove: (move) => {
    const socket = getSocket()
    socket.emit('move:make', { move })
    set({ selectedPieceId: null, legalMoves: [] })
  },

  useAbility: (pieceId, targetRow, targetCol) => {
    const socket = getSocket()
    socket.emit('ability:use', { pieceId, targetRow, targetCol })
    set({ selectedPieceId: null, legalMoves: [] })
  },

  sendEmote: (emoji, targetPieceId) => {
    const socket = getSocket()
    socket.emit('emote', { emoji, targetPieceId })
  },

  sendChat: (text) => {
    const socket = getSocket()
    socket.emit('chat', { text })
  },

  clearError: () => set({ error: null }),
}))
