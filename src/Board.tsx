import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CHIPS, ink, usd, ordinal, clock, dur, lines, delta, type Session, type Line, type Event, type Who, type Player, type Leader, type Fact } from './data.ts'
import type { Payment } from './settle.ts'
import { sfx } from './audio.ts'

export const vars = (o: Record<string, string | number>) => o as CSSProperties

const BANDS = [0, 0.07, 0.15, 0.4, 0.6, 0.85, 0.93, 1]
// Shared SVG gradients: striped chip edges per colour, cylinder shading.
export function ChipDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        {Object.entries(CHIPS).map(([k, [face, edge]]) => (
          <linearGradient key={k} id={'edge-' + k}>
            {BANDS.slice(1).flatMap((end, i) => [BANDS[i], end].map((o, j) => <stop key={i * 2 + j} offset={o} stopColor={i % 2 ? edge : face} />))}
          </linearGradient>
        ))}
        <linearGradient id="shade">
          <stop offset="0" stopColor="#000" stopOpacity=".6" />
          <stop offset=".32" stopColor="#fff" stopOpacity=".16" />
          <stop offset=".6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".65" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// Initials in a ring of the player's colour; the dashed inner ring is the chip edge.
export function Avatar({ p }: { p: Player }) {
  const c = ink(p.color)
  const initials = p.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <svg className="avatar" viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="47" fill={c} fillOpacity=".1" stroke={c} strokeWidth="3" />
      <circle cx="50" cy="50" r="40" fill="none" stroke={c} strokeOpacity=".35" strokeWidth="4" strokeDasharray="10.47 10.47" />
      <text x="50" y="50" dy=".36em" textAnchor="middle" fill={c} fontSize={initials.length > 1 ? 30 : 36}>
        {initials}
      </text>
    </svg>
  )
}

// Side-on chip stacks, one chip per buy-in, 5 to a stack. New chips drop in; hovering the row fans them.
const R = 24, T = 15, H = 2 * R + 5 * T + 4
export function Stack({ n, color }: { n: number; color: string }) {
  const mounted = useRef(n).current
  const shown = Math.min(n, 20), stacks = Math.ceil(shown / 5)
  const [face, edge] = CHIPS[color] ?? CHIPS.gray
  return (
    <svg className="stack" viewBox={`-2 0 ${stacks * 112 - 8} ${H}`} overflow="visible" aria-hidden>
      {Array.from({ length: shown }, (_, i) => {
        const x = Math.floor(i / 5) * 112, y = H - 2 - R - T * ((i % 5) + 1)
        const band = `M${x},${y} v${T} a50,${R} 0 0 0 100,0 v${-T} a50,${R} 0 0 1 -100,0z`
        return (
          <g key={i} className="drop" style={vars({ '--i': i % 5, animationDelay: i < mounted ? `${i * 45}ms` : '0ms' })}>
            <path d={band} fill={`url(#edge-${color in CHIPS ? color : 'gray'})`} />
            <path d={band} fill="url(#shade)" />
            <ellipse cx={x + 50} cy={y} rx="50" ry={R} fill={face} />
            <ellipse cx={x + 50} cy={y} rx="42" ry={R * 0.8} fill="none" stroke={edge} strokeWidth="6" strokeDasharray="12 10" />
            <ellipse cx={x + 50} cy={y} rx="30" ry={R * 0.58} fill="#fff" fillOpacity=".1" stroke={edge} strokeOpacity=".5" strokeWidth="1.5" />
          </g>
        )
      })}
      {n > shown && (
        <text x={stacks * 112} y={H - 8} className="more">
          +{n - shown}
        </text>
      )}
    </svg>
  )
}

export function Header({ night, now }: { night?: Session; now: number }) {
  return (
    <header className="hdr">
      <div className="bar">
        <span className="brand">
          <i>♠</i>Poker Live{night && <em>{night.name}</em>}
        </span>
        {night && (
          <span className="live">
            <i />
            Live · {dur(now - night.startedAt)}
          </span>
        )}
        <b className="num">{clock(now)}</b>
      </div>
      {night && <Quote night={night} now={now} />}
    </header>
  )
}

// Tonight as a stock quote: money in play is the price, the session its step chart (hover for any moment).
function Quote({ night, now }: { night: Session; now: number }) {
  const [hover, setHover] = useState<number>()
  const pts: [number, number][] = [[night.startedAt, 0]]
  for (const e of night.events) pts.push([e.t, pts.at(-1)![1] + delta(e)])
  const ls = lines(night), t0 = night.startedAt, t1 = Math.max(now, pts.at(-1)![0] + 1), cur = pts.at(-1)![1], high = Math.max(...pts.map(p => p[1]))
  const X = (t: number) => ((t - t0) / (t1 - t0)) * 100, Y = (v: number) => 94 - (v / (high || 1)) * 80
  const d = `M0 ${Y(0)}` + pts.slice(1).map(([t, v]) => `H${X(t)}V${Y(v)}`).join('') + 'H100'
  const at = hover === undefined ? undefined : pts.findLast(p => X(p[0]) <= hover)
  return (
    <div className="quote">
      <div>
        <small>In play</small>
        <b className="price num">{usd(cur)}</b>
        <dl>
          {[
            ['Open', clock(t0)],
            ['High', usd(high)],
            ['Volume', usd(ls.reduce((a, l) => a + l.in, 0))],
            ['Seated', `${ls.filter(l => l.seated).length}/${ls.length}`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className="num">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div
        className="spark"
        onPointerMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          setHover(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)))
        }}
        onPointerLeave={() => setHover(undefined)}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="spark-fill" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity=".1" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={d + 'V100H0Z'} fill="url(#spark-fill)" />
          <path d={d} className="line" vectorEffect="non-scaling-stroke" />
        </svg>
        <i className="tip" style={{ top: Y(cur) + '%' }} />
        {at && hover !== undefined && (
          <span className={hover > 75 ? 'cross flip' : 'cross'} style={vars({ left: hover + '%', '--y': Y(at[1]) + '%' })}>
            <span>
              <b className="num">{usd(at[1])}</b>
              {clock(t0 + (hover / 100) * (t1 - t0))}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

export function LiveBoard({ night, who, flash, onPick }: { night: Session; who: Who; flash?: string; onPick: (id: string) => void }) {
  const ls = lines(night), cols = ls.length > 8 ? 2 : 1
  if (!ls.length) return <div className="empty">Nobody at the table yet. Move the mouse → ＋ Player</div>
  return (
    <div className="board" style={vars({ '--cols': cols, '--rows': Math.ceil(ls.length / cols) })}>
      {ls.map((l, i) => {
        const p = who(l.id)
        return (
          <button key={l.id} className={`row glow${l.seated ? '' : ' out'}${flash === l.id ? ' flash' : ''}`} style={vars({ '--c': ink(p.color), animationDelay: `${i * 60}ms` })} onClick={() => onPick(l.id)}>
            <span className="row-in">
            <Avatar p={p} />
            <div className="who">
              <b>{p.name}</b>
              <small>{l.seated ? `In since ${clock(l.first)}` : `Cashed out ${usd(l.out)}`}</small>
            </div>
            <Stack n={l.buyins} color={p.color} />
            <span className="rebuys">
              {l.rebuys > 0 && (
                <>
                  <small>Rebuys</small>×{l.rebuys}
                </>
              )}
            </span>
            <span className="money">
              <small>{l.seated ? 'In' : 'Net'}</small>
              <b className={l.seated ? '' : l.net >= 0 ? 'win' : 'loss'}>{l.seated ? usd(l.in) : usd(l.net, true)}</b>
            </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

const rank = (i: number) => String(i + 1).padStart(2, '0')

const Title = ({ kicker, title }: { kicker: string; title: string }) => (
  <div className="title">
    <small>{kicker}</small>
    <h1>{title}</h1>
  </div>
)

// All-time profit after each night, from $0.
function Trend({ pts }: { pts: number[] }) {
  const v = [0, ...pts], lo = Math.min(...v), hi = Math.max(...v)
  return (
    <svg className={`trend ${v.at(-1)! >= 0 ? 'win' : 'loss'}`} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
      <polyline points={v.map((y, i) => `${(i / (v.length - 1)) * 100},${28 - ((y - lo) / (hi - lo || 1)) * 26}`).join(' ')} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function Leaders({ rows, who, nights, series }: { rows: Leader[]; who: Who; nights: number; series: Record<string, number[]> }) {
  return (
    <section className="body">
      <Title kicker={`${nights} night${nights > 1 ? 's' : ''} played`} title="All-time leaderboard" />
      <div className="lb">
        <div className="lb-row th">
          <span>#</span>
          <span />
          <span>Player</span>
          <span>Nights</span>
          <span>Best night</span>
          <span>Streak</span>
          <span>Trend</span>
          <span>Net</span>
        </div>
        {rows.slice(0, 10).map((r, i) => (
          <div key={r.id} className={`lb-row glow r${i + 1}`} style={vars({ '--c': ink(who(r.id).color), animationDelay: `${i * 70}ms` })}>
            <span className="rank num">{rank(i)}</span>
            <Avatar p={who(r.id)} />
            <b>{who(r.id).name}</b>
            <span className="num">{r.nights}</span>
            <span className="num">{usd(r.best, true)}</span>
            <span className="num win">{r.streak > 1 ? `▲ ${r.streak}` : ''}</span>
            <Trend pts={series[r.id] ?? []} />
            <b className={`num ${r.net >= 0 ? 'win' : 'loss'}`}>{usd(r.net, true)}</b>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Facts({ items, who }: { items: Fact[]; who: Who }) {
  return (
    <section className="body">
      <Title kicker="Tonight" title="The story so far" />
      <div className="facts">
        {items.map((f, i) => (
          <div key={f.k} className="fact glow" style={vars({ '--c': f.id ? ink(who(f.id).color) : 'var(--fg)', animationDelay: `${i * 90}ms` })}>
            <small>{f.k}</small>
            {f.id ? (
              <>
                <div className="fact-who">
                  <Avatar p={who(f.id)} />
                  <b>{who(f.id).name}</b>
                </div>
                <span>{f.v}</span>
              </>
            ) : (
              <b className="num big">{f.v}</b>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export function Ticker({ tag, items }: { tag: string; items: string[] }) {
  const seq = [...items, ...items, ...items, ...items]
  return (
    <div className="ticker">
      <span className="tag">
        <i />
        {tag}
      </span>
      <div className="track-wrap">
        <div className="track" style={{ animationDuration: `${Math.max(30, items.join('').length * 0.5)}s` }}>
          {seq.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// Slides in on each buy-in / rebuy / cash-out; the bar along the bottom runs down its time on screen.
export function Toast({ e, line, p }: { e: Event; line: Line; p: Player }) {
  const re = e.type === 'buyin' && line.buyins > 1
  const [tag, text] =
    e.type === 'cashout' ? ['Cash out', `Cashes out ${usd(e.cents)}`] : re ? ['Rebuy', `${ordinal(line.rebuys)} rebuy · ${usd(e.cents)}`] : ['Buy-in', `Buys in · ${usd(e.cents)}`]
  return (
    <div className={`toast ${re ? 'rebuy' : e.type}`} style={vars({ '--c': ink(p.color) })}>
      <Avatar p={p} />
      <div>
        <small>{tag}</small>
        <b>{p.name}</b>
        <span>{text}</span>
      </div>
      <div className="toast-num">
        <small>{e.type === 'cashout' ? 'Net' : 'Total in'}</small>
        <b className={`num ${e.type === 'cashout' ? (line.net >= 0 ? 'win' : 'loss') : ''}`}>{e.type === 'cashout' ? usd(line.net, true) : usd(line.in)}</b>
      </div>
    </div>
  )
}

// End of night: reveal results from the bottom up (drumroll for the winner), then alternate with payments.
export function Final({ night, who, pays }: { night: Session; who: Who; pays: Payment[] }) {
  const ls = lines(night).sort((a, b) => b.net - a.net)
  const [shown, setShown] = useState(0)
  const [view, setView] = useState<'results' | 'pay'>('results')
  useEffect(() => {
    if (shown >= ls.length) {
      const t = setTimeout(() => setView(v => (v === 'results' ? 'pay' : 'results')), view === 'results' ? 12e3 : 20e3)
      return () => clearTimeout(t)
    }
    const champ = shown === ls.length - 1
    if (champ) sfx.drumroll(2.2)
    const t = setTimeout(() => (setShown(s => s + 1), champ ? sfx.crash() : sfx.tick()), champ ? 2400 : shown ? 900 : 1400)
    return () => clearTimeout(t)
  }, [shown, view, ls.length])

  if (view === 'pay')
    return (
      <section className="body">
        <Title kicker={night.banker && night.host ? `Everyone settles with ${who(night.host).name}` : pays.length === 1 ? 'One payment settles it' : `${pays.length} payments settle it`} title="Settle up" />
        <div className="pays" style={{ fontSize: `${Math.min(2.6, 12 / Math.max(1, pays.length))}rem` }}>
          {pays.length ? (
            pays.map((p, i) => (
              <div key={i} className="pay glow" style={{ animationDelay: `${i * 120}ms` }}>
                <span className="pay-who">
                  <Avatar p={who(p.from)} />
                  {who(p.from).name}
                </span>
                <span className="pays-word">pays</span>
                <span className="pay-who">
                  <Avatar p={who(p.to)} />
                  {who(p.to).name}
                </span>
                <b className="num">{usd(p.cents)}</b>
              </div>
            ))
          ) : (
            <div className="empty">All square. Nobody owes anybody.</div>
          )}
        </div>
      </section>
    )

  return (
    <section className="body">
      <Title kicker={night.name} title="Final results" />
      <div className="results">
        {ls.map((l, i) => {
          const p = who(l.id)
          return (
            <div key={l.id} className={`res glow${i >= ls.length - shown ? ' on' : ''}${i === 0 ? ' champ' : ''}`} style={vars({ '--c': ink(p.color) })}>
              <span className="rank num">{rank(i)}</span>
              <Avatar p={p} />
              <b>{p.name}</b>
              <span className="dim num">
                in {usd(l.in)} · out {usd(l.out + l.adj)}
              </span>
              <b className={`num ${l.net >= 0 ? 'win' : 'loss'}`}>{usd(l.net, true)}</b>
            </div>
          )
        })}
      </div>
      {shown === ls.length && <Confetti />}
    </section>
  )
}

const CONFETTI = ['#fff', ...Object.values(CHIPS).map(c => c[2])]
function Confetti() {
  const bits = useMemo(() => Array.from({ length: 140 }, (_, i) => ({ l: Math.random() * 100, d: Math.random() * 1.8, s: 2.8 + Math.random() * 2.6, w: 0.35 + Math.random() * 0.5, r: Math.random() * 360, c: CONFETTI[i % CONFETTI.length] })), [])
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, i) => (
        <i key={i} style={{ left: `${b.l}%`, width: `${b.w}rem`, background: b.c, transform: `rotate(${b.r}deg)`, animationDelay: `${b.d}s`, animationDuration: `${b.s}s` }} />
      ))}
    </div>
  )
}

export function Home({ onStart }: { onStart: () => void }) {
  return (
    <section className="home">
      <span className="mark">♠</span>
      <h1>Poker Live</h1>
      <p>Home game tracker</p>
      <button className="btn primary big" onClick={onStart}>
        Start tonight's game
      </button>
    </section>
  )
}

// A random-walk "price" across the screen; `up` = it closed higher than it opened.
function walk() {
  const y0 = 25 + Math.random() * 40
  let y = y0, d = `M-2 ${y0}`
  for (let x = 0.5; x <= 162; x += 2.5) d += `L${x} ${(y = Math.min(85, Math.max(5, y + (Math.random() - 0.5) * 5))).toFixed(1)}`
  return { d, up: y < y0 }
}

type Bit = { id: number; kind: string; x: number; y: number; z: number; d?: string; up?: boolean }
const KINDS = ['walk', 'walk', 'suit', 'ping', 'streak']
let bitId = 0 // module-level: StrictMode remounts the effect while old bits are still on screen

// Background life: drifting aurora, a dot grid the cursor lights up, a trailing ring cursor that swells over
// anything clickable, a ping on every click, and every few seconds one random animation (price line, suit, ping, streak).
export function Ambient() {
  const [bits, setBits] = useState<Bit[]>([])
  const spot = useRef<HTMLDivElement>(null), ring = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let t = 0
    const add = (b: Omit<Bit, 'id'>) => {
      const id = bitId++
      setBits(bs => [...bs.slice(-9), { ...b, id }])
    }
    const spawn = () => {
      const kind = KINDS[(Math.random() * KINDS.length) | 0]
      add({ kind, x: 5 + Math.random() * 90, y: 5 + Math.random() * 90, z: Math.random(), ...(kind === 'walk' ? walk() : {}) })
      t = setTimeout(spawn, 2500 + Math.random() * 5000)
    }
    const move = (e: PointerEvent) => {
      const el = e.target as Element
      spot.current?.style.setProperty('--mx', e.clientX + 'px')
      spot.current?.style.setProperty('--my', e.clientY + 'px')
      ring.current?.style.setProperty('translate', `${e.clientX}px ${e.clientY}px`)
      ring.current?.classList.toggle('hot', !!el.closest?.('button, label, input, select, .spark'))
      const g = el.closest?.<HTMLElement>('.glow')
      if (g) {
        const r = g.getBoundingClientRect()
        g.style.setProperty('--x', e.clientX - r.left + 'px')
        g.style.setProperty('--y', e.clientY - r.top + 'px')
      }
    }
    const down = (e: PointerEvent) => add({ kind: 'ping', x: (e.clientX / innerWidth) * 100, y: (e.clientY / innerHeight) * 100, z: 0 })
    spawn()
    addEventListener('pointermove', move)
    addEventListener('pointerdown', down)
    return () => (clearTimeout(t), removeEventListener('pointermove', move), removeEventListener('pointerdown', down))
  }, [])
  return (
    <>
      <div className="ambient" aria-hidden>
        <i className="aurora a1" />
        <i className="aurora a2" />
        <i className="aurora a3" />
        <div className="grid" />
        <div ref={spot} className="grid spot" />
        {bits.map(b =>
          b.kind === 'walk' ? (
            <svg key={b.id} className={`bit walk ${b.up ? 'win' : 'loss'}`} viewBox="0 0 160 90" preserveAspectRatio="none">
              <path d={b.d} pathLength={1} />
            </svg>
          ) : (
            <i key={b.id} className={`bit ${b.kind}`} style={vars({ left: b.x + '%', top: b.y + '%', '--z': b.z })}>
              {b.kind === 'suit' && '♠♥♦♣'[(b.z * 4) | 0]}
            </i>
          ),
        )}
      </div>
      <div ref={ring} className="ring" aria-hidden />
    </>
  )
}
