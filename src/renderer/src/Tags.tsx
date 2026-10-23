import { useEffect, useState } from 'react'
import { stem } from '@shared/api'

type Tag = { value: string; count: number }

const BUTTON =
  'shrink-0 rounded-lg border border-line bg-control px-3 py-1.5 text-[13px] font-medium transition-colors outline-none hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40'
const DANGER = 'shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85'

// tags that differ only by word endings ("light themes", "light theme"); the most used one stays
function lookAlikes(tags: Tag[]): { into: Tag; from: Tag[] }[] {
  const groups = new Map<string, Tag[]>()
  for (const t of tags) {
    const key = t.value.split(/[\s-]+/).map(stem).join(' ')
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  return [...groups.values()].filter((g) => g.length > 1).map(([into, ...from]) => ({ into, from }))
}

const Check = ({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) => (
  <input type="checkbox" checked={on} onChange={onToggle} aria-label={label} className="size-4 shrink-0 accent-[var(--color-accent)]" />
)

// Every tag in the library with how many items carry it. Renaming onto an existing tag merges
// the two (motivational → motivation); deleting takes the tag off every item.
export default function TagsDialog({
  ref,
  onChange
}: {
  ref: React.RefObject<HTMLDialogElement | null>
  onChange: () => void // tags changed; refresh filters and search
}) {
  const [tags, setTags] = useState<Tag[]>([])
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<'count' | 'name'>('count')
  const [onceOnly, setOnceOnly] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [mergeInto, setMergeInto] = useState('')
  const [confirm, setConfirm] = useState<string[] | null>(null) // tags waiting for "Remove"

  const load = () => window.lompii.tagCounts().then(setTags) // most used first

  // reload each time the dialog opens
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new MutationObserver(() => el.open && load())
    observer.observe(el, { attributes: true, attributeFilter: ['open'] })
    return () => observer.disconnect()
  }, [ref])

  const done = async () => {
    setPicked(new Set())
    setConfirm(null)
    onChange()
    await load()
  }

  const merge = async (from: string[], into: string) => {
    for (const f of from) if (f !== into.trim().toLowerCase()) await window.lompii.renameTag(f, into)
    await done()
  }

  const remove = async (values: string[]) => {
    for (const v of values) await window.lompii.deleteTag(v)
    await done()
  }

  const rename = async (from: string) => {
    setEditing(null)
    if (draft.trim() && draft.trim().toLowerCase() !== from) await merge([from], draft)
  }

  const toggle = (v: string) => {
    const next = new Set(picked)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    setPicked(next)
    // suggest the most used of the picked tags as the name to keep
    setMergeInto(tags.find((t) => next.has(t.value))?.value ?? '')
  }

  const q = filter.trim().toLowerCase()
  const shown = tags
    .filter((t) => t.value.includes(q) && (!onceOnly || t.count === 1))
    .sort((a, b) => (sort === 'name' ? a.value.localeCompare(b.value) : 0))
  const exists = (v: string) => tags.some((t) => t.value === v.trim().toLowerCase())
  const suggestions = q || onceOnly ? [] : lookAlikes(tags)
  const once = tags.filter((t) => t.count === 1).length

  return (
    <dialog
      ref={ref}
      onMouseDown={(e) => e.target === e.currentTarget && ref.current?.close()}
      onClose={() => {
        setPicked(new Set())
        setConfirm(null)
        setEditing(null)
      }}
      className="m-auto h-[min(680px,86vh)] w-[min(600px,94vw)] flex-col overflow-hidden rounded-2xl bg-pane text-fg shadow-lift backdrop:bg-ink/70 backdrop:backdrop-blur-sm open:flex"
    >
      <div className="px-7 pt-7">
        <h2 className="font-serif text-[30px] leading-none italic">Tags</h2>
        <p className="mt-2 text-[13px] text-dim">Rename a tag by clicking it. Renaming onto a tag that already exists merges them.</p>

        <div className="mt-4 flex gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${tags.length} tags`}
            aria-label="Filter tags"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-line bg-control px-3 py-1.5 text-[13px] placeholder:text-faint focus:outline-2 focus:-outline-offset-1 focus:outline-accent"
          />
          <div role="group" aria-label="Sort" className="flex rounded-lg border border-line bg-well p-0.5">
            {(
              [
                ['count', 'Most used'],
                ['name', 'A–Z']
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                aria-pressed={sort === id}
                onClick={() => setSort(id)}
                className={`rounded-md px-2.5 text-[12px] font-medium ${sort === id ? 'bg-raised text-fg shadow-sm' : 'text-dim hover:text-fg'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button aria-pressed={onceOnly} onClick={() => setOnceOnly(!onceOnly)} className={`${BUTTON} ${onceOnly ? 'bg-select' : ''}`}>
            Used once · {once}
          </button>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-7 pb-5">
        {suggestions.length > 0 && (
          <section className="mb-4 rounded-xl border border-line bg-well p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[11px] font-semibold tracking-[0.08em] text-fg/80 uppercase">Look alike</div>
                <div className="text-[12px] text-dim">These differ only by an ending. Each merges into its most used spelling.</div>
              </div>
              <button onClick={async () => {
                for (const s of suggestions) for (const f of s.from) await window.lompii.renameTag(f.value, s.into.value)
                await done()
              }} className={BUTTON}>
                Merge all
              </button>
            </div>
            <ul className="mt-3 space-y-1.5">
              {suggestions.map((s) => (
                <li key={s.into.value} className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate">
                    {s.from.map((f) => (
                      <span key={f.value} className="mr-1.5 rounded-md bg-control px-1.5 py-0.5 text-dim">
                        {f.value} <span className="text-faint">{f.count}</span>
                      </span>
                    ))}
                    <span className="mx-1 text-faint">→</span>
                    <span className="rounded-md bg-raised px-1.5 py-0.5">
                      {s.into.value} <span className="text-dim">{s.into.count}</span>
                    </span>
                  </span>
                  <button onClick={() => merge(s.from.map((f) => f.value), s.into.value)} className="text-[12px] font-medium text-accent hover:opacity-75">
                    Merge
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ul className="divide-y divide-line rounded-xl border border-line bg-well px-4">
          {shown.map((t) => (
            <li key={t.value} className="group flex h-11 items-center gap-3">
              <Check on={picked.has(t.value)} label={`Select ${t.value}`} onToggle={() => toggle(t.value)} />
              {confirm?.length === 1 && confirm[0] === t.value ? (
                <>
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    Remove <b className="font-medium">{t.value}</b> from {t.count} {t.count === 1 ? 'item' : 'items'}?
                  </span>
                  <button onClick={() => setConfirm(null)} className={BUTTON}>
                    Cancel
                  </button>
                  <button onClick={() => remove([t.value])} className={DANGER}>
                    Remove
                  </button>
                </>
              ) : (
                <>
                  {editing === t.value ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => rename(t.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') {
                          e.stopPropagation() // cancel the edit, keep the dialog
                          setEditing(null)
                        }
                      }}
                      aria-label={`Rename ${t.value}`}
                      spellCheck={false}
                      className="min-w-0 flex-1 rounded-md border border-line bg-control px-2 py-1 text-[13px] focus:outline-2 focus:-outline-offset-1 focus:outline-accent"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditing(t.value)
                        setDraft(t.value)
                      }}
                      title="Rename"
                      className="min-w-0 flex-1 truncate text-left text-[13px] hover:text-accent"
                    >
                      {t.value}
                    </button>
                  )}
                  {editing === t.value && draft.trim() && draft.trim().toLowerCase() !== t.value && exists(draft) ? (
                    <span className="text-[12px] text-accent">merges</span>
                  ) : (
                    <span className="w-8 text-right text-[12px] tabular-nums text-dim">{t.count}</span>
                  )}
                  <button
                    onClick={() => setConfirm([t.value])}
                    aria-label={`Delete tag ${t.value}`}
                    className="grid size-7 place-items-center rounded-md text-dim opacity-0 transition group-hover:opacity-100 hover:bg-control hover:text-accent focus-visible:opacity-100"
                  >
                    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
                    </svg>
                  </button>
                </>
              )}
            </li>
          ))}
          {!shown.length && <li className="py-6 text-center text-[13px] text-dim">No tags{q || onceOnly ? ' match' : ' yet'}.</li>}
        </ul>
      </div>

      {picked.size > 0 && (
        <div className="flex items-center gap-2 border-t border-line bg-rail px-7 py-3 text-[13px]">
          {confirm && confirm.length > 1 ? (
            <>
              <span className="flex-1">Remove these {confirm.length} tags from every item that has them?</span>
              <button onClick={() => setConfirm(null)} className={BUTTON}>
                Cancel
              </button>
              <button onClick={() => remove(confirm)} className={DANGER}>
                Remove
              </button>
            </>
          ) : (
            <>
              <span className="text-dim">{picked.size} selected</span>
              <button onClick={() => setPicked(new Set())} className="text-[12px] text-dim underline-offset-2 hover:text-fg hover:underline">
                Clear
              </button>
              <span className="ml-auto text-dim">Merge into</span>
              <input
                value={mergeInto}
                onChange={(e) => setMergeInto(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && mergeInto.trim() && merge([...picked], mergeInto)}
                aria-label="Name to merge into"
                spellCheck={false}
                className="w-40 rounded-lg border border-line bg-control px-2.5 py-1.5 text-[13px] focus:outline-2 focus:-outline-offset-1 focus:outline-accent"
              />
              <button onClick={() => merge([...picked], mergeInto)} disabled={!mergeInto.trim() || (picked.size === 1 && picked.has(mergeInto.trim().toLowerCase()))} className={BUTTON}>
                Merge
              </button>
              <button onClick={() => setConfirm([...picked])} className={`${BUTTON} hover:text-accent`}>
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </dialog>
  )
}
