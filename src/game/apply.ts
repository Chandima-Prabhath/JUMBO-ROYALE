// ===========================================================================
// Jumbo Royale — Apply Module
// Pure functions that apply moves and abilities to game state.
// ALWAYS returns new state — NEVER mutates input.
// This is the ONLY place state transitions happen.
// ===========================================================================

import { GameState, Board, Piece, Move, AnyTeam, PowerUpType, PowerUpEffect, Position, ActionResult, ValidationResult, Cell } from './types'
import { getLegalMoves, getCaptureMoves, getTeamLegalMoves } from './moves'
import { getPieceAt, getCell } from './board'

// ===========================================================================
// Move validation
// ===========================================================================

/**
 * Validate a move against the current game state.
 * This is the ONLY validation function — used by server, tutorial, and AI.
 */
export function validateMove(state: GameState, move: Move): ValidationResult {
  if (state.phase !== 'playing') {
    return { valid: false, error: 'Game is not in progress' }
  }

  const piece = state.board.pieces[move.pieceId]
  if (!piece) {
    return { valid: false, error: 'Piece does not exist' }
  }

  if (piece.frozenTurns > 0) {
    return { valid: false, error: 'Piece is frozen' }
  }

  // Get legal moves and check if this move matches one
  const legalMoves = getLegalMoves(state.board, piece)
  const match = legalMoves.find(m =>
    m.toRow === move.toRow &&
    m.toCol === move.toCol &&
    m.capturedPieceIds.length === move.capturedPieceIds.length
  )

  if (!match) {
    return { valid: false, error: 'Illegal move — not in legal moves list' }
  }

  return { valid: true }
}

// ===========================================================================
// Apply move — returns new state + effects, NEVER mutates
// ===========================================================================

export function applyMove(state: GameState, move: Move): ActionResult {
  // Validate first
  const validation = validateMove(state, move)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  // Deep clone the board (immutable)
  const newBoard: Board = {
    size: state.board.size,
    cells: state.board.cells.map(row => row.map(cell => ({ ...cell }))),
    pieces: {},
  }
  for (const [id, p] of Object.entries(state.board.pieces)) {
    newBoard.pieces[id] = { ...p }
  }

  const effects: PowerUpEffect[] = []
  const mover = newBoard.pieces[move.pieceId]
  if (!mover) return { success: false, error: 'Piece not found after clone' }

  // 1. Process captures (respect shields)
  for (const capId of move.capturedPieceIds) {
    const cap = newBoard.pieces[capId]
    if (!cap) continue
    if (cap.hasShield) {
      cap.hasShield = false
      cap.hp = Math.max(1, cap.hp - 1)
      effects.push({ type: 'shield_break', pieceId: capId })
    } else {
      cap.hp -= 1
      if (cap.hp <= 0) {
        delete newBoard.pieces[capId]
        effects.push({ type: 'capture', pieceId: capId })
      }
    }
  }

  // 2. Move the piece
  mover.row = move.toRow
  mover.col = move.toCol

  // 3. Pick up power-up at destination
  let pickedUpPowerUp: PowerUpType | undefined
  const landCell = newBoard.cells[move.toRow]?.[move.toCol]
  if (landCell && landCell.type === 'powerup' && landCell.powerUp) {
    pickedUpPowerUp = landCell.powerUp
    // Apply immediate effects
    const puEffects = applyPowerUpEffect(mover, pickedUpPowerUp, newBoard.pieces, newBoard.cells)
    effects.push(...puEffects)
    // Clear the cell
    landCell.type = 'normal'
    landCell.powerUp = undefined
  }

  // 4. King promotion (ONLY for normal moves, not abilities)
  let promotedToKing = false
  if (!mover.isKing) {
    if (mover.team === 'red' && mover.row === 0) {
      mover.isKing = true
      promotedToKing = true
    } else if ((mover.team === 'blue' || mover.team === 'boss') && mover.row === newBoard.size - 1) {
      mover.isKing = true
      promotedToKing = true
    }
  }

  // 5. Decrement blocked-turns
  for (const row of newBoard.cells) {
    for (const cell of row) {
      if (cell.type === 'blocked' && cell.blockedTurns !== undefined) {
        cell.blockedTurns -= 1
        if (cell.blockedTurns <= 0) {
          cell.type = 'normal'
          cell.blockedTurns = undefined
        }
      }
    }
  }

  // 6. Build new state
  const newState: GameState = {
    ...state,
    board: newBoard,
    movesThisTurn: state.movesThisTurn + 1,
    version: state.version + 1,
  }

  // 7. Reset turnsWithoutCapture if captures happened
  if (move.capturedPieceIds.length > 0) {
    newState.turnsWithoutCapture = 0
  }

  // 8. Check for chain captures
  let chainCapturesAvailable: Move[] | undefined
  const movedPiece = newState.board.pieces[move.pieceId]
  if (movedPiece && (move.kind === 'capture' || move.kind === 'multi_capture')) {
    const followUps = getCaptureMoves(newState.board, movedPiece)
    if (followUps.length > 0) {
      chainCapturesAvailable = followUps
    }
  }

  // 9. Check for bonus move (double_move / extra_jump)
  let bonusMoveGranted = false
  if (pickedUpPowerUp === 'double_move' || pickedUpPowerUp === 'extra_jump') {
    bonusMoveGranted = true
  }

  return {
    success: true,
    newState,
    effects,
    pickedUpPowerUp,
    promotedToKing,
    chainCapturesAvailable,
    bonusMoveGranted,
    turnEnded: !chainCapturesAvailable && !bonusMoveGranted,
  }
}

// ===========================================================================
// Power-up effects — pure function, mutates the pieces/cells passed in
// (these are already clones from applyMove)
// ===========================================================================

export function applyPowerUpEffect(
  mover: Piece,
  powerUp: PowerUpType,
  pieces: Record<string, Piece>,
  cells: Cell[][],
): PowerUpEffect[] {
  const effects: PowerUpEffect[] = []
  const opponents = Object.values(pieces).filter(p => p.team !== mover.team && p.id !== mover.id)

  switch (powerUp) {
    case 'shield':
      mover.hasShield = true
      effects.push({ type: 'shield', pieceId: mover.id })
      break

    case 'double_move':
      effects.push({ type: 'double_move', pieceId: mover.id })
      break

    case 'extra_jump':
      effects.push({ type: 'extra_jump', pieceId: mover.id })
      break

    case 'freeze': {
      if (opponents.length > 0) {
        let nearest = opponents[0]
        let minDist = Math.abs(nearest.row - mover.row) + Math.abs(nearest.col - mover.col)
        for (const o of opponents) {
          const d = Math.abs(o.row - mover.row) + Math.abs(o.col - mover.col)
          if (d < minDist) { minDist = d; nearest = o }
        }
        nearest.frozenTurns = Math.max(nearest.frozenTurns, 1)
        effects.push({ type: 'freeze', pieceId: nearest.id })
      }
      break
    }

    case 'swap': {
      if (opponents.length > 0) {
        const target = opponents[Math.floor(Math.random() * opponents.length)]
        const tr = mover.row, tc = mover.col
        mover.row = target.row
        mover.col = target.col
        target.row = tr
        target.col = tc
        effects.push({ type: 'swap', pieceId: mover.id, targetPieceIds: [target.id] })
      }
      break
    }

    case 'bomb': {
      const adjacent = opponents.filter(o => Math.abs(o.row - mover.row) <= 1 && Math.abs(o.col - mover.col) <= 1)
      if (adjacent.length > 0) {
        adjacent.sort((a, b) => a.hp - b.hp)
        const target = adjacent[0]
        if (target.hasShield) {
          target.hasShield = false
          target.hp = Math.max(1, target.hp - 1)
          effects.push({ type: 'shield_break', pieceId: target.id })
        } else {
          target.hp -= 1
          if (target.hp <= 0) {
            delete pieces[target.id]
            effects.push({ type: 'bomb', pieceId: target.id })
          }
        }
      }
      break
    }
  }

  return effects
}
