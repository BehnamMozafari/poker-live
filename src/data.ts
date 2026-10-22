import { settle, banker, type Payment } from './settle.ts'

export type { Payment }
export type Player = { id: string; name: string; color: string }
export type Event = { t: number; type: 'buyin' | 'cashout' | 'adjust'; player: string; cents: number }
export type Session = { id: string; name: string; startedAt: number; endedAt?: number; defaultBuyIn: number; banker?: boolean; host?: string; events: Event[] }
export type Timer = { mean: number; stdev: number; min: number } // minutes
export type Settings = { defaultBuyIn: number; buyIns: number[]; denoms: Record<string, number>; volume: number; music: boolean; timer: Timer }
export type Data = { players: Player[]; sessions: Session[]; settings: Settings }

// Chip colours double as player colours: face, edge spots, ink (readable on the dark background for text/lines).
export const CHIPS: Record<string, [string, string, string]> = {
  red: ['#c8102e', '#f4efe4', '#ff5a6e'], blue: ['#1d56c2', '#f4efe4', '#6d9dff'], black: ['#16181b', '#f4efe4', '#c3c9d1'], white: ['#f4efe4', '#1d56c2', '#f4efe4'],
  purple: ['#6a2da8', '#f4efe4', '#b57cf0'], orange: ['#e8701a', '#f4efe4', '#ff9a4d'], yellow: ['#f1c62d', '#16181b', '#f1c62d'], pink: ['#e5579a', '#f4efe4', '#ff7fb8'],
  green: ['#16a35a', '#f4efe4', '#4fe08f'], teal: ['#0fa3a8', '#f4efe4', '#3fd8dd'], maroon: ['#7a1f2b', '#f1c62d', '#e0697b'], gray: ['#7d848f', '#f4efe4', '#b4bac3'],
}
export const ink = (color: string) => (CHIPS[color] ?? CHIPS.gray)[2]

export type Mut = (fn: (d: Data) => void) => void
export type Who = (id: string) => Player

// Minutes until the hidden timer goes off: normal(mean, stdev) by Box–Muller, never under `min`. Returns ms.
export const roll = ({ mean, stdev, min }: Timer, r = Math.random) => Math.max(min, mean + stdev * Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())) * 6e4

export const DEFAULTS: Settings = {
  defaultBuyIn: 5000,
  buyIns: [2500, 5000, 10000],
  denoms: { white: 100, red: 500, blue: 1000, green: 2500, black: 10000 },
  volume: 0.6,
  music: true,
  timer: { mean: 20, stdev: 5, min: 10 },
}

const KEY = 'poker-live'
export function load(): Data {
  try {
    const d = parse(localStorage.getItem(KEY) ?? '')
    return { ...d, settings: { ...DEFAULTS, ...d.settings } }
  } catch {
    return { players: [], sessions: [], settings: DEFAULTS }
  }
}
export const save = (d: Data) => localStorage.setItem(KEY, JSON.stringify(d))
export function parse(json: string): Data {
  const d = JSON.parse(json)
  if (!Array.isArray(d?.players) || !Array.isArray(d?.sessions)) throw new Error('Not a Poker Live backup')
  return d
}

export const uid = () => crypto.randomUUID().slice(0, 8)
export const usd = (c: number, sign = false) =>
  (c < 0 ? '−' : sign && c > 0 ? '+' : '') + '$' + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })
export const cents = (dollars: string) => Math.round(parseFloat(dollars) * 100) || 0
export const ordinal = (n: number) => n + (n % 100 > 10 && n % 100 < 14 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
export const dur = (ms: number) => { const m = Math.round(ms / 6e4); return m < 60 ? `${m}m` : `${(m / 60) | 0}h ${m % 60}m` }
export const clock = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
export const nightName = (t = Date.now()) => new Date(t).toLocaleDateString('en-US', { weekday: 'long' }) + ' Night'
export const live = (d: Data) => d.sessions.find(s => !s.endedAt)
export const ended = (d: Data) => d.sessions.filter(s => s.endedAt).sort((a, b) => a.startedAt - b.startedAt)

export type Line = { id: string; in: number; out: number; adj: number; buyins: number; rebuys: number; net: number; seated: boolean; first: number }

// Per player tonight, in the order they sat down. `seated` = their last buy-in/cash-out was a buy-in.
export function lines(s: Session): Line[] {
  const m = new Map<string, Line>()
  for (const e of s.events) {
    let l = m.get(e.player)
    if (!l) m.set(e.player, (l = { id: e.player, in: 0, out: 0, adj: 0, buyins: 0, rebuys: 0, net: 0, seated: false, first: e.t }))
    if (e.type === 'buyin') (l.in += e.cents), l.buyins++, (l.seated = true)
    if (e.type === 'cashout') (l.out += e.cents), (l.seated = false)
    if (e.type === 'adjust') l.adj += e.cents
  }
  for (const l of m.values()) (l.rebuys = Math.max(0, l.buyins - 1)), (l.net = l.out + l.adj - l.in)
  return [...m.values()]
}

// Chip fixes (adjust) count like cash-outs, so a settled night has $0 in play.
export const delta = (e: Event) => (e.type === 'buyin' ? e.cents : -e.cents)
export const inPlay = (s: Session) => s.events.reduce((a, e) => a + delta(e), 0)

export type Fact = { k: string; id?: string; v: string }
export function facts(s: Session, now = Date.now()): Fact[] {
  const ls = lines(s), out: Fact[] = []
  const max = (f: (l: Line) => number) => ls.reduce<Line | undefined>((b, l) => (f(l) > (b ? f(b) : 0) ? l : b), undefined)
  const king = max(l => l.rebuys)
  if (king) out.push({ k: 'Rebuy King', id: king.id, v: `${king.rebuys} rebuy${king.rebuys > 1 ? 's' : ''}` })
  const deep = max(l => l.in)
  if (deep && ls.some(l => l.in < deep.in)) out.push({ k: 'Deepest In', id: deep.id, v: usd(deep.in) })
  const iron = ls.filter(l => l.seated && !l.rebuys).sort((a, b) => a.first - b.first)[0]
  if (iron && king) out.push({ k: 'Iron Stack', id: iron.id, v: `no rebuys · ${dur(now - iron.first)}` })
  const last: Record<string, number> = {}, seen = new Set<string>()
  let first: Event | undefined, fast: { id: string; gap: number } | undefined, run = 0, peak = 0
  for (const e of s.events) {
    if (e.type === 'buyin') {
      if (e.player in last) {
        first ??= e
        const gap = e.t - last[e.player]
        if (!fast || gap < fast.gap) fast = { id: e.player, gap }
      }
      last[e.player] = e.t
      seen.add(e.player)
    }
    run += delta(e)
    peak = Math.max(peak, run)
  }
  if (first) out.push({ k: 'First to Rebuy', id: first.player, v: `at ${clock(first.t)}` })
  if (fast) out.push({ k: 'Fastest Rebuy', id: fast.id, v: `${dur(fast.gap)} after buying in` })
  if (peak) out.push({ k: 'Peak on the Table', v: usd(peak) })
  out.push({ k: 'Time Played', v: dur((s.endedAt ?? now) - s.startedAt) })
  return out
}

export type Leader = { id: string; net: number; nights: number; best: number; streak: number }
export function leaderboard(nights: Session[]): Leader[] {
  const m = new Map<string, Leader>()
  for (const s of nights)
    for (const l of lines(s)) {
      const r = m.get(l.id) ?? { id: l.id, net: 0, nights: 0, best: -Infinity, streak: 0 }
      r.net += l.net
      r.nights++
      r.best = Math.max(r.best, l.net)
      r.streak = l.net > 0 ? r.streak + 1 : 0
      m.set(l.id, r)
    }
  return [...m.values()].sort((a, b) => b.net - a.net)
}

// Running all-time profit per player, one point per night (flat on nights they skipped).
export function profitSeries(nights: Session[]): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  nights.forEach((s, i) => {
    const net = Object.fromEntries(lines(s).map(l => [l.id, l.net]))
    for (const id of Object.keys(net)) out[id] ??= Array(i).fill(0)
    for (const id in out) out[id].push((out[id][i - 1] ?? 0) + (net[id] ?? 0))
  })
  return out
}

export function payments(s: Session): Payment[] {
  const bal = Object.fromEntries(lines(s).map(l => [l.id, l.net]))
  return s.banker && s.host ? banker(bal, s.host) : settle(bal)
}
