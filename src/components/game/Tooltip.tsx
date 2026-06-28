'use client'
import { useState, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Lightweight tooltip — shows on hover (desktop) or tap (mobile)
export function Tooltip({ children, content, side = 'top' }: { children: ReactNode; content: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  const [show, setShow] = useState(false)

  const pos = {
    top: { bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' },
    bottom: { top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' },
    left: { right: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' },
    right: { left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' },
  }[side]

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onTouchStart={() => setShow(s => !s)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: side === 'top' ? 4 : side === 'bottom' ? -4 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap pointer-events-none"
            style={{
              ...pos,
              background: '#1a0d2e',
              color: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              maxWidth: '240px',
              whiteSpace: 'normal',
              textAlign: 'center',
            }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
