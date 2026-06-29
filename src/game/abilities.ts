// ===========================================================================
// Jumbo Royale — Abilities Module
// Pure functions for character abilities (Mage teleport, Jester swap).
// Abilities do NOT trigger king promotion (per codex section 5).
// ===========================================================================

import { Board, Piece, Position, ActionResult, ValidationResult, GameState, PowerUpEffect, PowerUpType } from './types'
import { getPieceAt, getCell, inBounds } from './board'
import { getLegalMoves, getCaptureMoves } from './moves'
import { applyPowerUpEffect } from './apply'

// ===========================================================================
// Can a piece use its ability?
// ===========================================================================

export function canUseAbility(piece: Piece): boolean {
  if (piece.abilityUsed) return false
  if (piece.frozenTurns > 0) return false
  return piece.character === 'mage' || piece.character === 'jester'
}

// ===========================================================================
// Get valid ability targets for a piece
// ===========================================================================

export function getAbilityTargets(board: Board, piece: Piece): Position[] {
  if (!canUseAbility(piece)) return []

  switch (piece.character) {
    case 'mage':
      return getMageTargets(board, piece)
    case 'jester':
      return getJesterTargets(board, piece)
    default:
      return []
  }
}

function getMageTargets(board: Board, piece: Piece): Position[] {
  const targets: Position[] = []
  for (let r = 0; r < board.size; r++) {
    for (let c = 0; c < board.size; c++) {
      const cell = board.cells[r][c]
      if (cell.tile !== 'dark') continue
      if (cell.type === 'blocked') continue
      if (getPieceAt(board, r, c)) continue
      const dist = Math.max(Math.abs(r - piece.row), Math.abs(c - piece.col))
      if (dist > 0 && dist <= 3) {
        targets.push({ row: r, col: c })
      }
    }
  }
  return targets
}

function getJesterTargets(board: Board, piece: Piece): Position[] {
  const targets: Position[] = []
  for (const p of Object.values(board.pieces)) {
    if (p.id === piece.id) continue
    const dist = Math.max(Math.abs(p.row - piece.row), Math.abs(p.col - piece.col))
    if (dist > 0 && dist <= 2) {
      targets.push({ row: p.row, col: p.col })
    }
  }
  return targets
}

// ===========================================================================
// Validate ability use
// ===========================================================================

export function validateAbility(state: GameState, pieceId: string, target: Position): ValidationResult {
  if (state.phase !== 'playing') {
    return { valid: false, error: 'Game is not in progress' }
  }

  const piece = state.board.pieces[pieceId]
  if (!piece) return { valid: false, error: 'Piece does not exist' }
  if (!canUseAbility(piece)) return { valid: false, error: 'Cannot use ability' }

  const targets = getAbilityTargets(state.board, piece)
  if (!targets.some(t => t.row === target.row && t.col === target.col)) {
    return { valid: false, error: 'Invalid ability target' }
  }

  return { valid: true }
}

// ===========================================================================
// Apply ability — returns new state + effects, NEVER mutates
// ===========================================================================

export function applyAbility(state: GameState, pieceId: string, target: Position): ActionResult {
  const validation = validateAbility(state, pieceId, target)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  // Clone board
  const newBoard: Board = {
    size: state.board.size,
    cells: state.board.cells.map(row => row.map(cell => ({ ...cell }))),
    pieces: {},
  }
  for (const [id, p] of Object.entries(state.board.pieces)) {
    newBoard.pieces[id] = { ...p }
  }

  const piece = newBoard.pieces[pieceId]
  if (!piece) return { success: false, error: 'Piece not found after clone' }

  const effects: PowerUpEffect[] = []
  let pickedUpPowerUp: PowerUpType | undefined
  piece.abilityUsed = true

  if (piece.character === 'mage') {
    // Teleport
    piece.row = target.row
    piece.col = target.col

    // Pick up power-up at destination
    const landCell = newBoard.cells[target.row]?.[target.col]
    if (landCell && landCell.type === 'powerup' && landCell.powerUp) {
      pickedUpPowerUp = landCell.powerUp
      const puEffects = applyPowerUpEffect(piece, pickedUpPowerUp, newBoard.pieces, newBoard.cells)
      effects.push(...puEffects)
      landCell.type = 'normal'
      landCell.powerUp = undefined
    }

    // NO king promotion for abilities (per codex)
  } else if (piece.character === 'jester') {
    // Swap
    const other = Object.values(newBoard.pieces).find(p => p.row === target.row && p.col === target.col && p.id !== piece.id)
    if (other) {
      const tr = piece.row, tc = piece.col
      piece.row = target.row
      piece.col = target.col
      other.row = tr
      other.col = tc
      effects.push({ type: 'swap', pieceId: piece.id, targetPieceIds: [other.id] })
    }
    // NO king promotion for abilities (per codex)
  }

  const newState: GameState = {
    ...state,
    board: newBoard,
    movesThisTurn: state.movesThisTurn + 1,
    version: state.version + 1,
  }

  // Check for chain captures after mage teleport
  let chainCapturesAvailable: Move[] | undefined
  if (piece.character === 'mage') {
    const followUps = getCaptureMoves(newState.board, piece)
    if (followUps.length > 0) {
      chainCapturesAvailable = followUps
    }
  }

  // Check for bonus move
  let bonusMoveGranted = false
  if (pickedUpPowerUp === 'double_move' || pickedUpPowerUp === 'extra_jump') {
    bonusMoveGranted = true
  }

  return {
    success: true,
    newState,
    effects,
    pickedUpPowerUp,
    promotedToKing: false, // Abilities NEVER promote
    chainCapturesAvailable,
    bonusMoveGranted,
    turnEnded: !chainCapturesAvailable && !bonusMoveGranted,
  }
}
