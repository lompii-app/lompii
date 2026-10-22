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
  inTrash
}: {
  theme: Theme
  onTheme: () => void
  density: Density
  onDensity: () => void
  onSettings: () => void
  onTrash: () => void
  inTrash: boolean
}) {
  return (
    <nav className="flex w-20 shrink-0 flex-col items-center py-10">
      {/* the app icon (build/icon.png), drawn so the dark tiles follow the theme */}
      <svg viewBox="0 0 24 24" role="img" aria-label="Tessera" className="size-8 text-fg">
        <title>Tessera</title>
        <rect x="2" y="2" width="9" height="9" rx="2.4" fill="currentColor" />
        <rect x="13" y="2" width="9" height="9" rx="2.4" className="fill-accent" />
        <rect x="2" y="13" width="9" height="9" rx="2.4" fill="currentColor" />
        <rect x="13" y="13" width="9" height="9" rx="2.4" fill="currentColor" />
      </svg>

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
