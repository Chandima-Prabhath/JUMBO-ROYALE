'use client'
import { useJumbo } from '@/stores/jumbo'
import { AnyTeam, BotDifficulty } from '@/game/types'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { SoundToggle } from '@/components/game/SoundToggle'
import { Tooltip } from '@/components/game/Tooltip'
import { AnimalAvatar } from '@/components/game/assets'
import { PowerUpLegend, CharacterCodex } from '@/components/game/Codex'
import { copyToClipboard } from '@/lib/clipboard'
import { toast } from 'sonner'

const BOT_DIFFICULTIES: { id: BotDifficulty; label: string; emoji: string; desc: string }[] = [
  { id: 'easy', label: 'Easy', emoji: '🌱', desc: 'Casual, makes mistakes' },
  { id: 'medium', label: 'Medium', emoji: '⚔️', desc: 'Solid play, thinks ahead' },
  { id: 'hard', label: 'Hard', emoji: '🔥', desc: 'Deep minimax, tough opponent' },
  { id: 'brutal', label: 'Brutal', emoji: '💀', desc: 'Plays optimally, no mercy' },
]

export function LobbyScreen() {
  const { state, myPlayerId, updatePlayer, startGame, sendChat, chatMessages } = useJumbo()
  const [chatText, setChatText] = useState('')

  if (!state) return null

  const mySlot = state.players.find(p => p.id === myPlayerId)
  const isHost = mySlot?.isHost
  const connectedPlayers = state.players.filter(p => p.connected)
  const allReady = connectedPlayers.every(p => p.ready || p.isHost)

  const handleTeamPick = (team: AnyTeam) => {
    if (state.mode === 'coop') {
      toast.info('Co-op mode — everyone is on team RED!')
      return
    }
    updatePlayer({ team })
  }

  const handleReady = () => {
    updatePlayer({ ready: !mySlot?.ready })
  }

  const handleStart = () => {
    if (connectedPlayers.length < 2) {
      toast.error('Need at least 2 players — add a bot!')
      return
    }
    startGame()
  }

  const handleCopyCode = async () => {
    const ok = await copyToClipboard(state.roomCode)
    if (ok) toast.success('Room code copied!')
    else toast.error('Copy failed — manually type the code')
  }

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatText.trim()) return
    sendChat(chatText.slice(0, 200))
    setChatText('')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header — fixed height, no layout shift */}
      <header className="px-4 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-jumbo-pink leading-none" style={{ textShadow: '0 2px 0 #c43678, 0 4px 8px rgba(255,79,163,0.3)' }}>
              JUMBO ROYALE
            </h1>
            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
              <span>Room:</span>
              <button
                onClick={handleCopyCode}
                className="font-mono font-bold text-jumbo-yellow bg-jumbo-purple px-2 py-0.5 rounded hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                title="Click to copy"
              >
                {state.roomCode}
              </button>
              <span className="opacity-50">·</span>
              <span>{state.mode === 'pvp' ? '⚔️ PvP Chaos' : '🤝 Co-op vs Boss'}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="flex gap-1">
              <SoundToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                className="font-mono font-bold"
                title="Copy room code"
              >
                📋 Copy
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-4 max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Left column: players + character/team pick */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Players + Bots */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <span className="text-jumbo-pink">👥</span> Players
                <span className="text-sm font-normal text-muted-foreground">({connectedPlayers.length}/6)</span>
              </h2>
              {isHost && (
                <Tooltip content="Start the game (need 2+ players, everyone ready)">
                  <Button
                    onClick={handleStart}
                    disabled={connectedPlayers.length < 2 || !allReady}
                    className="font-bold transition-all"
                    style={{
                      background: connectedPlayers.length < 2 || !allReady
                        ? 'linear-gradient(135deg, #9b9b9b, #6b6b6b)'
                        : 'linear-gradient(135deg, #2ecc71, #1a9850)',
                      color: 'white',
                      border: '2px solid #1a0d2e',
                      boxShadow: connectedPlayers.length < 2 || !allReady ? 'none' : '0 3px 0 #0d4f2e',
                    }}
                  >
                    ▶️ Start Game
                  </Button>
                </Tooltip>
              )}
            </div>
            {/* Player list — stable height grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <AnimatePresence mode="popLayout">
                {state.players.map((p) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className={`p-3 rounded-xl border-2 flex items-center gap-3 ${
                      p.id === myPlayerId ? 'border-jumbo-yellow bg-yellow-50' : 'border-border'
                    } ${!p.connected ? 'opacity-40' : ''} ${p.isBot ? 'bg-purple-50 border-purple-200' : ''}`}
                  >
                    {p.avatar && <AnimalAvatar kind={p.avatar} size={36} />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-bold truncate">{p.name}</span>
                        {p.isHost && <span className="text-xs">👑</span>}
                        {p.isBot && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-200 text-purple-900 font-bold uppercase">
                            🤖 {p.botDifficulty}
                          </span>
                        )}
                        {p.ready && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-jumbo-green text-sm font-bold"
                          >
                            ✓ Ready
                          </motion.span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.team === 'red' ? '🔴 Red' : p.team === 'blue' ? '🔵 Blue' : '🟣 Boss'}
                      </div>
                    </div>
                    {p.isBot && isHost && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => useJumbo.getState().removeBot(p.id)}
                        className="text-jumbo-red hover:bg-red-50 px-2"
                        aria-label={`Remove ${p.name}`}
                      >
                        ✕
                      </Button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Add bot panel — animates in/out smoothly */}
            <AnimatePresence>
              {isHost && connectedPlayers.length < 6 && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50/50">
                    <div className="text-sm font-bold mb-2 flex items-center gap-1">🤖 Add a bot player</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {BOT_DIFFICULTIES.map((d) => (
                        <Tooltip key={d.id} content={d.desc} side="top">
                          <motion.button
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => useJumbo.getState().addBot(d.id)}
                            className="p-2 rounded-xl border-2 border-purple-200 bg-white hover:border-purple-400 text-left transition-colors w-full"
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-lg">{d.emoji}</span>
                              <span className="font-bold text-sm">{d.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-tight">{d.desc}</p>
                          </motion.button>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* Setup grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Team pick (PvP only) */}
            {state.mode === 'pvp' && (
              <Card className="p-4">
                <h2 className="font-bold mb-3 flex items-center gap-2"><span>🎨</span> Pick Team</h2>
                <div className="grid grid-cols-2 gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTeamPick('red')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      mySlot?.team === 'red'
                        ? 'border-jumbo-yellow'
                        : 'border-border hover:border-jumbo-pink'
                    }`}
                    style={{
                      background: mySlot?.team === 'red'
                        ? 'linear-gradient(135deg, #ff4fa3, #c43678)'
                        : 'linear-gradient(135deg, #fff8ef, #ffe1ef)',
                      color: mySlot?.team === 'red' ? 'white' : '#1a0d2e',
                    }}
                  >
                    <div className="font-bold">🔴 Red Team</div>
                    <div className="text-xs opacity-80">{state.players.filter(p => p.team === 'red').length}/3 players</div>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTeamPick('blue')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      mySlot?.team === 'blue'
                        ? 'border-jumbo-yellow'
                        : 'border-border hover:border-jumbo-blue'
                    }`}
                    style={{
                      background: mySlot?.team === 'blue'
                        ? 'linear-gradient(135deg, #4f7bff, #2848a8)'
                        : 'linear-gradient(135deg, #fff8ef, #e1ecff)',
                      color: mySlot?.team === 'blue' ? 'white' : '#1a0d2e',
                    }}
                  >
                    <div className="font-bold">🔵 Blue Team</div>
                    <div className="text-xs opacity-80">{state.players.filter(p => p.team === 'blue').length}/3 players</div>
                  </motion.button>
                </div>
              </Card>
            )}

            {/* Character guide (no selection needed — mixed pieces like chess) */}
            <Card className="p-4 md:col-span-2">
              <h2 className="font-bold mb-2 flex items-center gap-2 text-sm">
                <span>♟️</span> Your Army
                <span className="text-xs font-normal text-muted-foreground">
                  — you get a mix of all 4 types (like chess)
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <CharacterCodex team={mySlot?.team || 'red'} />
                <PowerUpLegend />
              </div>
            </Card>
          </div>

          {/* Ready button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleReady}
            className="w-full py-4 rounded-2xl font-bold text-lg transition-all"
            style={{
              background: mySlot?.ready
                ? 'linear-gradient(135deg, #2ecc71, #1a9850)'
                : 'linear-gradient(135deg, #ffd23f, #e6b800)',
              color: mySlot?.ready ? 'white' : '#1a0d2e',
              border: '3px solid #1a0d2e',
              boxShadow: '0 6px 0 #6b3aa0, 0 10px 20px rgba(0,0,0,0.2)',
            }}
          >
            {mySlot?.ready ? '✓ Ready! Tap to unready' : 'Tap when ready'}
          </motion.button>
        </div>

        {/* Right column (desktop only): chat */}
        <Card className="p-4 hidden lg:flex flex-col min-h-[400px] max-h-[calc(100vh-160px)]">
          <h2 className="font-bold mb-2 flex items-center gap-2 flex-shrink-0"><span>💬</span> Chat</h2>
          <div className="flex-1 overflow-y-auto min-h-0 mb-2 space-y-1.5 pr-1">
            <AnimatePresence initial={false}>
              {chatMessages.length === 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-muted-foreground italic"
                >
                  Say hi to your friends! 👋
                </motion.p>
              )}
              {chatMessages.map((m, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm flex gap-2 items-start"
                >
                  {m.avatar && <AnimalAvatar kind={m.avatar} size={24} />}
                  <div className="min-w-0 flex-1">
                    <span className="font-bold">{m.name}:</span>{' '}
                    <span className="break-words">{m.text}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <form onSubmit={handleSendChat} className="flex gap-2 flex-shrink-0">
            <Input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Type a message..."
              maxLength={200}
              autoComplete="off"
            />
            <Button type="submit" size="sm" className="bg-jumbo-pink text-white">Send</Button>
          </form>
        </Card>

        {/* Mobile chat (collapsible) */}
        <details className="lg:hidden">
          <summary className="cursor-pointer p-3 rounded-xl bg-card border-2 border-border font-bold flex items-center gap-2">
            💬 Chat {chatMessages.length > 0 && <span className="text-xs text-muted-foreground">({chatMessages.length})</span>}
          </summary>
          <Card className="p-4 mt-2 flex flex-col">
            <div className="overflow-y-auto min-h-[120px] max-h-[240px] mb-2 space-y-1.5">
              {chatMessages.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Say hi to your friends! 👋</p>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className="text-sm flex gap-2 items-start">
                  {m.avatar && <AnimalAvatar kind={m.avatar} size={24} />}
                  <div className="min-w-0 flex-1">
                    <span className="font-bold">{m.name}:</span>{' '}
                    <span className="break-words">{m.text}</span>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} className="flex gap-2">
              <Input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Type a message..."
                maxLength={200}
                autoComplete="off"
              />
              <Button type="submit" size="sm" className="bg-jumbo-pink text-white">Send</Button>
            </form>
          </Card>
        </details>
      </main>
    </div>
  )
}
