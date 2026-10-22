// Same port as EXTENSION_PORT in src/shared/api.ts.
const API = 'http://127.0.0.1:47821'

const MESSAGES = {
  nokey: 'Connect the extension to Tessera in its options first.',
  badkey: 'Tessera disconnected this browser. Connect it again in the options.',
  offline: "Couldn't reach Tessera. Is the app open?",
  download: "Couldn't download this image.",
  capture: "Chrome wouldn't let Tessera capture this page.",
  'not an image': "That doesn't look like an image.",
  'empty text': 'Select some text first.',
  noimage: "There's no picture under the pointer to save."
}

// Rebuilt every time the worker starts, not only on install: turning the extension off and on
// (and some browser restarts) can drop the items without firing onInstalled.
chrome.contextMenus.removeAll(() => {
  // links too: many sites wrap pictures in links or cover them, so the browser sees only a link
  chrome.contextMenus.create({ id: 'save', title: 'Add to Tessera', contexts: ['image', 'selection', 'link'] })
  // page background only, so right-clicking an image still offers "Add to Tessera" directly
  chrome.contextMenus.create({ id: 'capture-area', title: 'Capture an area…', contexts: ['page', 'frame'] })
  chrome.contextMenus.create({ id: 'capture-view', title: 'Capture visible area', contexts: ['page', 'frame'] })
})

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage()
  // content scripts only reach pages loaded from now on; give tabs already open pointer.js too
  chrome.tabs.query({}).then((tabs) => {
    for (const tab of tabs)
      chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['pointer.js'] }).catch(() => {})
  })
})

async function call(path, init = {}) {
  const { token } = await chrome.storage.local.get('token')
  if (!token) throw new Error('nokey')
  let res
  try {
    res = await fetch(API + path, { ...init, headers: { ...init.headers, authorization: `Bearer ${token}` } })
  } catch {
    throw new Error('offline')
  }
  if (res.status === 401) throw new Error('badkey')
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'failed')
  return data
}

const postJson = (path, data) =>
  call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })

const postImage = (blob, meta) =>
  call(`/image?${new URLSearchParams(meta)}`, {
    method: 'POST',
    headers: { 'content-type': blob.type || 'application/octet-stream' },
    body: blob
  })

// Fetched here rather than by Tessera so the browser's cookies apply to the image request.
async function saveImage(src, meta) {
  let blob
  try {
    const res = await fetch(src)
    if (!res.ok) throw new Error()
    blob = await res.blob()
  } catch {
    throw new Error('download')
  }
  return postImage(blob, meta)
}

// the first that downloads: a site's largest size can refuse where the one on screen works
async function saveFirst(srcs, meta) {
  for (const [i, src] of srcs.entries()) {
    try {
      return await saveImage(src, meta)
    } catch (e) {
      if (e.message !== 'download' || i === srcs.length - 1) throw e
    }
  }
}

// info.selectionText flattens line breaks; read the live selection when the page allows it.
async function selectedText(info, tabId) {
  try {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [info.frameId ?? 0] },
      func: () => getSelection()?.toString()
    })
    if (r?.result?.trim()) return r.result
  } catch {}
  return info.selectionText
}

// what pointer.js noted at the right-click, in the frame that was clicked: URLs, best first
async function pictureUnderPointer(info, tabId) {
  try {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [info.frameId ?? 0] },
      func: () => globalThis.tesseraImage ?? null
    })
    return r?.result ?? null
  } catch {
    return null
  }
}

function failure(e) {
  if (e.message === 'nokey' || e.message === 'badkey') chrome.runtime.openOptionsPage()
  return { ok: false, message: MESSAGES[e.message] ?? 'Something went wrong.' }
}

const showToast = (tabId, state) =>
  chrome.scripting.executeScript({ target: { tabId }, func: toast, args: [state] }).catch(() => {})

/* ---------- capture ---------- */

// The tab's screenshot is in device pixels; the picked rect is in CSS pixels of a viewport
// `vw` wide, so the ratio between the two covers both screen scaling and page zoom.
async function crop(dataUrl, { x, y, w, h, vw }) {
  const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob())
  const s = bmp.width / vw
  const canvas = new OffscreenCanvas(Math.round(w * s), Math.round(h * s))
  canvas.getContext('2d').drawImage(bmp, x * s, y * s, w * s, h * s, 0, 0, canvas.width, canvas.height)
  return canvas.convertToBlob({ type: 'image/png' })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const run = async (tabId, func, args = []) =>
  (await chrome.scripting.executeScript({ target: { tabId }, func, args }))[0]?.result

async function grab(windowId) {
  try {
    return await chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
  } catch {
    throw new Error('capture')
  }
}

// ponytail: scroll-and-stitch. Pages that scroll an inner element instead of the window come
// out as one screen, and very tall pages are cut at what one canvas can hold. Chrome's
// debugger API captures beyond the viewport properly, at the cost of a "being debugged" bar.
async function capturePage(tab) {
  const page = await run(tab.id, () => ({
    height: document.documentElement.scrollHeight,
    view: innerHeight,
    vw: innerWidth,
    dpr: devicePixelRatio,
    from: scrollY
  }))
  const height = Math.min(page.height, Math.floor(30000 / page.dpr)) // canvas side limit is ~32k px
  const shots = []
  try {
    for (let y = 0; y < height; y += page.view) {
      const at = await run(
        tab.id,
        (y, first) => {
          scrollTo(0, y)
          // sticky headers and floating buttons would repeat in every strip after the first
          if (!first)
            for (const el of document.querySelectorAll('body *')) {
              const { position } = getComputedStyle(el)
              if ((position === 'fixed' || position === 'sticky') && !el.hasAttribute('data-tessera-hidden')) {
                el.setAttribute('data-tessera-hidden', el.style.visibility)
                el.style.visibility = 'hidden'
              }
            }
          // wait for a repaint; the timeout covers tabs Chrome isn't painting (rAF never fires there)
          return new Promise((r) => {
            requestAnimationFrame(() => requestAnimationFrame(() => r(scrollY)))
            setTimeout(() => r(scrollY), 300)
          })
        },
        [y, y === 0]
      )
      if (shots.length) await sleep(550) // Chrome allows two captures a second
      shots.push({ at, url: await grab(tab.windowId) })
    }
  } finally {
    await run(
      tab.id,
      (from) => {
        for (const el of document.querySelectorAll('[data-tessera-hidden]')) {
          el.style.visibility = el.getAttribute('data-tessera-hidden')
          el.removeAttribute('data-tessera-hidden')
        }
        scrollTo(0, from)
      },
      [page.from]
    )
  }

  const bitmaps = await Promise.all(shots.map(async (s) => createImageBitmap(await (await fetch(s.url)).blob())))
  const s = bitmaps[0].width / page.vw
  const canvas = new OffscreenCanvas(bitmaps[0].width, Math.round(height * s))
  const ctx = canvas.getContext('2d')
  // the last strip is drawn where the page actually stopped scrolling, overlapping the one before
  bitmaps.forEach((bmp, i) => ctx.drawImage(bmp, 0, Math.round(shots[i].at * s)))
  return canvas.convertToBlob({ type: 'image/webp', quality: 0.92 })
}

// mode: 'area' | 'view' | 'delay' | 'page' | 'text'
async function capture(tab, mode) {
  if (tab?.id == null) return
  let area = 'view'
  try {
    if (mode === 'area') area = await run(tab.id, pickArea)
    if (mode === 'text') area = await run(tab.id, () => getSelection()?.toString())
  } catch {
    return // Chrome doesn't allow scripts here (chrome:// pages, the Web Store)
  }
  if (!area) {
    if (mode === 'text') showToast(tab.id, { ok: false, message: MESSAGES['empty text'] })
    return // nothing selected, or the area pick was cancelled
  }

  const meta = { source: tab.url ?? '', title: tab.title ?? '' }
  let state
  try {
    let result
    if (mode === 'text') result = await postJson('/text', { text: area, ...meta })
    else {
      if (mode === 'delay') await sleep(3000)
      const blob =
        mode === 'page'
          ? await capturePage(tab)
          : area === 'view'
            ? await (await fetch(await grab(tab.windowId))).blob()
            : await crop(await grab(tab.windowId), area)
      result = await postImage(blob, { ...meta, kind: 'capture' })
    }
    state = { ok: true, id: result.id }
  } catch (e) {
    state = failure(e)
  }
  showToast(tab.id, state)
}

chrome.commands.onCommand.addListener((command, tab) => command === 'capture-area' && capture(tab, 'area'))

/* ---------- context menu ---------- */

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'capture-area') return capture(tab, 'area')
  if (info.menuItemId === 'capture-view') return capture(tab, 'view')

  const meta = { source: info.pageUrl ?? tab?.url ?? '', title: tab?.title ?? '' }
  let state
  try {
    const srcs =
      info.mediaType === 'image' && info.srcUrl ? [info.srcUrl] : info.selectionText ? null : await pictureUnderPointer(info, tab.id)
    if (!srcs?.length && !info.selectionText) throw new Error('noimage')
    const { id } = srcs?.length
      ? await saveFirst(srcs, meta)
      : await postJson('/text', { text: await selectedText(info, tab.id), ...meta })
    state = { ok: true, id }
  } catch (e) {
    state = failure(e)
  }
  if (tab?.id != null) showToast(tab.id, state)
})

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'capture') {
    reply() // let the popup close; the capture runs on without it
    chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => capture(tab, msg.mode))
    return
  }
  if (msg?.type === 'ping') {
    call('/ping').then(
      () => reply({ ok: true }),
      (e) => reply({ ok: false, message: MESSAGES[e.message] ?? 'Something went wrong.' })
    )
    return true // reply is async
  }
  if (msg?.type === 'tags') {
    postJson(`/items/${msg.id}/tags`, { tags: msg.tags }).then(
      () => reply({ ok: true }),
      () => reply({ ok: false })
    )
    return true
  }
})

// Injected into the page, so it must be self-contained: no outer variables. Resolves to the
// dragged rect, 'view' for the whole visible area (Enter), or null if cancelled (Esc).
function pickArea() {
  return new Promise((resolve) => {
    if (document.getElementById('tessera-pick')) return resolve(null) // already picking
    const host = document.createElement('div')
    host.id = 'tessera-pick'
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;cursor:crosshair'
    const root = host.attachShadow({ mode: 'closed' })
    root.innerHTML = `<style>
      .shade { position: fixed; inset: 0; background: rgb(15 20 30 / .35) }
      .box { position: fixed; display: none; box-sizing: border-box; border: 2px solid #ff5a1f;
        border-radius: 4px; box-shadow: 0 0 0 100vmax rgb(15 20 30 / .35) }
      .hint { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); padding: 8px 16px;
        border-radius: 999px; background: #fff; color: #1d2026; font: 13px/1.4 system-ui, sans-serif;
        box-shadow: 0 6px 20px rgb(30 40 60 / .15); white-space: nowrap }
    </style>
    <div class="shade"></div><div class="box"></div>
    <div class="hint">Drag to capture · Enter for the whole view · Esc to cancel</div>`
    const shade = root.querySelector('.shade')
    const box = root.querySelector('.box')
    const hint = root.querySelector('.hint')
    let start = null
    let rect = null

    const finish = (result) => {
      removeEventListener('keydown', onKey, true)
      host.remove()
      // two frames, so the overlay is off the screen before the capture is taken (or 300 ms,
      // if Chrome isn't painting the tab and rAF never fires)
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(result)))
      setTimeout(() => resolve(result), 300)
    }
    const onKey = (e) => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return
      e.preventDefault()
      e.stopPropagation()
      finish(e.key === 'Enter' ? 'view' : null)
    }
    addEventListener('keydown', onKey, true)

    host.addEventListener('mousedown', (e) => {
      e.preventDefault()
      start = { x: e.clientX, y: e.clientY }
    })
    host.addEventListener('mousemove', (e) => {
      if (!start) return
      rect = {
        x: Math.min(start.x, e.clientX),
        y: Math.min(start.y, e.clientY),
        w: Math.abs(e.clientX - start.x),
        h: Math.abs(e.clientY - start.y)
      }
      shade.style.display = hint.style.display = 'none' // the box's shadow dims the rest
      Object.assign(box.style, {
        display: 'block',
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.w}px`,
        height: `${rect.h}px`
      })
    })
    host.addEventListener('mouseup', () => {
      if (!start) return
      start = null
      if (rect && rect.w >= 8 && rect.h >= 8) return finish({ ...rect, vw: innerWidth })
      rect = null // a click, not a drag: keep waiting
      shade.style.display = hint.style.display = ''
      box.style.display = 'none'
    })
    document.documentElement.append(host)
  })
}

// Injected into the page, so it must be self-contained: no outer variables.
function toast(state) {
  document.getElementById('tessera-toast')?.remove()
  const host = document.createElement('div')
  host.id = 'tessera-toast'
  host.style.cssText = 'all:initial;position:fixed;top:16px;right:16px;z-index:2147483647'
  const root = host.attachShadow({ mode: 'closed' })
  root.innerHTML = `<style>
    .card { width: 340px; overflow: hidden; border-radius: 10px; background: #fff; color: #1d2026;
      font: 15px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
      box-shadow: 0 2px 4px rgb(30 40 60 / .06), 0 14px 32px rgb(30 40 60 / .16);
      animation: in .18s ease-out }
    .head { display: flex; align-items: center; gap: 16px; padding: 20px 24px }
    svg { flex: none }
    .msg { font-size: 17px }
    .err .msg { font-size: 14px; color: #5c6370 }
    input { all: unset; box-sizing: border-box; display: block; width: 100%; padding: 14px 24px;
      background: #eef0f4; color: #1d2026; font-size: 15px }
    input::placeholder { color: #a3a9b3 }
    @keyframes in { from { opacity: 0; transform: translateY(-6px) } }
  </style>
  <div class="card"><div class="head">
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="9" height="9" rx="2.2" fill="#1d2026"/><rect x="13" y="2" width="9" height="9" rx="2.2" fill="#ff5a1f"/>
      <rect x="2" y="13" width="9" height="9" rx="2.2" fill="#1d2026"/><rect x="13" y="13" width="9" height="9" rx="2.2" fill="#1d2026"/>
    </svg>
    <span class="msg" role="status"></span>
  </div></div>`

  const card = root.querySelector('.card')
  const msg = root.querySelector('.msg')
  msg.textContent = state.ok ? 'Saved to Tessera' : state.message

  let timer
  const close = () => host.remove()
  const arm = (ms) => {
    clearTimeout(timer)
    timer = setTimeout(close, ms)
  }
  card.addEventListener('mouseenter', () => clearTimeout(timer))
  card.addEventListener('mouseleave', () => document.activeElement !== host && arm(2500))
  document.documentElement.append(host)

  if (!state.ok) {
    card.classList.add('err')
    return arm(6000)
  }

  const input = document.createElement('input')
  input.placeholder = 'Add tags'
  input.setAttribute('aria-label', 'Add tags, separated by commas')
  for (const type of ['keypress', 'keyup']) input.addEventListener(type, (e) => e.stopPropagation())
  input.addEventListener('keydown', (e) => {
    e.stopPropagation() // keep the page's own shortcuts from firing while typing
    if (e.key === 'Escape') return close()
    if (e.key !== 'Enter') return
    const tags = input.value.split(',').map((t) => t.trim()).filter(Boolean)
    if (!tags.length) return close()
    input.disabled = true
    chrome.runtime.sendMessage({ type: 'tags', id: state.id, tags }, (r) => {
      msg.textContent = r?.ok ? 'Tags added' : "Couldn't add tags"
      input.remove()
      arm(1200)
    })
  })
  input.addEventListener('focus', () => clearTimeout(timer))
  input.addEventListener('blur', () => arm(2500))
  card.append(input)
  arm(4000)
  input.focus() // stays open while focused; closes shortly after blur
}
