export type Payment = { from: string; to: string; cents: number }
export type Balances = Record<string, number> // + = is owed money, − = owes

// Fewest payments: the most disjoint zero-sum groups wins (each group of k settles in k−1).
// dp[m] = most zero-sum prefixes over any ordering of set m. 2^n·n, instant for n ≤ ~18.
export function settle(bal: Balances): Payment[] {
  const ids = Object.keys(bal).filter(id => bal[id])
  const n = ids.length, N = 1 << n
  const sum = new Float64Array(N), dp = new Int8Array(N)
  for (let m = 1; m < N; m++) {
    sum[m] = sum[m & (m - 1)] + bal[ids[31 - Math.clz32(m & -m)]]
    let best = 0
    for (let j = 0; j < n; j++) if (m >> j & 1) best = Math.max(best, dp[m ^ 1 << j])
    dp[m] = best + (sum[m] === 0 ? 1 : 0)
  }
  // walk the best ordering back, cutting a group each time the remaining set sums to zero
  const pays: Payment[] = []
  let group: string[] = []
  for (let m = N - 1; m; ) {
    const g = sum[m] === 0 ? 1 : 0
    let j = 0
    while (!(m >> j & 1) || dp[m ^ 1 << j] !== dp[m] - g) j++
    group.push(ids[j])
    m ^= 1 << j
    if (sum[m] === 0) { pays.push(...greedy(group, bal)); group = [] }
  }
  return pays
}

// Biggest loser pays biggest winner; k−1 payments inside a group with no smaller zero-sum subgroup.
function greedy(ids: string[], bal: Balances): Payment[] {
  const b = ids.map(id => ({ id, c: bal[id] })), out: Payment[] = []
  for (;;) {
    b.sort((x, y) => x.c - y.c)
    const lo = b[0], hi = b[b.length - 1]
    if (!lo || lo.c >= 0 || hi.c <= 0) return out
    const x = Math.min(-lo.c, hi.c)
    out.push({ from: lo.id, to: hi.id, cents: x })
    lo.c += x
    hi.c -= x
  }
}

export const banker = (bal: Balances, host: string): Payment[] =>
  Object.entries(bal).filter(([id, c]) => id !== host && c).map(([id, c]) => (c < 0 ? { from: id, to: host, cents: -c } : { from: host, to: id, cents: c }))

// Spread `cents` over the weights exactly (largest remainder). All-zero weights → split evenly.
export function split(cents: number, weights: Balances): Balances {
  const ids = Object.keys(weights), W = ids.reduce((s, id) => s + weights[id], 0)
  const w = (id: string) => (W ? weights[id] / W : 1 / ids.length)
  const abs = Math.abs(cents), raw = ids.map(id => abs * w(id)), base = raw.map(Math.floor)
  let left = abs - base.reduce((a, b) => a + b, 0)
  for (const i of ids.map((_, i) => i).sort((a, b) => raw[b] - base[b] - (raw[a] - base[a]))) if (left-- > 0) base[i]++
  return Object.fromEntries(ids.map((id, i) => [id, cents < 0 ? -base[i] : base[i]]))
}
