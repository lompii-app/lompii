import { useEffect, useRef, useState } from 'react'
import type { PairRequest } from '@shared/api'
import { GitHubMark, REPO } from './Setup'

// lompii's own pop-ups, in place of the system's confirm() and message boxes.

const SHELL =
  'm-auto w-[440px] max-w-[calc(100vw-2rem)] rounded-lg bg-card p-8 text-fg shadow-lift backdrop:bg-ink/70 backdrop:backdrop-blur-sm'
const TITLE = 'font-serif text-[30px] leading-tight italic text-balance'
const CANCEL = 'ml-auto rounded-md px-4 py-2 text-[14px] text-dim transition-colors hover:bg-ink hover:text-fg'
const GO = 'rounded-md bg-accent px-5 py-2 text-[14px] text-white transition-opacity hover:opacity-85'

// Opens as a modal while `open`; Esc or Cancel calls onCancel. Cancel has the focus, so Enter
// never confirms a delete by accident.
export function Confirm({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel
}: {
  open: boolean
  title: string
  children: React.ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useModal(open)
  return (
    <dialog ref={ref} onClose={() => open && onCancel()} className={SHELL}>
      <h2 className={TITLE}>{title}</h2>
      <div className="mt-3 text-[14px] leading-relaxed text-dim">{children}</div>
      <div className="mt-8 flex items-center gap-2">
        <button autoFocus onClick={onCancel} className={CANCEL}>
          Cancel
        </button>
        <button onClick={onConfirm} className={GO}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}

// A browser extension asking to connect. The main process holds the request (it may arrive
// before this window has loaded) and says when it changes; this asks and sends the answer back.
export function PairPrompt({ onAnswered }: { onAnswered: () => void }) {
  const [req, setReq] = useState<PairRequest | null>(null)
  useEffect(() => {
    const load = () => window.lompii.pairRequest().then(setReq)
    load()
    return window.lompii.onPairChanged(load)
  }, [])

  const answer = (ok: boolean) => {
    if (!req) return
    window.lompii.answerPair(req.id, ok).then(onAnswered)
    setReq(null)
  }

  const ref = useModal(!!req)
  return (
    <dialog ref={ref} onClose={() => answer(false)} className={SHELL}>
      <h2 className={TITLE}>Connect a browser?</h2>
      <p className="mt-3 text-[14px] leading-relaxed text-dim">
        A browser extension wants to save to lompii. Only allow it if the extension shows this same
        code.
      </p>
      <p
        aria-label={`Code ${req?.code.split('').join(' ')}`}
        className="mt-6 rounded-md bg-ink py-4 text-center font-mono text-[34px] tracking-[0.35em] text-fg tabular-nums"
      >
        {req?.code}
      </p>
      <p className="mt-3 truncate text-[12px] text-faint" title={req?.extensionId}>
        Extension ID: {req?.extensionId}
      </p>
      <div className="mt-8 flex items-center gap-2">
        <button autoFocus onClick={() => answer(false)} className={CANCEL}>
          Don't allow
        </button>
        <button onClick={() => answer(true)} className={GO}>
          Allow
        </button>
      </div>
    </dialog>
  )
}

// A 6-digit PIN as six tiles, like the logo's: a typed digit turns its tile light orange with a *, the next one
// waiting is ringed in orange. One real input lies over them, see-through, so typing, pasting,
// Backspace and screen readers all work as usual; the tiles only show how many digits are in.
export function PinTiles({
  value,
  onChange,
  label,
  autoFocus,
  invalid,
  small
}: {
  value: string
  onChange: (pin: string) => void
  label: string
  autoFocus?: boolean
  invalid?: boolean
  small?: boolean // Settings' size; the unlock prompt's tiles fill its width
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div className={`relative flex ${small ? 'gap-1.5' : 'gap-2.5'}`}>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={label}
        aria-invalid={invalid || undefined}
        className="absolute inset-0 cursor-pointer text-transparent caret-transparent opacity-0"
      />
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`pointer-events-none grid aspect-square place-items-center font-semibold text-accent transition duration-150 ${
            small ? 'size-9 rounded-lg text-[20px]' : 'flex-1 rounded-xl text-[32px]'
          } ${i < value.length ? 'bg-accent/35' : 'bg-ink ring-1 ring-line ring-inset'} ${
            focused && i === value.length ? 'outline-2 outline-offset-2 outline-accent' : ''
          }`}
        >
          {/* sits a little high in most fonts; nudged down to the middle */}
          {i < value.length && <span className="translate-y-[0.18em]">*</span>}
        </span>
      ))}
    </div>
  )
}

// Asked each time a locked archive is opened: six digits, tried as soon as the sixth is typed.
export function ArchivePrompt({
  open,
  onUnlock,
  onCancel
}: {
  open: boolean
  onUnlock: (pin: string) => Promise<'ok' | 'wrong' | 'wait'>
  onCancel: () => void
}) {
  const ref = useModal(open)
  const [pin, setPin] = useState('')
  const [miss, setMiss] = useState<'wrong' | 'wait' | null>(null)
  useEffect(() => {
    setPin('')
    setMiss(null)
  }, [open])

  const type = async (digits: string) => {
    setPin(digits)
    if (digits.length < 6) return
    const result = await onUnlock(digits)
    if (result === 'ok') return
    setMiss(result)
    setPin('')
  }

  return (
    <dialog ref={ref} onClose={() => open && onCancel()} className={SHELL}>
      <h2 className={TITLE}>The archive is locked.</h2>
      <p className="mt-3 text-[14px] leading-relaxed text-dim">Enter its 6-digit PIN.</p>
      <div className="mt-6">
        <PinTiles value={pin} onChange={type} label="Archive PIN" autoFocus invalid={!!miss} />
      </div>
      {miss && (
        <p role="alert" className="mt-2 text-[13px] text-accent">
          {miss === 'wait' ? 'Too many tries. Wait half a minute, then try again.' : "That's not the PIN."}
        </p>
      )}
      <div className="mt-8 flex items-center gap-2">
        <button type="button" onClick={onCancel} className={CANCEL}>
          Cancel
        </button>
      </div>
    </dialog>
  )
}

// The very first start: a note from the founder, before the plan screen. "Copy link to share"
// puts the GitHub address on the clipboard for passing lompii on.
export function WelcomeNote({ open, onDone }: { open: boolean; onDone: () => void }) {
  const ref = useModal(open)
  const [copied, setCopied] = useState(false)
  const share = () =>
    navigator.clipboard.writeText(REPO).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  return (
    <dialog ref={ref} onClose={() => open && onDone()} className={SHELL.replace('w-[440px]', 'w-[540px]')}>
      <svg viewBox="0 0 24 24" aria-hidden className="size-9">
        <rect x="2" y="2" width="9" height="9" rx="2.4" className="fill-fg" />
        <rect x="13" y="2" width="9" height="9" rx="2.4" className="fill-accent" />
        <rect x="2" y="13" width="9" height="9" rx="2.4" className="fill-fg" />
        <rect x="13" y="13" width="9" height="9" rx="2.4" className="fill-fg" />
      </svg>
      <h2 className={`${TITLE} mt-5`}>Hi, I'm Midhun.</h2>
      <div className="mt-4 space-y-3.5 text-[14px] leading-relaxed text-fg/85">
        <p>
          I made lompii because I kept losing the things that inspired me: a poster, a website, a line someone wrote. I
          knew I'd seen them. I just couldn't find them again.
        </p>
        <p>
          You're one of the very first people to use it, and that means a lot. Thank you for giving something new from a
          small, independent maker a try.
        </p>
        <p>
          If lompii helps you, tell a friend, a classmate or your team about it. That's how a small app like this grows.
          And if something's missing or broken, tell me on GitHub. I read every message.
        </p>
      </div>
      <p className="mt-5 font-serif text-[20px] text-fg italic">Midhun, maker of lompii</p>
      <div className="mt-7 flex items-center gap-2">
        <button
          onClick={share}
          className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-line px-4 text-[14px] text-fg transition-colors hover:bg-ink"
        >
          <GitHubMark />
          {copied ? 'Link copied' : 'Copy link to share'}
        </button>
        <button autoFocus onClick={onDone} className={`${GO} ml-auto h-10 cursor-pointer font-medium`}>
          Let's go
        </button>
      </div>
    </dialog>
  )
}

const CHECK = 'M20 6 9 17l-5-5'
const STAR = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'
const FREE = ['Unlimited saves', 'Search by description, on your computer', 'Your own AI, or a local model', 'Stacks, archive, trash and backups']
const STARRED = ['Everything in Free', 'Helps other people find lompii', 'Keeps a small, free project going', 'Never asked again']

const Features = ({ lines, tick }: { lines: string[]; tick: string }) => (
  <ul className="mt-5 flex-1 space-y-2.5 text-[14px] text-fg">
    {lines.map((line) => (
      <li key={line} className="flex gap-2.5">
        <svg viewBox="0 0 24 24" className={`mt-0.5 size-4 shrink-0 ${tick}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={CHECK} />
        </svg>
        {line}
      </li>
    ))}
  </ul>
)

// The first start: a pricing page whose two plans are the same app, one paid for with a star on
// GitHub. Paying opens the repo and ends the asking. "Star later" turns into "Pinky promise?",
// and clicking that closes it; the toast asks again in a week. Esc puts it off without the joke.
export function PlanPrompt({ open, onAnswer }: { open: boolean; onAnswer: (value: string) => void }) {
  const ref = useModal(open)
  const [promised, setPromised] = useState(false)
  const later = () => onAnswer(String(Date.now()))

  return (
    <dialog ref={ref} onClose={() => open && later()} className={SHELL.replace('w-[440px]', 'w-[700px]')}>
      <div className="text-center">
        <svg viewBox="0 0 24 24" aria-hidden className="mx-auto mb-3.5 size-9">
          <rect x="2" y="2" width="9" height="9" rx="2.4" className="fill-fg" />
          <rect x="13" y="2" width="9" height="9" rx="2.4" className="fill-accent" />
          <rect x="2" y="13" width="9" height="9" rx="2.4" className="fill-fg" />
          <rect x="13" y="13" width="9" height="9" rx="2.4" className="fill-fg" />
        </svg>
        <h2 className={TITLE}>Pick how you pay</h2>
        <p className="mt-2 text-[14px] text-dim">Same app, same features. One of them makes our day.</p>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-4">
        <div className="flex flex-col rounded-xl border border-line p-6">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-dim uppercase">Free</span>
          <span className="mt-2.5 flex items-baseline gap-1.5">
            <span className="font-serif text-[44px] leading-none text-fg">0</span>
            <span className="text-[13px] text-dim">nothing, ever</span>
          </span>
          <Features lines={FREE} tick="text-dim" />
          <button
            onClick={() => (promised ? later() : setPromised(true))}
            className={`mt-6 h-11 w-full cursor-pointer rounded-lg border text-[14px] font-medium transition-colors ${
              promised
                ? 'border-accent bg-accent/5 text-accent hover:bg-accent/15'
                : 'border-line text-fg hover:border-fg/30 hover:bg-fg/[0.05]'
            }`}
          >
            {promised ? 'Pinky promise?' : 'Star later'}
          </button>
        </div>

        <div className="relative flex flex-col rounded-xl bg-accent/5 p-6 ring-2 ring-accent">
          <span className="absolute -top-3 right-5 rounded-full bg-fg px-2.5 py-1 text-[11px] font-semibold tracking-wide text-card">
            Most loved
          </span>
          <span className="text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">Starred</span>
          <span className="mt-2.5 flex items-baseline gap-1.5">
            <svg viewBox="0 0 24 24" className="size-6 self-center text-accent" fill="currentColor" aria-hidden>
              <path d={STAR} />
            </svg>
            <span className="font-serif text-[44px] leading-none text-fg">1</span>
            <span className="text-[13px] text-dim">star, once</span>
          </span>
          <Features lines={STARRED} tick="text-accent" />
          <button
            autoFocus
            onClick={() => {
              window.lompii.openExternal(REPO)
              onAnswer('done')
            }}
            className={`${GO} mt-6 flex h-11 w-full cursor-pointer items-center justify-center gap-2 font-medium`}
          >
            <GitHubMark />
            Pay with a star
          </button>
        </div>
      </div>

      <p className="mt-5 text-center text-[12px] text-dim">No card, no account. The star is given on GitHub, in your browser.</p>
    </dialog>
  )
}

function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (open && !d?.open) d?.showModal()
    if (!open && d?.open) d.close()
  }, [open])
  return ref
}
