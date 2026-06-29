// Jumbo Royale - Board initialization & helpers
import { Board, Cell, Piece, PowerUpType, GameState, GameMode, PlayerSlot, AnyTeam, CharacterClass } from './types'
import { v4 as uuid } from 'uuid'

export const BOARD_SIZE = 8
export const POWERUP_COUNT = 6 // per game start
export const TURN_DURATION_SEC = 30
export const MAX_MOVES_PER_TURN = 1
export const CHAOS_INTERVAL_SEC = 60

// Power-up spawn pool
const POWERUP_POOL: PowerUpType[] = [
  'double_move', 'freeze', 'swap', 'bomb', 'shield', 'extra_jump',
]

export function rollPowerUp(rng: () => number = Math.random): PowerUpType {
  return POWERUP_POOL[Math.floor(rng() * POWERUP_POOL.length)]
}

export function createBoard(mode: GameMode, players: PlayerSlot[]): Board {
  const cells: Cell[][] = []
  for (let r = 0; r < BOARD_SIZE; r++) {
    cells[r] = []
    for (let c = 0; c < BOARD_SIZE; c++) {
      // In checkers, dark squares are where pieces sit. (r+c) odd = dark.
      const tile = (r + c) % 2 === 1 ? 'dark' : 'light'
      cells[r][c] = { row: r, col: c, tile, type: 'normal' }
    }
  }

  // Sprinkle power-ups on random dark cells (not on starting rows)
  const darkCells: { r: number; c: number }[] = []
  for (let r = 2; r < BOARD_SIZE - 2; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (cells[r][c].tile === 'dark') darkCells.push({ r, c })
    }
  }
  // shuffle
  for (let i = darkCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[darkCells[i], darkCells[j]] = [darkCells[j], darkCells[i]]
  }
  for (let i = 0; i < Math.min(POWERUP_COUNT, darkCells.length); i++) {
    const { r, c } = darkCells[i]
    cells[r][c].type = 'powerup'
    cells[r][c].powerUp = POWERUP_POOL[i % POWERUP_POOL.length]
  }

  const pieces: Record<string, Piece> = {}

  // Place pieces based on mode
  if (mode === 'pvp') {
    // Red at BOTTOM (rows 6-7), moves UP toward row 0
    placePiecesForTeam(cells, pieces, 'red', players.filter(p => p.team === 'red'), BOARD_SIZE - 2, BOARD_SIZE)
    // Blue at TOP (rows 0-1), moves DOWN toward row size-1
    placePiecesForTeam(cells, pieces, 'blue', players.filter(p => p.team === 'blue'), 0, 2)
  } else {
    // Co-op: humans (red) at BOTTOM, boss at TOP
    placePiecesForTeam(cells, pieces, 'red', players.filter(p => p.team === 'red'), BOARD_SIZE - 2, BOARD_SIZE)
    placeBossPieces(cells, pieces)
  }

  return { size: BOARD_SIZE, cells, pieces }
}

function placePiecesForTeam(
  cells: Cell[][],
  pieces: Record<string, Piece>,
  team: AnyTeam,
  players: PlayerSlot[],
  startRow: number,
  endRow: number, // exclusive
) {
  if (players.length === 0) return
  // Collect all dark cell slots in the row range
  const slots: { r: number; c: number }[] = []
  for (let r = startRow; r < endRow; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (cells[r][c].tile === 'dark') slots.push({ r, c })
    }
  }
  // Sort slots: back row first (so Tanks go in back), front row last (Speedsters go in front)
  // For red team (rows 6-7): row 7 is back, row 6 is front
  // For blue team (rows 0-1): row 0 is back, row 1 is front
  slots.sort((a, b) => {
    // Back row has higher row number for red, lower for blue
    const backRow = team === 'red' ? Math.max(startRow, endRow - 1) : Math.min(startRow, endRow - 1)
    const aDist = Math.abs(a.r - backRow)
    const bDist = Math.abs(b.r - backRow)
    return aDist - bDist // closer to back = first
  })

  // Build the piece composition: chess-like mix
  // Each player gets 8 pieces (or fewer if not enough slots):
  // - 2 Tanks (back row, defensive)
  // - 2 Speedsters (front row, aggressive)
  // - 2 Mages (middle)
  // - 1 Jester (wildcard)
  // - 1 of player's chosen character (makes the choice meaningful)
  const allChars: CharacterClass[] = []
  const piecesPerPlayer = Math.max(4, Math.floor(slots.length / players.length))
  for (const player of players) {
    const composition = buildComposition(piecesPerPlayer, player.character)
    allChars.push(...composition)
  }

  // Assign characters to slots (back to front)
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

// Build a chess-like composition of characters for a player.
// The player's chosen character gets 1 extra (majority).
function buildComposition(total: number, playerChoice: CharacterClass): CharacterClass[] {
  // Base composition: 2 Tank, 2 Speedster, 2 Mage, 1 Jester = 7
  // + 1 of player's choice = 8 total
  const base: CharacterClass[] = ['tank', 'tank', 'speedster', 'speedster', 'mage', 'mage', 'jester']
  const composition = [...base, playerChoice]
  // If total < 8, trim from the end
  if (total < composition.length) {
    return composition.slice(0, total)
  }
  // If total > 8, add more of player's choice
  while (composition.length < total) {
    composition.push(playerChoice)
  }
  return composition
}

function placeBossPieces(cells: Cell[][], pieces: Record<string, Piece>) {
  // Boss King at TOP (row 0), middle col
  const bossRow = 0
  const bossCol = Math.floor(BOARD_SIZE / 2) - 1
  // ensure dark
  let col = bossCol
  if (cells[bossRow][col].tile !== 'dark') col = bossCol + 1
  const bossId = 'boss_king'
  pieces[bossId] = {
    id: bossId,
    team: 'boss',
    character: 'tank', // visually imposing
    row: bossRow,
    col,
    isKing: true,
    hp: 12,
    hasShield: false,
    frozenTurns: 0,
    abilityUsed: false,
    facing: 'left',
    ownerName: 'BOSS KING',
  }
  // Minions: 4 regular pieces in rows 1-2
  const minionSlots: { r: number; c: number }[] = []
  for (let r = 1; r <= 2; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (cells[r][c].tile === 'dark') minionSlots.push({ r, c })
    }
  }
  for (let i = 0; i < Math.min(4, minionSlots.length); i++) {
    const { r, c } = minionSlots[i * 2 % minionSlots.length]
    const id = `m_${uuid().slice(0, 8)}`
    pieces[id] = {
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
      ownerName: 'Minion',
    }
  }
}

function makePiece(
  id: string,
  team: AnyTeam,
  character: CharacterClass,
  row: number,
  col: number,
  ownerName: string,
  avatar?: string,
): Piece {
  return {
    id,
    team,
    character,
    row,
    col,
    isKing: false,
    hp: character === 'tank' ? 2 : 1,
    hasShield: character === 'tank', // tank starts with shield
    frozenTurns: 0,
    abilityUsed: false,
    facing: team === 'red' ? 'right' : 'left',
    ownerName,
    ownerAvatar: avatar,
  }
}

export function getPieceAt(board: Board, row: number, col: number): Piece | undefined {
  return Object.values(board.pieces).find(p => p.row === row && p.col === col)
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}

export function getCell(board: Board, row: number, col: number): Cell | undefined {
  if (!inBounds(row, col)) return undefined
  return board.cells[row][col]
}
