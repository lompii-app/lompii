import { useEffect, useState } from 'react'
import { isText, quoteParts, type Item } from '@shared/api'
import { Confirm } from './Dialogs'
import { url } from './useItems'

const TIP_KEY = 'lompii.trashTipDismissed'

const PILL = 'rounded-full px-4 py-2 text-[13px] font-medium transition-opacity hover:opacity-85'

// Deleted items, newest first. Each card can be restored or deleted for good, alone or as part
// of a selection; the trash empties itself after 30 days (the main process purges on startup).
export default function Trash({ onExit, onRestored }: { onExit: () => void; onRestored: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [confirm, setConfirm] = useState<number[] | 'all' | null>(null) // what "Delete for good" would remove
  const [tip, setTip] = useState(() => {
    try {
      return !localStorage.getItem(TIP_KEY)
    } catch {
      return true
    }
  })

  const load = () => window.lompii.trashList().then(setItems)
  useEffect(() => {
    load()
  }, [])

  const drop = (ids: number[]) => {
    setItems((prev) => prev?.filter((i) => !ids.includes(i.id)) ?? null)
    setPicked(new Set())
  }

  const restore = async (ids: number[]) => {
    await window.lompii.restore(ids)
    drop(ids)
    onRestored()
  }

  const destroy = async () => {
    if (confirm === 'all') {
      await window.lompii.emptyTrash()
      setItems([])
      setPicked(new Set())
    } else if (confirm) {
      await window.lompii.deleteForever(confirm)
      drop(confirm)
    }
    setConfirm(null)
  }

  const toggle = (id: number) => {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  const dismissTip = () => {
    setTip(false)
    try {
      localStorage.setItem(TIP_KEY, '1')
    } catch {}
  }

  const picking = picked.size > 0
  const doomed = confirm === 'all' ? (items?.length ?? 0) : (confirm?.length ?? 0)

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
      </div>

      {items && !items.length && (
        <p className="py-24 text-center font-serif text-[32px] text-dim italic">The trash is empty.</p>
      )}

      {/* CSS columns: a small, short-lived list doesn't need the virtualised grid */}
      <div className="mt-6 columns-[280px] gap-6">
        {items?.map((item) => {
          const on = picked.has(item.id)
          const name = item.title ?? 'this item'
          return (
            <div key={item.id} className="group mb-6 break-inside-avoid text-center">
              <div
                className={`relative overflow-hidden rounded-[4px] shadow-card transition-shadow group-hover:shadow-lift ${
                  on ? 'outline-3 outline-offset-2 outline-accent' : ''
                }`}
              >
                {isText(item.kind) ? (
                  <p
                    className={`bg-card px-6 py-5 text-fg ${
                      item.kind === 'quote' ? 'font-quote text-[18px] leading-snug italic' : 'text-left text-[14px] leading-relaxed'
                    } line-clamp-8`}
                  >
                    {item.kind === 'quote' ? `“${quoteParts(item.body ?? '').text}”` : item.body}
                  </p>
                ) : (
                  <img src={url(item.thumb_path)} alt="" draggable={false} style={{ background: item.dominant_color }} className="block w-full" />
                )}

                {picking ? (
                  // while selecting, the whole card toggles
                  <button onClick={() => toggle(item.id)} aria-pressed={on} aria-label={`Select ${name}`} className="absolute inset-0" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                    <button onClick={() => restore([item.id])} aria-label={`Restore ${name}`} className={`${PILL} bg-accent text-white`}>
                      Restore
                    </button>
                    <button onClick={() => setConfirm([item.id])} aria-label={`Delete ${name} for good`} className={`${PILL} bg-white text-neutral-900`}>
                      Delete forever
                    </button>
                  </div>
                )}

                <button
                  onClick={() => toggle(item.id)}
                  aria-pressed={on}
                  aria-label={on ? `Unselect ${name}` : `Select ${name}`}
                  className={`absolute top-2.5 left-2.5 grid size-6 place-items-center rounded-full border-2 transition-opacity ${
                    on ? 'border-accent bg-accent text-white' : 'border-white bg-black/25 text-transparent'
                  } ${picking ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
                >
                  <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m2.5 6.5 2.5 2.5 4.5-5.5" />
                  </svg>
                </button>
              </div>
              {item.title && <span className="mt-2.5 block truncate px-2 text-[13px] text-dim">{item.title}</span>}
            </div>
          )
        })}
      </div>

      {picking && (
        <div className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-card py-2 pr-2 pl-5 text-[14px] text-fg shadow-lift">
          <span className="mr-1">{picked.size} selected</span>
          {picked.size < (items?.length ?? 0) && (
            <button onClick={() => setPicked(new Set(items?.map((i) => i.id)))} className="px-2 text-[13px] text-dim hover:text-fg">
              Select all
            </button>
          )}
          <button onClick={() => setPicked(new Set())} className="px-2 text-[13px] text-dim hover:text-fg">
            Clear
          </button>
          <button onClick={() => restore([...picked])} className={`${PILL} bg-accent text-white`}>
            Restore
          </button>
          <button onClick={() => setConfirm([...picked])} className={`${PILL} bg-fg text-card`}>
            Delete forever
          </button>
        </div>
      )}

      {!!items?.length && (
        <button
          onClick={() => setConfirm('all')}
          aria-label="Empty trash"
          className="group/bin fixed bottom-6 left-24 z-20 grid size-12 place-items-center rounded-full bg-accent text-white shadow-lift transition hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg viewBox="0 0 24 24" className="size-[22px] overflow-visible" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {/* the lid tips open on hover */}
            <g className="origin-[4px_7px] transition-transform duration-200 ease-out group-hover/bin:-translate-y-[2px] group-hover/bin:-rotate-[18deg] motion-reduce:transition-none">
              <path d="M4 7h16M9 7V4.5h6V7" />
            </g>
            <path d="M5.5 7l1 13h11l1-13M10 11v5.5M14 11v5.5" />
          </svg>
          {/* the same pop-up label as the colour swatches in the overlay */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 translate-y-1 rounded-full bg-card px-3 py-1 text-[13px] whitespace-nowrap text-fg opacity-0 shadow-lift transition duration-150 group-hover/bin:translate-y-0 group-hover/bin:opacity-100 group-focus-visible/bin:translate-y-0 group-focus-visible/bin:opacity-100"
          >
            Empty trash
          </span>
        </button>
      )}

      <Confirm
        open={confirm !== null}
        title={`Delete ${doomed} ${doomed === 1 ? 'item' : 'items'} for good?`}
        confirmLabel={confirm === 'all' ? 'Empty trash' : 'Delete forever'}
        onConfirm={destroy}
        onCancel={() => setConfirm(null)}
      >
        Their files are removed too. This can't be undone.
      </Confirm>

      {tip && !picking && (
        <div role="note" className="fixed right-6 bottom-6 z-20 max-w-sm rounded-lg bg-accent py-4 pr-10 pl-5 text-[14px] leading-relaxed text-white shadow-lift">
          The trash empties itself after 30 days. Hover a card to restore it or delete it for good, or tick
          several to do it all at once.
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
