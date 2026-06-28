'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { setMuted, isMuted, initAudio } from '@/lib/sound'

export function SoundToggle({ className = '' }: { className?: string }) {
  // Read initial mute state synchronously to avoid setState-in-effect lint warning
  const [muted, setMutedState] = useState(() => (typeof window !== 'undefined' ? isMuted() : false))

  const toggle = () => {
    initAudio()
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      className={className}
      aria-label={muted ? 'Unmute' : 'Mute'}
      title={muted ? 'Sound off' : 'Sound on'}
    >
      {muted ? '🔇' : '🔊'}
    </Button>
  )
}
