# lompii privacy policy

**Effective date:** 24 October 2026

lompii is a Windows desktop app and a companion Chrome extension for saving and finding visual
references. This policy covers both. The short version: your library stays on your computer.
There is no lompii account, no lompii server, no analytics, and nothing is sold.

## What lompii stores, and where

Everything the app keeps is in one folder on your computer, `%APPDATA%\lompii\`:

| What | Where |
| --- | --- |
| Your saved images, captures, quotes and snippets, with the page address and title each came from | `library/`, `thumbs/` and `lompii.db` |
| Titles, summaries, tags, notes, stacks, colours and search data | `lompii.db` |
| The search models | `models/` |
| Your settings, including any AI keys | `settings.json` |

- AI keys are encrypted with Windows' own data protection (Electron `safeStorage`) before they're
  written, and are only ever decrypted inside the app to call the provider you chose.
- The optional archive PIN is never stored. Only a salted hash of it is kept. The PIN locks the
  archive inside lompii; it does not encrypt your files.
- Deleted items stay in the trash for 30 days, then they and their files are removed.
- Backups go only to a folder you pick.
- Uninstalling lompii leaves this folder in place. Delete `%APPDATA%\lompii\` to remove your
  library for good.

The Chrome extension stores one thing in the browser (`chrome.storage.local`): the key lompii
gives it when you approve the connection. It keeps no record of what you save or browse.

## What never leaves your computer

- Your library: files, database, notes, stacks and backups.
- Searching. Search by description and *Same vibe* run on local models (CLIP and MiniLM) on your
  computer. Search words are never sent anywhere.
- Anything passed between the extension and the app. They talk only over `127.0.0.1` (your own
  computer), never over the internet.

## What does go over the network

lompii makes these connections, and no others:

1. **The AI provider you choose, if you choose one.** AI is optional and off until you add a
   provider in Settings. When an item is analysed, or you ask for a prompt, lompii sends that
   provider:
   - the image (resized to at most 1568 px on its long side) or the text you saved,
   - the name of the website it came from and the page title, if there is one,
   - up to 80 of the tags already in your library, so the AI reuses them instead of inventing
     near-duplicates,
   - your API key, to sign the request.

   Testing a provider or listing its models in Settings also sends your key to that provider. What
   the provider does with the request is governed by its own privacy policy (Anthropic, OpenAI,
   Google, OpenRouter, or whoever runs the server you entered). With Ollama, or a compatible server
   running on your own computer, nothing leaves your computer at all.
2. **Hugging Face, once.** The search models are downloaded from Hugging Face the first time
   they're needed (about 170 MB) and saved in `models/`. After that they load from disk. No
   library data is sent; it's an ordinary file download.
3. **GitHub Releases, to check for updates.** lompii asks GitHub whether a newer version has been
   released. No library data is sent; GitHub sees an ordinary web request.
4. **Links you open.** Opening an item's source page, an AI provider's key page, or lompii's
   GitHub page opens it in your default browser, which then works as it always does.

## The Chrome extension

The extension asks for these permissions:

| Permission | Why |
| --- | --- |
| Access to all sites (`<all_urls>`) | You can save from any page, so it needs to take screenshots of the page you're on, read the text you've selected, and download the image you right-clicked. |
| Content script on all sites (`pointer.js`) | When you right-click, it notes the address of the picture under the pointer, so *Add to lompii* works on pictures inside links or under overlays. It stays in the page and is only read if you choose *Add to lompii*. |
| `scripting` | To show the area picker and the "Saved to lompii" note on the page, and to read your selection. |
| `contextMenus` | The *Add to lompii* and capture items in the right-click menu. |
| `storage` | To keep the key from connecting to the app. |
| `offscreen` | A hidden page that tells the extension whether Chrome is in dark mode, to pick the right toolbar icon. |

The extension acts only when you use it: a right-click menu item, the toolbar popup or the
`Alt+Shift+S` shortcut. Then it sends what you chose to save (the image, capture or text, the
page address and page title, and any tags you type) to the lompii app at `127.0.0.1`. It sends
nothing else, and nothing to any other server. The one exception is downloading the image you
right-clicked from the website it's on, which the browser does with your existing access to
that site.

The app only accepts the extension after you approve it in lompii by matching a four-digit code.
Web pages can't connect to it.

Data the extension handles is used only to save what you asked to save. It isn't sold, shared
with third parties, used for advertising, or used to decide creditworthiness or lending.

## What lompii doesn't do

- No accounts or sign-in.
- No analytics, telemetry, tracking or crash reporting.
- No ads.
- No selling, renting or sharing of your data. There's no lompii server to send it to.

## Changes

If this policy changes, the new version will be published in this file, with a new effective date.
Its history is in the [repository](https://github.com/Brosski224/lompii/commits/main/PRIVACY.md).

## Contact

Questions or concerns: open an issue at <https://github.com/Brosski224/lompii/issues>.
