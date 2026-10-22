import { test } from 'node:test'
import assert from 'node:assert/strict'
import { figlet, identicon, spark, snake, candles, candleRows, FONT } from './term.ts'

test('every figlet glyph is 5 rows of 5 cells', () => {
  for (const rows of Object.values(FONT)) assert.match(rows, /^[01]{5}( [01]{5}){4}$/)
  assert.deepEqual(figlet('I'), ['█████', ' ░█░░░', '  █░', '  █░', '█████', ' ░░░░░'])
})

test('unknown characters render as ?', () => assert.deepEqual(figlet('~'), figlet('?')))

test('identicon is deterministic, mirrored, never blank', () => {
  for (const n of ['alex', 'Sam', 'jo', 'x', 'Prakrit']) {
    const a = identicon(n)
    assert.deepEqual(a, identicon(n.toUpperCase() + ' '))
    for (let r = 0; r < 5; r++) assert.deepEqual([a[r * 5], a[r * 5 + 1]], [a[r * 5 + 4], a[r * 5 + 3]])
    assert.ok(a.some(Boolean))
  }
  assert.notDeepEqual(identicon('alex'), identicon('sam'))
})

test('spark maps min to ▁ and max to █', () => {
  assert.equal(spark([0, 5, 10]), '▁▅█')
  assert.equal(spark([3, 3]), '▁▁')
})

test('snake', () => assert.equal(snake('Rebuy King '), 'rebuy_king'))

test('candles bucket a step series into OHLC + volume', () => {
  const cs = candles([[0, 0], [1, 50], [2, 150], [3, 100], [12, 120]], 0, 10, 3)
  assert.deepEqual(cs, [
    { o: 0, h: 150, l: 0, c: 100, v: 150 },
    { o: 100, h: 120, l: 100, c: 120, v: 20 },
    { o: 120, h: 120, l: 120, c: 120, v: 0 },
  ])
})

test('candleRows draws body, wick and flat', () => {
  // 2 rows = 4 half-steps: body 0..2 (wick to 3 hides under the half block); flat candle at the top
  assert.deepEqual(candleRows([{ o: 0, h: 3, l: 0, c: 2, v: 0 }, { o: 3, h: 3, l: 3, c: 3, v: 0 }], 2, 3), ['▄─', '█ '])
})
