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
const FIELD = 'rounded-md bg-ink px-3 py-2 text-[13px] placeholder:text-faint focus:outline-2 focus:outline-accent'
const DESC = 'text-[14px] leading-relaxed text-dim'
const LINK = 'text-[15px] text-accent transition-opacity hover:opacity-75'
const PILL = 'shrink-0 rounded-full px-5 py-2 text-[11px] font-medium tracking-[0.12em] uppercase transition'

// white card; its title on the start side, an action on the end side, a hairline when there's a body
const Card = ({ title, action, children }: { title: string; action?: React.ReactNode; children?: React.ReactNode }) => (
  <section className="rounded-md bg-card px-8 py-6">
    <div className={`flex items-center gap-4 ${children ? 'border-b border-line pb-3' : ''}`}>
      <h3 className="flex-1 text-[20px] font-light">{title}</h3>
      {action}
    </div>
    {children && <div className="pt-4">{children}</div>}
  </section>
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
  const visionDone = !!vision && vision.state !== 'failed' && vision.done >= vision.total

  return (
    <dialog
      ref={ref}
      onMouseDown={(e) => e.target === e.currentTarget && ref.current?.close()}
      onClose={() => {
        setStatus('')
        setTest(null)
      }}
      className="m-auto h-[min(860px,90vh)] w-[min(1040px,94vw)] overflow-hidden rounded-xl bg-ink text-fg shadow-lift backdrop:bg-ink/70 backdrop:backdrop-blur-sm"
    >
      <div className="h-full overflow-y-auto px-10 pt-10 pb-12 max-md:px-5">
        <h2 className="font-quote text-[52px] leading-none tracking-tight max-md:text-[38px]">
          Tune your <span className="text-dim">Tessera</span>
        </h2>

        <div className="mt-9 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <Card
              title="AI"
              action={
                <span className={hasKey ? 'text-accent' : 'text-dim'}>
                  {hasKey ? `Using ${AI_PROVIDERS[settings!.ai!.provider]}` : 'Not set up'}
                </span>
              }
            >
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
                  className={`${PILL} border border-line text-fg hover:border-fg disabled:pointer-events-none disabled:opacity-40`}
                >
                  {test?.state === 'testing' ? 'Testing…' : 'Test key'}
                </button>
              </div>
              {test && test.state !== 'testing' && (
                <p role="status" className={`mt-2 text-[12px] break-words ${test.state === 'ok' ? 'text-fg/80' : 'text-accent'}`}>
                  {test.state === 'ok'
                    ? `✓ It works. ${AI_PROVIDERS[provider]} answered using ${model.trim() || DEFAULT_MODELS[provider]}.`
                    : test.note}
                </p>
              )}

              <h4 className={`${LABEL} mt-6`}>Provider</h4>
              <div role="radiogroup" aria-label="Provider" className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(AI_PROVIDERS) as AiProvider[]).map((p) => (
                  <button
                    key={p}
                    role="radio"
                    aria-checked={provider === p}
                    onClick={() => pickProvider(p)}
                    className={`rounded-full border px-4 py-1.5 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      provider === p ? 'border-fg bg-fg text-card' : 'border-line text-dim hover:border-fg hover:text-fg'
                    }`}
                  >
                    {AI_PROVIDERS[p]}
                  </button>
                ))}
              </div>

              <h4 className={`${LABEL} mt-6`}>Model</h4>
              <input
                value={model}
                onChange={(e) => {
                  setModel(e.target.value)
                  setTest(null)
                }}
                placeholder={DEFAULT_MODELS[provider]}
                aria-label="Model"
                spellCheck={false}
                className={`${FIELD} mt-2 w-full font-mono`}
              />
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

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                <button onClick={saveAi} className={`${PILL} bg-fg text-card hover:opacity-85`}>
                  Save
                </button>
                {hasKey && (
                  <>
                    <button onClick={analyseAll} className={LINK}>
                      Analyse library{unanalysed ? ` (${unanalysed})` : ''}
                    </button>
                    <button onClick={removeKey} className={`${LINK} ml-auto text-dim`}>
                      Remove key
                    </button>
                  </>
                )}
              </div>
              {status && <p className="mt-2 text-[12px] text-dim">{status}</p>}
            </Card>

            <Card
              title="Your tags"
              action={
                <button onClick={onManageTags} className={LINK}>
                  Manage tags
                </button>
              }
            />

            <Card
              title="Backup"
              action={
                <button onClick={backup} className={LINK}>
                  Back up…
                </button>
              }
            >
              {backupNote && <p className={`${DESC} break-all`}>{backupNote}</p>}
            </Card>

            <Card
              title="Start at sign-in"
              action={
                <Switch
                  label="Start Tessera when you sign in"
                  on={!!settings?.openAtLogin}
                  disabled={settings?.openAtLogin == null}
                  onToggle={async (on) => onChange(await window.tessera.setOpenAtLogin(on))}
                />
              }
            >
              <p className={DESC}>
                {settings?.openAtLogin == null ? 'Available in the installed app. ' : ''}
                Closing the window keeps Tessera in the tray, so the extension can always save.
              </p>
            </Card>
          </div>

          <div className="space-y-5">
            <aside className="relative rounded-md bg-card px-7 pt-8 pb-7 text-center">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-white uppercase">
                Extension
              </span>
              <p className="text-[16px] leading-snug text-dim">
                Paste this key into the <span className="text-accent">browser extension</span> to save images, text
                and pages.
              </p>
              <code className="mt-5 block truncate rounded-md bg-ink px-3 py-2 font-mono text-[12px]">{settings?.token}</code>
              <button onClick={copy} className={`${PILL} mt-4 bg-fg text-card hover:opacity-85`}>
                {copied ? 'Copied' : 'Copy key'}
              </button>
            </aside>

            <aside className="rounded-md bg-card px-7 py-8 text-center">
              <h3 className="font-quote text-[30px] leading-[1.05]">
                Same vibe,
                <br />
                found for you.
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-dim">
                A small model on this computer finds images that look alike. Downloaded once (about 90 MB); nothing
                is sent anywhere.
              </p>
              <p className="mt-5 flex items-center justify-center gap-2 text-[13px] text-fg/80">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    vision?.state === 'failed' ? 'bg-accent' : visionDone ? 'bg-emerald-500' : 'bg-faint'
                  }`}
                />
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
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${(vision.done / Math.max(vision.total, 1)) * 100}%` }}
                  />
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </dialog>
  )
}
