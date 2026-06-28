'use client'

import { useEffect, useState } from 'react'
// useState still used for name, joinCode, abilityMode
import { useJumbo } from '@/stores/jumbo'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { GameMode } from '@/game/types'
import { GameBoard } from '@/components/game/GameBoard'
import { GameHUD } from '@/components/game/GameHUD'
import { LobbyScreen } from '@/components/game/LobbyScreen'
import { SoundToggle } from '@/components/game/SoundToggle'
import { toast } from 'sonner'

type ScreenName = 'home' | 'lobby' | 'game' | 'ended'

export default function Home() {
  const { init, connected, state, error, clearError, restartGame } = useJumbo()
  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('jumbo:name') || ''
  })
  const [joinCode, setJoinCode] = useState('')
  const [abilityMode, setAbilityMode] = useState<{ pieceId: string; targets: { row: number; col: number }[] } | null>(null)

  useEffect(() => {
    init()
  }, [init])

  // Derive screen from state.phase (no setState in effect needed)
  const screen: ScreenName = !state
    ? 'home'
    : state.phase === 'lobby' ? 'lobby'
    : state.phase === 'playing' ? 'game'
    : state.phase === 'ended' ? 'ended'
    : 'home'

  // Show errors as toasts
  useEffect(() => {
    if (error) {
      toast.error(error.message)
      clearError()
    }
  }, [error, clearError])

  // Persist name to localStorage whenever it changes
  useEffect(() => {
    if (name) localStorage.setItem('jumbo:name', name)
  }, [name])

  const handleCreate = (mode: GameMode) => {
    if (!connected) {
      toast.error('Connecting to server... please wait')
      return
    }
    if (!name.trim()) {
      toast.error('Pick a name first!')
      return
    }
    useJumbo.getState().createRoom(name.trim(), mode)
  }

  const handleJoin = () => {
    if (!connected) {
      toast.error('Connecting to server... please wait')
      return
    }
    if (!name.trim()) {
      toast.error('Pick a name first!')
      return
    }
    if (!joinCode.trim()) {
      toast.error('Enter a room code!')
      return
    }
    useJumbo.getState().joinRoom(name.trim(), joinCode.trim())
  }

  if (screen === 'lobby' && state) return <LobbyScreen />
  if (screen === 'game' && state) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="px-3 pt-3 pb-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-jumbo-pink text-stroke-sm">JUMBO ROYALE</h1>
              <p className="text-xs text-muted-foreground">Room {state.roomCode} · {state.mode === 'pvp' ? '⚔️ PvP' : '🤝 Co-op'}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { window.location.reload() }}>
              🏠 Leave
            </Button>
            <SoundToggle />
          </div>
        </header>
        <main className="flex-1 px-3 pb-4 max-w-2xl w-full mx-auto flex flex-col gap-2">
          <GameHUD onAbilityModeChange={setAbilityMode} />
          <GameBoard abilityMode={abilityMode} />
        </main>
      </div>
    )
  }

  if (screen === 'ended' && state) {
    const mySlot = state.players.find(p => p.id === useJumbo.getState().myPlayerId)
    const isWinner = mySlot?.team === state.winnerTeam
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', duration: 0.8 }}
            className="text-7xl mb-4"
          >
            {isWinner ? '🎉' : '😭'}
          </motion.div>
          <h2 className="text-3xl font-bold mb-2 text-stroke-sm text-jumbo-pink">
            {isWinner ? 'YOU WIN!' : 'YOU LOSE!'}
          </h2>
          <p className="text-muted-foreground mb-6">
            {state.winnerTeam === 'boss' ? 'The Boss King ate everyone' :
             state.winnerTeam === 'red' ? 'Red team reigns supreme!' :
             state.winnerTeam === 'blue' ? 'Blue team takes the crown!' : "It's a draw!"}
          </p>
          <div className="mb-6">
            <h3 className="font-bold mb-2">Scores</h3>
            <div className="space-y-1">
              {state.players.map(p => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span>{p.avatar} {p.name} ({p.team})</span>
                  <span className="font-mono">{p.score} pts · {p.captures} captures</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => restartGame()}
              className="flex-1 bg-jumbo-green text-white font-bold"
            >
              🔁 Play Again
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="flex-1"
            >
              🏠 Home
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Home screen
  return (
    <div className="min-h-screen flex flex-col">
      <div className="absolute top-3 right-3 z-10">
        <SoundToggle />
      </div>
      <header className="px-4 pt-6 pb-2 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
        >
          <h1 className="text-5xl sm:text-6xl font-bold text-jumbo-pink text-stroke mb-2 animate-float inline-block">
            JUMBO ROYALE
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Silly co-op checkers chaos for friends 🎉
          </p>
        </motion.div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-md w-full mx-auto flex flex-col gap-4">
        {/* Name input */}
        <Card className="p-4">
          <label className="text-sm font-bold mb-2 block">Your name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="e.g. GoofyGoblin"
            maxLength={20}
            className="text-lg"
          />
          <div className="text-xs text-muted-foreground mt-1">
            {connected ? '🟢 Connected' : '🟡 Connecting...'}
          </div>
        </Card>

        {/* Create room */}
        <Card className="p-4">
          <h2 className="font-bold mb-3">🎲 Create a room</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => handleCreate('pvp')}
              className="bg-jumbo-pink text-white font-bold shadow-bouncy-sm h-auto py-4 flex flex-col gap-1"
              disabled={!connected || !name.trim()}
            >
              <span className="text-2xl">⚔️</span>
              <span>PvP Chaos</span>
              <span className="text-xs opacity-80 font-normal">2-6 players, last piece standing</span>
            </Button>
            <Button
              onClick={() => handleCreate('coop')}
              className="bg-jumbo-blue text-white font-bold shadow-bouncy-sm h-auto py-4 flex flex-col gap-1"
              disabled={!connected || !name.trim()}
            >
              <span className="text-2xl">🤝</span>
              <span>Co-op vs Boss</span>
              <span className="text-xs opacity-80 font-normal">Team up vs AI Boss King</span>
            </Button>
          </div>
        </Card>

        {/* Join room */}
        <Card className="p-4">
          <h2 className="font-bold mb-3">🔑 Join a room</h2>
          <div className="flex gap-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="ABCD"
              maxLength={4}
              className="text-2xl font-mono text-center tracking-widest"
            />
            <Button
              onClick={handleJoin}
              disabled={!connected || !name.trim() || !joinCode.trim()}
              className="bg-jumbo-green text-white font-bold"
            >
              Join
            </Button>
          </div>
        </Card>

        {/* How to play */}
        <Card className="p-4">
          <h2 className="font-bold mb-2">📖 How to play</h2>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>1. Create a room or join with a 4-letter code</li>
            <li>2. Pick your team & character class</li>
            <li>3. Tap your piece, then tap a green tile to move</li>
            <li>4. Capture enemies by jumping over them (chain jumps = combo!)</li>
            <li>5. Reach the far row to become a King 👑 (moves both ways)</li>
            <li>6. Grab ⚡🧊🌀💣🛡️ power-ups for chaos!</li>
            <li>7. Every 30s a chaos event flips the board 🎲</li>
          </ul>
        </Card>
      </main>

      <footer className="px-4 py-4 text-center text-xs text-muted-foreground">
        Free forever · Mobile-first · No signup needed
      </footer>
    </div>
  )
}
