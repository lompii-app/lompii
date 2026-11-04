// The by-date view (the sidebar's calendar button): a heading per day, then the day's cards in
// justified rows, each as tall as it needs to be to fill the width, like Google Photos.
import { isText, type Item } from '../../shared/api.ts'

export type Entry =
  | { head: string; at: number } // a day's heading; `at` is the first card's date
  | { items: Item[]; widths: number[]; height: number }

const TALLEST = 2 // height / width, as in the grid: full-page captures show their top
const aspect = (i: Item): number =>
  isText(i.kind) ? 0.8 : i.width && i.height ? i.width / Math.min(i.height, i.width * TALLEST) : 1

const day = (t: number): string => new Date(t).toDateString()

// Today, Yesterday, Sat, 31 Oct; the year only once it isn't this one
export function dayLabel(t: number, now = Date.now()): string {
  if (day(t) === day(now)) return 'Today'
  if (day(t) === day(now - 86_400_000)) return 'Yesterday'
  const d = new Date(t)
  const year = d.getFullYear() !== new Date(now).getFullYear() ? 'numeric' : undefined
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year })
}

// `items` in the order they're shown, newest first; `date` picks the date they're sorted by
export function timeline(items: Item[], date: (i: Item) => number, width: number, target: number, gap: number, now = Date.now()): Entry[] {
  const out: Entry[] = []
  let row: Item[] = []
  let sum = 0 // the row's aspect ratios added up
  const close = (height: number) => {
    out.push({ items: row, widths: row.map((i) => aspect(i) * height), height })
    row = []
    sum = 0
  }
  items.forEach((item, n) => {
    if (n === 0 || day(date(item)) !== day(date(items[n - 1]))) {
      if (row.length) close(target) // a day's last row keeps the usual height, not stretched
      out.push({ head: dayLabel(date(item), now), at: date(item) })
    }
    row.push(item)
    sum += aspect(item)
    const height = (width - gap * (row.length - 1)) / sum
    if (height <= target) close(height)
  })
  if (row.length) close(target)
  return out
}

// The scrubber's marks: one per month, where its first heading is. `y` is a heading's place in
// the list and `f` its place down the rail, 0 to 1. Each is labelled with its month, or its year
// where the year changes; a label that would crowd the one above it (in px of `rail`) is left off.
export function marks(heads: { y: number; at: number }[], total: number, rail: number): { f: number; label: string | null }[] {
  const out: { f: number; label: string | null }[] = []
  let month = -1
  let year = -1
  let above = -Infinity // px down the rail of the last label
  for (const { y, at } of heads) {
    const d = new Date(at)
    if (d.getFullYear() * 12 + d.getMonth() === month) continue
    month = d.getFullYear() * 12 + d.getMonth()
    const f = y / total
    let label: string | null =
      year !== -1 && d.getFullYear() !== year ? String(d.getFullYear()) : d.toLocaleDateString(undefined, { month: 'short' })
    year = d.getFullYear()
    if (label && f * rail - above < 20) label = null
    if (label) above = f * rail
    out.push({ f, label })
  }
  return out
}
