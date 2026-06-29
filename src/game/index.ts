// ===========================================================================
// Jumbo Royale — Public API
// Everything consumers need is exported from here.
// Import from '@/game' — never from individual modules.
// ===========================================================================

export * from './types'
export { GameEngine } from './engine'
export { createBoard, getPieceAt, getCell, inBounds, getTeamPieces, getAlivePieceCount, BOARD_SIZE, POWERUP_COUNT } from './board'
export { getLegalMoves, getTeamLegalMoves, getCaptureMoves, getSimpleMoves, hasLegalMoves } from './moves'
export { applyMove, validateMove, applyPowerUpEffect } from './apply'
export { applyAbility, validateAbility, getAbilityTargets, canUseAbility } from './abilities'
export { checkWinner, isAllFrozen } from './winner'
export { nextTurn, shouldSkipTurn, getCurrentPlayer, isPlayerTurn, isBotTurn, TURN_DURATION_SEC, CHAOS_INTERVAL_SEC } from './turn'
export { pickBestMove, shouldUseAbility } from './ai'
export { pickBossMove, bossSummon } from './boss'

// ===========================================================================
// Compatibility re-exports — for the server which still uses old import paths
// These map old function names to new locations. Will be removed once the
// server is fully migrated to use the GameEngine class.
// ===========================================================================

// Old: getTeamMoves → New: getTeamLegalMoves
export { getTeamLegalMoves as getTeamMoves } from './moves'

// Old: MAX_MOVES_PER_TURN was in board.ts, now in turn.ts
export { MAX_MOVES_PER_TURN } from './turn'

// Chaos event rolling (was in rules.ts)
export function rollChaosEvent(): ChaosEvent {
  const EVENTS: ChaosEvent[] = ['ice_age', 'shrink', 'double_trouble', 'frenzy', 'power_rain']
  return EVENTS[Math.floor(Math.random() * EVENTS.length)]
}

// Chaos application (was in rules.ts — now a simple standalone function)
export function applyChaos(state: GameState, event: ChaosEvent): GameState {
  const newState: GameState = JSON.parse(JSON.stringify(state))

  if (event === 'shrink') {
    const size = newState.board.size
    for (const c of [0, size - 1]) {
      for (let r = 0; r < size; r++) {
        const piece = Object.values(newState.board.pieces).find(p => p.row === r && p.col === c)
        if (!piece) {
          newState.board.cells[r][c].type = 'blocked'
          newState.board.cells[r][c].blockedTurns = 3
        }
      }
    }
  } else if (event === 'power_rain') {
    const size = newState.board.size
    const emptyDarkCells: { r: number; c: number }[] = []
    for (let r = 2; r < size - 2; r++) {
      for (let c = 0; c < size; c++) {
        const cell = newState.board.cells[r][c]
        if (cell.tile === 'dark' && cell.type === 'normal') {
          const piece = Object.values(newState.board.pieces).find(p => p.row === r && p.col === c)
          if (!piece) emptyDarkCells.push({ r, c })
        }
      }
    }
    for (let i = emptyDarkCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[emptyDarkCells[i], emptyDarkCells[j]] = [emptyDarkCells[j], emptyDarkCells[i]]
    }
    const POOL: PowerUpType[] = ['double_move', 'freeze', 'swap', 'bomb', 'shield', 'extra_jump']
    for (let i = 0; i < Math.min(4, emptyDarkCells.length); i++) {
      const { r, c } = emptyDarkCells[i]
      newState.board.cells[r][c].type = 'powerup'
      newState.board.cells[r][c].powerUp = POOL[Math.floor(Math.random() * POOL.length)]
    }
  }

  newState.chaosCount += 1
  newState.version += 1
  return newState
}
