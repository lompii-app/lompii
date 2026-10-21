// The background worker does the work; the popup only picks what and closes.
for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', () =>
    chrome.runtime.sendMessage({ type: 'capture', mode: button.dataset.mode }).finally(() => window.close())
  )
}

document.getElementById('settings').addEventListener('click', () => chrome.runtime.openOptionsPage())

chrome.runtime.sendMessage({ type: 'ping' }).then(({ ok, message }) => {
  document.getElementById('dot').className = `dot ${ok ? 'ok' : 'bad'}`
  document.getElementById('status').textContent = ok ? 'Connected to Tessera' : message
})
