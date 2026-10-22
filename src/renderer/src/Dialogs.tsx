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
export function PairPrompt() {
  const [req, setReq] = useState<PairRequest | null>(null)
  useEffect(() => {
    const load = () => window.tessera.pairRequest().then(setReq)
    load()
    return window.tessera.onPairChanged(load)
  }, [])

  const answer = (ok: boolean) => {
    if (!req) return
    window.tessera.answerPair(req.id, ok)
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

function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (open && !d?.open) d?.showModal()
    if (!open && d?.open) d.close()
  }, [open])
  return ref
}
