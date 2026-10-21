# Tessera

**A personal visual memory for designers.** Save images, page captures, quotes and snippets
from the web; Tessera describes and tags each one with AI so you can find it again by
describing what you remember.

> Save anything. Tessera understands it. Find it when you need it.

Tessera is a desktop app (Electron) with a companion Chrome extension. Everything lives on
your computer: the library, the database and your keys. The only thing that leaves it is
the item you ask the AI provider of your choice to describe.

---

## Contents

- [Features](#features)
- [Getting started](#getting-started)
- [The Chrome extension](#the-chrome-extension)
- [AI analysis](#ai-analysis)
- [Using Tessera](#using-tessera)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Data and privacy](#data-and-privacy)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## Features

**Capture**
- **Chrome extension.** Right-click an image or selected text and choose *Add to Tessera*,
  or open the toolbar popup to capture the **visible area**, the **full page**, a **selected
  area**, the visible area **after a 3-second delay** (for hover menus), or the **selected
  text**. `Alt+Shift+S` goes straight to area selection.
- **Saved-to-Tessera toast** on the page, with an *Add tags* field.
- **Drag and drop** image files onto the window, or **paste** an image with `Ctrl+V`.
- The source page's address and title are saved with everything captured from the web.

**Kinds**
- **Image**, **Capture** (a screenshot of a page or part of one), **Quote** and **Snippet**.
  Saved text containing a quoted span (`"…"` or `“…”`) becomes a quote; anything else is a
  snippet. Quotes render as serif cards with their own quote marks.

**Understanding (AI)**
- Each item gets a **title**, a one- or two-sentence **TLDR**, **6–12 search tags**
  (subject, style, mood, colours, layout) and any **visible text** read off the image.
- Works with **any provider's API key**: Anthropic (Claude), OpenAI, Google Gemini,
  OpenRouter, or any OpenAI-compatible server (Groq, Ollama, LM Studio…).

**Finding**
- **Search** across titles, tags, TLDRs, notes, quote and snippet text, and text inside
  images. Press `Enter` to turn a word into a chip; chips combine, so `natively` + `dark`
  shows only items matching both.
- **Type filters** (Images, Captures, Quotes, Snippets) appear under the search.
- **Same vibe**: from any item, see the items that look most like it. Images are compared
  with a local CLIP model (free, offline after a one-time ~90 MB download); tags and palette
  add to the score.
- A **floating search pill** takes over once you scroll past the header.

**Organising**
- **Stacks**: named, coloured collections you build by hand, shown as fanned piles.
  Add an item to stacks from its overlay; rename, recolour or delete stacks.
- **Tags**: add or remove your own alongside the AI's.
- **Notes** on any item.

**Viewing**
- A masonry grid of cards with captions; full-page captures show their top.
- A detail overlay with the item on its dominant colour, a four-colour **palette** (click a
  swatch to copy its hex), the source link, TLDR, tags, notes, and **Download**, **Add to
  stack**, **Copy** (image or text to the clipboard) and **Delete**.

---

## Getting started

### Requirements

- **Node.js 22** or newer, and npm
- **Windows** (the app is developed and tested there; see [Known limitations](#known-limitations))
- **Google Chrome** (or another Chromium browser) for the extension

### Install and run

```bash
npm install      # also rebuilds the native modules (better-sqlite3, sharp) for Electron
npm run dev      # starts the app; restarts itself when main-process code changes
```

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Run in development with hot reload. The renderer reloads in place; changes to `src/main` or `src/preload` restart Electron. |
| `npm run typecheck` | Type-check the whole project (`tsc --noEmit`). |
| `npm run build` | Type-check, then build to `out/`. |
| `npm run pack` | Build and package an unpacked app into `release/` (quick check). |
| `npm run dist` | Build and package an installer into `release/`. |

---

## The Chrome extension

The extension lives in [`extension/`](extension) and needs no build step.

1. Start Tessera.
2. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**
   and choose the `extension` folder.
3. The extension's options page opens. In Tessera, open **Settings → Browser extension key**,
   click **Copy**, paste the key into the options page and **Save**. It should say
   *Connected to Tessera*.

After editing anything in `extension/`, click the reload icon on the extension's card in
`chrome://extensions`.

| How | What it saves |
| --- | --- |
| Right-click an image → *Add to Tessera* | the image (as an **Image**) |
| Select text, right-click → *Add to Tessera* | a **Quote** or **Snippet** |
| Right-click the page → *Capture an area…* / *Capture visible area* | a **Capture** |
| Toolbar popup | visible area, full page, selected area, delayed capture, or selected text |
| `Alt+Shift+S` | selected area (drag a box; `Enter` takes the whole view, `Esc` cancels) |

Change the shortcut at `chrome://extensions/shortcuts`. Chrome doesn't let extensions run on
its own pages (the New Tab page, `chrome://` pages, the Web Store), so nothing happens there.

---

## AI analysis

Open **Settings → AI**, paste an API key and click **Save**. The provider is detected from the
key's prefix; you can change it and the model.

| Key starts with | Provider | Default model |
| --- | --- | --- |
| `sk-ant-` | Anthropic | `claude-opus-5` |
| `sk-` | OpenAI | `gpt-4o-mini` |
| `AIza` | Google Gemini | `gemini-2.5-flash` |
| `sk-or-` | OpenRouter | `google/gemini-2.5-flash` |
| — | Other (OpenAI-compatible) | set a model and a base URL, e.g. `http://localhost:11434/v1` |

Any model that accepts images works; the defaults are only starting points. For Claude,
`claude-haiku-4-5` is a much cheaper option than the default.

- **New saves** are analysed automatically once a key is set.
- **Existing items**: *Settings → Analyse library* queues everything not yet analysed.
- **One item**: the *Analyse* button in its overlay, or *Try again* after a failure (the
  provider's error is shown in the TLDR box).

While an item is being analysed, its overlay shows a glow in the TLDR box. The AI's title
replaces page titles and file names; its tags are ordinary tags you can remove.

Requests run two at a time in the background. Claude calls use the official
`@anthropic-ai/sdk` with structured JSON output and Anthropic's server-side refusal fallback;
other providers are called over their HTTP APIs.

---

## Using Tessera

- **Everything** is the whole library, newest first. **Stacks** shows your collections.
- **Click a card** to open it. Click outside the card or press `Esc` to close; arrow keys
  move between items while it's open.
- **Search**: click the search (or `Ctrl+K`) to see the type filters; pick one, type words,
  press `Enter` to keep a word as a chip. `Backspace` in an empty search removes the last chip.
- **Same vibe**: in an item's overlay, bottom left. Clear it with the × on its chip.
- **Stacks**: *New stack* on the Stacks page, or *Add to stack* (the round button) in an
  item's overlay, which can also create one. The pencil next to a stack's name renames,
  recolours or deletes it; deleting a stack keeps its items.
- **Palette**: hover the swatches in the overlay to fan them out; click one to copy its hex,
  or the white ring to copy all of them.

## Keyboard shortcuts

| Key | Where | Action |
| --- | --- | --- |
| `Ctrl+K` | anywhere | focus search |
| `Enter` | search | turn the typed word into a chip |
| `Backspace` | empty search | remove the last chip, then the filter |
| `Esc` | search | clear the text, then leave the search |
| `←` `→` `↑` `↓` | grid | move the selection |
| `Enter` | grid | open the selected item |
| `Delete` | grid | delete the selected item (asks first) |
| `Esc` | overlay | close it |
| `Ctrl+V` | anywhere | save a pasted image |

---

## How it works

```
 Chrome extension ──HTTP (127.0.0.1:47821, key)──┐
                                                  ▼
 ┌──────────────── Electron main process ─────────────────┐
 │ server.ts   local API for the extension                │
 │ ingest.ts   dedupe → file + thumbnail + colour → SQLite │
 │ ai.ts       analysis queue → provider → title/tags/TLDR │
 │ db.ts       SQLite schema and migrations               │
 │ index.ts    IPC, window, tessera:// file protocol      │
 └──────────────▲────────────────────────────┬────────────┘
        IPC (preload)               item:added / item:updated
 ┌──────────────┴────────────────────────────▼────────────┐
 │ Renderer (React + Tailwind): grid, overlay, stacks…    │
 └────────────────────────────────────────────────────────┘
```

- **Ingest.** Images are hashed (SHA-256) for deduplication, copied into the library, given a
  480 px WebP thumbnail and a dominant colour, and inserted into SQLite. Text is classified as
  a quote or snippet. New items reach the window live, then go to the AI queue.
- **Extension API.** A small HTTP server bound to `127.0.0.1` on port `47821`. Every request
  must carry the key from Settings, so web pages that find the port can't write to the library.
  Endpoints: `GET /ping`, `POST /image?source=&title=&kind=`, `POST /text`,
  `POST /items/:id/tags`.
- **Images in the window** load through a private `tessera://` protocol with a path check,
  never `file://`.
- **Search and filters** run in the renderer over the loaded library.
- **Same vibe** uses CLIP image embeddings (`Xenova/clip-vit-base-patch32`, quantised, run with
  onnxruntime in the main process; `src/main/embed.ts`). Each image's vector is computed in the
  background when it's saved and stored in the `embeddings` table. Two images score 65% visual
  similarity, 25% shared tags, 10% palette; anything involving text or an unindexed image falls
  back to 60% tags, 30% palette, 10% same broad kind. Matches above 20% are kept, up to 40.
- **Migrations** are an ordered list in `db.ts`, applied by SQLite `user_version`.

## Project structure

```
src/
  main/          Electron main process
    index.ts       window, IPC handlers, palette / save / copy / same vibe
    db.ts          schema, migrations, tag helpers
    ingest.ts      saving images and text
    server.ts      local API for the extension
    ai.ts          AI analysis queue and provider adapters
    embed.ts       local CLIP image embeddings for same vibe
    settings.ts    settings.json, extension key, encrypted AI key
  preload/       the typed bridge between main and renderer
  renderer/      React app
    src/App.tsx      layout, search, chips, settings dialog
    src/Grid.tsx     virtualised masonry grid
    src/Detail.tsx   item overlay
    src/Stacks.tsx   stacks page and dialog
    src/Filters.tsx  filters, chips, icons
  shared/api.ts  types and helpers shared by main and renderer
extension/       Chrome extension (Manifest V3, plain JS)
project.md       product spec, including the AI vocabulary ideas
MILESTONE.md     milestone status and the decisions behind the design
```

## Data and privacy

Everything is stored in Electron's user-data folder, on Windows
`%APPDATA%\tessera\`:

| Path | Contents |
| --- | --- |
| `tessera.db` | SQLite database: items, tags, stacks |
| `library/` | original files, named by hash |
| `thumbs/` | 480 px WebP thumbnails |
| `settings.json` | extension key, AI provider and model, AI key (encrypted) |
| `models/` | the CLIP model used for same vibe, downloaded on first run |

- The **AI key** is encrypted with the operating system's secure storage (Electron
  `safeStorage`) and never reaches the renderer.
- During analysis, the item (a resized JPEG, or its text) is sent to the AI provider you chose.
  Nothing else leaves your computer.
- None of this data is in the repository.

## Known limitations

- **Windows first.** The window has custom macOS-style controls; on macOS the native ones
  would appear as well, and the app hasn't been tested there or on Linux.
- **Packaged builds are untested.** Development runs through `npm run dev`; `npm run pack` /
  `dist` are configured but not yet verified.
- **Full-page capture** scrolls and stitches screenshots. Pages that scroll an inner element
  come out as one screen, and very long pages are cut at about 20,000 px.
- **Same vibe** for quotes and snippets still relies on tags; only images have visual vectors.
- **One filter at a time** (a kind, a stack or same vibe), plus any number of word chips.
- The default OpenAI model name may need updating to a current one.

## Roadmap

- Natural-language search with CLIP's text encoder ("dark websites with huge typography")
- Creative DNA attributes from `project.md` as structured, filterable facets
- Verified installers for Windows and macOS
- Removing tags across the whole library, and merging stacks
