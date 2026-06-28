// Jumbo Royale - Simple production entrypoint (without Docker)
// Run with: `bun run start:all` (after `bun run build`)
// This starts both the Next.js server and the game-service in one process group.

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const PORT = process.env.PORT || '3000'
const GAME_PORT = process.env.GAME_SERVICE_PORT || '3003'

console.log(`[jumbo-royale] Starting production servers...`)
console.log(`[jumbo-royale] Web app:  http://localhost:${PORT}`)
console.log(`[jumbo-royale] Sockets:  ws://localhost:${GAME_PORT}`)

// Start game service
const game = spawn('bun', ['index.ts'], {
  cwd: path.join(root, 'mini-services/game-service'),
  stdio: 'inherit',
  env: { ...process.env, GAME_SERVICE_PORT: GAME_PORT },
})

// Start Next.js
const web = spawn('bun', ['.next/standalone/server.js'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production', PORT },
})

// Cleanup on exit
function killAll() {
  console.log('\n[jumbo-royale] Shutting down...')
  game.kill('SIGTERM')
  web.kill('SIGTERM')
  process.exit(0)
}
process.on('SIGINT', killAll)
process.on('SIGTERM', killAll)

game.on('exit', code => {
  console.log(`[jumbo-royale] Game service exited with code ${code}`)
  web.kill('SIGTERM')
  process.exit(code ?? 0)
})
web.on('exit', code => {
  console.log(`[jumbo-royale] Web app exited with code ${code}`)
  game.kill('SIGTERM')
  process.exit(code ?? 0)
})
