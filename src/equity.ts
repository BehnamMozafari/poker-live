export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
export const SUITS = ['s', 'h', 'd', 'c']
export const DECK = SUITS.flatMap(s => RANKS.map(r => r + s))

const RANK_VAL: Record<string, number> = {}
RANKS.forEach((r, i) => (RANK_VAL[r] = i + 2))
const rankVal = (code: string) => RANK_VAL[code[0]]

// Every 5-of-7 index combination, built once — lets the hot loop below read straight from the 7-card
// hand with no per-combo array allocation (it runs tens of millions of times for a full preflop equity run).
const COMBO5 = [] as [number, number, number, number, number][]
for (let a = 0; a < 7; a++)
  for (let b = a + 1; b < 7; b++) for (let c = b + 1; c < 7; c++) for (let d = c + 1; d < 7; d++) for (let e = d + 1; e < 7; e++) COMBO5.push([a, b, c, d, e]) // prettier-ignore

// A hand's value packed into one int: cat(4 bits) then up to 5 rank kickers (4 bits each) — comparable with plain > / <.
export const decode = (score: number) => [score >> 20, (score >> 16) & 15, (score >> 12) & 15, (score >> 8) & 15, (score >> 4) & 15, score & 15]

const cnt = new Int8Array(15) // reused scratch — rank(2-14) -> count among the 5 cards being scored right now
function score5(cards: string[], i0: number, i1: number, i2: number, i3: number, i4: number): number {
  cnt.fill(0)
  const c0 = cards[i0], c1 = cards[i1], c2 = cards[i2], c3 = cards[i3], c4 = cards[i4] // prettier-ignore
  const flush = c1[1] === c0[1] && c2[1] === c0[1] && c3[1] === c0[1] && c4[1] === c0[1]
  cnt[rankVal(c0)]++, cnt[rankVal(c1)]++, cnt[rankVal(c2)]++, cnt[rankVal(c3)]++, cnt[rankVal(c4)]++
  let straight = 0
  for (let hi = 14; hi >= 6; hi--) if (cnt[hi] && cnt[hi - 1] && cnt[hi - 2] && cnt[hi - 3] && cnt[hi - 4]) { straight = hi; break } // prettier-ignore
  if (!straight && cnt[14] && cnt[2] && cnt[3] && cnt[4] && cnt[5]) straight = 5 // wheel, A-2-3-4-5
  let quad = 0, trip = 0, pair1 = 0, pair2 = 0 // prettier-ignore
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0, s5 = 0 // singles, found high to low // prettier-ignore
  for (let r = 14; r >= 2; r--) {
    const n = cnt[r]
    if (n === 4) quad = r
    else if (n === 3) trip = r
    else if (n === 2) pair1 ? (pair2 = r) : (pair1 = r)
    else if (n === 1) s1 ? (s2 ? (s3 ? (s4 ? (s5 = r) : (s4 = r)) : (s3 = r)) : (s2 = r)) : (s1 = r)
  }
  let c: number, k1 = 0, k2 = 0, k3 = 0, k4 = 0, k5 = 0 // prettier-ignore
  if (straight && flush) (c = 8), (k1 = straight)
  else if (quad) (c = 7), (k1 = quad), (k2 = s1)
  else if (trip && pair1) (c = 6), (k1 = trip), (k2 = pair1)
  else if (flush) (c = 5), (k1 = s1), (k2 = s2), (k3 = s3), (k4 = s4), (k5 = s5)
  else if (straight) (c = 4), (k1 = straight)
  else if (trip) (c = 3), (k1 = trip), (k2 = s1), (k3 = s2)
  else if (pair1 && pair2) (c = 2), (k1 = pair1), (k2 = pair2), (k3 = s1)
  else if (pair1) (c = 1), (k1 = pair1), (k2 = s1), (k3 = s2), (k4 = s3)
  else (c = 0), (k1 = s1), (k2 = s2), (k3 = s3), (k4 = s4), (k5 = s5)
  return (c << 20) | (k1 << 16) | (k2 << 12) | (k3 << 8) | (k4 << 4) | k5
}

// Best 5-card value out of a 7-card hand (2 hole + 5 board).
export function best7(cards: string[]): number {
  let best = 0
  for (const [a, b, c, d, e] of COMBO5) {
    const v = score5(cards, a, b, c, d, e)
    if (v > best) best = v
  }
  return best
}

// Lazy k-combinations of `arr`, in lexicographic index order — avoids materialising millions of arrays up front.
function* combosGen<T>(arr: T[], k: number): Generator<T[]> {
  const n = arr.length
  if (k > n) return
  const idx = Array.from({ length: k }, (_, i) => i)
  while (true) {
    yield idx.map(i => arr[i])
    let i = k - 1
    while (i >= 0 && idx[i] === n - k + i) i--
    if (i < 0) return
    idx[i]++
    for (let j = i + 1; j < k; j++) idx[j] = idx[i] + (j - i)
  }
}

// Random k-subsets of `arr`, n of them (partial Fisher–Yates each time, so every subset is equally likely).
function* sample<T>(arr: T[], k: number, n: number): Generator<T[]> {
  const a = [...arr]
  for (let s = 0; s < n; s++) {
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(Math.random() * (a.length - i))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    yield a.slice(0, k)
  }
}

export const choose = (n: number, k: number) => Array.from({ length: k }, (_, i) => (n - i) / (i + 1)).reduce((a, b) => a * b, 1)
// ponytail: past this many runouts (preflop has 1.7M, a 1-card board 178k) sample instead, ±0.4% at 95%; raise it for accuracy
export const SAMPLES = 50000

export type EquityTally = { a: number; b: number; tie: number; total: number }

// Heads-up equity: every completion of the board when there are at most SAMPLES, else SAMPLES random ones.
// Yields progress every 2000 runouts so the caller can spread the work across ticks instead of blocking the main thread.
export function* runEquity(holeA: string[], holeB: string[], board: string[]): Generator<EquityTally, EquityTally, void> {
  const used = new Set([...holeA, ...holeB, ...board])
  const deck = DECK.filter(c => !used.has(c))
  const need = 5 - board.length
  let a = 0, b = 0, tie = 0, total = 0, i = 0 // prettier-ignore
  for (const extra of choose(deck.length, need) > SAMPLES ? sample(deck, need, SAMPLES) : combosGen(deck, need)) {
    const full = [...board, ...extra]
    const va = best7([...holeA, ...full]), vb = best7([...holeB, ...full]) // prettier-ignore
    if (va > vb) a++
    else if (va < vb) b++
    else tie++
    total++
    if (++i % 2000 === 0) yield { a, b, tie, total }
  }
  return { a, b, tie, total }
}
