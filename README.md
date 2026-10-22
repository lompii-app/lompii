# Tessera

**Find the thing you half-remember.**

> Save anything. Tessera understands it. Find it when you need it.

You saved it months ago: a dark site with huge type, a poster in a particular orange, a line
someone wrote that stuck. You don't remember where it was, what it was called, or which folder
it went into. With Tessera you don't need to. Describe what you remember, *"grainy portrait,
deep shadow"*, and it comes back.

Tessera is a private visual memory for designers, illustrators, photographers, writers and
anyone else who collects inspiration:

- **Save from anywhere** with one right-click: images, text, a selected area or a full page.
- **Find it by description.** AI gives everything a title, a summary and tags, and local models
  match what things *look like* and what they *mean*, not just the words you typed.
- **Yours alone.** Your library, its search models and your keys stay on your computer.
  Nothing leaves it except the item you ask your own AI provider to describe.
- **Free, with your own AI.** Tessera costs nothing. Bring your own API key for Claude, OpenAI,
  Gemini or OpenRouter, or run models locally with Ollama or any OpenAI-compatible server:
  no account, no subscription, and with a local model nothing leaves your computer at all.

A desktop app for Windows (Electron) with a companion Chrome extension.

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
- Each item gets a **title**, a one- or two-sentence **TLDR**, **6–10 search tags**
  (subject, style, mood, colours, layout) and any **visible text** read off the image. The AI
  reuses your existing tags where they fit, and near-duplicates (motivational / motivation)
  fold into the tag you already have.
- Rate limits and overloaded providers are retried automatically.
- **Your own key, or no key at all**: Anthropic (Claude), OpenAI, Google Gemini and OpenRouter
  with your API key, or local models through Ollama (found automatically) and any
  OpenAI-compatible server (LM Studio, LiteLLM, vLLM…). Each provider keeps its own key, so you
  can set up several and switch between them; **Test connection** checks one, and its
  **Models** list comes live from the provider.

**Finding**
- **Search** across titles, tags, TLDRs, notes, quote and snippet text, and text inside
  images. Press `Enter` to turn a word into a chip; chips combine, so `natively` + `dark`
  shows only items matching both.
- **Describe what you remember**: "mountains landscape" finds images by what they look like
  (CLIP), and "an AI meeting assistant" finds anything by what its words mean (MiniLM), even
  when no tag says so. Both models run locally; no API calls.
- **Type filters** (Images, Captures, Quotes, Snippets) appear under the search.
- **Same vibe**: from any item, see the items most like it: how images look (CLIP), what any
  item is about (MiniLM), plus shared tags and palette.
- A **floating search pill** takes over once you scroll past the header.

**Organising**
- **Stacks**: named, coloured collections you build by hand, shown as fanned piles.
  Add an item to stacks from its overlay; rename, recolour or delete stacks.
- **Tags**: add or remove your own alongside the AI's; **Manage tags** renames, merges or
  deletes tags across the whole library, several at once, and suggests merging look-alikes
  (gradients / gradient).
- **Select several items** (Ctrl- or Shift-click) to add them to a stack, tag them or delete
  them together.
- **Notes** on any item.

**Keeping it safe**
- **Runs in the tray**: closing the window keeps Tessera running so the extension can always
  save. Optionally starts at login (installed app).
- **Trash with undo**: deleting shows an *Undo*; the trash (in the sidebar) keeps deleted
  items for 30 days, and clicking one restores it.
- **Back up** the whole library (database and files) to a folder you choose.

**Viewing**
- A masonry grid of cards with captions; full-page captures show their top.
- **Light and dark mode**, and **three card sizes** (large, medium, small), from the sidebar.
  Both are remembered; the theme follows the system until you pick one.
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
| `npm test` | Run the tests (plain Node, no framework): parsing, the quote rule, scoring. |
| `npm run build` | Type-check, then build to `out/`. |
| `npm run pack` | Build and package an unpacked app into `release/` (quick check). |
| `npm run dist` | Build the Windows installer, `release/Tessera Setup <version>.exe` (~140 MB). |

---

## The Chrome extension

The extension lives in [`extension/`](extension) and needs no build step.

1. Start Tessera.
2. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**
   and choose the `extension` folder.
3. The extension's options page opens. Click **Connect**: it shows a four-digit code, and
   Tessera comes forward asking to allow a browser extension. If the codes match, click
   **Allow**. The options page then says *Connected to Tessera*; no key to copy.
   *Settings → Extension → Disconnect all* stops every connected browser until it connects again.

After editing anything in `extension/`, click the reload icon on the extension's card in
`chrome://extensions`.

| How | What it saves |
| --- | --- |
| Right-click an image → *Add to Tessera* | the image (as an **Image**), at the largest size the site offers; also pictures inside links or under overlays (Pinterest, Instagram) |
| Select text, right-click → *Add to Tessera* | a **Quote** or **Snippet** |
| Right-click the page → *Capture an area…* / *Capture visible area* | a **Capture** |
| Toolbar popup | visible area, full page, selected area, delayed capture, or selected text |
| `Alt+Shift+S` | selected area (drag a box; `Enter` takes the whole view, `Esc` cancels) |

Change the shortcut at `chrome://extensions/shortcuts`. Chrome doesn't let extensions run on
its own pages (the New Tab page, `chrome://` pages, the Web Store), so nothing happens there.

---

## AI analysis

Tessera is free. The AI part runs on **your own API key**, so you pay your provider directly for
what you use, or nothing at all with a **local model**.

Open **Settings → AI**:

- **Cloud providers**: paste a key on the Anthropic, OpenAI or Gemini card and click **Save**.
  *Get key* opens that provider's key page.
- **Local & gateways**: **Ollama** is found automatically while it's running; pick one of its
  models. An **OpenAI-compatible server** (LM Studio, LiteLLM, vLLM…) takes a base URL and an
  optional key. **OpenRouter** gives one key for hundreds of models.

Every card has **Test connection** and a **Models** list fetched from the provider; *Set default*
picks the model it uses, or type any model ID into the filter. Keys are kept per provider and
encrypted with your OS keychain. **Active model** at the top (or the switch on a card) chooses
which provider answers; the first one you set up starts answering on its own.

| Provider | Needs | Default model |
| --- | --- | --- |
| Anthropic | API key | `claude-opus-5` |
| OpenAI | API key | `gpt-4o-mini` |
| Google Gemini | API key | `gemini-2.5-flash` |
| OpenRouter | API key | `google/gemini-2.5-flash` |
| Ollama | Ollama running on this computer | pick one from its list |
| OpenAI-compatible server | its base URL, a key if it asks | pick one from its list |

Any model that accepts images works; the defaults are only starting points. For Claude,
`claude-haiku-4-5` is a much cheaper option than the default.

- **New saves** are analysed automatically once a key is set.
- **Existing items**: *Analyse now* in Settings → AI queues everything not yet analysed.
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
- **The sidebar**, from the bottom up: Settings, the trash, the card-size button (2×2, 3×3 or
  4×4 icon; click to cycle) and the sun/moon theme button.
- **Click a card** to open it. Click outside the card or press `Esc` to close; arrow keys
  move between items while it's open.
- **Search**: click the search (or `Ctrl+K`) to see the type filters; pick one, type words,
  press `Enter` to keep a word as a chip. `Backspace` in an empty search removes the last chip.
- **Same vibe**: in an item's overlay, bottom left. Clear it with the × on its chip.
- **Select several**: `Ctrl`-click cards to toggle them, `Shift`-click to select a run. While
  anything is selected a plain click toggles too; a bar at the bottom offers Add to stack, Add
  tags and Delete. `Esc` clears the selection.
- **Delete** moves to the trash and shows a banner with *Undo* and a link to the trash. The
  **trash** (the bin icon above Settings) shows deleted items; click one to restore it, or
  *Empty trash*. *Settings → General* backs up the library and opens *Manage tags*.
- **Closing the window** leaves Tessera in the tray. Quit from the tray icon.
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
| `Delete` | grid | move the selected item to the trash (with Undo) |
| `Ctrl`-click / `Shift`-click | grid | select several / a run |
| `Esc` | grid | clear the multi-selection |
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
  must carry the extension's key, so web pages that find the port can't write to the library.
  The extension gets the key by **pairing**: `POST /pair` is the one call without it, it is
  refused unless it comes from a browser extension (web pages can't fake that `Origin`), and
  Tessera hands the key over only after you click *Allow* on a dialog showing the same code
  the extension shows. One request at a time; unanswered for two minutes counts as no.
  Endpoints: `POST /pair`, `GET /ping`, `POST /image?source=&title=&kind=`, `POST /text`,
  `POST /items/:id/tags`.
- **Images in the window** load through a private `tessera://` protocol with a path check,
  never `file://`.
- **Local models** (`src/main/embed.ts`, run with onnxruntime in the main process):
  **CLIP** (`Xenova/clip-vit-base-patch32`) gives each image a vector for how it looks;
  **MiniLM** (`Xenova/all-MiniLM-L6-v2`) gives each item a vector for what its words mean
  (title, TLDR, tags, body, note, visible text), re-embedded when that text changes. Both are
  computed in the background and stored in their own tables.
- **Search** runs in the renderer over the loaded library. After a 250 ms pause the phrase also
  goes to CLIP's text encoder (images ≥ 0.25 and within 0.03 of the best) and to MiniLM (items
  ≥ 0.30 and within 0.25 of the best); both map onto a common 0–1 relevance. Word matches rank
  first, then relevance. CLIP's own text-to-text scores were too flat to use for words.
- **Same vibe**: two images score 55% visual, 25% meaning, 10% tags, 10% palette; two text
  items 75% meaning, 25% tags; mixed pairs 45% meaning, 35% tags, 20% palette. Matches above
  20% are kept, up to 40. The formulas live in `src/main/scoring.ts`, which `npm test` covers.
- **Trash** sets `deleted_at`; trashed items are hidden everywhere and purged with their files
  after 30 days. **Backup** uses SQLite's online backup, so it's consistent while Tessera runs.
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
    embed.ts       local CLIP and MiniLM embeddings, indexing, search
    scoring.ts     pure parsing and scoring (tested)
    tray.ts        tray icon, start at login
    settings.ts    settings.json, extension key, encrypted AI key
  preload/       the typed bridge between main and renderer
  renderer/      React app
    src/App.tsx        layout, search, chips, selection, undo
    src/Sidebar.tsx    wordmark, theme, card size, trash, settings
    src/prefs.ts       theme and card size, kept in localStorage
    src/Grid.tsx       virtualised masonry grid
    src/Detail.tsx     item overlay
    src/Stacks.tsx     stacks page and dialog
    src/Settings.tsx   settings dialog
    src/Selection.tsx  multi-select action bar
    src/Tags.tsx       tag manager
    src/Trash.tsx      the trash page
    src/Filters.tsx    filters, chips, icons
  shared/api.ts  types and helpers shared by main and renderer
extension/       Chrome extension (Manifest V3, plain JS)
test/            npm test
build/icon.png   app icon
project.md       product spec: the problem, principles, status and what's next
PRODUCT.md       short product brief used for design work (users, positioning, principles)
MILESTONE.md     milestone status and the decisions behind the design
```

## Data and privacy

Everything is stored in Electron's user-data folder, on Windows
`%APPDATA%\tessera\`:

| Path | Contents |
| --- | --- |
| `tessera.db` | SQLite database: items, tags, stacks, vectors |
| `library/` | original files, named by hash |
| `thumbs/` | 480 px WebP thumbnails |
| `settings.json` | extension key, AI provider and model, AI key (encrypted) |
| `models/` | local models, downloaded on first use: CLIP image (~85 MB) and text (~60 MB), MiniLM (~23 MB) |

- The **AI key** is encrypted with the operating system's secure storage (Electron
  `safeStorage`) and never reaches the renderer.
- During analysis, the item (a resized JPEG, or its text) is sent to the AI provider you chose.
  Nothing else leaves your computer.
- None of this data is in the repository.

## Known limitations

- **Windows first.** The installer is Windows x64 only and not code-signed, so SmartScreen
  warns on first run. macOS uses its native window buttons, but the app hasn't been tested on
  macOS or Linux; their builds would also need the onnxruntime binaries the Windows build drops.
- **Full-page capture** scrolls and stitches screenshots. Pages that scroll an inner element
  come out as one screen, and very long pages are cut at about 20,000 px.
- **One filter at a time** (a kind, a stack or same vibe), plus any number of word chips.
- The default OpenAI model name may need updating to a current one.

## Roadmap

- Tessera's own visual identity, replacing the current mymind-like look (in progress)
- Smart stacks: a stack defined by a saved search
- Creative DNA attributes from `project.md` as structured, filterable facets
- Restoring from a backup inside the app (today: copy the backup's files back while Tessera is closed)
- A macOS build, and code signing
- Merging stacks
