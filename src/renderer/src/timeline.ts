// The by-date view (the sidebar's calendar button): a heading per day, then the day's cards in
// justified rows, each as tall as it needs to be to fill the width, like Google Photos.
import { isText, type Item } from '../../shared/api.ts'

export type Entry =
  | { head: string }
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
      out.push({ head: dayLabel(date(item), now) })
    }
    row.push(item)
    sum += aspect(item)
    const height = (width - gap * (row.length - 1)) / sum
    if (height <= target) close(height)
  })
  if (row.length) close(target)
  return out
}
