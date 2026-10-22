import { useEffect, useRef, useState } from 'react'
import {
  AI_PROVIDERS,
  KEY_PAGES,
  KEYLESS,
  type AiProvider,
  type EmbeddingStatus,
  type ModelInfo,
  type Settings
} from '@shared/api'

type ProviderInfo = Settings['ai']['providers'][AiProvider]

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg/80'
const DESC = 'text-[12px] leading-relaxed text-dim'
const INPUT =
  'min-w-0 rounded-lg border border-line bg-control px-3 py-2 font-mono text-[13px] placeholder:text-faint focus:outline-2 focus:-outline-offset-1 focus:outline-accent'
const BUTTON =
  'shrink-0 rounded-lg border border-line bg-control px-3.5 py-2 text-[13px] font-medium transition-colors outline-none hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40'

const SECTIONS = ['General', 'AI', 'Extension'] as const
type Section = (typeof SECTIONS)[number]

const CLOUD: AiProvider[] = ['anthropic', 'openai', 'gemini']
const LOCAL: AiProvider[] = ['ollama', 'custom', 'openrouter']

const ABOUT: Record<AiProvider, string> = {
  anthropic: 'Claude models. Every one of them reads images.',
  openai: 'GPT models from OpenAI.',
  gemini: "Google's Gemini models, which read images too.",
  openrouter: 'One key for hundreds of models from many providers.',
  ollama: 'Open models running on this computer. Nothing you save leaves it.',
  custom: 'Any server that speaks the OpenAI API, such as LM Studio, LiteLLM or vLLM.'
}

const PLACEHOLDER: Partial<Record<AiProvider, string>> = {
  anthropic: 'sk-ant-…',
  openai: 'sk-…',
  gemini: 'AIza…',
  openrouter: 'sk-or-…'
}

// set up enough to answer: a model, plus a key, unless it runs locally
const ready = (p: AiProvider, info: ProviderInfo | undefined): boolean =>
  !!info?.model && (KEYLESS.has(p) ? p !== 'custom' || !!info.baseUrl : info.hasKey)

/* ---------- small pieces ---------- */

const Icon = ({ d, className = 'size-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
    <path d={d} />
  </svg>
)

const I = {
  key: 'M15 7a3 3 0 1 1-3 3M2 21l7.5-7.5M7 16l2 2M10.5 13.5a5 5 0 1 0 0-.01',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  chevron: 'M6 9l6 6 6-6',
  cloud: 'M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
  image: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  puzzle: 'M9 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H5v-4h2a2 2 0 1 0 0-4H5V6h4z',
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4'
}

const Switch = ({ label, on, disabled, onToggle }: { label: string; on: boolean; disabled?: boolean; onToggle: (on: boolean) => void }) => (
  <button
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onToggle(!on)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-35 ${
      on ? 'bg-accent' : 'bg-fg/75'
    }`}
  >
    <span className={`absolute top-1 left-1 size-4 rounded-full bg-raised shadow-sm transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
)

const Header = ({ title, desc }: { title: string; desc: string }) => (
  <div className="mb-4">
    <h3 className="text-[19px] font-semibold">{title}</h3>
    <p className="mt-1 text-[13px] text-dim">{desc}</p>
  </div>
)

const Panel = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-line bg-well p-5 ${className}`}>{children}</div>
)

// what it is on the start side, its control on the end side
const Row = ({ label, desc, children }: { label: string; desc?: React.ReactNode; children?: React.ReactNode }) => (
  <div className="flex items-center gap-6 py-3.5 first:pt-0 last:pb-0">
    <div className="min-w-0 flex-1">
      <div className={LABEL}>{label}</div>
      {desc && <div className={`${DESC} mt-0.5 break-words`}>{desc}</div>}
    </div>
    {children}
  </div>
)

const GLYPH: Partial<Record<AiProvider, [string, string]>> = {
  anthropic: ['A', '#d97757'],
  openai: ['O', 'currentColor'],
  gemini: ['G', '#4f8df7'],
  openrouter: ['R', '#7c7ff2']
}

const Glyph = ({ p }: { p: AiProvider }) => (
  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-control text-[14px] font-semibold">
    {GLYPH[p] ? <span style={{ color: GLYPH[p]![1] }}>{GLYPH[p]![0]}</span> : <Icon d={p === 'ollama' ? I.chip : I.server} />}
  </span>
)

/* ---------- active model: a styled popover in place of a native select ---------- */

function ActiveModel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const menu = useRef<HTMLDivElement>(null)
  const { active, providers } = settings.ai
  const options = (Object.keys(AI_PROVIDERS) as AiProvider[]).filter((p) => ready(p, providers[p]))
  const pick = async (p: AiProvider | null) => {
    menu.current?.hidePopover()
    onChange(await window.tessera.setActiveProvider(p))
  }
  const item = (p: AiProvider | null) => (
    <button
      key={p ?? 'off'}
      onClick={() => pick(p)}
      className={`flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-well ${p === active ? 'bg-select' : ''}`}
    >
      <span className="font-mono text-[13px]">{p ? providers[p]!.model : 'Off'}</span>
      <span className="text-[11px] text-dim">{p ? AI_PROVIDERS[p] : 'Nothing is sent anywhere'}</span>
    </button>
  )
  return (
    <>
      <button
        popoverTarget="active-model"
        className={`${BUTTON} flex min-w-56 items-center gap-3 text-left [anchor-name:--active-model]`}
      >
        <span className="min-w-0 flex-1 truncate">{active ? providers[active]?.model : 'Off'}</span>
        <Icon d={I.chevron} className="size-4 text-dim" />
      </button>
      <div
        ref={menu}
        id="active-model"
        popover="auto"
        className="m-0 mt-1.5 min-w-64 rounded-lg border border-line bg-raised p-1 text-fg shadow-lift [position-anchor:--active-model] [position-area:bottom_span-left]"
      >
        {options.map(item)}
        {item(null)}
        {!options.length && <p className="px-3 py-2 text-[12px] text-dim">Save a key below to choose a model.</p>}
      </div>
    </>
  )
}

/* ---------- one provider ---------- */

function ProviderCard({
  p,
  info,
  active,
  onChange
}: {
  p: AiProvider
  info: ProviderInfo | undefined
  active: boolean
  onChange: (s: Settings) => void
}) {
  const keyed = !KEYLESS.has(p)
  const [key, setKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(info?.baseUrl ?? '')
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<ModelInfo[] | null>(null)
  const [listError, setListError] = useState('')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  // keys must be saved first; a local server needs its address; Ollama is just found
  const reachable = keyed ? !!info?.hasKey : p === 'ollama' || !!info?.baseUrl

  const load = async () => {
    setLoading(true)
    const r = await window.tessera.listModels(p)
    setModels(r.models ?? null)
    setListError(r.error ?? '')
    setLoading(false)
  }

  // Ollama is detected by asking it for its models
  useEffect(() => {
    if (p === 'ollama') load()
  }, [p])

  const save = async (patch: { key?: string; model?: string; baseUrl?: string }) => {
    onChange(await window.tessera.saveProvider(p, patch))
    setNote(null)
  }

  const saveKey = async () => {
    // an empty key box on the server card keeps the saved key
    await save(keyed ? { key } : { key: key.trim() ? key : undefined, baseUrl })
    setKey('')
    setModels(null)
    setNote({ ok: true, text: 'Saved.' })
  }

  const test = async () => {
    setTesting(true)
    const error = await window.tessera.testProvider(p)
    setTesting(false)
    setNote(error ? { ok: false, text: error } : { ok: true, text: `Connected. ${info?.model} answered.` })
  }

  const toggleModels = () => {
    setOpen(!open)
    if (!open && !models) load()
  }

  const shown = (models ?? []).filter((m) => `${m.name} ${m.id}`.toLowerCase().includes(filter.trim().toLowerCase()))
  const typed = filter.trim()
  const current = models?.find((m) => m.id === info?.model)
  const found = p === 'ollama' && !!models

  return (
    <Panel>
      <div className="flex items-start gap-3">
        <Glyph p={p} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">{AI_PROVIDERS[p]}</div>
          <div className={DESC}>{ABOUT[p]}</div>
        </div>
        {KEY_PAGES[p] && (
          <button
            onClick={() => window.tessera.openExternal(KEY_PAGES[p]!)}
            className="flex items-center gap-1.5 pt-1.5 text-[11px] font-semibold tracking-[0.08em] text-dim uppercase hover:text-fg"
          >
            Get key <Icon d={I.external} className="size-3.5" />
          </button>
        )}
        {p === 'ollama' && (
          <button onClick={load} aria-label="Look for Ollama again" className="rounded-md p-1.5 text-dim hover:bg-control hover:text-fg">
            <Icon d={I.refresh} className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
        <Switch label={`Use ${AI_PROVIDERS[p]}`} on={active} disabled={!ready(p, info)} onToggle={async (on) => onChange(await window.tessera.setActiveProvider(on ? p : null))} />
      </div>

      {keyed && (
        <div className="mt-4 flex gap-2">
          <div className="flex min-w-0 flex-1 overflow-hidden rounded-lg border border-line bg-control focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-accent">
            <span className="grid place-items-center pl-3 text-faint">
              <Icon d={I.key} />
            </span>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && key.trim() && saveKey()}
              placeholder={info?.hasKey ? '••••••••••••' : PLACEHOLDER[p]}
              aria-label={`${AI_PROVIDERS[p]} API key`}
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-[13px] placeholder:text-faint focus:outline-none"
            />
            <button onClick={saveKey} disabled={!key.trim()} className="border-l border-line px-5 text-[13px] font-medium hover:bg-raised disabled:text-faint">
              Save
            </button>
          </div>
          {info?.hasKey && (
            <button onClick={() => save({ key: '' })} aria-label="Remove key" className="rounded-lg px-2.5 text-dim hover:bg-control hover:text-fg">
              <Icon d={I.trash} />
            </button>
          )}
        </div>
      )}

      {p === 'custom' && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Base URL</span>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:1234/v1" spellCheck={false} className={INPUT} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Key (optional)</span>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={info?.hasKey ? '•••••••••••• saved' : 'Only if the server asks for one'}
                spellCheck={false}
                autoComplete="off"
                className={INPUT}
              />
            </label>
          </div>
          <div className="mt-3">
            <button onClick={saveKey} disabled={!baseUrl.trim() || (baseUrl.trim() === info?.baseUrl && !key.trim())} className={BUTTON}>
              Save
            </button>
          </div>
        </>
      )}

      {p === 'ollama' && (
        <div className="mt-4 flex flex-wrap items-center gap-2.5 text-[13px]">
          {loading && !models ? (
            <span className="text-dim">Looking for Ollama…</span>
          ) : found ? (
            <>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-emerald-500 uppercase">● Running</span>
              <span className="text-dim">
                {models!.length} {models!.length === 1 ? 'model' : 'models'} installed{models!.length ? '' : '. Pull one with `ollama pull gemma3`.'}
              </span>
            </>
          ) : (
            <>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-accent uppercase">● Not found</span>
              <span className="text-dim">Start Ollama (or run `ollama serve`), then look again.</span>
            </>
          )}
        </div>
      )}

      {reachable && (p !== 'ollama' || found) && (
        <div className="mt-3 flex gap-2">
          <button onClick={test} disabled={testing || !ready(p, info)} className={BUTTON}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button onClick={toggleModels} aria-expanded={open} className={`${BUTTON} flex min-w-0 flex-1 items-center gap-3 font-normal`}>
            <span className={LABEL}>Models</span>
            <span className="ml-auto min-w-0 truncate text-[13px] text-fg/80">
              {info?.model ? `${current?.name ?? info.model} · default` : 'Pick a model'}
            </span>
            {models && <span className="text-[12px] text-dim">All {models.length}</span>}
            <Icon d={I.chevron} className={`size-4 text-dim transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}

      {note && <p role="status" className={`mt-2 text-[12px] break-words ${note.ok ? 'text-emerald-500' : 'text-accent'}`}>{note.text}</p>}

      {open && (
        <div className="mt-3">
          <div className="flex gap-2">
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter models…" aria-label="Filter models" spellCheck={false} className={`${INPUT} flex-1`} />
            <button onClick={load} className={`${BUTTON} flex items-center gap-1.5`}>
              <Icon d={I.refresh} className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
          {listError && <p className="mt-2 text-[12px] break-words text-accent">{listError}</p>}
          <div className="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {loading && !models && <p className="px-3 py-3 text-[12px] text-dim">Loading models…</p>}
            {shown.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13px]">{m.name}</span>
                <span className="max-w-[45%] truncate font-mono text-[12px] text-dim">{m.id}</span>
                <span title={m.vision ? 'Reads images' : undefined} className={m.vision ? 'text-dim' : 'invisible'}>
                  <Icon d={I.image} className="size-3.5" />
                </span>
                {m.id === info?.model ? (
                  <span className="w-24 rounded-md bg-fg py-1 text-center text-[12px] font-medium text-card">Default</span>
                ) : (
                  <button onClick={() => save({ model: m.id })} className="w-24 rounded-md border border-line py-1 text-[12px] text-dim hover:border-fg/30 hover:text-fg">
                    Set default
                  </button>
                )}
              </div>
            ))}
            {typed && !models?.some((m) => m.id === typed) && (
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-dim">
                  Use <span className="font-mono text-fg">{typed}</span>
                </span>
                <button onClick={() => save({ model: typed })} className="w-24 rounded-md border border-line py-1 text-[12px] text-dim hover:border-fg/30 hover:text-fg">
                  Set default
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}

/* ---------- the dialog ---------- */

export default function SettingsDialog({
  ref,
  settings,
  unanalysed,
  onChange,
  onManageTags
}: {
  ref: React.RefObject<HTMLDialogElement | null>
  settings: Settings | null
  unanalysed: number
  onChange: (s: Settings) => void
  onManageTags: () => void
}) {
  const [section, setSection] = useState<Section>('General')
  const [where, setWhere] = useState<'cloud' | 'local'>('cloud')
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState('')
  const [vision, setVision] = useState<EmbeddingStatus | null>(null)
  const [backupNote, setBackupNote] = useState('')

  // indexing progress, refreshed while the dialog is open
  useEffect(() => {
    const tick = () => {
      if (!ref.current?.open) return
      window.tessera.embeddingStatus().then(setVision)
    }
    const timer = setInterval(tick, 2000)
    return () => clearInterval(timer)
  }, [ref])

  const backup = async () => {
    setBackupNote('Backing up…')
    try {
      const dest = await window.tessera.backup()
      setBackupNote(dest ? `Saved to ${dest}` : '')
    } catch {
      setBackupNote('The backup failed. Is there enough space in that folder?')
    }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(settings?.token ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const analyseAll = async () => {
    const n = await window.tessera.analyseAll()
    setStatus(n ? `Analysing ${n} ${n === 1 ? 'item' : 'items'}…` : 'Everything is already analysed.')
  }

  const visionDone = !!vision && vision.state !== 'failed' && vision.done >= vision.total
  const nav: Record<Section, string> = { General: I.sliders, AI: I.sparkle, Extension: I.puzzle }

  const body: Record<Section, React.ReactNode> = {
    General: (
      <>
        <Header title="General" desc="How Tessera starts, and looking after your library." />
        <Panel className="divide-y divide-line">
          <Row
            label="Start at sign-in"
            desc={`${settings?.openAtLogin == null ? 'Available in the installed app. ' : ''}Closing the window keeps Tessera in the tray, so the extension can always save.`}
          >
            <Switch
              label="Start Tessera when you sign in"
              on={!!settings?.openAtLogin}
              disabled={settings?.openAtLogin == null}
              onToggle={async (on) => onChange(await window.tessera.setOpenAtLogin(on))}
            />
          </Row>
          <Row label="Tags" desc="Rename, merge or delete tags everywhere.">
            <button onClick={onManageTags} className={`${BUTTON} w-32`}>
              Manage tags
            </button>
          </Row>
          <Row label="Backup" desc={backupNote || 'Copy the database and every file into a folder you choose.'}>
            <button onClick={backup} className={`${BUTTON} w-32`}>
              Back up
            </button>
          </Row>
        </Panel>
        <Panel className="mt-4">
          <Row label="Same vibe" desc="A small model on this computer finds images that look alike. Downloaded once (about 90 MB); nothing is sent anywhere." />
          <p className="mt-3 flex items-center gap-2 text-[13px] text-fg/80">
            <span className={`size-1.5 shrink-0 rounded-full ${vision?.state === 'failed' ? 'bg-accent' : visionDone ? 'bg-emerald-500' : 'bg-faint'}`} />
            {!vision
              ? 'Checking…'
              : vision.state === 'failed'
                ? `Couldn't load the model: ${vision.error ?? 'unknown error'}. It will retry next time Tessera starts.`
                : visionDone
                  ? `All ${vision.total} images indexed`
                  : vision.state === 'loading' && vision.done === 0
                    ? 'Downloading the model…'
                    : `Indexing ${vision.done} of ${vision.total}`}
          </p>
          {vision && vision.state !== 'failed' && !visionDone && (
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-control">
              <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(vision.done / Math.max(vision.total, 1)) * 100}%` }} />
            </div>
          )}
        </Panel>
      </>
    ),

    AI: settings && (
      <>
        <Header title="AI providers" desc="Pick the model that titles, summarises and tags what you save, and connect the providers you want available." />
        <Panel className="divide-y divide-line">
          <Row label="Active model" desc="Used for everything you save from now on.">
            <ActiveModel settings={settings} onChange={onChange} />
          </Row>
          {settings.ai.active && (
            <Row label="Your library" desc={status || (unanalysed ? `${unanalysed} saves have no title or tags yet.` : 'Everything has been analysed.')}>
              <button onClick={analyseAll} disabled={!unanalysed} className={`${BUTTON} w-32`}>
                Analyse now
              </button>
            </Row>
          )}
        </Panel>

        <div role="tablist" className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-line bg-well p-1">
          {(
            [
              ['cloud', 'Cloud providers', I.cloud],
              ['local', 'Local & gateways', I.server]
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={where === id}
              onClick={() => setWhere(id)}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-[13px] font-medium transition-colors ${
                where === id ? 'bg-raised text-fg shadow-sm' : 'text-dim hover:text-fg'
              }`}
            >
              <Icon d={icon} /> {label}
            </button>
          ))}
        </div>

        <div className="mt-5 mb-3">
          <h4 className="text-[15px] font-semibold">{where === 'cloud' ? 'Cloud providers' : 'Local & gateways'}</h4>
          <p className="text-[12px] text-dim">
            {where === 'cloud' ? 'Add API keys to unlock cloud models.' : 'Run models on your own machine, or route through a gateway.'}
          </p>
        </div>
        <div className="space-y-3">
          {(where === 'cloud' ? CLOUD : LOCAL).map((p) => (
            <ProviderCard key={p} p={p} info={settings.ai.providers[p]} active={settings.ai.active === p} onChange={onChange} />
          ))}
        </div>
      </>
    ),

    Extension: (
      <>
        <Header title="Browser extension" desc="Save images, text and pages from any site with the Tessera extension." />
        <Panel>
          <Row label="Extension key" desc="Paste this into the extension's options. It lets the extension talk to this app, and nothing else." />
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-control px-3 py-2 font-mono text-[12px]">{settings?.token}</code>
            <button onClick={copy} className={BUTTON}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </Panel>
      </>
    )
  }

  return (
    <dialog
      ref={ref}
      onMouseDown={(e) => e.target === e.currentTarget && ref.current?.close()}
      onClose={() => setStatus('')}
      className="m-auto h-[min(720px,90vh)] w-[min(960px,94vw)] overflow-hidden rounded-2xl bg-pane text-fg shadow-lift backdrop:bg-ink/70 backdrop:backdrop-blur-sm open:flex"
    >
      <nav className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-line bg-rail p-4">
        <h2 className="mb-6 px-2 pt-2 font-quote text-[30px] leading-none">Settings</h2>
        {SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            aria-current={section === s ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
              section === s ? 'bg-select font-medium text-fg' : 'text-fg/70 hover:bg-select/60 hover:text-fg'
            }`}
          >
            <Icon d={nav[s]} /> {s}
          </button>
        ))}
      </nav>
      <section className="min-w-0 flex-1 overflow-y-auto p-8">{body[section]}</section>
    </dialog>
  )
}
