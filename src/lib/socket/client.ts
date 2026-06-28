// Jumbo Royale - Client Socket Manager
// Auto-detects the best Socket.IO endpoint based on environment.
//
// Priority:
//   1. NEXT_PUBLIC_SOCKET_URL env var (explicit override for production)
//   2. Same origin (when behind a reverse proxy / gateway in production)
//   3. Dev fallback: same host on port 81 (Caddy gateway in dev sandbox)
//
// The XTransformPort query is only needed for the dev sandbox's Caddy gateway.
// In production with a reverse proxy, the same origin routes everything.

'use client'
import { io, Socket } from 'socket.io-client'
import { GameState, Move, PlayerSlot, EmoteEvent, GameMode, ChaosEvent } from '@/game/types'

let socket: Socket | null = null

// Read once at module load
const SOCKET_URL_OVERRIDE = process.env.NEXT_PUBLIC_SOCKET_URL
const SOCKET_PORT_OVERRIDE = process.env.NEXT_PUBLIC_SOCKET_PORT
const USE_GATEWAY_QUERY = process.env.NEXT_PUBLIC_USE_GATEWAY_QUERY === 'true'

function resolveSocketUrl(): { url: string | undefined; useGatewayQuery: boolean } {
  // 1. Explicit override (production deployment with separate socket server)
  if (SOCKET_URL_OVERRIDE) {
    return { url: SOCKET_URL_OVERRIDE, useGatewayQuery: false }
  }

  // 2. Browser-side detection
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location

    // If NEXT_PUBLIC_SOCKET_PORT is set, use same host with that port
    if (SOCKET_PORT_OVERRIDE) {
      return {
        url: `${protocol}//${hostname}:${SOCKET_PORT_OVERRIDE}`,
        useGatewayQuery: false,
      }
    }

    // Dev sandbox: page is on :3000, gateway is on :81
    if (port === '3000' && hostname === 'localhost') {
      return { url: `${protocol}//${hostname}:81`, useGatewayQuery: true }
    }

    // Production: same origin (reverse proxy handles routing)
    return { url: undefined, useGatewayQuery: USE_GATEWAY_QUERY }
  }

  // SSR: no window yet
  return { url: undefined, useGatewayQuery: USE_GATEWAY_QUERY }
}

export function getSocket(): Socket {
  if (socket) return socket
  const { url, useGatewayQuery } = resolveSocketUrl()
  socket = io(url, {
    path: '/',
    query: useGatewayQuery ? { XTransformPort: '3003' } : undefined,
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
  'bot:add': (data: { difficulty: import('@/game/types').BotDifficulty; team?: import('@/game/types').AnyTeam }) => void
  'bot:remove': (data: { botId: string }) => void
}
