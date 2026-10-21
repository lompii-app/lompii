import { useEffect, useMemo, useRef, useState } from 'react'
import Detail from './Detail'
import {
  AI_PROVIDERS,
  DEFAULT_MODELS,
  detectProvider,
  type AiProvider,
  type EmbeddingStatus,
  type Settings,
  type Stack
} from '@shared/api'
import { ActiveFilter, buildFilters, FilterRow, TermChip, type Filter, type TagIndex } from './Filters'
import Grid from './Grid'
import Sidebar from './Sidebar'
import Stacks from './Stacks'
import WindowControls from './WindowControls'
import { useItems } from './useItems'

type View = 'everything' | 'stacks'

const LABEL = 'text-[11px] uppercase tracking-wider text-dim'
const BOX = 'min-w-0 flex-1 rounded-md bg-ink px-3 py-2 text-[13px]'
const FIELD = 'rounded-md bg-ink px-3 py-2 text-[13px] placeholder:text-faint focus:outline-2 focus:outline-accent'
const GHOST = 'shrink-0 rounded-md px-3 py-2 text-[13px] text-dim transition-colors hover:bg-ink hover:text-fg'
const TABS: [View, string][] = [['everything', 'Everything'], ['stacks', 'Stacks']]

export default function App() {
  const [items, setItems] = useItems()
  const [view, setView] = useState<View>('everything')
  const [query, setQuery] = useState('')
  const [terms, setTerms] = useState<string[]>([]) // search words turned into chips with Enter; all must match
  const [filterKey, setFilterKey] = useState<string | null>(null)
  const [vibe, setVibe] = useState<number[] | null>(null) // same-vibe results: the item, then its matches
  const [focused, setFocused] = useState<'big' | 'pill' | null>(null)
  const [scrolled, setScrolled] = useState(false) // header out of view: show the floating search
  const [tagIndex, setTagIndex] = useState<TagIndex>(new Map())
  const [stacks, setStacks] = useState<Stack[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [stacksVersion, setStacksVersion] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const pillRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const settingsRef = useRef<HTMLDialogElement>(null)

  // item:added / item:updated replace `items`, which is also when tags can have changed;
  // stacksVersion covers stack edits, which touch no item
  useEffect(() => {
    let live = true
    Promise.all([window.tessera.tagIndex(), window.tessera.stacks()]).then(([rows, list]) => {
      const index: TagIndex = new Map()
      for (const { item, value } of rows) {
        const tags = index.get(item) ?? new Set<string>()
        index.set(item, tags.add(value))
      }
      if (!live) return
      setTagIndex(index)
      setStacks(list)
    })
    return () => {
      live = false
    }
  }, [items, stacksVersion])

  useEffect(() => {
    window.tessera.getSettings().then(setSettings)
  }, [])

  const refreshStacks = () => setStacksVersion((v) => v + 1)
  const filters = useMemo(() => buildFilters(items, tagIndex, stacks), [items, tagIndex, stacks])
  // same vibe acts as one more filter, but keeps its own order (closest first)
  const vibeFilter = useMemo((): Filter | null => {
    if (!vibe) return null
    const ids = new Set(vibe)
    return { key: 'vibe', label: 'Same vibe', icon: 'vibe', test: (i) => ids.has(i.id) }
  }, [vibe])
  const active = vibeFilter ?? filters.find((f) => f.key === filterKey) ?? null
  // the row under the search offers only the kinds; tags are found by typing, stacks from Stacks
  const kindFilters = useMemo(() => filters.filter((f) => f.key.startsWith('kind:')), [filters])

  const visible = useMemo(() => {
    const words = [...terms, query].map((t) => t.trim().toLowerCase()).filter(Boolean)
    const matches = items.filter((i) => {
      const tags = tagIndex.get(i.id)
      if (active && !active.test(i, tags)) return false
      const fields = [i.title, i.body, i.note, i.tldr, i.visible_text, i.file_path, ...(tags ?? [])]
      return words.every((w) => fields.some((s) => s?.toLowerCase().includes(w)))
    })
    if (!vibe) return matches
    const rank = new Map(vibe.map((id, n) => [id, n]))
    return matches.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
  }, [items, tagIndex, active, terms, query, vibe])

  const pickFilter = (key: string | null) => {
    setFilterKey(key)
    setVibe(null)
    setView('everything')
  }
  const clearFilter = () => pickFilter(null)

  const sameVibe = async (id: number) => {
    const ids = await window.tessera.similar(id)
    setOpen(false)
    setQuery('')
    setTerms([])
    setFilterKey(null)
    setVibe(ids)
    setView('everything')
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const current = items.find((i) => i.id === selected) ?? null

  const openItem = (id: number) => {
    setSelected(id)
    setOpen(true)
  }

  const remove = async (id: number) => {
    await window.tessera.remove(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    setSelected(null)
    setOpen(false)
  }

  /* drag & drop, paste */
  useEffect(() => {
    // dragenter/leave fire for every child crossed; count them to know when the window is left
    let depth = 0
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
    const stop = (e: Event) => e.preventDefault()
    const onEnter = (e: DragEvent) => hasFiles(e) && ++depth === 1 && setDragging(true)
    const onLeave = (e: DragEvent) => hasFiles(e) && --depth === 0 && setDragging(false)
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragging(false)
      const paths = [...(e.dataTransfer?.files ?? [])].map((f) => window.tessera.pathForFile(f))
      if (paths.length) window.tessera.ingestPaths(paths.filter(Boolean))
    }
    const onPaste = (e: ClipboardEvent) => {
      for (const f of e.clipboardData?.files ?? []) {
        if (f.type.startsWith('image/')) f.arrayBuffer().then((b) => window.tessera.ingestBuffer(b))
      }
    }
    window.addEventListener('dragover', stop)
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragover', stop)
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
    }
  }, [])

  /* Cmd/Ctrl+K, Enter, Esc */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)

      const inSearch = document.activeElement === searchRef.current || document.activeElement === pillRef.current

      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        ;(scrolled ? pillRef : searchRef).current?.select()
      } else if (e.key === 'Enter' && !typing && selected != null) {
        setOpen(true)
      } else if (e.key === 'Escape') {
        if (inSearch) {
          if (query) setQuery('')
          else (document.activeElement as HTMLElement).blur()
        }
        else if (open) setOpen(false)
        else setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, open, query, scrolled])

  // both search fields edit the same query and filter
  const searchField = (which: 'big' | 'pill', className: string) => (
    <input
      ref={which === 'big' ? searchRef : pillRef}
      value={query}
      onChange={(e) => {
        setQuery(e.target.value)
        setView('everything')
      }}
      onFocus={() => setFocused(which)}
      onBlur={() => setFocused(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && query.trim()) {
          setTerms((t) => (t.includes(query.trim()) ? t : [...t, query.trim()]))
          setQuery('')
        } else if (e.key === 'Backspace' && !query) {
          // remove the last chip: a word first, then the filter
          if (terms.length) setTerms((t) => t.slice(0, -1))
          else clearFilter()
        }
      }}
      placeholder={
        terms.length ? 'Add another…' : active ? `Search ${active.label.toLowerCase()}…` : 'Search my references…'
      }
      spellCheck={false}
      className={`min-w-0 flex-1 bg-transparent font-serif italic tracking-tight placeholder:text-faint focus:outline-none ${className}`}
    />
  )


  return (
    <div className="flex h-full pt-10">
      {/* stands in for the hidden title bar; z-50 keeps the controls above the detail overlay */}
      <div className="fixed inset-x-0 top-0 z-50 flex h-10 items-center justify-end pr-4 [-webkit-app-region:drag]">
        <WindowControls />
      </div>

      <Sidebar onSettings={() => settingsRef.current?.showModal()} />

      {/* header and content scroll together; past the header, the floating search takes over */}
      <main
        ref={scrollRef}
        onScroll={(e) =>
          setScrolled(e.currentTarget.scrollTop > (headerRef.current?.offsetHeight ?? 0) - 40)
        }
        className="relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
      >
        <header ref={headerRef} className="pr-20 pl-1">
          <div className="flex justify-end gap-9">
            {TABS.map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`relative pt-3 text-[18px] transition-colors ${
                  view === v ? 'text-fg' : 'text-dim hover:text-fg'
                }`}
              >
                {view === v && (
                  <span className="absolute inset-x-0 top-0 h-[3px] rounded-b-full bg-accent" />
                )}
                {label}
                {v === 'everything' && items.length > 0 && (
                  <span className="ml-1.5 text-[12px] text-dim">{items.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line pb-4">
            {active && <ActiveFilter filter={active} onRemove={clearFilter} />}
            {terms.map((t) => (
              <TermChip key={t} term={t} onRemove={() => setTerms((all) => all.filter((x) => x !== t))} />
            ))}
            {searchField('big', 'min-w-64 text-[60px] leading-tight')}
            <kbd className="shrink-0 rounded-sm bg-black/[0.05] px-2.5 py-1 font-sans text-[13px] text-dim">
              Ctrl K
            </kbd>
          </div>

          {focused === 'big' && !active && <FilterRow filters={kindFilters} onPick={pickFilter} />}
        </header>

        {view === 'stacks' ? (
          <Stacks items={items} stacks={stacks} onOpen={pickFilter} onChange={refreshStacks} />
        ) : visible.length ? (
          <Grid
            scrollRef={scrollRef}
            items={visible}
            selected={selected}
            onSelect={setSelected}
            onOpen={openItem}
            onDelete={remove}
          />
        ) : (
          <div className="grid place-items-center py-32 pr-20">
            <div className="max-w-md text-center">
              <p className="font-serif text-[32px] italic text-dim">
                {items.length ? 'Nothing matches that.' : 'Nothing here yet.'}
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-dim">
                {items.length
                  ? 'Try another word, or clear the search and filter.'
                  : 'In Chrome, right-click an image or selected text and choose “Add to Tessera”, or press Alt+Shift+S to capture part of a page. You can also drop or paste an image here.'}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* right-3 leaves the scrollbar uncovered; pr-17 then lines the pill up with the content */}
      <div
        inert={!scrolled}
        className={`fixed top-10 right-3 left-20 z-30 pr-17 pl-1 transition duration-200 ease-out ${
          scrolled ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0'
        }`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-10 h-36 bg-linear-to-b from-ink via-ink/80 to-transparent"
        />
        <div className="relative pt-3">
          <div className="flex items-center gap-3 rounded-full bg-card py-2 pr-3 pl-7 shadow-lift">
            {active && <ActiveFilter filter={active} onRemove={clearFilter} />}
            {terms.map((t) => (
              <TermChip key={t} term={t} onRemove={() => setTerms((all) => all.filter((x) => x !== t))} />
            ))}
            {searchField('pill', 'py-1 text-[26px]')}
            <kbd className="shrink-0 rounded-full bg-black/[0.05] px-3 py-1 font-sans text-[12px] text-dim">
              Ctrl K
            </kbd>
          </div>
          {focused === 'pill' && !active && <FilterRow filters={kindFilters} onPick={pickFilter} />}
        </div>
      </div>

      {open && current && (
        <Detail
          item={current}
          stacks={stacks}
          tagNames={filters.filter((f) => f.icon === 'tag').map((f) => f.label)}
          onStacksChange={refreshStacks}
          aiReady={!!settings?.ai?.hasKey}
          onSameVibe={sameVibe}
          onClose={() => setOpen(false)}
          onDelete={remove}
        />
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 bg-ink/80 p-6 backdrop-blur-sm">
          <div className="grid h-full place-items-center rounded-xl border-2 border-dashed border-accent/60">
            <p className="font-serif text-[48px] italic text-fg">Drop to save</p>
          </div>
        </div>
      )}

      <SettingsDialog
        ref={settingsRef}
        settings={settings}
        unanalysed={items.filter((i) => i.status === 'pending' || i.status === 'failed').length}
        onChange={setSettings}
      />
    </div>
  )
}

function SettingsDialog({
  ref,
  settings,
  unanalysed,
  onChange
}: {
  ref: React.RefObject<HTMLDialogElement | null>
  settings: Settings | null
  unanalysed: number
  onChange: (s: Settings) => void
}) {
  const [copied, setCopied] = useState(false)
  const [key, setKey] = useState('')
  const [provider, setProvider] = useState<AiProvider>('anthropic')
  const [model, setModel] = useState(DEFAULT_MODELS.anthropic)
  const [baseUrl, setBaseUrl] = useState('')
  const [status, setStatus] = useState('')
  const [vision, setVision] = useState<EmbeddingStatus | null>(null)

  // same-vibe indexing progress, refreshed while the dialog is open
  useEffect(() => {
    const tick = () => ref.current?.open && window.tessera.embeddingStatus().then(setVision)
    const timer = setInterval(tick, 2000)
    return () => clearInterval(timer)
  }, [ref])

  // load the saved AI choice whenever settings arrive or change
  useEffect(() => {
    if (!settings?.ai) return
    setProvider(settings.ai.provider)
    setModel(settings.ai.model)
    setBaseUrl(settings.ai.baseUrl)
  }, [settings])

  const copy = async () => {
    await navigator.clipboard.writeText(settings?.token ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const pickProvider = (p: AiProvider) => {
    // keep a model the user typed; swap only the previous provider's default
    if (!model.trim() || model === DEFAULT_MODELS[provider]) setModel(DEFAULT_MODELS[p])
    setProvider(p)
  }

  const onKey = (value: string) => {
    setKey(value)
    const guess = detectProvider(value)
    if (guess && guess !== provider) pickProvider(guess)
  }

  const saveAi = async () => {
    const next = await window.tessera.setAi({ provider, model, baseUrl, key: key.trim() ? key : undefined })
    setKey('')
    onChange(next)
    setStatus(next.ai?.hasKey ? 'Saved. New saves will be analysed automatically.' : 'Saved.')
  }

  const removeKey = async () => {
    onChange(await window.tessera.setAi({ provider, model, baseUrl, key: '' }))
    setStatus('Key removed.')
  }

  const analyseAll = async () => {
    const n = await window.tessera.analyseAll()
    setStatus(n ? `Analysing ${n} ${n === 1 ? 'item' : 'items'}…` : 'Everything is already analysed.')
  }

  const hasKey = !!settings?.ai?.hasKey

  return (
    <dialog
      ref={ref}
      onClose={() => setStatus('')}
      className="m-auto w-[480px] rounded-lg bg-card p-8 text-fg shadow-lift backdrop:bg-ink/70 backdrop:backdrop-blur-sm"
    >
      <h2 className="font-serif text-[32px] italic leading-none">Settings</h2>

      <section className="mt-7">
        <h3 className={LABEL}>AI</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-dim">
          Gives everything you save a title, a summary and search tags. Works with any provider's API key;
          each item is sent to the provider you choose.
        </p>

        <input
          type="password"
          value={key}
          onChange={(e) => onKey(e.target.value)}
          placeholder={hasKey ? 'Key saved. Paste a new one to replace it' : 'Paste an API key'}
          aria-label="API key"
          spellCheck={false}
          autoComplete="off"
          className={`${FIELD} mt-3 w-full font-mono`}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select
            value={provider}
            onChange={(e) => pickProvider(e.target.value as AiProvider)}
            aria-label="Provider"
            className={FIELD}
          >
            {(Object.keys(AI_PROVIDERS) as AiProvider[]).map((p) => (
              <option key={p} value={p}>
                {AI_PROVIDERS[p]}
              </option>
            ))}
          </select>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Model"
            aria-label="Model"
            spellCheck={false}
            className={`${FIELD} font-mono`}
          />
        </div>
        {provider === 'custom' && (
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="Base URL, e.g. http://localhost:11434/v1"
            aria-label="Base URL"
            spellCheck={false}
            className={`${FIELD} mt-2 w-full font-mono`}
          />
        )}

        <div className="mt-3 flex items-center gap-2">
          <button onClick={saveAi} className="rounded-md bg-fg px-4 py-2 text-[13px] text-card transition-opacity hover:opacity-85">
            Save
          </button>
          {hasKey && (
            <>
              <button onClick={analyseAll} className={GHOST}>
                Analyse library{unanalysed ? ` (${unanalysed})` : ''}
              </button>
              <button onClick={removeKey} className={`${GHOST} ml-auto`}>
                Remove key
              </button>
            </>
          )}
        </div>
        {status && <p className="mt-2 text-[12px] text-dim">{status}</p>}
      </section>

      <section className="mt-7">
        <h3 className={LABEL}>Same vibe</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-dim">
          Finds images that look alike with a small model that runs on this computer, downloaded once
          (about 90 MB). Free, and nothing is sent anywhere.
        </p>
        <p className="mt-2 text-[13px] text-fg/80">
          {!vision
            ? 'Checking…'
            : vision.state === 'failed'
              ? `Couldn't load the model: ${vision.error ?? 'unknown error'}. It will retry next time Tessera starts.`
              : vision.done >= vision.total
                ? `All ${vision.total} images indexed.`
                : vision.state === 'loading' && vision.done === 0
                  ? 'Downloading the model…'
                  : `Indexing images: ${vision.done} of ${vision.total}`}
        </p>
      </section>

      <section className="mt-7">
        <h3 className={LABEL}>Browser extension key</h3>
        <p className="mt-1 text-[13px] text-dim">Paste this into the Tessera extension's options.</p>
        <div className="mt-3 flex items-center gap-2">
          <code className={`${BOX} truncate font-mono text-[12px]`}>{settings?.token}</code>
          <button onClick={copy} className={GHOST}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </section>

      <div className="mt-8 flex justify-end">
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
