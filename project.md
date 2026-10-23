# lompii

## Product

lompii is a personal visual memory: a desktop app and a Chrome extension for saving the things that inspire you, and finding them again by describing what you remember.

It is for creative people broadly: designers, illustrators, photographers, writers, anyone who collects inspiration.

### Core promise

> Save anything. lompii understands it. Find it when you need it.

### What it stands on

- **Finds what you remember.** Describe something vaguely and it's found, by how it looks and by what it means, not only by the words you typed.
- **Local and private.** The library, database, models and keys live on your computer. The only thing that leaves it is an item you send to your own AI provider.
- **A tool for makers.** Page captures, palettes with copyable hex codes, source links, stacks, notes, bulk actions.
- **Bring any AI.** Any provider's API key (Anthropic, OpenAI, Gemini, OpenRouter, any OpenAI-compatible server) or a local model.

---

# The Problem

Creative people constantly save references: website screenshots, UI, images, typography, palettes, product designs, illustrations, ads, photography, quotes, passages of text.

Over time they scatter across downloads, screenshot folders, bookmarks, Pinterest, Notion, Figma and phone galleries.

The problem is not storing them. It is finding them later.

A user may remember:

> "I saved a dark website with huge typography and an interesting hero."

But not the website's name, the file name, the folder, the date or where they saved it. lompii lets them describe what they remember and get it back.

---

# Core Product Philosophy

lompii is a personal visual memory. It is not a social network, discovery feed, generic gallery or project-management tool.

It prioritises, in order:

1. Capture
2. Understanding
3. Retrieval
4. Reuse

It stays focused on the user's own saved references.

### The loop

Save → AI understands → (optionally) organise → forget → describe → find → reuse

The product succeeds when something saved today is found months later.

---

# Capture

Saving is deliberate and happens mostly from the browser. (An early version watched the Screenshots folder; it was removed because most screenshots are taken for something else and flooded the library.)

- **Chrome extension:** right-click an image or selected text → *Add to lompii*; or capture the visible area, the full page, a selected area (`Alt+Shift+S`), the visible area after a 3-second delay, or the selected text, from the toolbar popup. A toast on the page offers *Add tags*.
- **In the app:** drag and drop image files, or paste an image.
- Everything from the web keeps its source URL and page title.
- lompii runs in the tray so the extension can always save.

---

# The Reference

Each saved item has a **kind**:

- **Image**: an image saved from a page or dropped in.
- **Capture**: a screenshot of a page or part of one.
- **Quote**: saved text containing a quoted span (`"…"`, `“…”`).
- **Snippet**: any other saved text.

And four layers:

- **Asset:** the file or the text.
- **Source:** URL, site, page title, date saved. The source can be opened from the item.
- **User context:** title, notes, tags, stacks.
- **AI understanding:** title, a one- or two-sentence TLDR, search tags, text read off the image, a four-colour palette (extracted locally), and two local embeddings: CLIP for how an image looks, MiniLM for what the item's words mean.

---

# Understanding

One model call per item, through whichever provider the user configured, returns:

- a short descriptive **title**,
- a **TLDR**,
- **6–10 search tags**: subject, style, mood, colours, medium, layout and typography where they matter. The model is given the library's most-used tags to reuse, and near-duplicates (motivational / motivation) fold into the existing tag. Kind words (image, quote, snippet…) are never tags.
- **visible text**, verbatim, so words inside an image are searchable.

Free-form tags replaced the original idea of a strict "Creative DNA" vocabulary (Category, Theme, Style, Typography, Composition, Visual Effects, Elements, each with cardinality limits): free tags searched better in practice. Creative DNA remains a candidate for structured, filterable facets later (see Later).

Rate limits and overloaded providers are retried. Failures show the provider's error with *Try again*.

---

# Retrieval

Search is the primary way people use lompii.

- **Words** match titles, tags, TLDRs, notes, quote and snippet text, and text inside images. `Enter` turns a word into a chip; chips combine, so every one must match.
- **Description**: the phrase also goes to CLIP (images that look like it) and MiniLM (items whose words mean it). "mountains landscape" finds the mountain illustration; "an AI meeting assistant" finds the Natively pages. Word matches rank first, then relevance.
- **Kind filters** under the search: Images, Captures, Quotes, Snippets.
- **Same vibe** from any item: items that look alike (CLIP), are about the same thing (MiniLM), share tags, and share colours.

Combinations are queries, not a separate product: there is no Explore page of attribute pair counts, and filter panels are not the primary interface.

---

# Organisation

One organising concept the user makes: the **stack**, a named, coloured collection. An item can be in any number of stacks. Work for a client is just a stack named after it. Stacks are separate from tags; tags are for finding, stacks are for gathering.

Also: notes on any item, multi-select (Ctrl/Shift-click) to stack, tag or delete many at once, a tag manager (rename, merge, delete across the library), a trash that keeps deleted items 30 days, and a library backup.

No projects, sub-sections or nested stacks. Revisit if users ask for structure inside a stack.

---

# What lompii Is NOT

Do not turn lompii into:

* A Pinterest clone
* A social network
* A public inspiration feed
* A generic image gallery
* A project management system
* A generic AI chatbot
* A discovery or recommendation engine

Do not build an Explore page based on attribute combinations and counts. Do not build "show me things unlike my usual references". Do not make filter panels the primary interface. Do not add analytics about the user's library. And do not look like mymind: lompii has its own identity.

Stay focused on:

> Saving, understanding, and retrieving personal references.

---

# Status

| Milestone | State |
| --- | --- |
| M1 Capture | Done: Chrome extension (images, text, captures), drag and drop, paste, tray. |
| M2 Understanding | Done: title, TLDR, tags, visible text; palettes; any provider. |
| M3 Retrieval | Done: words and chips, kind filters, search by look (CLIP) and meaning (MiniLM), same vibe. |
| M4 Collections | Manual stacks done. Smart stacks (saved searches) not started. |

Also done: trash with undo, backup, multi-select, tag manager, light and dark mode, three card sizes, a verified Windows installer. Details and decisions: [MILESTONE.md](MILESTONE.md). Setup: [README.md](README.md).

Under way: replacing the mymind-like interface with lompii's own visual identity, starting with the home.

## Later

- Smart stacks: a stack defined by a saved search, updating as matching items arrive.
- Creative DNA attributes as structured, filterable facets.
- Prompt generation: describe a reference's design principles as a prompt, rather than "make this exactly". Secondary; it must not shape the architecture.
- Restoring a backup inside the app; merging stacks.
- macOS build, code signing, sync across devices.

---

# Prioritisation rule

When deciding whether something belongs now, ask one question: does it make a saved reference easier to find later? If not, it waits.

---

# Definition of Success

A user should be able to:

1. Save hundreds of references.
2. Never manually organise most of them.
3. Come back weeks or months later.
4. Describe what they remember.
5. Find the reference quickly.

If that works, lompii is solving its core problem.
