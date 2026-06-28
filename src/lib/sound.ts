// Jumbo Royale - Sound Manager
// Procedurally generates all SFX via Web Audio API (no external files needed).
// This keeps the game self-contained and zero-cost to host.

'use client'

type SfxName =
  | 'move'
  | 'capture'
  | 'multi_capture'
  | 'king'
  | 'select'
  | 'click'
  | 'chaos'
  | 'emote'
  | 'win'
  | 'lose'
  | 'join'
  | 'leave'
  | 'error'
  | 'turn_yours'
  | 'boss_rage'
  | 'teleport'
  | 'swap'
  | 'freeze'
  | 'powerup'
  | 'chat'

let ctx: AudioContext | null = null
let muted = false
let masterGain = 0.4

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (e) {
      return null
    }
  }
  // Resume if suspended (autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  return ctx
}

// --- Procedural sound generators ---

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = 0.3,
  startTime = 0,
  freqEnd?: number,
) {
  const audioCtx = getCtx()
  if (!audioCtx) return
  const t0 = audioCtx.currentTime + startTime
  const osc = audioCtx.createOscillator()
  const g = audioCtx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration)
  }
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain * masterGain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  osc.connect(g)
  g.connect(audioCtx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

function playNoise(
  duration: number,
  gain = 0.2,
  filterFreq = 1000,
  startTime = 0,
) {
  const audioCtx = getCtx()
  if (!audioCtx) return
  const t0 = audioCtx.currentTime + startTime
  const bufferSize = Math.floor(audioCtx.sampleRate * duration)
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) // decay
  }
  const source = audioCtx.createBufferSource()
  source.buffer = buffer
  const filter = audioCtx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = filterFreq
  const g = audioCtx.createGain()
  g.gain.value = gain * masterGain
  source.connect(filter)
  filter.connect(g)
  g.connect(audioCtx.destination)
  source.start(t0)
}

function playChord(freqs: number[], duration: number, type: OscillatorType = 'sine', gain = 0.2) {
  for (const f of freqs) playTone(f, duration, type, gain)
}

// --- Sound bank ---

const SFX: Record<SfxName, () => void> = {
  move: () => {
    // Soft "plop" - two quick tones
    playTone(440, 0.08, 'sine', 0.25)
    playTone(660, 0.06, 'sine', 0.2, 0.04)
  },
  capture: () => {
    // Punchy jump sound
    playTone(220, 0.12, 'square', 0.3, 0, 110)
    playNoise(0.08, 0.15, 800)
    playTone(880, 0.1, 'triangle', 0.2, 0.04)
  },
  multi_capture: () => {
    // Combo: ascending arpeggio
    playTone(523, 0.08, 'square', 0.25, 0)
    playTone(659, 0.08, 'square', 0.25, 0.06)
    playTone(784, 0.08, 'square', 0.25, 0.12)
    playTone(1047, 0.15, 'triangle', 0.3, 0.18)
    playNoise(0.15, 0.2, 1500, 0.18)
  },
  king: () => {
    // Triumphant fanfare
    playChord([523, 659, 784], 0.15, 'triangle', 0.2)
    playChord([659, 784, 1047], 0.15, 'triangle', 0.2, )
    void 0
    playTone(1047, 0.3, 'triangle', 0.3, 0.15)
    playTone(1319, 0.4, 'triangle', 0.3, 0.18)
  },
  select: () => {
    playTone(880, 0.05, 'sine', 0.15)
  },
  click: () => {
    playTone(660, 0.04, 'square', 0.12)
  },
  chaos: () => {
    // Wacky wobble
    playTone(200, 0.5, 'sawtooth', 0.2, 0, 800)
    playTone(400, 0.5, 'sawtooth', 0.15, 0, 1200)
    playNoise(0.3, 0.15, 2000)
  },
  emote: () => {
    playTone(1200, 0.08, 'sine', 0.2)
    playTone(1600, 0.08, 'sine', 0.15, 0.05)
  },
  win: () => {
    // Victory fanfare
    const notes = [523, 659, 784, 1047, 1319]
    notes.forEach((f, i) => playTone(f, 0.2, 'triangle', 0.3, i * 0.12))
    playChord([523, 659, 784, 1047], 0.6, 'triangle', 0.2, 0.6)
  },
  lose: () => {
    // Sad trombone
    playTone(440, 0.2, 'sawtooth', 0.3, 0, 415)
    playTone(415, 0.2, 'sawtooth', 0.3, 0.2, 392)
    playTone(392, 0.5, 'sawtooth', 0.3, 0.4, 350)
  },
  join: () => {
    playTone(659, 0.08, 'sine', 0.2)
    playTone(880, 0.12, 'sine', 0.2, 0.06)
  },
  leave: () => {
    playTone(880, 0.08, 'sine', 0.2)
    playTone(659, 0.12, 'sine', 0.2, 0.06)
  },
  error: () => {
    playTone(220, 0.15, 'square', 0.25, 0, 180)
    playTone(180, 0.15, 'square', 0.25, 0.05, 150)
  },
  turn_yours: () => {
    // Pleasant ping
    playTone(880, 0.1, 'sine', 0.2)
    playTone(1320, 0.15, 'sine', 0.2, 0.08)
  },
  boss_rage: () => {
    // Ominous low rumble
    playTone(80, 0.8, 'sawtooth', 0.4, 0, 60)
    playTone(120, 0.6, 'sawtooth', 0.3, 0.1, 80)
    playNoise(0.5, 0.25, 400)
  },
  teleport: () => {
    // Magic sparkle
    for (let i = 0; i < 6; i++) {
      playTone(800 + i * 200, 0.06, 'sine', 0.15, i * 0.04)
    }
  },
  swap: () => {
    playTone(440, 0.1, 'triangle', 0.2, 0, 880)
    playTone(880, 0.1, 'triangle', 0.2, 0.08, 440)
  },
  freeze: () => {
    // Crystalline shimmer
    playTone(2000, 0.15, 'sine', 0.15)
    playTone(2400, 0.15, 'sine', 0.12, 0.05)
    playTone(3000, 0.2, 'sine', 0.1, 0.1)
  },
  powerup: () => {
    // Power-up jingle
    playTone(523, 0.06, 'square', 0.2)
    playTone(659, 0.06, 'square', 0.2, 0.05)
    playTone(784, 0.06, 'square', 0.2, 0.1)
    playTone(1047, 0.15, 'triangle', 0.25, 0.15)
  },
  chat: () => {
    playTone(1000, 0.04, 'sine', 0.12)
  },
}

export function playSfx(name: SfxName) {
  if (muted) return
  try {
    SFX[name]()
  } catch (e) {
    // Audio context may not be ready; ignore
  }
}

export function setMuted(m: boolean) {
  muted = m
}

export function isMuted() {
  return muted
}

export function setMasterVolume(v: number) {
  masterGain = Math.max(0, Math.min(1, v))
}

export function getMasterVolume() {
  return masterGain
}

// Init audio on first user interaction (autoplay policy workaround)
export function initAudio() {
  getCtx()
}

// Lazy init when any sound is played for the first time
if (typeof window !== 'undefined') {
  const resumeOnInteraction = () => {
    getCtx()
  }
  window.addEventListener('click', resumeOnInteraction, { once: true })
  window.addEventListener('touchstart', resumeOnInteraction, { once: true })
  window.addEventListener('keydown', resumeOnInteraction, { once: true })
}
