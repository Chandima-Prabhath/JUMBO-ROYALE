// Jumbo Royale - Win conditions, chaos events, helpers
import { GameState, Board, AnyTeam, ChaosEvent, Piece, PowerUpType } from './types'
import { getTeamMoves } from './engine'
import { getPieceAt } from './board'

export function checkWinner(state: GameState): AnyTeam | undefined {
  if (state.mode === 'pvp') {
    const redAlive = Object.values(state.board.pieces).some(p => p.team === 'red')
    const blueAlive = Object.values(state.board.pieces).some(p => p.team === 'blue')
    if (!redAlive) return 'blue'
    if (!blueAlive) return 'red'

    // Stalemate: current team has no moves
    const currentMoves = getTeamMoves(state.board, state.currentTurnTeam)
    if (currentMoves.length === 0) {
      // Check if ALL pieces are frozen — if so, skip turn instead of losing
      const teamPieces = Object.values(state.board.pieces).filter(p => p.team === state.currentTurnTeam)
      const allFrozen = teamPieces.length > 0 && teamPieces.every(p => p.frozenTurns > 0)
      if (allFrozen) {
        // All pieces frozen — don't lose, just skip (return undefined so turn continues)
        return undefined
      }
      // Genuinely no moves (all pieces blocked/trapped) — team loses
      return state.currentTurnTeam === 'red' ? 'blue' : 'red'
    }

    // Game pacing: prevent endless games
    // 1. Turn limit: after 80 total turns, team with more pieces wins
    if (state.turnCount >= 80) {
      const redCount = Object.values(state.board.pieces).filter(p => p.team === 'red').length
      const blueCount = Object.values(state.board.pieces).filter(p => p.team === 'blue').length
      if (redCount > blueCount) return 'red'
      if (blueCount > redCount) return 'blue'
      return 'red' // tie goes to red (arbitrary)
    }
    // 2. No-capture limit: after 20 turns without any capture, team with more pieces wins
    if (state.turnsWithoutCapture >= 20) {
      const redCount = Object.values(state.board.pieces).filter(p => p.team === 'red').length
      const blueCount = Object.values(state.board.pieces).filter(p => p.team === 'blue').length
      if (redCount > blueCount) return 'red'
      if (blueCount > redCount) return 'blue'
      return 'red'
    }
    return undefined
  } else {
    // Co-op: humans win when boss is dead; boss wins when all humans are dead
    const bossAlive = Object.values(state.board.pieces).some(p => p.team === 'boss')
    const redAlive = Object.values(state.board.pieces).some(p => p.team === 'red')
    if (!bossAlive) return 'red'
    if (!redAlive) return 'boss'

    // Stalemate: red team has no moves
    if (state.currentTurnTeam === 'red') {
      const redMoves = getTeamMoves(state.board, 'red')
      if (redMoves.length === 0) {
        const redPieces = Object.values(state.board.pieces).filter(p => p.team === 'red')
        const allFrozen = redPieces.length > 0 && redPieces.every(p => p.frozenTurns > 0)
        if (!allFrozen) {
          // Red is genuinely stuck — boss wins
          return 'boss'
        }
      }
    }

    // Game pacing: after 100 turns, boss wins (prevents endless co-op games)
    if (state.turnCount >= 100) {
      return 'boss'
    }
    return undefined
  }
}

// NOTE: 'gravity_flip' was removed because it breaks pawn movement — after
// flipping the board, pawns' forward direction points them off the board.
// Replaced with 'power_rain' which spawns new power-ups instead.
const CHAOS_EVENTS: ChaosEvent[] = [
  'ice_age', 'shrink', 'double_trouble', 'frenzy', 'power_rain',
]

export function rollChaosEvent(): ChaosEvent {
  return CHAOS_EVENTS[Math.floor(Math.random() * CHAOS_EVENTS.length)]
}

// Apply a chaos event to the board
export function applyChaos(state: GameState, event: ChaosEvent): GameState {
  const newState: GameState = JSON.parse(JSON.stringify(state))
  switch (event) {
    case 'gravity_flip': {
      // Flip board vertically: row -> size-1-row
      const size = newState.board.size
      for (const p of Object.values(newState.board.pieces)) {
        p.row = size - 1 - p.row
      }
      // Also swap cells power-ups
      const newCells = newState.board.cells.map(row => [...row])
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          newCells[r][c] = newState.board.cells[size - 1 - r][c]
          newCells[r][c].row = r
        }
      }
      newState.board.cells = newCells
      break
    }
    case 'shrink': {
      // Block outer ring for 3 turns
      const size = newState.board.size
      for (let c = 0; c < size; c++) {
        for (const r of [0, size - 1]) {
          // Don't trap pieces: only block empty cells
          if (!getPieceAt(newState.board, r, c)) {
            newState.board.cells[r][c].type = 'blocked'
            newState.board.cells[r][c].blockedTurns = 3
          }
        }
      }
      break
    }
    case 'ice_age':
    case 'double_trouble':
    case 'frenzy':
      // These affect gameplay rules transiently — handled in turn logic
      break
    case 'power_rain': {
      // Spawn 4 new power-ups on random empty dark cells
      const size = newState.board.size
      const emptyDarkCells: { r: number; c: number }[] = []
      for (let r = 2; r < size - 2; r++) {
        for (let c = 0; c < size; c++) {
          const cell = newState.board.cells[r][c]
          if (cell.tile === 'dark' && cell.type === 'normal' && !getPieceAt(newState.board, r, c)) {
            emptyDarkCells.push({ r, c })
          }
        }
      }
      // Shuffle and pick 4
      for (let i = emptyDarkCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[emptyDarkCells[i], emptyDarkCells[j]] = [emptyDarkCells[j], emptyDarkCells[i]]
      }
      const POWERUP_POOL: PowerUpType[] = ['double_move', 'freeze', 'swap', 'bomb', 'shield', 'extra_jump']
      for (let i = 0; i < Math.min(4, emptyDarkCells.length); i++) {
        const { r, c } = emptyDarkCells[i]
        newState.board.cells[r][c].type = 'powerup'
        newState.board.cells[r][c].powerUp = POWERUP_POOL[Math.floor(Math.random() * POWERUP_POOL.length)]
      }
      break
    }
  }
  newState.chaosCount += 1
  newState.version += 1
  return newState
}

// Simple Boss AI: pick the best capture move; otherwise advance toward player pieces
export function pickBossMove(state: GameState): { pieceId: string; move: import('./types').Move } | null {
  const bossTeamMoves = getTeamMoves(state.board, 'boss')
  if (bossTeamMoves.length === 0) return null

  // Prefer multi-captures, then single captures, then simple moves
  let best: { pieceId: string; move: import('./types').Move; score: number } | null = null
  for (const pm of bossTeamMoves) {
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
        const newDist = Math.abs(m.toRow - mover.row) + Math.abs(m.toCol - mover.col) // 0 for captures
        score += (minDist - newDist) * 5
      }
      if (!best || score > best.score) {
        best = { pieceId: pm.pieceId, move: m, score }
      }
    }
  }
  return best ? { pieceId: best.pieceId, move: best.move } : null
}

// Boss special: at 50% HP, summon a minion
export function bossSummon(state: GameState): { state: GameState; summoned: Piece | null } {
  const newState: GameState = JSON.parse(JSON.stringify(state))
  if (!newState.boss) return { state: newState, summoned: null }
  // Find empty dark cell near boss
  const bossPieces = Object.values(newState.board.pieces).filter(p => p.team === 'boss')
  if (bossPieces.length >= 6) return { state: newState, summoned: null } // limit
  for (let attempt = 0; attempt < 10; attempt++) {
    const r = newState.board.size - 1 - Math.floor(Math.random() * 3)
    const c = Math.floor(Math.random() * newState.board.size)
    if (r < 0) continue
    const cell = newState.board.cells[r]?.[c]
    if (!cell || cell.tile !== 'dark' || cell.type === 'blocked') continue
    if (getPieceAt(newState.board, r, c)) continue
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
      facing: 'left',
      ownerName: 'Spawn',
    }
    newState.board.pieces[id] = minion
    newState.version += 1
    return { state: newState, summoned: minion }
  }
  return { state: newState, summoned: null }
}
