import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { BrowserWindow } from 'electron'
import sharp from 'sharp'
import { isText, type Item } from '@shared/api'
import { addTags, DATA, db } from './db'
import { aiConfig, type AiConfig } from './settings'

// One model call per item: title, TLDR, search tags and any visible text. Runs in the
// background, two at a time; the item's status drives the overlay's loading state.

type Result = { title: string; tldr: string; tags: string[]; text: string }

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    tldr: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    text: { type: 'string' }
  },
  required: ['title', 'tldr', 'tags', 'text'],
  additionalProperties: false
} as const

// the kinds are shown on their own; as tags they'd only add noise
const KIND_WORDS = new Set(['image', 'images', 'picture', 'photo of', 'screenshot', 'capture', 'quote', 'quotes', 'snippet', 'text'])

function prompt(item: Item): string {
  const what = { image: 'an image', capture: 'a screenshot of a web page', quote: 'a quote', snippet: 'a text snippet' }[item.kind]
  let from = ''
  if (item.source_url) {
    try {
      from = ` It was saved from ${new URL(item.source_url).hostname}${item.title ? ` (page: "${item.title}")` : ''}.`
    } catch {}
  }
  const body = isText(item.kind) ? `\n\nThe ${item.kind}:\n"""\n${item.body}\n"""` : ''
  return `You catalogue references in a designer's personal library so they can find them again later by searching. This is ${what}.${from}${body}

Return:
- title: a short descriptive title, 3 to 8 words, sentence case. Say what it is, not where it came from.
- tldr: one or two plain sentences on what it shows and what is notable about it.
- tags: 6 to 12 lowercase search terms someone might type to find this again: subject, visual style, mood, colours, medium, and layout or typography where they matter. Single words or short phrases. Not generic words like image, screenshot, quote or snippet.
- text: legible text that appears in the image, verbatim, up to about 300 words. Empty for text-only items or when there is none.`
}

// JPEG, long side at most 1568 px. Full-page captures keep their top, at a readable width.
async function imageData(item: Item): Promise<string> {
  const tall = item.height / item.width > 2
  const img = sharp(join(DATA, item.file_path)).rotate()
  const resized = tall
    ? img.resize({ width: 1024, height: 2048, fit: 'cover', position: 'top' })
    : img.resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true })
  return (await resized.flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer()).toString('base64')
}

/* ---------- providers ---------- */

async function viaAnthropic(cfg: AiConfig, text: string, image: string | null): Promise<string> {
  const client = new Anthropic({ apiKey: cfg.key })
  const opus5 = /^claude-(opus-5|fable-5)/.test(cfg.model)
  const res = await client.beta.messages.create({
    model: cfg.model,
    max_tokens: 4000,
    // server-side refusal fallback; "default" lets the API pick the substitute model
    ...(opus5 ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    output_config: {
      format: { type: 'json_schema', schema: SCHEMA },
      // a short cataloguing task; lower effort keeps it quick and cheap where supported
      ...(/^claude-(opus-5|opus-4-[678]|fable|sonnet-5)/.test(cfg.model) ? { effort: 'low' as const } : {})
    },
    messages: [
      {
        role: 'user',
        content: [
          ...(image ? [{ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: image } }] : []),
          { type: 'text', text }
        ]
      }
    ]
  })
  if (res.stop_reason === 'refusal') throw new Error('The model declined to describe this item.')
  if (res.stop_reason === 'max_tokens') throw new Error('The model ran out of room before finishing.')
  const block = res.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('The model returned no text.')
  return block.text
}

async function apiError(res: Response): Promise<Error> {
  const body = await res.text()
  let message = body.slice(0, 200)
  try {
    const j = JSON.parse(body)
    message = j.error?.message ?? j.error ?? j.message ?? message
  } catch {}
  return new Error(`${res.status}: ${message}`)
}

const OPENAI_BASE: Partial<Record<AiConfig['provider'], string>> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1'
}

async function viaOpenAICompatible(cfg: AiConfig, text: string, image: string | null): Promise<string> {
  const base = (OPENAI_BASE[cfg.provider] ?? cfg.baseUrl).replace(/\/+$/, '')
  if (!base) throw new Error('Set a base URL for this provider in Settings.')
  // local and lesser-known servers often reject json_schema; they get the instruction instead
  const strict = cfg.provider !== 'custom'
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: strict ? text : `${text}\n\nReply with only a JSON object with the keys title, tldr, tags and text.` },
            ...(image ? [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } }] : [])
          ]
        }
      ],
      ...(strict ? { response_format: { type: 'json_schema', json_schema: { name: 'catalogue', strict: true, schema: SCHEMA } } } : {})
    })
  })
  if (!res.ok) throw await apiError(res)
  const data = await res.json()
  const out = data.choices?.[0]?.message?.content
  if (typeof out !== 'string') throw new Error('The model returned no text.')
  return out
}

async function viaGemini(cfg: AiConfig, text: string, image: string | null): Promise<string> {
  const { additionalProperties: _, ...schema } = SCHEMA // Gemini's schema dialect has no additionalProperties
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.key },
      body: JSON.stringify({
        contents: [
          { parts: [{ text }, ...(image ? [{ inline_data: { mime_type: 'image/jpeg', data: image } }] : [])] }
        ],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema }
      })
    }
  )
  if (!res.ok) throw await apiError(res)
  const data = await res.json()
  const out = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('')
  if (!out) throw new Error(data.promptFeedback?.blockReason ? `Blocked: ${data.promptFeedback.blockReason}` : 'The model returned no text.')
  return out
}

// Models sometimes wrap JSON in prose or a code fence; take the outermost object.
function parse(raw: string): Result {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('The model did not return JSON.')
  const j = JSON.parse(raw.slice(start, end + 1))
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  return {
    title: str(j.title, 120),
    tldr: str(j.tldr, 600),
    tags: (Array.isArray(j.tags) ? j.tags : [])
      .map((t: unknown) => str(t, 50).toLowerCase())
      .filter((t: string) => t && !KIND_WORDS.has(t))
      .slice(0, 12),
    text: str(j.text, 3000)
  }
}

/* ---------- queue ---------- */

const MAX_RUNNING = 2
const queue: number[] = []
let running = 0

const byId = (id: number) => db.prepare('select * from items where id = ?').get(id) as Item | undefined

function broadcast(id: number) {
  const item = byId(id)
  if (item) for (const w of BrowserWindow.getAllWindows()) w.webContents.send('item:updated', item)
}

async function analyse(id: number): Promise<void> {
  const cfg = aiConfig()
  const item = byId(id)
  if (!item) return
  if (!cfg) {
    db.prepare(`update items set status = 'pending' where id = ?`).run(id)
    return broadcast(id)
  }
  try {
    const text = prompt(item)
    const image = isText(item.kind) ? null : await imageData(item)
    const call = cfg.provider === 'anthropic' ? viaAnthropic : cfg.provider === 'gemini' ? viaGemini : viaOpenAICompatible
    const r = parse(await call(cfg, text, image))
    db.prepare(
      `update items set title = coalesce(nullif(?, ''), title), tldr = ?, visible_text = ?,
       status = 'tagged', ai_error = null where id = ?`
    ).run(r.title, r.tldr || null, r.text || null, id)
    addTags(id, r.tags)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[tessera] analysis failed', id, message)
    db.prepare(`update items set status = 'failed', ai_error = ? where id = ?`).run(message.slice(0, 300), id)
  }
  broadcast(id)
}

function pump() {
  while (running < MAX_RUNNING && queue.length) {
    const id = queue.shift()!
    running++
    analyse(id).finally(() => {
      running--
      pump()
    })
  }
}

// Queues an item if an AI key is set. Marks it analysing at once, so the overlay shows it.
export function enqueue(id: number): boolean {
  if (!aiConfig()) return false
  if (!queue.includes(id)) queue.push(id)
  db.prepare(`update items set status = 'analysing', ai_error = null where id = ?`).run(id)
  broadcast(id)
  pump()
  return true
}

export function enqueueUnanalysed(): number {
  if (!aiConfig()) return 0
  const ids = db.prepare(`select id from items where status in ('pending', 'failed') order by created_at desc`).pluck().all() as number[]
  ids.forEach(enqueue)
  return ids.length
}

// Items that were mid-analysis when the app last closed go back in the queue.
export function resumeAnalysis(): void {
  const ids = db.prepare(`select id from items where status = 'analysing'`).pluck().all() as number[]
  db.prepare(`update items set status = 'pending' where status = 'analysing'`).run()
  if (aiConfig()) ids.forEach(enqueue)
}
