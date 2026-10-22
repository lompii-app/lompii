# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(An Electron desktop app, Windows first, with a Chrome extension. Its design language is web, not native iOS or Android.)

## Users

Creative people broadly: designers, illustrators, photographers, writers and anyone else who collects inspiration. They save references while browsing (images, page captures, quotes, snippets) and come back to them when they start work, often remembering only roughly what they saved.

## Product Purpose

A personal visual memory. Save anything; Tessera understands it; find it when you need it. The problem isn't storing references but finding them again later, when you remember "a dark website with huge typography" but not the site, the file name or the folder. Success is finding the thing you half-remember, fast.

## Positioning

- **Finds what you remember.** Describe something vaguely and it's found: by how it looks (local CLIP image embeddings) and by what it means (local MiniLM text embeddings), alongside words, tags and the AI's summary.
- **Local and private.** The library, database, models and keys live on the user's computer. The only thing that leaves it is the item the user chooses to send to their own AI provider.
- **A tool for makers.** Practical, working-designer detail: page captures, colour palettes with copyable hex codes, source links, stacks, notes, bulk actions.
- **Bring any AI.** Works with any provider's API key (Anthropic, OpenAI, Gemini, OpenRouter, any OpenAI-compatible server) or a local model; not tied to one company.

## Operating Context

- Saving happens mostly from the browser via the Chrome extension: right-click an image or selected text, or capture a visible area, full page or selected area (Alt+Shift+S). Drag-and-drop and paste also work.
- Tessera runs in the tray so the extension can always save; the home is opened to browse, search, and pull references into work.
- Used alongside design tools and the browser, at desk scale, often in short visits: open, find, copy or open the source, leave.

## Capabilities and Constraints

- Kinds: Image, Capture (page screenshot), Quote, Snippet.
- AI analysis per item: title, TLDR, tags (reusing existing tags), visible text.
- Search: words and combinable word chips, kind filters, natural-language search by look and meaning, "same vibe" similarity.
- Organising: stacks (user-made, coloured collections), tags, notes, multi-select bulk actions, trash with undo (30 days), backup.
- Detail view: dominant-colour stage, four-colour palette, source link, TLDR, tags, notes, download, copy, add to stack, delete.
- Display settings: light and dark mode; three card sizes.
- Electron + React + Tailwind v4; library in a local SQLite database; images served from the user's own disk.

## Brand Commitments

- Name: Tessera (a single tile in a mosaic). The current mark is a 2×2 tile grid with one orange tile (`build/icon.png`, `extension/icons/`).
- The current interface is explicitly a mymind-like clone and is to be replaced with Tessera's own identity. mymind is an anti-reference, not a model.
- Visual direction (chosen by the user, 22 Oct 2026): simple, clean and premium, in the spirit of the current app rather than a themed world. The polish bar is set by Linear, Arc, Things 3 / Apple's apps, and Raycast / Eagle. Themed concepts (museum register, design annual, acetate manual, split-flap board) were shown and declined.

## Evidence on Hand

- The user's real library: images, captures and text saved from the web, with AI titles, TLDRs and tags.
- No testimonials, customers, metrics or press exist; none may be invented.

## Product Principles

1. Finding beats filing: the library should surface things without demanding organisation up front.
2. The user's references are the content; the interface stays out of their way.
3. Private by default: say plainly what leaves the machine, and nothing else does.
4. Fast, keyboard-friendly, desk-scale: a working tool opened many times a day.
