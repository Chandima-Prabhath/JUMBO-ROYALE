'use client'
import { useJumbo } from '@/stores/jumbo'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { canUseAbility, getAbilityTargets } from '@/game/engine'
import { PieceVisual } from './PieceVisual'
import { Piece } from '@/game/types'

const EMOJI_WHEEL = ['😂', '🔥', '💀', '🎉', '👏', '😭', '🤔', '👀', '❤️', '🤯', '🥳', '😤']

function formatTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${s}s`
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
  const isMyTurn = state.mode === 'pvp'
    ? state.players[state.currentPlayerIndex]?.id === myPlayerId
    : state.currentTurnTeam === 'red' && mySlot?.team === 'red'
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

  // Build player list grouped by team
  const redPlayers = state.players.filter(p => p.team === 'red' && p.connected)
  const bluePlayers = state.players.filter(p => p.team === 'blue' && p.connected)
  const bossPlayers = state.players.filter(p => p.team === 'boss' && p.connected)

  const turnMsLeft = state.turnStartedAt + state.turnDurationSec * 1000 - now

  return (
    <div className="flex flex-col gap-2">
      {/* Top status bar */}
      <div className="px-3 py-2 rounded-xl bg-card border-2 border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-xs text-muted-foreground">Turn:</div>
          <div className={`px-2 py-1 rounded-lg font-bold text-sm ${
            state.currentTurnTeam === 'red' ? 'bg-jumbo-pink text-white' :
            state.currentTurnTeam === 'blue' ? 'bg-jumbo-blue text-white' :
            'bg-jumbo-purple text-white'
          }`}>
            {state.currentTurnTeam === 'boss' ? '👑 BOSS' : state.currentTurnTeam.toUpperCase()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isMyTurn && (
            <div className="px-2 py-1 rounded-lg bg-jumbo-green text-white text-sm font-bold animate-pop">
              YOUR TURN!
            </div>
          )}
          <div className={`px-2 py-1 rounded-lg font-mono font-bold text-sm ${turnMsLeft < 5000 ? 'bg-jumbo-red text-white animate-pulse' : 'bg-muted'}`}>
            ⏱️ {formatTime(turnMsLeft)}
          </div>
        </div>
      </div>

      {/* Boss HP bar (co-op only) */}
      {state.mode === 'coop' && state.boss && (
        <Card className="p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-sm">👑 BOSS KING</span>
            <span className="text-xs font-mono">{state.boss.hp}/{state.boss.maxHp} HP</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all ${state.boss.rage ? 'bg-jumbo-red animate-pulse' : 'bg-jumbo-purple'}`}
              style={{ width: `${(state.boss.hp / state.boss.maxHp) * 100}%` }}
            />
          </div>
          {state.boss.rage && (
            <div className="text-xs text-jumbo-red font-bold mt-1 animate-pulse">⚠️ BOSS IS RAGING! Summons minions!</div>
          )}
        </Card>
      )}

      {/* Player scores */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-2">
          <div className="text-xs font-bold text-jumbo-pink">🔴 RED</div>
          {redPlayers.map(p => (
            <div key={p.id} className="flex items-center justify-between text-xs">
              <span>{p.avatar} {p.name}</span>
              <span className="font-mono">{p.score}</span>
            </div>
          ))}
        </Card>
        {state.mode === 'pvp' ? (
          <Card className="p-2">
            <div className="text-xs font-bold text-jumbo-blue">🔵 BLUE</div>
            {bluePlayers.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span>{p.avatar} {p.name}</span>
                <span className="font-mono">{p.score}</span>
              </div>
            ))}
          </Card>
        ) : (
          <Card className="p-2">
            <div className="text-xs font-bold text-jumbo-purple">👑 BOSS</div>
            <div className="text-xs">AI controlled · {state.boss?.rage ? 'RAGING' : 'Calm'}</div>
          </Card>
        )}
      </div>

      {/* Selected piece + actions */}
      <AnimatePresence>
        {selectedPiece && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <Card className="p-3">
              <div className="flex items-center gap-3">
                <PieceVisual piece={selectedPiece} size={48} selected />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{selectedPiece.ownerName}'s piece</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedPiece.character.toUpperCase()} · {selectedPiece.isKing ? 'King 👑' : 'Pawn'} · HP {selectedPiece.hp}
                    {selectedPiece.frozenTurns > 0 && ` · ❄️ Frozen ${selectedPiece.frozenTurns}T`}
                    {selectedPiece.hasShield && ' · 🛡️ Shielded'}
                  </div>
                  {legalMoves.length > 0 && (
                    <div className="text-xs text-jumbo-green font-bold mt-1">
                      {legalMoves.length} move{legalMoves.length > 1 ? 's' : ''} available · tap green tile
                    </div>
                  )}
                  {legalMoves.length === 0 && isMyTurn && selectedPiece.team === mySlot?.team && (
                    <div className="text-xs text-jumbo-red font-bold mt-1">No moves — pick another piece</div>
                  )}
                </div>
                {canUseSelectedAbility && abilityTargets.length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleAbilityClick}
                    className="bg-jumbo-yellow text-jumbo-bg font-bold"
                  >
                    Use Ability
                  </Button>
                )}
              </div>
              {abilityMode && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="font-bold text-jumbo-yellow">
                    {selectedPiece.character === 'mage' ? '🎯 Tap a yellow tile to teleport' : '🔄 Tap a piece to swap'}
                  </span>
                  <Button size="sm" variant="outline" onClick={handleCancelAbility}>Cancel</Button>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chaos event banner */}
      <AnimatePresence>
        {pendingChaos && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="px-4 py-3 rounded-xl bg-jumbo-yellow text-jumbo-bg font-bold text-center shadow-bouncy-sm border-2 border-jumbo-bg"
          >
            🎲 CHAOS: {pendingChaos.replace('_', ' ').toUpperCase()}!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emote floaters */}
      <div className="fixed inset-0 pointer-events-none z-50">
        <AnimatePresence>
          {lastEmotes.slice(-5).map((ev, i) => (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: -20 - i * 40 }}
              exit={{ opacity: 0, y: -100 }}
              transition={{ duration: 2 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 text-4xl"
            >
              {ev.emoji}
              <div className="text-xs text-center text-foreground bg-card/80 rounded px-1">{ev.playerName}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Emote wheel */}
      <div className="fixed bottom-3 right-3 z-40">
        <AnimatePresence>
          {emoteOpen && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="grid grid-cols-4 gap-2 mb-2 p-2 bg-card rounded-2xl border-2 border-border shadow-bouncy-sm"
            >
              {EMOJI_WHEEL.map(e => (
                <button
                  key={e}
                  onClick={() => {
                    sendEmote(e)
                    setEmoteOpen(false)
                  }}
                  className="text-2xl p-2 rounded-lg hover:bg-muted active:scale-90 transition-transform"
                >
                  {e}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          onClick={() => setEmoteOpen(o => !o)}
          size="lg"
          className="rounded-full w-14 h-14 text-2xl shadow-bouncy-sm bg-jumbo-yellow text-jumbo-bg"
        >
          😜
        </Button>
      </div>
    </div>
  )
}
