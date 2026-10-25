// The background worker does the work; the popup only picks what and closes.
for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', () =>
    chrome.runtime.sendMessage({ type: 'capture', mode: button.dataset.mode }).finally(() => window.close())
  )
}

// The browser's own pages and the extension stores refuse scripts, and the notice that would
// explain a failed save is a script, so say it here instead.
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) =>
  chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => true }).catch(() => {
    for (const button of document.querySelectorAll('[data-mode]')) button.disabled = true
    document.getElementById('blocked').hidden = false
  })
)

document.getElementById('settings').addEventListener('click', () => chrome.runtime.openOptionsPage())

chrome.runtime.sendMessage({ type: 'ping' }).then(({ ok, message }) => {
  document.getElementById('dot').className = `dot ${ok ? 'ok' : 'bad'}`
  document.getElementById('status').textContent = ok ? 'Connected to lompii' : message
})
