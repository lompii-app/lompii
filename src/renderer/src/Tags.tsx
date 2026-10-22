import { useEffect, useState } from 'react'

// Every tag in the library with how many items carry it. Renaming onto an existing tag merges
// the two (motivational → motivation); deleting takes the tag off every item.
export default function TagsDialog({
  ref,
  onChange
}: {
  ref: React.RefObject<HTMLDialogElement | null>
  onChange: () => void // tags changed; refresh filters and search
}) {
  const [tags, setTags] = useState<{ value: string; count: number }[]>([])
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const load = () => window.tessera.tagCounts().then(setTags)

  // reload each time the dialog opens
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new MutationObserver(() => el.open && load())
    observer.observe(el, { attributes: true, attributeFilter: ['open'] })
    return () => observer.disconnect()
  }, [ref])

  const rename = async (from: string) => {
    setEditing(null)
    if (draft.trim() && draft.trim().toLowerCase() !== from) {
      await window.tessera.renameTag(from, draft)
      onChange()
      load()
    }
  }

  const remove = async (value: string, count: number) => {
    if (!confirm(`Remove “${value}” from ${count} ${count === 1 ? 'item' : 'items'}?`)) return
    await window.tessera.deleteTag(value)
    onChange()
    load()
  }

  const shown = tags.filter((t) => t.value.includes(filter.trim().toLowerCase()))
  const exists = (v: string) => tags.some((t) => t.value === v.trim().toLowerCase())

  return (
    <dialog
      ref={ref}
      className="m-auto max-h-[80vh] w-[460px] flex-col rounded-lg bg-card p-8 text-fg shadow-lift backdrop:bg-ink/70 backdrop:backdrop-blur-sm open:flex"
    >
      <h2 className="font-serif text-[30px] leading-none italic">Tags</h2>
      <p className="mt-2 text-[13px] text-dim">
        Click a name to rename it. Renaming onto a tag that already exists merges them.
      </p>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Filter ${tags.length} tags`}
        aria-label="Filter tags"
        spellCheck={false}
        className="mt-4 w-full rounded-md bg-ink px-3 py-2 text-[14px] placeholder:text-faint focus:outline-2 focus:outline-accent"
      />

      <ul className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {shown.map((t) => (
          <li key={t.value} className="group flex items-center gap-3 border-b border-line/60 py-1.5">
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
                className="min-w-0 flex-1 rounded-sm bg-ink px-2 py-0.5 text-[14px] focus:outline-2 focus:outline-accent"
              />
            ) : (
              <button
                onClick={() => {
                  setEditing(t.value)
                  setDraft(t.value)
                }}
                className="min-w-0 flex-1 truncate text-left text-[14px] hover:underline"
              >
                {t.value}
              </button>
            )}
            {editing === t.value && draft.trim() && draft.trim().toLowerCase() !== t.value && exists(draft) ? (
              <span className="text-[12px] text-accent">merges</span>
            ) : (
              <span className="text-[12px] text-dim">{t.count}</span>
            )}
            <button
              onClick={() => remove(t.value, t.count)}
              aria-label={`Delete tag ${t.value}`}
              className="grid size-6 place-items-center rounded-full text-dim opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100"
            >
              <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="M3 3l6 6M9 3 3 9" />
              </svg>
            </button>
          </li>
        ))}
        {!shown.length && <li className="py-4 text-center text-[13px] text-dim">No tags{filter ? ' match' : ' yet'}.</li>}
      </ul>

      <div className="mt-5 flex justify-end">
        <button
          onClick={() => ref.current?.close()}
          className="rounded-md bg-fg px-5 py-2 text-[14px] text-card transition-opacity hover:opacity-85"
        >
          Done
        </button>
      </div>
    </dialog>
  )
}
