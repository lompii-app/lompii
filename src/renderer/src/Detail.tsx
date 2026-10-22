import { useEffect, useRef, useState } from 'react'
import { isText, type Item, type Stack, type Tag } from '@shared/api'
import { Icon, KINDS, STACK_COLORS } from './Filters'
import { url } from './useItems'

const LABEL = 'text-[11px] uppercase tracking-wider text-dim'
const CHIP = 'rounded-full px-3 py-1 text-[13px]'

const host = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return u
  }
}

// #999999 → #999 when every channel is a doubled digit, as designers write it
const shortHex = (c: string): string =>
  /^#(.)\1(.)\2(.)\3$/i.test(c) ? `#${c[1]}${c[3]}${c[5]}` : c

const fmtBytes = (n: number): string =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60]
]
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const ago = (t: number): string => {
  const s = (t - Date.now()) / 1000
  for (const [unit, n] of UNITS) if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit)
  return 'just now'
}

export default function Detail({
  item,
  stacks,
  tagNames,
  onStacksChange,
  aiReady,
  onSameVibe,
  onClose,
  onDelete
}: {
  item: Item
  stacks: Stack[]
  tagNames: string[] // offered as suggestions while typing a tag
  onStacksChange: () => void
  aiReady: boolean // an AI key is set
  onSameVibe: (id: number) => void
  onClose: () => void
  onDelete: (id: number) => void
}) {
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [bytes, setBytes] = useState(0)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [picking, setPicking] = useState(false) // the add-to-stack popover
  const [note, setNote] = useState('')
  const [palette, setPalette] = useState<string[]>([])
  const [flash, setFlash] = useState('') // brief confirmation after copy / save
  const [copiedSwatch, setCopiedSwatch] = useState<number | null>(null) // its bubble reads "Copied"

  useEffect(() => {
    setTitle(item.title ?? '')
    setNote(item.note ?? '')
    setAdding(false)
    setDraft('')
    setPicking(false)
    setPalette([])
    window.tessera.fileSize(item.id).then(setBytes)
    window.tessera.palette(item.id).then(setPalette)
  }, [item.id])

  const confirmFlash = (text: string) => {
    setFlash(text)
    setTimeout(() => setFlash(''), 1500)
  }

  // re-runs on item:updated, which is how new tags (from here or the extension) show up
  useEffect(() => {
    window.tessera.tags(item.id).then(setTags)
  }, [item])

  const save = (patch: Partial<Pick<Item, 'title' | 'note'>>, changed: boolean) => {
    if (changed) window.tessera.update(item.id, patch)
  }

  const submitTags = () => {
    const next = draft.split(',').map((t) => t.trim()).filter(Boolean)
    setDraft('')
    if (next.length) window.tessera.addTags(item.id, next)
  }

  const onTagKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submitTags() // stays open for the next tag
    if (e.key === 'Escape') {
      e.stopPropagation() // close the input, not the overlay
      setDraft('')
      setAdding(false)
    }
  }

  const closeOnSelf = (e: React.MouseEvent) => e.target === e.currentTarget && onClose()
  const tall = !isText(item.kind) && item.height / item.width > 2

  return (
    <div
      onClick={closeOnSelf}
      className="fixed inset-0 z-40 bg-black/45 px-16 py-12 backdrop-blur-sm transition-opacity duration-200 starting:opacity-0"
    >
      <p className="pointer-events-none absolute inset-x-0 top-4 text-center text-[13px] text-white/85">
        ↓ Esc to close
      </p>
      <div
        className="flex h-full overflow-hidden rounded-lg shadow-lift transition duration-300 ease-out starting:translate-y-6 starting:opacity-0"
        style={{ background: item.dominant_color }}
      >
        {/* image: fitted to the area; only full-page captures (taller than 2:1) scroll */}
        <div className="relative min-w-0 flex-1">
          <div
            onClick={closeOnSelf}
            className={`absolute inset-0 p-10 ${
              tall ? 'overflow-y-auto' : isText(item.kind) ? 'grid place-items-center overflow-y-auto' : ''
            }`}
          >
            {item.kind === 'snippet' ? (
              <div className="max-h-full max-w-2xl cursor-text overflow-y-auto text-[20px] leading-relaxed whitespace-pre-line text-fg select-text">
                {item.body}
              </div>
            ) : item.kind === 'quote' ? (
              <blockquote className="max-h-full max-w-3xl cursor-text overflow-y-auto text-center font-serif text-fg select-text">
                <span aria-hidden className="block font-[Georgia,serif] text-[52px] leading-none">“</span>
                <p className="my-6 text-[34px] leading-snug whitespace-pre-line">{item.body}</p>
                <span aria-hidden className="block font-[Georgia,serif] text-[52px] leading-none">”</span>
              </blockquote>
            ) : (
              <img
                src={url(item.file_path)}
                alt={item.title ?? ''}
                draggable={false}
                className={tall ? 'mx-auto w-full max-w-4xl' : 'size-full object-contain'}
              />
            )}
          </div>
          <div className="absolute bottom-5 left-5 flex items-center gap-3">
            {palette.length > 0 && (
              // overlapped at rest, fanned out on hover; the ring at the end copies all of them
              <div className="group flex">
                {[...palette.map(shortHex), null].map((c, i) => (
                  <button
                    key={c ?? 'all'}
                    onClick={() =>
                      navigator.clipboard.writeText(c ?? palette.map(shortHex).join(' ')).then(() => {
                        setCopiedSwatch(i)
                        setTimeout(() => setCopiedSwatch((s) => (s === i ? null : s)), 1200)
                      })
                    }
                    aria-label={c ? `Copy colour ${c}` : 'Copy all colours'}
                    style={c ? { background: c } : undefined}
                    className={`group/swatch relative size-7 shrink-0 rounded-full transition-[margin] duration-200 ease-out ${
                      c ? 'shadow-card' : 'border-2 border-white'
                    } ${i ? '-ml-4 group-hover:ml-2' : ''}`}
                  >
                    <span
                      className={`pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-full px-3 py-1 text-[13px] whitespace-nowrap shadow-lift transition duration-150 ${
                        copiedSwatch === i
                          ? 'translate-y-0 bg-fg/85 text-card opacity-100'
                          : 'translate-y-1 bg-card text-fg opacity-0 group-hover/swatch:translate-y-0 group-hover/swatch:opacity-100'
                      }`}
                    >
                      {copiedSwatch === i ? 'Copied' : (c ?? 'Copy all')}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => onSameVibe(item.id)}
              className="flex items-center gap-2 rounded-full border border-white/25 bg-black/35 px-4 py-1.5 text-[12px] tracking-wider text-white uppercase backdrop-blur-md transition-colors hover:bg-black/50"
            >
              <Icon name="vibe" className="size-4" />
              Same vibe
            </button>
          </div>
        </div>

        {/* panel */}
        <aside className="m-2 flex w-[400px] shrink-0 flex-col overflow-hidden rounded-md bg-ink">
          <div className="bg-linear-to-b from-fg/[0.06] to-transparent px-6 pt-6 pb-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => save({ title: title.trim() || null }, title.trim() !== (item.title ?? ''))}
              placeholder={item.status === 'analysing' ? 'Title goes here' : 'Untitled'}
              spellCheck={false}
              className="w-full bg-transparent text-[26px] leading-tight tracking-tight placeholder:text-faint focus:outline-none"
            />
            <div className="mt-1 flex items-center gap-2 text-[14px] text-dim">
              <span title={new Date(item.created_at).toLocaleString()}>{ago(item.created_at)}</span>
              {item.source_url && (
                <button
                  onClick={() => window.tessera.openExternal(item.source_url!)}
                  title={item.source_url}
                  className="flex min-w-0 items-center gap-1 text-fg/70 transition-colors hover:text-fg"
                >
                  <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="M9 15 15 9M10 9h5v5" />
                  </svg>
                  <span className="truncate">{host(item.source_url)}</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pt-3 pb-5">
            <fieldset className="rounded-md border border-line px-4 pt-1 pb-3">
              <legend className="px-1.5 text-[11px] tracking-wider text-accent uppercase">TLDR</legend>
              {item.status === 'analysing' ? (
                <Thinking />
              ) : item.status === 'tagged' && item.tldr ? (
                <p className="text-[15px] leading-relaxed text-fg/80 select-text">{item.tldr}</p>
              ) : item.status === 'failed' ? (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-[13px] leading-relaxed text-red-600">
                    Couldn't analyse this: {item.ai_error ?? 'unknown error'}
                  </p>
                  <button onClick={() => window.tessera.analyse(item.id)} className="text-[13px] text-fg underline">
                    Try again
                  </button>
                </div>
              ) : aiReady ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[15px] leading-relaxed text-faint">Not analysed yet.</p>
                  <button
                    onClick={() => window.tessera.analyse(item.id)}
                    className="shrink-0 rounded-full bg-fg px-3 py-1 text-[12px] text-card transition-opacity hover:opacity-85"
                  >
                    Analyse
                  </button>
                </div>
              ) : (
                <p className="text-[14px] leading-relaxed text-faint">
                  Add an AI key in Settings to get a title, summary and tags.
                </p>
              )}
            </fieldset>

            <section className="flex flex-col gap-2.5">
              <span className={LABEL}>Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {adding ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onTagKey}
                    onBlur={() => {
                      submitTags()
                      setAdding(false)
                    }}
                    list="tag-names"
                    placeholder="Tag, then Enter"
                    aria-label="New tag; separate several with commas"
                    spellCheck={false}
                    className={`${CHIP} w-36 bg-card shadow-card outline-2 outline-accent placeholder:text-faint`}
                  />
                ) : (
                  <button
                    onClick={() => setAdding(true)}
                    className={`${CHIP} bg-accent text-white transition-opacity hover:opacity-90`}
                  >
                    + Add tag
                  </button>
                )}
                <datalist id="tag-names">
                  {tagNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <span className={`${CHIP} flex items-center gap-1.5 bg-card text-dim shadow-card`}>
                  <Icon name={KINDS[item.kind].icon} className="size-3.5" />
                  {KINDS[item.kind].label}
                </span>
                {tags.map((t) => (
                  <span
                    key={t.id}
                    title={t.dimension}
                    className={`${CHIP} group flex items-center gap-1 bg-fg/[0.06] pr-1.5 text-dim`}
                  >
                    {t.value}
                    <button
                      onClick={() => window.tessera.removeTag(item.id, t.value)}
                      aria-label={`Remove tag ${t.value}`}
                      className="grid size-4 place-items-center rounded-full opacity-40 transition hover:bg-fg/10 hover:opacity-100 group-hover:opacity-70"
                    >
                      <svg viewBox="0 0 12 12" className="size-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                        <path d="M3 3l6 6M9 3 3 9" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </section>

            <label className="flex flex-col gap-2.5">
              <span className={LABEL}>Notes</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => save({ note: note.trim() || null }, note.trim() !== (item.note ?? ''))}
                onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), e.currentTarget.blur())}
                placeholder="Type here to add a note…"
                rows={3}
                className="w-full resize-none rounded-md bg-card px-3.5 py-3 text-[14px] leading-relaxed shadow-card placeholder:text-faint focus:outline-2 focus:outline-accent"
              />
            </label>

            {!isText(item.kind) && (
              <div className="flex gap-2 text-[12px] text-dim">
                <span>
                  {item.width} × {item.height}
                </span>
                <span>·</span>
                <span>{fmtBytes(bytes)}</span>
              </div>
            )}
          </div>

          <div className="relative flex justify-center gap-3 pb-6">
            {flash && (
              <span className="absolute -top-9 rounded-md bg-fg px-2.5 py-1 text-[12px] text-card">{flash}</span>
            )}
            {picking && (
              <StackPicker
                item={item}
                stacks={stacks}
                onChange={onStacksChange}
                onClose={() => setPicking(false)}
              />
            )}
            <IconButton
              label="Download"
              onClick={() => window.tessera.saveAs(item.id).then((ok) => ok && confirmFlash('Saved'))}
            >
              <path d="M12 4v12M6 11l6 6 6-6M5 21h14" />
            </IconButton>
            <IconButton
              label="Add to stack"
              active={picking || stacks.some((s) => s.items.includes(item.id))}
              onClick={() => setPicking((p) => !p)}
            >
              <circle cx="12" cy="12" r="8" />
            </IconButton>
            <IconButton
              label={isText(item.kind) ? 'Copy text' : 'Copy image'}
              onClick={() => window.tessera.copy(item.id).then(() => confirmFlash('Copied'))}
            >
              <rect x="8" y="8" width="13" height="13" rx="2" />
              <path d="M4 16V5a2 2 0 0 1 2-2h11" />
            </IconButton>
            <IconButton
              label="Delete"
              onClick={() => onDelete(item.id)}
            >
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </IconButton>
          </div>
        </aside>
      </div>
    </div>
  )
}

// the loading state while the AI looks at the item: a slow glow with a looping trace
function Thinking() {
  return (
    <div role="status" aria-label="Analysing" className="relative grid h-24 place-items-center overflow-hidden">
      <div className="absolute size-28 animate-[tessera-glow_2.6s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,#e8336b_0%,#7c4dff_45%,transparent_70%)] blur-xl" />
      <svg viewBox="0 0 48 24" className="relative w-16" fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round">
        <path
          d="M24 12C20 6 10 6 10 12s10 6 14 0 14-6 14 0-10 6-14 0"
          pathLength={100}
          strokeDasharray="45 55"
          className="animate-[tessera-trace_2.2s_linear_infinite]"
        />
      </svg>
    </div>
  )
}

function IconButton({
  label,
  active = false,
  onClick,
  children
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      data-picker-toggle={label === 'Add to stack' || undefined}
      className={`grid size-10 place-items-center rounded-full shadow-card transition hover:shadow-lift ${
        active ? 'bg-fg text-card' : 'bg-card text-dim hover:text-fg'
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}

// Tick stacks this item belongs to, or make a new one with it already inside.
function StackPicker({
  item,
  stacks,
  onChange,
  onClose
}: {
  item: Item
  stacks: Stack[]
  onChange: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => ref.current?.focus(), [])

  const toggle = async (s: Stack) => {
    await window.tessera.setInStack(s.id, item.id, !s.items.includes(item.id))
    onChange()
  }

  const create = async () => {
    if (!name.trim()) return
    try {
      const id = await window.tessera.createStack(name, STACK_COLORS[stacks.length % STACK_COLORS.length])
      await window.tessera.setInStack(id, item.id, true)
      setName('')
      setError('')
      onChange()
    } catch (e) {
      setError(String(e).includes('stack exists') ? 'A stack with that name already exists.' : 'Could not create the stack.')
    }
  }

  // closes when focus leaves it, except to the toggle button, which closes it itself
  const onBlur = (e: React.FocusEvent) => {
    const to = e.relatedTarget as HTMLElement | null
    if (!ref.current?.contains(to) && !to?.dataset.pickerToggle) onClose()
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.stopPropagation() // close the picker, not the overlay
        onClose()
      }}
      className="absolute bottom-[4.25rem] left-1/2 z-10 w-64 -translate-x-1/2 rounded-lg bg-card p-2 shadow-lift outline-none"
    >
      <div className="px-2 pt-1 pb-2 text-[11px] tracking-wider text-dim uppercase">Add to stack</div>
      <div className="max-h-56 overflow-y-auto">
        {stacks.map((s) => {
          const member = s.items.includes(item.id)
          return (
            <button
              key={s.id}
              onClick={() => toggle(s)}
              role="menuitemcheckbox"
              aria-checked={member}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[14px] transition-colors hover:bg-ink"
            >
              <span
                className="size-3 shrink-0 rounded-full border-2"
                style={{ borderColor: s.color, background: member ? s.color : 'transparent' }}
              />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              {member && (
                <svg viewBox="0 0 24 24" className="size-4 text-fg" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && create()}
        placeholder={stacks.length ? 'New stack…' : 'Name your first stack…'}
        aria-label="New stack name"
        spellCheck={false}
        maxLength={50}
        className="mt-1 w-full rounded-md bg-ink px-2.5 py-1.5 text-[14px] placeholder:text-faint focus:outline-2 focus:outline-accent"
      />
      {error && <p className="px-2 pt-1.5 text-[12px] text-red-600">{error}</p>}
    </div>
  )
}
