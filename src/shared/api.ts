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
  deleted_at: number | null // in the trash since; the renderer never sees trashed items
}

export const isText = (kind: Kind): boolean => kind === 'quote' || kind === 'snippet'

// A quote has a quoted span, "…" or “…”; any other saved text is a snippet.
// db.ts migration v5 applies the same rule in SQL.
export const textKind = (text: string): 'quote' | 'snippet' =>
  /["“”„«»][^]*["“”„«»]/.test(text) ? 'quote' : 'snippet'

// “…” — Oscar Wilde → the words and the author; the cards draw their own quote marks.
export const quoteParts = (body: string): { text: string; author: string | null } => {
  const m = body.match(/^\s*["“„«]([^]*)["”»]\s*[—–―-]+\s*([^\n]{1,80})$/)
  return m ? { text: m[1].trim(), author: m[2].trim() } : { text: body, author: null }
}

// Endings that make near-duplicate tags (motivational/motivation, photos/photo): new AI tags
// are matched to existing ones by it, and the tag manager suggests merges with it.
export const stem = (tag: string) => tag.replace(/(ing|ed|al|ly|s)$/, '') || tag

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

export type AiProvider = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'ollama' | 'custom'

export const AI_PROVIDERS: Record<AiProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  custom: 'OpenAI-compatible server'
}

// these run on your own machine or network: a key is optional, but a model must be picked
export const KEYLESS: ReadonlySet<AiProvider> = new Set(['ollama', 'custom'])

// any vision-capable model works; these are only the starting values
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-opus-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
  openrouter: 'google/gemini-2.5-flash',
  ollama: '',
  custom: ''
}

// where each provider hands out keys; the local server has none
export const KEY_PAGES: Partial<Record<AiProvider, string>> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  gemini: 'https://aistudio.google.com/apikey',
  openrouter: 'https://openrouter.ai/keys'
}

export type ModelInfo = { id: string; name: string; vision?: boolean } // vision: known to read images

export type EmbeddingStatus = {
  state: 'idle' | 'loading' | 'ready' | 'failed' // loading includes the first-run model download
  done: number
  total: number
  error: string | null
}

export type Settings = {
  token: string
  ai: {
    active: AiProvider | null // the provider every analysis goes to
    providers: Partial<Record<AiProvider, { model: string; baseUrl: string; hasKey: boolean }>>
  }
  openAtLogin: boolean | null // null: not available (development build)
}

// the browser extension talks to Tessera on this port, 127.0.0.1 only
export const EXTENSION_PORT = 47821

export type TesseraAPI = {
  platform: string // process.platform: macOS draws its own window buttons
  list(): Promise<Item[]>
  tags(itemId: number): Promise<Tag[]>
  addTags(itemId: number, tags: string[]): Promise<void>
  removeTag(itemId: number, tag: string): Promise<void>
  tagIndex(): Promise<{ item: number; value: string }[]>
  tagCounts(): Promise<{ value: string; count: number }[]>
  renameTag(from: string, to: string): Promise<void> // onto an existing tag: merges
  deleteTag(value: string): Promise<void> // from every item

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
  remove(id: number): Promise<void> // to the trash
  restore(ids: number[] | 'all'): Promise<void>
  trashCount(): Promise<number>
  trashList(): Promise<Item[]> // most recently deleted first
  emptyTrash(): Promise<void>
  backup(): Promise<string | null> // the backup folder, or null if cancelled

  ingestPaths(paths: string[]): Promise<number>
  ingestBuffer(data: ArrayBuffer): Promise<Item | null>
  pathForFile(file: File): string

  onAdded(cb: (item: Item) => void): () => void
  onUpdated(cb: (item: Item) => void): () => void

  fileSize(id: number): Promise<number>
  openExternal(url: string): Promise<void>
  windowControl(action: WindowAction): Promise<void>

  getSettings(): Promise<Settings>
  resetToken(): Promise<Settings> // a new extension key: every paired browser must connect again
  // key: a new key; '' removes it; left out keeps the saved one
  saveProvider(provider: AiProvider, patch: { key?: string; model?: string; baseUrl?: string }): Promise<Settings>
  setActiveProvider(provider: AiProvider | null): Promise<Settings>
  setOpenAtLogin(on: boolean): Promise<Settings>
  analyse(id: number): Promise<void> // queue one item for AI analysis
  analyseAll(): Promise<number> // queue everything not yet analysed; returns how many
  testProvider(provider: AiProvider): Promise<string | null> // null: it answered; else the error
  listModels(provider: AiProvider): Promise<{ models?: ModelInfo[]; error?: string }>
  imagePrompt(id: number): Promise<string> // a text-to-image prompt that would recreate it; rejects with the reason
  embeddingStatus(): Promise<EmbeddingStatus>
  searchSemantic(query: string): Promise<{ id: number; score: number }[]> // matches by look or meaning, score 0-1
}

declare global {
  interface Window {
    tessera: TesseraAPI
  }
}
