const API = 'http://127.0.0.1:47821' // same as background.js
const $ = (id) => document.getElementById(id)

function show(text, { ok = false, connect = false, disconnect = false } = {}) {
  $('status').textContent = text
  $('dot').dataset.ok = String(ok)
  $('connect').hidden = !connect
  $('disconnect').hidden = !disconnect
  $('pairing').hidden = true
}

async function check() {
  const { token } = await chrome.storage.local.get('token')
  if (!token) return show('Not connected to lompii yet.', { connect: true })
  try {
    const res = await fetch(`${API}/ping`, { headers: { authorization: `Bearer ${token}` } })
    if (res.ok) show('Connected to lompii.', { ok: true, disconnect: true })
    else if (res.status === 401) show('lompii disconnected this browser.', { connect: true })
    else show(`Unexpected response (${res.status}).`, { connect: true })
  } catch {
    show("Couldn't reach lompii. Is the app open?", { connect: true })
  }
}

const REFUSED = {
  declined: "Not allowed. Connect again when you're ready.",
  busy: 'lompii is already asking about another connection. Answer that first.'
}

// lompii asks you to allow this browser, showing the same code, and hands back its key if you do.
async function connect() {
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0')
  show('Waiting for you to allow it in lompii…')
  $('code').textContent = code
  $('pairing').hidden = false
  try {
    const res = await fetch(`${API}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.token) return show(REFUSED[data.error] ?? `Couldn't connect (${data.error || res.status}).`, { connect: true })
    await chrome.storage.local.set({ token: data.token })
    check()
  } catch {
    show("Couldn't reach lompii. Open it, then try again.", { connect: true })
  }
}

$('connect').addEventListener('click', connect)
$('disconnect').addEventListener('click', async () => {
  await chrome.storage.local.remove('token')
  check()
})
check()
