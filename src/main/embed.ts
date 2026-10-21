import { join } from 'node:path'
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from '@huggingface/transformers'
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
  `select * from items where kind in ('image', 'capture')
   and id not in (select item_id from embeddings) order by created_at desc`
)

let state: EmbeddingStatus['state'] = 'idle'
let error: string | null = null
let running = false

// One image at a time, newest first, until none are left. Safe to call repeatedly.
export async function indexImages(): Promise<void> {
  if (running) return
  running = true
  let count = 0
  try {
    for (let item = missing.get() as Item | undefined; item; item = missing.get() as Item | undefined) {
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
  }
}

export function embeddingStatus(): EmbeddingStatus {
  const { total, done } = db
    .prepare(
      `select count(*) as total, count(e.item_id) as done from items i
       left join embeddings e on e.item_id = i.id where i.kind in ('image', 'capture')`
    )
    .get() as { total: number; done: number }
  return { state, done, total, error }
}

// vectors for every embedded item; empty blobs (failed files) are left out
export function allVectors(): Map<number, Float32Array> {
  const rows = db.prepare('select item_id, vector from embeddings where length(vector) > 0').all() as {
    item_id: number
    vector: Buffer
  }[]
  return new Map(rows.map((r) => [r.item_id, toVector(r.vector)]))
}
