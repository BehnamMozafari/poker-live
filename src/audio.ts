// Everything is synthesized with Web Audio: generated lo-fi jazz + chip SFX, no files, works offline.
let ctx: AudioContext | undefined, master: GainNode, music: GainNode, fx: GainNode, keys: GainNode, low: BiquadFilterNode, noise: AudioBuffer
let vol = 0.6, timer = 0
const MUSIC = 0.5

function init() {
  if (ctx) return ctx
  ctx = new AudioContext()
  master = gain(vol, ctx.destination)
  const lofi = filter('lowpass', 3400)
  lofi.connect(master)
  music = gain(MUSIC, lofi)
  fx = gain(1, master)
  ;(low = filter('lowpass', 520)).connect(music)
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  noise.getChannelData(0).forEach((_, i, a) => (a[i] = Math.random() * 2 - 1))
  // Rhodes tremolo
  keys = gain(0.82, music)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 4.2
  lfo.connect(gain(0.18, keys.gain))
  lfo.start()
  // vinyl hiss under everything
  const hiss = ctx.createBufferSource()
  hiss.buffer = noise
  hiss.loop = true
  hiss.connect(filter('bandpass', 3000, 0.4)).connect(gain(0.012, music))
  hiss.start()
  return ctx
}

const gain = (v: number, out: AudioNode | AudioParam) => { const g = ctx!.createGain(); g.gain.value = v; g.connect(out as AudioNode); return g }
const filter = (type: BiquadFilterType, f: number, q = 1) => { const b = ctx!.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b }
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12)
const rnd = <T,>(a: T[]) => a[(Math.random() * a.length) | 0]

// Plucked/struck envelope: fast attack, exponential decay (time constant `tau`), cut at `len`.
function env(t: number, v: number, tau: number, len: number, out: AudioNode) {
  const g = ctx!.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(v, t + 0.005)
  g.gain.setTargetAtTime(0, t + 0.005, tau)
  g.gain.setTargetAtTime(0, t + len, 0.05)
  g.connect(out)
  return g
}

function tone(type: OscillatorType, f: number, t: number, v: number, tau: number, out: AudioNode, len = tau * 6) {
  const o = ctx!.createOscillator()
  o.type = type
  o.frequency.value = f
  o.connect(env(t, v, tau, len, out))
  o.start(t)
  o.stop(t + len + 0.3)
  return o
}

function burst(t: number, v: number, tau: number, f: FilterArgs, out: AudioNode = music) {
  const s = ctx!.createBufferSource()
  s.buffer = noise
  s.connect(filter(...f)).connect(env(t, v, tau, tau * 6, out))
  s.start(t, Math.random() * 1.5)
  s.stop(t + tau * 6 + 0.3)
}
type FilterArgs = [BiquadFilterType, number, number?]

// ── instruments ──
function rhodes(m: number, t: number, len: number, v: number) {
  const f = hz(m), car = ctx!.createOscillator(), mod = ctx!.createOscillator(), depth = ctx!.createGain()
  car.frequency.value = mod.frequency.value = f
  car.detune.value = (Math.random() - 0.5) * 10 // tape wobble
  depth.gain.setValueAtTime(f * 1.4, t)
  depth.gain.setTargetAtTime(f * 0.08, t, 0.18)
  mod.connect(depth).connect(car.frequency)
  car.connect(env(t, v, 0.9, len, keys))
  car.start(t), mod.start(t)
  car.stop(t + len + 0.3), mod.stop(t + len + 0.3)
}
const bass = (m: number, t: number, len: number) => tone('triangle', hz(m), t, 0.42, 0.35, low, len)
const vibes = (m: number, t: number) => (tone('sine', hz(m), t, 0.07, 0.6, keys), tone('sine', hz(m) * 4, t, 0.012, 0.15, keys))
const bell = (m: number, t: number) => (tone('sine', hz(m), t, 0.05, 0.9, keys), tone('sine', hz(m) * 2.76, t, 0.016, 0.2, keys))
const lead = (m: number, t: number) => rhodes(m, t, 0.5, 0.075)
const kick = (t: number, v = 0.55) => {
  const o = tone('sine', 120, t, v, 0.09, music)
  o.frequency.setValueAtTime(120, t)
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
}
const snare = (t: number, v = 0.22) => burst(t, v, 0.07, ['bandpass', 2200, 0.6])
const hat = (t: number, v: number) => burst(t, v, 0.02, ['highpass', 8000])

// ── generator ──
type Q = 'maj7' | 'm7' | '7' | 'm7b5' | '7b9'
const VOICING: Record<Q, number[]> = { maj7: [4, 7, 11, 14], m7: [3, 7, 10, 14], '7': [4, 9, 10, 14], m7b5: [3, 6, 10, 14], '7b9': [4, 10, 13, 20] }
const TONES: Record<Q, number[]> = { maj7: [4, 7, 9], m7: [3, 7, 10], '7': [4, 7, 10], m7b5: [3, 6, 10], '7b9': [4, 7, 10] }
const PROGS: [number, Q][][] = [
  [[2, 'm7'], [7, '7'], [0, 'maj7'], [0, 'maj7']],
  [[0, 'maj7'], [9, 'm7'], [2, 'm7'], [7, '7']],
  [[4, 'm7'], [9, '7'], [2, 'm7'], [7, '7']],
  [[5, 'maj7'], [4, 'm7'], [2, 'm7'], [0, 'maj7']],
  [[2, 'm7b5'], [7, '7b9'], [0, 'm7'], [0, 'm7']],
  [[2, 'm7'], [1, '7'], [0, 'maj7'], [9, '7']],
  [[2, 'm7'], [7, '7'], [4, 'm7'], [9, '7']],
  [[0, 'm7'], [5, '7'], [0, 'm7'], [5, '7']],
  [[5, 'm7'], [10, '7'], [0, 'maj7'], [0, 'maj7']],
  [[0, 'maj7'], [3, '7'], [2, 'm7'], [1, '7']],
  [[9, 'm7'], [2, '7'], [7, 'm7'], [0, '7']],
]
const COMP = [[0], [0, 3], [0, 5], [1, 4], [0, 3, 6], [0, 6]]

let key = 0, bpm = 78, swing = 0.64, busy = 0.5, half = false, brk = false, voice: (m: number, t: number) => void = vibes, prog = PROGS[0], chord = prog[0]
let step = 0, nextT = 0, comp: number[] = [], tune: number[] = [], last = 74

// Every 8 bars a new section rolls its own feel: tune, tempo drift, swing, density, two-feel bass, lead voice.
function bar(b: number) {
  if (b % 8 === 0) {
    prog = rnd(PROGS)
    if (b === 0 || Math.random() < 0.4) key = (key + rnd([2, 3, 5, 7, 8, 10])) % 12
    bpm = Math.min(92, Math.max(68, (b ? bpm : 78) + (Math.random() - 0.5) * 10))
    swing = 0.58 + Math.random() * 0.1
    busy = Math.random()
    half = Math.random() < 0.3
    voice = rnd([vibes, vibes, bell, lead])
  }
  const [deg, q] = prog[b % 4]
  chord = [q === '7' && Math.random() < 0.25 ? deg + 6 : deg, q] // tritone sub
  brk = b % 8 === 7 && Math.random() < 0.3 // stop-time break into the next section
  comp = rnd(COMP)
  tune = Math.random() < 0.25 + busy * 0.5 ? [0, 1, 2, 3, 4, 5, 6, 7].filter(() => Math.random() < 0.2 + busy * 0.3) : []
}

function play(s: number, t: number) {
  const pos = s % 8, b = (s / 8) | 0, beat = 60 / bpm
  if (pos === 0) bar(b)
  const [deg, q] = chord, [ndeg] = prog[(b + 1) % 4], root = (key + deg) % 12
  // drums: boom-bap kick, brushed backbeat, swung hats; half-time sections, ghost notes and the odd break
  if (brk) {
    if (pos === 0) kick(t)
    if (pos >= 5) snare(t, 0.05 + pos * 0.015), snare(t + beat / 4, 0.05)
  } else {
    if (pos === 0 || (!half && pos === 5) || (pos === 3 && Math.random() < 0.25)) kick(t)
    if (half ? pos === 4 : pos === 2 || pos === 6) snare(t)
    if (pos % 2 && Math.random() < busy * 0.25) snare(t, 0.04)
    if (Math.random() < 0.6 + busy * 0.35) hat(t, pos % 2 ? 0.05 : 0.09)
  }
  if (Math.random() < 0.3) burst(t + Math.random() * beat, Math.random() * 0.08, 0.002, ['highpass', 2500]) // crackle
  // walking bass on quarters (half notes in two-feel), chromatic approach into the next bar
  if (half ? pos % 4 === 0 : pos % 2 === 0) {
    const r = 36 + root, nr = 36 + ((key + ndeg) % 12)
    const m = pos === 0 ? r : pos === 6 ? nr + rnd([-1, 1]) : r + rnd(TONES[q])
    bass(m, t, beat * (half ? 1.8 : 0.9))
  }
  // Rhodes comping, voiced around middle C
  const i = comp.indexOf(pos)
  if (i >= 0) {
    let notes = VOICING[q].map(v => 48 + root + v).filter((_, k) => k < 2 || Math.random() < 0.8)
    const avg = notes.reduce((a, b) => a + b) / notes.length
    notes = notes.map(n => n + (avg > 66 ? -12 : avg < 54 ? 12 : 0))
    if (Math.random() < 0.2) notes.push(notes.at(-1)! + rnd([2, 5])) // colour on top
    const len = (((comp[i + 1] ?? 8) - pos) * beat) / 2
    notes.forEach((n, k) => rhodes(n, t + k * 0.012, len, 0.055))
  }
  // sparse melody from chord tones, mostly small steps with the odd leap and chromatic grace note
  if (tune.includes(pos)) {
    const pool = [0, ...VOICING[q]].map(v => root + v).flatMap(pc => [60, 72, 84].map(o => o + (pc % 12))).filter(n => n >= 67 && n <= 86)
    last = Math.random() < 0.15 ? rnd(pool) : pool.sort((a, b) => Math.abs(a - last) - Math.abs(b - last))[(Math.random() * 3) | 0]
    if (Math.random() < 0.15) voice(last - 1, t - 0.06)
    voice(last, t + (Math.random() - 0.5) * 0.02)
  }
}

function tick() {
  while (nextT < ctx!.currentTime + 0.25) {
    play(step, nextT)
    nextT += (60 / bpm) * (step++ % 2 ? 1 - swing : swing)
  }
}

// ── public ──
export function unlock() {
  init().resume()
}

export function setMusic(on: boolean) {
  if (!ctx) return
  clearInterval(timer)
  timer = 0
  if (on) (step = 0), (nextT = ctx.currentTime + 0.1), (timer = setInterval(tick, 50))
}

export function setVolume(v: number) {
  vol = v
  if (ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05)
}

function duck(len: number) {
  const t = ctx!.currentTime
  music.gain.cancelScheduledValues(t)
  music.gain.setTargetAtTime(MUSIC * 0.25, t, 0.03)
  music.gain.setTargetAtTime(MUSIC, t + len, 0.5)
  return t
}

function clink(t: number, v: number) {
  const f = 2300 + Math.random() * 1000
  for (const [r, tau] of [[1, 0.09], [1.51, 0.06], [2.17, 0.04], [2.89, 0.03]]) tone('sine', f * r, t, v / r, tau, fx)
  burst(t, v * 0.8, 0.003, ['highpass', 5000], fx)
}

const sounds = {
  buyin(rebuy: boolean) {
    const t = duck(1.2)
    if (rebuy) burst(t, 0.12, 0.25, ['bandpass', 1200, 0.8], fx) // whoosh under the lower third
    ;[0, 0.08, 0.14, 0.19].forEach((d, i) => clink(t + 0.25 + d, 0.22 - i * 0.03))
  },
  cashout() {
    const t = duck(1.6)
    ;[0, 0.05, 0.09, 0.12, 0.16].forEach(d => clink(t + d, 0.15))
    ;[1568, 2093, 2637].forEach((f, i) => tone('triangle', f, t + 0.2 + i * 0.07, 0.12, 0.4, fx))
  },
  drumroll(len: number) {
    const t = duck(len + 2)
    for (let d = 0; d < len; d += 0.045) burst(t + d, 0.04 + (0.3 * d) / len, 0.05, ['bandpass', 2000, 0.5], fx)
  },
  crash() {
    const t = duck(2.5)
    burst(t, 0.45, 0.7, ['highpass', 3500], fx)
    tone('sine', 70, t, 0.8, 0.25, fx)
  },
  tick() {
    tone('sine', 140, ctx!.currentTime, 0.4, 0.06, fx)
    clink(ctx!.currentTime, 0.08)
  },
}
// Silent until the first click has created the AudioContext.
export const sfx = Object.fromEntries(Object.entries(sounds).map(([k, f]) => [k, (...a: [never]) => ctx && f(...a)])) as typeof sounds
