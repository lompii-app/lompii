import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { BrowserWindow } from 'electron'
import sharp from 'sharp'
import { textKind, type Item } from '@shared/api'
import { enqueue } from './ai'
import { indexImages, textChanged } from './embed'
import { DATA, db } from './db'

const IMAGE = /\.(png|jpe?g|webp|gif|avif|bmp|tiff?)$/i
mkdirSync(join(DATA, 'library'), { recursive: true })
mkdirSync(join(DATA, 'thumbs'), { recursive: true })

/* ---------- ingest ---------- */

const insert = db.prepare(`insert or ignore into items
  (file_path, thumb_path, hash, width, height, dominant_color, source_url, title, created_at, status, kind, body)
  values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)

const byHash = (hash: string): Item | undefined =>
  db.prepare('select * from items where hash = ?').get(hash) as Item | undefined

function added(id: number | bigint): Item {
  const item = db.prepare('select * from items where id = ?').get(id) as Item
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('item:added', item)
  enqueue(item.id) // AI analysis, when a key is set
  if (item.kind === 'image' || item.kind === 'capture') void indexImages() // same-vibe vector
  textChanged() // and its words, for search by meaning
  return item
}

type Meta = { title?: string | null; source?: string | null; kind?: 'image' | 'capture' }

// A save that matches an item in the trash restores it rather than doing nothing.
function revive(item: Item): Item {
  if (item.deleted_at == null) return item
  db.prepare('update items set deleted_at = null where id = ?').run(item.id)
  const back = db.prepare('select * from items where id = ?').get(item.id) as Item
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('item:added', back)
  return back
}

const hex = (...rgb: number[]): string =>
  '#' + rgb.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')

// Returns the stored item — the existing one if this exact file was saved before.
async function ingest(
  buf: Buffer,
  createdAt: number,
  { title = null, source = null, kind = 'image' }: Meta
): Promise<Item | null> {
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 32)
  const existing = byHash(hash)
  if (existing) return revive(existing)

  const [meta, stats] = await Promise.all([sharp(buf).metadata(), sharp(buf).stats()])
  if (!meta.width || !meta.height) return null

  const file_path = `library/${hash}.${meta.format === 'jpeg' ? 'jpg' : (meta.format ?? 'png')}`
  const thumb_path = `thumbs/${hash}.webp`

  writeFileSync(join(DATA, file_path), buf)
  await sharp(buf)
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(join(DATA, thumb_path))

  const { r, g, b } = stats.dominant
  const info = insert.run(
    file_path,
    thumb_path,
    hash,
    meta.width,
    meta.height,
    hex(r, g, b),
    source,
    title,
    createdAt,
    kind,
    null
  )
  return info.changes ? added(info.lastInsertRowid) : (byHash(hash) ?? null) // lost a dedupe race
}

// Quotes are stored without their outer quote marks; the cards draw their own.
const unwrap = (t: string): string => t.replace(/^["“„«]\s*([^]*?)\s*["”»]$/, '$1')

export function ingestText(text: string, meta: Meta): Item {
  // the hash keeps its old 'quote:' prefix so text saved before snippets existed still dedupes
  const hash = createHash('sha256').update('quote:' + text).digest('hex').slice(0, 32)
  const existing = byHash(hash)
  if (existing) return revive(existing)
  const kind = textKind(text)
  const body = kind === 'quote' ? unwrap(text) : text
  const info = insert.run('', '', hash, 0, 0, '#ffffff', meta.source ?? null, meta.title ?? null, Date.now(), kind, body)
  return info.changes ? added(info.lastInsertRowid) : byHash(hash)!
}

export async function ingestFile(path: string): Promise<Item | null> {
  if (!IMAGE.test(path)) return null
  try {
    return await ingest(readFileSync(path), Math.round(statSync(path).mtimeMs), {
      title: basename(path, extname(path))
    })
  } catch (e) {
    console.error('[tessera] ingest failed:', path, e)
    return null
  }
}

export async function ingestBuffer(data: ArrayBuffer | Buffer, meta: Meta = {}): Promise<Item | null> {
  try {
    return await ingest(Buffer.isBuffer(data) ? data : Buffer.from(data), Date.now(), meta)
  } catch (e) {
    console.error('[tessera] ingest failed: buffer', e)
    return null
  }
}
