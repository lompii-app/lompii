import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { safeStorage } from 'electron'
import { DEFAULT_MODELS, type AiProvider, type Settings } from '@shared/api'
import { DATA } from './db'
import { openAtLogin } from './tray'

// settings.json. The AI key is encrypted with the OS keychain (safeStorage) and never
// leaves the main process; the renderer only learns whether one is set.
type Stored = {
  token?: string
  trayHintShown?: boolean
  ai?: { provider: AiProvider; model: string; baseUrl: string; key: string }
}

const FILE = join(DATA, 'settings.json')

function read(): Stored {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
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
  const ai = s.ai && { provider: s.ai.provider, model: s.ai.model, baseUrl: s.ai.baseUrl, hasKey: !!s.ai.key }
  return { token: s.token, ai: ai ?? null, openAtLogin: openAtLogin() }
}

// true only the first time the window is closed, for the "still running in the tray" note
export function firstClose(): boolean {
  const s = read()
  if (s.trayHintShown) return false
  write({ ...s, trayHintShown: true })
  return true
}

export type AiConfig = { provider: AiProvider; model: string; baseUrl: string; key: string }

// null when no key is saved
export function aiConfig(): AiConfig | null {
  const ai = read().ai
  if (!ai?.key) return null
  const key = safeStorage.isEncryptionAvailable()
    ? safeStorage.decryptString(Buffer.from(ai.key, 'base64'))
    : Buffer.from(ai.key, 'base64').toString('utf8')
  return { ...ai, key }
}

// key: a new key to store; '' removes it; undefined keeps the saved one
export function setAi(patch: { provider: AiProvider; model: string; baseUrl: string; key?: string }): Settings {
  const s = read()
  const key =
    patch.key === undefined
      ? (s.ai?.key ?? '')
      : patch.key.trim()
        ? (safeStorage.isEncryptionAvailable()
            ? safeStorage.encryptString(patch.key.trim())
            : Buffer.from(patch.key.trim())
          ).toString('base64')
        : ''
  s.ai = {
    provider: patch.provider,
    model: patch.model.trim() || DEFAULT_MODELS[patch.provider],
    baseUrl: patch.baseUrl.trim(),
    key
  }
  write(s)
  return getSettings()
}
