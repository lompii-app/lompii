import { join } from 'node:path'
import { createHash } from 'node:crypto'
import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
  pipeline
} from '@huggingface/transformers'
import type { EmbeddingStatus, Item } from '@shared/api'
import { DATA, db } from './db'

// Image embeddings for "same vibe": CLIP ViT-B/32 (quantised, ~90 MB), run locally with
// onnxruntime. Downloaded from Hugging Face on first use into userData/models, offline after.
// Each image's 512-number vector is stored normalised, so similarity is a dot product.

const MODEL = 'Xenova/clip-vit-base-patch32'
env.cacheDir = join(DATA, 'models')

type Clip = {
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>
  vision: Awaited<ReturnType<typeof CLIPVisionModelWithProjection.from_pretrained>>
}
let clip: Promise<Clip> | null = null
const load = (): Promise<Clip> =>
  (clip ??= Promise.all([
    AutoProcessor.from_pretrained(MODEL),
    CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: 'q8' })
  ])
    .then(([processor, vision]) => ({ processor, vision }))
    .catch((e) => {
      clip = null // let a later run try the download again
      throw e
    }))

async function embed(item: Item): Promise<Float32Array> {
  const { processor, vision } = await load()
  // the 480 px thumbnail is plenty: CLIP looks at 224 px
  const { image_embeds } = await vision(await processor(await RawImage.read(join(DATA, item.thumb_path))))
  const v = image_embeds.data as Float32Array
  const norm = Math.hypot(...v)
  return Float32Array.from(v, (x) => x / norm)
}

// SQLite hands blobs back as Buffers that may sit at any byte offset; copy before viewing
export const toVector = (blob: Buffer): Float32Array => new Float32Array(new Uint8Array(blob).buffer)

/* ---------- background indexing ---------- */

const save = db.prepare('insert or replace into embeddings (item_id, vector) values (?, ?)')
const missing = db.prepare(
  `select * from items where kind in ('image', 'capture') and deleted_at is null
   and id not in (select item_id from embeddings) order by created_at desc`
)

let state: EmbeddingStatus['state'] = 'idle'
let error: string | null = null
let running = false

// One image at a time, newest first, until none are left. Safe to call repeatedly.
export async function indexImages(): Promise<void> {
  if (running || asleep) return
  running = true
  let count = 0
  try {
    for (let item = missing.get() as Item | undefined; item; item = missing.get() as Item | undefined) {
      if (asleep) break
      if (state !== 'ready') state = 'loading'
      try {
        const vector = await embed(item)
        // the item may have been deleted while its vector was being computed
        if (db.prepare('select 1 from items where id = ?').get(item.id)) save.run(item.id, Buffer.from(vector.buffer))
        state = 'ready'
        error = null
        count++
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
        console.error('[tessera] embedding failed', item.id, error)
        // a model that won't load fails every item the same way; stop and retry next launch
        if (state !== 'ready') return void (state = 'failed')
        save.run(item.id, Buffer.alloc(0)) // a broken file: mark it so it isn't retried forever
      }
    }
  } finally {
    running = false
    if (count) console.log('[tessera] indexed %d image(s) for same vibe', count)
    if (asleep && !textRunning) void unload()
  }
}

export function embeddingStatus(): EmbeddingStatus {
  const { total, done } = db
    .prepare(
      `select count(*) as total, count(e.item_id) as done from items i
       left join embeddings e on e.item_id = i.id
       where i.kind in ('image', 'capture') and i.deleted_at is null`
    )
    .get() as { total: number; done: number }
  return { state, done, total, error }
}

/* ---------- natural-language search ---------- */

// CLIP's text half maps a phrase into the same space as the image vectors. Loaded on the first
// search (~60 MB download, once), separately from the vision model.
type ClipText = {
  tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>
  text: Awaited<ReturnType<typeof CLIPTextModelWithProjection.from_pretrained>>
}
let clipText: Promise<ClipText> | null = null
const loadText = (): Promise<ClipText> =>
  (clipText ??= Promise.all([
    AutoTokenizer.from_pretrained(MODEL),
    CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: 'q8' })
  ])
    .then(([tokenizer, text]) => ({ tokenizer, text }))
    .catch((e) => {
      clipText = null
      throw e
    }))

// Text-to-image cosines sit in a narrow band: on a real library, matches scored ~0.26-0.30
// and the rest ~0.18-0.23. Keep images that clear an absolute floor and sit close to the best.
const FLOOR = 0.25
const NEAR_BEST = 0.03

export async function searchImages(query: string): Promise<{ id: number; score: number }[]> {
  const { tokenizer, text } = await loadText()
  const { text_embeds } = await text(tokenizer([query], { padding: true, truncation: true }))
  const q = text_embeds.data as Float32Array
  const norm = Math.hypot(...q)
  const scored: { id: number; score: number }[] = []
  for (const [id, v] of allVectors()) {
    let dot = 0
    for (let i = 0; i < v.length; i++) dot += v[i] * q[i]
    scored.push({ id, score: dot / norm })
  }
  scored.sort((a, b) => b.score - a.score)
  const cut = Math.max(FLOOR, (scored[0]?.score ?? 0) - NEAR_BEST)
  return scored.filter((s) => s.score >= cut).slice(0, 30)
}

/* ---------- text meaning (MiniLM) ---------- */

// CLIP's text-to-text scores are useless for this (every phrase scored 0.82-0.95 against every
// snippet), so text uses a sentence-embedding model: all-MiniLM-L6-v2, ~23 MB, 384 numbers.
const TEXT_MODEL = 'Xenova/all-MiniLM-L6-v2'
let minilm: ReturnType<typeof loadMinilm> | null = null
function loadMinilm() {
  return pipeline('feature-extraction', TEXT_MODEL, { dtype: 'q8' })
}
const sentences = () =>
  (minilm ??= loadMinilm().catch((e) => {
    minilm = null
    throw e
  }))

async function embedSentence(text: string): Promise<Float32Array> {
  const extract = await sentences()
  return Float32Array.from((await extract(text, { pooling: 'mean', normalize: true })).data as Float32Array)
}

// everything a person might remember an item by, in words
const docs = db.prepare(
  `select i.id, i.title, i.tldr, i.body, i.note, i.visible_text,
     (select group_concat(t.value, ', ') from item_tags it join tags t on t.id = it.tag_id
      where it.item_id = i.id) as tags
   from items i where i.deleted_at is null`
)
type DocRow = { id: number; title: string | null; tldr: string | null; body: string | null; note: string | null; visible_text: string | null; tags: string | null }
const docText = (r: DocRow) =>
  [r.title, r.tldr, r.tags, r.body, r.note, r.visible_text].map((s) => s?.trim()).filter(Boolean).join('. ')
const savedSources = db.prepare('select item_id, source from text_embeddings')
const saveText = db.prepare('insert or replace into text_embeddings (item_id, source, vector) values (?, ?, ?)')
const sourceOf = (doc: string) => createHash('sha1').update(doc).digest('hex')

let textRunning = false
let textAgain = false

// Embeds every item whose text changed since it was last embedded. Cheap to call often.
export async function indexText(): Promise<void> {
  if (asleep) return // wakeModels() runs it again
  if (textRunning) return void (textAgain = true)
  textRunning = true
  try {
    do {
      textAgain = false
      const saved = new Map((savedSources.all() as { item_id: number; source: string }[]).map((r) => [r.item_id, r.source]))
      for (const row of docs.all() as DocRow[]) {
        if (asleep) return
        const id = row.id
        const words = docText(row)
        if (!words) continue
        const source = sourceOf(words)
        if (saved.get(id) === source) continue
        const vector = await embedSentence(words)
        if (db.prepare('select 1 from items where id = ?').get(id)) saveText.run(id, source, Buffer.from(vector.buffer))
      }
    } while (textAgain)
  } catch (e) {
    console.error('[tessera] text embedding failed', e instanceof Error ? e.message : e)
  } finally {
    textRunning = false
    if (asleep && !running) void unload()
  }
}

/* ---------- tray: models out of memory until the window is back ---------- */

// "Free memory in the tray": the three models hold a few hundred MB once loaded. Asleep, nothing
// new is indexed; waking catches up on everything saved meanwhile, and models reload on demand.
let asleep = false

export function sleepModels(): void {
  asleep = true
  if (!running && !textRunning) void unload() // otherwise the running loop unloads when it stops
}

export function wakeModels(): void {
  if (!asleep) return
  asleep = false
  void indexImages()
  void indexText()
}

async function unload(): Promise<void> {
  const loaded: (Promise<{ dispose(): Promise<unknown> }> | null | undefined)[] = [clip?.then((c) => c.vision), clipText?.then((c) => c.text), minilm]
  clip = clipText = minilm = null
  for (const m of loaded) await m?.then((x) => x.dispose()).catch(() => {}) // a failed load holds nothing
}

// a debounced indexText, for after edits and analyses
let textTimer: NodeJS.Timeout | undefined
export function textChanged(): void {
  clearTimeout(textTimer)
  textTimer = setTimeout(() => void indexText(), 1500)
}

export function textVectors(): Map<number, Float32Array> {
  const rows = db
    .prepare(
      `select e.item_id, e.vector from text_embeddings e join items i on i.id = e.item_id
       where i.deleted_at is null`
    )
    .all() as { item_id: number; vector: Buffer }[]
  return new Map(rows.map((r) => [r.item_id, toVector(r.vector)]))
}

// Calibrated on a real library: matches scored 0.54-0.59, unrelated items 0.03-0.17.
const TEXT_FLOOR = 0.3
const TEXT_NEAR_BEST = 0.25

export async function searchMeaning(query: string): Promise<{ id: number; score: number }[]> {
  const q = await embedSentence(query)
  const scored: { id: number; score: number }[] = []
  for (const [id, v] of textVectors()) {
    let dot = 0
    for (let i = 0; i < v.length; i++) dot += v[i] * q[i]
    scored.push({ id, score: dot })
  }
  scored.sort((a, b) => b.score - a.score)
  const cut = Math.max(TEXT_FLOOR, (scored[0]?.score ?? 0) - TEXT_NEAR_BEST)
  return scored.filter((s) => s.score >= cut).slice(0, 30)
}

// vectors for every embedded item; empty blobs (failed files) are left out
export function allVectors(): Map<number, Float32Array> {
  const rows = db
    .prepare(
      `select e.item_id, e.vector from embeddings e join items i on i.id = e.item_id
       where length(e.vector) > 0 and i.deleted_at is null`
    )
    .all() as {
    item_id: number
    vector: Buffer
  }[]
  return new Map(rows.map((r) => [r.item_id, toVector(r.vector)]))
}
