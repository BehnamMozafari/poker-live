import { test } from 'node:test'
import assert from 'node:assert/strict'
import { settle, banker, split, type Balances, type Payment } from './settle.ts'

const apply = (bal: Balances, pays: Payment[]) => {
  const b = { ...bal }
  for (const p of pays) (b[p.from] += p.cents), (b[p.to] -= p.cents)
  return Object.values(b).every(c => c === 0)
}

test('losers 10/3/3 vs winners 6/5/5 settles in 4, not the greedy 5', () => {
  const bal = { a: -1000, b: -300, c: -300, d: 600, e: 500, f: 500 }
  const pays = settle(bal)
  assert.equal(pays.length, 4)
  assert.ok(apply(bal, pays))
  assert.ok(pays.every(p => p.cents > 0))
})

test('random balances always settle to zero in ≤ n−1 payments', () => {
  for (let k = 0; k < 200; k++) {
    const n = 2 + (k % 9), bal: Balances = {}
    let s = 0
    for (let i = 0; i < n - 1; i++) s += bal['p' + i] = Math.round((Math.random() - 0.5) * 20) * 500
    bal['p' + (n - 1)] = -s
    const pays = settle(bal)
    assert.ok(apply(bal, pays))
    assert.ok(pays.length <= Object.values(bal).filter(Boolean).length - 1 || pays.length === 0)
  }
})

test('nothing owed → no payments', () => assert.deepEqual(settle({ a: 0, b: 0 }), []))

test('banker: everyone settles with the host', () => {
  const pays = banker({ h: 500, a: -800, b: 300 }, 'h')
  assert.deepEqual(pays, [{ from: 'a', to: 'h', cents: 800 }, { from: 'h', to: 'b', cents: 300 }])
})

test('split is exact and proportional', () => {
  const s = split(-100, { a: 3000, b: 3000, c: 3000 })
  assert.equal(Object.values(s).reduce((a, b) => a + b), -100)
  assert.ok(Object.values(s).every(c => c === -33 || c === -34))
  assert.deepEqual(split(10, { a: 0, b: 0 }), { a: 5, b: 5 })
})
