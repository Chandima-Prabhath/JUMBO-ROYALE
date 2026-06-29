// ===========================================================================
// Jumbo Royale — AI Module
// Bot AI that uses the GameEngine API.
// Bots CANNOT make illegal moves — the engine rejects them.
// Per GAME_CODEX.md section 8.
// ===========================================================================

import { GameState, Move, AnyTeam, BotDifficulty, Piece, Board, Position } from './types'
import { getTeamLegalMoves, getLegalMoves, getCaptureMoves } from './moves'
import { applyMove } from './apply'
import { getAbilityTargets, canUseAbility } from './abilities'
import { getPieceAt, inBounds, getCell } from './board'

const DEPTH_BY_DIFFICULTY: Record<BotDifficulty, number> = {
  easy: 2,
  medium: 4,
  hard: 6,
  brutal: 7,
}

const RANDOMNESS_BY_DIFFICULTY: Record<BotDifficulty, number> = {
  easy: 0.4,
  medium: 0.15,
  hard: 0.03,
  brutal: 0,
}

// ===========================================================================
// Pick the best move for a bot
// ===========================================================================

export function pickBestMove(
  state: GameState,
  team: AnyTeam,
  difficulty: BotDifficulty = 'hard',
): { pieceId: string; move: Move } | null {
  const teamMoveLists = getTeamLegalMoves(state.board, team)
  const allMoves: { pieceId: string; move: Move }[] = []
  for (const tm of teamMoveLists) {
    for (const m of tm.moves) {
      allMoves.push({ pieceId: tm.pieceId, move: m })
    }
  }

  if (allMoves.length === 0) return null

  // Random move sometimes (lower difficulties)
  if (Math.random() < RANDOMNESS_BY_DIFFICULTY[difficulty]) {
    return allMoves[Math.floor(Math.random() * allMoves.length)]
  }

  // Easy mode: just pick best immediate eval
  if (difficulty === 'easy') {
    let bestScore = -Infinity
    let bestMove = allMoves[0]
    for (const m of allMoves) {
      const result = applyMove(state, m.move)
      if (!result.newState) continue
      const score = evaluateBoard(result.newState.board, team, state)
      if (score > bestScore) {
        bestScore = score
        bestMove = m
      }
    }
    return bestMove
  }

  // Use minimax with alpha-beta pruning
  const depth = DEPTH_BY_DIFFICULTY[difficulty]
  const result = minimax(state, state.board, depth, -Infinity, Infinity, team, team)
  return result.move ?? allMoves[0]
}

// ===========================================================================
// Should the bot use an ability?
// ===========================================================================

export function shouldUseAbility(
  state: GameState,
  piece: Piece,
  team: AnyTeam,
  difficulty: BotDifficulty = 'hard',
): { shouldUse: boolean; targetRow?: number; targetCol?: number } {
  if (!canUseAbility(piece)) return { shouldUse: false }

  if (piece.character === 'mage') {
    return shouldMageTeleport(state, piece, team, difficulty)
  }

  if (piece.character === 'jester') {
    return shouldJesterSwap(state, piece, team, difficulty)
  }

  return { shouldUse: false }
}

function shouldMageTeleport(
  state: GameState,
  piece: Piece,
  team: AnyTeam,
  difficulty: BotDifficulty,
): { shouldUse: boolean; targetRow?: number; targetCol?: number } {
  const targets = getAbilityTargets(state.board, piece)
  for (const t of targets) {
    // Simulate: would this piece have a capture from (t.row, t.col)?
    const simPiece: Piece = { ...piece, row: t.row, col: t.col }
    const simBoard: Board = {
      ...state.board,
      pieces: { ...state.board.pieces, [piece.id]: simPiece },
    }
    const captures = getCaptureMoves(simBoard, simPiece)
    if (captures.length > 0) {
      if (difficulty === 'easy' && Math.random() > 0.3) continue
      return { shouldUse: true, targetRow: t.row, targetCol: t.col }
    }
  }
  return { shouldUse: false }
}

function shouldJesterSwap(
  state: GameState,
  piece: Piece,
  team: AnyTeam,
  difficulty: BotDifficulty,
): { shouldUse: boolean; targetRow?: number; targetCol?: number } {
  if (!isVulnerable(state.board, piece)) return { shouldUse: false }

  const targets = getAbilityTargets(state.board, piece)
  for (const t of targets) {
    const other = getPieceAt(state.board, t.row, t.col)
    if (!other || other.team === piece.team) continue

    // Simulate swap
    const simOther: Piece = { ...other, row: piece.row, col: piece.col }
    const simPiece: Piece = { ...piece, row: other.row, col: other.col }
    const simBoard: Board = {
      ...state.board,
      pieces: {
        ...state.board.pieces,
        [piece.id]: simPiece,
        [other.id]: simOther,
      },
    }
    if (!isVulnerable(simBoard, simPiece)) {
      if (difficulty === 'easy' && Math.random() > 0.4) continue
      return { shouldUse: true, targetRow: t.row, targetCol: t.col }
    }
  }
  return { shouldUse: false }
}

// ===========================================================================
// Minimax with alpha-beta pruning
// ===========================================================================

function minimax(
  state: GameState,
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizingTeam: AnyTeam,
  currentTeam: AnyTeam,
): { score: number; move?: { pieceId: string; move: Move } } {
  const moves = getTeamLegalMoves(board, currentTeam)
  const allMoves: { pieceId: string; move: Move }[] = []
  for (const tm of moves) {
    for (const m of tm.moves) {
      allMoves.push({ pieceId: tm.pieceId, move: m })
    }
  }

  if (depth === 0 || allMoves.length === 0) {
    const score = evaluateBoard(board, maximizingTeam, state)
    if (allMoves.length === 0) {
      return { score: currentTeam === maximizingTeam ? score - 10000 : score + 10000 }
    }
    return { score }
  }

  const nextTeam: AnyTeam = state.mode === 'coop'
    ? (currentTeam === 'red' ? 'boss' : 'red')
    : (currentTeam === 'red' ? 'blue' : 'red')

  if (currentTeam === maximizingTeam) {
    let best = { score: -Infinity }
    for (const m of allMoves) {
      const result = applyMove({ ...state, board }, m.move)
      if (!result.newState) continue
      const child = minimax(state, result.newState.board, depth - 1, alpha, beta, maximizingTeam, nextTeam)
      if (child.score > best.score) best = { score: child.score, move: m }
      alpha = Math.max(alpha, child.score)
      if (beta <= alpha) break
    }
    return best
  } else {
    let best = { score: Infinity }
    for (const m of allMoves) {
      const result = applyMove({ ...state, board }, m.move)
      if (!result.newState) continue
      const child = minimax(state, result.newState.board, depth - 1, alpha, beta, maximizingTeam, nextTeam)
      if (child.score < best.score) best = { score: child.score, move: m }
      beta = Math.min(beta, child.score)
      if (beta <= alpha) break
    }
    return best
  }
}

// ===========================================================================
// Board evaluation
// ===========================================================================

function evaluateBoard(board: Board, maxTeam: AnyTeam, state: GameState): number {
  let score = 0
  const size = board.size

  for (const p of Object.values(board.pieces)) {
    const val = p.isKing ? 50 : 30
    const hpBonus = p.hp * 5
    const shieldBonus = p.hasShield ? 10 : 10
    const frozenPenalty = p.frozenTurns > 0 ? 15 : 0
    const total = val + hpBonus + shieldBonus - frozenPenalty

    if (p.team === maxTeam) score += total
    else score -= total

    // Positional: advancement
    if (!p.isKing) {
      const advancement = p.team === 'red' ? (size - 1 - p.row) : p.row
      score += (p.team === maxTeam ? advancement : -advancement) * 2
    }

    // King mobility
    if (p.isKing) {
      const moves = getLegalMoves(board, p)
      score += (p.team === maxTeam ? moves.length : -moves.length) * 1.5
    }
  }

  // Vulnerability
  for (const p of Object.values(board.pieces)) {
    if (p.team === maxTeam && isVulnerable(board, p)) score -= 25
    if (p.team !== maxTeam && isVulnerable(board, p)) score += 25
  }

  // Boss HP (co-op)
  if (state.mode === 'coop') {
    const boss = Object.values(board.pieces).find(p => p.team === 'boss' && p.isKing)
    if (boss && maxTeam === 'red') score -= boss.hp * 8
  }

  return score
}

// ===========================================================================
// Vulnerability check — can this piece be captured next turn?
// ===========================================================================

function isVulnerable(board: Board, piece: Piece): boolean {
  const ALL_DIAGS = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
  for (const [dr, dc] of ALL_DIAGS) {
    const midR = piece.row + dr
    const midC = piece.col + dc
    const landR = piece.row + dr * 2
    const landC = piece.col + dc * 2
    if (!inBounds(board, landR, landC)) continue
    const mid = getPieceAt(board, midR, midC)
    if (!mid || mid.team === piece.team) continue
    // Kings can capture any direction; pawns can capture any direction too (per codex)
    const land = getPieceAt(board, landR, landC)
    if (!land || land.id === piece.id) return true
  }
  return false
}
