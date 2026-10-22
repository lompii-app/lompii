// Pure logic with no Electron or database: parsing what the AI returns, and the numbers behind
// same vibe and search. Kept apart so test/scoring.test.ts can run it under plain Node.

import { stem } from '../shared/api.ts'

export type Result = { title: string; tldr: string; tags: string[]; text: string }

// the kinds are shown on their own; as tags they'd only add noise
export const KIND_WORDS = new Set(['image', 'images', 'picture', 'photo of', 'screenshot', 'capture', 'quote', 'quotes', 'snippet', 'text'])

// Models sometimes wrap JSON in prose or a code fence; take the outermost object.
export function parse(raw: string): Result {
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
      .slice(0, 10),
    text: str(j.text, 3000)
  }
}

// A new tag takes the spelling of an existing one with the same stem; `known` is the
// library's tags, most used first
export function canonicalTags(tags: string[], known: string[]): string[] {
  const byStem = new Map<string, string>()
  for (const value of known) if (!byStem.has(stem(value))) byStem.set(stem(value), value)
  return [...new Set(tags.map((t) => byStem.get(stem(t)) ?? t))]
}

export const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// How close two palettes look: each colour of one matched to its nearest in the other.
// Unrelated palettes still average ~150 apart in RGB, so that distance maps to zero.
export function paletteSimilarity(a: number[][], b: number[][]): number {
  if (!a.length || !b.length) return 0
  const nearest = a.map((p) => Math.min(...b.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))))
  return Math.max(0, 1 - nearest.reduce((s, d) => s + d, 0) / nearest.length / 150)
}

export function jaccard(a: Set<string> | undefined, b: Set<string> | undefined): number {
  if (!a?.size || !b?.size) return 0
  let shared = 0
  for (const t of a) if (b.has(t)) shared++
  return shared / (a.size + b.size - shared)
}

// CLIP cosine between two unrelated images sits around 0.5; near-duplicates reach ~0.9.
export const visualSimilarity = (a: Float32Array, b: Float32Array): number => {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return Math.min(1, Math.max(0, (dot - 0.5) / 0.4))
}

// a raw model score mapped onto 0-1 between the given bounds
export const relevance = (score: number, low: number, high: number) =>
  Math.min(1, Math.max(0, (score - low) / (high - low)))
