# Tessera

## Product

Tessera is an AI-powered visual reference library.

Its purpose is to help creative people save visual references and reliably find them again later.

Users can save screenshots, images, website references, UI designs, typography, illustrations, product references, and other visual material.

Tessera automatically analyzes each reference and extracts structured visual attributes so the reference can later be found through natural language, visual similarity, or combinations of attributes.

### Core promise

> Save anything. Tessera understands it. Find it when you need it.

---

# The Problem

Creative people constantly save visual references.

They save:

* Website screenshots
* UI references
* Images
* Typography
* Color palettes
* Animations
* Product designs
* Illustrations
* Ads
* Photography
* Other visual inspiration

Over time, these references become scattered across:

* Downloads
* Screenshots
* Folders
* Browser bookmarks
* Pinterest
* Notion
* Figma
* Phone galleries

The problem is not storing the references.

The problem is finding them later.

A user may remember:

> "I saved a dark website with huge typography and an interesting hero."

But they may not remember:

* the website name
* the filename
* the folder
* the date
* where they saved it

Tessera should allow the user to describe what they remember and retrieve the reference.

---

# Core Product Philosophy

Tessera is a personal visual memory.

It is not primarily a social network, discovery feed, image gallery, or project-management tool.

The product should prioritize:

1. Capture
2. Understanding
3. Retrieval
4. Reuse

The product should remain focused on the user's own saved references.

---

# Core User Loop

The fundamental loop is:

Save
↓
AI understands
↓
Organize
↓
Forget
↓
Search
↓
Find
↓
Reuse

The product succeeds when a user can save something today and reliably find it months later.

---

# Reference

The fundamental object in Tessera is a Reference.

A Reference consists of:

## Asset

The actual saved content.

Examples:

* Image
* Screenshot
* Website capture
* Video frame

## Source

Information about where the reference came from.

Examples:

* URL
* Website
* Page title
* Capture date

## User Context

Optional information added by the user.

Examples:

* Note
* Collection

## AI Understanding

Machine-generated information about the reference.

Examples:

* Creative DNA
* OCR
* Colors
* Description
* Embedding
* Searchable attributes

---

# Creative DNA

Creative DNA is the structured visual understanding of a reference. Every
value must come from the lists below — nothing outside this vocabulary. If a
value doesn't fit, it belongs in the free-text description, not in a tag.

Each dimension has a cardinality limit. The model must not exceed it.

## Category — exactly 1

The kind of thing this reference is.

- **Website** — a full page or site view, not a single component
- **Landing Page** — a marketing or product page built to convert
- **Dashboard** — a data or admin interface, charts, tables, panels
- **Mobile UI** — a phone or app screen
- **Illustration** — a drawn or rendered graphic, not a photo
- **Photography** — a photograph
- **Product** — a physical product shot or product page
- **Logo** — a wordmark, symbol, or brand mark
- **Animation** — a motion reference (GIF, video frame, Lottie)

## Theme — exactly 1

Overall light/dark balance of the reference.

- **Dark** — dark background, light content
- **Light** — light background, dark content
- **Neutral** — grey or muted, no strong light/dark contrast
- **Colorful** — saturated, multiple strong hues dominate

## Style — 0 to 2

The overall design language. Pick the two strongest if more than one applies;
pick none if nothing fits clearly.

- **Minimal** — sparse, restrained, little decoration
- **Editorial** — reads like a magazine, type-led, generous whitespace
- **Brutalist** — raw, unstyled-looking, harsh grid, system fonts
- **Futuristic** — sci-fi cues, glow, dark + neon, 3D
- **Luxury** — premium materials or cues, serif type, restrained palette
- **Playful** — bright, rounded, illustrated, informal
- **Corporate** — safe, conventional, stock-photo-adjacent

## Typography — 0 to 3

Notable type treatment. Skip if type isn't a distinguishing feature.

- **Large Type** — type is the dominant visual element, oversized
- **Serif** — primary typeface has serifs
- **Sans Serif** — primary typeface is sans-serif
- **Monospace** — primary typeface is fixed-width
- **Condensed** — narrow, tightly-set letterforms
- **Experimental** — unconventional, custom, or distorted type

## Composition — 0 to 3

How the layout is arranged.

- **Centered** — content is centred on the page or frame
- **Split** — the layout is divided into two clear halves
- **Grid** — content arranged in a visible grid of equal units
- **Asymmetric** — deliberately unbalanced layout
- **Fullscreen** — one element fills the entire viewport
- **Dense** — many elements packed with little breathing room
- **Spacious** — few elements, large margins and gaps

## Visual Effects — 0 to 3

Surface treatment layered on top of the content.

- **Glass** — frosted/translucent panels (glassmorphism)
- **Blur** — background or element blur used deliberately
- **Grain** — visible texture or noise overlay
- **Glow** — light-emitting or neon effect
- **Gradient** — a colour gradient is a visible design choice
- **Shadow** — pronounced drop shadows or elevation
- **Border** — visible strokes/outlines as a structural device

## Elements — 0 to 4

Specific UI or layout components visible in the reference. Only tag
components that are a focal point, not everything present.

- **Hero** — a large top-of-page introductory section
- **Navigation** — a visible nav bar or menu
- **CTA** — a prominent call-to-action button or block
- **Card** — content presented in discrete card components
- **Form** — an input form is visible
- **Product UI** — an app/product interface shown in a frame or mockup

---

Dashboard and Illustration are Category values only — do not also tag them
as Elements. If the model tags a value outside a dimension's list, or
exceeds its cardinality, discard the extra and log it; do not silently keep it.

---

# Search

Search is the primary way users interact with Tessera.

Users should be able to search using natural language.

Examples:

> dark websites with huge typography

> minimal SaaS dashboards

> landing pages with interesting navigation

> purple AI websites

> references I saved for Natively

> that hero section with the mountain image

The system should translate natural-language queries into relevant metadata, semantic search, and visual similarity signals.

---

# Attribute Combinations

Attributes can be combined during search.

For example:

Dark
+
Typography
+
Editorial

or:

Light
+
Minimal
+
Dashboard
+
Glass

The combination is a search query, not a separate Explore product.

Do not build a dedicated page showing pair counts such as:

"Dark × Typography: 87 references."

That does not provide enough value by itself.

---

# Visual Similarity

A user should be able to open a reference and request:

> Find similar references.

The system should use visual embeddings and other available signals to find visually related references.

Similarity can consider:

* Composition
* Color
* Layout
* Typography
* Visual style
* Subject
* UI structure

---

# Organization

Tessera has one organizing concept: the collection. A reference can belong
to any number of collections.

## Manual collections

Created by the user. Examples: "Natively website", "Favourite hero sections".
Work for a client or product is just a collection named after it.

## Smart collections

A saved search. Defined by a query and/or attributes, for example
"Dark + Editorial + Hero". Updates automatically as matching references
are added.

There are no projects, sub-sections, or nested collections. If users ask for
structure inside a collection, revisit then.

---

# Source Tracking

Every reference should preserve its source whenever possible.

The user should be able to see:

* Original URL
* Website
* Page title
* Date saved

The user should be able to open the original source.

This solves the problem of:

> Where did I find this?

---

# OCR

Tessera should extract text from screenshots and images when useful.

This allows users to search for text that appears inside a reference.

Example:

A screenshot contains:

"Build better products with AI."

The user should be able to find the screenshot by searching for:

> Build better products

---

# Prompt Generation

Prompt generation is a secondary feature.

A user can select a reference and ask Tessera to generate a design prompt based on the reference's visual characteristics.

The prompt should describe the design principles rather than simply saying:

"Make this image exactly."

Example:

> Create a premium SaaS landing page using an editorial composition, oversized typography, generous whitespace, a restrained dark palette, subtle lavender accents, and an asymmetric product-focused hero.

Prompt generation should not determine the core architecture of Tessera.

---

# What Tessera Is NOT

Do not turn Tessera into:

* A Pinterest clone
* A social network
* A public inspiration feed
* A generic image gallery
* A project management system
* A generic AI chatbot
* A discovery engine
* A recommendation feed

Do not build a dedicated Explore page based only on combinations and counts.

Do not build "show me things unlike my usual references" as an initial feature.

Do not make filter panels the primary interface.

Do not create unnecessary analytics about the user's library.

The product should remain focused on:

> Saving, understanding, and retrieving personal visual references.

---

# MVP

The MVP proves one thing: a large personal library can be searched by
description. Build in this order. Do not start a milestone until the previous
one works well on a real library of 100+ references.

## M1: Capture (done)

Folder watch, drag and drop, multi-file, paste, grid, detail panel.

## M2: Understanding

One vision-model call per reference returning: Creative DNA (strict enums),
a two-sentence description, and visible text. Colours extracted locally.

## M3: Retrieval

Embedding per reference. Natural-language search ranked by embedding
similarity, with description and visible text as keyword signals.
Clickable attribute chips as filters. "Find similar" on any reference.

## M4: Collections

Manual collections. A smart collection is a saved search.

## Later, not MVP

Browser extension for URL and page title, prompt generation, copy metadata,
moodboards, sync.

---

# Prioritisation rule

The milestones in the MVP section are the only ordering. When deciding whether
something belongs in the current milestone, ask one question: does it make a
saved reference easier to find later? If not, it goes to "Later, not MVP".

---

# Definition of Success

A user should be able to:

1. Save hundreds of references.
2. Never manually organize most of them.
3. Come back weeks or months later.
4. Describe what they remember.
5. Find the reference quickly.

If that works, Tessera is solving its core problem.
