import { execFile } from 'node:child_process'
import { nativeImage, nativeTheme, type NativeImage } from 'electron'
import sharp from 'sharp'

// The logo's dark tiles vanish on a dark taskbar, so the window and tray icons are drawn
// with white tiles there and near-black ones on a light taskbar. Same shapes as build/icon.png.
const svg = (ink: string, size: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect x="42" y="42" width="193" height="193" rx="46" fill="${ink}"/>
  <rect x="277" y="42" width="193" height="193" rx="46" fill="#ff5a1f"/>
  <rect x="42" y="277" width="193" height="193" rx="46" fill="${ink}"/>
  <rect x="277" y="277" width="193" height="193" rx="46" fill="${ink}"/>
</svg>`

const render = async (ink: string, size: number): Promise<NativeImage> =>
  nativeImage.createFromBuffer(await sharp(Buffer.from(svg(ink, size))).png().toBuffer())

// Windows colours the taskbar by its "Windows mode", which can differ from the app mode that
// nativeTheme reports, so read it directly. No value (older Windows 10) means a dark taskbar.
const PERSONALIZE = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'
const taskbarIsDark = (): Promise<boolean> =>
  process.platform !== 'win32'
    ? Promise.resolve(nativeTheme.shouldUseDarkColors)
    : new Promise((resolve) =>
        execFile('reg', ['query', PERSONALIZE, '/v', 'SystemUsesLightTheme'], (err, out) =>
          resolve(err ? true : /0x0\b/.test(out))
        )
      )

// Calls `apply` with a 256 px window icon and a 32 px tray icon now, and again whenever the
// theme changes. nativeTheme's event fires on changes to the Personalize key, which holds both
// the app and the Windows mode.
export function followTaskbarTheme(apply: (windowIcon: NativeImage, trayIcon: NativeImage) => void): void {
  const update = async () => {
    const ink = (await taskbarIsDark()) ? '#ffffff' : '#1d2026'
    apply(await render(ink, 256), await render(ink, 32))
  }
  void update()
  nativeTheme.on('updated', () => void update())
}
