// Terminal theme: pure text helpers (no JSX, so node --test can load them).

// 5×5 pixel font for figlet banners, rows left to right.
export const FONT: Record<string, string> = {
  A: '01110 10001 11111 10001 10001', B: '11110 10001 11110 10001 11110', C: '01111 10000 10000 10000 01111', D: '11110 10001 10001 10001 11110',
  E: '11111 10000 11110 10000 11111', F: '11111 10000 11110 10000 10000', G: '01111 10000 10011 10001 01111', H: '10001 10001 11111 10001 10001',
  I: '11111 00100 00100 00100 11111', J: '00111 00001 00001 10001 01110', K: '10001 10010 11100 10010 10001', L: '10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10001 10001', N: '10001 11001 10101 10011 10001', O: '01110 10001 10001 10001 01110', P: '11110 10001 11110 10000 10000',
  Q: '01110 10001 10101 10010 01101', R: '11110 10001 11110 10010 10001', S: '01111 10000 01110 00001 11110', T: '11111 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 01110', V: '10001 10001 10001 01010 00100', W: '10001 10001 10101 11011 10001', X: '10001 01010 00100 01010 10001',
  Y: '10001 01010 00100 00100 00100', Z: '11111 00010 00100 01000 11111', 0: '01110 10011 10101 11001 01110', 1: '00100 01100 00100 00100 01110',
  2: '11110 00001 01110 10000 11111', 3: '11110 00001 00110 00001 11110', 4: '10010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 11110',
  6: '01110 10000 11110 10001 01110', 7: '11111 00001 00010 00100 00100', 8: '01110 10001 01110 10001 01110', 9: '01110 10001 01111 00001 01110',
  ' ': '00000 00000 00000 00000 00000', '-': '00000 00000 01110 00000 00000', '.': '00000 00000 00000 00000 00100', '!': '00100 00100 00100 00000 00100',
  '?': '01110 00001 00110 00000 00100', '$': '01111 10100 01110 00101 11110', '+': '00000 00100 01110 00100 00000', "'": '00100 00100 00000 00000 00000',
}

// Big block letters with a ░ drop shadow: 6 rows, 6 columns per character.
export function figlet(text: string) {
  const g = [...text.toUpperCase()].map(c => (FONT[c] ?? FONT['?']).split(' '))
  const on = (r: number, c: number) => g[Math.floor(c / 6)]?.[r]?.[c % 6] === '1'
  return Array.from({ length: 6 }, (_, r) => Array.from({ length: g.length * 6 }, (_, c) => (on(r, c) ? '█' : on(r - 1, c - 1) ? '░' : ' ')).join('').trimEnd())
}

// GitHub-style 5×5 identicon, mirrored left/right, the same for a name forever.
export function identicon(name: string) {
  let h = 2166136261 // FNV-1a, then a mix so short names still spread
  for (const ch of name.trim().toLowerCase()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h ^= h >>> 13
  const cells = Array.from({ length: 25 }, (_, i) => ((h >>> (((i / 5) | 0) * 3 + Math.min(i % 5, 4 - (i % 5)))) & 1) === 1)
  if (!cells.some(Boolean)) cells[12] = true
  return cells
}

const BARS = '▁▂▃▄▅▆▇█'
export const spark = (v: number[]) => {
  const lo = Math.min(...v), hi = Math.max(...v)
  return v.map(x => BARS[Math.round(((x - lo) / (hi - lo || 1)) * 7)]).join('')
}

// "Rebuy King" → "rebuy_king"
export const snake = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_')

// OHLC of a step series (`pts` = [t, value after], sorted) in `n` buckets of `w` ms from t0. v = money that came in.
export type Candle = { o: number; h: number; l: number; c: number; v: number }
export function candles(pts: [number, number][], t0: number, w: number, n: number): Candle[] {
  let i = 0, cur = 0
  return Array.from({ length: n }, (_, k) => {
    const c = { o: cur, h: cur, l: cur, c: cur, v: 0 }
    for (; i < pts.length && pts[i][0] < t0 + (k + 1) * w; i++) {
      c.v += Math.max(0, pts[i][1] - cur)
      cur = pts[i][1]
      c.h = Math.max(c.h, cur)
      c.l = Math.min(c.l, cur)
    }
    c.c = cur
    return c
  })
}

// Candles as text rows (top first), one char per candle at half-row resolution: body █▀▄, wick │╵╷, flat ─.
export function candleRows(cs: Candle[], rows: number, hi: number): string[] {
  const y = (v: number) => Math.round((v / (hi || 1)) * (rows * 2 - 1))
  return Array.from({ length: rows }, (_, i) => {
    const r = rows - 1 - i
    return cs
      .map(c => {
        const [b0, b1, w0, w1] = [y(Math.min(c.o, c.c)), y(Math.max(c.o, c.c)), y(c.l), y(c.h)]
        const lo = (a: number, b: number) => a <= 2 * r && 2 * r <= b, up = (a: number, b: number) => a <= 2 * r + 1 && 2 * r + 1 <= b
        if (c.h === c.l) return y(c.c) >> 1 === r ? '─' : ' '
        if (lo(b0, b1) || up(b0, b1)) return lo(b0, b1) && up(b0, b1) ? '█' : up(b0, b1) ? '▀' : '▄'
        if (lo(w0, w1) || up(w0, w1)) return lo(w0, w1) && up(w0, w1) ? '│' : up(w0, w1) ? '╵' : '╷'
        return ' '
      })
      .join('')
  })
}
