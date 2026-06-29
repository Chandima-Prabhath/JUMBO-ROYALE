'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PowerUpIcon, TankFace, SpeedsterFace, MageFace, JesterFace } from '@/components/game/assets'
import { PowerUpType, CharacterClass } from '@/game/types'
import { Tooltip } from './Tooltip'

// =========================================================================
// Power-up info registry — single source of truth for what each does
// =========================================================================
export const POWERUP_INFO: Record<PowerUpType, { label: string; shortDesc: string; longDesc: string; color: string }> = {
  double_move: {
    label: 'Double Move',
    shortDesc: 'Move again!',
    longDesc: 'Take another move this turn — your turn does not end after moving.',
    color: '#ffa500',
  },
  freeze: {
    label: 'Freeze',
    shortDesc: 'Freeze nearest foe',
    longDesc: 'Freezes the nearest enemy piece in ice for 1 turn — they cannot move.',
    color: '#4fc8ff',
  },
  swap: {
    label: 'Swap',
    shortDesc: 'Swap with random foe',
    longDesc: 'Instantly swap places with a random enemy piece. Pure chaos!',
    color: '#9b59b6',
  },
  bomb: {
    label: 'Bomb',
    shortDesc: 'Destroy adjacent foe',
    longDesc: 'Destroys the adjacent enemy piece with the lowest HP.',
    color: '#c0392b',
  },
  shield: {
    label: 'Shield',
    shortDesc: 'Block 1 capture',
    longDesc: 'Grants a shield that absorbs the next capture. The shield breaks instead of the piece dying.',
    color: '#3a9bd9',
  },
  extra_jump: {
    label: 'Extra Jump',
    shortDesc: 'Move again!',
    longDesc: 'Take another move this turn — same as Double Move but greener.',
    color: '#2ecc71',
  },
}

// =========================================================================
// Character info registry — single source of truth
// =========================================================================
export const CHARACTER_INFO: Record<CharacterClass, {
  name: string
  Face: typeof TankFace
  stats: { hp: number; ability: string; passive: string }
  abilityName: string
  abilityDesc: string
  abilityUses: string
  color: string
}> = {
  tank: {
    name: 'Tank',
    Face: TankFace,
    stats: { hp: 2, ability: 'None', passive: 'Starts with shield' },
    abilityName: 'No active ability',
    abilityDesc: 'Tanks have no active ability — their power is being tough.',
    abilityUses: '—',
    color: '#ffd23f',
  },
  speedster: {
    name: 'Speedster',
    Face: SpeedsterFace,
    stats: { hp: 1, ability: 'Dash (passive)', passive: 'Move 2 squares forward' },
    abilityName: 'Dash (Passive)',
    abilityDesc: 'Speedsters can move 2 squares forward in one move (if both squares are empty). No active ability to activate — the dash is always available.',
    abilityUses: 'Always active',
    color: '#4fc8ff',
  },
  mage: {
    name: 'Mage',
    Face: MageFace,
    stats: { hp: 1, ability: 'Teleport', passive: 'None' },
    abilityName: 'Teleport',
    abilityDesc: 'Teleport this piece to any empty dark tile within 3 squares. Picks up power-ups at the destination and can chain into captures.',
    abilityUses: '1 use per game',
    color: '#9b59b6',
  },
  jester: {
    name: 'Jester',
    Face: JesterFace,
    stats: { hp: 1, ability: 'Swap', passive: 'None' },
    abilityName: 'Swap',
    abilityDesc: 'Swap places with an adjacent piece (within 2 squares). Use it to escape danger, reposition, or set up captures. Does NOT trigger king promotion.',
    abilityUses: '1 use per game',
    color: '#2ecc71',
  },
}

// =========================================================================
// Power-up Legend — collapsible panel showing all power-ups
// =========================================================================
export function PowerUpLegend({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const powerUps = Object.keys(POWERUP_INFO) as PowerUpType[]

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #fff8ef, #ffe1ef)',
        border: '2px solid #ffd23f',
        boxShadow: '0 3px 0 #c4a83f',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-bold text-jumbo-purple"
      >
        <span className="flex items-center gap-2">🎁 Power-up Guide</span>
        <motion.span animate={{ rotate: open ? 90 : 0 }}>▶</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {powerUps.map(pu => {
                const info = POWERUP_INFO[pu]
                return (
                  <div
                    key={pu}
                    className="flex items-start gap-2 p-2 rounded-xl bg-white/70"
                    style={{ borderLeft: `3px solid ${info.color}` }}
                  >
                    <div className="flex-shrink-0">
                      <PowerUpIcon type={pu} size={32} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-jumbo-purple">{info.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{info.longDesc}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// =========================================================================
// Character Codex — collapsible panel showing all characters + abilities
// =========================================================================
export function CharacterCodex({ defaultOpen = false, team = 'red' }: { defaultOpen?: boolean; team?: string }) {
  const [open, setOpen] = useState(defaultOpen)
  const chars = Object.keys(CHARACTER_INFO) as CharacterClass[]

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #fff8ef, #e1ecff)',
        border: '2px solid #4f7bff',
        boxShadow: '0 3px 0 #2848a8',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-bold text-jumbo-blue"
      >
        <span className="flex items-center gap-2">🎭 Character Guide</span>
        <motion.span animate={{ rotate: open ? 90 : 0 }}>▶</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {chars.map(c => {
                const info = CHARACTER_INFO[c]
                return (
                  <div
                    key={c}
                    className="flex items-start gap-2 p-2 rounded-xl bg-white/70"
                    style={{ borderLeft: `3px solid ${info.color}` }}
                  >
                    <div className="flex-shrink-0">
                      <info.Face size={40} team={team} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-jumbo-purple flex items-center gap-1">
                        {info.name}
                        <span className="text-[10px] font-mono bg-muted px-1 rounded">HP {info.stats.hp}</span>
                      </div>
                      {info.stats.passive !== 'None' && (
                        <div className="text-[10px] text-muted-foreground leading-tight">
                          <span className="font-bold">Passive:</span> {info.stats.passive}
                        </div>
                      )}
                      {info.abilityName !== 'No active ability' && (
                        <>
                          <div className="text-[10px] text-jumbo-pink font-bold leading-tight mt-0.5">
                            ⚡ {info.abilityName} <span className="font-normal opacity-70">({info.abilityUses})</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground leading-tight">{info.abilityDesc}</div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// =========================================================================
// Power-up collection popup — shows "+ SHIELD!" when a piece grabs one
// =========================================================================
export function PowerUpCollectedPopup() {
  const { powerupCollected, myPlayerId, state } = usePowerupStore()
  if (!powerupCollected || !state) return null
  const info = POWERUP_INFO[powerupCollected.powerUp]
  const mySlot = state.players.find(p => p.id === myPlayerId)
  const isMine = powerupCollected.playerName === mySlot?.name

  return (
    <AnimatePresence>
      <motion.div
        key={powerupCollected.id}
        initial={{ scale: 0, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0, opacity: 0, y: -30 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="fixed top-16 left-1/2 -translate-x-1/2 z-[80] pointer-events-none"
      >
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${info.color}, ${info.color}dd)`,
            border: '3px solid #1a0d2e',
            boxShadow: '0 4px 0 #1a0d2e, 0 8px 20px rgba(0,0,0,0.3)',
          }}
        >
          <PowerUpIcon type={powerupCollected.powerUp} size={36} />
          <div>
            <div className="font-bold text-white text-sm leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
              {isMine ? `+ ${info.label}!` : `${powerupCollected.playerName} got ${info.label}`}
            </div>
            <div className="text-white/90 text-xs leading-tight">{info.shortDesc}</div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// Tiny hook to grab the powerupCollected state without importing full store type
import { useJumbo } from '@/stores/jumbo'
function usePowerupStore() {
  const powerupCollected = useJumbo(s => s.powerupCollected)
  const myPlayerId = useJumbo(s => s.myPlayerId)
  const state = useJumbo(s => s.state)
  return { powerupCollected, myPlayerId, state }
}

// =========================================================================
// Bonus move banner — shows "Move again!" when double_move/extra_jump collected
// =========================================================================
export function BonusMoveBanner() {
  const bonusMove = useJumbo(s => s.bonusMove)
  if (!bonusMove) return null
  const info = POWERUP_INFO[bonusMove.powerUp]
  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        className="rounded-2xl p-2 text-center"
        style={{
          background: `linear-gradient(135deg, ${info.color}, ${info.color}cc)`,
          border: '3px solid #1a0d2e',
          boxShadow: `0 3px 0 #1a0d2e`,
        }}
      >
        <div className="font-bold text-white text-sm" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
          ⚡ BONUS MOVE — {info.label}!
        </div>
        <div className="text-white/90 text-xs">Move again — your turn continues</div>
      </motion.div>
    </AnimatePresence>
  )
}

// =========================================================================
// Inline mini tooltip for power-up tiles on the board
// =========================================================================
export function PowerUpTileTooltip({ type, children }: { type: PowerUpType; children: React.ReactNode }) {
  const info = POWERUP_INFO[type]
  return (
    <Tooltip
      content={
        <div className="text-left">
          <div className="font-bold flex items-center gap-1">
            <span>{info.label}</span>
          </div>
          <div className="text-[10px] opacity-90">{info.shortDesc}</div>
        </div>
      }
    >
      {children}
    </Tooltip>
  )
}
