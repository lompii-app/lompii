// Per-viewer display choices, kept in localStorage. Reads and writes are guarded: storage can
// be unavailable, and the app must still render with the defaults.

export type Theme = 'light' | 'dark'
export type Density = 'large' | 'medium' | 'small' // cards per row: fewer, the default, more

const get = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const set = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

// an explicit choice wins; otherwise follow the system
export const loadTheme = (): Theme => {
  const saved = get('lompii.theme')
  if (saved === 'light' || saved === 'dark') return saved
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

export function saveTheme(theme: Theme): void {
  set('lompii.theme', theme)
  applyTheme(theme)
}

export const loadDensity = (): Density => {
  const saved = get('lompii.density')
  return saved === 'large' || saved === 'small' ? saved : 'medium'
}

export const saveDensity = (density: Density) => set('lompii.density', density)

// Asking for a star on GitHub: the plan screen on first start, then the toast. 'done' once
// answered for good, else the time "later" was chosen; null if never asked.
export const loadStarAsk = () => get('lompii.star')
export const saveStarAsk = (value: string) => set('lompii.star', value)

// the founder's welcome note, shown once on the first start, before the plan screen
export const loadWelcomed = () => get('lompii.welcomed') === '1'
export const saveWelcomed = () => set('lompii.welcomed', '1')

export const NEXT_DENSITY: Record<Density, Density> = { large: 'medium', medium: 'small', small: 'large' }
