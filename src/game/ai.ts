// Jumbo Royale - Smart AI (Minimax with alpha-beta pruning)
import { Board, Piece, Move, AnyTeam, GameState } from './types'
import { getTeamMoves, applyMove, getLegalMoves } from './engine'
import { getPieceAt } from './board'

// Difficulty levels
export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'brutal'

const DEPTH_BY_DIFFICULTY: Record<BotDifficulty, number> = {
  easy: 2,
  medium: 4,
  hard: 6,
  brutal: 7,
}

const RANDOMNESS_BY_DIFFICULTY: Record<BotDifficulty, number> = {
  easy: 0.4,   // 40% chance to pick a random move
  medium: 0.15,
  hard: 0.03,
  brutal: 0,   // always optimal
}

// Evaluation: positive = good for `maxTeam`, negative = good for opponent
function evaluateBoard(board: Board, maxTeam: AnyTeam, state: GameState): number {
  let score = 0
  const size = board.size

  const myPieces: Piece[] = []
  const oppPieces: Piece[] = []
  for (const p of Object.values(board.pieces)) {
    if (p.team === maxTeam) myPieces.push(p)
    else oppPieces.push(p)
  }

  // Material
  for (const p of myPieces) {
    score += p.isKing ? 50 : 30
    score += p.hp * 5
    if (p.hasShield) score += 10
    if (p.frozenTurns > 0) score -= 15 // being frozen is bad
  }
  for (const p of oppPieces) {
    score -= p.isKing ? 50 : 30
    score -= p.hp * 5
    if (p.hasShield) score -= 10
    if (p.frozenTurns > 0) score += 15
  }

  // Boss bonus (co-op): boss worth a lot
  if (state.mode === 'coop') {
    const bossPiece = oppPieces.find(p => p.team === 'boss' && p.isKing)
    if (bossPiece) {
      score -= bossPiece.hp * 8 // boss HP is bad for us
    }
  }

  // Positional: advancement (pawns moving forward is good)
  for (const p of myPieces) {
    if (p.isKing) continue
    // Red advances toward row 0; blue/boss toward row size-1
    const advancement = p.team === 'red' ? (size - 1 - p.row) : p.row
    score += advancement * 2
    // Back row defense (protect against promotion)
    if (p.team === 'red' && p.row === size - 1) score += 4
    if ((p.team === 'blue' || p.team === 'boss') && p.row === 0) score += 4
    // Center control
    const centerDist = Math.abs(p.col - (size - 1) / 2)
    score += (size / 2 - centerDist) * 1
  }
  for (const p of oppPieces) {
    if (p.isKing) continue
    const advancement = p.team === 'red' ? (size - 1 - p.row) : p.row
    score -= advancement * 2
    if (p.team === 'red' && p.row === size - 1) score -= 4
    if ((p.team === 'blue' || p.team === 'boss') && p.row === 0) score -= 4
    const centerDist = Math.abs(p.col - (size - 1) / 2)
    score -= (size / 2 - centerDist) * 1
  }

  // King mobility (kings in open space are strong)
  for (const p of myPieces) {
    if (p.isKing) {
      const moves = getLegalMoves(board, p)
      score += moves.length * 1.5
    }
  }
  for (const p of oppPieces) {
    if (p.isKing) {
      const moves = getLegalMoves(board, p)
      score -= moves.length * 1.5
    }
  }

  // Vulnerability: pieces that can be captured next turn are bad
  for (const p of myPieces) {
    if (isVulnerable(board, p)) score -= 25
  }
  for (const p of oppPieces) {
    if (isVulnerable(board, p)) score += 25
  }

  // Power-up proximity (going toward power-ups is good)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = board.cells[r][c]
      if (cell.type !== 'powerup' || !cell.powerUp) continue
      // Find nearest my piece
      let minDist = Infinity
      for (const p of myPieces) {
        const d = Math.max(Math.abs(p.row - r), Math.abs(p.col - c))
        if (d < minDist) minDist = d
      }
      score += Math.max(0, 8 - minDist) * 0.5
    }
  }

  return score
}

// Is this piece capturable by an opponent next turn?
function isVulnerable(board: Board, piece: Piece): boolean {
  const size = board.size
  // Check all 4 diagonal neighbors of piece's position for enemy pieces,
  // and verify the landing square (2 steps away) is empty
  const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
  for (const [dr, dc] of diagDirs) {
    const midR = piece.row + dr
    const midC = piece.col + dc
    const landR = piece.row + dr * 2
    const landC = piece.col + dc * 2
    if (landR < 0 || landR >= size || landC < 0 || landC >= size) continue
    const mid = getPieceAt(board, midR, midC)
    if (!mid || mid.team === piece.team) continue
    // Kings can move any direction; pawns only forward
    if (!mid.isKing) {
      const forward = mid.team === 'red' ? -1 : 1
      if (dr !== forward) continue
    }
    // Check landing square is empty (or is the piece itself, since it would be captured)
    const land = getPieceAt(board, landR, landC)
    if (!land || land.id === piece.id) return true
  }
  return false
}

// Generate all legal moves for a team, expanded so each capture-chain is its own move
function getAllTeamMoves(board: Board, team: AnyTeam): { pieceId: string; move: Move }[] {
  const teamMoveLists = getTeamMoves(board, team)
  const all: { pieceId: string; move: Move }[] = []
  for (const tm of teamMoveLists) {
    for (const m of tm.moves) {
      all.push({ pieceId: tm.pieceId, move: m })
    }
  }
  return all
}

interface MinimaxResult {
  score: number
  move?: { pieceId: string; move: Move }
}

function minimax(
  state: GameState,
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizingTeam: AnyTeam,
  currentTeam: AnyTeam,
): MinimaxResult {
  const moves = getAllTeamMoves(board, currentTeam)

  // Terminal: depth 0 or no moves
  if (depth === 0 || moves.length === 0) {
    const evalScore = evaluateBoard(board, maximizingTeam, state)
    // If no moves, this team loses — heavy penalty
    if (moves.length === 0) {
      if (currentTeam === maximizingTeam) return { score: evalScore - 10000 }
      else return { score: evalScore + 10000 }
    }
    return { score: evalScore }
  }

  const otherTeam: AnyTeam = currentTeam === 'red' ? 'blue' : 'red'
  // In co-op, "blue" doesn't exist; boss is the opponent
  const hasBlue = Object.values(board.pieces).some(p => p.team === 'blue')
  const hasBoss = Object.values(board.pieces).some(p => p.team === 'boss')
  const nextTeam: AnyTeam = (() => {
    if (state.mode === 'coop') {
      return currentTeam === 'red' ? 'boss' : 'red'
    }
    return currentTeam === 'red' ? 'blue' : 'red'
  })()
  void hasBlue
  void hasBoss
  void otherTeam

  if (currentTeam === maximizingTeam) {
    let best: MinimaxResult = { score: -Infinity }
    for (const m of moves) {
      const { board: newBoard } = applyMove(board, m.move)
      const result = minimax(state, newBoard, depth - 1, alpha, beta, maximizingTeam, nextTeam)
      if (result.score > best.score) {
        best = { score: result.score, move: m }
      }
      alpha = Math.max(alpha, result.score)
      if (beta <= alpha) break // beta cutoff
    }
    return best
  } else {
    let best: MinimaxResult = { score: Infinity }
    for (const m of moves) {
      const { board: newBoard } = applyMove(board, m.move)
      const result = minimax(state, newBoard, depth - 1, alpha, beta, maximizingTeam, nextTeam)
      if (result.score < best.score) {
        best = { score: result.score, move: m }
      }
      beta = Math.min(beta, result.score)
      if (beta <= alpha) break // alpha cutoff
    }
    return best
  }
}

// Pick the best move for a bot, with some randomness based on difficulty
export function pickBestMove(
  state: GameState,
  team: AnyTeam,
  difficulty: BotDifficulty = 'hard',
): { pieceId: string; move: Move } | null {
  const depth = DEPTH_BY_DIFFICULTY[difficulty]
  const randomness = RANDOMNESS_BY_DIFFICULTY[difficulty]

  const allMoves = getAllTeamMoves(state.board, team)
  if (allMoves.length === 0) return null

  // Random move sometimes (lower difficulties)
  if (Math.random() < randomness) {
    return allMoves[Math.floor(Math.random() * allMoves.length)]
  }

  // For easy mode, just pick the move with best immediate eval (depth 1)
  if (difficulty === 'easy') {
    let bestScore = -Infinity
    let bestMove = allMoves[0]
    for (const m of allMoves) {
      const { board: newBoard } = applyMove(state.board, m.move)
      const score = evaluateBoard(newBoard, team, state)
      if (score > bestScore) {
        bestScore = score
        bestMove = m
      }
    }
    return bestMove
  }

  // Use minimax with alpha-beta
  const result = minimax(state, state.board, depth, -Infinity, Infinity, team, team)
  return result.move ?? allMoves[0]
}

// Should the bot use its character ability this turn?
export function shouldUseAbility(
  state: GameState,
  piece: Piece,
  team: AnyTeam,
  difficulty: BotDifficulty = 'hard',
): { shouldUse: boolean; targetRow?: number; targetCol?: number } {
  if (piece.abilityUsed) return { shouldUse: false }
  if (piece.frozenTurns > 0) return { shouldUse: false }

  // Mage teleport — use if it leads to a capture or king promotion
  if (piece.character === 'mage') {
    // Try each teleport target, see if it enables a capture next move
    const size = state.board.size
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = state.board.cells[r][c]
        if (cell.tile !== 'dark' || cell.type === 'blocked') continue
        if (getPieceAt(state.board, r, c)) continue
        const dist = Math.max(Math.abs(r - piece.row), Math.abs(c - piece.col))
        if (dist === 0 || dist > 3) continue
        // Simulate: would this piece have a capture from (r, c)?
        const simPiece: Piece = { ...piece, row: r, col: c }
        const simBoard: Board = {
          ...state.board,
          pieces: { ...state.board.pieces, [piece.id]: simPiece },
        }
        const moves = getLegalMoves(simBoard, simPiece)
        const captures = moves.filter(m => m.kind === 'capture' || m.kind === 'multi_capture')
        if (captures.length > 0) {
          // Higher difficulty uses this more often
          if (difficulty === 'easy' && Math.random() > 0.3) continue
          return { shouldUse: true, targetRow: r, targetCol: c }
        }
        // Or would it promote?
        if (piece.team === 'red' && r === 0) {
          return { shouldUse: true, targetRow: r, targetCol: c }
        }
        if ((piece.team === 'blue' || piece.team === 'boss') && r === size - 1) {
          return { shouldUse: true, targetRow: r, targetCol: c }
        }
      }
    }
  }

  // Jester swap — use to escape danger or set up capture
  if (piece.character === 'jester') {
    // Use if this piece is vulnerable
    if (isVulnerable(state.board, piece)) {
      // Find a safer piece to swap with (one that's not vulnerable)
      for (const other of Object.values(state.board.pieces)) {
        if (other.id === piece.id) continue
        if (other.team === piece.team) continue // can swap with anyone (opponent preferably)
        // Would swapping put the opponent in danger? Good!
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
          return { shouldUse: true, targetRow: other.row, targetCol: other.col }
        }
      }
    }
  }

  return { shouldUse: false }
}
