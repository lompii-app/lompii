import { useEffect, useState } from 'react'
import { ITEMS_TYPE } from './Grid'
import type { Density, Theme } from './prefs'

const BUTTON = 'p-2 text-dim transition-colors hover:text-fg'

// the layout button's icon: a 2×2, 3×3 or 4×4 grid of squares, matching the current density
function DensityIcon({ density }: { density: Density }) {
  const n = { large: 2, medium: 3, small: 4 }[density]
  const cell = 18 / n
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor" aria-hidden>
      {Array.from({ length: n * n }, (_, i) => (
        <rect key={i} x={2 + (i % n) * cell} y={2 + Math.floor(i / n) * cell} width={cell - 1.6} height={cell - 1.6} rx={n === 2 ? 1.6 : 0.8} />
      ))}
    </svg>
  )
}

export default function Sidebar({
  theme,
  onTheme,
  density,
  onDensity,
  onSettings,
  onTrash,
  inTrash,
  onArchive,
  inArchive,
  onDropItems,
  pill
}: {
  theme: Theme
  onTheme: () => void
  density: Density
  onDensity: () => void
  onSettings: () => void
  onTrash: () => void
  inTrash: boolean
  onArchive: () => void // open or leave the archive
  inArchive: boolean
  onDropItems: (ids: number[]) => void // cards dropped on the logo: archived, or unarchived from the archive
  pill: boolean // the floating search is showing
}) {
  const [carrying, setCarrying] = useState(false) // a card is being dragged somewhere in the window
  const [over, setOver] = useState(false) // ...and is over the logo
  useEffect(() => {
    const start = (e: DragEvent) => e.dataTransfer?.types.includes(ITEMS_TYPE) && setCarrying(true)
    const end = () => {
      setCarrying(false)
      setOver(false)
    }
    window.addEventListener('dragstart', start)
    window.addEventListener('dragend', end)
    return () => {
      window.removeEventListener('dragstart', start)
      window.removeEventListener('dragend', end)
    }
  }, [])

  // while a card hovers, the orange tile hops clockwise round the logo; top-right at rest
  const [spot, setSpot] = useState(1)
  useEffect(() => {
    if (!over) return setSpot(1)
    const timer = setInterval(() => setSpot((s) => (s + 1) % 4), 160)
    return () => clearInterval(timer)
  }, [over])

  const carries = (e: React.DragEvent) => e.dataTransfer.types.includes(ITEMS_TYPE)

  return (
    <nav className="flex w-20 shrink-0 flex-col items-center pt-[50px] pb-10">
      {/* The app icon (build/icon.png), drawn so the dark tiles follow the theme, and the way into
          the archive. The top padding centres it on the big search line in App's header; it slides
          up with the floating search, in step with that bar's transition. */}
      <button
        onClick={onArchive}
        aria-label="Archive"
        aria-current={inArchive || undefined}
        onDragOver={(e) => {
          if (!carries(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!carries(e)) return
          e.preventDefault()
          setOver(false)
          const ids: unknown = JSON.parse(e.dataTransfer.getData(ITEMS_TYPE))
          if (Array.isArray(ids)) onDropItems(ids.filter(Number.isInteger))
        }}
        className={`group relative z-40 rounded-xl p-2 transition duration-200 ease-out ${pill ? '-translate-y-[34px]' : ''}`}
      >
        {/* the same pop-up label as the Trash's "Empty trash", in place of the system tooltip */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-full left-1/2 mt-0.5 -translate-x-1/2 -translate-y-1 rounded-full bg-card px-2 py-0.5 text-[11px] whitespace-nowrap text-fg opacity-0 shadow-lift transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
        >
          Press Here
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className={`pointer-events-none size-10 ${carrying && !over ? 'animate-pulse' : ''}`}
        >
          {/* clockwise from top-left; the dark tiles go light orange while the archive is open,
              and the orange one swells a touch under the mouse */}
          {[[2, 2], [13, 2], [13, 13], [2, 13]].map(([x, y], i) => (
            <rect
              key={i}
              x={x}
              y={y}
              width="9"
              height="9"
              rx="2.4"
              className={`origin-center transition-[fill,scale] duration-300 ease-out [transform-box:fill-box] ${
                i === spot ? 'fill-accent group-hover:scale-110' : inArchive ? 'fill-accent/35' : 'fill-fg'
              }`}
            />
          ))}
        </svg>
      </button>

      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          onClick={onTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className={BUTTON}
        >
          {theme === 'dark' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="12" cy="12" r="5" />
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i * Math.PI) / 4
                return <circle key={i} cx={12 + 8.6 * Math.cos(a)} cy={12 + 8.6 * Math.sin(a)} r="1.35" />
              })}
            </svg>
          )}
        </button>

        <button
          onClick={onDensity}
          aria-label={`Layout: ${density} cards. Click to change`}
          title={{ large: 'Large cards', medium: 'Medium cards', small: 'Small cards' }[density]}
          className={BUTTON}
        >
          <DensityIcon density={density} />
        </button>

        <button
          onClick={onTrash}
          aria-label="Trash"
          aria-current={inTrash || undefined}
          title="Trash"
          className={`p-2 transition-colors ${inTrash ? 'text-accent' : 'text-dim hover:text-fg'}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>

        <button onClick={onSettings} aria-label="Settings" title="Settings" className={BUTTON}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </nav>
  )
}
