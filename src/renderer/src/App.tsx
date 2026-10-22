import { useEffect, useMemo, useRef, useState } from 'react'
import type { Settings, Stack } from '@shared/api'
import Detail from './Detail'
import { ActiveFilter, buildFilters, FilterRow, STACK_COLORS, TermChip, type Filter, type TagIndex } from './Filters'
import Grid from './Grid'
import Sidebar from './Sidebar'
import { loadDensity, loadTheme, NEXT_DENSITY, saveDensity, saveTheme } from './prefs'
import SelectionBar from './Selection'
import Stacks from './Stacks'
import SettingsDialog from './Settings'
import TagsDialog from './Tags'
import Trash from './Trash'
import WindowControls from './WindowControls'
import { useItems } from './useItems'

type View = 'everything' | 'stacks' | 'trash' // trash is reached from the sidebar, not a tab

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
  const [theme, setTheme] = useState(loadTheme)
  const [density, setDensity] = useState(loadDensity)

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    saveTheme(next)
    setTheme(next)
  }
  const cycleDensity = () => {
    const next = NEXT_DENSITY[density]
    saveDensity(next)
    setDensity(next)
  }
  const searchRef = useRef<HTMLInputElement>(null)
  const pillRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const settingsRef = useRef<HTMLDialogElement>(null)
  const tagsRef = useRef<HTMLDialogElement>(null)

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

  // Natural-language search: the whole phrase (chips + typing) goes to CLIP after a short
  // pause, and images that match the description join the keyword results.
  const phrase = [...terms, query].map((t) => t.trim()).filter(Boolean).join(' ')
  const [visual, setVisual] = useState<{ phrase: string; scores: Map<number, number> } | null>(null)
  useEffect(() => {
    if (phrase.length < 3 || vibe) return setVisual(null)
    let live = true
    const timer = setTimeout(
      () =>
        window.tessera.searchSemantic(phrase).then((hits) => {
          if (live) setVisual({ phrase, scores: new Map(hits.map((h) => [h.id, h.score])) })
        }),
      250
    )
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [phrase, vibe])
  // results for an older phrase would flash wrong matches while the new ones load
  const scores = visual?.phrase === phrase ? visual.scores : null

  const visible = useMemo(() => {
    const words = [...terms, query].map((t) => t.trim().toLowerCase()).filter(Boolean)
    const hit = new Set<number>() // matched the words, not only the description
    const matches = items.filter((i) => {
      const tags = tagIndex.get(i.id)
      if (active && !active.test(i, tags)) return false
      const fields = [i.title, i.body, i.note, i.tldr, i.visible_text, i.file_path, ...(tags ?? [])]
      if (words.every((w) => fields.some((s) => s?.toLowerCase().includes(w)))) {
        hit.add(i.id)
        return true
      }
      return !!scores?.has(i.id)
    })
    if (vibe) {
      const rank = new Map(vibe.map((id, n) => [id, n]))
      return matches.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
    }
    if (!scores?.size) return matches
    // word matches first, then by how well the image fits the description; newest breaks ties
    return matches.sort(
      (a, b) =>
        Number(hit.has(b.id)) - Number(hit.has(a.id)) ||
        (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) ||
        b.created_at - a.created_at
    )
  }, [items, tagIndex, active, terms, query, vibe, scores])

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

  // Deleting moves to the trash; the toast offers an undo for a few seconds.
  const [undo, setUndo] = useState<{ ids: number[]; label: string } | null>(null)
  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(null), 9000)
    return () => clearTimeout(timer)
  }, [undo])

  const remove = async (id: number) => {
    const title = items.find((i) => i.id === id)?.title
    await window.tessera.remove(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    setSelected(null)
    setOpen(false)
    setUndo({ ids: [id], label: title ? `“${title.length > 40 ? title.slice(0, 40) + '…' : title}” is` : 'This item is' })
  }

  /* multi-select: Ctrl-click toggles, Shift-click selects a run of the visible order */

  const [picked, setPicked] = useState<Set<number>>(new Set())
  const anchor = useRef<number | null>(null)

  const pick = (id: number, range: boolean) => {
    setPicked((prev) => {
      const next = new Set(prev)
      const ids = visible.map((i) => i.id)
      const from = anchor.current == null ? -1 : ids.indexOf(anchor.current)
      if (range && from >= 0) {
        const to = ids.indexOf(id)
        for (const x of ids.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(x)
      } else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    anchor.current = id
  }
  const clearPicked = () => setPicked(new Set())
  const pickedIds = [...picked].filter((id) => items.some((i) => i.id === id))

  const removeMany = async (ids: number[]) => {
    for (const id of ids) await window.tessera.remove(id)
    const gone = new Set(ids)
    setItems((prev) => prev.filter((i) => !gone.has(i.id)))
    clearPicked()
    setUndo({ ids, label: ids.length === 1 ? 'This item is' : `${ids.length} items are` })
  }

  const addManyToStack = async (stackId: number, ids = pickedIds) => {
    for (const id of ids) await window.tessera.setInStack(stackId, id, true)
    refreshStacks()
  }

  // the search chips become a stack named after them, holding what the search shows;
  // saving again adds any new matches to that same stack
  const searchName = terms.join(' ').slice(0, 50)
  const [savedSearch, setSavedSearch] = useState<string | null>(null)
  const saveSearchAsStack = async () => {
    const existing = stacks.find((s) => s.name.toLowerCase() === searchName.toLowerCase())
    const id = existing?.id ?? (await window.tessera.createStack(searchName, STACK_COLORS[stacks.length % STACK_COLORS.length]))
    await addManyToStack(id, visible.map((i) => i.id))
    setSavedSearch(searchName)
  }

  const newStackWithPicked = async (name: string) => {
    const id = await window.tessera.createStack(name, STACK_COLORS[stacks.length % STACK_COLORS.length])
    await addManyToStack(id)
  }

  const tagMany = async (tags: string[]) => {
    for (const id of pickedIds) await window.tessera.addTags(id, tags)
  }

  const undoRemove = async () => {
    if (!undo) return
    await window.tessera.restore(undo.ids)
    setItems(await window.tessera.list()) // back in their place, not at the top
    setUndo(null)
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
        else if (picked.size) clearPicked()
        else setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, open, query, scrolled, picked])

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
        {window.tessera.platform !== 'darwin' && <WindowControls />}
      </div>

      <Sidebar
        theme={theme}
        onTheme={toggleTheme}
        density={density}
        onDensity={cycleDensity}
        onSettings={() => settingsRef.current?.showModal()}
        onTrash={() => setView((v) => (v === 'trash' ? 'everything' : 'trash'))}
        inTrash={view === 'trash'}
      />

      {/* header and content scroll together; past the header, the floating search takes over */}
      <main
        ref={scrollRef}
        onScroll={(e) =>
          setScrolled(e.currentTarget.scrollTop > (headerRef.current?.offsetHeight ?? 0) - 40)
        }
        // the overlay sits outside, but Chromium still sends its wheel here; freeze it while open.
        // The stable gutter keeps the grid from shifting when the scrollbar goes away.
        className={`relative min-w-0 flex-1 overflow-x-hidden [scrollbar-gutter:stable] ${
          open ? 'overflow-y-hidden' : 'overflow-y-auto'
        }`}
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

          {view !== 'trash' && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line pb-4">
              {active && <ActiveFilter filter={active} onRemove={clearFilter} />}
              {terms.map((t) => (
                <TermChip key={t} term={t} onRemove={() => setTerms((all) => all.filter((x) => x !== t))} />
              ))}
              {searchField('big', 'min-w-64 text-[60px] leading-tight')}
              {terms.length > 0 && visible.length > 0 && (
                <button
                  onClick={saveSearchAsStack}
                  title={`Put the ${visible.length} results in a stack called “${searchName}”`}
                  className="flex shrink-0 items-center gap-2.5 rounded-full bg-card px-5 py-2.5 text-[13px] tracking-wider text-dim uppercase shadow-card transition hover:text-fg hover:shadow-lift"
                >
                  <span className={`size-3.5 rounded-full border-2 border-accent ${savedSearch === searchName ? 'bg-accent' : ''}`} />
                  {savedSearch === searchName ? 'Saved to stack' : 'Save as stack'}
                </button>
              )}
              <kbd className="shrink-0 rounded-sm bg-fg/[0.06] px-2.5 py-1 font-sans text-[13px] text-dim">
                Ctrl K
              </kbd>
            </div>
          )}

          {focused === 'big' && !active && <FilterRow filters={kindFilters} onPick={pickFilter} />}
        </header>

        {view === 'trash' ? (
          <Trash onExit={() => setView('everything')} onRestored={async () => setItems(await window.tessera.list())} />
        ) : view === 'stacks' ? (
          <Stacks items={items} stacks={stacks} onOpen={pickFilter} onChange={refreshStacks} />
        ) : visible.length ? (
          <Grid
            scrollRef={scrollRef}
            items={visible}
            selected={selected}
            onSelect={setSelected}
            onOpen={openItem}
            density={density}
            picked={picked}
            onPick={pick}
            onDelete={remove}
          />
        ) : (
          <div className="grid place-items-center py-32 pr-20">
            <div className="max-w-md text-center">
              <p className="font-serif text-[32px] italic text-dim">
                {!items.length ? 'Nothing here yet.' : phrase.length >= 3 && !scores && !vibe ? 'Looking…' : 'Nothing matches that.'}
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
        inert={!scrolled || view === 'trash'}
        className={`fixed top-10 right-3 left-20 z-30 pr-17 pl-1 transition duration-200 ease-out ${
          scrolled && view !== 'trash' ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0'
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
            <kbd className="shrink-0 rounded-full bg-fg/[0.06] px-3 py-1 font-sans text-[12px] text-dim">
              Ctrl K
            </kbd>
          </div>
          {focused === 'pill' && !active && <FilterRow filters={kindFilters} onPick={pickFilter} />}
        </div>
      </div>

      <button
        onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
        title="Back to top"
        inert={!scrolled || view === 'trash'}
        className={`fixed right-8 bottom-8 z-30 grid size-11 place-items-center rounded-full bg-card text-dim shadow-lift transition duration-200 ease-out hover:text-fg ${
          scrolled && view !== 'trash' ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 19V5M6 11l6-6 6 6" />
        </svg>
      </button>

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

      {undo && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex w-[620px] max-w-[calc(100vw-3rem)] -translate-x-1/2 items-center gap-6 rounded-lg bg-accent py-5 pr-12 pl-7 text-white shadow-lift transition duration-200 starting:translate-y-3 starting:opacity-0"
        >
          <p className="shrink-0 font-serif text-[30px] leading-[1.05]">
            Gone,
            <br />
            not forgotten.
          </p>
          <div className="self-stretch border-l border-white/35" />
          <div className="min-w-0 text-[14px] leading-relaxed">
            <p className="truncate">{undo.label} in the trash.</p>
            <p>
              <button onClick={undoRemove} className="font-semibold underline underline-offset-2">
                Undo
              </button>
              , or restore it from the{' '}
              <button
                onClick={() => {
                  setUndo(null)
                  setView('trash')
                }}
                className="font-semibold underline underline-offset-2"
              >
                Trash
              </button>{' '}
              any time.
            </p>
            <p className="text-white/80">The trash empties itself after 30 days.</p>
          </div>
          <button
            onClick={() => setUndo(null)}
            aria-label="Dismiss"
            className="absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full transition-colors hover:bg-white/15"
          >
            <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M3 3l6 6M9 3 3 9" />
            </svg>
          </button>
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 bg-ink/80 p-6 backdrop-blur-sm">
          <div className="grid h-full place-items-center rounded-xl border-2 border-dashed border-accent/60">
            <p className="font-serif text-[48px] italic text-fg">Drop to save</p>
          </div>
        </div>
      )}

      {pickedIds.length > 0 && !open && (
        <SelectionBar
          count={pickedIds.length}
          stacks={stacks}
          onAddToStack={addManyToStack}
          onNewStack={newStackWithPicked}
          onAddTags={tagMany}
          onDelete={() => removeMany(pickedIds)}
          onClear={clearPicked}
        />
      )}

      <TagsDialog ref={tagsRef} onChange={refreshStacks} />

      <SettingsDialog
        ref={settingsRef}
        onManageTags={() => tagsRef.current?.showModal()}
        settings={settings}
        unanalysed={items.filter((i) => i.status === 'pending' || i.status === 'failed').length}
        onChange={setSettings}
      />
    </div>
  )
}
