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
  const saved = get('tessera.theme')
  if (saved === 'light' || saved === 'dark') return saved
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

export function saveTheme(theme: Theme): void {
  set('tessera.theme', theme)
  applyTheme(theme)
}

export const loadDensity = (): Density => {
  const saved = get('tessera.density')
  return saved === 'large' || saved === 'small' ? saved : 'medium'
}

export const saveDensity = (density: Density) => set('tessera.density', density)

export const NEXT_DENSITY: Record<Density, Density> = { large: 'medium', medium: 'small', small: 'large' }
