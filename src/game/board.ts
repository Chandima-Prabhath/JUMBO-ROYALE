// ===========================================================================
// Jumbo Royale — Board Module
// Pure functions for board creation, cell queries, and piece placement.
// No game logic here — just board structure and helpers.
// ===========================================================================

import { Board, Cell, Piece, PlayerSlot, AnyTeam, CharacterClass, PowerUpType } from './types'
import { v4 as uuid } from 'uuid'

export const BOARD_SIZE = 8
export const POWERUP_COUNT = 6

const POWERUP_POOL: PowerUpType[] = [
  'double_move', 'freeze', 'swap', 'bomb', 'shield', 'extra_jump',
]

// ===========================================================================
// Board creation
// ===========================================================================

export function createBoard(mode: 'pvp' | 'coop', players: PlayerSlot[]): Board {
  const cells: Cell[][] = []
  for (let r = 0; r < BOARD_SIZE; r++) {
    cells[r] = []
    for (let c = 0; c < BOARD_SIZE; c++) {
      // Dark squares: (r+c) odd — this is where pieces sit
      const tile: 'dark' | 'light' = (r + c) % 2 === 1 ? 'dark' : 'light'
      cells[r][c] = { row: r, col: c, tile, type: 'normal' as const }
    }
  }

  // Sprinkle power-ups on random dark cells in middle rows (2-5)
  const darkCells: { r: number; c: number }[] = []
  for (let r = 2; r < BOARD_SIZE - 2; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (cells[r][c].tile === 'dark') darkCells.push({ r, c })
    }
  }
  // Shuffle
  for (let i = darkCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[darkCells[i], darkCells[j]] = [darkCells[j], darkCells[i]]
  }
  for (let i = 0; i < Math.min(POWERUP_COUNT, darkCells.length); i++) {
    const { r, c } = darkCells[i]
    cells[r][c].type = 'powerup'
    cells[r][c].powerUp = POWERUP_POOL[i % POWERUP_POOL.length]
  }

  // Place pieces
  const pieces: Record<string, Piece> = {}
  if (mode === 'pvp') {
    // Red at bottom (rows 6-7), moves toward row 0
    placeTeamPieces(cells, pieces, 'red', players.filter(p => p.team === 'red'), BOARD_SIZE - 2, BOARD_SIZE)
    // Blue at top (rows 0-1), moves toward row 7
    placeTeamPieces(cells, pieces, 'blue', players.filter(p => p.team === 'blue'), 0, 2)
  } else {
    // Co-op: humans at bottom, boss at top
    placeTeamPieces(cells, pieces, 'red', players.filter(p => p.team === 'red'), BOARD_SIZE - 2, BOARD_SIZE)
    placeBossPieces(cells, pieces)
  }

  return { size: BOARD_SIZE, cells, pieces }
}

// ===========================================================================
// Piece placement — chess-like mixed composition
// ===========================================================================

function placeTeamPieces(
  cells: Cell[][],
  pieces: Record<string, Piece>,
  team: AnyTeam,
  players: PlayerSlot[],
  startRow: number,
  endRow: number,
) {
  if (players.length === 0) return

  // Collect dark cell slots, sorted back-to-front
  const slots: { r: number; c: number }[] = []
  for (let r = startRow; r < endRow; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (cells[r][c].tile === 'dark') slots.push({ r, c })
    }
  }
  // Sort: back row first (Tanks go in back, Speedsters in front)
  const backRow = team === 'red' ? Math.max(startRow, endRow - 1) : Math.min(startRow, endRow - 1)
  slots.sort((a, b) => Math.abs(a.r - backRow) - Math.abs(b.r - backRow))

  // Build composition: 2 Tank + 2 Speedster + 2 Mage + 1 Jester + 1 player's choice
  const piecesPerPlayer = Math.max(4, Math.floor(slots.length / players.length))
  const allChars: CharacterClass[] = []
  for (const player of players) {
    allChars.push(...buildComposition(piecesPerPlayer, player.character))
  }

  // Assign characters to slots
  let slotIdx = 0
  let playerIdx = 0
  let pieceInPlayer = 0
  for (let i = 0; i < allChars.length && slotIdx < slots.length; i++) {
    const char = allChars[i]
    const player = players[playerIdx]
    const { r, c } = slots[slotIdx++]
    const id = `p_${uuid().slice(0, 8)}`
    pieces[id] = makePiece(id, team, char, r, c, player.name, player.avatar)
    pieceInPlayer++
    if (pieceInPlayer >= piecesPerPlayer) {
      playerIdx++
      pieceInPlayer = 0
    }
  }
}

function buildComposition(total: number, playerChoice: CharacterClass): CharacterClass[] {
  // Chess-like: 2 Tank, 2 Speedster, 2 Mage, 1 Jester + 1 player's choice = 8
  const base: CharacterClass[] = ['tank', 'tank', 'speedster', 'speedster', 'mage', 'mage', 'jester']
  const composition = [...base, playerChoice]
  if (total < composition.length) return composition.slice(0, total)
  while (composition.length < total) composition.push(playerChoice)
  return composition
}

function placeBossPieces(cells: Cell[][], pieces: Record<string, Piece>) {
  // Boss King at top (row 0)
  const bossRow = 0
  let bossCol = Math.floor(BOARD_SIZE / 2) - 1
  if (cells[bossRow][bossCol].tile !== 'dark') bossCol++
  const bossId = 'boss_king'
  pieces[bossId] = makePiece(bossId, 'boss', 'tank', bossRow, bossCol, 'BOSS KING')
  pieces[bossId].isKing = true
  pieces[bossId].hp = 12

  // 4 minions in rows 1-2
  const minionSlots: { r: number; c: number }[] = []
  for (let r = 1; r <= 2; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (cells[r][c].tile === 'dark') minionSlots.push({ r, c })
    }
  }
  for (let i = 0; i < Math.min(4, minionSlots.length); i++) {
    const { r, c } = minionSlots[i * 2 % minionSlots.length]
    const id = `m_${uuid().slice(0, 8)}`
    pieces[id] = makePiece(id, 'boss', 'speedster', r, c, 'Minion')
  }
}

function makePiece(
  id: string,
  team: AnyTeam,
  character: CharacterClass,
  row: number,
  col: number,
  ownerName: string,
  ownerAvatar?: string,
): Piece {
  return {
    id,
    team,
    character,
    row,
    col,
    isKing: false,
    hp: character === 'tank' ? 2 : 1,
    hasShield: character === 'tank',
    frozenTurns: 0,
    abilityUsed: false,
    ownerName,
    ownerAvatar,
  }
}

// ===========================================================================
// Board queries — pure functions
// ===========================================================================

export function getPieceAt(board: Board, row: number, col: number): Piece | undefined {
  return Object.values(board.pieces).find(p => p.row === row && p.col === col)
}

export function getCell(board: Board, row: number, col: number): Cell | undefined {
  if (!inBounds(board, row, col)) return undefined
  return board.cells[row][col]
}

export function inBounds(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.size && col >= 0 && col < board.size
}

export function getTeamPieces(board: Board, team: AnyTeam): Piece[] {
  return Object.values(board.pieces).filter(p => p.team === team)
}

export function getAlivePieceCount(board: Board, team: AnyTeam): number {
  return Object.values(board.pieces).filter(p => p.team === team).length
}

export function rollPowerUp(): PowerUpType {
  return POWERUP_POOL[Math.floor(Math.random() * POWERUP_POOL.length)]
}
