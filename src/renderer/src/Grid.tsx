import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { isText, quoteParts, type Item } from '@shared/api'
import type { Density } from './prefs'
import { marks, timeline } from './timeline'
import { url } from './useItems'

// narrowest column and gap per layout setting (the sidebar's grid button)
const SIZES: Record<Density, { minCol: number; gap: number }> = {
  large: { minCol: 460, gap: 32 },
  medium: { minCol: 300, gap: 24 },
  small: { minCol: 190, gap: 16 }
}
const CAPTION = 34 // mt-2.5 + one 13px line
const TEXT = 200 // first guess only; text tiles are measured once rendered
const TALLEST = 2 // height / width; full-page captures show their top, like a bookmark preview

// cards dragged inside the window carry their ids under this type; the sidebar logo takes them
export const ITEMS_TYPE = 'application/x-lompii-items'

// A small square of the card follows the pointer instead of the whole tile, so the logo it's
// dropped on stays in view. Several cards carry their count.
function dragGhost(tile: HTMLElement, count: number): HTMLCanvasElement {
  const size = 72
  const c = document.createElement('canvas')
  c.width = c.height = size * devicePixelRatio
  c.style.cssText = `position:fixed;top:-${size * 2}px;width:${size}px;height:${size}px`
  const ctx = c.getContext('2d')!
  ctx.scale(devicePixelRatio, devicePixelRatio)
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, 6)
  ctx.clip()
  const css = getComputedStyle(document.documentElement)
  ctx.fillStyle = css.getPropertyValue('--color-card')
  ctx.fillRect(0, 0, size, size)
  const img = tile.querySelector('img')
  if (img?.naturalWidth) {
    const s = Math.min(img.naturalWidth, img.naturalHeight) // cover, from the top like the tile
    ctx.drawImage(img, (img.naturalWidth - s) / 2, 0, s, s, 0, 0, size, size)
  }
  if (count > 1) {
    ctx.fillStyle = css.getPropertyValue('--color-accent')
    ctx.beginPath()
    ctx.arc(size - 15, 15, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = '600 12px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(count), size - 15, 15.5)
  }
  return c
}

const caption = (i: Item): string | null => {
  if (i.title) return i.title
  try {
    return i.source_url ? new URL(i.source_url).hostname.replace(/^www\./, '') : null
  } catch {
    return null
  }
}

type Props = {
  scrollRef: React.RefObject<HTMLElement | null> // the page scroller, which also holds the header
  items: Item[]
  selected: number | null
  onSelect: (id: number | null) => void
  onOpen: (id: number) => void
  density: Density
  picked: Set<number> // multi-selection
  onPick: (id: number, range: boolean) => void // Ctrl-click toggles; Shift-click extends
  onDelete: (id: number) => void
}

export default function Grid({ scrollRef, items, selected, onSelect, onOpen, density, picked, onPick, onDelete }: Props) {
  const { minCol: MIN_COL, gap: GAP } = SIZES[density]
  const listRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [margin, setMargin] = useState(0)

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(listRef.current!)
    return () => ro.disconnect()
  }, [])

  // The header scrolls above the list and its height changes (filter row, wrapping), so the
  // list's offset in the scroller is re-read after every render.
  useLayoutEffect(() => {
    const top = listRef.current!.offsetTop
    if (top !== margin) setMargin(top)
  })

  const cols = Math.max(1, Math.floor((width + GAP) / (MIN_COL + GAP)))
  const colWidth = (width - GAP * (cols - 1)) / cols

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    scrollMargin: margin,
    estimateSize: (i) =>
      (isText(items[i].kind) ? TEXT : Math.round(colWidth * Math.min(items[i].height / items[i].width, TALLEST))) +
      (caption(items[i]) ? CAPTION : 0),
    getItemKey: (i) => items[i].id,
    lanes: cols,
    gap: GAP,
    overscan: 10
  })

  // The virtualizer remembers each tile's column by its index. An upload lands at index 0 and
  // shifts everything, so those columns go stale and the masonry overlaps until a restart.
  // Forget them whenever the list itself changes; this runs before the layout is computed.
  // ponytail: clears a private field (virtual-core 3.17); measure() would also drop the
  // measured text-tile heights. Recheck on a @tanstack/virtual upgrade.
  const laidOut = useRef('')
  const ids = items.map((i) => i.id).join(',')
  if (laidOut.current !== ids) {
    laidOut.current = ids
    ;(virtualizer as unknown as { laneAssignments?: Map<number, number> }).laneAssignments?.clear()
  }

  // ponytail: index arithmetic, not geometric nearest-neighbour. Up/down can land
  // in a different column than the eye expects on very uneven masonry.
  useKeys(
    items,
    selected,
    onSelect,
    onDelete,
    (from, key) => from + { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[key]!,
    (n) => virtualizer.scrollToIndex(n, { align: 'auto' })
  )

  return (
    <div className="pt-6 pr-20 pb-12 pl-1">
      <div ref={listRef} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {width > 0 &&
          virtualizer.getVirtualItems().map((v) => {
            const item = items[v.index]
            return (
              <Tile
                key={item.id}
                index={v.index}
                measure={virtualizer.measureElement}
                item={item}
                selected={item.id === selected}
                picked={picked.has(item.id)}
                {...handlers(item, picked, onPick, onOpen)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: v.lane * (colWidth + GAP),
                  width: colWidth,
                  transform: `translateY(${v.start - margin}px)`
                }}
              />
            )
          })}
      </div>
    </div>
  )
}

// row height and gap per layout setting in the by-date view
const ROWS: Record<Density, { height: number; gap: number }> = {
  large: { height: 380, gap: 12 },
  medium: { height: 260, gap: 8 },
  small: { height: 170, gap: 6 }
}
const HEAD = 64 // a day's heading, with the space above it

// The by-date view: a heading per day, then justified rows (timeline.ts). Every size is known up
// front, so nothing is measured.
export function Timeline({
  scrollRef,
  items,
  date,
  selected,
  onSelect,
  onOpen,
  density,
  picked,
  onPick,
  onDelete
}: Props & { date: (i: Item) => number }) {
  const { height: ROW, gap: GAP } = ROWS[density]
  const listRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [margin, setMargin] = useState(0)

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(listRef.current!)
    return () => ro.disconnect()
  }, [])
  useLayoutEffect(() => {
    const top = listRef.current!.offsetTop
    if (top !== margin) setMargin(top)
  })

  const entries = useMemo(() => timeline(items, date, width, ROW, GAP), [items, date, width, ROW, GAP])
  // each card's place: its row in `entries` and its centre across, for up/down
  const places = useMemo(() => {
    const at: { row: number; x: number }[] = []
    entries.forEach((e, row) => {
      if ('head' in e) return
      let x = 0
      e.widths.forEach((w) => {
        at.push({ row, x: x + w / 2 })
        x += w + GAP
      })
    })
    return at
  }, [entries, GAP])

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    scrollMargin: margin,
    estimateSize: (i) => {
      const e = entries[i]
      return 'head' in e ? HEAD : e.height + GAP
    },
    getItemKey: (i) => {
      const e = entries[i]
      return 'head' in e ? e.head : e.items[0].id
    },
    overscan: 4
  })

  useKeys(
    items,
    selected,
    onSelect,
    onDelete,
    (from, key) => {
      if (key === 'ArrowRight') return from + 1
      if (key === 'ArrowLeft') return from - 1
      // up/down: the card in the next row over whose centre is closest
      const { row, x } = places[from]
      let to = row + (key === 'ArrowDown' ? 1 : -1)
      if ('head' in (entries[to] ?? {})) to += key === 'ArrowDown' ? 1 : -1
      let best = from
      places.forEach((p, n) => {
        if (p.row === to && (best === from || Math.abs(p.x - x) < Math.abs(places[best].x - x))) best = n
      })
      return best
    },
    (n) => virtualizer.scrollToIndex(places[n].row, { align: 'auto' })
  )

  // each heading's place in the list, for the scrubber
  const heads = useMemo(() => {
    const out: { y: number; at: number; label: string }[] = []
    let y = 0
    for (const e of entries) {
      if ('head' in e) out.push({ y, at: e.at, label: e.head })
      y += 'head' in e ? HEAD : e.height + GAP
    }
    return out
  }, [entries, GAP])

  let first = 0 // index in `items` of each row's first card
  const starts = entries.map((e) => {
    const at = first
    if (!('head' in e)) first += e.items.length
    return at
  })

  return (
    <div className="pt-2 pr-20 pb-12 pl-1">
      <div ref={listRef} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {width > 0 &&
          virtualizer.getVirtualItems().map((v) => {
            const e = entries[v.index]
            const style = { position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${v.start - margin}px)` } as const
            if ('head' in e)
              return (
                <h2 key={v.key} style={{ ...style, height: HEAD }} className="flex items-end pb-4 text-[14px] font-medium text-fg">
                  {e.head}
                </h2>
              )
            return (
              <div key={v.key} style={{ ...style, height: e.height }} className="flex">
                {e.items.map((item, n) => (
                  <Tile
                    key={item.id}
                    index={starts[v.index] + n}
                    item={item}
                    selected={item.id === selected}
                    picked={picked.has(item.id)}
                    {...handlers(item, picked, onPick, onOpen)}
                    fill
                    style={{ width: e.widths[n], height: e.height, marginLeft: n ? GAP : 0, flex: 'none' }}
                  />
                ))}
              </div>
            )
          })}
      </div>
      <Scrubber
        scrollRef={scrollRef}
        heads={heads}
        total={virtualizer.getTotalSize()}
        margin={margin}
        offset={virtualizer.scrollOffset ?? 0}
      />
    </div>
  )
}

// The rail in the right margin: a mark a month, a line where the view is, and the day under the
// pointer. Pressing or dragging on it jumps there. A place f down the rail (0 to 1) is the list
// scrolled so that the point f of the way down it sits f of the way down the window: the top at
// the top, the end at the bottom, and a heading at f shows when the line is on its mark.
function Scrubber({
  scrollRef,
  heads,
  total,
  margin,
  offset
}: {
  scrollRef: Props['scrollRef']
  heads: { y: number; at: number; label: string }[]
  total: number
  margin: number // the list's top in the scroller
  offset: number // the scroller's scrollTop
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const [rail, setRail] = useState(0)
  const [hover, setHover] = useState<number | null>(null) // f under the pointer
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setRail(e.contentRect.height))
    ro.observe(railRef.current!)
    return () => ro.disconnect()
  }, [])
  const view = scrollRef.current?.clientHeight ?? 0
  const range = total - view
  const ticks = useMemo(() => marks(heads, total, rail), [heads, total, rail])

  const at = (e: React.PointerEvent) => {
    const r = railRef.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
  }
  const seek = (f: number) => scrollRef.current?.scrollTo({ top: margin + f * range })
  // the day at f: the last heading at or above that point of the list
  const day = (f: number) => heads.filter((h) => h.y <= f * total).at(-1)?.label ?? heads[0]?.label

  return (
    <div
      ref={railRef}
      // the window's right margin, from under the search line to above back-to-top
      className={`fixed top-44 right-0 bottom-28 z-20 w-20 cursor-row-resize touch-none select-none ${range > 0 ? '' : 'hidden'}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        seek(at(e))
      }}
      onPointerMove={(e) => {
        setHover(at(e))
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seek(at(e))
      }}
      onPointerLeave={() => setHover(null)}
      aria-hidden // a pointer shortcut; the list scrolls by wheel and keys as before
    >
      {/* the track: a thin line with a dot a month, labels to its left, and the orange line across it */}
      <div className="absolute inset-y-0 right-4 w-1">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line" />
        {ticks.map(({ f, label }) => (
          <div key={f} className="absolute left-0 size-1 -translate-y-1/2 rounded-full bg-dim/60" style={{ top: f * rail }}>
            {label && (
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] whitespace-nowrap text-dim">{label}</span>
            )}
          </div>
        ))}
        <div
          className="absolute left-1/2 h-0.5 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          style={{ top: Math.min(1, Math.max(0, (offset - margin) / range)) * rail }}
        />
      </div>
      {hover != null && (
        <span
          className="absolute right-full -translate-y-1/2 rounded-full bg-card px-2.5 py-1 text-[12px] whitespace-nowrap text-fg shadow-lift"
          style={{ top: hover * rail }}
        >
          {day(hover)}
        </span>
      )}
    </div>
  )
}

// Delete trashes the selected card; the arrows move the selection to the card `move` names
function useKeys(
  items: Item[],
  selected: number | null,
  onSelect: (id: number) => void,
  onDelete: (id: number) => void,
  move: (from: number, key: string) => number,
  reveal: (index: number) => void
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected != null) onDelete(selected) // undoable, so no confirm
        return
      }

      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key) || !items.length) return
      e.preventDefault()
      const from = items.findIndex((i) => i.id === selected)
      const next = from < 0 ? 0 : Math.min(items.length - 1, Math.max(0, move(from, e.key)))
      onSelect(items[next].id)
      reveal(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}

// a click opens the card, or with Ctrl/Shift (or while some are picked) picks it; dragging a
// picked card brings the whole selection along
const handlers = (item: Item, picked: Set<number>, onPick: Props['onPick'], onOpen: Props['onOpen']) => ({
  onClick: (e: React.MouseEvent) =>
    e.ctrlKey || e.metaKey || e.shiftKey || picked.size ? onPick(item.id, e.shiftKey) : onOpen(item.id),
  onDragStart: (e: React.DragEvent<HTMLElement>) => {
    const ids = picked.has(item.id) ? [...picked] : [item.id]
    e.dataTransfer.setData(ITEMS_TYPE, JSON.stringify(ids))
    e.dataTransfer.effectAllowed = 'move'
    const ghost = dragGhost(e.currentTarget, ids.length)
    document.body.append(ghost)
    e.dataTransfer.setDragImage(ghost, -14, -14) // below-right of the pointer, clear of the logo
    setTimeout(() => ghost.remove()) // the browser has its snapshot by then
  }
})

function Tile({
  item,
  index,
  measure,
  selected,
  picked,
  onClick,
  onDragStart,
  fill,
  style
}: {
  item: Item
  index: number
  measure?: (el: Element | null) => void
  fill?: boolean // the by-date view: the card fills the size it's given, with no caption
  selected: boolean
  picked: boolean
  onClick: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent<HTMLElement>) => void
  style: React.CSSProperties
}) {
  const [loaded, setLoaded] = useState(false)
  const text = fill ? null : caption(item)
  const quote = quoteParts(item.body ?? '').text // the author shows only in the overlay
  const card = `w-full ${fill ? 'h-full' : ''} overflow-hidden rounded-[4px] shadow-card transition-shadow duration-200 group-hover:shadow-lift ${
    selected || picked ? 'outline-2 outline-offset-2 outline-accent' : ''
  }`
  return (
    <button
      ref={measure}
      data-index={index}
      style={style}
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      aria-pressed={picked || undefined}
      className="group relative flex flex-col"
    >
      {picked && (
        <span className="absolute top-2 right-2 z-10 grid size-6 place-items-center rounded-full bg-accent text-white shadow-card">
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      )}
      {item.kind === 'quote' ? (
        <blockquote className={`${card} bg-card px-7 py-6 text-center font-quote text-[21px] leading-snug text-fg`}>
          <CornerQuote text={quote} className="line-clamp-[12]" />
        </blockquote>
      ) : item.kind === 'snippet' ? (
        <div className={`${card} bg-card px-6 py-5 text-left text-fg`}>
          <p className="line-clamp-[14] text-[14px] leading-relaxed whitespace-pre-line">{item.body}</p>
        </div>
      ) : (
        <div
          style={{
            background: item.dominant_color,
            aspectRatio: `${item.width} / ${Math.min(item.height, item.width * TALLEST)}`
          }}
          className={card}
        >
          <img
            src={url(item.thumb_path)}
            alt=""
            draggable={false}
            onLoad={() => setLoaded(true)}
            className={`h-full w-full object-cover object-top transition-opacity duration-200 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      )}
      {text && (
        <span className="mt-2.5 w-full shrink-0 truncate px-2 text-center text-[13px] leading-5 text-dim">
          {text}
        </span>
      )}
    </button>
  )
}

// The words in italic with “ at their top-left and ” at their bottom-right, the same gap on each
// side. The box shrinks to the text, so a short quote keeps its marks close. Sized in em: set the
// font size on the parent. The marks stay upright; italic ones lean right and look off-centre.
export function CornerQuote({ text, className = '' }: { text: string; className?: string }) {
  const mark = 'absolute h-[.5em] text-[2.1em] leading-none font-bold not-italic text-dim'
  return (
    <div className="relative mx-auto w-fit max-w-full px-[1.1em] py-[1.15em]">
      <b aria-hidden className={`${mark} top-0 left-0`}>“</b>
      <p className={`italic whitespace-pre-line ${className}`}>{text}</p>
      <b aria-hidden className={`${mark} right-0 bottom-0`}>”</b>
    </div>
  )
}
