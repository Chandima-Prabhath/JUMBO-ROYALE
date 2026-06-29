// ===========================================================================
// Jumbo Royale — Modern AI Module
// Strategic AI that considers abilities, power-ups, and positioning.
// Uses the engine API — CANNOT make illegal moves.
// Per GAME_CODEX.md section 8.
// ===========================================================================

import {
  GameState, Move, AnyTeam, BotDifficulty, Piece, Board,
  Position, PowerUpType,
} from './types'
import { getTeamLegalMoves, getLegalMoves, getCaptureMoves, getSimpleMoves } from './moves'
import { applyMove } from './apply'
import { getAbilityTargets, canUseAbility, applyAbility } from './abilities'
import { getPieceAt, getCell, inBounds } from './board'

// ===========================================================================
// Configuration
// ===========================================================================

const DEPTH_BY_DIFFICULTY: Record<BotDifficulty, number> = {
  easy: 2,
  medium: 4,
  hard: 5,
  brutal: 6,
}

const RANDOMNESS_BY_DIFFICULTY: Record<BotDifficulty, number> = {
  easy: 0.4,
  medium: 0.15,
  hard: 0.03,
  brutal: 0,
}

// ===========================================================================
// Action types — the AI considers BOTH moves AND abilities
// ===========================================================================

interface AIAction {
  type: 'move' | 'ability'
  pieceId: string
  move?: Move
  abilityTarget?: Position
  score: number  // immediate heuristic score
}

// ===========================================================================
// Main entry point — pick the best action (move or ability)
// ===========================================================================

export function pickBestMove(
  state: GameState,
  team: AnyTeam,
  difficulty: BotDifficulty = 'hard',
): { pieceId: string; move: Move } | null {
  // Generate all possible actions (moves + abilities)
  const actions = generateAllActions(state, team, difficulty)
  if (actions.length === 0) return null

  // Random move sometimes (lower difficulties)
  if (Math.random() < RANDOMNESS_BY_DIFFICULTY[difficulty]) {
    const moveActions = actions.filter(a => a.type === 'move')
    if (moveActions.length > 0) {
      const random = moveActions[Math.floor(Math.random() * moveActions.length)]
      return { pieceId: random.pieceId, move: random.move! }
    }
  }

  // Easy mode: just pick best immediate action
  if (difficulty === 'easy') {
    return pickBestImmediate(state, actions, team)
  }

  // Medium+: use minimax with abilities in the search tree
  const depth = DEPTH_BY_DIFFICULTY[difficulty]
  const result = minimaxWithAbilities(state, depth, -Infinity, Infinity, team, team)
  if (result.action?.type === 'move' && result.action.move) {
    return { pieceId: result.action.pieceId, move: result.action.move }
  }

  // Fallback to best immediate action
  return pickBestImmediate(state, actions, team)
}

// ===========================================================================
// Generate all possible actions (moves + abilities)
// ===========================================================================

function generateAllActions(state: GameState, team: AnyTeam, difficulty: BotDifficulty): AIAction[] {
  const actions: AIAction[] = []

  // 1. Generate all legal moves
  const teamMoves = getTeamLegalMoves(state.board, team)
  for (const tm of teamMoves) {
    for (const move of tm.moves) {
      actions.push({
        type: 'move',
        pieceId: tm.pieceId,
        move,
        score: scoreMove(state, move, team),
      })
    }
  }

  // 2. Generate all ability actions (mage teleport, jester swap)
  const teamPieces = Object.values(state.board.pieces).filter(
    p => p.team === team && !p.abilityUsed && p.frozenTurns === 0
  )
  for (const piece of teamPieces) {
    if (!canUseAbility(piece)) continue
    const targets = getAbilityTargets(state.board, piece)
    for (const target of targets) {
      const score = scoreAbility(state, piece, target, team, difficulty)
      if (score > -100) {  // filter out terrible abilities
        actions.push({
          type: 'ability',
          pieceId: piece.id,
          abilityTarget: target,
          score,
        })
      }
    }
  }

  return actions
}

// ===========================================================================
// Score a move — heuristic evaluation
// ===========================================================================

function scoreMove(state: GameState, move: Move, team: AnyTeam): number {
  let score = 0

  // Captures are valuable
  score += move.capturedPieceIds.length * 100
  if (move.capturedPieceIds.length > 1) score += 50  // combo bonus

  // Power-up collection
  if (move.pickedUpPowerUp) {
    score += scorePowerUp(move.pickedUpPowerUp, state, team)
  }

  // Advancement toward enemy territory
  const piece = state.board.pieces[move.pieceId]
  if (piece && !piece.isKing) {
    const forward = team === 'red' ? -1 : 1
    const advancement = (move.toRow - move.fromRow) * forward
    score += advancement * 5

    // King promotion bonus
    if (team === 'red' && move.toRow === 0) score += 80
    if ((team === 'blue' || team === 'boss') && move.toRow === state.board.size - 1) score += 80
  }

  // Avoid moving into danger
  const simBoard = simulateMove(state, move)
  if (simBoard) {
    const movedPiece = simBoard.pieces[move.pieceId]
    if (movedPiece && isVulnerable(simBoard, movedPiece)) {
      score -= 40  // penalty for moving into capture range
    }
  }

  return score
}

// ===========================================================================
// Score an ability — strategic evaluation
// ===========================================================================

function scoreAbility(
  state: GameState,
  piece: Piece,
  target: Position,
  team: AnyTeam,
  difficulty: BotDifficulty,
): number {
  let score = 0

  if (piece.character === 'mage') {
    // Mage teleport — score based on what it enables

    // 1. Does it enable a capture?
    const simPiece: Piece = { ...piece, row: target.row, col: target.col }
    const simBoard: Board = {
      ...state.board,
      pieces: { ...state.board.pieces, [piece.id]: simPiece },
    }
    const captures = getCaptureMoves(simBoard, simPiece)
    if (captures.length > 0) {
      score += 150  // big bonus for enabling captures
      // Even bigger if it's a chain
      const maxChain = Math.max(...captures.map(c => c.capturedPieceIds.length))
      score += maxChain * 30
    }

    // 2. Does it grab a power-up?
    const cell = getCell(state.board, target.row, target.col)
    if (cell?.type === 'powerup' && cell.powerUp) {
      score += scorePowerUp(cell.powerUp, state, team) + 20
    }

    // 3. Does it escape danger?
    if (isVulnerable(state.board, piece)) {
      const simBoardAfter: Board = {
        ...state.board,
        pieces: { ...state.board.pieces, [piece.id]: simPiece },
      }
      if (!isVulnerable(simBoardAfter, simPiece)) {
        score += 60  // escape bonus
      }
    }

    // 4. Does it promote? (abilities don't promote, but positioning near back row is good)
    if (team === 'red' && target.row <= 2) score += 15
    if ((team === 'blue' || team === 'boss') && target.row >= state.board.size - 3) score += 15

    // 5. Penalty for teleporting into danger
    if (isVulnerable(simBoard, simPiece)) {
      score -= 50
    }

    // Difficulty scaling
    if (difficulty === 'easy') score *= 0.5
  }

  if (piece.character === 'jester') {
    // Jester swap — score based on strategic value

    const other = getPieceAt(state.board, target.row, target.col)
    if (!other) return -200

    // 1. Escape danger
    if (isVulnerable(state.board, piece)) {
      const simOther: Piece = { ...other, row: piece.row, col: piece.col }
      const simPiece: Piece = { ...piece, row: other.row, col: other.col }
      const simBoard: Board = {
        ...state.board,
        pieces: { ...state.board.pieces, [piece.id]: simPiece, [other.id]: simOther },
      }
      if (!isVulnerable(simBoard, simPiece)) {
        score += 70  // escape bonus
      }
      // Does the swap put the ENEMY in danger?
      if (isVulnerable(simBoard, simOther)) {
        score += 50  // trap bonus
      }
    }

    // 2. Swap with enemy king (big value — removes their king advantage)
    if (other.isKing && !piece.isKing) {
      score += 40  // our piece takes king's good position
    }

    // 3. Swap to enable captures
    const simPiece: Piece = { ...piece, row: other.row, col: other.col }
    const simBoard: Board = {
      ...state.board,
      pieces: { ...state.board.pieces, [piece.id]: simPiece },
    }
    const captures = getCaptureMoves(simBoard, simPiece)
    if (captures.length > 0) {
      score += 100
    }

    // 4. Swap to grab a power-up at the new position
    const cell = getCell(state.board, other.row, other.col)
    if (cell?.type === 'powerup' && cell.powerUp) {
      score += scorePowerUp(cell.powerUp, state, team) + 15
    }

    // Don't swap our good piece for their bad piece
    if (piece.isKing && !other.isKing) score -= 30
    if (piece.hp > 1 && other.hp === 1) score -= 15

    // Difficulty scaling
    if (difficulty === 'easy') score *= 0.4
  }

  return score
}

// ===========================================================================
// Score a power-up — how valuable is it in the current situation?
// ===========================================================================

function scorePowerUp(powerUp: PowerUpType, state: GameState, team: AnyTeam): number {
  const opponentCount = Object.values(state.board.pieces).filter(p => p.team !== team).length

  switch (powerUp) {
    case 'shield':
      return 30  // always useful
    case 'double_move':
    case 'extra_jump':
      return 25  // tempo advantage
    case 'freeze':
      return opponentCount > 0 ? 35 : 10  // more useful when enemies exist
    case 'bomb':
      return opponentCount > 0 ? 40 : 5   // great when enemies are adjacent
    case 'swap':
      return 20  // situational
    default:
      return 15
  }
}

// ===========================================================================
// Minimax with abilities in the search tree
// ===========================================================================

interface MinimaxResult {
  score: number
  action?: AIAction
}

function minimaxWithAbilities(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizingTeam: AnyTeam,
  currentTeam: AnyTeam,
): MinimaxResult {
  const actions = generateAllActions(state, currentTeam, 'hard')
  if (depth === 0 || actions.length === 0) {
    const score = evaluateBoard(state.board, maximizingTeam, state)
    if (actions.length === 0) {
      return { score: currentTeam === maximizingTeam ? score - 10000 : score + 10000 }
    }
    return { score }
  }

  const nextTeam: AnyTeam = state.mode === 'coop'
    ? (currentTeam === 'red' ? 'boss' : 'red')
    : (currentTeam === 'red' ? 'blue' : 'red')

  // Sort actions by heuristic score (best first) for better alpha-beta pruning
  actions.sort((a, b) => b.score - a.score)

  if (currentTeam === maximizingTeam) {
    let best: MinimaxResult = { score: -Infinity }
    for (const action of actions) {
      const childState = applyAction(state, action)
      if (!childState) continue
      const child = minimaxWithAbilities(childState, depth - 1, alpha, beta, maximizingTeam, nextTeam)
      if (child.score > best.score) {
        best = { score: child.score, action }
      }
      alpha = Math.max(alpha, child.score)
      if (beta <= alpha) break
    }
    return best
  } else {
    let best: MinimaxResult = { score: Infinity }
    for (const action of actions) {
      const childState = applyAction(state, action)
      if (!childState) continue
      const child = minimaxWithAbilities(childState, depth - 1, alpha, beta, maximizingTeam, nextTeam)
      if (child.score < best.score) {
        best = { score: child.score, action }
      }
      beta = Math.min(beta, child.score)
      if (beta <= alpha) break
    }
    return best
  }
}

// Apply an AI action (move or ability) and return the resulting state
function applyAction(state: GameState, action: AIAction): GameState | null {
  if (action.type === 'move' && action.move) {
    const result = applyMove(state, action.move)
    return result.newState ?? null
  }
  if (action.type === 'ability' && action.abilityTarget) {
    const result = applyAbility(state, action.pieceId, action.abilityTarget)
    return result.newState ?? null
  }
  return null
}

// ===========================================================================
// Pick best immediate action (for easy mode / fallback)
// ===========================================================================

function pickBestImmediate(
  state: GameState,
  actions: AIAction[],
  team: AnyTeam,
): { pieceId: string; move: Move } | null {
  // Only consider moves for the return type (abilities are handled separately by shouldUseAbility)
  const moveActions = actions.filter(a => a.type === 'move')
  if (moveActions.length === 0) return null

  let best = moveActions[0]
  for (const action of moveActions) {
    // Simulate and evaluate
    const childState = applyAction(state, action)
    if (!childState) continue
    const score = evaluateBoard(childState.board, team, state) + action.score * 0.3
    if (score > (best._evaluatedScore ?? -Infinity)) {
      best = { ...action, _evaluatedScore: score } as any
    }
  }
  return { pieceId: best.pieceId, move: best.move! }
}

// ===========================================================================
// Ability decision — should the bot use an ability?
// Returns the best ability action if it's worth using
// ===========================================================================

export function shouldUseAbility(
  state: GameState,
  piece: Piece,
  team: AnyTeam,
  difficulty: BotDifficulty = 'hard',
): { shouldUse: boolean; targetRow?: number; targetCol?: number } {
  if (!canUseAbility(piece)) return { shouldUse: false }

  const targets = getAbilityTargets(state.board, piece)
  if (targets.length === 0) return { shouldUse: false }

  // Score each target and pick the best
  let bestScore = -Infinity
  let bestTarget: Position | null = null

  for (const target of targets) {
    const score = scoreAbility(state, piece, target, team, difficulty)

    // For easy bots, add randomness
    const adjustedScore = difficulty === 'easy' ? score * (0.5 + Math.random() * 0.5) : score

    if (adjustedScore > bestScore) {
      bestScore = adjustedScore
      bestTarget = target
    }
  }

  // Threshold: only use ability if it's good enough
  const threshold = difficulty === 'easy' ? 30 : difficulty === 'medium' ? 20 : 10
  if (bestScore >= threshold && bestTarget) {
    return { shouldUse: true, targetRow: bestTarget.row, targetCol: bestTarget.col }
  }

  return { shouldUse: false }
}

// ===========================================================================
// Board evaluation — comprehensive heuristic
// ===========================================================================

function evaluateBoard(board: Board, maxTeam: AnyTeam, state: GameState): number {
  let score = 0
  const size = board.size

  const myPieces = Object.values(board.pieces).filter(p => p.team === maxTeam)
  const enemyPieces = Object.values(board.pieces).filter(p => p.team !== maxTeam)

  // 1. Material count (weighted by piece type)
  for (const p of myPieces) {
    score += pieceValue(p, state)
  }
  for (const p of enemyPieces) {
    score -= pieceValue(p, state)
  }

  // 2. King count (kings are very valuable)
  const myKings = myPieces.filter(p => p.isKing).length
  const enemyKings = enemyPieces.filter(p => p.isKing).length
  score += (myKings - enemyKings) * 25

  // 3. Advancement (pawns closer to promotion are more valuable)
  for (const p of myPieces) {
    if (!p.isKing) {
      const advancement = p.team === 'red' ? (size - 1 - p.row) : p.row
      score += advancement * 3
    }
  }
  for (const p of enemyPieces) {
    if (!p.isKing) {
      const advancement = p.team === 'red' ? (size - 1 - p.row) : p.row
      score -= advancement * 3
    }
  }

  // 4. Center control
  for (const p of [...myPieces, ...enemyPieces]) {
    const centerDist = Math.abs(p.col - (size - 1) / 2) + Math.abs(p.row - (size - 1) / 2)
    const centerBonus = Math.max(0, 4 - centerDist) * 1
    if (p.team === maxTeam) score += centerBonus
    else score -= centerBonus
  }

  // 5. Vulnerability
  for (const p of myPieces) {
    if (isVulnerable(board, p)) {
      score -= p.isKing ? 40 : 20
    }
  }
  for (const p of enemyPieces) {
    if (isVulnerable(board, p)) {
      score += p.isKing ? 40 : 20
    }
  }

  // 6. Power-up proximity
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
      const powerUpValue = scorePowerUp(cell.powerUp, state, maxTeam)
      score += Math.max(0, (8 - minDist)) * (powerUpValue / 20)

      // Find nearest enemy piece
      let minEnemyDist = Infinity
      for (const p of enemyPieces) {
        const d = Math.max(Math.abs(p.row - r), Math.abs(p.col - c))
        if (d < minEnemyDist) minEnemyDist = d
      }
      score -= Math.max(0, (8 - minEnemyDist)) * (powerUpValue / 20)
    }
  }

  // 7. Ability availability (unused abilities are potential value)
  for (const p of myPieces) {
    if (!p.abilityUsed && (p.character === 'mage' || p.character === 'jester')) {
      score += 10
    }
  }
  for (const p of enemyPieces) {
    if (!p.abilityUsed && (p.character === 'mage' || p.character === 'jester')) {
      score -= 10
    }
  }

  // 8. Boss HP (co-op)
  if (state.mode === 'coop') {
    const boss = Object.values(board.pieces).find(p => p.team === 'boss' && p.isKing)
    if (boss && maxTeam === 'red') score -= boss.hp * 8
  }

  // 9. Shield value
  for (const p of myPieces) {
    if (p.hasShield) score += 15
  }
  for (const p of enemyPieces) {
    if (p.hasShield) score -= 15
  }

  // 10. Mobility
  const myMobility = myPieces.reduce((sum, p) => sum + getLegalMoves(board, p).length, 0)
  const enemyMobility = enemyPieces.reduce((sum, p) => sum + getLegalMoves(board, p).length, 0)
  score += (myMobility - enemyMobility) * 0.5

  return score
}

function pieceValue(p: Piece, state: GameState): number {
  let val = p.isKing ? 50 : 30
  val += p.hp * 5
  if (p.hasShield) val += 10
  if (p.frozenTurns > 0) val -= 15

  // Mage and Jester with unused abilities are worth more
  if (!p.abilityUsed) {
    if (p.character === 'mage') val += 15
    if (p.character === 'jester') val += 12
  }

  // Tank with high HP is valuable
  if (p.character === 'tank' && p.hp > 1) val += 10

  // Speedster with dash potential
  if (p.character === 'speedster' && !p.isKing) val += 5

  return val
}

// ===========================================================================
// Simulate a move and return the new board
// ===========================================================================

function simulateMove(state: GameState, move: Move): Board | null {
  const result = applyMove(state, move)
  return result.newState?.board ?? null
}

// ===========================================================================
// Vulnerability check — American checkers rules
// Pawns can only capture forward, so a piece is only vulnerable
// from enemies that are behind it (relative to their forward direction)
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
    // American checkers: pawns can only capture forward
    const enemyForward = mid.team === 'red' ? -1 : 1
    if (!mid.isKing && dr !== enemyForward) continue
    const land = getPieceAt(board, landR, landC)
    if (!land || land.id === piece.id) return true
  }
  return false
}
