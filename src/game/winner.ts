// ===========================================================================
// Jumbo Royale — Win Conditions Module
// Pure functions for checking game-over conditions.
// Per GAME_CODEX.md section 9.
// ===========================================================================

import { GameState, AnyTeam } from './types'
import { getTeamLegalMoves, hasLegalMoves } from './moves'
import { getAlivePieceCount } from './board'

// ===========================================================================
// Turn limits (per codex)
// ===========================================================================

const PVP_TURN_LIMIT = 80
const PVP_NO_CAPTURE_LIMIT = 20
const COOP_TURN_LIMIT = 100

// ===========================================================================
// Check for a winner
// ===========================================================================

export function checkWinner(state: GameState): AnyTeam | undefined {
  if (state.phase !== 'playing') return undefined

  if (state.mode === 'pvp') {
    return checkPvPWinner(state)
  } else {
    return checkCoopWinner(state)
  }
}

function checkPvPWinner(state: GameState): AnyTeam | undefined {
  const redAlive = getAlivePieceCount(state.board, 'red') > 0
  const blueAlive = getAlivePieceCount(state.board, 'blue') > 0

  // Elimination
  if (!redAlive) return 'blue'
  if (!blueAlive) return 'red'

  // Stalemate: current team has no moves
  if (!hasLegalMoves(state.board, state.currentTurnTeam)) {
    // Check if all pieces are frozen — if so, skip (don't lose)
    const teamPieces = Object.values(state.board.pieces).filter(p => p.team === state.currentTurnTeam)
    const allFrozen = teamPieces.length > 0 && teamPieces.every(p => p.frozenTurns > 0)
    if (!allFrozen) {
      return state.currentTurnTeam === 'red' ? 'blue' : 'red'
    }
  }

  // Turn limit
  if (state.turnCount >= PVP_TURN_LIMIT) {
    return getTeamWithMorePieces(state)
  }

  // No-capture limit
  if (state.turnsWithoutCapture >= PVP_NO_CAPTURE_LIMIT) {
    return getTeamWithMorePieces(state)
  }

  return undefined
}

function checkCoopWinner(state: GameState): AnyTeam | undefined {
  const bossAlive = getAlivePieceCount(state.board, 'boss') > 0
  const redAlive = getAlivePieceCount(state.board, 'red') > 0

  if (!bossAlive) return 'red'
  if (!redAlive) return 'boss'

  // Stalemate for red
  if (state.currentTurnTeam === 'red' && !hasLegalMoves(state.board, 'red')) {
    const redPieces = Object.values(state.board.pieces).filter(p => p.team === 'red')
    const allFrozen = redPieces.length > 0 && redPieces.every(p => p.frozenTurns > 0)
    if (!allFrozen) return 'boss'
  }

  // Turn limit
  if (state.turnCount >= COOP_TURN_LIMIT) return 'boss'

  return undefined
}

function getTeamWithMorePieces(state: GameState): AnyTeam {
  const red = getAlivePieceCount(state.board, 'red')
  const blue = getAlivePieceCount(state.board, 'blue')
  if (red >= blue) return 'red'
  return 'blue'
}

// ===========================================================================
// Check if all pieces on a team are frozen (turn should be skipped)
// ===========================================================================

export function isAllFrozen(state: GameState, team: AnyTeam): boolean {
  const pieces = Object.values(state.board.pieces).filter(p => p.team === team)
  return pieces.length > 0 && pieces.every(p => p.frozenTurns > 0)
}
