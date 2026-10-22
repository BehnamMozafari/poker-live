import { test } from 'node:test'
import assert from 'node:assert/strict'
import { figlet, identicon, spark, snake, FONT } from './term.ts'

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
