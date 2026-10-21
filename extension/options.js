const API = 'http://127.0.0.1:47821' // same as background.js
const input = document.getElementById('key')
const status = document.getElementById('status')

async function check(token) {
  status.dataset.ok = 'false'
  status.textContent = 'Checking…'
  try {
    const res = await fetch(`${API}/ping`, { headers: { authorization: `Bearer ${token}` } })
    status.dataset.ok = String(res.ok)
    status.textContent = res.ok
      ? 'Connected to Tessera.'
      : res.status === 401
        ? "Key doesn't match. Copy it again from Tessera › Settings."
        : `Unexpected response (${res.status}).`
  } catch {
    status.textContent = "Couldn't reach Tessera. Is the app open?"
  }
}

chrome.storage.local.get('token').then(({ token }) => {
  if (!token) return
  input.value = token
  check(token)
})

document.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const token = input.value.trim()
  await chrome.storage.local.set({ token })
  check(token)
})
