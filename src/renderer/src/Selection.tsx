import { useState } from 'react'
import type { Stack } from '@shared/api'

// The bar shown while several items are selected (Ctrl/Shift-click in the grid).
export default function SelectionBar({
  count,
  stacks,
  onAddToStack,
  onNewStack,
  onAddTags,
  onDelete,
  onClear
}: {
  count: number
  stacks: Stack[]
  onAddToStack: (stackId: number) => void
  onNewStack: (name: string) => Promise<void>
  onAddTags: (tags: string[]) => void
  onDelete: () => void
  onClear: () => void
}) {
  const [open, setOpen] = useState<'stack' | 'tags' | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const toggle = (which: 'stack' | 'tags') => {
    setOpen((o) => (o === which ? null : which))
    setText('')
    setError('')
  }

  const submit = async () => {
    const value = text.trim()
    if (!value) return
    if (open === 'tags') onAddTags(value.split(',').map((t) => t.trim()).filter(Boolean))
    else
      try {
        await onNewStack(value)
      } catch (e) {
        return setError(String(e).includes('stack exists') ? 'A stack with that name already exists.' : 'Could not create it.')
      }
    setOpen(null)
    setText('')
  }

  const button = 'rounded-full px-3.5 py-1.5 transition-colors hover:bg-card/15'

  return (
    <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 transition duration-200 starting:translate-y-3 starting:opacity-0">
      {open && (
        <div className="absolute bottom-full left-1/2 mb-2 w-72 -translate-x-1/2 rounded-lg bg-card p-2 text-fg shadow-lift">
          {open === 'stack' &&
            stacks.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onAddToStack(s.id)
                  setOpen(null)
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[14px] transition-colors hover:bg-ink"
              >
                <span className="size-3 shrink-0 rounded-full border-2" style={{ borderColor: s.color }} />
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') {
                e.stopPropagation() // close the popover, keep the selection
                setOpen(null)
              }
            }}
            placeholder={open === 'tags' ? 'Tags, separated by commas' : stacks.length ? 'New stack…' : 'Name a new stack…'}
            aria-label={open === 'tags' ? 'Tags to add' : 'New stack name'}
            spellCheck={false}
            maxLength={open === 'tags' ? 300 : 50}
            className="mt-1 w-full rounded-md bg-ink px-2.5 py-1.5 text-[14px] placeholder:text-faint focus:outline-2 focus:outline-accent"
          />
          {error && <p className="px-2 pt-1.5 text-[12px] text-red-600">{error}</p>}
        </div>
      )}

      <div role="toolbar" aria-label="Selected items" className="flex items-center gap-1 rounded-full bg-fg py-1.5 pr-1.5 pl-5 text-[14px] text-card shadow-lift">
        <span className="mr-2">
          {count} selected
        </span>
        <button onClick={() => toggle('stack')} className={button}>
          Add to stack
        </button>
        <button onClick={() => toggle('tags')} className={button}>
          Add tags
        </button>
        <button onClick={onDelete} className={`${button} hover:text-red-300`}>
          Delete
        </button>
        <button onClick={onClear} aria-label="Clear selection" title="Clear (Esc)" className={`${button} px-2.5`}>
          <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M3 3l6 6M9 3 3 9" />
          </svg>
        </button>
      </div>
    </div>
  )
}
