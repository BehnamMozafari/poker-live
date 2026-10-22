import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lines, inPlay, facts, leaderboard, profitSeries, ordinal, usd, roll, type Session, type Event } from './data.ts'

const night = (events: Event[], startedAt = 0): Session => ({ id: 'n', name: 'x', startedAt, endedAt: startedAt + 1, defaultBuyIn: 5000, events })
const e = (t: number, type: Event['type'], player: string, cents: number): Event => ({ t, type, player, cents })

test('totals: cash out, come back, cash out again', () => {
  const s = night([e(1, 'buyin', 'a', 5000), e(2, 'buyin', 'b', 5000), e(3, 'cashout', 'a', 2000), e(4, 'buyin', 'a', 5000), e(5, 'cashout', 'a', 9000), e(6, 'adjust', 'a', -50)])
  const [a, b] = lines(s)
  assert.deepEqual([a.in, a.out, a.rebuys, a.net, a.seated], [10000, 11000, 1, 950, false])
  assert.equal(b.seated, true)
  assert.equal(inPlay(s), 15000 - 11000 + 50)
})

test('facts: rebuy king, fastest rebuy, peak', () => {
  const s = night([e(0, 'buyin', 'a', 5000), e(0, 'buyin', 'b', 5000), e(6e5, 'buyin', 'a', 5000), e(9e5, 'buyin', 'a', 5000), e(1e6, 'cashout', 'b', 1000)])
  const f = Object.fromEntries(facts(s, 2e6).map(f => [f.k, f]))
  assert.equal(f['Rebuy King'].id, 'a')
  assert.equal(f['Fastest Rebuy'].v, '5m after buying in')
  assert.equal(f['Peak on the Table'].v, '$200')
  assert.equal(f['Iron Stack'], undefined) // b cashed out, nobody seated without a rebuy
})

test('leaderboard + running profit across nights', () => {
  const n1 = night([e(1, 'buyin', 'a', 5000), e(1, 'buyin', 'b', 5000), e(2, 'cashout', 'a', 8000), e(2, 'cashout', 'b', 2000)], 0)
  const n2 = night([e(1, 'buyin', 'a', 5000), e(1, 'buyin', 'c', 5000), e(2, 'cashout', 'a', 6000), e(2, 'cashout', 'c', 4000)], 10)
  const lb = leaderboard([n1, n2])
  assert.deepEqual(lb[0], { id: 'a', net: 4000, nights: 2, best: 3000, streak: 2 })
  assert.equal(lb.find(r => r.id === 'c')!.best, -1000) // best of only losing nights is still a loss
  assert.deepEqual(profitSeries([n1, n2]), { a: [3000, 4000], b: [-3000, -3000], c: [0, -1000] })
})

test('formatting', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 111].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '111th'])
  assert.deepEqual([usd(5000), usd(1250), usd(-300, true), usd(4500, true), usd(123456)], ['$50', '$12.50', '−$3', '+$45', '$1,234.56'])
})

test('timer rolls average out at the mean and never go under the minimum', () => {
  const rolls = Array.from({ length: 20000 }, () => roll({ mean: 20, stdev: 5, min: 10 }) / 6e4)
  assert.ok(Math.min(...rolls) >= 10)
  assert.ok(Math.abs(rolls.reduce((a, b) => a + b) / rolls.length - 20) < 0.2)
  assert.equal(roll({ mean: 20, stdev: 100, min: 10 }, () => 0.5), 10 * 6e4) // z ≈ −1.18 → clamped
})
