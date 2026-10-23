import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

// No Electron in here, so npm test can run it.

// the image types lompii saves (sharp reads them all)
export const IMAGE = /\.(png|jpe?g|webp|gif|avif|bmp|tiff?)$/i

// Windows marks hidden and system files with attributes Node can't read, so dir lists them:
// one cmd per folder, cheap next to saving the images in it. Elsewhere, hidden means a dot name.
// ponytail: cmd expands %NAME% even inside quotes, so a folder called like an environment
// variable gets the wrong list (its hidden files are then saved). Rare enough to leave.
function hiddenNames(dir: string): Promise<Set<string>> {
  if (process.platform !== 'win32') return Promise.resolve(new Set())
  return new Promise((done) =>
    execFile(
      'cmd.exe',
      [`/d /u /c "dir /b /a:h "${dir}" & dir /b /a:s "${dir}""`], // /u: UTF-16, so any name survives
      { windowsVerbatimArguments: true, windowsHide: true, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
      // "File Not Found" when there are none: an error exit, the output still right
      (_err, out) => done(new Set(out.toString('utf16le').split(/\r?\n/).filter(Boolean)))
    )
  )
}

// Every image under root, subfolders included, and how many other files were passed over
// (anything else, shortcuts and symlinks, which aren't followed). Hidden and system files and
// folders are left out without counting: the person never sees them in Explorer either.
export async function findImages(root: string): Promise<{ images: string[]; skipped: number }> {
  const images: string[] = []
  let skipped = 0
  const dirs = [root]
  for (let dir = dirs.pop(); dir !== undefined; dir = dirs.pop()) {
    const [entries, hidden] = await Promise.all([
      readdir(dir, { withFileTypes: true }).catch(() => []), // no access: like it isn't there
      hiddenNames(dir)
    ])
    for (const e of entries) {
      if (e.name.startsWith('.') || hidden.has(e.name)) continue
      const path = join(dir, e.name)
      // a junction or symlink is neither a directory nor a file here
      if (e.isDirectory()) dirs.push(path)
      else if (e.isFile() && IMAGE.test(e.name)) images.push(path)
      else skipped++
    }
  }
  return { images, skipped }
}
