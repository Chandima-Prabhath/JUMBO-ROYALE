// Jumbo Royale - Client Socket Manager
'use client'
import { io, Socket } from 'socket.io-client'
import { GameState, Move, PlayerSlot, EmoteEvent, GameMode, ChaosEvent } from '@/game/types'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (socket) return socket
  // Connect via the gateway. Path MUST be `/` and we MUST use XTransformPort query.
  // On the dev sandbox, we may be loaded directly from :3000 but the gateway is on :81.
  // Use the same origin if it's the gateway (preview URL); otherwise fall back to port 81 on same host.
  const isDevPort = typeof window !== 'undefined' && window.location.port === '3000'
  const url = isDevPort
    ? `${window.location.protocol}//${window.location.hostname}:81`
    : undefined
  socket = io(url, {
    path: '/',
    query: { XTransformPort: '3003' },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionAttempts: 10,
  })
  return socket
}

export type ServerEvents = {
  'state': (state: GameState) => void
  'presence': (players: PlayerSlot[]) => void
  'room:created': (data: { roomCode: string }) => void
  'room:joined': (data: { roomCode: string }) => void
  'error': (data: { code: string; message: string }) => void
  'move:list': (data: { pieceId: string; moves: Move[] }) => void
  'chain:available': (data: { pieceId: string; moves: Move[] }) => void
  'emote': (event: EmoteEvent) => void
  'chat': (msg: { playerId: string; name: string; avatar?: string; text: string; timestamp: number }) => void
  'chaos': (event: ChaosEvent) => void
  'boss-rage': (rage: boolean) => void
  'promote': (pieceId: string) => void
  'fx': (fx: { type: string; pieceId?: string; pieceIds?: string[] }) => void
}

export type ClientEvents = {
  'room:create': (data: { name: string; mode: GameMode }) => void
  'room:join': (data: { name: string; roomCode: string }) => void
  'player:update': (data: Partial<Pick<PlayerSlot, 'team' | 'character' | 'ready' | 'name'>>) => void
  'game:start': () => void
  'move:list': (data: { pieceId: string }) => void
  'move:make': (data: { move: Move }) => void
  'ability:use': (data: { pieceId: string; targetRow: number; targetCol: number }) => void
  'emote': (data: { emoji: string; targetPieceId?: string }) => void
  'chat': (data: { text: string }) => void
  'game:restart': () => void
}
