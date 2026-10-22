import { createContext, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ink, type Player } from './data.ts'
import { figlet, identicon } from './term.ts'

// true = Terminal theme. Components that render differently read it; the rest is CSS under [data-theme='terminal'].
export const Skin = createContext(false)

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const css = (o: Record<string, string | number>) => o as CSSProperties
const rem = () => Math.min(innerHeight * 0.02, innerWidth * 0.01125) // html font-size, see index.css

export function Identicon({ p }: { p: Player }) {
  const c = ink(p.color)
  return (
    <svg className="avatar" viewBox="-1 -1 7 7" aria-hidden>
      <rect x="-0.95" y="-0.95" width="6.9" height="6.9" fill={c} fillOpacity=".08" stroke={c} strokeOpacity=".45" strokeWidth=".1" />
      {identicon(p.name).map((on, i) => on && <rect key={i} x={i % 5} y={(i / 5) | 0} width="1.02" height="1.02" fill={c} />)}
    </svg>
  )
}

// [AL]: the dense avatar for lists.
export function Tag({ p }: { p: Player }) {
  const w = p.name.trim().split(/\s+/)
  return (
    <span className="tag-id up" style={{ color: ink(p.color) }}>
      [{w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)}]
    </span>
  )
}

// One block per buy-in, grouped in fives; new ones blink in.
export function Blocks({ n, color }: { n: number; color: string }) {
  const mounted = useRef(n).current, shown = Math.min(n, 20)
  return (
    <span className="stack blocks" style={{ color: ink(color) }} aria-hidden>
      {Array.from({ length: shown }, (_, i) => (
        <i key={i} className={i >= mounted ? 'new' : undefined}>
          █
        </i>
      ))}
      {n > shown && <em>+{n - shown}</em>}
    </span>
  )
}

export function Figlet({ text, max = 1.4 }: { text: string; max?: number }) {
  return (
    <pre className="figlet" aria-label={text} style={{ fontSize: `${Math.min(max, 120 / (text.length * 6))}rem` }}>
      {figlet(text).join('\n')}
    </pre>
  )
}

// Random glyphs that settle left to right into `text`.
const NOISE = '!<>-_\\/[]{}=+*^?#$%&01'
export function Scramble({ text, ms = 600 }: { text: string; ms?: number }) {
  const [k, setK] = useState(still() ? 1 : 0)
  useEffect(() => {
    if (k >= 1) return
    const t0 = performance.now()
    const i = setInterval(() => {
      const v = Math.min(1, (performance.now() - t0) / ms)
      setK(v)
      if (v === 1) clearInterval(i)
    }, 40)
    return () => clearInterval(i)
  }, [])
  const n = Math.floor(k * text.length)
  return <>{text.slice(0, n) + [...text.slice(n)].map(c => (c === ' ' ? c : NOISE[(Math.random() * NOISE.length) | 0])).join('')}</>
}

// Boot log; each line types out after the one before.
export function Boot({ nights, players }: { nights: number; players: number }) {
  const ls: [boolean, string][] = [
    [false, 'poker-live v1.0 (tty1)'],
    [true, `mounting history.json · ${nights} night${nights === 1 ? '' : 's'}`],
    [true, `loading ${players} players`],
    [true, 'starting jazz.service'],
    [true, 'reached target felt.target'],
  ]
  return (
    <div className="boot">
      {ls.map(([ok, t], i) => (
        <p key={i} className="type" style={css({ '--n': t.length + (ok ? 9 : 0), animationDelay: `${i * 0.35}s` })}>
          {ok && <b className="win up">[  OK  ] </b>}
          {t}
        </p>
      ))}
    </div>
  )
}

// Falling glyphs in one colour for `secs`, then the trails fade out. Replaces confetti.
const RAIN = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789$♠♥♦♣'
export function MatrixRain({ color, secs = 5 }: { color: string; secs?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (still()) return
    const c = ref.current!, g = c.getContext('2d')!, fs = Math.round(rem() * 1.1)
    c.width = innerWidth
    c.height = innerHeight
    const ys = Array.from({ length: Math.ceil(innerWidth / fs) }, () => Math.random() * -30)
    const end = performance.now() + secs * 1000
    let raf = 0, last = 0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 50) return
      last = now
      g.globalCompositeOperation = 'destination-out' // fade trails to transparent, not black, so the board shows through
      g.fillStyle = 'rgb(0 0 0 / 0.12)'
      g.fillRect(0, 0, c.width, c.height)
      g.globalCompositeOperation = 'source-over'
      if (now > end + 2000) return cancelAnimationFrame(raf)
      if (now > end) return
      g.font = `${fs}px ui-monospace, monospace`
      ys.forEach((y, i) => {
        g.fillStyle = Math.random() < 0.08 ? '#fff' : color
        g.fillText(RAIN[(Math.random() * RAIN.length) | 0], i * fs, y * fs)
        ys[i] = y * fs > c.height && Math.random() > 0.95 ? 0 : y + 1
      })
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="rain" aria-hidden />
}

// The lit dot grid as ASCII: cells near the cursor step up · : + * # by distance. Redraws only on mouse move.
const RAMP = '#*+:·'
export function CharGrid() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!
    let raf = 0, x = -1e4, y = -1e4
    const draw = () => {
      raf = 0
      const cell = rem() * 1.8, R = rem() * 9
      g.clearRect(0, 0, innerWidth, innerHeight)
      g.font = `${cell * 0.62}px ui-monospace, monospace`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      for (let i = Math.max(0, Math.floor((x - R) / cell)); (i + 0.5) * cell < x + R; i++)
        for (let j = Math.max(0, Math.floor((y - R) / cell)); (j + 0.5) * cell < y + R; j++) {
          const k = Math.hypot((i + 0.5) * cell - x, (j + 0.5) * cell - y) / R
          if (k >= 1) continue
          g.fillStyle = `rgb(57 255 136 / ${(0.5 * (1 - k)).toFixed(3)})`
          g.fillText(RAMP[Math.min(4, (k * 5) | 0)], (i + 0.5) * cell, (j + 0.5) * cell)
        }
    }
    const size = () => {
      const r = devicePixelRatio
      c.width = innerWidth * r
      c.height = innerHeight * r
      g.setTransform(r, 0, 0, r, 0, 0)
      draw()
    }
    const move = (e: PointerEvent) => ((x = e.clientX), (y = e.clientY), raf || (raf = requestAnimationFrame(draw)))
    size()
    addEventListener('resize', size)
    addEventListener('pointermove', move)
    return () => (cancelAnimationFrame(raf), removeEventListener('resize', size), removeEventListener('pointermove', move))
  }, [])
  return <canvas ref={ref} className="chargrid" />
}
