import { app, Menu, nativeImage, Tray, type NativeImage } from 'electron'

// Tessera keeps running in the tray when its window is closed, so the extension can always
// save. Quit is in the tray menu.

// the extension's 32 px icon, inlined so the packaged app needs no extra resource file
const ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAADsOAAA7DgHMtqGDAAABnklEQVRYhe2XXW7CMAzHI/UQIDW1m6pJp4meBN6qSrSaNCbB7jF2kr7xcTB2Ax4zGUaBEkrC2NP6lyz1oY5/iRM7YaxTQ4jPfRDxCESSN82HOONRkrIr0iVPdQGZLiE32Ejn2Gdt4hi/8VBtg1DpNuMoV4wxrw6cM08XuNYl6lYrYKtLnFydObcIXkMINT3OHGY3g59CmFYCRDyyDb5fBVUdAbCyBiAbw9AAkORuALs0HABWTgAl5B0A61LQlA9x5rgJFwdfXcDCaRMWkF0A8ChJXQAClB81QIlzJ4AXPrgAINHRspp9KDdCiF4NMBY9XcLGEmDJWuT5oZxRkSEYgy1o5qfBzyFw/pOOlcEqXcCUynYbQCcPQvl+IwVzUwqomQWoPukfs6+qKL2nXfRCHOX6nk2466Sovlx7yHnwXxxDWhWnGhI9DR5aiDilxsGXYj20HXPL+nEwitUBsC4FTQHI4b2XUvp22oQghw+9lvuhnFn7hWprqqQ7BSgnlg+TZaOkejZHcT+2fGV/9TTjUZLSPyZfGpPGbg3O/qO+AelpwfI2TgLkAAAAAElFTkSuQmCC'

// Login items only make sense for the installed app: in development, the registered
// command would be a bare electron.exe with no app to load.
export const canOpenAtLogin = (): boolean => app.isPackaged && process.platform !== 'linux'

const LOGIN_ARGS = ['--hidden'] // started at login: stay in the tray until asked

export const openAtLogin = (): boolean | null =>
  canOpenAtLogin() ? app.getLoginItemSettings({ args: LOGIN_ARGS }).openAtLogin : null

export function setOpenAtLogin(on: boolean): void {
  if (canOpenAtLogin()) app.setLoginItemSettings({ openAtLogin: on, args: LOGIN_ARGS })
}

export const startedHidden = (): boolean => process.argv.includes('--hidden')

let tray: Tray | null = null // module-level, or it's garbage-collected and vanishes

export function createTray(show: () => void, quit: () => void): Tray {
  tray = new Tray(nativeImage.createFromDataURL(ICON))
  tray.setToolTip('Tessera')
  const rebuild = () =>
    tray!.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open Tessera', click: show },
        { type: 'separator' },
        {
          label: canOpenAtLogin() ? 'Start at login' : 'Start at login (installed app only)',
          type: 'checkbox',
          enabled: canOpenAtLogin(),
          checked: !!openAtLogin(),
          click: (item) => {
            setOpenAtLogin(item.checked)
            rebuild()
          }
        },
        { type: 'separator' },
        { label: 'Quit Tessera', click: quit }
      ])
    )
  rebuild()
  tray.on('click', show)
  return tray
}

// redrawn to suit the taskbar's light or dark mode (taskbarIcon.ts)
export const setTrayIcon = (img: NativeImage): void => tray?.setImage(img)

// first close only: explain where the window went
export function trayHint(): void {
  tray?.displayBalloon({
    title: 'Tessera is still running',
    content: 'It keeps saving from your browser. Open it from here, or quit from this menu.',
    iconType: 'info'
  })
}
