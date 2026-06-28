'use client'
import { Piece, CharacterClass } from '@/game/types'

// Visual representation of a piece — big, googly-eyed, cartoonish.
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
  const teamColor = piece.team === 'red' ? '#ff4fa3' : piece.team === 'blue' ? '#4f7bff' : '#6b3aa0'
  const teamColorDark = piece.team === 'red' ? '#c43678' : piece.team === 'blue' ? '#3457b0' : '#4a2670'

  // Character emoji/face
  const charEmoji: Record<CharacterClass, string> = {
    tank: '🛡️',
    speedster: '⚡',
    mage: '🧙',
    jester: '🤡',
  }

  return (
    <div
      className={`relative rounded-full flex items-center justify-center transition-transform ${isMyTurn && isMine && !selected ? 'animate-pulse' : ''}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, ${teamColor}, ${teamColorDark})`,
        border: '3px solid #1a0d2e',
        boxShadow: selected
          ? `0 0 0 4px #ffd23f, 0 6px 0 rgba(26,13,46,0.3), 0 10px 16px rgba(0,0,0,0.3)`
          : highlight
          ? `0 0 0 3px #2ecc71, 0 4px 0 rgba(26,13,46,0.3)`
          : isMyTurn && isMine
          ? `0 0 0 2px rgba(255, 210, 63, 0.6), 0 4px 0 rgba(26,13,46,0.3), 0 6px 12px rgba(0,0,0,0.25)`
          : `0 4px 0 rgba(26,13,46,0.3), 0 6px 12px rgba(0,0,0,0.25)`,
        transform: selected ? 'scale(1.08)' : 'scale(1)',
      }}
    >
      {/* Googly eyes */}
      <div className="absolute flex gap-0.5" style={{ top: size * 0.18 }}>
        <div className="googly-eye" style={{ width: size * 0.18, height: size * 0.18 }} />
        <div className="googly-eye" style={{ width: size * 0.18, height: size * 0.18 }} />
      </div>
      {/* Character emoji */}
      <div
        className="absolute"
        style={{
          bottom: size * 0.12,
          fontSize: size * 0.42,
          lineHeight: 1,
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))',
        }}
      >
        {charEmoji[piece.character]}
      </div>
      {/* King crown */}
      {piece.isKing && (
        <div
          className="absolute"
          style={{
            top: -size * 0.18,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: size * 0.45,
          }}
        >
          👑
        </div>
      )}
      {/* Frozen indicator */}
      {piece.frozenTurns > 0 && (
        <div
          className="absolute inset-0 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(79, 200, 255, 0.4)',
            border: '2px solid #4fc8ff',
          }}
        >
          <span style={{ fontSize: size * 0.4 }}>❄️</span>
        </div>
      )}
      {/* Shield indicator */}
      {piece.hasShield && (
        <div
          className="absolute"
          style={{
            top: -size * 0.05,
            right: -size * 0.05,
            fontSize: size * 0.35,
          }}
        >
          🛡️
        </div>
      )}
      {/* HP for tanks/boss */}
      {piece.hp > 1 && (
        <div
          className="absolute px-1 rounded-full text-white font-bold"
          style={{
            bottom: -size * 0.12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#ff5252',
            border: '2px solid #1a0d2e',
            fontSize: size * 0.28,
            lineHeight: 1,
            minWidth: size * 0.4,
            textAlign: 'center',
          }}
        >
          {piece.hp}
        </div>
      )}
    </div>
  )
}
