// ===========================================================================
// Jumbo Royale — Turn Management Module
// Pure functions for turn transitions, frozen piece management.
// Per GAME_CODEX.md section 6.
// ===========================================================================

import { GameState, AnyTeam } from './types'
import { isAllFrozen } from './winner'

export const TURN_DURATION_SEC = 30
export const CHAOS_INTERVAL_SEC = 60
export const MAX_MOVES_PER_TURN = 1

// ===========================================================================
// Advance to next turn
// Returns new state — NEVER mutates.
// ===========================================================================

export function nextTurn(state: GameState): GameState {
  if (state.phase !== 'playing') return state

  // Decrement frozen turns for the team that just finished
  const newPieces = { ...state.board.pieces }
  for (const p of Object.values(newPieces)) {
    if (p.team === state.currentTurnTeam && p.frozenTurns > 0) {
      newPieces[p.id] = { ...p, frozenTurns: p.frozenTurns - 1 }
    }
  }

  const newBoard = { ...state.board, pieces: newPieces }
  let newState: GameState = {
    ...state,
    board: newBoard,
    turnStartedAt: Date.now(),
    movesThisTurn: 0,
    turnCount: state.turnCount + 1,
    turnsWithoutCapture: state.turnsWithoutCapture + 1,
    version: state.version + 1,
  }

  // Switch team / player
  if (state.mode === 'pvp') {
    const newTeam: AnyTeam = state.currentTurnTeam === 'red' ? 'blue' : 'red'
    newState.currentTurnTeam = newTeam
    const idx = newState.players.findIndex(p => p.team === newTeam && p.connected)
    if (idx >= 0) newState.currentPlayerIndex = idx
  } else {
    // Co-op: red → boss → red (cycle red players)
    if (state.currentTurnTeam === 'red') {
      newState.currentTurnTeam = 'boss'
    } else {
      newState.currentTurnTeam = 'red'
      const redPlayers = newState.players
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.team === 'red' && p.connected)
      if (redPlayers.length > 0) {
        const currentRedIdx = redPlayers.findIndex(({ i }) => i === newState.currentPlayerIndex)
        const nextRedIdx = (currentRedIdx + 1) % redPlayers.length
        newState.currentPlayerIndex = redPlayers[nextRedIdx].i
      }
    }
  }

  return newState
}

// ===========================================================================
// Check if current team is all-frozen (turn should be skipped)
// ===========================================================================

export function shouldSkipTurn(state: GameState): boolean {
  return isAllFrozen(state, state.currentTurnTeam)
}

// ===========================================================================
// Get the current player's slot
// ===========================================================================

export function getCurrentPlayer(state: GameState) {
  return state.players[state.currentPlayerIndex] ?? null
}

// ===========================================================================
// Check if it's a specific player's turn
// ===========================================================================

export function isPlayerTurn(state: GameState, playerId: string): boolean {
  const current = getCurrentPlayer(state)
  return current?.id === playerId
}

// ===========================================================================
// Check if current player is a bot
// ===========================================================================

export function isBotTurn(state: GameState): boolean {
  const current = getCurrentPlayer(state)
  return current?.isBot === true
}
