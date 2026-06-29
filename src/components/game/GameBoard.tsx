'use client'
import { useJumbo } from '@/stores/jumbo'
import { PieceVisual } from './PieceVisual'
import { PowerUpIcon } from './assets'
import { Piece, Move, PowerUpType } from '@/game/types'
import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function GameBoard({ abilityMode }: { abilityMode: { pieceId: string; targets: { row: number; col: number }[] } | null }) {
  const { state, selectedPieceId, legalMoves, selectPiece, requestMoves, makeMove, useAbility: triggerAbility, myPlayerId, lastMove } = useJumbo()

  const board = state?.board
  const size = board?.size ?? 8
  const pieces = board?.pieces ?? {}

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

  // Compute turn state early (before effects that depend on it)
  const mySlot = state?.players.find(p => p.id === myPlayerId)
  const myTeam = mySlot?.team
  const isMyTurn = state
    ? state.mode === 'pvp'
      ? state.players[state.currentPlayerIndex]?.id === myPlayerId
      : state.currentTurnTeam === 'red' && myTeam === 'red' && state.players[state.currentPlayerIndex]?.id === myPlayerId
    : false

  if (!state || !board) return null

  const handleCellClick = (row: number, col: number) => {
    const piece = pieceByPos[`${row}_${col}`]

    if (abilityMode && abilityTargetSet.has(`${row}_${col}`)) {
      triggerAbility(abilityMode.pieceId, row, col)
      return
    }

    const move = moveTargets[`${row}_${col}`]
    if (move && selectedPieceId) {
      makeMove(move)
      return
    }

    if (piece) {
      const isMyPiece = piece.team === myTeam
      const canSelectNow = state.mode === 'pvp'
        ? state.players[state.currentPlayerIndex]?.id === myPlayerId
        : state.currentTurnTeam === 'red' && myTeam === 'red' && state.players[state.currentPlayerIndex]?.id === myPlayerId
      if (!isMyPiece || !canSelectNow) {
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
    selectPiece(null)
  }

  // Cell percentage: each cell is 100/size % of the board
  const cellPct = 100 / size
  // Convert (row, col) to (x%, y%) — render in reverse so row 0 is at bottom
  const posToXY = (row: number, col: number) => ({
    x: col * cellPct,
    y: (size - 1 - row) * cellPct, // flip so row 0 is at bottom
  })

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
      const isLastMoveFrom = lastMove && lastMove.fromRow === r && lastMove.fromCol === c
      const isLastMoveTo = lastMove && lastMove.toRow === r && lastMove.toCol === c

      const isMyPiece = piece && myTeam && piece.team === myTeam
      const canSelect = isMyPiece && state.phase === 'playing'

      cells.push(
        <button
          key={`${r}_${c}`}
          onClick={() => handleCellClick(r, c)}
          className="relative aspect-square transition-all active:scale-95"
          style={{
            background: cell.tile === 'dark'
              ? (cell.type === 'blocked'
                ? 'repeating-linear-gradient(45deg, #3d1f6b 0 6px, #2a1450 6px 12px)'
                : 'linear-gradient(135deg, #6b3aa0 0%, #4a2670 100%)')
              : 'linear-gradient(135deg, #fff8ef 0%, #f5e8ff 100%)',
            border: cell.type === 'blocked' ? '2px solid #ff5252' : '1px solid rgba(26,13,46,0.1)',
            borderRadius: '8px',
            boxShadow: move
              ? 'inset 0 0 0 3px #2ecc71, 0 0 16px rgba(46,204,113,0.5)'
              : isAbilityTarget
              ? 'inset 0 0 0 3px #ffd23f, 0 0 16px rgba(255,210,63,0.7)'
              : isSelected
              ? 'inset 0 0 0 3px #ffd23f'
              : isLastMoveFrom
              ? 'inset 0 0 0 3px rgba(79, 123, 255, 0.5)'
              : isLastMoveTo
              ? 'inset 0 0 0 3px rgba(255, 210, 63, 0.7), 0 0 12px rgba(255,210,63,0.4)'
              : cell.tile === 'dark'
              ? 'inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.2)'
              : 'inset 0 2px 0 rgba(255,255,255,0.6)',
            cursor: canSelect || move || isAbilityTarget ? 'pointer' : 'default',
          }}
        >
          {/* Subtle inner texture on dark cells */}
          {cell.tile === 'dark' && cell.type !== 'blocked' && (
            <div
              className="absolute inset-0 rounded-lg opacity-30"
              style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15), transparent 60%)',
              }}
            />
          )}

          {/* Power-up */}
          {cell.type === 'powerup' && cell.powerUp && !piece && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>
                <PowerUpIcon type={cell.powerUp} size={Math.floor(60 * 0.55)} />
              </div>
            </motion.div>
          )}

          {/* Blocked countdown */}
          {cell.type === 'blocked' && cell.blockedTurns !== undefined && (
            <div
              className="absolute inset-0 flex items-center justify-center text-white font-bold"
              style={{ fontSize: '14px', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
            >
              {cell.blockedTurns}
            </div>
          )}

          {/* Move target */}
          <AnimatePresence>
            {move && !piece && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute"
                style={{
                  width: '34%',
                  height: '34%',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <motion.div
                  className="w-full h-full rounded-full"
                  style={{
                    background: 'radial-gradient(circle, #2ecc71, #1a9850)',
                    border: '2px solid #1a0d2e',
                    boxShadow: '0 0 12px rgba(46,204,113,0.8)',
                  }}
                  animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ability target */}
          <AnimatePresence>
            {isAbilityTarget && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute"
                style={{
                  width: '34%',
                  height: '34%',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <motion.div
                  className="w-full h-full rounded-full"
                  style={{
                    background: 'radial-gradient(circle, #ffd23f, #e6b800)',
                    border: '2px solid #1a0d2e',
                    boxShadow: '0 0 12px rgba(255,210,63,0.8)',
                  }}
                  animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Capture-move indicator */}
          {move && piece && piece.team !== myTeam && (
            <motion.div
              className="absolute inset-1 rounded-lg pointer-events-none"
              style={{ border: '3px dashed #ff5252' }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity }}
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

  // Build the pieces overlay — each piece is absolutely positioned by percentage
  // and animated with framer-motion when its position changes.
  // Uses a jump arc: piece lifts up, moves horizontally, lands — like chess pieces.
  const pieceOverlay = Object.values(pieces).map(piece => {
    const { x, y } = posToXY(piece.row, piece.col)
    const isSelected = piece.id === selectedPieceId
    const move = moveTargets[`${piece.row}_${piece.col}`]
    return (
      <JumpingPiece
        key={piece.id}
        pieceId={piece.id}
        x={x}
        y={y}
        cellPct={cellPct}
        isSelected={isSelected}
        zIndex={isSelected ? 20 : 10}
      >
        <div className="w-full h-full flex items-center justify-center p-0.5">
          <PieceVisual
            piece={piece}
            size={Math.min(40, 38)}
            selected={!!isSelected}
            highlight={!!move && piece.team !== myTeam}
            isMyTurn={isMyTurn}
            isMine={piece.team === myTeam}
          />
        </div>
      </JumpingPiece>
    )
  })

  return (
    <div className="relative">
      {/* Board frame with depth */}
      <div
        className="p-3 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, #1a0d2e 0%, #3d1f6b 50%, #1a0d2e 100%)',
          boxShadow: '0 12px 0 #0a0418, 0 20px 40px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.1)',
          border: '4px solid #ffd23f',
        }}
      >
        {/* Decorative corners */}
        <div className="absolute top-1 left-1 w-3 h-3 rounded-full bg-jumbo-yellow opacity-60" />
        <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-jumbo-yellow opacity-60" />
        <div className="absolute bottom-1 left-1 w-3 h-3 rounded-full bg-jumbo-yellow opacity-60" />
        <div className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-jumbo-yellow opacity-60" />

        <div className="relative">
          {/* Grid background (cells without pieces) */}
          <div className="flex flex-col gap-1">{rows}</div>

          {/* Pieces overlay — absolutely positioned, animated */}
          <div className="absolute inset-0 pointer-events-none">
            {pieceOverlay}
          </div>
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// JumpingPiece — animates a piece moving from old position to new position
// with a parabolic jump arc (lifts up, moves horizontally, lands).
// Like a chess piece being picked up and placed down.
// =========================================================================
function JumpingPiece({
  pieceId,
  x,
  y,
  cellPct,
  isSelected,
  zIndex,
  children,
}: {
  pieceId: string
  x: number
  y: number
  cellPct: number
  isSelected: boolean
  zIndex: number
  children: React.ReactNode
}) {
  // Fixed jump height — avoids needing to track previous position
  const jumpHeight = 30 // pixels

  // Use a key that changes when position changes — this forces the inner
  // motion.div to re-mount and replay its jump animation
  const animKey = `${x.toFixed(1)}_${y.toFixed(1)}`

  return (
    <motion.div
      key={pieceId}
      initial={false}
      animate={{
        left: `${x}%`,
        top: `${y}%`,
      }}
      transition={{
        left: { type: 'tween', duration: 0.5, ease: 'easeInOut' },
        top: { type: 'tween', duration: 0.5, ease: 'easeInOut' },
      }}
      className="absolute pointer-events-none"
      style={{
        width: `${cellPct}%`,
        height: `${cellPct}%`,
        zIndex,
      }}
    >
      {/* Inner div that does the jump arc — re-mounts when position changes */}
      <motion.div
        key={animKey}
        className="w-full h-full"
        initial={{ y: 0 }}
        animate={{
          y: [0, -jumpHeight, 0],
        }}
        transition={{
          y: {
            duration: 0.5,
            ease: 'easeOut',
            times: [0, 0.5, 1],
          },
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
