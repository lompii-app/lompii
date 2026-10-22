import { useEffect, useState } from 'react'
import { isText, type Item } from '@shared/api'
import { url } from './useItems'

const TIP_KEY = 'tessera.trashTipDismissed'

// Deleted items, newest first. Clicking a card puts it back; the trash empties itself after
// 30 days (the main process purges on startup).
export default function Trash({ onExit, onRestored }: { onExit: () => void; onRestored: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [tip, setTip] = useState(() => {
    try {
      return !localStorage.getItem(TIP_KEY)
    } catch {
      return true
    }
  })

  const load = () => window.tessera.trashList().then(setItems)
  useEffect(() => {
    load()
  }, [])

  const restore = async (id: number) => {
    await window.tessera.restore([id])
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? null)
    onRestored()
  }

  const empty = async () => {
    if (!items?.length) return
    if (!confirm(`Delete ${items.length} ${items.length === 1 ? 'item' : 'items'} for good? This can't be undone.`)) return
    await window.tessera.emptyTrash()
    setItems([])
  }

  const dismissTip = () => {
    setTip(false)
    try {
      localStorage.setItem(TIP_KEY, '1')
    } catch {}
  }

  return (
    <div className="pr-20 pb-28 pl-1">
      <div className="flex items-center gap-4 border-b border-line pt-2 pb-4">
        <button
          onClick={onExit}
          aria-label="Back to everything"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-fg text-card transition-opacity hover:opacity-85"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h2 className="flex-1 font-serif text-[60px] leading-tight tracking-tight text-dim italic">Trash</h2>
        {!!items?.length && (
          <button
            onClick={empty}
            className="rounded-full px-5 py-2.5 text-[13px] tracking-wider text-dim uppercase transition-colors hover:text-red-600"
          >
            Empty trash
          </button>
        )}
        <button
          onClick={onExit}
          className="rounded-full bg-card px-5 py-2.5 text-[13px] tracking-wider text-fg uppercase shadow-card transition-shadow hover:shadow-lift"
        >
          Exit trash
        </button>
      </div>

      {items && !items.length && (
        <p className="py-24 text-center font-serif text-[32px] text-dim italic">The trash is empty.</p>
      )}

      {/* CSS columns: a small, short-lived list doesn't need the virtualised grid */}
      <div className="mt-6 columns-[280px] gap-6">
        {items?.map((item) => (
          <button
            key={item.id}
            onClick={() => restore(item.id)}
            aria-label={`Restore ${item.title ?? 'this item'}`}
            className="group mb-6 block w-full break-inside-avoid text-center"
          >
            <div className="relative overflow-hidden rounded-[4px] shadow-card transition-shadow group-hover:shadow-lift">
              {isText(item.kind) ? (
                <p
                  className={`bg-card px-6 py-5 text-fg ${
                    item.kind === 'quote' ? 'font-serif text-[18px] leading-snug' : 'text-left text-[14px] leading-relaxed'
                  } line-clamp-8`}
                >
                  {item.kind === 'quote' ? `“${item.body}”` : item.body}
                </p>
              ) : (
                <img
                  src={url(item.thumb_path)}
                  alt=""
                  draggable={false}
                  style={{ background: item.dominant_color }}
                  className="block w-full"
                />
              )}
              <span className="absolute inset-0 grid place-items-center bg-accent/90 text-[15px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                Restore this card
              </span>
            </div>
            {item.title && <span className="mt-2.5 block truncate px-2 text-[13px] text-dim">{item.title}</span>}
          </button>
        ))}
      </div>

      {!!items?.length && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-card px-5 py-2.5 text-[14px] text-fg shadow-lift">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Click a card to restore it
        </div>
      )}

      {tip && (
        <div role="note" className="fixed right-6 bottom-6 z-20 max-w-sm rounded-lg bg-accent py-4 pr-10 pl-5 text-[14px] leading-relaxed text-white shadow-lift">
          The trash empties itself after 30 days. To put something back, click it.
          <button onClick={dismissTip} aria-label="Dismiss" className="absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full hover:bg-white/15">
            <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M3 3l6 6M9 3 3 9" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
