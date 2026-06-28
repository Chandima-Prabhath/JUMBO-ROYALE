'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// =========================================================================
// Capture Explosion - shown when a piece is captured
// =========================================================================
export function CaptureExplosion({ x, y, id }: { x: number; y: number; id: string }) {
  const particles = Array.from({ length: 12 }, (_, i) => i)
  return (
    <div
      key={id}
      className="fixed pointer-events-none z-[100]"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
    >
      {particles.map(i => {
        const angle = (i / 12) * Math.PI * 2
        const dist = 40 + Math.random() * 30
        const colors = ['#ff5252', '#ffd23f', '#ff4fa3', '#ff7544']
        const color = colors[i % colors.length]
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 8,
              height: 8,
              background: color,
              left: 0,
              top: 0,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              opacity: 0,
              scale: 0.3,
            }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )
      })}
      {/* Center flash */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 50,
          height: 50,
          background: 'radial-gradient(circle, #ffd23f, transparent 70%)',
          left: -25,
          top: -25,
        }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 2, opacity: 0 }}
        transition={{ duration: 0.4 }}
      />
    </div>
  )
}

// =========================================================================
// Confetti burst - shown on win
// =========================================================================
export function ConfettiBurst({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<Array<{ id: number; x: number; delay: number; color: string; rotate: number }>>([])

  useEffect(() => {
    if (active) {
      const colors = ['#ff4fa3', '#4f7bff', '#ffd23f', '#2ecc71', '#9b59b6', '#ff7544']
      const newPieces = Array.from({ length: 80 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        color: colors[i % colors.length],
        rotate: Math.random() * 360,
      }))
      setPieces(newPieces)
      const t = setTimeout(() => setPieces([]), 4000)
      return () => clearTimeout(t)
    } else {
      setPieces([])
    }
  }, [active])

  return (
    <div className="fixed inset-0 pointer-events-none z-[60]">
      <AnimatePresence>
        {pieces.map(p => (
          <motion.div
            key={p.id}
            className="absolute w-3 h-4 rounded-sm"
            style={{
              left: `${p.x}%`,
              top: -20,
              background: p.color,
              rotate: p.rotate,
            }}
            initial={{ y: -20, opacity: 1, rotate: p.rotate }}
            animate={{
              y: typeof window !== 'undefined' ? window.innerHeight + 50 : 1000,
              opacity: [1, 1, 0.9, 0],
              rotate: p.rotate + 720,
              x: (Math.random() - 0.5) * 100,
            }}
            transition={{
              duration: 3 + Math.random() * 1,
              delay: p.delay,
              ease: 'easeIn',
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

// =========================================================================
// Screen shake wrapper - wraps content and shakes when triggered
// =========================================================================
export function ScreenShake({ trigger, children }: { trigger: number; children: React.ReactNode }) {
  return (
    <motion.div
      animate={trigger > 0 ? {
        x: [0, -8, 8, -6, 6, -4, 4, 0],
        y: [0, 4, -4, 2, -2, 0],
      } : {}}
      transition={{ duration: 0.4 }}
      key={trigger}
    >
      {children}
    </motion.div>
  )
}

// =========================================================================
// Floating score popup - shows "+10" or "COMBO!" when capturing
// =========================================================================
export function ScorePopup({ id, x, y, text, color = '#ffd23f' }: { id: string; x: number; y: number; text: string; color?: string }) {
  return (
    <motion.div
      key={id}
      className="fixed pointer-events-none z-[90] font-bold text-2xl"
      style={{
        left: x,
        top: y,
        color,
        textShadow: '0 2px 0 #1a0d2e, 0 4px 8px rgba(0,0,0,0.4)',
      }}
      initial={{ scale: 0, y: 0, opacity: 0 }}
      animate={{ scale: [0, 1.3, 1], y: -60, opacity: [0, 1, 0] }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
    >
      {text}
    </motion.div>
  )
}
