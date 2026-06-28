// Jumbo Royale - Move calculation & rule engine
import { Board, Piece, Move, AnyTeam, CharacterClass, PowerUpType, Cell } from './types'
import { getPieceAt, inBounds, getCell } from './board'

const DIAGS = [
  [-1, -1], [-1, 1], [1, -1], [1, 1],
]

// Direction a piece can move. Classic checkers: forward only until king.
function allowedDirections(piece: Piece): number[][] {
  if (piece.isKing) return DIAGS
  // Red moves "up" (toward row 0). Blue/boss move "down" (toward row N).
  // In co-op, red humans move up; boss minions move down.
  const forward = piece.team === 'red' ? -1 : 1
  return [[forward, -1], [forward, 1]]
}

// Get all simple (non-capture) moves for a piece
export function getSimpleMoves(board: Board, piece: Piece): Move[] {
  if (piece.frozenTurns > 0) return []
  const moves: Move[] = []
  for (const [dr, dc] of allowedDirections(piece)) {
    const r = piece.row + dr
    const c = piece.col + dc
    if (!inBounds(r, c)) continue
    if (getPieceAt(board, r, c)) continue
    const cell = getCell(board, r, c)
    if (cell?.type === 'blocked') continue
    moves.push({
      pieceId: piece.id,
      fromRow: piece.row,
      fromCol: piece.col,
      toRow: r,
      toCol: c,
      kind: 'simple',
      capturedPieceIds: [],
      isChainable: false,
      pickedUpPowerUp: cell?.powerUp,
    })
  }
  return moves
}

// Get all capture moves (including chains) for a piece
export function getCaptureMoves(board: Board, piece: Piece): Move[] {
  if (piece.frozenTurns > 0) return []
  const results: Move[] = []
  const startMove: Move = {
    pieceId: piece.id,
    fromRow: piece.row,
    fromCol: piece.col,
    toRow: piece.row,
    toCol: piece.col,
    kind: 'capture',
    capturedPieceIds: [],
    isChainable: false,
  }
  exploreCaptures(board, piece, piece, [], startMove, results)
  return results
}

function exploreCaptures(
  board: Board,
  original: Piece,
  current: Piece,
  captured: string[],
  path: Move,
  out: Move[],
) {
  let foundExtension = false
  for (const [dr, dc] of allowedDirections(current)) {
    const midR = current.row + dr
    const midC = current.col + dc
    const landR = current.row + dr * 2
    const landC = current.col + dc * 2
    if (!inBounds(landR, landC)) continue
    const mid = getPieceAt(board, midR, midC)
    if (!mid) continue
    if (mid.team === current.team) continue
    if (captured.includes(mid.id)) continue // can't double-capture same piece
    const landPiece = getPieceAt(board, landR, landC)
    if (landPiece && landPiece.id !== original.id) continue
    const landCell = getCell(board, landR, landC)
    if (landCell?.type === 'blocked') continue

    foundExtension = true
    const newCaptured = [...captured, mid.id]
    const newPath: Move = {
      ...path,
      toRow: landR,
      toCol: landC,
      capturedPieceIds: newCaptured,
      kind: newCaptured.length > 1 ? 'multi_capture' : 'capture',
      isChainable: true,
      pickedUpPowerUp: landCell?.powerUp,
    }
    out.push(newPath)

    // Continue chain from landing position
    const ghostCurrent: Piece = { ...current, row: landR, col: landC }
    exploreCaptures(board, original, ghostCurrent, newCaptured, newPath, out)
  }

  if (!foundExtension && captured.length > 0) {
    // terminal chain — already pushed
  }
}

// Get all legal moves for a piece (simple + captures)
export function getLegalMoves(board: Board, piece: Piece): Move[] {
  const captures = getCaptureMoves(board, piece)
  if (captures.length > 0) return captures // forced capture rule (classic checkers)
  return getSimpleMoves(board, piece)
}

// Get all legal moves for a team (any piece)
export function getTeamMoves(board: Board, team: AnyTeam): { pieceId: string; moves: Move[] }[] {
  const teamPieces = Object.values(board.pieces).filter(p => p.team === team && p.frozenTurns === 0)
  const result: { pieceId: string; moves: Move[] }[] = []
  // If any piece has a capture, only captures are legal (forced capture)
  let anyCaptures = false
  const pieceMoves: { pieceId: string; moves: Move[] }[] = []
  for (const p of teamPieces) {
    const m = getLegalMoves(board, p)
    pieceMoves.push({ pieceId: p.id, moves: m })
    if (m.some(x => x.kind === 'capture' || x.kind === 'multi_capture')) anyCaptures = true
  }
  if (anyCaptures) {
    for (const pm of pieceMoves) {
      const captures = pm.moves.filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
      if (captures.length > 0) result.push({ pieceId: pm.pieceId, moves: captures })
    }
  } else {
    for (const pm of pieceMoves) {
      if (pm.moves.length > 0) result.push(pm)
    }
  }
  return result
}

// Apply a move to a board (returns new board, mutates nothing)
// Returns the picked-up power-up (if any) so the caller can apply turn-level effects
export function applyMove(board: Board, move: Move): { board: Board; promotedToKing: boolean; pickedUpPowerUp?: PowerUpType; appliedEffects: PowerUpEffect[] } {
  const newPieces: Record<string, Piece> = {}
  for (const p of Object.values(board.pieces)) {
    newPieces[p.id] = { ...p }
  }
  const appliedEffects: PowerUpEffect[] = []
  // Remove captured pieces (respect shields)
  for (const capId of move.capturedPieceIds) {
    const cap = newPieces[capId]
    if (!cap) continue
    if (cap.hasShield) {
      cap.hasShield = false
      cap.hp = Math.max(1, cap.hp - 1)
      appliedEffects.push({ type: 'shield_break', pieceId: capId })
    } else {
      cap.hp -= 1
      if (cap.hp <= 0) {
        delete newPieces[capId]
        appliedEffects.push({ type: 'capture', pieceId: capId })
      }
    }
  }
  // Move the piece
  const mover = newPieces[move.pieceId]
  if (!mover) return { board, promotedToKing: false, appliedEffects }
  mover.row = move.toRow
  mover.col = move.toCol

  let pickedUpPowerUp: PowerUpType | undefined
  let promotedToKing = false
  const newCells = board.cells.map(row => row.map(cell => ({ ...cell })))
  const landCell = newCells[move.toRow]?.[move.toCol]
  if (landCell && landCell.type === 'powerup' && landCell.powerUp) {
    pickedUpPowerUp = landCell.powerUp
    // Apply IMMEDIATE effects here. Caller handles turn-level effects (double_move, extra_jump).
    const effect = applyPowerUpEffect(mover, pickedUpPowerUp, newPieces, newCells)
    appliedEffects.push(...effect)
    // Clear the cell
    landCell.type = 'normal'
    landCell.powerUp = undefined
  }
  // King promotion
  if (!mover.isKing) {
    if (mover.team === 'red' && mover.row === 0) {
      mover.isKing = true
      promotedToKing = true
    } else if ((mover.team === 'blue' || mover.team === 'boss') && mover.row === board.size - 1) {
      mover.isKing = true
      promotedToKing = true
    }
  }
  // Decrement blocked-turns
  for (const row of newCells) {
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
  return {
    board: { size: board.size, cells: newCells, pieces: newPieces },
    promotedToKing,
    pickedUpPowerUp,
    appliedEffects,
  }
}

// Power-up effect log entry — used for FX/sound triggers
export interface PowerUpEffect {
  type: 'shield' | 'shield_break' | 'capture' | 'freeze' | 'swap' | 'bomb' | 'double_move' | 'extra_jump'
  pieceId?: string
  targetPieceIds?: string[]
}

// Apply a power-up's immediate effects to the board state.
// Returns effect log entries for FX/sound.
// NOTE: double_move and extra_jump are NOT applied here — the caller (move:make handler)
// checks for them and skips the turn-end step.
function applyPowerUpEffect(
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
      // Caller handles — just log
      effects.push({ type: 'double_move', pieceId: mover.id })
      break

    case 'extra_jump':
      // Caller handles — just log
      effects.push({ type: 'extra_jump', pieceId: mover.id })
      break

    case 'freeze': {
      // Freeze the nearest opponent piece for 1 turn
      if (opponents.length > 0) {
        let nearest = opponents[0]
        let minDist = Math.abs(nearest.row - mover.row) + Math.abs(nearest.col - mover.col)
        for (const o of opponents) {
          const d = Math.abs(o.row - mover.row) + Math.abs(o.col - mover.col)
          if (d < minDist) {
            minDist = d
            nearest = o
          }
        }
        nearest.frozenTurns = Math.max(nearest.frozenTurns, 2) // 2 because it'll be decremented once at turn end
        effects.push({ type: 'freeze', pieceId: nearest.id })
      }
      break
    }

    case 'swap': {
      // Swap with a random opponent piece (chaos!)
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
      // Destroy the adjacent enemy piece with the lowest HP
      const adjacent = opponents.filter(o => Math.abs(o.row - mover.row) <= 1 && Math.abs(o.col - mover.col) <= 1)
      if (adjacent.length > 0) {
        // Pick weakest
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
  void cells // unused but kept for future tile-based effects
  return effects
}

// Apply a power-up to a piece
export function applyPowerUp(piece: Piece, powerUp: Piece['character'] extends never ? never : any): Piece {
  const p = { ...piece }
  switch (powerUp) {
    case 'shield':
      p.hasShield = true
      break
    case 'extra_jump':
      // caller handles (allows another move)
      break
    case 'double_move':
      // caller handles
      break
    case 'freeze':
    case 'swap':
    case 'bomb':
      // These need a target — handled by caller through special action
      break
  }
  return p
}

// Character abilities
export function canUseAbility(piece: Piece): boolean {
  if (piece.abilityUsed) return false
  switch (piece.character) {
    case 'mage':
    case 'jester':
      return true
    case 'tank':
    case 'speedster':
      return false
  }
  return false
}

export function getAbilityTargets(board: Board, piece: Piece): { row: number; col: number }[] {
  if (!canUseAbility(piece)) return []
  switch (piece.character) {
    case 'mage': {
      // Teleport: any empty dark cell within 3 tiles
      const targets: { row: number; col: number }[] = []
      for (let r = 0; r < board.size; r++) {
        for (let c = 0; c < board.size; c++) {
          const cell = board.cells[r][c]
          if (cell.tile !== 'dark') continue
          if (cell.type === 'blocked') continue
          if (getPieceAt(board, r, c)) continue
          const dist = Math.max(Math.abs(r - piece.row), Math.abs(c - piece.col))
          if (dist > 0 && dist <= 3) targets.push({ row: r, col: c })
        }
      }
      return targets
    }
    case 'jester': {
      // Swap: any other piece on board
      const targets: { row: number; col: number }[] = []
      for (const p of Object.values(board.pieces)) {
        if (p.id === piece.id) continue
        targets.push({ row: p.row, col: p.col })
      }
      return targets
    }
    default:
      return []
  }
}
