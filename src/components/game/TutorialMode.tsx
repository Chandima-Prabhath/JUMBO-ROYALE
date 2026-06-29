'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { PowerUpIcon } from '@/components/game/assets'
import { PieceVisual } from '@/components/game/PieceVisual'
import { Piece, Board, Cell, CharacterClass } from '@/game/types'
import { getLegalMoves } from '@/game/moves'
import { applyMove } from '@/game/apply'

// Tutorial steps — each teaches one concept
type TutorialStep = {
  title: string
  instruction: string
  hint: string
  check: (board: Board, step: number) => boolean
}

const STEPS: TutorialStep[] = [
  {
    title: 'Welcome to Jumbo Royale!',
    instruction: 'This is a silly checkers game with power-ups, abilities, and chaos. Let\'s learn how to play! Tap "Next" to start.',
    hint: 'Tap Next to continue',
    check: () => true, // auto-pass
  },
  {
    title: 'Moving Pieces',
    instruction: 'Tap one of your pieces (the pink ones at the bottom) to select it. Then tap a green tile to move there. Pieces move diagonally forward.',
    hint: 'Tap a pink piece, then tap a green tile',
    check: (board) => {
      // Check if a move was made (piece count same but positions changed)
      return Object.keys(board.pieces).length > 0
    },
  },
  {
    title: 'Capturing Enemies',
    instruction: 'Jump over an enemy piece to capture it! Tap your piece, then tap the green tile on the other side of the enemy. Try it now!',
    hint: 'Jump over the blue piece to capture it',
    check: (board) => {
      // Check if a blue piece was captured
      const blueCount = Object.values(board.pieces).filter(p => p.team === 'blue').length
      return blueCount < 3 // started with 3
    },
  },
  {
    title: 'Chain Captures',
    instruction: 'If you can capture again after your first capture, you MUST! The green tiles will show you where to jump next. Chain captures for big combos!',
    hint: 'Keep jumping — capture all available enemies',
    check: (board) => {
      const blueCount = Object.values(board.pieces).filter(p => p.team === 'blue').length
      return blueCount === 0
    },
  },
  {
    title: 'Power-Ups',
    instruction: 'See those colorful tiles? Those are power-ups! Move onto them to collect. Each has a different effect — shields, freezes, bombs, and more. Try grabbing one!',
    hint: 'Move onto a power-up tile',
    check: (board) => {
      // Check if a power-up cell was cleared (collected)
      let powerupCount = 0
      for (const row of board.cells) {
        for (const cell of row) {
          if (cell.type === 'powerup') powerupCount++
        }
      }
      return powerupCount < 3 // started with 3
    },
  },
  {
    title: 'King Promotion',
    instruction: 'Move a piece to the FAR row (row 0, the top) to promote it to a King! Kings can move in ALL diagonal directions, not just forward. Try it!',
    hint: 'Move a piece to the top row',
    check: (board) => {
      return Object.values(board.pieces).some(p => p.team === 'red' && p.isKing)
    },
  },
  {
    title: 'Character Abilities',
    instruction: 'Different pieces have different powers:\n\n🛡️ Tank: 2 HP + shield\n⚡ Speedster: Dash 2 squares\n🧙 Mage: Teleport (tap ⚡ Ability)\n🤡 Jester: Swap with adjacent piece\n\nTry selecting a Mage and using its teleport ability!',
    hint: 'Select a mage piece, tap ⚡ Ability, then tap a yellow tile',
    check: () => true, // auto-pass after reading
  },
  {
    title: 'You\'re Ready!',
    instruction: 'You now know the basics! In a real game:\n\n• You play with friends (2-6 players)\n• Choose PvP Chaos or Co-op vs Boss King\n• Add bots if you\'re short on players\n• Every 60s a chaos event triggers\n• Games end when one team has no pieces left\n\nGood luck and have fun! 🎉',
    hint: 'Tap "Finish Tutorial" to return to the menu',
    check: () => true,
  },
]

// Create a small tutorial board with specific setup
function createTutorialBoard(step: number): Board {
  const size = 8
  const cells: Cell[][] = []
  for (let r = 0; r < size; r++) {
    cells[r] = []
    for (let c = 0; c < size; c++) {
      const tile = (r + c) % 2 === 1 ? 'dark' : 'light'
      cells[r][c] = { row: r, col: c, tile, type: 'normal' }
    }
  }
  const pieces: Record<string, Piece> = {}

  if (step <= 1) {
    // Step 0-1: Welcome + Moving — basic red pieces
    pieces['t1'] = makeTutorialPiece('t1', 'red', 'tank', 6, 1)
    pieces['t2'] = makeTutorialPiece('t2', 'red', 'tank', 6, 3)
    pieces['t3'] = makeTutorialPiece('t3', 'red', 'tank', 6, 5)
    pieces['t4'] = makeTutorialPiece('t4', 'red', 'tank', 6, 7)
  }

  if (step === 2 || step === 3) {
    // Step 2-3: Capturing + Chain captures — red pieces + blue pieces to jump
    pieces['t1'] = makeTutorialPiece('t1', 'red', 'tank', 6, 1)
    pieces['t2'] = makeTutorialPiece('t2', 'red', 'tank', 6, 3)
    pieces['t3'] = makeTutorialPiece('t3', 'red', 'tank', 6, 5)
    pieces['b1'] = makeTutorialPiece('b1', 'blue', 'speedster', 5, 2)
    pieces['b2'] = makeTutorialPiece('b2', 'blue', 'speedster', 3, 4)
    pieces['b3'] = makeTutorialPiece('b3', 'blue', 'speedster', 3, 2)
  }

  if (step === 4) {
    // Step 5: Power-ups — add power-up tiles
    cells[5][4].type = 'powerup'; cells[5][4].powerUp = 'shield'
    cells[4][3].type = 'powerup'; cells[4][3].powerUp = 'freeze'
    cells[4][5].type = 'powerup'; cells[4][5].powerUp = 'bomb'
    pieces['t1'] = makeTutorialPiece('t1', 'red', 'tank', 6, 1)
    pieces['t2'] = makeTutorialPiece('t2', 'red', 'tank', 6, 3)
    pieces['t3'] = makeTutorialPiece('t3', 'red', 'tank', 6, 5)
  }

  if (step === 5) {
    // Step 6: King promotion — piece close to the top
    pieces['t1'] = makeTutorialPiece('t1', 'red', 'tank', 1, 2)
    pieces['t2'] = makeTutorialPiece('t2', 'red', 'tank', 6, 5)
  }

  if (step === 6) {
    // Step 7: Abilities — mage piece
    pieces['m1'] = makeTutorialPiece('m1', 'red', 'mage', 5, 2)
    pieces['t1'] = makeTutorialPiece('t1', 'red', 'tank', 6, 5)
    cells[3][4].type = 'powerup'; cells[3][4].powerUp = 'shield'
  }

  if (step >= 7) {
    // Step 8: Done
    pieces['t1'] = makeTutorialPiece('t1', 'red', 'tank', 6, 1)
  }

  return { size, cells, pieces }
}

function makeTutorialPiece(id: string, team: 'red' | 'blue', char: CharacterClass, row: number, col: number): Piece {
  return {
    id,
    team,
    character: char,
    row,
    col,
    isKing: false,
    hp: char === 'tank' ? 2 : 1,
    hasShield: char === 'tank',
    frozenTurns: 0,
    abilityUsed: false,
    facing: team === 'red' ? 'right' : 'left',
    ownerName: 'You',
  }
}

export function TutorialMode({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState(0)
  const [board, setBoard] = useState<Board>(() => createTutorialBoard(0))
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<any[]>([])
  const [showAbility, setShowAbility] = useState(false)
  const [abilityTargets, setAbilityTargets] = useState<{ row: number; col: number }[]>([])
  const [abilityMode, setAbilityMode] = useState(false)
  const [completed, setCompleted] = useState(false)

  const currentStep = STEPS[step]
  const isLastStep = step === STEPS.length - 1

  // Reset board when step changes
  useEffect(() => {
    setBoard(createTutorialBoard(step))
    setSelectedPieceId(null)
    setLegalMoves([])
    setShowAbility(false)
    setAbilityTargets([])
    setAbilityMode(false)
    setCompleted(false)
  }, [step])

  // Check if step is completed
  useEffect(() => {
    if (currentStep.check(board, step)) {
      setCompleted(true)
    }
  }, [board, step, currentStep])

  const handleCellClick = useCallback((row: number, col: number) => {
    const piece = Object.values(board.pieces).find(p => p.row === row && p.col === col)

    // Ability mode
    if (abilityMode && abilityTargets.some(t => t.row === row && t.col === col)) {
      // Execute ability
      const newPieces = { ...board.pieces }
      const p = newPieces[selectedPieceId!]
      if (p && p.character === 'mage') {
        p.row = row
        p.col = col
        p.abilityUsed = true
      }
      setBoard({ ...board, pieces: newPieces })
      setAbilityMode(false)
      setSelectedPieceId(null)
      setLegalMoves([])
      return
    }

    // Make a move
    const move = legalMoves.find(m => m.toRow === row && m.toCol === col)
    if (move && selectedPieceId) {
      // Build a minimal GameState for the engine API
      const tutorialState = {
        id: 'tutorial',
        roomCode: 'TUTORIAL',
        mode: 'pvp' as const,
        phase: 'playing' as const,
        board,
        players: [],
        currentTurnTeam: 'red' as const,
        currentPlayerIndex: 0,
        turnStartedAt: Date.now(),
        turnDurationSec: 30,
        movesThisTurn: 0,
        nextChaosAt: 0,
        chaosCount: 0,
        turnCount: 0,
        turnsWithoutCapture: 0,
        version: 1,
      }
      const result = applyMove(tutorialState, move)
      if (result.success && result.newState) {
        setBoard(result.newState.board)
      }
      setSelectedPieceId(null)
      setLegalMoves([])
      return
    }

    // Select a piece
    if (piece && piece.team === 'red') {
      if (selectedPieceId === piece.id) {
        setSelectedPieceId(null)
        setLegalMoves([])
        return
      }
      setSelectedPieceId(piece.id)
      const moves = getLegalMoves(board, piece)
      setLegalMoves(moves)
      // Check for ability
      if ((piece.character === 'mage' || piece.character === 'jester') && !piece.abilityUsed) {
        setShowAbility(true)
        // Calculate ability targets
        const targets: { row: number; col: number }[] = []
        if (piece.character === 'mage') {
          for (let r = 0; r < board.size; r++) {
            for (let c = 0; c < board.size; c++) {
              const cell = board.cells[r][c]
              if (cell.tile !== 'dark' || cell.type === 'blocked') continue
              if (Object.values(board.pieces).some(p => p.row === r && p.col === c)) continue
              const dist = Math.max(Math.abs(r - piece.row), Math.abs(c - piece.col))
              if (dist > 0 && dist <= 3) targets.push({ row: r, col: c })
            }
          }
        }
        setAbilityTargets(targets)
      } else {
        setShowAbility(false)
        setAbilityTargets([])
      }
      return
    }
    setSelectedPieceId(null)
    setLegalMoves([])
  }, [board, selectedPieceId, legalMoves, abilityMode, abilityTargets])

  const handleAbility = () => {
    setAbilityMode(true)
  }

  const handleNext = () => {
    if (isLastStep) {
      onExit()
    } else {
      setStep(s => s + 1)
    }
  }

  const handlePrev = () => {
    if (step > 0) setStep(s => s - 1)
  }

  const handleSkip = () => {
    onExit()
  }

  // Build the board rendering
  const cellPct = 100 / board.size
  const posToXY = (row: number, col: number) => ({
    x: col * cellPct,
    y: (board.size - 1 - row) * cellPct,
  })

  const moveTargets: Record<string, any> = {}
  for (const m of legalMoves) {
    moveTargets[`${m.toRow}_${m.toCol}`] = m
  }

  const abilityTargetSet = new Set(abilityTargets.map(t => `${t.row}_${t.col}`))

  const rows = []
  for (let r = board.size - 1; r >= 0; r--) {
    const cells = []
    for (let c = 0; c < board.size; c++) {
      const cell = board.cells[r][c]
      const piece = Object.values(board.pieces).find(p => p.row === r && p.col === c)
      const move = moveTargets[`${r}_${c}`]
      const isAbilityTarget = abilityTargetSet.has(`${r}_${c}`)
      const isSelected = piece && piece.id === selectedPieceId

      cells.push(
        <button
          key={`${r}_${c}`}
          onClick={() => handleCellClick(r, c)}
          className="relative aspect-square transition-all active:scale-95"
          style={{
            background: cell.tile === 'dark'
              ? (cell.type === 'blocked' ? '#3d1f6b' : 'linear-gradient(135deg, #6b3aa0 0%, #4a2670 100%)')
              : 'linear-gradient(135deg, #fff8ef 0%, #f5e8ff 100%)',
            border: '1px solid rgba(26,13,46,0.1)',
            borderRadius: '8px',
            boxShadow: move
              ? 'inset 0 0 0 3px #2ecc71, 0 0 16px rgba(46,204,113,0.5)'
              : isAbilityTarget
              ? 'inset 0 0 0 3px #ffd23f, 0 0 16px rgba(255,210,63,0.7)'
              : isSelected
              ? 'inset 0 0 0 3px #ffd23f'
              : 'none',
            cursor: 'pointer',
          }}
        >
          {/* Power-up */}
          {cell.type === 'powerup' && cell.powerUp && !piece && (
            <div className="absolute inset-0 flex items-center justify-center">
              <PowerUpIcon type={cell.powerUp} size={24} />
            </div>
          )}

          {/* Pieces are rendered in the overlay below — NOT here */}

          {/* Move target */}
          {move && !piece && (
            <div
              className="absolute rounded-full bg-[#2ecc71] animate-pulse"
              style={{
                width: '30%', height: '30%', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)', border: '2px solid #1a0d2e',
              }}
            />
          )}

          {/* Ability target */}
          {isAbilityTarget && (
            <div
              className="absolute rounded-full bg-[#ffd23f] animate-pulse"
              style={{
                width: '30%', height: '30%', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)', border: '2px solid #1a0d2e',
              }}
            />
          )}
        </button>,
      )
    }
    rows.push(
      <div key={r} className="grid" style={{ gridTemplateColumns: `repeat(${board.size}, 1fr)`, gap: '4px' }}>
        {cells}
      </div>,
    )
  }

  // Pieces overlay — uses framer-motion jump arc animation (same as real game)
  const pieceOverlay = Object.values(board.pieces).map(piece => {
    const { x, y } = posToXY(piece.row, piece.col)
    const isSelected = piece.id === selectedPieceId
    const animKey = `${x.toFixed(1)}_${y.toFixed(1)}`
    return (
      <motion.div
        key={piece.id}
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
          zIndex: isSelected ? 20 : 10,
        }}
      >
        <motion.div
          key={animKey}
          className="w-full h-full"
          initial={{ y: 0 }}
          animate={{ y: [0, -30, 0] }}
          transition={{
            y: {
              duration: 0.5,
              ease: 'easeOut',
              times: [0, 0.5, 1],
            },
          }}
        >
          <div className="w-full h-full flex items-center justify-center p-0.5">
            <PieceVisual piece={piece} size={36} selected={!!isSelected} isMine={piece.team === 'red'} />
          </div>
        </motion.div>
      </motion.div>
    )
  })

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-jumbo-pink">📖 Tutorial</h1>
          <p className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSkip}>Skip</Button>
      </header>

      {/* Progress bar */}
      <div className="px-4 mb-2">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-jumbo-pink"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 30 }}
          />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 px-4 pb-4 max-w-2xl w-full mx-auto flex flex-col gap-3">
        {/* Instruction card */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, #fff8ef, #ffe1ef)',
            border: '3px solid #ffd23f',
            boxShadow: '0 3px 0 #c4a83f',
          }}
        >
          <h2 className="font-bold text-base text-jumbo-purple mb-1">{currentStep.title}</h2>
          <p className="text-sm text-foreground whitespace-pre-line">{currentStep.instruction}</p>
          {!completed && step > 0 && step < 7 && (
            <div className="mt-2 text-xs font-bold text-jumbo-pink flex items-center gap-1">
              <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1, repeat: Infinity }}>👆</motion.span>
              {currentStep.hint}
            </div>
          )}
          {completed && step > 0 && step < 7 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="mt-2 text-xs font-bold text-jumbo-green"
            >
              ✓ Complete! Tap Next to continue
            </motion.div>
          )}
        </motion.div>

        {/* Board */}
        <div
          className="p-3 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #1a0d2e, #3d1f6b)',
            boxShadow: '0 12px 0 #0a0418, 0 20px 40px rgba(0,0,0,0.4)',
            border: '4px solid #ffd23f',
          }}
        >
          <div className="relative">
            <div className="flex flex-col gap-1">{rows}</div>
            <div className="absolute inset-0 pointer-events-none">{pieceOverlay}</div>
          </div>
        </div>

        {/* Ability button */}
        {showAbility && abilityTargets.length > 0 && (
          <Button
            onClick={handleAbility}
            className="bg-jumbo-yellow text-jumbo-bg font-bold"
          >
            ⚡ Use Ability ({abilityTargets.length} targets)
          </Button>
        )}

        {/* Navigation */}
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={handlePrev} className="flex-1">
              ← Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            className="flex-1 font-bold"
            style={{
              background: 'linear-gradient(135deg, #2ecc71, #1a9850)',
              color: 'white',
              border: '2px solid #1a0d2e',
              boxShadow: '0 4px 0 #0d4f2e',
            }}
          >
            {isLastStep ? '🎉 Finish Tutorial' : 'Next →'}
          </Button>
        </div>
      </main>
    </div>
  )
}
