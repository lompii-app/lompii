// Add a folder: which files it takes, and the line it reports at the end.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import { importSummary } from '../src/shared/api.ts'
import { findImages } from '../src/main/folder.ts'

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
  const p = { done: 123, total: 123, finished: true }
  assert.equal(importSummary({ ...p, added: 112, had: 8, skipped: 3 }), 'Added 112 · 8 were already in your library · 3 skipped')
  assert.equal(importSummary({ ...p, added: 0, had: 1, skipped: 0 }), '1 was already in your library')
  assert.equal(importSummary({ ...p, added: 0, had: 0, skipped: 0 }), 'No images in that folder')
})
