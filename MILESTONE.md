# M1 — Capture (done)

Scope: references get into the library, look good in a grid, and open in a detail panel.
Everything beyond that follows `project.md`'s milestone order. See [Deferred](#deferred).

## Built

**Scaffold** — Electron + electron-vite (React, TS, Tailwind v4). `contextIsolation` on,
`nodeIntegration` off, preload sandboxed. All disk and DB work in main, exposed through
one typed API in `src/shared/api.ts`.

**Native modules** — better-sqlite3 and sharp rebuilt for Electron's ABI via
`electron-builder install-app-deps` (postinstall). `asarUnpack` covers both plus `@img`.

**Database** — `items`, `tags`, `item_tags`. Migrations are a `MIGRATIONS` array indexed by
`user_version`; each runs in a transaction. Tag tables exist and are empty.

**Ingest** — chokidar watches the screenshots folder (`awaitWriteFinish`). On a new image:
sha256 dedupe, copy to `userData/library`, 480px webp thumb to `userData/thumbs`, read
dimensions and dominant colour, insert. Same path serves drag-drop and clipboard paste.
New items reach the grid live over `item:added`.

**Images** — served through the `tessera://` protocol, registered as privileged, with a
containment check against `userData`. Never `file://`.

**Grid** — sidebar (Library / Inbox / count / settings), centred search with Cmd/Ctrl+K,
virtualised masonry (TanStack Virtual `lanes`), dominant-colour placeholder, hover outline,
selection, arrow-key navigation, Delete with confirm, empty state, settings dialog as a
native `<dialog>`.

**Detail panel** — 420px, grid reflows beside it. Full image (click for a lightbox),
editable title and source URL saved on blur, meta row with date / dimensions / file size,
and an ATTRIBUTES section that groups chips by dimension. Opens on click or Enter. Esc
layers: lightbox, then panel, then selection.

## Decisions worth remembering

**Existing screenshots are not imported** (`ignoreInitial: true`). Only captures taken after
the app starts. A first launch that swallowed an entire Screenshots folder would be a
surprise, not a feature. Back-filling should be an explicit action if it's ever wanted.

**Inbox equals Library right now.** Nothing sets `status` to `'tagged'`, so every item is
pending. The two views diverge in M2.

**`pathForFile` was added to the preload API.** Electron 44 removed `File.path`; a dropped
file's path is only reachable through `webUtils.getPathForFile`. Without it, drag-drop would
push whole image buffers across IPC.

**Edits propagate by broadcast, not return value.** `update()` returns `void` and main sends
`item:updated` to every window, so the grid picks up title changes through the same path as
`item:added`. One mechanism, not two.

**No `size` column.** File size comes from a `statSync` when the panel opens. A migration
would default existing rows to 0 and need an fs backfill to un-lie; one stat per panel open
costs nothing.

**Source URL is validated in both processes.** `isHttpUrl` lives in `src/shared/api.ts`. The
renderer uses it to gate the field and the OPEN button; main rejects non-http(s) on both
write and `openExternal`, so a compromised renderer cannot store or launch a `file:` or
`javascript:` URL.

**Search covers `title` and `file_path` only.** `title` holds the original filename, since
`file_path` is a hash. There is no index on either — filtering happens in the renderer over
the full array. Fine at this size; server-side when it isn't. M3 replaces this entirely.

**Arrow keys are index arithmetic**, not geometric nearest-neighbour. Up/down steps by column
count and can land a column off on uneven masonry. Marked `ponytail:` in `Grid.tsx`.

**Dominant colour is approximate.** sharp bins a histogram, so `#2e6ad1` comes back `#2868d8`.
It is a placeholder swatch, not colour metadata — M2's local colour extraction is a separate
job.

## Known gaps

- **Packaged build unverified.** `asarUnpack` is configured but only matters outside dev;
  `npm run pack` has not been run. This is the last untested part of M1.
- **`source_url` is only ever set by hand.** A watched screenshot has no URL. Automatic
  source capture needs the browser extension, which `project.md` puts in "Later, not MVP".
- **ATTRIBUTES always reads "Not analysed yet."** Nothing writes `item_tags` until M2.

## Deferred

Per `project.md`'s milestone order: M2 understanding (one vision-model call per reference —
Creative DNA enums, description, visible text; colours extracted locally), M3 retrieval
(embeddings, natural-language search, attribute chips as filters, find-similar), M4
collections (manual, and smart collections as saved searches).

Later, not MVP: browser extension, prompt generation, copy metadata, moodboards, sync.

The schema already anticipates M2. `tags` is `(dimension, value)` with a uniqueness
constraint rather than a flat string, so the controlled vocabulary has somewhere to live
without a migration reshaping it. `status` flips to `'tagged'` there, and `source_url` is
already a column.
