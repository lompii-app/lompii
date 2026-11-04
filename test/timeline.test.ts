import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Item } from '../src/shared/api.ts'
import { dayLabel, timeline } from '../src/renderer/src/timeline.ts'

const now = new Date(2026, 10, 4, 15).getTime()
const img = (id: number, at: number, width = 100, height = 100) => ({ id, kind: 'image', width, height, created_at: at }) as Item

test('day labels: today, yesterday, then the date, with the year once it differs', () => {
  assert.equal(dayLabel(new Date(2026, 10, 4, 1).getTime(), now), 'Today')
  assert.equal(dayLabel(new Date(2026, 10, 3, 23).getTime(), now), 'Yesterday')
  assert.match(dayLabel(new Date(2026, 9, 31).getTime(), now), /31/)
  assert.doesNotMatch(dayLabel(new Date(2026, 9, 31).getTime(), now), /2026/)
  assert.match(dayLabel(new Date(2025, 9, 31).getTime(), now), /2025/)
})

test('rows fill the width; a day starts a heading and a new row', () => {
  const today = new Date(2026, 10, 4, 10).getTime()
  const old = new Date(2026, 9, 1).getTime()
  // 4 squares at width 430, gap 10: height (430 - 30) / 4 = 100, at the target, so a full row
  const items = [1, 2, 3, 4, 5].map((id) => img(id, today)).concat(img(6, old))
  const out = timeline(items, (i) => i.created_at, 430, 100, 10, now)
  assert.deepEqual(out.map((e) => ('head' in e ? e.head : e.items.map((i) => i.id))), [
    'Today', [1, 2, 3, 4], [5], dayLabel(old, now), [6]
  ])
  const full = out[1] as Exclude<(typeof out)[number], { head: string }>
  assert.equal(full.widths.reduce((a, b) => a + b) + 30, 430)
  assert.equal((out[2] as typeof full).height, 100) // a short last row isn't stretched
})

test('a very tall capture counts as at most twice its width', () => {
  const [, row] = timeline([img(1, now, 100, 1000)], (i) => i.created_at, 1000, 200, 10, now)
  assert.equal((row as { widths: number[] }).widths[0], 100) // aspect 0.5 at height 200
})
