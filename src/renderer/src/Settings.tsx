import { useEffect, useState } from 'react'
import {
  AI_PROVIDERS,
  DEFAULT_MODELS,
  detectProvider,
  type AiProvider,
  type EmbeddingStatus,
  type Settings
} from '@shared/api'

const LABEL = 'text-[11px] uppercase tracking-wider text-dim'
const BOX = 'min-w-0 flex-1 rounded-md bg-ink px-3 py-2 text-[13px]'
const FIELD = 'rounded-md bg-ink px-3 py-2 text-[13px] placeholder:text-faint focus:outline-2 focus:outline-accent'
const GHOST = 'shrink-0 rounded-md px-3 py-2 text-[13px] text-dim transition-colors hover:bg-ink hover:text-fg'
const DESC = 'text-[13px] leading-relaxed text-dim'
const SECONDARY =
  'shrink-0 rounded-md border border-line px-3 py-1.5 text-[13px] transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-accent'

const TABS = ['General', 'AI', 'Extension'] as const
type Tab = (typeof TABS)[number]

// a titled card of rows, split by hairlines
const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h4 className={`${LABEL} mb-2 px-1`}>{title}</h4>
    <div className="divide-y divide-line rounded-lg border border-line">{children}</div>
  </div>
)

// what it is on the start side, its control on the end side
const Row = ({ title, desc, children }: { title: string; desc?: React.ReactNode; children?: React.ReactNode }) => (
  <div className="flex items-center gap-6 px-4 py-3.5">
    <div className="min-w-0 flex-1">
      <div className="text-[14px]">{title}</div>
      {desc && <div className={`${DESC} mt-0.5 break-words`}>{desc}</div>}
    </div>
    {children}
  </div>
)

const Switch = ({
  label,
  on,
  disabled,
  onToggle
}: {
  label: string
  on: boolean
  disabled?: boolean
  onToggle: (on: boolean) => void
}) => (
  <button
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onToggle(!on)}
    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 ${
      on ? 'bg-accent' : 'bg-faint'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-4' : ''}`}
    />
  </button>
)

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
  const [tab, setTab] = useState<Tab>('General')
  const [copied, setCopied] = useState(false)
  const [key, setKey] = useState('')
  const [provider, setProvider] = useState<AiProvider>('anthropic')
  const [model, setModel] = useState(DEFAULT_MODELS.anthropic)
  const [baseUrl, setBaseUrl] = useState('')
  const [status, setStatus] = useState('')
  const [test, setTest] = useState<{ state: 'testing' | 'ok' | 'failed'; note?: string } | null>(null)
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
    setTest(null)
  }

  const onKey = (value: string) => {
    setKey(value)
    setTest(null)
    const guess = detectProvider(value)
    if (guess && guess !== provider) pickProvider(guess)
  }

  const saveAi = async () => {
    const next = await window.tessera.setAi({ provider, model, baseUrl, key: key.trim() ? key : undefined })
    setKey('')
    onChange(next)
    setStatus(next.ai?.hasKey ? 'Saved. New saves will be analysed automatically.' : 'Saved.')
  }

  // tries the fields as typed (the pasted key, or else the saved one) without saving anything
  const testKey = async () => {
    setTest({ state: 'testing' })
    const error = await window.tessera.testAi({ provider, model, baseUrl, key: key.trim() ? key : undefined })
    setTest(error ? { state: 'failed', note: error } : { state: 'ok' })
  }

  const removeKey = async () => {
    onChange(await window.tessera.setAi({ provider, model, baseUrl, key: '' }))
    setStatus('Key removed.')
    setTest(null)
  }

  const analyseAll = async () => {
    const n = await window.tessera.analyseAll()
    setStatus(n ? `Analysing ${n} ${n === 1 ? 'item' : 'items'}…` : 'Everything is already analysed.')
  }

  const hasKey = !!settings?.ai?.hasKey

  const sections: Record<Tab, React.ReactNode> = {
    General: (
      <div className="space-y-7">
        <Group title="Startup">
          <Row
            title="Open at sign-in"
            desc={
              settings?.openAtLogin == null
                ? 'Available in the installed app.'
                : 'Closing the window keeps Tessera in the tray, so the extension can always save.'
            }
          >
            <Switch
              label="Start Tessera when you sign in"
              on={!!settings?.openAtLogin}
              disabled={settings?.openAtLogin == null}
              onToggle={async (on) => onChange(await window.tessera.setOpenAtLogin(on))}
            />
          </Row>
        </Group>

        <Group title="Library">
          <Row title="Tags" desc="Rename, merge or delete tags everywhere.">
            <button onClick={onManageTags} className={SECONDARY}>
              Manage…
            </button>
          </Row>
          <Row title="Back up" desc={backupNote || 'Copy the database and every file into a folder you choose.'}>
            <button onClick={backup} className={SECONDARY}>
              Back up…
            </button>
          </Row>
        </Group>

        <Group title="Same vibe">
          <Row
            title="Look-alike images"
            desc={
              <>
                <p>
                  A small model on this computer finds images that look alike. Downloaded once (about 90 MB);
                  nothing is sent anywhere.
                </p>
                <p className="mt-2.5 flex items-center gap-2 text-fg/80">
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${
                      vision?.state === 'failed' ? 'bg-accent' : vision && vision.done >= vision.total ? 'bg-emerald-500' : 'bg-faint'
                    }`}
                  />
                  {!vision
                    ? 'Checking…'
                    : vision.state === 'failed'
                      ? `Couldn't load the model: ${vision.error ?? 'unknown error'}. It will retry next time Tessera starts.`
                      : vision.done >= vision.total
                        ? `All ${vision.total} images indexed`
                        : vision.state === 'loading' && vision.done === 0
                          ? 'Downloading the model…'
                          : `Indexing images: ${vision.done} of ${vision.total}`}
                </p>
                {vision && vision.state !== 'failed' && vision.done < vision.total && (
                  <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-ink">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-500"
                      style={{ width: `${(vision.done / Math.max(vision.total, 1)) * 100}%` }}
                    />
                  </div>
                )}
              </>
            }
          />
        </Group>
      </div>
    ),

    AI: (
      <>
        <p className={DESC}>
          Gives everything you save a title, a summary and search tags. Works with any provider's API key;
          each item is sent to the provider you choose.
        </p>

        <h4 className={`${LABEL} mt-6`}>API key</h4>
        <div className="mt-2 flex gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => onKey(e.target.value)}
            placeholder={hasKey ? 'Key saved. Paste a new one to replace it' : 'Paste an API key'}
            aria-label="API key"
            spellCheck={false}
            autoComplete="off"
            className={`${FIELD} min-w-0 flex-1 font-mono`}
          />
          <button
            onClick={testKey}
            disabled={(!key.trim() && !hasKey) || test?.state === 'testing'}
            className={`${GHOST} border border-line disabled:pointer-events-none disabled:opacity-40`}
          >
            {test?.state === 'testing' ? 'Testing…' : 'Test key'}
          </button>
        </div>
        {test && test.state !== 'testing' && (
          <p role="status" className={`mt-1.5 text-[12px] break-words ${test.state === 'ok' ? 'text-fg/80' : 'text-accent'}`}>
            {test.state === 'ok'
              ? `✓ It works. ${AI_PROVIDERS[provider]} answered using ${model.trim() || DEFAULT_MODELS[provider]}.`
              : test.note}
          </p>
        )}

        <h4 className={`${LABEL} mt-6`}>Provider and model</h4>
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
            onChange={(e) => {
              setModel(e.target.value)
              setTest(null)
            }}
            placeholder="Model"
            aria-label="Model"
            spellCheck={false}
            className={`${FIELD} font-mono`}
          />
        </div>
        {provider === 'custom' && (
          <input
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value)
              setTest(null)
            }}
            placeholder="Base URL, e.g. http://localhost:11434/v1"
            aria-label="Base URL"
            spellCheck={false}
            className={`${FIELD} mt-2 w-full font-mono`}
          />
        )}

        <div className="mt-6 flex items-center gap-2">
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
      </>
    ),

    Extension: (
      <>
        <p className={DESC}>Paste this key into the Tessera extension's options.</p>
        <div className="mt-3 flex items-center gap-2">
          <code className={`${BOX} truncate font-mono text-[12px]`}>{settings?.token}</code>
          <button onClick={copy} className={GHOST}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </>
    )
  }

  return (
    <dialog
      ref={ref}
      onMouseDown={(e) => e.target === e.currentTarget && ref.current?.close()}
      onClose={() => {
        setStatus('')
        setTest(null)
      }}
      className="m-auto h-[min(540px,85vh)] w-[min(720px,92vw)] overflow-hidden rounded-lg bg-card text-fg shadow-lift backdrop:bg-ink/70 backdrop:backdrop-blur-sm open:flex"
    >
      <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-line p-4">
        <h2 className="mb-5 px-2 pt-2 font-serif text-[28px] italic leading-none">Settings</h2>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'page' : undefined}
            className={`rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
              tab === t ? 'bg-ink text-fg' : 'text-dim hover:bg-ink hover:text-fg'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <section className="min-w-0 flex-1 overflow-y-auto p-8">
        <h3 className="mb-3 text-[18px] font-medium">{tab}</h3>
        {sections[tab]}
      </section>
    </dialog>
  )
}
