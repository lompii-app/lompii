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

export default function SettingsDialog({
  ref,
  settings,
  unanalysed,
  onChange,
  onRestored,
  onManageTags
}: {
  ref: React.RefObject<HTMLDialogElement | null>
  settings: Settings | null
  unanalysed: number
  onChange: (s: Settings) => void
  onRestored: () => void // items came back from the trash
  onManageTags: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [key, setKey] = useState('')
  const [provider, setProvider] = useState<AiProvider>('anthropic')
  const [model, setModel] = useState(DEFAULT_MODELS.anthropic)
  const [baseUrl, setBaseUrl] = useState('')
  const [status, setStatus] = useState('')
  const [vision, setVision] = useState<EmbeddingStatus | null>(null)
  const [trash, setTrash] = useState(0)
  const [backupNote, setBackupNote] = useState('')

  // indexing progress and the trash count, refreshed while the dialog is open
  useEffect(() => {
    const tick = () => {
      if (!ref.current?.open) return
      window.tessera.embeddingStatus().then(setVision)
      window.tessera.trashCount().then(setTrash)
    }
    const timer = setInterval(tick, 2000)
    return () => clearInterval(timer)
  }, [ref])

  const restoreAll = async () => {
    await window.tessera.restore('all')
    setTrash(0)
    onRestored()
  }

  const emptyTrash = async () => {
    if (!confirm(`Delete ${trash} ${trash === 1 ? 'item' : 'items'} for good? This can't be undone.`)) return
    await window.tessera.emptyTrash()
    setTrash(0)
  }

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
      className="m-auto max-h-[85vh] w-[480px] overflow-y-auto rounded-lg bg-card p-8 text-fg shadow-lift backdrop:bg-ink/70 backdrop:backdrop-blur-sm"
    >
      <h2 className="font-serif text-[32px] italic leading-none">Settings</h2>

      <section className="mt-7">
        <h3 className={LABEL}>General</h3>
        <label className={`mt-3 flex items-center gap-3 text-[14px] ${settings?.openAtLogin == null ? 'opacity-50' : ''}`}>
          <input
            type="checkbox"
            checked={!!settings?.openAtLogin}
            disabled={settings?.openAtLogin == null}
            onChange={async (e) => onChange(await window.tessera.setOpenAtLogin(e.target.checked))}
            className="size-4 accent-[var(--color-accent)]"
          />
          Start Tessera when you sign in
        </label>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dim">
          {settings?.openAtLogin == null
            ? 'Available in the installed app. '
            : ''}
          Closing the window keeps Tessera running in the tray, so the extension can always save. Quit
          from the tray icon.
        </p>
      </section>

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
        <h3 className={LABEL}>Library</h3>
        <div className="mt-3 flex items-center gap-3">
          <p className="flex-1 text-[13px] leading-relaxed text-dim">
            {trash
              ? `${trash} ${trash === 1 ? 'item' : 'items'} in the trash. Deleted items are kept for 30 days.`
              : 'The trash is empty. Deleted items are kept for 30 days.'}
          </p>
          {trash > 0 && (
            <>
              <button onClick={restoreAll} className={GHOST}>
                Restore all
              </button>
              <button onClick={emptyTrash} className={`${GHOST} hover:text-red-600`}>
                Empty now
              </button>
            </>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <p className="flex-1 text-[13px] leading-relaxed text-dim">Rename, merge or delete tags everywhere.</p>
          <button onClick={onManageTags} className={GHOST}>
            Manage tags…
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <p className="flex-1 text-[13px] leading-relaxed text-dim">
            Copy the database and every file into a folder you choose.
          </p>
          <button onClick={backup} className={GHOST}>
            Back up…
          </button>
        </div>
        {backupNote && <p className="mt-1 text-[12px] break-all text-dim">{backupNote}</p>}
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
