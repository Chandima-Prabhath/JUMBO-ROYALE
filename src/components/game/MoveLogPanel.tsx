'use client'
import { useJumbo } from '@/stores/jumbo'
import { motion, AnimatePresence } from 'framer-motion'
import { AnimalAvatar } from './assets'
import { useState, useEffect, useRef } from 'react'

// =========================================================================
// Move Log Panel — shows recent moves with explanations
// Especially useful for understanding bot/AI decisions
// =========================================================================
export function MoveLogPanel() {
  const { moveLog, state, botThinking } = useJumbo()
  const [expanded, setExpanded] = useState(true)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new moves arrive
  useEffect(() => {
    if (logEndRef.current && expanded) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [moveLog, expanded])

  const recentMoves = moveLog.slice(-8)

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'linear-gradient(135deg, #fff8ef, #ffe1ef)',
        border: '2px solid #ff4fa3',
        boxShadow: '0 3px 0 #c43678',
      }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-bold text-jumbo-pink hover:bg-white/30 transition-colors"
      >
        <span className="flex items-center gap-2">📜 Move Log</span>
        <motion.span animate={{ rotate: expanded ? 90 : 0 }}>▶</motion.span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 max-h-[240px] overflow-y-auto space-y-1">
              {/* Bot thinking indicator */}
              <AnimatePresence>
                {botThinking && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-2 p-2 rounded-lg bg-purple-100 border border-purple-300"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="text-sm"
                    >
                      ⚙️
                    </motion.div>
                    <span className="text-xs font-bold text-purple-700">
                      {botThinking.playerName} is thinking...
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {recentMoves.length === 0 && !botThinking && (
                <div className="text-xs text-muted-foreground italic text-center py-2">
                  No moves yet. Waiting for first move...
                </div>
              )}
              <AnimatePresence initial={false}>
                {recentMoves.map((m, i) => {
                  const player = state?.players.find(p => p.name === m.playerName)
                  const isLatest = i === recentMoves.length - 1
                  const teamColor = m.team === 'red' ? '#ff4fa3' : m.team === 'blue' ? '#4f7bff' : '#9b59b6'
                  const kindLabel = m.kind === 'multi_capture' ? 'CHAIN CAPTURE' : m.kind === 'capture' ? 'CAPTURE' : m.abilityUsed ? 'ABILITY' : 'MOVE'
                  const kindColor = m.capturedCount > 0 ? '#ff5252' : m.abilityUsed ? '#9b59b6' : '#2ecc71'

                  return (
                    <motion.div
                      key={m.id}
                      layout
                      initial={{ opacity: 0, x: -15, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 15 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className={`p-2 rounded-lg ${isLatest ? 'bg-white shadow-sm' : 'bg-white/50'}`}
                      style={{ borderLeft: `3px solid ${teamColor}` }}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {player?.avatar && <AnimalAvatar kind={player.avatar} size={18} />}
                        <span className="text-xs font-bold truncate" style={{ color: teamColor }}>
                          {m.playerName}
                        </span>
                        {player?.isBot && <span className="text-[9px]">🤖</span>}
                        <span
                          className="text-[9px] font-bold px-1 rounded ml-auto"
                          style={{ background: kindColor, color: 'white' }}
                        >
                          {kindLabel}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {positionLabel(m.fromRow, m.fromCol)} → {positionLabel(m.toRow, m.toCol)}
                        {m.capturedCount > 0 && (
                          <span className="text-jumbo-red font-bold ml-1">
                            · captured {m.capturedCount}
                          </span>
                        )}
                      </div>
                      {/* AI reason (only for bots) */}
                      {m.reason && (
                        <div className="text-[10px] text-jumbo-purple italic mt-0.5">
                          💭 {m.reason}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
              <div ref={logEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Convert (row, col) to chess-like notation (A1, B2, etc.)
function positionLabel(row: number, col: number): string {
  const colLabel = String.fromCharCode(65 + col) // A, B, C...
  const rowLabel = 8 - row // 8, 7, 6... (flip so row 0 = rank 8)
  return `${colLabel}${rowLabel}`
}
