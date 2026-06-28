'use client'
import { useJumbo } from '@/stores/jumbo'
import { CharacterClass, AnyTeam } from '@/game/types'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

const CHARACTERS: { id: CharacterClass; name: string; emoji: string; desc: string }[] = [
  { id: 'tank', name: 'Tank', emoji: '🛡️', desc: '2 HP, starts with shield. Slow but tough.' },
  { id: 'speedster', name: 'Speedster', emoji: '⚡', desc: 'Sneaky diagonal moves. Agile.' },
  { id: 'mage', name: 'Mage', emoji: '🧙', desc: 'Teleport once. Big brain plays.' },
  { id: 'jester', name: 'Jester', emoji: '🤡', desc: 'Swap places with anyone. Chaos!' },
]

const EMOJI_WHEEL = ['😂', '🔥', '💀', '🎉', '👏', '😭', '🤔', '👀', '❤️', '🤯', '🥳', '😤']

export function LobbyScreen() {
  const { state, myPlayerId, updatePlayer, startGame, sendChat, chatMessages } = useJumbo()
  const [chatText, setChatText] = useState('')

  if (!state) return null

  const mySlot = state.players.find(p => p.id === myPlayerId)
  const isHost = mySlot?.isHost
  const allReady = state.players.filter(p => p.connected).every(p => p.ready || p.isHost)
  const connectedPlayers = state.players.filter(p => p.connected)

  const handleTeamPick = (team: AnyTeam) => {
    if (state.mode === 'coop') {
      toast.info('Co-op mode — everyone is on team RED!')
      return
    }
    updatePlayer({ team })
  }

  const handleCharacterPick = (char: CharacterClass) => {
    updatePlayer({ character: char })
  }

  const handleReady = () => {
    updatePlayer({ ready: !mySlot?.ready })
  }

  const handleStart = () => {
    if (connectedPlayers.length < 2) {
      toast.error('Need at least 2 players!')
      return
    }
    startGame()
  }

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatText.trim()) return
    sendChat(chatText.slice(0, 200))
    setChatText('')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-jumbo-pink text-stroke-sm">
              JUMBO ROYALE
            </h1>
            <p className="text-sm text-muted-foreground">
              Room: <span className="font-mono font-bold text-jumbo-yellow">{state.roomCode}</span> · Mode: {state.mode === 'pvp' ? '⚔️ PvP Chaos' : '🤝 Co-op vs Boss'}
            </p>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-xs text-muted-foreground">Share code</div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(state.roomCode)
                toast.success('Room code copied!')
              }}
            >
              📋 {state.roomCode}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-4 max-w-4xl w-full mx-auto flex flex-col gap-4">
        {/* Player list */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg">Players ({connectedPlayers.length}/6)</h2>
            {isHost && (
              <Button
                onClick={handleStart}
                disabled={connectedPlayers.length < 2 || !allReady}
                className="bg-jumbo-green text-white font-bold shadow-bouncy-sm hover:brightness-110"
              >
                ▶️ Start Game
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {state.players.map(p => (
              <div
                key={p.id}
                className={`p-3 rounded-xl border-2 flex items-center gap-3 ${
                  p.id === myPlayerId ? 'border-jumbo-yellow bg-yellow-50' : 'border-border'
                } ${!p.connected ? 'opacity-40' : ''}`}
              >
                <div className="text-2xl">{p.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold truncate">{p.name}</span>
                    {p.isHost && <span className="text-xs">👑</span>}
                    {p.ready && <span className="text-jumbo-green text-sm">✓ Ready</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.team === 'red' ? '🔴 Red' : p.team === 'blue' ? '🔵 Blue' : '🟣 Boss'} · {CHARACTERS.find(c => c.id === p.character)?.emoji} {CHARACTERS.find(c => c.id === p.character)?.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Setup grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Team pick (PvP only) */}
          {state.mode === 'pvp' && (
            <Card className="p-4">
              <h2 className="font-bold mb-3">Pick Team</h2>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={mySlot?.team === 'red' ? 'default' : 'outline'}
                  onClick={() => handleTeamPick('red')}
                  className={mySlot?.team === 'red' ? 'bg-jumbo-pink text-white' : ''}
                >
                  🔴 Red Team
                </Button>
                <Button
                  variant={mySlot?.team === 'blue' ? 'default' : 'outline'}
                  onClick={() => handleTeamPick('blue')}
                  className={mySlot?.team === 'blue' ? 'bg-jumbo-blue text-white' : ''}
                >
                  🔵 Blue Team
                </Button>
              </div>
            </Card>
          )}

          {/* Character pick */}
          <Card className={`p-4 ${state.mode === 'coop' ? 'md:col-span-2' : ''}`}>
            <h2 className="font-bold mb-3">Pick Character</h2>
            <div className="grid grid-cols-2 gap-2">
              {CHARACTERS.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleCharacterPick(c.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    mySlot?.character === c.id
                      ? 'border-jumbo-yellow bg-yellow-50 shadow-bouncy-sm'
                      : 'border-border hover:border-jumbo-pink'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{c.emoji}</span>
                    <span className="font-bold">{c.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.desc}</p>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Ready button */}
        <Button
          onClick={handleReady}
          variant={mySlot?.ready ? 'default' : 'outline'}
          size="lg"
          className={`w-full font-bold shadow-bouncy-sm ${
            mySlot?.ready ? 'bg-jumbo-green text-white' : ''
          }`}
        >
          {mySlot?.ready ? '✓ Ready!' : 'Tap when ready'}
        </Button>

        {/* Chat */}
        <Card className="p-4 flex-1 min-h-[200px] flex flex-col">
          <h2 className="font-bold mb-2">Chat</h2>
          <div className="flex-1 overflow-y-auto min-h-[120px] max-h-[240px] mb-2 space-y-1">
            <AnimatePresence>
              {chatMessages.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Say hi to your friends! 👋</p>
              )}
              {chatMessages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm flex gap-2"
                >
                  <span>{m.avatar}</span>
                  <span className="font-bold">{m.name}:</span>
                  <span className="flex-1 break-words">{m.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <form onSubmit={handleSendChat} className="flex gap-2">
            <Input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Type a message..."
              maxLength={200}
              autoComplete="off"
            />
            <Button type="submit" size="sm">Send</Button>
          </form>
        </Card>
      </main>
    </div>
  )
}
