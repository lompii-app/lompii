import { useEffect, useRef, useState } from 'react'
import type { PairRequest } from '@shared/api'

// Tessera's own pop-ups, in place of the system's confirm() and message boxes.

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
    const load = () => window.tessera.pairRequest().then(setReq)
    load()
    return window.tessera.onPairChanged(load)
  }, [])

  const answer = (ok: boolean) => {
    if (!req) return
    window.tessera.answerPair(req.id, ok).then(onAnswered)
    setReq(null)
  }

  const ref = useModal(!!req)
  return (
    <dialog ref={ref} onClose={() => answer(false)} className={SHELL}>
      <h2 className={TITLE}>Connect a browser?</h2>
      <p className="mt-3 text-[14px] leading-relaxed text-dim">
        A browser extension wants to save to Tessera. Only allow it if the extension shows this same
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

function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (open && !d?.open) d?.showModal()
    if (!open && d?.open) d.close()
  }, [open])
  return ref
}
