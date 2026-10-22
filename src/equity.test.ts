import { test } from 'node:test'
import assert from 'node:assert/strict'
import { best7, decode, runEquity, SAMPLES, type EquityTally } from './equity.ts'

const best5 = (cards: string[]) => decode(best7(cards))

const drain = (gen: Generator<EquityTally, EquityTally, void>) => {
  let r = gen.next()
  while (!r.done) r = gen.next()
  return r.value
}

test('best5 ranks categories in order: straight flush > quads > full house > flush > straight > trips > two pair > pair > high card', () => {
  const hands = [
    ['As', 'Ks', 'Qs', 'Js', 'Ts', '2h', '3d'], // straight flush
    ['Ah', 'Ad', 'Ac', 'As', 'Kh', '2d', '3c'], // quads
    ['Ah', 'Ad', 'Ac', 'Kh', 'Kd', '2c', '3s'], // full house
    ['2h', '5h', '9h', 'Jh', 'Kh', '2d', '3c'], // flush
    ['5h', '6d', '7c', '8s', '9h', '2c', '3d'], // straight
    ['Ah', 'Ad', 'Ac', '2h', '3d', '5c', '9s'], // trips
    ['Ah', 'Ad', 'Kh', 'Kd', '2c', '3s', '4h'], // two pair
    ['Ah', 'Ad', '2c', '5s', '9h', 'Jd', '3c'], // pair
    ['Ah', 'Qd', '2c', '5s', '9h', 'Jd', '3c'], // high card
  ]
  const ranked = hands.map(best5)
  for (let i = 0; i < ranked.length - 1; i++) assert.ok(ranked[i][0] > ranked[i + 1][0], `hand ${i} category should beat hand ${i + 1}`)
})

test('best5 treats A-2-3-4-5 as a 5-high straight, not ace-high', () => {
  const wheel = best5(['Ah', '2d', '3c', '4s', '5h', '9c', 'Tc'])
  assert.equal(wheel[0], 4) // straight
  assert.equal(wheel[1], 5)
})

test('best5 picks the best 5 of 7: trips plus the two highest kickers', () => {
  const r = best5(['Ah', 'Ad', 'Ac', '2h', '3d', '5c', '9s'])
  assert.deepEqual(r, [3, 14, 9, 5, 0, 0])
})

test('a made board straight that neither hole pair improves is a guaranteed chop', () => {
  const r = drain(runEquity(['2c', '2d'], ['Qc', 'Qd'], ['3h', '4d', '5c', '6s', '7h']))
  assert.deepEqual(r, { a: 0, b: 0, tie: 1, total: 1 })
})

test('an unbeatable made flush wins every runout on the turn', () => {
  const r = drain(runEquity(['Ah', 'Kh'], ['2c', '3d'], ['2h', '5h', '9h', 'Jh']))
  assert.equal(r.total, 44) // 52 - 2 - 2 - 4 unseen cards
  assert.equal(r.a, 44)
  assert.equal(r.b, 0)
  assert.equal(r.tie, 0)
})

test('preflop samples SAMPLES runouts and lands near the exact AA vs KK equity (82.4%)', () => {
  const r = drain(runEquity(['As', 'Ah'], ['Ks', 'Kh'], []))
  assert.equal(r.total, SAMPLES)
  assert.ok(Math.abs(r.a / r.total - 0.824) < 0.01, `got ${r.a / r.total}`)
})
