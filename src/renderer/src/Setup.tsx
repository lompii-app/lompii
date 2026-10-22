import type { Settings } from '@shared/api'
import type { Section } from './Settings'

// The two things a new library needs before it's useful: a browser to save from, and an AI
// provider to title, summarise and tag what's saved. Each step disappears once it's done.

type Step = { section: Section; title: string; desc: string; action: string; icon: string }

const STEPS: Record<'extension' | 'ai', Step> = {
  extension: {
    section: 'Extension',
    title: 'Connect your browser',
    desc: 'Save images, text and whole pages from Chrome with one right-click.',
    action: 'Set it up',
    icon: 'M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z'
  },
  ai: {
    section: 'AI providers',
    title: 'Add an AI provider',
    desc: 'Everything you save gets a title, a summary and tags, so search can find it.',
    action: 'Add one',
    icon: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z'
  }
}

export const pendingSteps = (s: Settings | null): Step[] =>
  s ? [!s.extensionConnected && STEPS.extension, !s.ai.active && STEPS.ai].filter((x): x is Step => !!x) : []

const Glyph = ({ d, className = 'size-5' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`shrink-0 text-accent ${className}`}>
    <path d={d} />
  </svg>
)

// for an empty library: the steps as cards, under "Nothing here yet."
export function SetupCards({ steps, onOpen }: { steps: Step[]; onOpen: (s: Section) => void }) {
  return (
    <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
      {steps.map((s) => (
        <div key={s.section} className="flex flex-col gap-3 rounded-lg bg-card p-5 shadow-card">
          <Glyph d={s.icon} />
          <div>
            <p className="text-[15px] font-medium text-fg">{s.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-dim">{s.desc}</p>
          </div>
          <button
            onClick={() => onOpen(s.section)}
            className="mt-auto self-start rounded-full bg-fg px-4 py-1.5 text-[13px] text-card transition-opacity hover:opacity-85"
          >
            {s.action}
          </button>
        </div>
      ))}
    </div>
  )
}

// above a library that has things in it: one quiet line, which "Later" hides until next launch
export function SetupStrip({ steps, onOpen, onLater }: { steps: Step[]; onOpen: (s: Section) => void; onLater: () => void }) {
  return (
    <div className="mt-6 mr-20 ml-1 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-card py-3 pr-3 pl-5 shadow-card">
      <span className="text-[13px] text-dim">Finish setting up:</span>
      {steps.map((s) => (
        <button
          key={s.section}
          onClick={() => onOpen(s.section)}
          title={s.desc}
          className="flex items-center gap-2 rounded-full bg-fg/[0.06] px-3.5 py-1.5 text-[13px] text-fg transition-colors hover:bg-fg/10"
        >
          <Glyph d={s.icon} className="size-4" />
          {s.title}
        </button>
      ))}
      <button onClick={onLater} className="ml-auto rounded-full px-3 py-1.5 text-[13px] text-dim transition-colors hover:text-fg">
        Later
      </button>
    </div>
  )
}
