'use client'
import { useJumbo } from '@/stores/jumbo'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { canUseAbility, getAbilityTargets } from '@/game/engine'
import { PieceVisual } from './PieceVisual'
import { AnimalAvatar, Sparkle } from './assets'
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
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${s}`
}

export function GameHUD({ onAbilityModeChange }: { onAbilityModeChange: (mode: { pieceId: string; targets: { row: number; col: number }[] } | null) => void }) {
  const { state, myPlayerId, selectedPieceId, legalMoves, useAbility, sendEmote, lastEmotes, pendingChaos } = useJumbo()
  const [emoteOpen, setEmoteOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [abilityMode, setAbilityMode] = useState<{ pieceId: string; targets: { row: number; col: number }[] } | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    onAbilityModeChange(abilityMode)
  }, [abilityMode, onAbilityModeChange])

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

  const handleCancelAbility = () => {
    setAbilityMode(null)
  }

  const redPlayers = state.players.filter(p => p.team === 'red' && p.connected)
  const bluePlayers = state.players.filter(p => p.team === 'blue' && p.connected)

  const turnMsLeft = state.turnStartedAt + state.turnDurationSec * 1000 - now
  const turnPct = Math.max(0, Math.min(100, (turnMsLeft / (state.turnDurationSec * 1000)) * 100))

  const currentSlot = state.players[state.currentPlayerIndex]
  const chaos = pendingChaos ? CHAOS_INFO[pendingChaos] : null

  return (
    <div className="flex flex-col gap-2">
      {/* ===== Turn banner ===== */}
      <motion.div
        key={state.currentTurnTeam + state.currentPlayerIndex}
        initial={{ scale: 0.9, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: state.currentTurnTeam === 'red'
            ? 'linear-gradient(135deg, #ff4fa3, #c43678)'
            : state.currentTurnTeam === 'blue'
            ? 'linear-gradient(135deg, #4f7bff, #2848a8)'
            : 'linear-gradient(135deg, #9b59b6, #4a2670)',
          boxShadow: '0 6px 0 rgba(26,13,46,0.4), 0 8px 20px rgba(0,0,0,0.25)',
          border: '3px solid #1a0d2e',
        }}
      >
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.4), transparent 60%)' }} />
        <div className="relative px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {currentSlot?.avatar && <AnimalAvatar kind={currentSlot.avatar} size={32} />}
            <div className="min-w-0">
              <div className="text-xs font-bold text-white/80 uppercase tracking-wide">
                {state.currentTurnTeam === 'boss' ? 'Boss Turn' : 'Turn'}
              </div>
              <div className="font-bold text-white truncate">
                {currentSlot?.isBot ? '🤖 ' : ''}{currentSlot?.name ?? '—'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {isMyTurn && (
                <motion.div
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0 }}
                  className="px-3 py-1.5 rounded-xl font-bold text-sm"
                  style={{
                    background: 'linear-gradient(135deg, #2ecc71, #1a9850)',
                    border: '2px solid #1a0d2e',
                    boxShadow: '0 3px 0 #0d4f2e',
                  }}
                >
                  YOUR TURN!
                </motion.div>
              )}
            </AnimatePresence>
            {/* Timer */}
            <div className="flex flex-col items-center">
              <div
                className={`font-mono font-bold text-2xl ${turnMsLeft < 5000 ? 'text-jumbo-yellow' : 'text-white'}`}
                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
              >
                {turnMsLeft < 5000 && turnMsLeft > 0 ? (
                  <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>{formatTime(turnMsLeft)}</motion.span>
                ) : (
                  formatTime(turnMsLeft)
                )}
              </div>
              <div className="w-20 h-1 rounded-full bg-black/30 overflow-hidden">
                <div
                  className={`h-full transition-all ${turnMsLeft < 5000 ? 'bg-jumbo-red' : 'bg-jumbo-yellow'}`}
                  style={{ width: `${turnPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ===== Boss HP bar (co-op) ===== */}
      {state.mode === 'coop' && state.boss && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-3 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #2a1450, #1a0d2e)',
            border: '3px solid #6b3aa0',
            boxShadow: '0 4px 0 #0a0418',
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
              animate={state.boss.rage ? { opacity: [0.7, 1, 0.7] } : {}}
              transition={{ duration: 0.6, repeat: Infinity }}
              style={{ width: `${(state.boss.hp / state.boss.maxHp) * 100}%` }}
            />
            {/* HP segment markers */}
            <div className="absolute inset-0 flex">
              {Array.from({ length: state.boss.maxHp }).map((_, i) => (
                <div key={i} className="flex-1 border-r border-black/30 last:border-r-0" />
              ))}
            </div>
          </div>
        </motion.div>
      )}

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

      {/* ===== Selected piece panel ===== */}
      <AnimatePresence>
        {selectedPiece && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 10, height: 0 }}
          >
            <div
              className="rounded-2xl p-3 flex items-center gap-3"
              style={{
                background: 'linear-gradient(135deg, #fff8ef, #ffe1ef)',
                border: '3px solid #ffd23f',
                boxShadow: '0 4px 0 #c4a83f',
              }}
            >
              <div className="flex-shrink-0">
                <PieceVisual piece={selectedPiece} size={56} selected />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-jumbo-purple">{selectedPiece.ownerName}'s piece</div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                  <span className="font-semibold">{selectedPiece.character.toUpperCase()}</span>
                  <span>·</span>
                  <span>{selectedPiece.isKing ? 'King 👑' : 'Pawn'}</span>
                  <span>·</span>
                  <span>HP {selectedPiece.hp}</span>
                  {selectedPiece.frozenTurns > 0 && <span className="text-blue-500">❄️ {selectedPiece.frozenTurns}T</span>}
                  {selectedPiece.hasShield && <span className="text-cyan-500">🛡️ Shielded</span>}
                </div>
                {legalMoves.length > 0 && (
                  <div className="text-xs text-jumbo-green font-bold mt-1 flex items-center gap-1">
                    <Sparkle size={12} />
                    {legalMoves.length} move{legalMoves.length > 1 ? 's' : ''} — tap green tile
                  </div>
                )}
                {legalMoves.length === 0 && isMyTurn && selectedPiece.team === mySlot?.team && (
                  <div className="text-xs text-jumbo-red font-bold mt-1">No moves — try another piece</div>
                )}
              </div>
              {canUseSelectedAbility && abilityTargets.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleAbilityClick}
                  className="bg-jumbo-yellow text-jumbo-bg font-bold shadow-bouncy-sm hover:brightness-110"
                >
                  ⚡ Use Ability
                </Button>
              )}
            </div>
            {abilityMode && (
              <div className="mt-2 flex items-center gap-2 text-xs px-2">
                <span className="font-bold text-jumbo-yellow">
                  {selectedPiece.character === 'mage' ? '🎯 Tap a yellow tile to teleport' : '🔄 Tap a piece to swap with'}
                </span>
                <Button size="sm" variant="outline" onClick={handleCancelAbility}>Cancel</Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Chaos event banner ===== */}
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
              <div className="text-3xl mb-1">{chaos.emoji}</div>
              <div className="font-bold text-jumbo-bg text-lg" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.5)' }}>CHAOS: {chaos.label}</div>
              <div className="text-jumbo-bg/80 text-xs">{chaos.desc}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Emote floaters ===== */}
      <div className="fixed inset-0 pointer-events-none z-50">
        <AnimatePresence>
          {lastEmotes.slice(-5).map((ev, i) => (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, scale: 0.5, y: 50, x: 0 }}
              animate={{ opacity: 1, scale: 1.4, y: -100 - i * 50, x: (Math.random() - 0.5) * 60 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 2, ease: 'easeOut' }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 text-5xl"
              style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }}
            >
              {ev.emoji}
              <div className="text-xs text-center text-white bg-jumbo-purple/90 rounded px-1.5 py-0.5 mt-1 whitespace-nowrap">{ev.playerName}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ===== Emote wheel ===== */}
      <div className="fixed bottom-3 right-3 z-40">
        <AnimatePresence>
          {emoteOpen && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring' }}
              className="grid grid-cols-4 gap-2 mb-2 p-3 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #fff8ef, #ffe1ef)',
                border: '3px solid #ff4fa3',
                boxShadow: '0 6px 0 #c43678, 0 10px 20px rgba(0,0,0,0.3)',
              }}
            >
              {EMOJI_WHEEL.map((e, i) => (
                <motion.button
                  key={e}
                  whileHover={{ scale: 1.2, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    sendEmote(e)
                    setEmoteOpen(false)
                  }}
                  className="text-2xl p-2 rounded-lg hover:bg-white/60"
                  style={{ animationDelay: `${i * 30}ms` }}
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
          className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
          style={{
            background: emoteOpen ? 'linear-gradient(135deg, #ff5252, #c0392b)' : 'linear-gradient(135deg, #ffd23f, #e6b800)',
            border: '3px solid #1a0d2e',
            boxShadow: '0 6px 0 #6b3aa0, 0 10px 20px rgba(0,0,0,0.3)',
          }}
        >
          {emoteOpen ? '✕' : '😜'}
        </motion.button>
      </div>
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
      animate={isCurrent ? { boxShadow: `0 0 16px ${color}80` } : {}}
      className="rounded-2xl p-2"
      style={{
        background: `linear-gradient(135deg, ${color}, ${colorDark})`,
        border: `3px solid ${isCurrent ? '#ffd23f' : '#1a0d2e'}`,
        boxShadow: `0 3px 0 ${colorDark}`,
      }}
    >
      <div className="text-xs font-bold text-white/90 mb-1 flex items-center justify-between">
        <span>{label === 'RED' ? '🔴' : '🔵'} {label}</span>
        {isCurrent && <span className="text-[10px] bg-white/20 px-1.5 rounded-full">▶ TURN</span>}
      </div>
      <div className="space-y-1">
        {players.length === 0 && <div className="text-xs text-white/60 italic">No players</div>}
        {players.map(p => (
          <div key={p.id} className="flex items-center gap-1.5 text-xs">
            {p.avatar && <AnimalAvatar kind={p.avatar} size={20} />}
            <span className={`flex-1 truncate text-white ${p.id === myPlayerId ? 'font-bold underline' : ''}`}>
              {p.isBot && '🤖 '}{p.name}
            </span>
            <span className="font-mono text-white/90 bg-black/30 px-1 rounded text-[10px]">{p.score}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
