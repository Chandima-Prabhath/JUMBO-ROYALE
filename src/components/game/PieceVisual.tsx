'use client'
import { Piece, CharacterClass } from '@/game/types'
import { TankFace, SpeedsterFace, MageFace, JesterFace, Crown, ShieldIcon } from './assets'
import { motion } from 'framer-motion'

const FACES: Record<CharacterClass, typeof TankFace> = {
  tank: TankFace,
  speedster: SpeedsterFace,
  mage: MageFace,
  jester: JesterFace,
}

export function PieceVisual({
  piece,
  size = 44,
  selected = false,
  highlight = false,
  isMyTurn = false,
  isMine = false,
}: {
  piece: Piece
  size?: number
  selected?: boolean
  highlight?: boolean
  isMyTurn?: boolean
  isMine?: boolean
}) {
  const Face = FACES[piece.character]
  const faceSize = Math.floor(size * 1.0)

  return (
    <motion.div
      className="relative flex items-center justify-center"
      animate={selected ? { scale: 1.12 } : { scale: 1 }}
      whileHover={isMine && isMyTurn ? { scale: 1.06, y: -2 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{ width: size, height: size }}
    >
      {/* Outer ring (selection / highlight / my-turn pulse) */}
      <div
        className="absolute inset-0 rounded-full transition-all"
        style={{
          boxShadow: selected
            ? '0 0 0 4px #ffd23f, 0 0 24px rgba(255, 210, 63, 0.6)'
            : highlight
            ? '0 0 0 3px #ff5252, 0 0 18px rgba(255, 82, 82, 0.5)'
            : isMyTurn && isMine
            ? '0 0 0 2px rgba(255, 210, 63, 0.6), 0 0 12px rgba(255, 210, 63, 0.3)'
            : 'none',
        }}
      />

      {/* Base shadow */}
      <div
        className="absolute rounded-full"
        style={{
          width: size * 0.85,
          height: size * 0.18,
          bottom: -size * 0.08,
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.4), transparent 70%)',
          filter: 'blur(2px)',
        }}
      />

      {/* Face SVG */}
      <Face size={faceSize} team={piece.team} />

      {/* King crown */}
      {piece.isKing && (
        <div
          className="absolute"
          style={{
            top: -size * 0.22,
            left: '50%',
            transform: 'translateX(-50%)',
            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.4))',
          }}
        >
          <motion.div
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Crown size={Math.floor(size * 0.6)} team={piece.team} />
          </motion.div>
        </div>
      )}

      {/* Frozen overlay */}
      {piece.frozenTurns > 0 && (
        <motion.div
          className="absolute inset-0 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(79, 200, 255, 0.35)',
            border: '2px solid #4fc8ff',
            boxShadow: '0 0 12px rgba(79, 200, 255, 0.6), inset 0 0 8px rgba(255,255,255,0.5)',
          }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
            <path d="M12 2 L13 8 L19 7 L14 12 L19 17 L13 16 L12 22 L11 16 L5 17 L10 12 L5 7 L11 8 Z" fill="white" stroke="#4fc8ff" strokeWidth="1.5" />
          </svg>
        </motion.div>
      )}

      {/* Shield badge */}
      {piece.hasShield && (
        <div
          className="absolute"
          style={{
            top: -size * 0.05,
            right: -size * 0.05,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
          }}
        >
          <ShieldIcon size={Math.floor(size * 0.42)} />
        </div>
      )}

      {/* HP badge */}
      {piece.hp > 1 && (
        <div
          className="absolute px-1.5 rounded-full text-white font-bold flex items-center justify-center"
          style={{
            bottom: -size * 0.12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg, #ff7575, #c0392b)',
            border: '2px solid #1a0d2e',
            fontSize: size * 0.32,
            lineHeight: 1,
            minWidth: size * 0.5,
            height: size * 0.36,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          {piece.hp}
        </div>
      )}
    </motion.div>
  )
}
