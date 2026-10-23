// Add a folder: which files it takes, and the line it reports at the end.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import { importSummary } from '../src/shared/api.ts'
import { findImages, toAnalyse } from '../src/main/folder.ts'

test('a folder: its images and its subfolders’, nothing hidden, no links followed', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lompii-folder-'))
  try {
    const put = (path: string) => {
      mkdirSync(join(root, path, '..'), { recursive: true })
      writeFileSync(join(root, path), '')
    }
    for (const p of ['a.png', 'B.JPEG', 'sub/deep/c.webp', 'sub/notes.txt', 'design.psd', 'Shortcut.lnk']) put(p)
    for (const p of ['.hidden.png', '.git/d.png']) put(p) // dot names: hidden everywhere
    symlinkSync(root, join(root, 'loop'), 'junction') // would never end if followed
    if (process.platform === 'win32') {
      put('cachée.png')
      put('System Volume/e.png')
      execFileSync('attrib', ['+h', join(root, 'cachée.png')])
      execFileSync('attrib', ['+s', join(root, 'System Volume')])
    }

    const { images, skipped } = await findImages(root)
    const names = images.map((p) => relative(root, p).replaceAll('\\', '/')).sort()
    assert.deepEqual(names, ['B.JPEG', 'a.png', 'sub/deep/c.webp'])
    assert.equal(skipped, 4) // notes.txt, design.psd, the shortcut, the junction
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the summary leaves out what is 0', () => {
  const p = { done: 0, total: 0, added: 0, analysing: 0, waiting: 0, had: 0, notImages: 0, unreadable: 0, finished: true }
  assert.equal(
    importSummary({ ...p, added: 112, analysing: 25, waiting: 87, had: 8, notImages: 3, unreadable: 1 }),
    "Added 112 · 25 being analysed · 87 waiting in Analyse · 8 were already in your library · 3 weren't images · 1 couldn't be read"
  )
  assert.equal(importSummary({ ...p, had: 1, notImages: 1 }), "1 was already in your library · 1 wasn't an image")
  assert.equal(importSummary(p), 'No images in that folder')
})

test('a folder import analyses only its first new items, across batches', () => {
  // batches of 4 against the default 25: whole batches, then the 25th alone, then none
  assert.deepEqual(toAnalyse([1, 2, 3, 4], 0, 25), [1, 2, 3, 4])
  assert.deepEqual(toAnalyse([21, 22, 23, 24], 20, 25), [21, 22, 23, 24])
  assert.deepEqual(toAnalyse([25, 26, 27, 28], 24, 25), [25])
  assert.deepEqual(toAnalyse([29, 30], 25, 25), [])
  assert.deepEqual(toAnalyse([1, 2, 3, 4, 5, 6, 7], 0, 5), [1, 2, 3, 4, 5])
  assert.deepEqual(toAnalyse([1, 2], 1000, 'all'), [1, 2])
  assert.deepEqual(toAnalyse([1, 2, 3], 98, 100), [1, 2])
})
