// Chrome's light/dark mode, reported now and whenever it changes (see offscreen.html).
const dark = matchMedia('(prefers-color-scheme: dark)')
const report = () => chrome.runtime.sendMessage({ type: 'theme', dark: dark.matches })
dark.addEventListener('change', report)
report()
