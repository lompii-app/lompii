import { extname, join, resolve, sep } from 'node:path'
import { copyFileSync, cpSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, clipboard, ClipboardItem, dialog, ipcMain, net, protocol, shell, type NativeImage } from 'electron'
import sharp from 'sharp'
import { isHttpUrl, isText, type Item, type PairRequest, type Stack, type WindowAction, type AiProvider } from '@shared/api'
import { addTags, DATA, db, deleteTag, removeTag, renameTag, tagCounts } from './db'
import { enqueue, enqueueUnanalysed, imagePrompt, listModels, resumeAnalysis, testProvider } from './ai'
import {
  allVectors,
  embeddingStatus,
  indexImages,
  indexText,
  searchImages,
  searchMeaning,
  sleepModels,
  textChanged,
  textVectors,
  wakeModels
} from './embed'
import { ingestBuffer, ingestFile } from './ingest'
import {
  archiveHasPassword,
  checkArchivePassword,
  firstClose,
  freeMemoryInTray,
  getSettings,
  resetToken,
  saveProvider,
  setActiveProvider,
  setArchivePassword,
  setFreeMemoryInTray
} from './settings'
import { createTray, setOpenAtLogin, setTrayIcon, startedHidden, trayHint } from './tray'
import { followTaskbarTheme } from './taskbarIcon'
import { jaccard, paletteSimilarity, relevance, rgb, visualSimilarity } from './scoring'
import { serve } from './server'
import { checkForUpdates, installUpdate, startUpdates, updateStatus } from './updates'
// bundled next to the main build; the window and taskbar use it (the .exe gets it from electron-builder)
import icon from '../../build/icon.png?asset'

protocol.registerSchemesAsPrivileged([
  { scheme: 'lompii', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

/* ---------- ipc ---------- */

const EDITABLE = ['source_url', 'title', 'note'] as const

// Archive lock: with a password set, archived items stay here, out of the window's list, the
// trash and single-item lookups, until the password is given. Leaving the archive, or the
// window hiding, locks it again.
let archiveOpen = false
const archiveHidden = () => archiveHasPassword() && !archiveOpen
const unlessHidden = () => (archiveHidden() ? ' and archived_at is null' : '')

ipcMain.handle('items:list', () =>
  db.prepare(`select * from items where deleted_at is null${unlessHidden()} order by created_at desc`).all()
)

// Six digits are few, so after 5 wrong tries in a row every further try waits 30 s.
let misses = 0
let waitUntil = 0
function tryPin(pin: unknown): 'ok' | 'wrong' | 'wait' {
  if (Date.now() < waitUntil) return 'wait'
  if (checkArchivePassword(pin)) {
    misses = 0
    return 'ok'
  }
  if (++misses >= 5) waitUntil = Date.now() + 30_000
  return 'wrong'
}

ipcMain.handle('archive:unlock', (_e, pin: string) => {
  const result = tryPin(pin)
  archiveOpen = result === 'ok'
  return result
})
ipcMain.handle('archive:lock', () => void (archiveOpen = false))
ipcMain.handle('settings:setArchivePassword', (_e, current: string, next: string) => {
  archiveOpen = false
  const result = tryPin(current)
  if (result !== 'ok') throw new Error(result === 'wait' ? 'wait' : 'wrong password')
  return setArchivePassword(current, next)
})

ipcMain.handle('items:tags', (_e, id: number) =>
  db
    .prepare(
      'select t.* from tags t join item_tags it on it.tag_id = t.id where it.item_id = ? order by t.dimension, t.value'
    )
    .all(id)
)

ipcMain.handle('items:update', (_e, id: number, patch: Record<string, string | null>) => {
  if (patch.source_url && !isHttpUrl(patch.source_url)) throw new Error('source_url must be http or https')
  for (const key of EDITABLE) {
    if (key in patch) db.prepare(`update items set ${key} = ? where id = ?`).run(patch[key] || null, id)
  }
  const item = db.prepare('select * from items where id = ?').get(id) as Item | undefined
  if (item) for (const w of BrowserWindow.getAllWindows()) w.webContents.send('item:updated', item)
  textChanged()
})

// every user tag in the library, for filtering in the renderer
ipcMain.handle('tags:index', () =>
  db
    .prepare(
      `select it.item_id as item, t.value from item_tags it
       join tags t on t.id = it.tag_id join items i on i.id = it.item_id
       where t.dimension = 'tag' and i.deleted_at is null`
    )
    .all()
)

/* stacks: made by the user, items added to them by hand */

const COLOR = /^#[0-9a-f]{6}$/i
const stackName = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, 50) : '')
const broadcastItem = (id: number) => {
  const item = db.prepare('select * from items where id = ?').get(id) as Item | undefined
  if (item) for (const w of BrowserWindow.getAllWindows()) w.webContents.send('item:updated', item)
  textChanged() // tags are part of an item's searchable text
}

ipcMain.handle('stacks:list', () =>
  (db.prepare('select id, name, color from stacks order by created_at').all() as Omit<Stack, 'items'>[]).map(
    (s) => ({
      ...s,
      items: db
        .prepare(
          `select si.item_id from stack_items si join items i on i.id = si.item_id
           where si.stack_id = ? and i.deleted_at is null and i.archived_at is null order by si.added_at desc`
        )
        .pluck()
        .all(s.id) as number[]
    })
  )
)

ipcMain.handle('stacks:create', (_e, name: string, color: string) => {
  const n = stackName(name)
  if (!n) throw new Error('stack needs a name')
  if (!COLOR.test(color)) throw new Error('bad stack colour')
  if (db.prepare('select 1 from stacks where name = ?').get(n)) throw new Error('stack exists')
  return Number(db.prepare('insert into stacks (name, color, created_at) values (?, ?, ?)').run(n, color, Date.now()).lastInsertRowid)
})

ipcMain.handle('stacks:update', (_e, id: number, patch: { name?: string; color?: string }) => {
  if (patch.color !== undefined) {
    if (!COLOR.test(patch.color)) throw new Error('bad stack colour')
    db.prepare('update stacks set color = ? where id = ?').run(patch.color, id)
  }
  if (patch.name !== undefined) {
    const n = stackName(patch.name)
    if (!n) throw new Error('stack needs a name')
    if (db.prepare('select 1 from stacks where name = ? and id != ?').get(n, id)) throw new Error('stack exists')
    db.prepare('update stacks set name = ? where id = ?').run(n, id)
  }
})

ipcMain.handle('stacks:delete', (_e, id: number) => db.prepare('delete from stacks where id = ?').run(id))

ipcMain.handle('stacks:setItem', (_e, stackId: number, itemId: number, member: boolean) => {
  if (member)
    db.prepare('insert or ignore into stack_items (stack_id, item_id, added_at) values (?, ?, ?)').run(stackId, itemId, Date.now())
  else db.prepare('delete from stack_items where stack_id = ? and item_id = ?').run(stackId, itemId)
})

ipcMain.handle('items:addTags', (_e, id: number, tags: string[]) => {
  addTags(id, Array.isArray(tags) ? tags : [])
  broadcastItem(id)
})

ipcMain.handle('items:removeTag', (_e, id: number, tag: string) => {
  removeTag(id, tag)
  broadcastItem(id)
})

ipcMain.handle('tags:counts', () => tagCounts())
ipcMain.handle('tags:rename', (_e, from: string, to: string) => {
  renameTag(from, to)
  textChanged()
})
ipcMain.handle('tags:delete', (_e, value: string) => {
  deleteTag(value)
  textChanged()
})

const byId = (id: number) => {
  const item = db.prepare('select * from items where id = ?').get(id) as Item | undefined
  return item?.archived_at && archiveHidden() ? undefined : item
}

const hex = (...rgb: number[]): string =>
  '#' + rgb.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')

// Up to four colours that each cover a lot of the image and differ visibly from one another.
// Pixels are bucketed at 4 bits a channel; each bucket reports its average colour.
async function extractPalette(thumb: string): Promise<string[]> {
  const data = await sharp(join(DATA, thumb)).resize(48, 48, { fit: 'inside' }).removeAlpha().raw().toBuffer()
  const buckets = new Map<number, [n: number, r: number, g: number, b: number]>()
  for (let i = 0; i < data.length; i += 3) {
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
    const c = buckets.get(key) ?? [0, 0, 0, 0]
    buckets.set(key, [c[0] + 1, c[1] + data[i], c[2] + data[i + 1], c[3] + data[i + 2]])
  }
  const picked: number[][] = []
  for (const [n, r, g, b] of [...buckets.values()].sort((a, z) => z[0] - a[0])) {
    const rgb = [r / n, g / n, b / n]
    if (picked.every((p) => Math.hypot(p[0] - rgb[0], p[1] - rgb[1], p[2] - rgb[2]) > 60)) picked.push(rgb)
    if (picked.length === 4) break
  }
  return picked.map((p) => hex(...p))
}

ipcMain.handle('items:palette', async (_e, id: number) => {
  const item = byId(id)
  if (!item || isText(item.kind)) return []
  if (item.palette) return JSON.parse(item.palette)
  const colors = await extractPalette(item.thumb_path)
  db.prepare('update items set palette = ? where id = ?').run(JSON.stringify(colors), id)
  return colors
})

/* same vibe (the scoring itself is in scoring.ts) */

// ponytail: scored against every item on each click (a dot product per image pair is cheap).
// Fine for tens of thousands; a vector index (sqlite-vec, HNSW) if the library outgrows that.
ipcMain.handle('items:similar', async (_e, id: number) => {
  // archived items never match, but one opened from the archive can still look for its likes
  const all = db
    .prepare('select * from items where deleted_at is null and (archived_at is null or id = ?)')
    .all(id) as Item[]
  const me = all.find((i) => i.id === id)
  if (!me) return []

  const tags = new Map<number, Set<string>>()
  for (const { item, value } of db
    .prepare('select it.item_id as item, t.value from item_tags it join tags t on t.id = it.tag_id')
    .all() as { item: number; value: string }[]) {
    tags.set(item, (tags.get(item) ?? new Set<string>()).add(value))
  }

  // palettes are otherwise made on first open; fill in the missing ones (48 px thumbs, quick)
  const palettes = new Map<number, number[][]>()
  for (const i of all) {
    if (isText(i.kind)) continue
    let colors: string[] = i.palette ? JSON.parse(i.palette) : []
    if (!i.palette) {
      try {
        colors = await extractPalette(i.thumb_path)
        db.prepare('update items set palette = ? where id = ?').run(JSON.stringify(colors), i.id)
      } catch {}
    }
    palettes.set(i.id, colors.map(rgb))
  }

  const vectors = allVectors()
  const mine = vectors.get(id)
  const meanings = textVectors()
  const myMeaning = meanings.get(id)
  const meaningSimilarity = (other: number) => {
    const theirs = meanings.get(other)
    if (!myMeaning || !theirs) return 0
    let dot = 0
    for (let i = 0; i < theirs.length; i++) dot += myMeaning[i] * theirs[i]
    return relevance(dot, 0.2, 0.7)
  }
  const scored = all
    .filter((i) => i.id !== id)
    .map((i) => {
      const tagScore = jaccard(tags.get(id), tags.get(i.id))
      const colour = paletteSimilarity(palettes.get(id) ?? [], palettes.get(i.id) ?? [])
      const theirs = vectors.get(i.id)
      const meaning = meaningSimilarity(i.id)
      return {
        id: i.id,
        // Two images: how they look leads, then what they're about. Text items: what they're
        // about. Mixed pairs, or not indexed yet: meaning, tags and colour.
        score:
          mine && theirs
            ? 0.55 * visualSimilarity(mine, theirs) + 0.25 * meaning + 0.1 * tagScore + 0.1 * colour
            : isText(me.kind) && isText(i.kind)
              ? 0.75 * meaning + 0.25 * tagScore
              : 0.45 * meaning + 0.35 * tagScore + 0.2 * colour
      }
    })
    .filter((s) => s.score >= 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
  return [id, ...scored.map((s) => s.id)]
})

ipcMain.handle('items:saveAs', async (e, id: number) => {
  const item = byId(id)
  if (!item) return false
  const ext = isText(item.kind) ? '.txt' : extname(item.file_path)
  const name = (item.title ?? 'lompii').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'lompii'
  const win = BrowserWindow.fromWebContents(e.sender)!
  const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: name + ext })
  if (canceled || !filePath) return false
  if (isText(item.kind)) writeFileSync(filePath, item.body ?? '')
  else copyFileSync(join(DATA, item.file_path), filePath)
  return true
})

ipcMain.handle('items:copy', async (_e, id: number) => {
  const item = byId(id)
  if (!item) return
  if (isText(item.kind)) return clipboard.writeText(item.body ?? '')
  // the clipboard takes PNG; library files can be JPEG or WebP, so convert
  const png = await sharp(join(DATA, item.file_path)).png().toBuffer()
  await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })])
})

ipcMain.handle('items:fileSize', (_e, id: number) => {
  const row = db.prepare('select file_path from items where id = ?').get(id) as
    | Pick<Item, 'file_path'>
    | undefined
  try {
    return row?.file_path ? statSync(join(DATA, row.file_path)).size : 0
  } catch {
    return 0
  }
})

// the window has no native controls; the renderer draws its own (WindowControls.tsx)
ipcMain.handle('window:control', (e, action: WindowAction) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (action === 'close') win?.close()
  else if (action === 'minimize') win?.minimize()
  else if (action === 'maximize') win?.isMaximized() ? win.unmaximize() : win?.maximize()
  else if (action === 'quit') quit()
})

ipcMain.handle('shell:openExternal', (_e, url: string) => {
  if (!isHttpUrl(url)) throw new Error('refusing to open non-http url')
  return shell.openExternal(url)
})

/* archive: out of the way, not deleted; items:list still sends them, the renderer splits them off */

ipcMain.handle('items:archive', (_e, ids: number[], on: boolean) => {
  const set = db.prepare('update items set archived_at = ? where id = ?')
  for (const id of (Array.isArray(ids) ? ids : []).filter(Number.isInteger)) set.run(on ? Date.now() : null, id)
})

/* trash: deleting is reversible for 30 days */

const TRASH_DAYS = 30

ipcMain.handle('items:remove', (_e, id: number) => {
  db.prepare('update items set deleted_at = ? where id = ? and deleted_at is null').run(Date.now(), id)
})

ipcMain.handle('items:restore', (_e, ids: number[] | 'all') => {
  if (ids === 'all') db.prepare('update items set deleted_at = null where deleted_at is not null').run()
  else if (Array.isArray(ids)) for (const id of ids) db.prepare('update items set deleted_at = null where id = ?').run(id)
  textChanged()
})

// a locked archive's trashed items stay out of sight (and out of Empty now); the 30 days still apply
ipcMain.handle('trash:count', () =>
  db.prepare(`select count(*) from items where deleted_at is not null${unlessHidden()}`).pluck().get()
)
ipcMain.handle('trash:list', () =>
  db.prepare(`select * from items where deleted_at is not null${unlessHidden()} order by deleted_at desc`).all()
)

// rows (tags, stack entries and vectors cascade) and their files, for good
function purge(where: string, ...args: unknown[]): number {
  const rows = db.prepare(`select id, file_path, thumb_path from items where ${where}`).all(...args) as Item[]
  for (const row of rows) {
    db.prepare('delete from items where id = ?').run(row.id)
    for (const p of [row.file_path, row.thumb_path]) if (p) rmSync(join(DATA, p), { force: true }) // text has no files
  }
  return rows.length
}

ipcMain.handle('trash:empty', () => void purge(`deleted_at is not null${unlessHidden()}`))
// chosen items, for good; only ever ones already in the trash
ipcMain.handle('trash:delete', (_e, ids: number[]) => {
  const list = (Array.isArray(ids) ? ids : []).filter(Number.isInteger)
  if (list.length) purge(`deleted_at is not null${unlessHidden()} and id in (${list.map(() => '?').join(', ')})`, ...list)
})

/* backup: a dated folder with a consistent copy of the database and every file */

ipcMain.handle('library:backup', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)!
  const pick = await dialog.showOpenDialog(win, {
    title: 'Back up lompii to…',
    properties: ['openDirectory', 'createDirectory']
  })
  if (pick.canceled || !pick.filePaths[0]) return null
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '.')
  const dest = join(pick.filePaths[0], `lompii backup ${stamp}`)
  mkdirSync(dest, { recursive: true })
  await db.backup(join(dest, 'lompii.db')) // SQLite's online backup: safe while the app is writing
  for (const dir of ['library', 'thumbs']) cpSync(join(DATA, dir), join(dest, dir), { recursive: true })
  void shell.openPath(dest)
  return dest
})

ipcMain.handle('ingest:paths', async (_e, paths: string[]) => {
  const added = await Promise.all(paths.map(ingestFile))
  return added.filter(Boolean).length
})
ipcMain.handle('ingest:buffer', (_e, data: ArrayBuffer) => ingestBuffer(data))

ipcMain.handle('settings:get', () => getSettings())
ipcMain.handle('settings:resetToken', () => resetToken())

// the folder Chrome's "Load unpacked" needs: shipped beside the app, or the repo's in development
const extensionDir = () => (app.isPackaged ? join(process.resourcesPath, 'extension') : join(app.getAppPath(), 'extension'))
ipcMain.handle('extension:folder', () => extensionDir())
ipcMain.handle('extension:show', () => shell.openPath(extensionDir()))
ipcMain.handle('settings:saveProvider', (_e, p: AiProvider, patch: Parameters<typeof saveProvider>[1]) => saveProvider(p, patch))
ipcMain.handle('settings:setActiveProvider', (_e, p: AiProvider | null) => setActiveProvider(p))
ipcMain.handle('settings:setOpenAtLogin', (_e, on: boolean) => {
  setOpenAtLogin(!!on)
  return getSettings()
})
ipcMain.handle('settings:setFreeMemoryInTray', (_e, on: boolean) => setFreeMemoryInTray(!!on))
ipcMain.handle('ai:analyse', (_e, id: number) => void enqueue(id))
ipcMain.handle('ai:analyseAll', () => enqueueUnanalysed())
ipcMain.handle('ai:test', (_e, p: AiProvider) => testProvider(p))
ipcMain.handle('ai:models', (_e, p: AiProvider) => listModels(p))
ipcMain.handle('ai:prompt', (_e, id: number) => imagePrompt(id))
ipcMain.handle('embeddings:status', () => embeddingStatus())
ipcMain.handle('update:status', () => updateStatus())
ipcMain.handle('update:check', () => checkForUpdates())
ipcMain.handle('update:install', () => installUpdate())

// Search by description: CLIP for how images look, MiniLM for what any item's words mean.
// Their raw scores live on different scales, so each maps onto 0-1 relevance first.
ipcMain.handle('search:semantic', async (_e, query: string) => {
  const q = typeof query === 'string' ? query.trim().slice(0, 300) : ''
  if (q.length < 3) return []
  const best = new Map<number, number>()
  const add = (hits: { id: number; score: number }[], low: number, high: number) => {
    for (const h of hits) best.set(h.id, Math.max(best.get(h.id) ?? 0, relevance(h.score, low, high)))
  }
  const [visual, meaning] = await Promise.allSettled([searchImages(q), searchMeaning(q)])
  if (visual.status === 'fulfilled') add(visual.value, 0.2, 0.32)
  if (meaning.status === 'fulfilled') add(meaning.value, 0.15, 0.65)
  for (const r of [visual, meaning])
    if (r.status === 'rejected') console.error('[lompii] semantic search failed', r.reason) // keyword search still works
  return [...best].map(([id, score]) => ({ id, score }))
})

/* ---------- window ---------- */

let win: BrowserWindow | null = null
// the logo in the taskbar's colours once drawn (taskbarIcon.ts); the file until then
let windowIcon: NativeImage | string = icon
let quitting = false

function show(): void {
  wakeModels() // catches up on whatever was saved while asleep in the tray
  if (!win) return createWindow(true)
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function createWindow(visible: boolean): void {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 720,
    show: false,
    backgroundColor: '#eef0f4',
    // No native title bar; the renderer draws a drag strip. Windows and Linux get the renderer's
    // own buttons too; macOS keeps its native ones, placed inside that 40 px strip.
    titleBarStyle: 'hidden',
    icon: windowIcon,
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 16, y: 13 } } : {}),
    autoHideMenuBar: true, // menu still answers its shortcuts (reload, devtools) and Alt
    webPreferences: { preload: join(__dirname, '../preload/index.js') }
  })
  if (visible) win.once('ready-to-show', () => win?.show())

  // closing hides to the tray, so the extension server and the AI queue keep running. With
  // "Free memory in the tray" the window really closes (its renderer and GPU processes are
  // most of the RAM) and the local models unload; show() brings both back.
  win.on('close', (e) => {
    if (quitting) return
    if (freeMemoryInTray()) sleepModels()
    else {
      e.preventDefault()
      win?.hide()
    }
    if (firstClose()) trayHint()
  })
  win.on('hide', () => (archiveOpen = false))
  win.on('closed', () => {
    win = null
    archiveOpen = false
  })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

// The extension asks to connect: bring lompii forward, even from the tray, and let the person
// compare the code the extension shows with this one before allowing it. The window draws the
// question itself (Dialogs.tsx); the request waits here, since the window may still be loading.
// ponytail: one request at a time; a newer one declines the older. Queue them if that bites.
let pairing: (PairRequest & { answer: (ok: boolean) => void }) | null = null
let pairSeq = 0
const pairChanged = () => win?.webContents.send('pair:changed')

function askToPair(code: string, extensionId: string, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false)
  show()
  pairing?.answer(false)
  return new Promise((resolve) => {
    const id = ++pairSeq
    const answer = (ok: boolean) => {
      if (pairing?.id !== id) return
      pairing = null
      signal.removeEventListener('abort', onAbort)
      pairChanged()
      resolve(ok)
    }
    const onAbort = () => answer(false) // the extension gave up waiting
    pairing = { id, code, extensionId, answer }
    signal.addEventListener('abort', onAbort)
    pairChanged()
  })
}

ipcMain.handle('pair:get', (): PairRequest | null =>
  pairing && { id: pairing.id, code: pairing.code, extensionId: pairing.extensionId }
)
ipcMain.handle('pair:answer', (_e, id: number, ok: boolean) => {
  if (pairing?.id === id) pairing.answer(ok)
})

function quit(): void {
  quitting = true
  app.quit()
}

// One lompii at a time: a second copy would fight over the database and port 47821.
// Launching it again just brings the running one forward.
// Windows groups taskbar buttons (and pins) by this id; without it, dev runs count as Electron
if (process.platform === 'win32') app.setAppUserModelId('com.lompii.app')

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', show)
  app.on('before-quit', () => (quitting = true))

  app.whenReady().then(() => {
    // lompii://library/<hash>.png  ->  <userData>/library/<hash>.png
    protocol.handle('lompii', (req) => {
      const { host, pathname } = new URL(req.url)
      const file = resolve(DATA, host + decodeURIComponent(pathname))
      if (file !== DATA && !file.startsWith(DATA + sep)) return new Response(null, { status: 403 })
      return net.fetch(pathToFileURL(file).toString())
    })

    console.log(
      '[lompii] db v%d, %d items',
      db.pragma('user_version', { simple: true }),
      (db.prepare('select count(*) as n from items').get() as { n: number }).n
    )

    const purged = purge('deleted_at < ?', Date.now() - TRASH_DAYS * 86_400_000)
    if (purged) console.log('[lompii] emptied %d item(s) from the trash', purged)

    serve(askToPair)
    resumeAnalysis()
    const lean = startedHidden() && freeMemoryInTray() // started at login: no window, no models yet
    if (lean) sleepModels()
    void indexImages() // backfill same-vibe vectors; downloads the model on first run
    void indexText() // and the text-meaning vectors (another small model, ~23 MB)
    createTray(show, quit)
    followTaskbarTheme((w, t) => {
      windowIcon = w
      win?.setIcon(w)
      setTrayIcon(t)
    })
    if (!lean) createWindow(!startedHidden())
    startUpdates()
    app.on('activate', show)
  })
}

// the tray keeps the app alive; quitting goes through quit()
app.on('window-all-closed', () => {})
