import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { safeStorage } from 'electron'
import { DEFAULT_MODELS, IMPORT_ANALYSIS, KEYLESS, type AiProvider, type ImportAnalysis, type Settings } from '@shared/api'
import { DATA } from './db'
import { isPin, passwordMatches, sealPassword } from './password'
import { openAtLogin } from './tray'

// settings.json. The AI key is encrypted with the OS keychain (safeStorage) and never
// leaves the main process; the renderer only learns whether one is set.
type StoredProvider = { key: string; model: string; baseUrl: string } // key: sealed, '' for none
type Stored = {
  token?: string
  trayHintShown?: boolean
  extensionConnected?: boolean // a browser has connected since the key was last replaced
  freeMemoryInTray?: boolean // closing the window closes it for real and unloads the local models
  archivePassword?: string // 'salt:hash' in hex (scrypt); the password itself is never stored
  analyseImports?: ImportAnalysis // a folder import's new images analysed straight away; 25 if unset
  ai?: { active: AiProvider | null; providers: Partial<Record<AiProvider, StoredProvider>> }
}

const FILE = join(DATA, 'settings.json')

function read(): Stored {
  try {
    const s = JSON.parse(readFileSync(FILE, 'utf8'))
    // settings.json once held a single provider: { provider, model, baseUrl, key }
    if (s.ai && 'provider' in s.ai) {
      const { provider, ...saved } = s.ai
      s.ai = { active: saved.key ? provider : null, providers: { [provider]: saved } }
    }
    return s
  } catch {
    return {}
  }
}

const write = (s: Stored) => writeFileSync(FILE, JSON.stringify(s, null, 2))

export function getSettings(): Settings {
  const s = read()
  if (!s.token) {
    // key the browser extension must present; made once, on first run
    s.token = randomBytes(16).toString('hex')
    write(s)
  }
  const providers: Settings['ai']['providers'] = {}
  for (const [p, sp] of Object.entries(s.ai?.providers ?? {}))
    providers[p as AiProvider] = { model: sp.model, baseUrl: sp.baseUrl, hasKey: !!sp.key }
  return {
    token: s.token,
    ai: { active: s.ai?.active ?? null, providers },
    openAtLogin: openAtLogin(),
    extensionConnected: !!s.extensionConnected,
    freeMemoryInTray: !!s.freeMemoryInTray,
    archiveLocked: !!s.archivePassword,
    analyseImports: s.analyseImports ?? 25
  }
}

/* the archive's password: an in-app lock, not encryption (the files stay as they are) */

export const archiveHasPassword = (): boolean => !!read().archivePassword

// true when it matches, or when no password is set
export function checkArchivePassword(pw: unknown): boolean {
  const stored = read().archivePassword
  return !stored || passwordMatches(pw, stored)
}

// next: the new six-digit PIN, or '' to remove the lock; current must match the one set
export function setArchivePassword(current: unknown, next: unknown): Settings {
  if (!checkArchivePassword(current)) throw new Error('wrong password')
  if (next !== '' && !isPin(next)) throw new Error('the PIN must be six digits')
  const { archivePassword: _, ...s } = read()
  write(isPin(next) ? { ...s, archivePassword: sealPassword(next) } : s)
  return getSettings()
}

export const freeMemoryInTray = (): boolean => !!read().freeMemoryInTray

export function setFreeMemoryInTray(on: boolean): Settings {
  write({ ...read(), freeMemoryInTray: on })
  return getSettings()
}

export const analyseImports = (): ImportAnalysis => read().analyseImports ?? 25

export function setAnalyseImports(n: ImportAnalysis): Settings {
  if (IMPORT_ANALYSIS.includes(n)) write({ ...read(), analyseImports: n })
  return getSettings()
}

// a fresh extension key; every paired browser has to connect again
export function resetToken(): Settings {
  write({ ...read(), token: randomBytes(16).toString('hex'), extensionConnected: false })
  return getSettings()
}

// a browser paired, or used its key: the "connect your browser" reminder can go
export function markConnected(): void {
  const s = read()
  if (!s.extensionConnected) write({ ...s, extensionConnected: true })
}

// true only the first time the window is closed, for the "still running in the tray" note
export function firstClose(): boolean {
  const s = read()
  if (s.trayHintShown) return false
  write({ ...s, trayHintShown: true })
  return true
}

export type AiConfig = { provider: AiProvider; model: string; baseUrl: string; key: string }

const seal = (key: string): string =>
  key
    ? (safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(key) : Buffer.from(key)).toString('base64')
    : ''
const unseal = (sealed: string): string =>
  !sealed
    ? ''
    : safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(sealed, 'base64'))
      : Buffer.from(sealed, 'base64').toString('utf8')

// ready to answer: a model (unless only listing them), and a key unless it runs locally;
// a custom server also needs its address
const usable = (p: AiProvider, sp: StoredProvider | undefined, needModel = true): sp is StoredProvider =>
  !!sp && (!needModel || !!sp.model) && (KEYLESS.has(p) ? p !== 'custom' || !!sp.baseUrl : !!sp.key)

// null when that provider isn't set up yet
export function providerConfig(p: AiProvider, needModel = true): AiConfig | null {
  const sp = read().ai?.providers[p] ?? (p === 'ollama' ? { key: '', model: '', baseUrl: '' } : undefined)
  return usable(p, sp, needModel) ? { provider: p, model: sp.model, baseUrl: sp.baseUrl, key: unseal(sp.key) } : null
}

// the active provider's settings; null when AI is off
export function aiConfig(): AiConfig | null {
  const active = read().ai?.active
  return active ? providerConfig(active) : null
}

// key: a new key to store; '' removes it; undefined keeps the saved one
export function saveProvider(p: AiProvider, patch: { key?: string; model?: string; baseUrl?: string }): Settings {
  const s = read()
  const ai = s.ai ?? { active: null, providers: {} }
  const cur = ai.providers[p] ?? { key: '', model: DEFAULT_MODELS[p], baseUrl: '' }
  const next = {
    key: patch.key === undefined ? cur.key : seal(patch.key.trim()),
    model: patch.model?.trim() || cur.model,
    baseUrl: patch.baseUrl === undefined ? cur.baseUrl : patch.baseUrl.trim()
  }
  ai.providers[p] = next
  if (!ai.active && usable(p, next)) ai.active = p // the first provider set up starts answering
  if (ai.active === p && !usable(p, next)) ai.active = null
  write({ ...s, ai })
  return getSettings()
}

export function setActiveProvider(p: AiProvider | null): Settings {
  const s = read()
  const ai = s.ai ?? { active: null, providers: {} }
  if (p === null || usable(p, ai.providers[p])) write({ ...s, ai: { ...ai, active: p } })
  return getSettings()
}
