'use client'
import { useJumbo } from '@/stores/jumbo'
import { PieceVisual } from './PieceVisual'
import { Piece, Move, PowerUpType } from '@/game/types'
import { useMemo } from 'react'

const POWERUP_EMOJI: Record<PowerUpType, string> = {
  double_move: '⚡',
  freeze: '🧊',
  swap: '🌀',
  bomb: '💣',
  shield: '🛡️',
  extra_jump: '🔁',
}

const POWERUP_LABEL: Record<PowerUpType, string> = {
  double_move: 'Double Move',
  freeze: 'Freeze',
  swap: 'Swap',
  bomb: 'Bomb',
  shield: 'Shield',
  extra_jump: 'Extra Jump',
}

export function GameBoard({ abilityMode }: { abilityMode: { pieceId: string; targets: { row: number; col: number }[] } | null }) {
  const { state, selectedPieceId, legalMoves, selectPiece, requestMoves, makeMove, useAbility: triggerAbility, myPlayerId } = useJumbo()

  const board = state?.board
  const size = board?.size ?? 8
  const pieces = board?.pieces ?? {}

  // Build piece map for fast lookup
  const pieceByPos = useMemo(() => {
    const map: Record<string, Piece> = {}
    for (const p of Object.values(pieces)) {
      map[`${p.row}_${p.col}`] = p
    }
    return map
  }, [pieces])

  const moveTargets = useMemo(() => {
    const set: Record<string, Move> = {}
    for (const m of legalMoves) {
      set[`${m.toRow}_${m.toCol}`] = m
    }
    return set
  }, [legalMoves])

  const abilityTargetSet = useMemo(() => {
    if (!abilityMode) return new Set<string>()
    return new Set(abilityMode.targets.map(t => `${t.row}_${t.col}`))
  }, [abilityMode])

  if (!state || !board) return null

  // Current player's pieces (which can be selected)
  const mySlot = state.players.find(p => p.id === myPlayerId)
  const myTeam = mySlot?.team
  const isMyTurn = state.mode === 'pvp'
    ? state.players[state.currentPlayerIndex]?.id === myPlayerId
    : state.currentTurnTeam === 'red' && myTeam === 'red'

  const handleCellClick = (row: number, col: number) => {
    const piece = pieceByPos[`${row}_${col}`]

    // Ability mode: pick target
    if (abilityMode && abilityTargetSet.has(`${row}_${col}`)) {
      triggerAbility(abilityMode.pieceId, row, col)
      return
    }

    // Click on legal move target → make move
    const move = moveTargets[`${row}_${col}`]
    if (move && selectedPieceId) {
      makeMove(move)
      return
    }

    // Otherwise, select a piece (only your own pieces, only on your turn)
    if (piece) {
      // Ignore clicks on opponent pieces entirely (better UX)
      const isMyPiece = piece.team === myTeam
      const isMyTurn = state.mode === 'pvp'
        ? state.players[state.currentPlayerIndex]?.id === myPlayerId
        : state.currentTurnTeam === 'red' && myTeam === 'red'
      if (!isMyPiece || !isMyTurn) {
        // Just deselect
        selectPiece(null)
        return
      }
      if (selectedPieceId === piece.id) {
        selectPiece(null)
        return
      }
      selectPiece(piece.id)
      requestMoves(piece.id)
      return
    }
    // Empty non-target click: deselect
    selectPiece(null)
  }

  // Build cells: rows are 0..size-1 from top
  // We want red (humans in co-op) at the bottom of the screen, so we render top-to-bottom = row 0 → row size-1
  // In co-op: row 0 = where red heads (goal). In pvp: red at bottom, blue at top? Let's flip so red is at bottom.
  // board.cells[0] is row 0. We render row 0 at top.
  // For PvP, blue starts at top (rows 0-1), red at bottom (rows size-2 to size-1). This is fine.
  // For co-op, red starts at bottom (rows 0-1)? Actually I placed red at rows 0-2. Let's flip the visual so red is at bottom.

  const rows = []
  // Render in reverse so red (row 0) appears at bottom
  for (let r = size - 1; r >= 0; r--) {
    const cells = []
    for (let c = 0; c < size; c++) {
      const cell = board.cells[r][c]
      const piece = pieceByPos[`${r}_${c}`]
      const move = moveTargets[`${r}_${c}`]
      const isAbilityTarget = abilityTargetSet.has(`${r}_${c}`)
      const isSelected = piece && piece.id === selectedPieceId

      const isMyPiece = piece && myTeam && piece.team === myTeam
      const canSelect = isMyPiece && state.phase === 'playing'

      // Highlight current player's pieces subtly
      const isCurrentTurn = piece && piece.team === state.currentTurnTeam

      cells.push(
        <button
          key={`${r}_${c}`}
          onClick={() => handleCellClick(r, c)}
          className="relative aspect-square rounded-lg transition-all active:scale-95"
          style={{
            background: cell.tile === 'dark'
              ? (cell.type === 'blocked' ? '#3d1f6b' : '#6b3aa0')
              : '#fff8ef',
            border: cell.type === 'blocked' ? '2px dashed #ff5252' : '2px solid rgba(26,13,46,0.15)',
            boxShadow: move
              ? 'inset 0 0 0 3px #2ecc71, 0 0 12px rgba(46,204,113,0.5)'
              : isAbilityTarget
              ? 'inset 0 0 0 3px #ffd23f, 0 0 12px rgba(255,210,63,0.7)'
              : isSelected
              ? 'inset 0 0 0 3px #ffd23f'
              : 'none',
            cursor: canSelect || move || isAbilityTarget ? 'pointer' : 'default',
          }}
        >
          {/* Power-up on cell */}
          {cell.type === 'powerup' && cell.powerUp && !piece && (
            <div
              className="absolute inset-0 flex items-center justify-center animate-float"
              style={{ fontSize: 'clamp(20px, 4vw, 32px)' }}
              title={POWERUP_LABEL[cell.powerUp]}
            >
              <span
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
                }}
              >
                {POWERUP_EMOJI[cell.powerUp]}
              </span>
            </div>
          )}
          {/* Blocked countdown */}
          {cell.type === 'blocked' && cell.blockedTurns !== undefined && (
            <div
              className="absolute inset-0 flex items-center justify-center text-white font-bold"
              style={{ fontSize: '14px' }}
            >
              {cell.blockedTurns}
            </div>
          )}
          {/* Piece */}
          {piece && (
            <div className="absolute inset-0 flex items-center justify-center p-0.5">
              <PieceVisual
                piece={piece}
                size={Math.min(40, 38)}
                selected={!!isSelected}
                highlight={!!move && piece.team !== myTeam}
                isMyTurn={isMyTurn}
                isMine={piece.team === myTeam}
              />
            </div>
          )}
          {/* Move target dot */}
          {move && !piece && (
            <div
              className="absolute rounded-full bg-[#2ecc71] animate-pulse"
              style={{
                width: '30%',
                height: '30%',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                border: '2px solid #1a0d2e',
              }}
            />
          )}
          {/* Ability target dot */}
          {isAbilityTarget && (
            <div
              className="absolute rounded-full bg-[#ffd23f] animate-pulse"
              style={{
                width: '30%',
                height: '30%',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                border: '2px solid #1a0d2e',
              }}
            />
          )}
        </button>,
      )
    }
    rows.push(
      <div key={r} className="grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gap: '4px' }}>
        {cells}
      </div>,
    )
  }

  return (
    <div
      className="p-3 rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, #1a0d2e, #3d1f6b)',
        boxShadow: '0 12px 0 rgba(26,13,46,0.3), 0 20px 40px rgba(0,0,0,0.3)',
        border: '4px solid #ffd23f',
      }}
    >
      <div className="flex flex-col gap-1">{rows}</div>
    </div>
  )
}
