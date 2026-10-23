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

export const REPO = 'https://github.com/Brosski224/lompii'

// GitHub's mark (Octicons, MIT), on the buttons that open lompii's GitHub page
export const GitHubMark = ({ className = 'size-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
  </svg>
)

const ASK_FROM = 10 // saves: by then lompii has shown it's useful
const LATER = 7 * 86_400_000 // "later" asks again after a week

// lompii is free; the one thing it asks for is a star on GitHub: first on the plan screen at
// the first start (Dialogs.tsx), then here once the library has ASK_FROM saves. Starring, or
// "Already starred", ends it for good. There's no way to see whether a star was really given,
// so lompii takes your word for it. App holds the answer, so both see the same one. The toast
// only follows a "later": never asked yet means the plan screen is the one asking.
export const starDue = (asked: string | null, saves: number) =>
  saves >= ASK_FROM && !!asked && asked !== 'done' && Date.now() - Number(asked) >= LATER

export function StarToast({ answer }: { answer: (value: string) => void }) {
  return (
    <div
      role="status"
      className="fixed bottom-6 left-24 z-30 w-[340px] max-w-[calc(100vw-7rem)] rounded-lg bg-card py-5 pr-10 pl-6 shadow-lift transition duration-200 starting:translate-y-3 starting:opacity-0"
    >
      <p className="font-serif text-[26px] leading-tight text-fg italic">lompii is free.</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-dim">
        The only price is a star on GitHub. It takes a second, and it's how other people find lompii.
      </p>
      <div className="mt-4 flex items-center gap-1">
        <button
          onClick={() => {
            window.lompii.openExternal(REPO)
            answer('done')
          }}
          className="flex cursor-pointer items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
        >
          <GitHubMark className="size-3.5" />
          Star on GitHub
        </button>
        <button onClick={() => answer('done')} className="cursor-pointer rounded-full px-3 py-1.5 text-[13px] text-dim transition-colors hover:text-fg">
          Already starred
        </button>
      </div>
      <button
        onClick={() => answer(String(Date.now()))}
        aria-label="Ask me later"
        className="absolute top-2.5 right-2.5 grid size-7 cursor-pointer place-items-center rounded-full text-dim transition-colors hover:bg-fg/[0.06] hover:text-fg"
      >
        <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M3 3l6 6M9 3 3 9" />
        </svg>
      </button>
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
