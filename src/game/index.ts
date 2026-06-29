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
export { nextTurn, shouldSkipTurn, getCurrentPlayer, isPlayerTurn, isBotTurn, TURN_DURATION_SEC, CHAOS_INTERVAL_SEC, MAX_MOVES_PER_TURN } from './turn'
export { pickBestMove, shouldUseAbility } from './ai'
export { pickBossMove, bossSummon } from './boss'

// Chaos helpers (used by server)
export function rollChaosEvent(): import('./types').ChaosEvent {
  const EVENTS: import('./types').ChaosEvent[] = ['ice_age', 'shrink', 'double_trouble', 'frenzy', 'power_rain']
  return EVENTS[Math.floor(Math.random() * EVENTS.length)]
}

export function applyChaos(state: import('./types').GameState, event: import('./types').ChaosEvent): import('./types').GameState {
  const newState: import('./types').GameState = JSON.parse(JSON.stringify(state))
  if (event === 'shrink') {
    const size = newState.board.size
    for (const c of [0, size - 1]) {
      for (let r = 0; r < size; r++) {
        const piece = Object.values(newState.board.pieces).find(p => p.row === r && p.col === c)
        if (!piece) { newState.board.cells[r][c].type = 'blocked'; newState.board.cells[r][c].blockedTurns = 3 }
      }
    }
  } else if (event === 'power_rain') {
    const size = newState.board.size
    const empty: { r: number; c: number }[] = []
    for (let r = 2; r < size - 2; r++) {
      for (let c = 0; c < size; c++) {
        const cell = newState.board.cells[r][c]
        if (cell.tile === 'dark' && cell.type === 'normal' && !Object.values(newState.board.pieces).find(p => p.row === r && p.col === c)) {
          empty.push({ r, c })
        }
      }
    }
    for (let i = empty.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [empty[i], empty[j]] = [empty[j], empty[i]] }
    const POOL: import('./types').PowerUpType[] = ['double_move', 'freeze', 'swap', 'bomb', 'shield', 'extra_jump']
    for (let i = 0; i < Math.min(4, empty.length); i++) {
      const { r, c } = empty[i]
      newState.board.cells[r][c].type = 'powerup'
      newState.board.cells[r][c].powerUp = POOL[Math.floor(Math.random() * POOL.length)]
    }
  }
  newState.chaosCount += 1
  newState.version += 1
  return newState
}
