import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { safeStorage } from 'electron'
import { DEFAULT_MODELS, KEYLESS, type AiProvider, type Settings } from '@shared/api'
import { DATA } from './db'
import { openAtLogin } from './tray'

// settings.json. The AI key is encrypted with the OS keychain (safeStorage) and never
// leaves the main process; the renderer only learns whether one is set.
type StoredProvider = { key: string; model: string; baseUrl: string } // key: sealed, '' for none
type Stored = {
  token?: string
  trayHintShown?: boolean
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
  return { token: s.token, ai: { active: s.ai?.active ?? null, providers }, openAtLogin: openAtLogin() }
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
