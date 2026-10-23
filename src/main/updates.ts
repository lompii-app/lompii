import { app, BrowserWindow } from 'electron'
import { autoUpdater, NsisUpdater } from 'electron-updater'
import type { UpdateStatus } from '@shared/api'

// Updates come from the GitHub releases (publish in electron-builder.yml): checked at start and
// every few hours, downloaded in the background, installed on "Restart to update" or at the
// next quit. Only the installed app updates; a development run has nothing to replace.

const EVERY = 4 * 3_600_000

let status: UpdateStatus = {
  state: app.isPackaged ? 'idle' : 'dev',
  current: app.getVersion(),
  next: null,
  percent: 0,
  error: null
}

const set = (patch: Partial<UpdateStatus>) => {
  status = { ...status, ...patch }
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('update:changed', status)
}

export const updateStatus = (): UpdateStatus => status

export function checkForUpdates(): void {
  if (!['idle', 'latest', 'error'].includes(status.state)) return // dev, busy, or already waiting to restart
  autoUpdater.checkForUpdates().catch(() => {}) // the 'error' event reports it
}

export function installUpdate(): void {
  if (status.state === 'ready') autoUpdater.quitAndInstall(true, true) // silent, and open lompii again
}

export function startUpdates(): void {
  if (!app.isPackaged) return
  // lompii isn't code-signed, so there's no publisher to check the download against.
  // ponytail: skips the check outright; return a real check here once releases are signed.
  if (autoUpdater instanceof NsisUpdater) autoUpdater.verifyUpdateCodeSignature = async () => null
  autoUpdater.on('checking-for-update', () => set({ state: 'checking', error: null }))
  autoUpdater.on('update-not-available', () => set({ state: 'latest' }))
  autoUpdater.on('update-available', (info) => set({ state: 'downloading', next: info.version, percent: 0 }))
  autoUpdater.on('download-progress', (p) => set({ percent: p.percent }))
  autoUpdater.on('update-downloaded', (info) => set({ state: 'ready', next: info.version }))
  // its messages can carry a whole HTTP response; the first line says enough
  autoUpdater.on('error', (err) => set({ state: 'error', error: String(err?.message ?? err).split('\n')[0].slice(0, 200) }))
  checkForUpdates()
  setInterval(checkForUpdates, EVERY)
}
