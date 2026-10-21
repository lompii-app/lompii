// capture = a screenshot of a web page or a section of one, taken by the extension
export type Kind = 'image' | 'capture' | 'quote' | 'snippet'

export type Item = {
  id: number
  kind: Kind
  body: string | null // the text of quotes and snippets; null for images
  file_path: string // "library/<hash>.png" — relative to userData; '' for text
  thumb_path: string // "thumbs/<hash>.webp"; '' for text
  hash: string
  width: number
  height: number
  dominant_color: string
  source_url: string | null
  title: string | null
  created_at: number
  status: 'pending' | 'analysing' | 'tagged' | 'failed' // AI analysis
  tldr: string | null // AI summary
  visible_text: string | null // text the AI read off the image, for search
  ai_error: string | null // why the last analysis failed
  note: string | null
  palette: string | null // JSON, main process only; the renderer asks for palette(id)
}

export const isText = (kind: Kind): boolean => kind === 'quote' || kind === 'snippet'

// A quote has a quoted span, "…" or “…”; any other saved text is a snippet.
// db.ts migration v5 applies the same rule in SQL.
export const textKind = (text: string): 'quote' | 'snippet' =>
  /["“”„«»][^]*["“”„«»]/.test(text) ? 'quote' : 'snippet'

export type Stack = { id: number; name: string; color: string; items: number[] } // items newest first

export const isHttpUrl = (u: string): boolean => {
  try {
    const { protocol } = new URL(u)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export type WindowAction = 'close' | 'minimize' | 'maximize'

export type Tag = { id: number; dimension: string; value: string }

export type AiProvider = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'custom'

export const AI_PROVIDERS: Record<AiProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
  custom: 'Other (OpenAI-compatible)'
}

// any vision-capable model works; these are only the starting values
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-opus-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
  openrouter: 'google/gemini-2.5-flash',
  custom: ''
}

// Guess the provider from the key's prefix; the user can still pick another.
export const detectProvider = (key: string): AiProvider | null => {
  const k = key.trim()
  if (k.startsWith('sk-ant-')) return 'anthropic'
  if (k.startsWith('sk-or-')) return 'openrouter'
  if (k.startsWith('AIza')) return 'gemini'
  if (k.startsWith('sk-')) return 'openai'
  return null
}

export type EmbeddingStatus = {
  state: 'idle' | 'loading' | 'ready' | 'failed' // loading includes the first-run model download
  done: number
  total: number
  error: string | null
}

export type Settings = {
  token: string
  ai: { provider: AiProvider; model: string; baseUrl: string; hasKey: boolean } | null
  openAtLogin: boolean | null // null: not available (development build)
}

// the browser extension talks to Tessera on this port, 127.0.0.1 only
export const EXTENSION_PORT = 47821

export type TesseraAPI = {
  list(): Promise<Item[]>
  tags(itemId: number): Promise<Tag[]>
  addTags(itemId: number, tags: string[]): Promise<void>
  removeTag(itemId: number, tag: string): Promise<void>
  tagIndex(): Promise<{ item: number; value: string }[]>

  stacks(): Promise<Stack[]>
  createStack(name: string, color: string): Promise<number>
  updateStack(id: number, patch: { name?: string; color?: string }): Promise<void>
  deleteStack(id: number): Promise<void>
  setInStack(stackId: number, itemId: number, member: boolean): Promise<void>
  update(id: number, patch: Partial<Pick<Item, 'source_url' | 'title' | 'note'>>): Promise<void>
  palette(id: number): Promise<string[]>
  similar(id: number): Promise<number[]> // the item itself, then its closest matches
  saveAs(id: number): Promise<boolean> // false if the save dialog was cancelled
  copy(id: number): Promise<void> // the image, or the text, to the clipboard
  remove(id: number): Promise<void>

  ingestPaths(paths: string[]): Promise<number>
  ingestBuffer(data: ArrayBuffer): Promise<Item | null>
  pathForFile(file: File): string

  onAdded(cb: (item: Item) => void): () => void
  onUpdated(cb: (item: Item) => void): () => void

  fileSize(id: number): Promise<number>
  openExternal(url: string): Promise<void>
  windowControl(action: WindowAction): Promise<void>

  getSettings(): Promise<Settings>
  setAi(patch: { provider: AiProvider; model: string; baseUrl: string; key?: string }): Promise<Settings>
  setOpenAtLogin(on: boolean): Promise<Settings>
  analyse(id: number): Promise<void> // queue one item for AI analysis
  analyseAll(): Promise<number> // queue everything not yet analysed; returns how many
  embeddingStatus(): Promise<EmbeddingStatus>
  searchVisual(query: string): Promise<{ id: number; score: number }[]> // images matching a description
}

declare global {
  interface Window {
    tessera: TesseraAPI
  }
}
