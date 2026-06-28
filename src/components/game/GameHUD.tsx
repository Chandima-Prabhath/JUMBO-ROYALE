'use client'
import { useJumbo } from '@/stores/jumbo'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { canUseAbility, getAbilityTargets } from '@/game/engine'
import { PieceVisual } from './PieceVisual'
import { AnimalAvatar, Sparkle } from './assets'
import { Tooltip } from './Tooltip'
import { PowerUpLegend, CharacterCodex, CHARACTER_INFO, POWERUP_INFO } from './Codex'
import { Piece, ChaosEvent } from '@/game/types'

const EMOJI_WHEEL = ['😂', '🔥', '💀', '🎉', '👏', '😭', '🤔', '👀', '❤️', '🤯', '🥳', '😤']

const CHAOS_INFO: Record<ChaosEvent, { label: string; desc: string; emoji: string }> = {
  gravity_flip: { label: 'GRAVITY FLIP', desc: 'Board flipped upside down!', emoji: '🌀' },
  ice_age: { label: 'ICE AGE', desc: 'Everything is slippery!', emoji: '🧊' },
  shrink: { label: 'SHRINK', desc: 'Outer ring blocked!', emoji: '📦' },
  double_trouble: { label: 'DOUBLE TROUBLE', desc: 'Captures count double!', emoji: '💥' },
  frenzy: { label: 'FRENZY', desc: 'Everyone moves twice!', emoji: '⚡' },
}

function formatTime(ms: number) {
  return `${Math.max(0, Math.ceil(ms / 1000))}`
}

export function GameHUD({ onAbilityModeChange }: { onAbilityModeChange: (mode: { pieceId: string; targets: { row: number; col: number }[] } | null) => void }) {
  const { state, myPlayerId, selectedPieceId, legalMoves, useAbility, sendEmote, lastEmotes, pendingChaos, bonusMove, botThinking } = useJumbo()
  const [emoteOpen, setEmoteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [abilityMode, setAbilityMode] = useState<{ pieceId: string; targets: { row: number; col: number }[] } | null>(null)
  const prevTurnKeyRef = useRef<string>('')
  const [turnPulse, setTurnPulse] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    onAbilityModeChange(abilityMode)
  }, [abilityMode, onAbilityModeChange])

  // Clear ability mode when selected piece is cleared or changes
  useEffect(() => {
    if (!selectedPieceId) {
      setAbilityMode(null)
    } else if (abilityMode && abilityMode.pieceId !== selectedPieceId) {
      setAbilityMode(null)
    }
  }, [selectedPieceId])

  // Clear ability mode when turn changes (no longer your turn)
  useEffect(() => {
    if (!isMyTurn && abilityMode) {
      setAbilityMode(null)
    }
  }, [isMyTurn])

  // Detect turn change to trigger a pulse animation
  useEffect(() => {
    if (!state) return
    const key = `${state.currentTurnTeam}-${state.currentPlayerIndex}`
    if (key !== prevTurnKeyRef.current) {
      prevTurnKeyRef.current = key
      setTurnPulse(p => p + 1)
    }
  }, [state?.currentTurnTeam, state?.currentPlayerIndex])

  if (!state) return null

  const mySlot = state.players.find(p => p.id === myPlayerId)
  const isMyTurn = state.players[state.currentPlayerIndex]?.id === myPlayerId && state.currentTurnTeam === mySlot?.team
  const selectedPiece = selectedPieceId ? state.board.pieces[selectedPieceId] : null
  const canUseSelectedAbility = selectedPiece && canUseAbility(selectedPiece) && isMyTurn && selectedPiece.team === mySlot?.team
  const abilityTargets = canUseSelectedAbility ? getAbilityTargets(state.board, selectedPiece) : []

  const handleAbilityClick = () => {
    if (!selectedPiece || abilityTargets.length === 0) return
    setAbilityMode({ pieceId: selectedPiece.id, targets: abilityTargets })
  }

  const handleCancelAbility = () => setAbilityMode(null)

  const redPlayers = state.players.filter(p => p.team === 'red' && p.connected)
  const bluePlayers = state.players.filter(p => p.team === 'blue' && p.connected)
  const turnMsLeft = state.turnStartedAt + state.turnDurationSec * 1000 - now
  const turnPct = Math.max(0, Math.min(100, (turnMsLeft / (state.turnDurationSec * 1000)) * 100))
  const currentSlot = state.players[state.currentPlayerIndex]
  const chaos = pendingChaos ? CHAOS_INFO[pendingChaos] : null
  const isLowTime = turnMsLeft < 5000 && turnMsLeft > 0

  return (
    <div className="flex flex-col gap-2">
      {/* ===== Turn banner — stable, no layout shift ===== */}
      <motion.div
        layout
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: state.currentTurnTeam === 'red'
            ? 'linear-gradient(135deg, #ff4fa3, #c43678)'
            : state.currentTurnTeam === 'blue'
            ? 'linear-gradient(135deg, #4f7bff, #2848a8)'
            : 'linear-gradient(135deg, #9b59b6, #4a2670)',
          boxShadow: '0 4px 0 rgba(26,13,46,0.4), 0 6px 16px rgba(0,0,0,0.2)',
          border: '3px solid #1a0d2e',
        }}
      >
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.4), transparent 60%)' }} />
        {/* Pulse on turn change */}
        <motion.div
          key={turnPulse}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 bg-white pointer-events-none"
        />
        <div className="relative px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlot?.id ?? state.currentTurnTeam}
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 30 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                {currentSlot?.avatar
                  ? <AnimalAvatar kind={currentSlot.avatar} size={36} />
                  : <div className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center text-xl">👑</div>
                }
              </motion.div>
            </AnimatePresence>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-white/80 uppercase tracking-wide leading-none">
                {state.currentTurnTeam === 'boss' ? 'Boss Turn' : 'Turn'}
              </div>
              <div className="font-bold text-white truncate text-sm leading-tight flex items-center gap-1">
                {currentSlot?.isBot && '🤖 '}{currentSlot?.name ?? '—'}
                {botThinking && botThinking.playerName === currentSlot?.name && (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="inline-block text-xs"
                  >
                    ⚙️
                  </motion.span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <AnimatePresence>
              {isMyTurn && (
                <motion.div
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0 }}
                  className="px-2.5 py-1 rounded-lg font-bold text-xs"
                  style={{
                    background: 'linear-gradient(135deg, #2ecc71, #1a9850)',
                    border: '2px solid #1a0d2e',
                    boxShadow: '0 2px 0 #0d4f2e',
                  }}
                >
                  YOUR TURN!
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex flex-col items-center min-w-[48px]">
              <div
                className={`font-mono font-bold text-xl leading-none ${isLowTime ? 'text-jumbo-yellow' : 'text-white'}`}
                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
              >
                {isLowTime ? (
                  <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>{formatTime(turnMsLeft)}</motion.span>
                ) : formatTime(turnMsLeft)}
              </div>
              <div className="w-12 h-1 rounded-full bg-black/30 overflow-hidden mt-0.5">
                <motion.div
                  className={`h-full ${isLowTime ? 'bg-jumbo-red' : 'bg-jumbo-yellow'}`}
                  animate={{ width: `${turnPct}%` }}
                  transition={{ duration: 0.25 }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ===== Boss HP bar — stable container ===== */}
      <div className="min-h-0">
        <AnimatePresence>
          {state.mode === 'coop' && state.boss && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className="rounded-2xl p-3 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #2a1450, #1a0d2e)',
                  border: '3px solid #6b3aa0',
                  boxShadow: '0 3px 0 #0a0418',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={state.boss.rage ? { rotate: [0, -3, 3, 0] } : {}}
                      transition={{ duration: 0.3, repeat: Infinity }}
                      className="text-2xl"
                    >
                      {state.boss.rage ? '😡' : '👑'}
                    </motion.div>
                    <div>
                      <div className="font-bold text-white text-sm">BOSS KING</div>
                      <div className="text-xs text-purple-300">
                        {state.boss.rage ? '⚠️ RAGING — summoning minions!' : 'Calm'}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-white text-sm">
                    {state.boss.hp}/{state.boss.maxHp}
                  </div>
                </div>
                <div className="h-4 rounded-full overflow-hidden relative" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #1a0d2e' }}>
                  <motion.div
                    className={`h-full ${state.boss.rage ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-purple-600 to-purple-400'}`}
                    animate={{
                      width: `${(state.boss.hp / state.boss.maxHp) * 100}%`,
                      opacity: state.boss.rage ? [0.7, 1, 0.7] : 1,
                    }}
                    transition={{
                      width: { type: 'spring', stiffness: 200, damping: 30 },
                      opacity: { duration: 0.6, repeat: state.boss.rage ? Infinity : 0 },
                    }}
                  />
                  <div className="absolute inset-0 flex pointer-events-none">
                    {Array.from({ length: state.boss.maxHp }).map((_, i) => (
                      <div key={i} className="flex-1 border-r border-black/30 last:border-r-0" />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== Player scoreboards ===== */}
      <div className="grid grid-cols-2 gap-2">
        <TeamScoreboard label="RED" color="#ff4fa3" colorDark="#c43678" players={redPlayers} isCurrent={state.currentTurnTeam === 'red'} myPlayerId={myPlayerId} />
        {state.mode === 'pvp' ? (
          <TeamScoreboard label="BLUE" color="#4f7bff" colorDark="#2848a8" players={bluePlayers} isCurrent={state.currentTurnTeam === 'blue'} myPlayerId={myPlayerId} />
        ) : (
          <div
            className="rounded-2xl p-2"
            style={{
              background: 'linear-gradient(135deg, #2a1450, #1a0d2e)',
              border: '3px solid #6b3aa0',
              boxShadow: '0 3px 0 #0a0418',
              opacity: 0.85,
            }}
          >
            <div className="text-xs font-bold text-purple-300 mb-1 flex items-center gap-1">👑 BOSS</div>
            <div className="text-xs text-purple-200">{state.boss?.rage ? 'RAGING' : 'Calm'} · {Object.values(state.board.pieces).filter(p => p.team === 'boss').length} pieces</div>
          </div>
        )}
      </div>

      {/* ===== Selected piece panel — stable height container ===== */}
      <div className="min-h-0">
        <AnimatePresence mode="wait">
          {selectedPiece && (
            <motion.div
              key={selectedPiece.id + (selectedPiece.hp) + (selectedPiece.isKing ? 'k' : '') + (selectedPiece.hasShield ? 's' : '')}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <div
                className="rounded-2xl p-3 flex items-center gap-3"
                style={{
                  background: 'linear-gradient(135deg, #fff8ef, #ffe1ef)',
                  border: '3px solid #ffd23f',
                  boxShadow: '0 3px 0 #c4a83f',
                }}
              >
                <div className="flex-shrink-0">
                  <PieceVisual piece={selectedPiece} size={52} selected />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-jumbo-purple">{selectedPiece.ownerName}'s piece</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-1.5 mt-0.5">
                    <span className="font-semibold">{selectedPiece.character.toUpperCase()}</span>
                    <span className="opacity-50">·</span>
                    <span>{selectedPiece.isKing ? 'King 👑' : 'Pawn'}</span>
                    <span className="opacity-50">·</span>
                    <span>HP {selectedPiece.hp}</span>
                    {selectedPiece.frozenTurns > 0 && <span className="text-blue-500">❄️ {selectedPiece.frozenTurns}T</span>}
                    {selectedPiece.hasShield && <span className="text-cyan-500">🛡️ Shield</span>}
                  </div>
                  {/* Ability status */}
                  {(selectedPiece.character === 'mage' || selectedPiece.character === 'jester') && (
                    <div className="text-[10px] mt-0.5">
                      {selectedPiece.abilityUsed ? (
                        <span className="text-muted-foreground">⚡ Ability used</span>
                      ) : (
                        <span className="text-jumbo-pink font-bold">⚡ Ability ready — tap Use Ability</span>
                      )}
                    </div>
                  )}
                  {/* Bonus move indicator */}
                  {bonusMove && bonusMove.pieceId === selectedPiece.id && (
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="text-[10px] mt-0.5 font-bold text-jumbo-green"
                    >
                      ⚡ BONUS MOVE ACTIVE — move again!
                    </motion.div>
                  )}
                  <div className="mt-1">
                    {legalMoves.length > 0 ? (
                      <div className="text-xs text-jumbo-green font-bold flex items-center gap-1">
                        <Sparkle size={12} />
                        {legalMoves.length} move{legalMoves.length > 1 ? 's' : ''} — tap green tile
                      </div>
                    ) : isMyTurn && selectedPiece.team === mySlot?.team ? (
                      <div className="text-xs text-jumbo-red font-bold">No moves — try another piece</div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Tap to inspect</div>
                    )}
                  </div>
                </div>
                <AnimatePresence>
                  {canUseSelectedAbility && abilityTargets.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      <Tooltip content={`${selectedPiece.character === 'mage' ? 'Teleport to any empty tile (within 3 squares)' : 'Swap places with any piece on the board'}`} side="left">
                        <Button
                          size="sm"
                          onClick={handleAbilityClick}
                          className="bg-jumbo-yellow text-jumbo-bg font-bold hover:brightness-110"
                        >
                          ⚡ Ability
                        </Button>
                      </Tooltip>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence>
                {abilityMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 flex items-center gap-2 text-xs px-2">
                      <span className="font-bold text-jumbo-yellow flex items-center gap-1">
                        {selectedPiece.character === 'mage' ? '🎯 Tap a yellow tile to teleport' : '🔄 Tap a piece to swap with'}
                      </span>
                      <Button size="sm" variant="outline" onClick={handleCancelAbility}>Cancel</Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== Onboarding hint (only shows on first turn) ===== */}
      <AnimatePresence>
        {!selectedPiece && isMyTurn && state.movesThisTurn === 0 && Object.values(state.board.pieces).filter(p => p.team === mySlot?.team).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl p-2.5 text-center text-xs font-bold flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, rgba(255,210,63,0.2), rgba(255,79,163,0.2))',
              border: '2px dashed #ffd23f',
              color: '#1a0d2e',
            }}
          >
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            >👆</motion.span>
            Tap one of your pieces to see its moves
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Chaos event banner — fixed position, doesn't shift layout ===== */}
      <AnimatePresence>
        {chaos && (
          <motion.div
            initial={{ scale: 0.3, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.6 }}
            className="rounded-2xl p-3 text-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #ffd23f, #ff7544)',
              border: '3px solid #1a0d2e',
              boxShadow: '0 4px 0 #6b3aa0, 0 0 30px rgba(255,210,63,0.6)',
            }}
          >
            <motion.div
              className="absolute inset-0 opacity-30"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              style={{
                background: 'repeating-conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.4) 20deg, transparent 40deg)',
              }}
            />
            <div className="relative">
              <div className="text-2xl mb-0.5">{chaos.emoji}</div>
              <div className="font-bold text-jumbo-bg text-base" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.5)' }}>CHAOS: {chaos.label}</div>
              <div className="text-jumbo-bg/80 text-xs">{chaos.desc}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Emote floaters — fixed position, spread horizontally, fade fast ===== */}
      <div className="fixed inset-0 pointer-events-none z-[60]">
        <AnimatePresence>
          {lastEmotes.slice(-3).map((ev, i) => {
            // Spread floaters across the top of the board area
            const xOffset = (i - 1) * 80 // -80, 0, +80 for 3 floaters
            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, scale: 0.3, y: 0 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.2, 1, 0.8], y: -80 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 1.8, ease: 'easeOut', times: [0, 0.15, 0.7, 1] }}
                className="absolute top-1/3 text-4xl"
                style={{
                  left: `calc(50% + ${xOffset}px)`,
                  transform: 'translateX(-50%)',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))',
                }}
              >
                {ev.emoji}
                <div className="text-[10px] text-center text-white bg-jumbo-purple/90 rounded px-1 py-0.5 mt-0.5 whitespace-nowrap">{ev.playerName}</div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* ===== Emote wheel — fixed bottom-right, doesn't shift ===== */}
      <div className="fixed bottom-3 right-3 z-[70] flex flex-col items-end gap-2">
        <AnimatePresence>
          {emoteOpen && (
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="grid grid-cols-4 gap-1.5 p-2.5 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #fff8ef, #ffe1ef)',
                border: '3px solid #ff4fa3',
                boxShadow: '0 5px 0 #c43678, 0 10px 20px rgba(0,0,0,0.3)',
              }}
            >
              {EMOJI_WHEEL.map((e) => (
                <motion.button
                  key={e}
                  whileHover={{ scale: 1.2, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    sendEmote(e)
                    setEmoteOpen(false)
                  }}
                  className="text-2xl p-1.5 rounded-lg hover:bg-white/60"
                >
                  {e}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => setEmoteOpen(o => !o)}
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
          style={{
            background: emoteOpen ? 'linear-gradient(135deg, #ff5252, #c0392b)' : 'linear-gradient(135deg, #ffd23f, #e6b800)',
            border: '3px solid #1a0d2e',
            boxShadow: '0 5px 0 #6b3aa0, 0 8px 16px rgba(0,0,0,0.3)',
          }}
          aria-label="Toggle emote wheel"
        >
          {emoteOpen ? '✕' : '😜'}
        </motion.button>
      </div>

      {/* ===== Help button (top-left, fixed) ===== */}
      <div className="fixed top-3 left-3 z-[70]">
        <Tooltip content="Game guide — characters, power-ups, controls" side="right">
          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => setHelpOpen(o => !o)}
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
            style={{
              background: 'linear-gradient(135deg, #4f7bff, #2848a8)',
              border: '3px solid #1a0d2e',
              boxShadow: '0 4px 0 #1a2f6b, 0 6px 12px rgba(0,0,0,0.3)',
            }}
            aria-label="Open game guide"
          >
            ?
          </motion.button>
        </Tooltip>
      </div>

      {/* ===== Help modal ===== */}
      <AnimatePresence>
        {helpOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            style={{ background: 'rgba(26,13,46,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => setHelpOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-2xl p-4"
              style={{
                background: 'linear-gradient(135deg, #fff8ef, #ffe1ef)',
                border: '4px solid #1a0d2e',
                boxShadow: '0 12px 0 #0a0418, 0 20px 40px rgba(0,0,0,0.4)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-jumbo-purple">📖 Game Guide</h2>
                <button onClick={() => setHelpOpen(false)} className="text-2xl w-8 h-8 rounded-full bg-muted hover:bg-muted/70">✕</button>
              </div>

              {/* Quick controls */}
              <div className="mb-3 p-3 rounded-xl bg-white/70 border-2 border-jumbo-yellow">
                <div className="font-bold text-sm mb-1 text-jumbo-purple">🎮 Controls</div>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• <b>Tap your piece</b> to see its possible moves (green dots)</li>
                  <li>• <b>Tap a green tile</b> to move there</li>
                  <li>• <b>Jump over enemies</b> to capture them — chain jumps for combos!</li>
                  <li>• <b>Reach the far row</b> to promote to a King 👑 (moves both directions)</li>
                  <li>• <b>Tap ⚡ Ability</b> (if available) to use your character's special power</li>
                  <li>• <b>Tap 🎁 power-ups</b> on the board by moving onto them — effects apply automatically</li>
                  <li>• <b>Tap 😜</b> for the emote wheel</li>
                </ul>
              </div>

              <div className="space-y-2">
                <CharacterCodex defaultOpen team={mySlot?.team || 'red'} />
                <PowerUpLegend defaultOpen />
              </div>

              <div className="mt-3 p-3 rounded-xl bg-white/70 border-2 border-jumbo-pink">
                <div className="font-bold text-sm mb-1 text-jumbo-purple">💡 Tips</div>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• Captures are <b>forced</b> — if you can capture, you must.</li>
                  <li>• Tanks have 2 HP + a shield that absorbs 1 capture.</li>
                  <li>• Mages can teleport once per game — save it for a clutch escape or to grab a power-up.</li>
                  <li>• Jesters can swap with anyone — use it to escape danger or trap an enemy.</li>
                  <li>• Every 60s a chaos event triggers — adapt fast!</li>
                </ul>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TeamScoreboard({ label, color, colorDark, players, isCurrent, myPlayerId }: {
  label: string
  color: string
  colorDark: string
  players: { id: string; name: string; avatar?: string; score: number; captures: number; isBot?: boolean; character: string }[]
  isCurrent: boolean
  myPlayerId: string | null
}) {
  return (
    <motion.div
      layout
      animate={isCurrent ? { boxShadow: `0 3px 0 ${colorDark}, 0 0 16px ${color}80` } : { boxShadow: `0 3px 0 ${colorDark}` }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl p-2"
      style={{
        background: `linear-gradient(135deg, ${color}, ${colorDark})`,
        border: `3px solid ${isCurrent ? '#ffd23f' : '#1a0d2e'}`,
      }}
    >
      <div className="text-xs font-bold text-white/90 mb-1 flex items-center justify-between">
        <span>{label === 'RED' ? '🔴' : '🔵'} {label}</span>
        <AnimatePresence>
          {isCurrent && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="text-[10px] bg-white/25 px-1.5 rounded-full"
            >▶ TURN</motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {players.length === 0 && <div className="text-xs text-white/60 italic">No players</div>}
          {players.map(p => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-xs"
            >
              {p.avatar && <AnimalAvatar kind={p.avatar} size={20} />}
              <span className={`flex-1 truncate text-white ${p.id === myPlayerId ? 'font-bold underline' : ''}`}>
                {p.isBot && '🤖 '}{p.name}
              </span>
              <motion.span
                key={p.score}
                initial={{ scale: 1.4, color: '#ffd23f' }}
                animate={{ scale: 1, color: 'rgba(255,255,255,0.9)' }}
                transition={{ duration: 0.4 }}
                className="font-mono bg-black/30 px-1 rounded text-[10px]"
              >
                {p.score}
              </motion.span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
