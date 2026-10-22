import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { isText, type Item } from '@shared/api'
import { url } from './useItems'

const GAP = 24
const MIN_COL = 300
const CAPTION = 34 // mt-2.5 + one 13px line
const TEXT = 200 // first guess only; text tiles are measured once rendered
const TALLEST = 2 // height / width; full-page captures show their top, like a bookmark preview

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
  picked: Set<number> // multi-selection
  onPick: (id: number, range: boolean) => void // Ctrl-click toggles; Shift-click extends
  onDelete: (id: number) => void
}

export default function Grid({ scrollRef, items, selected, onSelect, onOpen, picked, onPick, onDelete }: Props) {
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

  // ponytail: index arithmetic, not geometric nearest-neighbour. Up/down can land
  // in a different column than the eye expects on very uneven masonry.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected != null) onDelete(selected) // undoable, so no confirm
        return
      }

      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key]
      if (!step || !items.length) return
      e.preventDefault()
      const from = items.findIndex((i) => i.id === selected)
      const next = from < 0 ? 0 : Math.min(items.length - 1, Math.max(0, from + step))
      onSelect(items[next].id)
      virtualizer.scrollToIndex(next, { align: 'auto' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, selected, cols, onSelect, onDelete, virtualizer])

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
                onClick={(e) =>
                  e.ctrlKey || e.metaKey || e.shiftKey || picked.size
                    ? onPick(item.id, e.shiftKey)
                    : onOpen(item.id)
                }
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

function Tile({
  item,
  index,
  measure,
  selected,
  picked,
  onClick,
  style
}: {
  item: Item
  index: number
  measure: (el: Element | null) => void
  selected: boolean
  picked: boolean
  onClick: (e: React.MouseEvent) => void
  style: React.CSSProperties
}) {
  const [loaded, setLoaded] = useState(false)
  const text = caption(item)
  const card = `w-full overflow-hidden rounded-[4px] shadow-card transition-shadow duration-200 group-hover:shadow-lift ${
    selected || picked ? 'outline-2 outline-offset-2 outline-accent' : ''
  }`
  return (
    <button
      ref={measure}
      data-index={index}
      style={style}
      onClick={onClick}
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
        <blockquote className={`${card} bg-card px-7 py-6 text-center font-serif text-fg`}>
          <span aria-hidden className="block font-[Georgia,serif] text-[30px] leading-none">“</span>
          <p className="my-3 line-clamp-[12] text-[19px] leading-snug whitespace-pre-line">{item.body}</p>
          <span aria-hidden className="block font-[Georgia,serif] text-[30px] leading-none">”</span>
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
