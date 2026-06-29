// ===========================================================================
// Jumbo Royale — Move Generation Module
// Pure functions that generate all legal moves for pieces and teams.
// This is the ONLY place move generation logic exists.
// ===========================================================================

import { Board, Piece, Move, AnyTeam, PowerUpType } from './types'
import { getPieceAt, getCell, inBounds } from './board'

const ALL_DIAGS = [[-1, -1], [-1, 1], [1, -1], [1, 1]]

// ===========================================================================
// Direction rules — per GAME_CODEX.md section 3
// ===========================================================================

/**
 * Returns the diagonal directions a piece can move.
 * - Pawns: forward only (2 directions)
 * - Kings: all 4 directions
 */
function getMoveDirections(piece: Piece): number[][] {
  if (piece.isKing) return ALL_DIAGS
  const forward = piece.team === 'red' ? -1 : 1
  return [[forward, -1], [forward, 1]]
}

// ===========================================================================
// Simple moves (non-capture)
// ===========================================================================

/**
 * Get all simple (non-capture) moves for a piece.
 * - Pawns: 1 square diagonally forward
 * - Kings: 1 square diagonally any direction
 * - Speedster pawns: can also move 2 squares forward (Dash) if both empty
 */
export function getSimpleMoves(board: Board, piece: Piece): Move[] {
  if (piece.frozenTurns > 0) return []

  const moves: Move[] = []
  const directions = getMoveDirections(piece)

  for (const [dr, dc] of directions) {
    // 1-square move
    const r1 = piece.row + dr
    const c1 = piece.col + dc
    if (canMoveTo(board, r1, c1)) {
      moves.push(makeMove(piece, r1, c1, 'simple', [], getCell(board, r1, c1)?.powerUp))
    }

    // Speedster Dash: 2 squares forward (pawns only)
    if (piece.character === 'speedster' && !piece.isKing) {
      const r2 = piece.row + dr * 2
      const c2 = piece.col + dc * 2
      if (canMoveTo(board, r2, c2) && canMoveTo(board, r1, c1)) {
        // Both squares must be empty (canMoveTo checks this)
        moves.push(makeMove(piece, r2, c2, 'simple', [], getCell(board, r2, c2)?.powerUp))
      }
    }
  }

  return moves
}

// ===========================================================================
// Capture moves (including chains)
// ===========================================================================

/**
 * Get all capture moves for a piece, including chain captures.
 * Captures work in ALL diagonal directions for ALL pieces (per codex).
 */
export function getCaptureMoves(board: Board, piece: Piece): Move[] {
  if (piece.frozenTurns > 0) return []

  const results: Move[] = []
  exploreCaptures(board, piece, piece, [], results)
  return results
}

function exploreCaptures(
  board: Board,
  original: Piece,
  current: Piece,
  captured: string[],
  out: Move[],
) {
  for (const [dr, dc] of ALL_DIAGS) {
    const midR = current.row + dr
    const midC = current.col + dc
    const landR = current.row + dr * 2
    const landC = current.col + dc * 2

    if (!inBounds(board, landR, landC)) continue

    const mid = getPieceAt(board, midR, midC)
    if (!mid) continue
    if (mid.team === current.team) continue
    if (captured.includes(mid.id)) continue

    const landPiece = getPieceAt(board, landR, landC)
    if (landPiece && landPiece.id !== original.id) continue

    const landCell = getCell(board, landR, landC)
    if (landCell?.type === 'blocked') continue

    const newCaptured = [...captured, mid.id]
    const kind = newCaptured.length > 1 ? 'multi_capture' : 'capture'
    const move = makeMove(original, landR, landC, kind, newCaptured, landCell?.powerUp)
    out.push(move)

    // Continue chain from landing position
    const ghost: Piece = { ...current, row: landR, col: landC }
    exploreCaptures(board, original, ghost, newCaptured, out)
  }
}

// ===========================================================================
// Legal moves — combines simple + capture with forced capture rule
// ===========================================================================

/**
 * Get all legal moves for a piece.
 * If any capture exists for this piece, only captures are returned (forced capture).
 */
export function getLegalMoves(board: Board, piece: Piece): Move[] {
  const captures = getCaptureMoves(board, piece)
  if (captures.length > 0) return captures
  return getSimpleMoves(board, piece)
}

/**
 * Get all legal moves for a team.
 * If ANY piece on the team can capture, only captures are legal for the ENTIRE team.
 */
export function getTeamLegalMoves(board: Board, team: AnyTeam): { pieceId: string; moves: Move[] }[] {
  const teamPieces = Object.values(board.pieces).filter(p => p.team === team && p.frozenTurns === 0)

  // Check if any piece has a capture
  let anyCaptures = false
  const pieceMoves: { pieceId: string; moves: Move[] }[] = []

  for (const p of teamPieces) {
    const moves = getLegalMoves(board, p)
    pieceMoves.push({ pieceId: p.id, moves })
    if (moves.some(m => m.kind === 'capture' || m.kind === 'multi_capture')) {
      anyCaptures = true
    }
  }

  // If any captures exist, filter to only capturing pieces
  if (anyCaptures) {
    return pieceMoves
      .filter(pm => pm.moves.some(m => m.kind === 'capture' || m.kind === 'multi_capture'))
      .map(pm => ({
        pieceId: pm.pieceId,
        moves: pm.moves.filter(m => m.kind === 'capture' || m.kind === 'multi_capture'),
      }))
  }

  // No captures — return all pieces with moves
  return pieceMoves.filter(pm => pm.moves.length > 0)
}

/**
 * Check if a team has any legal moves at all.
 */
export function hasLegalMoves(board: Board, team: AnyTeam): boolean {
  return getTeamLegalMoves(board, team).length > 0
}

// ===========================================================================
// Helpers
// ===========================================================================

function canMoveTo(board: Board, row: number, col: number): boolean {
  if (!inBounds(board, row, col)) return false
  if (getPieceAt(board, row, col)) return false
  const cell = getCell(board, row, col)
  return cell?.type !== 'blocked'
}

function makeMove(
  piece: Piece,
  toRow: number,
  toCol: number,
  kind: 'simple' | 'capture' | 'multi_capture',
  capturedPieceIds: string[],
  pickedUpPowerUp?: PowerUpType,
): Move {
  return {
    pieceId: piece.id,
    fromRow: piece.row,
    fromCol: piece.col,
    toRow,
    toCol,
    kind,
    capturedPieceIds,
    pickedUpPowerUp,
  }
}
