import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { BrowserWindow } from 'electron'
import { EXTENSION_PORT, isHttpUrl, type Item } from '@shared/api'
import { addTags, db } from './db'
import { ingestBuffer, ingestText } from './ingest'
import { getSettings } from './settings'

// Endpoints for the browser extension. Bound to 127.0.0.1 and gated by a key, so a web
// page that guesses the port still cannot write to the library.
//   GET  /ping
//   POST /image?source=&title=&kind=   body: image bytes; kind is image (default) or capture
//   POST /text                         body: { text, source, title }; becomes a quote or snippet
//   POST /items/:id/tags         body: { tags: string[] }

const MAX_BODY = 50 * 1024 * 1024
const MAX_TEXT = 10_000

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

async function body(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > MAX_BODY) throw new HttpError(413, 'too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function json(req: IncomingMessage): Promise<Record<string, unknown>> {
  try {
    return JSON.parse((await body(req)).toString('utf8'))
  } catch (e) {
    throw e instanceof HttpError ? e : new HttpError(400, 'invalid json')
  }
}

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

const meta = (source: unknown, title: unknown) => {
  const s = str(source, 2048)
  return { source: s && isHttpUrl(s) ? s : null, title: str(title, 300) }
}

function authorized(req: IncomingMessage, token: string): boolean {
  const got = Buffer.from(req.headers.authorization ?? '')
  const want = Buffer.from(`Bearer ${token}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

async function route(req: IncomingMessage): Promise<unknown> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')

  if (req.method === 'GET' && url.pathname === '/ping') return { ok: true }

  if (req.method === 'POST' && url.pathname === '/image') {
    const item = await ingestBuffer(await body(req), {
      ...meta(url.searchParams.get('source'), url.searchParams.get('title')),
      kind: url.searchParams.get('kind') === 'capture' ? 'capture' : 'image'
    })
    if (!item) throw new HttpError(415, 'not an image')
    return { id: item.id }
  }

  if (req.method === 'POST' && url.pathname === '/text') {
    const b = await json(req)
    const text = str(b.text, MAX_TEXT)
    if (!text) throw new HttpError(400, 'empty text')
    return { id: ingestText(text, meta(b.source, b.title)).id }
  }

  const tagsPath = url.pathname.match(/^\/items\/(\d+)\/tags$/)
  if (req.method === 'POST' && tagsPath) {
    const id = Number(tagsPath[1])
    const b = await json(req)
    const item = db.prepare('select * from items where id = ?').get(id) as Item | undefined
    if (!item) throw new HttpError(404, 'no such item')
    addTags(id, Array.isArray(b.tags) ? b.tags : [])
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('item:updated', item)
    return { ok: true }
  }

  throw new HttpError(404, 'not found')
}

export function serve(): void {
  const { token } = getSettings()
  createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, data: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(data))
    }
    if (!authorized(req, token)) return send(401, { error: 'bad key' })
    try {
      send(200, await route(req))
    } catch (e) {
      if (e instanceof HttpError) send(e.status, { error: e.message })
      else {
        console.error('[tessera] extension request failed', e)
        send(500, { error: 'internal' })
      }
    }
  })
    .on('error', (e) => console.error('[tessera] extension server:', e.message))
    .listen(EXTENSION_PORT, '127.0.0.1', () =>
      console.log('[tessera] extension server on 127.0.0.1:%d', EXTENSION_PORT)
    )
}
