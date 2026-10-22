import type { Item, Kind, Stack } from '@shared/api'

export type TagIndex = Map<number, Set<string>>

export type Filter = {
  key: string
  label: string
  icon: IconName
  color?: string // stacks only
  test: (item: Item, tags: Set<string> | undefined) => boolean
}

export const STACK_COLORS = ['#2fb36c', '#ff5a1f', '#e66aa0', '#1d2026', '#4a7fe0', '#9b6cf0', '#d9a21b']

export const KINDS: Record<Kind, { label: string; plural: string; icon: Glyph }> = {
  image: { label: 'Image', plural: 'Images', icon: 'image' },
  capture: { label: 'Capture', plural: 'Captures', icon: 'capture' },
  quote: { label: 'Quote', plural: 'Quotes', icon: 'quote' },
  snippet: { label: 'Snippet', plural: 'Snippets', icon: 'snippet' }
}

// Kinds that have something in them, then stacks, then tags alphabetically.
export function buildFilters(items: Item[], index: TagIndex, stacks: Stack[]): Filter[] {
  const present = new Set(items.map((i) => i.kind))
  const tags = new Set<string>()
  for (const t of index.values()) for (const v of t) tags.add(v)
  return [
    ...(Object.keys(KINDS) as Kind[])
      .filter((k) => present.has(k))
      .map((k): Filter => ({ key: `kind:${k}`, label: KINDS[k].plural, icon: KINDS[k].icon, test: (i) => i.kind === k })),
    ...stacks.map((s): Filter => {
      const members = new Set(s.items)
      return { key: `stack:${s.id}`, label: s.name, icon: 'stack', color: s.color, test: (i) => members.has(i.id) }
    }),
    ...[...tags].sort().map((v): Filter => ({ key: `tag:${v}`, label: v, icon: 'tag', test: (_i, t) => !!t?.has(v) }))
  ]
}

/* ---------- icons ---------- */

type IconName = Glyph | 'stack'
type Glyph = 'image' | 'capture' | 'quote' | 'snippet' | 'tag' | 'vibe'

const PATHS: Record<Glyph, string[]> = {
  capture: ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2'],
  snippet: ['M17 6H3', 'M21 12H3', 'M15 18H3'],
  image: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M9 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'],
  quote: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M8 12a2 2 0 0 0 2-2V8H8', 'M14 12a2 2 0 0 0 2-2V8h-2'],
  tag: ['M4 9h16', 'M4 15h16', 'M10 3 8 21', 'M16 3l-2 18'],
  vibe: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z']
}

// stacks show their colour ring instead of a glyph
export function FilterIcon({ filter, className = 'size-4' }: { filter: Filter; className?: string }) {
  if (filter.icon === 'stack')
    return <span className={`shrink-0 rounded-full border-2 ${className}`} style={{ borderColor: filter.color }} />
  return <Icon name={filter.icon} className={`text-dim ${className}`} />
}

export function Icon({ name, className = 'size-4' }: { name: Glyph; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

/* ---------- chips ---------- */

// The row under the search bar. mousedown is cancelled so the search keeps focus.
export function FilterRow({ filters, onPick }: { filters: Filter[]; onPick: (key: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 pt-4">
      {filters.map((f) => (
        <button
          key={f.key}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(f.key)}
          className="flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-[14px] text-fg shadow-card transition-shadow hover:shadow-lift"
        >
          <FilterIcon filter={f} />
          {f.label}
        </button>
      ))}
    </div>
  )
}

// The applied filter, sitting inside the search bar.
export function ActiveFilter({ filter, onRemove }: { filter: Filter; onRemove: () => void }) {
  return (
    <span className="flex shrink-0 items-center gap-2.5 rounded-full bg-fg/[0.06] py-2 pr-2.5 pl-4 text-[17px]">
      <FilterIcon filter={filter} className="size-[18px]" />
      {filter.label}
      <button
        onClick={onRemove}
        aria-label={`Remove ${filter.label} filter`}
        className="grid size-[18px] place-items-center rounded-full bg-fg text-card transition-opacity hover:opacity-80"
      >
        <svg viewBox="0 0 12 12" className="size-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M3 3l6 6M9 3 3 9" />
        </svg>
      </button>
    </span>
  )
}

// A search word fixed with Enter. Shares the applied filter's size, without an icon.
export function TermChip({ term, onRemove }: { term: string; onRemove: () => void }) {
  return (
    <span className="group flex shrink-0 items-center gap-1.5 rounded-full bg-fg/[0.06] py-2 pr-2 pl-4 text-[17px]">
      {term}
      <button
        onClick={onRemove}
        aria-label={`Remove “${term}”`}
        className="grid size-[18px] place-items-center rounded-full text-dim opacity-0 transition group-hover:opacity-100 hover:bg-fg hover:text-card focus-visible:opacity-100"
      >
        <svg viewBox="0 0 12 12" className="size-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M3 3l6 6M9 3 3 9" />
        </svg>
      </button>
    </span>
  )
}
