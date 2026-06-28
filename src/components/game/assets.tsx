'use client'
import React from 'react'

// =========================================================================
// Jumbo Royale - SVG Asset Library
// All visual game art as inline React SVG components.
// - Crisp at any size (vector)
// - Theme-able via props (team colors, expressions)
// - Zero external dependencies, zero asset files (still 100% free to host)
// =========================================================================

// ---------- Character Faces ----------

export function TankFace({ size = 40, team = 'red', expression = 'normal' }: { size?: number; team?: string; expression?: 'normal' | 'angry' | 'happy' | 'hurt' }) {
  const main = team === 'red' ? '#ff4fa3' : team === 'blue' ? '#4f7bff' : '#9b59b6'
  const dark = team === 'red' ? '#c43678' : team === 'blue' ? '#2848a8' : '#6c4082'
  const helmet = team === 'red' ? '#ffd23f' : team === 'blue' ? '#ffd23f' : '#ffd23f'
  const eyeY = expression === 'angry' ? 18 : 17
  const mouthPath = expression === 'angry' ? 'M14 26 Q20 22 26 26' : expression === 'happy' ? 'M14 24 Q20 30 26 24' : expression === 'hurt' ? 'M14 27 L26 27' : 'M14 25 Q20 27 26 25'

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <radialGradient id={`tank-body-${team}-${size}`} cx="35%" cy="30%">
          <stop offset="0%" stopColor={main} stopOpacity="1" />
          <stop offset="100%" stopColor={dark} stopOpacity="1" />
        </radialGradient>
        <linearGradient id={`tank-helmet-${team}-${size}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffe566" />
          <stop offset="100%" stopColor="#e6b800" />
        </linearGradient>
      </defs>
      {/* Body */}
      <circle cx="20" cy="22" r="15" fill={`url(#tank-body-${team}-${size})`} stroke="#1a0d2e" strokeWidth="2" />
      {/* Helmet (top half) */}
      <path d="M5 22 A15 15 0 0 1 35 22 L35 18 L5 18 Z" fill={`url(#tank-helmet-${team}-${size})`} stroke="#1a0d2e" strokeWidth="2" />
      <rect x="5" y="17" width="30" height="3" fill="#1a0d2e" />
      {/* Helmet spike */}
      <path d="M18 5 L22 5 L20 0 Z" fill={helmet} stroke="#1a0d2e" strokeWidth="1.5" />
      {/* Eyes */}
      <circle cx="14" cy={eyeY} r="3" fill="white" stroke="#1a0d2e" strokeWidth="1.5" />
      <circle cx="26" cy={eyeY} r="3" fill="white" stroke="#1a0d2e" strokeWidth="1.5" />
      <circle cx={expression === 'angry' ? 15 : 14} cy={eyeY} r="1.5" fill="#1a0d2e" />
      <circle cx={expression === 'angry' ? 25 : 26} cy={eyeY} r="1.5" fill="#1a0d2e" />
      {/* Angry eyebrows */}
      {expression === 'angry' && (
        <>
          <path d="M10 13 L17 15" stroke="#1a0d2e" strokeWidth="2" strokeLinecap="round" />
          <path d="M30 13 L23 15" stroke="#1a0d2e" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {/* Mouth */}
      <path d={mouthPath} stroke="#1a0d2e" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Highlight */}
      <ellipse cx="14" cy="14" rx="4" ry="3" fill="white" opacity="0.3" />
    </svg>
  )
}

export function SpeedsterFace({ size = 40, team = 'red', expression = 'normal' }: { size?: number; team?: string; expression?: 'normal' | 'angry' | 'happy' | 'hurt' }) {
  const main = team === 'red' ? '#ff4fa3' : team === 'blue' ? '#4f7bff' : '#9b59b6'
  const dark = team === 'red' ? '#c43678' : team === 'blue' ? '#2848a8' : '#6c4082'

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <radialGradient id={`speed-body-${team}-${size}`} cx="35%" cy="30%">
          <stop offset="0%" stopColor={main} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
      </defs>
      {/* Body (slim oval) */}
      <ellipse cx="20" cy="22" rx="13" ry="14" fill={`url(#speed-body-${team}-${size})`} stroke="#1a0d2e" strokeWidth="2" />
      {/* Lightning bolt crest */}
      <path d="M22 3 L16 12 L20 12 L18 18 L24 9 L20 9 Z" fill="#ffd23f" stroke="#1a0d2e" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Goggles strap */}
      <rect x="6" y="15" width="28" height="2.5" fill="#1a0d2e" />
      {/* Goggles */}
      <ellipse cx="14" cy="18" rx="4" ry="3.5" fill="#4fc8ff" stroke="#1a0d2e" strokeWidth="1.5" opacity="0.9" />
      <ellipse cx="26" cy="18" rx="4" ry="3.5" fill="#4fc8ff" stroke="#1a0d2e" strokeWidth="1.5" opacity="0.9" />
      <ellipse cx="13" cy="17" rx="1.2" ry="1" fill="white" opacity="0.8" />
      <ellipse cx="25" cy="17" rx="1.2" ry="1" fill="white" opacity="0.8" />
      {/* Mouth */}
      <path d={expression === 'happy' ? 'M14 27 Q20 31 26 27' : expression === 'angry' ? 'M14 28 Q20 24 26 28' : 'M15 27 Q20 29 25 27'} stroke="#1a0d2e" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Highlight */}
      <ellipse cx="14" cy="14" rx="3" ry="2.5" fill="white" opacity="0.3" />
    </svg>
  )
}

export function MageFace({ size = 40, team = 'red', expression = 'normal' }: { size?: number; team?: string; expression?: 'normal' | 'angry' | 'happy' | 'hurt' }) {
  const main = team === 'red' ? '#ff4fa3' : team === 'blue' ? '#4f7bff' : '#9b59b6'
  const dark = team === 'red' ? '#c43678' : team === 'blue' ? '#2848a8' : '#6c4082'

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <radialGradient id={`mage-body-${team}-${size}`} cx="35%" cy="30%">
          <stop offset="0%" stopColor={main} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
        <linearGradient id={`mage-hat-${team}-${size}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6b3aa0" />
          <stop offset="100%" stopColor="#4a2670" />
        </linearGradient>
      </defs>
      {/* Body */}
      <circle cx="20" cy="24" r="13" fill={`url(#mage-body-${team}-${size})`} stroke="#1a0d2e" strokeWidth="2" />
      {/* Wizard hat */}
      <path d="M20 0 L8 22 L32 22 Z" fill={`url(#mage-hat-${team}-${size})`} stroke="#1a0d2e" strokeWidth="2" strokeLinejoin="round" />
      {/* Hat brim */}
      <ellipse cx="20" cy="22" rx="14" ry="3" fill="#4a2670" stroke="#1a0d2e" strokeWidth="2" />
      {/* Star on hat */}
      <path d="M20 8 L21.5 12 L25.5 12 L22.5 14.5 L23.5 18.5 L20 16 L16.5 18.5 L17.5 14.5 L14.5 12 L18.5 12 Z" fill="#ffd23f" stroke="#1a0d2e" strokeWidth="1" />
      {/* Eyes (mystical) */}
      <circle cx="15" cy="26" r="2.5" fill="#ffd23f" stroke="#1a0d2e" strokeWidth="1.5" />
      <circle cx="25" cy="26" r="2.5" fill="#ffd23f" stroke="#1a0d2e" strokeWidth="1.5" />
      <circle cx="15" cy="26" r="1" fill="#1a0d2e" />
      <circle cx="25" cy="26" r="1" fill="#1a0d2e" />
      {/* Beard */}
      <path d="M14 30 Q20 35 26 30 L26 32 Q20 36 14 32 Z" fill="white" opacity="0.9" stroke="#1a0d2e" strokeWidth="1" />
      {/* Highlight */}
      <ellipse cx="14" cy="20" rx="3" ry="2" fill="white" opacity="0.3" />
    </svg>
  )
}

export function JesterFace({ size = 40, team = 'red', expression = 'normal' }: { size?: number; team?: string; expression?: 'normal' | 'angry' | 'happy' | 'hurt' }) {
  const main = team === 'red' ? '#ff4fa3' : team === 'blue' ? '#4f7bff' : '#9b59b6'
  const dark = team === 'red' ? '#c43678' : team === 'blue' ? '#2848a8' : '#6c4082'

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <radialGradient id={`jester-body-${team}-${size}`} cx="35%" cy="30%">
          <stop offset="0%" stopColor={main} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
      </defs>
      {/* Body */}
      <circle cx="20" cy="24" r="13" fill={`url(#jester-body-${team}-${size})`} stroke="#1a0d2e" strokeWidth="2" />
      {/* Jester hat (3-horn) */}
      <path d="M8 18 Q8 8 14 6 L18 14 Z" fill="#ffd23f" stroke="#1a0d2e" strokeWidth="2" strokeLinejoin="round" />
      <path d="M32 18 Q32 8 26 6 L22 14 Z" fill="#2ecc71" stroke="#1a0d2e" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 14 Q20 4 26 14 L20 16 Z" fill={main} stroke="#1a0d2e" strokeWidth="2" strokeLinejoin="round" />
      {/* Bell tips */}
      <circle cx="9" cy="8" r="2" fill="#ffd23f" stroke="#1a0d2e" strokeWidth="1.5" />
      <circle cx="31" cy="8" r="2" fill="#2ecc71" stroke="#1a0d2e" strokeWidth="1.5" />
      <circle cx="20" cy="4" r="2" fill={main} stroke="#1a0d2e" strokeWidth="1.5" />
      {/* Eyes (silly crossed) */}
      <circle cx="15" cy="23" r="3" fill="white" stroke="#1a0d2e" strokeWidth="1.5" />
      <circle cx="25" cy="23" r="3" fill="white" stroke="#1a0d2e" strokeWidth="1.5" />
      <line x1="13" y1="22" x2="17" y2="24" stroke="#1a0d2e" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="27" y1="22" x2="23" y2="24" stroke="#1a0d2e" strokeWidth="1.5" strokeLinecap="round" />
      {/* Tongue out mouth */}
      <path d="M15 29 Q20 33 25 29" stroke="#1a0d2e" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M19 30 Q20 33 21 30 L21 32 Q20 33 19 32 Z" fill="#ff5252" stroke="#1a0d2e" strokeWidth="1" />
      {/* Highlight */}
      <ellipse cx="14" cy="20" rx="3" ry="2" fill="white" opacity="0.3" />
    </svg>
  )
}

// ---------- Crown (for Kings) ----------

export function Crown({ size = 28, team = 'red' }: { size?: number; team?: string }) {
  const gold = '#ffd23f'
  const goldDark = '#e6b800'
  const gem = team === 'red' ? '#ff4fa3' : team === 'blue' ? '#4f7bff' : '#9b59b6'
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 28 22" fill="none">
      <defs>
        <linearGradient id={`crown-${team}-${size}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff5b3" />
          <stop offset="50%" stopColor={gold} />
          <stop offset="100%" stopColor={goldDark} />
        </linearGradient>
      </defs>
      {/* Crown shape */}
      <path d="M2 18 L2 8 L7 13 L14 4 L21 13 L26 8 L26 18 Z" fill={`url(#crown-${team}-${size})`} stroke="#1a0d2e" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Base */}
      <rect x="2" y="17" width="24" height="3" fill={goldDark} stroke="#1a0d2e" strokeWidth="1.5" />
      {/* Gems */}
      <circle cx="7" cy="13" r="1.5" fill={gem} stroke="#1a0d2e" strokeWidth="0.8" />
      <circle cx="14" cy="9" r="2" fill={gem} stroke="#1a0d2e" strokeWidth="0.8" />
      <circle cx="21" cy="13" r="1.5" fill={gem} stroke="#1a0d2e" strokeWidth="0.8" />
      {/* Sparkles */}
      <circle cx="5" cy="5" r="1" fill="white" opacity="0.9" />
      <circle cx="14" cy="2" r="1.2" fill="white" opacity="0.9" />
      <circle cx="23" cy="5" r="1" fill="white" opacity="0.9" />
    </svg>
  )
}

// ---------- Shield ----------

export function ShieldIcon({ size = 20, broken = false }: { size?: number; broken?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 22" fill="none">
      <defs>
        <linearGradient id={`shield-${size}-${broken}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7dd6ff" />
          <stop offset="100%" stopColor="#3a9bd9" />
        </linearGradient>
      </defs>
      <path
        d={broken
          ? "M2 2 L10 1 L18 2 L18 12 L10 21 L2 12 Z M8 4 L12 10 M12 4 L8 10"
          : "M2 2 L10 1 L18 2 L18 12 L10 21 L2 12 Z"
        }
        fill={broken ? 'rgba(125, 214, 255, 0.3)' : `url(#shield-${size}-${broken})`}
        stroke="#1a0d2e"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {!broken && (
        <path d="M10 6 L13 8 L13 12 L10 14 L7 12 L7 8 Z" fill="#ffd23f" stroke="#1a0d2e" strokeWidth="1" />
      )}
    </svg>
  )
}

// ---------- Power-up Icons ----------

export function PowerUpIcon({ type, size = 32 }: { type: 'double_move' | 'freeze' | 'swap' | 'bomb' | 'shield' | 'extra_jump'; size?: number }) {
  const grad = (id: string, c1: string, c2: string) => (
    <linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor={c1} />
      <stop offset="100%" stopColor={c2} />
    </linearGradient>
  )
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        {type === 'double_move' && grad('pu-dm', '#ffe566', '#ffa500')}
        {type === 'freeze' && grad('pu-fz', '#b3e5ff', '#4fc8ff')}
        {type === 'swap' && grad('pu-sw', '#d8b3ff', '#9b59b6')}
        {type === 'bomb' && grad('pu-bm', '#ff7575', '#c0392b')}
        {type === 'shield' && grad('pu-sh', '#7dd6ff', '#3a9bd9')}
        {type === 'extra_jump' && grad('pu-ej', '#a3ffb3', '#2ecc71')}
      </defs>
      {/* Tile background */}
      <rect x="3" y="3" width="26" height="26" rx="6" fill={`url(#pu-${type === 'double_move' ? 'dm' : type === 'freeze' ? 'fz' : type === 'swap' ? 'sw' : type === 'bomb' ? 'bm' : type === 'shield' ? 'sh' : 'ej'})`} stroke="#1a0d2e" strokeWidth="2" />
      {/* Icon */}
      {type === 'double_move' && (
        <path d="M9 16 L16 9 L23 16 M9 22 L16 15 L23 22" stroke="#1a0d2e" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {type === 'freeze' && (
        <g stroke="#1a0d2e" strokeWidth="2" strokeLinecap="round">
          <line x1="16" y1="8" x2="16" y2="24" />
          <line x1="8" y1="16" x2="24" y2="16" />
          <line x1="10" y1="10" x2="22" y2="22" />
          <line x1="22" y1="10" x2="10" y2="22" />
          <circle cx="16" cy="16" r="2" fill="white" stroke="#1a0d2e" />
        </g>
      )}
      {type === 'swap' && (
        <g stroke="#1a0d2e" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 12 L20 12 L17 9 M22 20 L12 20 L15 23" />
        </g>
      )}
      {type === 'bomb' && (
        <g>
          <circle cx="16" cy="19" r="8" fill="#1a0d2e" />
          <rect x="14" y="9" width="4" height="4" fill="#8b6f47" stroke="#1a0d2e" strokeWidth="1" />
          <path d="M18 9 L22 5 L20 9 Z" fill="#ff5252" stroke="#1a0d2e" strokeWidth="1" />
          <circle cx="13" cy="17" r="1.5" fill="white" opacity="0.4" />
        </g>
      )}
      {type === 'shield' && (
        <path d="M16 6 L24 9 L24 16 L16 26 L8 16 L8 9 Z" fill="#ffd23f" stroke="#1a0d2e" strokeWidth="2" strokeLinejoin="round" />
      )}
      {type === 'extra_jump' && (
        <g stroke="#1a0d2e" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 16 A8 8 0 0 1 22 11 M22 11 L22 8 M22 11 L25 11" />
          <path d="M24 16 A8 8 0 0 1 10 21 M10 21 L10 24 M10 21 L7 21" />
        </g>
      )}
    </svg>
  )
}

// ---------- Avatars (animal faces) ----------

export function AvatarEmoji({ kind, size = 36 }: { kind: string; size?: number }) {
  // Map legacy emoji avatars to SVG animal faces
  const map: Record<string, string> = {
    '🦄': 'unicorn', '🐸': 'frog', '🐙': 'octopus', '🦊': 'fox',
    '🐷': 'pig', '🐔': 'chicken', '🦖': 'dino', '🐳': 'whale',
    '🦉': 'owl', '🐝': 'bee',
    '🤖': 'robot', '👾': 'alien', '🎮': 'game', '🛸': 'ufo',
    '⚙️': 'gear', '🔮': 'crystal', '🦾': 'arm', '💾': 'disk',
  }
  const k = map[kind] || 'robot'
  return <AnimalAvatar kind={k} size={size} />
}

export function AnimalAvatar({ kind, size = 36 }: { kind: string; size?: number }) {
  const colors: Record<string, [string, string]> = {
    unicorn: ['#ffe5f7', '#ff9ed8'],
    frog: ['#a3ffb3', '#2ecc71'],
    octopus: ['#ffb3d9', '#ff4fa3'],
    fox: ['#ffd9b3', '#ff7544'],
    pig: ['#ffc4d6', '#ff7baa'],
    chicken: ['#fff5b3', '#ffd23f'],
    dino: ['#b3d9ff', '#4f7bff'],
    whale: ['#b3c4ff', '#5b6fff'],
    owl: ['#d9b3ff', '#9b59b6'],
    bee: ['#fff5b3', '#ffd23f'],
    robot: ['#d4d4d4', '#7a7a7a'],
    alien: ['#a3ffb3', '#1ecc71'],
    game: ['#1a0d2e', '#000000'],
    ufo: ['#b3e5ff', '#4fc8ff'],
    gear: ['#d4d4d4', '#7a7a7a'],
    crystal: ['#d8b3ff', '#9b59b6'],
    arm: ['#d4d4d4', '#7a7a7a'],
    disk: ['#d4d4d4', '#7a7a7a'],
  }
  const [light, dark] = colors[kind] || colors.robot

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <radialGradient id={`av-${kind}-${size}`} cx="35%" cy="30%">
          <stop offset="0%" stopColor={light} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill={`url(#av-${kind}-${size})`} stroke="#1a0d2e" strokeWidth="2" />

      {/* Animal-specific features */}
      {kind === 'unicorn' && (
        <>
          <path d="M14 4 L17 12 L11 12 Z" fill="#ffd23f" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="14" cy="16" r="2.5" fill="white" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="26" cy="16" r="2.5" fill="white" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="14" cy="16" r="1" fill="#1a0d2e" />
          <circle cx="26" cy="16" r="1" fill="#1a0d2e" />
          <path d="M14 24 Q20 28 26 24" stroke="#1a0d2e" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}
      {kind === 'frog' && (
        <>
          <ellipse cx="14" cy="14" rx="5" ry="4" fill="#a3ffb3" stroke="#1a0d2e" strokeWidth="1.5" />
          <ellipse cx="26" cy="14" rx="5" ry="4" fill="#a3ffb3" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="14" cy="14" r="2" fill="#1a0d2e" />
          <circle cx="26" cy="14" r="2" fill="#1a0d2e" />
          <path d="M12 24 Q20 30 28 24" stroke="#1a0d2e" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}
      {kind === 'octopus' && (
        <>
          <circle cx="14" cy="17" r="2.5" fill="white" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="26" cy="17" r="2.5" fill="white" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="14" cy="17" r="1" fill="#1a0d2e" />
          <circle cx="26" cy="17" r="1" fill="#1a0d2e" />
          <path d="M10 25 Q12 30 14 28 M16 27 Q18 31 20 28 M22 27 Q24 31 26 28 M28 25 Q30 30 28 28" stroke="#1a0d2e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </>
      )}
      {kind === 'fox' && (
        <>
          <path d="M8 8 L14 14 L10 16 Z" fill="#ff7544" stroke="#1a0d2e" strokeWidth="1.5" />
          <path d="M32 8 L26 14 L30 16 Z" fill="#ff7544" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="15" cy="17" r="2" fill="#1a0d2e" />
          <circle cx="25" cy="17" r="2" fill="#1a0d2e" />
          <path d="M18 24 L20 26 L22 24" stroke="#1a0d2e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M20 26 L20 28" stroke="#1a0d2e" strokeWidth="1.5" />
        </>
      )}
      {kind === 'pig' && (
        <>
          <ellipse cx="20" cy="22" rx="6" ry="4" fill="#ff9ed8" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="17" cy="22" r="1" fill="#1a0d2e" />
          <circle cx="23" cy="22" r="1" fill="#1a0d2e" />
          <circle cx="14" cy="16" r="2" fill="#1a0d2e" />
          <circle cx="26" cy="16" r="2" fill="#1a0d2e" />
          <path d="M16 28 Q20 30 24 28" stroke="#1a0d2e" strokeWidth="1.5" fill="none" />
        </>
      )}
      {kind === 'chicken' && (
        <>
          <path d="M16 6 L20 12 L24 6 Z" fill="#ff5252" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="14" cy="16" r="2" fill="#1a0d2e" />
          <circle cx="26" cy="16" r="2" fill="#1a0d2e" />
          <path d="M20 22 L23 26 L20 24 L17 26 Z" fill="#ff7544" stroke="#1a0d2e" strokeWidth="1.5" />
        </>
      )}
      {kind === 'dino' && (
        <>
          <path d="M8 10 L12 8 L14 12 L16 8 L18 12 L20 8 L22 12 L24 8 L28 10" fill="#4f7bff" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="14" cy="18" r="2" fill="white" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="22" cy="18" r="2" fill="white" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="14" cy="18" r="1" fill="#1a0d2e" />
          <circle cx="22" cy="18" r="1" fill="#1a0d2e" />
          <path d="M14 26 Q20 30 26 26" stroke="#1a0d2e" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}
      {kind === 'whale' && (
        <>
          <path d="M6 16 Q10 8 20 8 Q30 8 32 18 Q30 22 20 22 Q10 22 6 16 Z" fill="#5b6fff" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="14" cy="14" r="1.5" fill="#1a0d2e" />
          <path d="M30 16 L34 12 L34 20 Z" fill="#5b6fff" stroke="#1a0d2e" strokeWidth="1.5" />
        </>
      )}
      {kind === 'owl' && (
        <>
          <circle cx="14" cy="16" r="5" fill="white" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="26" cy="16" r="5" fill="white" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="14" cy="16" r="2" fill="#1a0d2e" />
          <circle cx="26" cy="16" r="2" fill="#1a0d2e" />
          <path d="M18 22 L20 26 L22 22 Z" fill="#ffd23f" stroke="#1a0d2e" strokeWidth="1" />
        </>
      )}
      {kind === 'bee' && (
        <>
          <ellipse cx="20" cy="22" rx="9" ry="8" fill="#ffd23f" stroke="#1a0d2e" strokeWidth="1.5" />
          <path d="M14 18 L26 18 M14 22 L26 22 M14 26 L26 26" stroke="#1a0d2e" strokeWidth="2" />
          <ellipse cx="12" cy="14" rx="4" ry="3" fill="white" opacity="0.7" stroke="#1a0d2e" strokeWidth="1" />
          <ellipse cx="28" cy="14" rx="4" ry="3" fill="white" opacity="0.7" stroke="#1a0d2e" strokeWidth="1" />
        </>
      )}
      {kind === 'robot' && (
        <>
          <rect x="10" y="8" width="20" height="18" rx="3" fill="#a0a0a0" stroke="#1a0d2e" strokeWidth="1.5" />
          <rect x="14" y="14" width="5" height="3" fill="#4fc8ff" stroke="#1a0d2e" strokeWidth="1" />
          <rect x="21" y="14" width="5" height="3" fill="#4fc8ff" stroke="#1a0d2e" strokeWidth="1" />
          <rect x="14" y="20" width="12" height="2" fill="#1a0d2e" />
          <line x1="20" y1="4" x2="20" y2="8" stroke="#1a0d2e" strokeWidth="2" />
          <circle cx="20" cy="3" r="1.5" fill="#ff5252" />
        </>
      )}
      {kind === 'alien' && (
        <>
          <ellipse cx="20" cy="20" rx="10" ry="12" fill="#1ecc71" stroke="#1a0d2e" strokeWidth="1.5" />
          <ellipse cx="15" cy="18" rx="3" ry="4" fill="black" />
          <ellipse cx="25" cy="18" rx="3" ry="4" fill="black" />
          <ellipse cx="14" cy="17" rx="1" ry="2" fill="white" />
          <ellipse cx="24" cy="17" rx="1" ry="2" fill="white" />
          <path d="M16 26 Q20 28 24 26" stroke="#1a0d2e" strokeWidth="1.5" fill="none" />
        </>
      )}
      {kind === 'game' && (
        <>
          <rect x="6" y="14" width="28" height="16" rx="4" fill="#1a0d2e" stroke="#000" strokeWidth="1" />
          <circle cx="13" cy="22" r="2" fill="#4fc8ff" />
          <circle cx="27" cy="22" r="2" fill="#ff4fa3" />
          <rect x="10" y="20" width="2" height="4" fill="white" />
          <rect x="9" y="21" width="4" height="2" fill="white" />
          <circle cx="24" cy="20" r="1" fill="#ffd23f" />
          <circle cx="30" cy="24" r="1" fill="#2ecc71" />
        </>
      )}
      {kind === 'ufo' && (
        <>
          <ellipse cx="20" cy="22" rx="14" ry="4" fill="#9b9b9b" stroke="#1a0d2e" strokeWidth="1.5" />
          <ellipse cx="20" cy="18" rx="8" ry="5" fill="#4fc8ff" stroke="#1a0d2e" strokeWidth="1.5" opacity="0.8" />
          <circle cx="14" cy="22" r="1.5" fill="#ffd23f" />
          <circle cx="20" cy="22" r="1.5" fill="#ffd23f" />
          <circle cx="26" cy="22" r="1.5" fill="#ffd23f" />
        </>
      )}
      {kind === 'gear' && (
        <>
          <path d="M20 6 L22 10 L26 8 L26 14 L30 16 L26 18 L26 24 L22 22 L20 26 L18 22 L14 24 L14 18 L10 16 L14 14 L14 8 L18 10 Z" fill="#9b9b9b" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="20" cy="16" r="4" fill="#1a0d2e" />
        </>
      )}
      {kind === 'crystal' && (
        <>
          <path d="M20 4 L26 14 L20 30 L14 14 Z" fill="#d8b3ff" stroke="#1a0d2e" strokeWidth="1.5" />
          <path d="M14 14 L26 14 M20 4 L20 30" stroke="#1a0d2e" strokeWidth="1" />
        </>
      )}
      {kind === 'arm' && (
        <>
          <rect x="14" y="8" width="12" height="22" rx="3" fill="#a0a0a0" stroke="#1a0d2e" strokeWidth="1.5" />
          <circle cx="20" cy="8" r="3" fill="#ff5252" stroke="#1a0d2e" strokeWidth="1.5" />
          <line x1="14" y1="14" x2="26" y2="14" stroke="#1a0d2e" strokeWidth="1" />
          <line x1="14" y1="18" x2="26" y2="18" stroke="#1a0d2e" strokeWidth="1" />
        </>
      )}
      {kind === 'disk' && (
        <>
          <rect x="8" y="10" width="24" height="20" rx="2" fill="#1a0d2e" stroke="#000" strokeWidth="1" />
          <rect x="10" y="12" width="20" height="12" fill="#7a7a7a" />
          <rect x="14" y="14" width="6" height="2" fill="#4fc8ff" />
          <rect x="14" y="18" width="12" height="1" fill="#1a0d2e" />
          <rect x="14" y="20" width="12" height="1" fill="#1a0d2e" />
        </>
      )}
    </svg>
  )
}

// ---------- Decorative ----------

export function Sparkle({ size = 16, color = '#ffd23f' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 0 L9.5 6.5 L16 8 L9.5 9.5 L8 16 L6.5 9.5 L0 8 L6.5 6.5 Z" fill={color} />
    </svg>
  )
}

export function ExplosionBurst({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      <g>
        <path d="M30 5 L33 22 L50 18 L37 28 L55 35 L37 33 L40 50 L30 38 L20 50 L23 33 L5 35 L23 28 L10 18 L27 22 Z" fill="#ffd23f" stroke="#ff5252" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="30" cy="30" r="6" fill="#ff5252" />
      </g>
    </svg>
  )
}
