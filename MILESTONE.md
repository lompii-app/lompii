# Milestones

Where Tessera stands against `project.md`'s milestone order, and the decisions behind it.
For setup and features, see [README.md](README.md).

| Milestone | State |
| --- | --- |
| **M1 Capture** | Done. Saving now happens from the web (extension), not a watched folder. |
| **M2 Understanding** | Done, with free-form tags instead of the Creative DNA vocabulary. |
| **M3 Retrieval** | Done: keyword search with combinable chips, kind filters, natural-language search (CLIP for looks, MiniLM for meaning) and "same vibe". |
| **M4 Collections** | Manual collections done (stacks). Smart collections not started. |
| Browser extension | Done (was "later, not MVP"). |

---

## Built

**Scaffold.** Electron + electron-vite (React, TS, Tailwind v4). `contextIsolation` on,
`nodeIntegration` off, preload sandboxed. All disk, DB and network work happens in main,
exposed through one typed API in `src/shared/api.ts`. `npm run dev` runs with `--watch`, so
main and preload changes restart Electron instead of leaving a stale main process behind a
hot-reloaded renderer.

**Native modules.** better-sqlite3 and sharp rebuilt for Electron's ABI via
`electron-builder install-app-deps` (postinstall). `asarUnpack` covers both plus `@img`.

**Database.** `items`, `tags`, `item_tags`, `stacks`, `stack_items`. Migrations are a
`MIGRATIONS` array indexed by `user_version`, each in a transaction:

| v | Change |
| --- | --- |
| 1 | items, tags, item_tags |
| 2 | `kind` and `body` on items (text saves) |
| 3 | auto `quotes` tag, backfilled (undone in v5) |
| 4 | `stack_colors` (tag-based stacks, replaced in v5) |
| 5 | real `stacks` / `stack_items`; old coloured tag-stacks carried over; quotes split into quotes and snippets; `quotes` tag dropped |
| 6 | `note`, `palette` |
| 7 | palette cache cleared (three colours became four) |
| 8 | `tldr`, `visible_text`, `ai_error` |
| 9 | `embeddings` (CLIP vectors, own table) |
| 10 | `deleted_at` (trash) |
| 11 | `text_embeddings` (MiniLM vectors, with a hash of the text they came from) |

**Ingest.** sha256 dedupe, copy to `userData/library`, 480 px WebP thumb to
`userData/thumbs`, dimensions and dominant colour, insert; a duplicate returns the existing
item. Paths: drag-drop, clipboard paste, and the extension's local server. Text goes through
`ingestText`, which classifies it (see decisions). New items reach the grid over
`item:added`, then join the AI queue.

**Extension server.** `node:http` on `127.0.0.1:47821`. `GET /ping`, `POST /image`
(`kind=image|capture`), `POST /text`, `POST /items/:id/tags`. Every request carries a bearer
key, compared with `timingSafeEqual`. Body cap 50 MB, text cap 10,000 characters, titles and
URLs trimmed, non-http(s) sources dropped.

**Chrome extension** (`extension/`, MV3, plain JS). Context menu for images and selected
text, page captures (area, visible, full page, delayed), a toolbar popup, `Alt+Shift+S`, an
in-page toast with an *Add tags* field (shadow DOM, so page CSS can't touch it), and an
options page holding the key.

**AI** (`src/main/ai.ts`). One call per item returns title, TLDR, tags and visible text,
two items in flight at a time. Providers: Anthropic through `@anthropic-ai/sdk` with
structured JSON output and server-side refusal fallback; OpenAI and OpenRouter with
`json_schema` response format; Gemini with `responseSchema`; any OpenAI-compatible base URL
with a plain JSON instruction. `status` moves `pending → analysing → tagged | failed`; the
overlay reads it.

**Window.** No native title bar; a 40 px drag strip and macOS-style traffic lights drawn in
the renderer. Light theme, serif display type, masonry grid of cards, a floating search pill
once the header scrolls away.

**Detail overlay.** The item on its dominant colour (images fit; only captures taller than
2:1 scroll), a four-colour palette, title, relative time and source link, TLDR (with an
analysing state), kind chip plus removable tags, notes, and Download / Add to stack / Copy /
Delete. Esc and outside clicks close it; arrow keys still move the selection underneath.

**Stacks.** User-made, named, coloured. Shown as fanned piles of their newest three items;
created and edited from the Stacks page or the overlay's picker.

**Search.** Words, word chips (all must match), one active filter (kind, stack, or same
vibe), across title, body, note, TLDR, visible text, file path and tags; plus CLIP and MiniLM
matches by description.

**Daily use.** Tray icon (close hides, quit from the tray), start at login in the installed
app, one instance at a time. Multi-select with bulk stack/tag/delete. Trash with undo, purged
after 30 days. Library backup. A tag manager (rename, merge, delete). `npm test` over the
pure logic in `scoring.ts`. The Windows installer is built and verified.

## Decisions worth remembering

**No watched folder.** M1 imported new screenshots automatically. In practice most
screenshots are taken for something else (chat, bug reports), so the library filled with
noise and file names like "Screenshot 2026-10-22 015330". Saving moved to the extension,
where each save is deliberate and arrives with its page title and URL. Drag-drop and paste
remain for local files.

**Quotes reuse the image columns.** Text items store `''` paths, `0×0` and `#ffffff` rather
than a table rebuild (which, with `foreign_keys` on, would cascade-delete `item_tags`).
Marked `ponytail:` in `db.ts`; split into per-kind tables if a kind with its own fields
arrives. `remove` and `fileSize` skip empty paths.

**Quote or snippet is a mechanical rule.** Text with a quoted span (`"…"`, `“…”`, `«…»`) is a
quote and is stored without its outer marks; anything else is a snippet. Same rule in
`textKind` and in migration 5's SQL. The hash keeps a `quote:` prefix so text saved before
the split still dedupes.

**Stacks are not tags.** The first version made every tag a stack, which meant stacks
couldn't be empty, couldn't hold arbitrary items, and filled up with AI tags. Stacks are now
their own tables, added to by hand; tags stay for search.

**User and AI tags share one dimension (`tag`).** They look and behave the same, and either
can be removed. A tag left on no item is deleted, so it doesn't linger as an empty filter.
Kind words (image, quote, snippet…) are kept out of tags; the kind has its own chip.

**AI tags are free-form, not Creative DNA.** `project.md` specifies a closed vocabulary with
cardinality limits. Free-form tags searched better in practice and match how mymind-style
libraries are used. The DNA dimensions remain a candidate for structured facets (see
deferred); `tags` is still `(dimension, value)`, so they have somewhere to live.

**The AI key never reaches the renderer.** It's encrypted with `safeStorage` in
`settings.json`; the renderer only sees `hasKey`. The extension key is in the same file,
plain, since it only guards a localhost port.

**Provider is guessed, not required.** `detectProvider` reads the key prefix (`sk-ant-`,
`sk-or-`, `AIza`, `sk-`); the user can override provider, model and base URL. Default models
are starting values only.

**Edits propagate by broadcast, not return value.** Main sends `item:updated` to every
window after any change (title, note, tags from the overlay, the extension or the AI), and
the renderer re-reads what it needs. One mechanism.

**Palettes are lazy.** Four colours per image, bucketed from the 48 px thumb and cached in
`palette` the first time an item is opened (or when same vibe needs them). The dominant
colour stays a placeholder swatch; it's approximate.

**Same vibe runs on local CLIP embeddings.** ViT-B/32, quantised, through
`@huggingface/transformers` and onnxruntime in main; no provider has image embeddings in
common (Anthropic has none), and local is free and offline. Vectors are normalised and kept
in their own `embeddings` table so they never travel with items over IPC. Image pairs score
65% visual (cosine mapped from 0.5–0.9 onto 0–1), 25% tags, 10% palette; text items keep the
older tags/palette heuristic. Scored against every item per click; marked `ponytail:` with a
vector index as the upgrade.

**Search runs in the renderer** over the full array, no index. Fine at thousands of items.

**Words get their own model.** CLIP's text encoder scored every phrase 0.82–0.95 against
every snippet, useless for text. MiniLM (all-MiniLM-L6-v2, 23 MB) separates matches
(0.54–0.59) from the rest (0.03–0.17). Each item's text is embedded with a hash of its source
so edits, analyses and tag changes re-embed (debounced, `textChanged()`).

**Deleting is soft.** `deleted_at` hides an item everywhere; Undo clears it; startup purges
anything older than 30 days with its files. Re-saving something in the trash restores it,
since the hash dedupe would otherwise silently swallow the save.

**AI tags fold onto existing ones.** The prompt lists the 80 most-used tags to reuse, and a
small ending rule (`ing|ed|al|ly|s`) maps motivational→motivation onto the spelling already in
the library. Deliberately crude: it only ever matches against tags that exist.

**Natural-language search is CLIP text-to-image.** The phrase (chips and typing together)
goes to CLIP's text encoder after a 250 ms pause; images scoring at least 0.25, and within
0.03 of the best, join the word matches. Those numbers come from calibrating on a real
library: matches landed at 0.26–0.30, everything else at 0.18–0.23. Word matches rank
first. Quotes and snippets are found by words only; their text isn't embedded.

**`pathForFile` is in the preload API.** Electron 44 removed `File.path`; a dropped file's
path is only reachable through `webUtils.getPathForFile`.

**Source URLs are validated in main.** `isHttpUrl` rejects non-http(s) on write and on
`openExternal`, so a compromised renderer can't store or launch a `file:` or `javascript:`
URL. The source is set by the extension; it's no longer editable in the overlay.

**No `size` column.** File size comes from a `statSync` when the overlay opens.

**Arrow keys are index arithmetic**, not geometric nearest-neighbour. Marked `ponytail:` in
`Grid.tsx`.

**Full-page capture scrolls and stitches.** The debugger API would capture beyond the
viewport cleanly but shows a "being debugged" bar. Fixed and sticky elements are hidden after
the first strip, captures are spaced for Chrome's two-per-second limit, and every wait for a
repaint has a timeout. Marked `ponytail:` in `extension/background.js`.

## Known gaps

- **Installer not code-signed**, so Windows SmartScreen warns on first run. The packaged app
  is verified (database, sharp, CLIP inference, the extension server and the window all run
  from `release/win-unpacked`), but only on Windows x64: `win.files` drops onnxruntime's
  macOS, Linux and arm64 binaries, which a mac or arm build would need back.
- **macOS and Linux are untested.** macOS shows its native traffic lights (the custom ones
  are skipped there); the Windows build drops onnxruntime's other-platform binaries.
- **No in-app restore** from a backup; it's a manual copy while Tessera is closed.
- **Full page** misses pages that scroll an inner element, and stops at about 20,000 CSS px.
- **The OpenAI default model** (`gpt-4o-mini`) may be outdated.
- **No end-to-end test of the AI providers** beyond real use; only Anthropic's request shape
  is checked against the SDK's types.
- **Stacks can't be merged.**

## Deferred

- **Semantic search for quotes and snippets** (embedding their text too).
- **Creative DNA** as structured, filterable facets alongside free-form tags.
- **M4:** smart collections as saved searches.
- Later: prompt generation, copying metadata, moodboards, sync across devices.
