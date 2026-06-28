'use client'

import { useEffect, useState } from 'react'
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
import { AnimalAvatar, TankFace, SpeedsterFace, MageFace, JesterFace, Sparkle } from '@/components/game/assets'
import { ConfettiBurst } from '@/components/game/Effects'
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

  const screen: ScreenName = !state
    ? 'home'
    : state.phase === 'lobby' ? 'lobby'
    : state.phase === 'playing' ? 'game'
    : state.phase === 'ended' ? 'ended'
    : 'home'

  useEffect(() => {
    if (error) {
      toast.error(error.message)
      clearError()
    }
  }, [error, clearError])

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
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-jumbo-pink" style={{ textShadow: '0 2px 0 #c43678' }}>JUMBO ROYALE</h1>
              <p className="text-xs text-muted-foreground">Room {state.roomCode} · {state.mode === 'pvp' ? '⚔️ PvP' : '🤝 Co-op'}</p>
            </div>
            <div className="flex gap-1">
              <SoundToggle />
              <Button variant="outline" size="sm" onClick={() => { window.location.reload() }}>
                🏠 Leave
              </Button>
            </div>
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
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <ConfettiBurst active={isWinner} />
        {/* Background gradient pulse */}
        <motion.div
          className="absolute inset-0"
          animate={{
            background: isWinner
              ? ['radial-gradient(circle at 50% 50%, rgba(46,204,113,0.3), transparent 70%)',
                 'radial-gradient(circle at 50% 50%, rgba(255,210,63,0.4), transparent 70%)',
                 'radial-gradient(circle at 50% 50%, rgba(46,204,113,0.3), transparent 70%)']
              : ['radial-gradient(circle at 50% 50%, rgba(255,82,82,0.2), transparent 70%)',
                 'radial-gradient(circle at 50% 50%, rgba(155,89,182,0.3), transparent 70%)',
                 'radial-gradient(circle at 50% 50%, rgba(255,82,82,0.2), transparent 70%)']
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <Card className="p-8 max-w-md w-full text-center relative z-10" style={{ border: '4px solid #1a0d2e', boxShadow: '0 12px 0 #0a0418, 0 20px 40px rgba(0,0,0,0.4)' }}>
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', duration: 0.8 }}
            className="text-7xl mb-4"
          >
            {isWinner ? '🏆' : '💀'}
          </motion.div>
          <motion.h2
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="text-4xl font-bold mb-2"
            style={{
              color: isWinner ? '#2ecc71' : '#ff5252',
              textShadow: `0 3px 0 ${isWinner ? '#1a9850' : '#c0392b'}, 0 6px 12px rgba(0,0,0,0.3)`,
            }}
          >
            {isWinner ? 'VICTORY!' : 'DEFEAT!'}
          </motion.h2>
          <p className="text-muted-foreground mb-6 text-sm">
            {state.winnerTeam === 'boss' ? 'The Boss King ate everyone 👑'
             : state.winnerTeam === 'red' ? 'Red team reigns supreme! 🔴'
             : state.winnerTeam === 'blue' ? 'Blue team takes the crown! 🔵'
             : "It's a draw!"}
          </p>
          <div className="mb-6">
            <h3 className="font-bold mb-3 flex items-center justify-center gap-2">
              <Sparkle size={16} /> FINAL SCORES <Sparkle size={16} />
            </h3>
            <div className="space-y-2">
              {[...state.players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className={`flex items-center gap-2 p-2 rounded-xl ${
                      p.id === useJumbo.getState().myPlayerId ? 'bg-yellow-50 border-2 border-jumbo-yellow' : 'bg-muted'
                    }`}
                  >
                    <div className="font-bold w-6 text-center">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </div>
                    {p.avatar && <AnimalAvatar kind={p.avatar} size={28} />}
                    <div className="flex-1 text-left">
                      <div className="font-bold text-sm">{p.isBot && '🤖 '}{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.team} · {p.captures} captures</div>
                    </div>
                    <div className="font-mono font-bold text-jumbo-pink">{p.score}</div>
                  </motion.div>
                ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => restartGame()}
              className="flex-1 font-bold"
              style={{
                background: 'linear-gradient(135deg, #2ecc71, #1a9850)',
                color: 'white',
                border: '2px solid #1a0d2e',
                boxShadow: '0 4px 0 #0d4f2e',
              }}
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

  // ===== Home / Landing screen =====
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Animated background blobs */}
      <motion.div
        className="absolute top-10 left-10 w-32 h-32 rounded-full opacity-30 blur-2xl"
        style={{ background: 'radial-gradient(circle, #ff4fa3, transparent)' }}
        animate={{ x: [0, 30, 0], y: [0, 20, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-20 right-10 w-40 h-40 rounded-full opacity-30 blur-2xl"
        style={{ background: 'radial-gradient(circle, #4f7bff, transparent)' }}
        animate={{ x: [0, -30, 0], y: [0, -20, 0], scale: [1, 1.3, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 w-32 h-32 rounded-full opacity-20 blur-2xl"
        style={{ background: 'radial-gradient(circle, #ffd23f, transparent)' }}
        animate={{ scale: [1, 1.5, 1], rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      />

      <div className="absolute top-3 right-3 z-10">
        <SoundToggle />
      </div>

      <header className="px-4 pt-8 pb-4 text-center relative z-10">
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: -20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.8 }}
        >
          {/* Floating character preview */}
          <div className="flex justify-center gap-2 mb-2">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 0 }}>
              <TankFace size={48} team="red" />
            </motion.div>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}>
              <SpeedsterFace size={48} team="blue" />
            </motion.div>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}>
              <MageFace size={48} team="red" />
            </motion.div>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 0.9 }}>
              <JesterFace size={48} team="blue" />
            </motion.div>
          </div>

          <h1
            className="text-5xl sm:text-7xl font-bold mb-2 inline-block"
            style={{
              color: '#ff4fa3',
              textShadow: '0 3px 0 #c43678, 0 6px 0 #6b3aa0, 0 10px 20px rgba(0,0,0,0.4)',
              WebkitTextStroke: '0',
            }}
          >
            <motion.span
              animate={{ rotate: [-2, 2, -2] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-block"
            >
              JUMBO
            </motion.span>{' '}
            <motion.span
              animate={{ rotate: [2, -2, 2] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-block"
              style={{ color: '#ffd23f', textShadow: '0 3px 0 #e6b800, 0 6px 0 #6b3aa0, 0 10px 20px rgba(0,0,0,0.4)' }}
            >
              ROYALE
            </motion.span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Silly co-op checkers chaos for friends 🎉
          </p>
        </motion.div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-md w-full mx-auto flex flex-col gap-4 relative z-10">
        {/* Name input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-4" style={{ border: '3px solid #1a0d2e', boxShadow: '0 6px 0 #0a0418' }}>
            <label className="text-sm font-bold mb-2 block flex items-center gap-1">
              <span>✏️</span> Your name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              placeholder="e.g. GoofyGoblin"
              maxLength={20}
              className="text-lg"
              style={{ border: '2px solid #1a0d2e' }}
            />
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {connected ? (
                <><span className="text-jumbo-green">●</span> Connected</>
              ) : (
                <><span className="text-jumbo-yellow animate-pulse">●</span> Connecting...</>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Create room */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4" style={{ border: '3px solid #1a0d2e', boxShadow: '0 6px 0 #0a0418' }}>
            <h2 className="font-bold mb-3 flex items-center gap-2"><span>🎲</span> Create a room</h2>
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleCreate('pvp')}
                disabled={!connected || !name.trim()}
                className="rounded-2xl p-4 flex flex-col items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #ff4fa3, #c43678)',
                  color: 'white',
                  border: '3px solid #1a0d2e',
                  boxShadow: '0 5px 0 #6b1f4d',
                }}
              >
                <span className="text-3xl">⚔️</span>
                <span className="font-bold">PvP Chaos</span>
                <span className="text-[10px] opacity-90">2-6 players, last standing</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleCreate('coop')}
                disabled={!connected || !name.trim()}
                className="rounded-2xl p-4 flex flex-col items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #4f7bff, #2848a8)',
                  color: 'white',
                  border: '3px solid #1a0d2e',
                  boxShadow: '0 5px 0 #1a2f6b',
                }}
              >
                <span className="text-3xl">🤝</span>
                <span className="font-bold">Co-op vs Boss</span>
                <span className="text-[10px] opacity-90">Team up vs AI Boss King</span>
              </motion.button>
            </div>
          </Card>
        </motion.div>

        {/* Join room */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-4" style={{ border: '3px solid #1a0d2e', boxShadow: '0 6px 0 #0a0418' }}>
            <h2 className="font-bold mb-3 flex items-center gap-2"><span>🔑</span> Join a room</h2>
            <div className="flex gap-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="ABCD"
                maxLength={4}
                className="text-2xl font-mono text-center tracking-widest"
                style={{ border: '2px solid #1a0d2e' }}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleJoin}
                disabled={!connected || !name.trim() || !joinCode.trim()}
                className="px-6 rounded-xl font-bold disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #2ecc71, #1a9850)',
                  color: 'white',
                  border: '2px solid #1a0d2e',
                  boxShadow: '0 4px 0 #0d4f2e',
                }}
              >
                Join
              </motion.button>
            </div>
          </Card>
        </motion.div>

        {/* How to play */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-4" style={{ border: '3px solid #1a0d2e', boxShadow: '0 6px 0 #0a0418' }}>
            <h2 className="font-bold mb-2 flex items-center gap-2"><span>📖</span> How to play</h2>
            <ul className="text-sm space-y-1.5 text-muted-foreground">
              <li className="flex gap-2"><span className="text-jumbo-pink font-bold">1.</span><span>Create a room or join with a 4-letter code</span></li>
              <li className="flex gap-2"><span className="text-jumbo-pink font-bold">2.</span><span>Pick your team & character class</span></li>
              <li className="flex gap-2"><span className="text-jumbo-pink font-bold">3.</span><span>Tap your piece, then tap a green tile to move</span></li>
              <li className="flex gap-2"><span className="text-jumbo-pink font-bold">4.</span><span>Jump enemies to capture them (chains = combo!)</span></li>
              <li className="flex gap-2"><span className="text-jumbo-pink font-bold">5.</span><span>Reach the far row to become a King 👑</span></li>
              <li className="flex gap-2"><span className="text-jumbo-pink font-bold">6.</span><span>Grab power-ups for chaos! Every 60s board flips 🎲</span></li>
            </ul>
          </Card>
        </motion.div>
      </main>

      <footer className="px-4 py-4 text-center text-xs text-muted-foreground relative z-10">
        Free forever · Mobile-first · No signup needed
      </footer>
    </div>
  )
}
