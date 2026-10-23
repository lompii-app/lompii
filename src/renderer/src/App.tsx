import { useEffect, useMemo, useRef, useState } from 'react'
import type { Settings, Stack } from '@shared/api'
import Detail from './Detail'
import { ArchivePrompt, PairPrompt, PlanPrompt, WelcomeNote } from './Dialogs'
import { ActiveFilter, buildFilters, FilterRow, STACK_COLORS, TermChip, type Filter, type TagIndex } from './Filters'
import Grid from './Grid'
import Sidebar from './Sidebar'
import { loadDensity, loadStarAsk, loadTheme, loadWelcomed, NEXT_DENSITY, saveDensity, saveStarAsk, saveTheme, saveWelcomed } from './prefs'
import SelectionBar from './Selection'
import Stacks from './Stacks'
import SettingsDialog, { type Section } from './Settings'
import { pendingSteps, SetupCards, SetupStrip, StarToast, starDue } from './Setup'
import TagsDialog from './Tags'
import Trash from './Trash'
import WindowControls from './WindowControls'
import { useItems } from './useItems'

type View = 'everything' | 'stacks' | 'archive' | 'trash' // archive and trash are reached from the sidebar

const TABS: [View, string][] = [['everything', 'Everything'], ['stacks', 'Stacks']]

export default function App() {
  const [all, setAll] = useItems()
  const [view, setView] = useState<View>('everything')
  // the archive lives apart: Everything, Stacks and the filters never see it, and in the archive
  // the search, filters and grid work on it alone (most recently archived first)
  const items = useMemo(() => all.filter((i) => !i.archived_at), [all])
  const archived = useMemo(
    () => all.filter((i) => i.archived_at).sort((a, b) => b.archived_at! - a.archived_at!),
    [all]
  )
  const source = view === 'archive' ? archived : items
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
  // the first start: the founder's note, then the plan screen asking for a GitHub star (and,
  // after a "later", the toast in Setup.tsx)
  const [welcomed, setWelcomed] = useState(loadWelcomed)
  const [starAsk, setStarAsk] = useState(loadStarAsk)
  const answerStar = (value: string) => {
    saveStarAsk(value)
    setStarAsk(value)
  }

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
  const [settingsSection, setSettingsSection] = useState<Section>('General')
  const openSettings = (section?: Section) => {
    if (section) setSettingsSection(section)
    settingsRef.current?.showModal()
  }
  const [setupLater, setSetupLater] = useState(false) // "Later" on the strip: hidden until next launch
  const tagsRef = useRef<HTMLDialogElement>(null)

  // item:added / item:updated replace `items`, which is also when tags can have changed;
  // stacksVersion covers stack edits, which touch no item
  useEffect(() => {
    let live = true
    Promise.all([window.lompii.tagIndex(), window.lompii.stacks()]).then(([rows, list]) => {
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
    window.lompii.getSettings().then(setSettings)
  }, [])
  // what's left to set up; a save from the browser proves it's connected, so check again then
  const steps = pendingSteps(settings)
  useEffect(() => {
    if (settings && !settings.extensionConnected) window.lompii.getSettings().then(setSettings)
  }, [items.length]) // only when the count changes, not on every settings update
  // saves still without a title and tags (never analysed, or it failed), and those in progress
  // (archived ones included: "Analyse all" gets to them too)
  const unanalysed = all.filter((i) => i.status === 'pending' || i.status === 'failed').length
  const analysing = all.filter((i) => i.status === 'analysing').length

  const refreshStacks = () => setStacksVersion((v) => v + 1)
  const filters = useMemo(() => buildFilters(source, tagIndex, stacks), [source, tagIndex, stacks])
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
        window.lompii.searchSemantic(phrase).then((hits) => {
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
    const matches = source.filter((i) => {
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
  }, [source, tagIndex, active, terms, query, vibe, scores])

  // searching and filtering happen in Everything, or in the archive when that's open
  const toSearch = () => setView((v) => (v === 'archive' ? v : 'everything'))

  /* the archive's lock: asked for each time it's opened */

  const [asking, setAsking] = useState(false) // the password prompt is up
  const openArchive = () => {
    setVibe(null) // same-vibe results are never archived ones
    if (settings?.archiveLocked) setAsking(true)
    else setView('archive')
  }
  const unlockArchive = async (pin: string) => {
    const result = await window.lompii.unlockArchive(pin)
    if (result !== 'ok') return result
    setAll(await window.lompii.list()) // now with the archived items
    setAsking(false)
    setView('archive')
    return result
  }
  // Closing the prompt hands focus back to the logo, which would keep its ring and "Press Here"
  // label up; the dialog closes in its own effect, which runs before this one.
  useEffect(() => {
    if (!asking) (document.activeElement as HTMLElement | null)?.blur()
  }, [asking])
  // Leaving a locked archive locks it again, and its items leave the window. Ones archived since
  // stay until then, so their undo still works.
  const inArchive = useRef(false)
  useEffect(() => {
    if (view === 'archive') inArchive.current = true
    else if (inArchive.current) {
      inArchive.current = false
      if (!settings?.archiveLocked) return
      window.lompii.lockArchive()
      setAll((prev) => prev.filter((i) => !i.archived_at))
    }
  }, [view])
  // and minimising or hiding to the tray leaves it
  useEffect(() => {
    if (!settings?.archiveLocked) return
    const onHide = () => document.hidden && setView((v) => (v === 'archive' ? 'everything' : v))
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [settings?.archiveLocked])
  // a password set, changed or removed in Settings: the list is fetched again under the new rule
  const changeSettings = async (next: Settings) => {
    const relock = next.archiveLocked !== settings?.archiveLocked
    setSettings(next)
    if (!relock) return
    if (next.archiveLocked) setView((v) => (v === 'archive' ? 'everything' : v))
    setAll(await window.lompii.list())
  }
  const pickFilter = (key: string | null) => {
    setFilterKey(key)
    setVibe(null)
    toSearch()
  }
  const clearFilter = () => pickFilter(null)

  const sameVibe = async (id: number) => {
    const ids = await window.lompii.similar(id)
    setOpen(false)
    setQuery('')
    setTerms([])
    setFilterKey(null)
    setVibe(ids)
    setView('everything')
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const current = all.find((i) => i.id === selected) ?? null

  const openItem = (id: number) => {
    setSelected(id)
    setOpen(true)
  }

  // Deleting moves to the trash, archiving to the archive; the toast offers an undo for a few seconds.
  const [undo, setUndo] = useState<{ ids: number[]; label: string; archived?: boolean } | null>(null)
  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(null), 9000)
    return () => clearTimeout(timer)
  }, [undo])

  const labelFor = (ids: number[]) => {
    if (ids.length > 1) return `${ids.length} items are`
    const title = all.find((i) => i.id === ids[0])?.title
    return title ? `“${title.length > 40 ? title.slice(0, 40) + '…' : title}” is` : 'This item is'
  }

  const remove = async (id: number) => {
    const label = labelFor([id])
    await window.lompii.remove(id)
    setAll((prev) => prev.filter((i) => i.id !== id))
    setSelected(null)
    setOpen(false)
    setUndo({ ids: [id], label })
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
  const pickedIds = [...picked].filter((id) => source.some((i) => i.id === id))

  const removeMany = async (ids: number[]) => {
    const label = labelFor(ids)
    for (const id of ids) await window.lompii.remove(id)
    const gone = new Set(ids)
    setAll((prev) => prev.filter((i) => !gone.has(i.id)))
    clearPicked()
    setUndo({ ids, label })
  }

  // into the archive (on) or back out; ids already where they're going are skipped
  const archive = async (ids: number[], on: boolean) => {
    const moving = new Set(ids.filter((id) => all.some((i) => i.id === id && !!i.archived_at !== on)))
    if (!moving.size) return
    const label = labelFor([...moving])
    await window.lompii.archive([...moving], on)
    const at = on ? Date.now() : null
    setAll((prev) => prev.map((i) => (moving.has(i.id) ? { ...i, archived_at: at } : i)))
    clearPicked()
    if (selected != null && moving.has(selected)) {
      setSelected(null)
      setOpen(false)
    }
    setUndo(on ? { ids: [...moving], label, archived: true } : null)
  }
  // the A key, the selection bar and a drop on the logo: in Everything they archive, in the archive they unarchive
  const toggleArchive = (ids: number[]) => archive(ids, view !== 'archive')

  const addManyToStack = async (stackId: number, ids = pickedIds) => {
    for (const id of ids) await window.lompii.setInStack(stackId, id, true)
    refreshStacks()
  }

  // the search chips become a stack named after them, holding what the search shows;
  // saving again adds any new matches to that same stack
  const searchName = terms.join(' ').slice(0, 50)
  const [savedSearch, setSavedSearch] = useState<string | null>(null)
  const saveSearchAsStack = async () => {
    const existing = stacks.find((s) => s.name.toLowerCase() === searchName.toLowerCase())
    const id = existing?.id ?? (await window.lompii.createStack(searchName, STACK_COLORS[stacks.length % STACK_COLORS.length]))
    await addManyToStack(id, visible.map((i) => i.id))
    setSavedSearch(searchName)
  }

  const newStackWithPicked = async (name: string) => {
    const id = await window.lompii.createStack(name, STACK_COLORS[stacks.length % STACK_COLORS.length])
    await addManyToStack(id)
  }

  const tagMany = async (tags: string[]) => {
    for (const id of pickedIds) await window.lompii.addTags(id, tags)
  }

  const undoRemove = async () => {
    if (!undo) return
    if (undo.archived) await archive(undo.ids, false)
    else {
      await window.lompii.restore(undo.ids)
      setAll(await window.lompii.list()) // back in their place, not at the top
    }
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
      const paths = [...(e.dataTransfer?.files ?? [])].map((f) => window.lompii.pathForFile(f))
      if (paths.length) window.lompii.ingestPaths(paths.filter(Boolean))
    }
    const onPaste = (e: ClipboardEvent) => {
      for (const f of e.clipboardData?.files ?? []) {
        if (f.type.startsWith('image/')) f.arrayBuffer().then((b) => window.lompii.ingestBuffer(b))
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

  /* Cmd/Ctrl+K, Enter, Esc, A */
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
      } else if (e.key.toLowerCase() === 'a' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (view === 'everything' || view === 'archive')
          toggleArchive(pickedIds.length ? pickedIds : selected != null ? [selected] : [])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, open, query, scrolled, picked, view, all])

  // both search fields edit the same query and filter
  const searchField = (which: 'big' | 'pill', className: string) => (
    <input
      ref={which === 'big' ? searchRef : pillRef}
      value={query}
      onChange={(e) => {
        setQuery(e.target.value)
        toSearch()
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
        terms.length
          ? 'Add another…'
          : active
            ? `Search ${active.label.toLowerCase()}…`
            : view === 'archive'
              ? 'Search the archive…'
              : 'Describe what you remember…'
      }
      spellCheck={false}
      className={`min-w-0 flex-1 bg-transparent font-serif italic tracking-tight placeholder:text-faint focus:outline-none ${className}`}
    />
  )


  return (
    <div className="flex h-full pt-10">
      {/* stands in for the hidden title bar; z-50 keeps the controls above the detail overlay */}
      <div className="fixed inset-x-0 top-0 z-50 flex h-10 items-center justify-end pr-4 [-webkit-app-region:drag]">
        {window.lompii.platform !== 'darwin' && <WindowControls />}
      </div>

      <Sidebar
        theme={theme}
        onTheme={toggleTheme}
        density={density}
        onDensity={cycleDensity}
        onSettings={() => openSettings()}
        onTrash={() => setView((v) => (v === 'trash' ? 'everything' : 'trash'))}
        inTrash={view === 'trash'}
        onArchive={() => (view === 'archive' ? setView('everything') : openArchive())}
        inArchive={view === 'archive'}
        onDropItems={toggleArchive}
        pill={scrolled && view !== 'trash'}
      />

      {/* header and content scroll together; past the header, the floating search takes over */}
      <main
        ref={scrollRef}
        onScroll={(e) =>
          setScrolled(e.currentTarget.scrollTop > (headerRef.current?.offsetHeight ?? 0) - 40)
        }
        // No visible scrollbar (wheel, keys and the back-to-top button do the scrolling). The overlay
        // sits outside, but Chromium still sends its wheel here, so it's frozen while open.
        className={`relative min-w-0 flex-1 overflow-x-hidden [scrollbar-width:none] ${
          open ? 'overflow-y-hidden' : 'overflow-y-auto'
        }`}
      >
        <header ref={headerRef} className="pr-20 pl-1">
          <div className="flex justify-end gap-9">
            {/* the archive has no tab of its own; it shows as one while open */}
            {[...TABS, ...(view === 'archive' ? [['archive', 'Archive'] as [View, string]] : [])].map(([v, label]) => (
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
                {v === 'archive' && archived.length > 0 && (
                  <span className="ml-1.5 text-[12px] text-dim">{archived.length}</span>
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
              {/* not in the archive: stacks leave archived items out */}
              {terms.length > 0 && visible.length > 0 && view !== 'archive' && (
                <button
                  onClick={saveSearchAsStack}
                  title={`Put the ${visible.length} results in a stack called “${searchName}”`}
                  className="flex shrink-0 items-center gap-2.5 rounded-full bg-card px-5 py-2.5 text-[13px] tracking-wider text-dim uppercase shadow-card transition hover:text-fg hover:shadow-lift"
                >
                  <span className={`size-3.5 rounded-full border-2 border-accent ${savedSearch === searchName ? 'bg-accent' : ''}`} />
                  {savedSearch === searchName ? 'Saved to stack' : 'Save as stack'}
                </button>
              )}
              {settings?.ai.active && (unanalysed > 0 || analysing > 0) && (
                <button
                  onClick={() => window.lompii.analyseAll()}
                  disabled={!unanalysed}
                  title="Give every save without a title and tags its AI analysis"
                  className="flex shrink-0 items-center gap-2.5 rounded-full bg-card px-5 py-2.5 text-[13px] tracking-wider text-dim uppercase shadow-card transition enabled:hover:text-fg enabled:hover:shadow-lift"
                >
                  <span className={`size-3.5 rounded-full border-2 border-accent ${unanalysed ? '' : 'animate-pulse bg-accent'}`} />
                  {unanalysed ? `Analyse ${unanalysed} ${unanalysed === 1 ? 'save' : 'saves'}` : `Analysing ${analysing}…`}
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
          <Trash onExit={() => setView('everything')} onRestored={async () => setAll(await window.lompii.list())} />
        ) : view === 'stacks' ? (
          <Stacks items={items} stacks={stacks} onOpen={pickFilter} onChange={refreshStacks} />
        ) : visible.length ? (
          <>
            {view === 'everything' && !setupLater && steps.length > 0 && (
              <SetupStrip steps={steps} onOpen={openSettings} onLater={() => setSetupLater(true)} />
            )}
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
          </>
        ) : view === 'archive' && !archived.length ? (
          <div className="grid place-items-center py-32 pr-20">
            <div className="max-w-md text-center">
              <p className="font-serif text-[32px] italic text-dim">Nothing archived yet.</p>
              <p className="mt-3 text-[14px] leading-relaxed text-fg/80">
                Drag a card onto the logo, or select some and press A. Archived things stay out of Everything and
                Stacks, and only this search finds them.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid place-items-center py-32 pr-20">
            <div className={`text-center ${items.length ? 'max-w-md' : 'max-w-xl'}`}>
              <p className="font-serif text-[32px] italic text-dim">
                {!items.length ? 'Nothing here yet.' : phrase.length >= 3 && !scores && !vibe ? 'Looking…' : 'Nothing matches that.'}
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-fg/80">
                {items.length
                  ? 'Try another word, or clear the search and filter.'
                  : steps.length
                    ? 'Two steps and it starts filling itself. You can also drop or paste an image here any time.'
                    : 'In Chrome, right-click an image or selected text and choose “Add to lompii”, or press Alt+Shift+S to capture part of a page. You can also drop or paste an image here.'}
              </p>
              {!items.length && steps.length > 0 && <SetupCards steps={steps} onOpen={openSettings} />}
            </div>
          </div>
        )}
      </main>

      {/* pr-20 lines the pill up with the content, which has the same right padding */}
      <div
        inert={!scrolled || view === 'trash'}
        className={`fixed top-10 right-0 left-20 z-30 pr-20 pl-1 transition duration-200 ease-out ${
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
          aiReady={!!settings?.ai.active}
          onSameVibe={sameVibe}
          onClose={() => setOpen(false)}
          onArchive={(id) => archive([id], !current.archived_at)}
          onDelete={remove}
        />
      )}

      {undo && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex w-[620px] max-w-[calc(100vw-3rem)] -translate-x-1/2 items-center gap-6 rounded-lg bg-accent py-5 pr-12 pl-7 text-white shadow-lift transition duration-200 starting:translate-y-3 starting:opacity-0"
        >
          <p className="shrink-0 font-serif text-[30px] leading-[1.05]">
            {undo.archived ? 'Out of sight,' : 'Gone,'}
            <br />
            {undo.archived ? 'still yours.' : 'not forgotten.'}
          </p>
          <div className="self-stretch border-l border-white/35" />
          <div className="min-w-0 text-[14px] leading-relaxed">
            <p className="truncate">
              {undo.label} in the {undo.archived ? 'archive' : 'trash'}.
            </p>
            <p>
              <button onClick={undoRemove} className="font-semibold underline underline-offset-2">
                Undo
              </button>
              , or find it in the{' '}
              <button
                onClick={() => {
                  setUndo(null)
                  if (undo.archived) openArchive()
                  else setView('trash')
                }}
                className="font-semibold underline underline-offset-2"
              >
                {undo.archived ? 'Archive' : 'Trash'}
              </button>{' '}
              any time.
            </p>
            <p className="text-white/80">
              {undo.archived ? 'Click the logo to open it; it has its own search.' : 'The trash empties itself after 30 days.'}
            </p>
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
          archived={view === 'archive'}
          onArchive={() => toggleArchive(pickedIds)}
          onDelete={() => removeMany(pickedIds)}
          onClear={clearPicked}
        />
      )}

      {/* out of the way of the overlay, the undo banner and the selection bar */}
      {view === 'everything' && !open && !undo && !pickedIds.length && starDue(starAsk, all.length) && (
        <StarToast answer={answerStar} />
      )}
      <WelcomeNote
        open={!welcomed}
        onDone={() => {
          saveWelcomed()
          setWelcomed(true)
        }}
      />
      <PlanPrompt open={welcomed && starAsk === null} onAnswer={answerStar} />

      <TagsDialog ref={tagsRef} onChange={refreshStacks} />

      <ArchivePrompt open={asking} onUnlock={unlockArchive} onCancel={() => setAsking(false)} />

      <PairPrompt onAnswered={() => window.lompii.getSettings().then(setSettings)} />

      <SettingsDialog
        ref={settingsRef}
        onManageTags={() => tagsRef.current?.showModal()}
        settings={settings}
        unanalysed={unanalysed}
        onChange={changeSettings}
        section={settingsSection}
        onSection={setSettingsSection}
      />
    </div>
  )
}
