// ===========================================================================
// Jumbo Royale — Boss AI Module
// Boss-specific AI logic for co-op mode.
// ===========================================================================

import { GameState, Move, AnyTeam, Board, Piece, PowerUpType, PowerUpEffect } from './types'
import { getTeamLegalMoves, getCaptureMoves, getLegalMoves } from './moves'
import { applyMove } from './apply'
import { applyPowerUpEffect } from './apply'
import { v4 as uuid } from 'uuid'

// ===========================================================================
// Pick the best move for the boss team
// ===========================================================================

export function pickBossMove(state: GameState): { pieceId: string; move: Move } | null {
  const bossMoveLists = getTeamLegalMoves(state.board, 'boss')
  if (bossMoveLists.length === 0) return null

  let best: { pieceId: string; move: Move; score: number } | null = null
  for (const pm of bossMoveLists) {
    for (const m of pm.moves) {
      let score = 0
      score += m.capturedPieceIds.length * 100
      if (m.capturedPieceIds.length > 1) score += 50

      // Advance toward nearest red piece
      const mover = state.board.pieces[pm.pieceId]
      if (mover) {
        let minDist = Infinity
        for (const p of Object.values(state.board.pieces)) {
          if (p.team !== 'red') continue
          const d = Math.abs(p.row - mover.row) + Math.abs(p.col - mover.col)
          if (d < minDist) minDist = d
        }
        const newDist = Math.abs(m.toRow - mover.row) + Math.abs(m.toCol - mover.col)
        score += (minDist - newDist) * 5
      }

      if (!best || score > best.score) {
        best = { pieceId: pm.pieceId, move: m, score }
      }
    }
  }
  return best
}

// ===========================================================================
// Boss summon a minion
// ===========================================================================

export function bossSummon(state: GameState): { state: GameState; summoned: Piece | null } {
  const newState: GameState = JSON.parse(JSON.stringify(state))
  const bossPieces = Object.values(newState.board.pieces).filter(p => p.team === 'boss')
  if (bossPieces.length >= 6) return { state: newState, summoned: null }

  for (let attempt = 0; attempt < 10; attempt++) {
    const r = newState.board.size - 1 - Math.floor(Math.random() * 3)
    const c = Math.floor(Math.random() * newState.board.size)
    if (r < 0) continue
    const cell = newState.board.cells[r]?.[c]
    if (!cell || cell.tile !== 'dark' || cell.type === 'blocked') continue
    const piece = Object.values(newState.board.pieces).find(p => p.row === r && p.col === c)
    if (piece) continue

    const id = `m_${Date.now().toString(36)}${attempt}`
    const minion: Piece = {
      id,
      team: 'boss',
      character: 'speedster',
      row: r,
      col: c,
      isKing: false,
      hp: 1,
      hasShield: false,
      frozenTurns: 0,
      abilityUsed: false,
      ownerName: 'Spawn',
    }
    newState.board.pieces[id] = minion
    newState.version += 1
    return { state: newState, summoned: minion }
  }
  return { state: newState, summoned: null }
}
