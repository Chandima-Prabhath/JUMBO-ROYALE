// Jumbo Royale - Zustand store
'use client'
import { create } from 'zustand'
import { GameState, Move, PlayerSlot, EmoteEvent, GameMode, ChaosEvent, CharacterClass, AnyTeam } from '@/game/types'
import { getSocket } from '@/lib/socket/client'

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

  // actions
  init: () => void
  createRoom: (name: string, mode: GameMode) => void
  joinRoom: (name: string, roomCode: string) => void
  updatePlayer: (data: Partial<Pick<PlayerSlot, 'team' | 'character' | 'ready' | 'name'>>) => void
  startGame: () => void
  restartGame: () => void
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
      set({ state })
    })
    socket.on('error', (err) => {
      set({ error: err })
      // auto-clear after 4s
      setTimeout(() => set({ error: null }), 4000)
    })
    socket.on('room:created', ({ roomCode }) => set({ roomId: roomCode }))
    socket.on('room:joined', ({ roomCode }) => set({ roomId: roomCode }))
    socket.on('move:list', ({ pieceId, moves }) => {
      if (get().selectedPieceId === pieceId) {
        set({ legalMoves: moves })
      }
    })
    socket.on('chain:available', ({ pieceId, moves }) => {
      set({ selectedPieceId: pieceId, legalMoves: moves })
    })
    socket.on('emote', (ev: EmoteEvent) => {
      set(s => ({ lastEmotes: [...s.lastEmotes.slice(-30), ev] }))
    })
    socket.on('chat', (msg) => {
      set(s => ({ chatMessages: [...s.chatMessages.slice(-100), msg] }))
    })
    socket.on('chaos', (event: ChaosEvent) => {
      set({ pendingChaos: event })
      setTimeout(() => set({ pendingChaos: null }), 4000)
    })
    socket.on('fx', (fx) => {
      const id = `${Date.now()}_${Math.random()}`
      set(s => ({ fxQueue: [...s.fxQueue, { ...fx, id }] }))
      setTimeout(() => {
        set(s => ({ fxQueue: s.fxQueue.filter(f => f.id !== id) }))
      }, 1200)
    })
    socket.on('boss-rage', () => {
      // visual handled via state.boss.rage
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

  selectPiece: (pieceId) => {
    set({ selectedPieceId: pieceId, legalMoves: [] })
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
