import type { WindowAction } from '@shared/api'

// macOS-style traffic lights; glyphs appear when the group is hovered, as on a Mac
const BUTTONS: [WindowAction, string, string, string][] = [
  ['close', 'Close', 'bg-[#ff5f57] border-[#e0443e]', 'M3.5 3.5l5 5M8.5 3.5l-5 5'],
  ['minimize', 'Minimize', 'bg-[#febc2e] border-[#dea123]', 'M3 6h6'],
  ['maximize', 'Maximize', 'bg-[#28c840] border-[#1aab29]', 'M6 3v6M3 6h6']
]

export default function WindowControls() {
  return (
    <div className="group flex gap-2 [-webkit-app-region:no-drag]">
      {BUTTONS.map(([action, label, color, glyph]) => (
        <button
          key={action}
          onClick={() => window.tessera.windowControl(action)}
          aria-label={label}
          title={label}
          className={`grid size-3 place-items-center rounded-full border-[0.5px] ${color}`}
        >
          <svg
            viewBox="0 0 12 12"
            className="size-2.5 opacity-0 transition-opacity group-hover:opacity-100"
            fill="none"
            stroke="rgb(0 0 0 / 0.55)"
            strokeWidth="1.3"
            strokeLinecap="round"
          >
            <path d={glyph} />
          </svg>
        </button>
      ))}
    </div>
  )
}
