// Remembers the picture under the pointer at each right-click, so "Add to lompii" also works on
// pictures the browser doesn't offer as images: inside links, under overlays (Pinterest covers
// every pin with one), or drawn as CSS backgrounds. background.js reads it on a menu click.
// Wrapped and guarded: background.js also injects this into tabs already open at install.
;(() => {
  if (globalThis.lompiiPointer) return
  globalThis.lompiiPointer = true

  const big = (r) => r.width >= 48 && r.height >= 48 // skip icons and avatars
  const covers = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  const abs = (u) => new URL(u, document.baseURI).href

  // the largest size a srcset offers (Pinterest lists 236px up to the original), not the thumbnail
  function largest(img) {
    const options = (img.srcset || '')
      .split(',')
      .map((s) => s.trim().split(/\s+/))
      .filter(([u]) => u)
    if (!options.length) return img.currentSrc || img.src || null
    const size = ([, d = '1x']) => parseFloat(d) || 1
    return abs(options.reduce((a, b) => (size(b) > size(a) ? b : a))[0])
  }

  // the largest size first, then the one on screen in case the large one won't download
  function srcOf(el) {
    if (el instanceof HTMLImageElement) return [...new Set([largest(el), el.currentSrc || el.src].filter(Boolean))]
    if (el instanceof HTMLVideoElement) return el.poster ? [el.poster] : null
    const bg = getComputedStyle(el).backgroundImage.match(/url\(["']?(.+?)["']?\)/)
    return bg ? [abs(bg[1])] : null
  }

  // candidate URLs for the picture at x, y, best first; null if there's none
  function imageAt(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      const src = big(el.getBoundingClientRect()) && srcOf(el)
      if (src) return src
    }
    // covered by an overlay from another branch, or pointer-events: none: the biggest image there
    let best = null
    let area = 0
    for (const img of document.images) {
      const r = img.getBoundingClientRect()
      if (big(r) && covers(r, x, y) && r.width * r.height > area) {
        best = img
        area = r.width * r.height
      }
    }
    return best && srcOf(best)
  }

  addEventListener('contextmenu', (e) => (globalThis.lompiiImage = imageAt(e.clientX, e.clientY)), true)
})()
