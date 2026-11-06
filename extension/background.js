// The service worker: holds the pairing with the member's account, talks to the
// server, keeps what each tab has found, and relays between the content scripts and
// the side panel. It never opens a job board page itself.
const API = 'https://aicareercoach.net/api/newpage'
const KEYS = ['refresh', 'access', 'accessExp', 'profile', 'device']
const tabs = new Map() // tabId -> what the content script last reported

const store = {
  async get() { return chrome.storage.local.get(KEYS) },
  async set(v) { return chrome.storage.local.set(v) },
  async clear() { return chrome.storage.local.remove(KEYS) }
}

async function accessToken() {
  const s = await store.get()
  if (s.access && s.accessExp && Date.now() < s.accessExp - 30000) return s.access
  if (!s.refresh) throw Object.assign(new Error('Not connected'), { code: 'unpaired' })
  const res = await fetch(`${API}/extension`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'ext_refresh', refresh: s.refresh, device: s.device || 'Browser' }) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) await store.clear()
    throw Object.assign(new Error(data.error || 'Could not reconnect'), { code: data.code || 'refresh' })
  }
  await store.set({ access: data.access, refresh: data.refresh, accessExp: Date.now() + (data.expires_in || 900) * 1000 })
  return data.access
}

// One call to the helper's endpoint. A 401 gets one fresh token and one retry.
async function api(action, body = {}, retried = false) {
  const access = await accessToken()
  const res = await fetch(`${API}/extension`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, access, ...body }) })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !retried) { await store.set({ access: null, accessExp: 0 }); return api(action, body, true) }
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { code: data.code || res.status })
  return data
}

// The Word file for a document, built by the app's own builders with the helper's token.
async function docxFor(doc) {
  const access = await accessToken()
  const url = doc.kind === 'resume' ? `${API}/resume` : `${API}/docx`
  const body = doc.kind === 'resume' ? { token: access, action: 'build', resume: doc.content.resume, target_title: doc.content.target_title || '' } : { token: access, action: 'cover', data: doc.content, template: doc.content.template || 'modern' }
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not build the Word file')
  const b64 = doc.kind === 'resume' ? data.messages?.find(m => m.kind === 'result')?.docx || data.docx : data.docx
  if (!b64) throw new Error('No file came back')
  return { b64, name: `${(doc.title || 'Document').replace(/[^\w .'-]/g, '').slice(0, 80)}.docx` }
}

// Pairing: the app posts the token here (externally_connectable limits who can).
chrome.runtime.onMessageExternal.addListener((msg, sender, reply) => {
  if (!sender.url || !sender.url.startsWith('https://aicareercoach.net/')) return reply({ ok: false })
  if (msg?.type === 'ping') return reply({ ok: true, version: chrome.runtime.getManifest().version })
  if (msg?.type === 'pair' && typeof msg.token === 'string') {
    store.set({ refresh: msg.token, access: null, accessExp: 0, device: msg.device || 'Browser' })
      .then(() => api('ext_profile')).then(profile => store.set({ profile }))
      .then(() => reply({ ok: true })).catch(err => reply({ ok: false, error: err.message }))
    return true
  }
  if (msg?.type === 'unpair') { store.clear().then(() => reply({ ok: true })); return true }
  reply({ ok: false })
})

chrome.runtime.onInstalled.addListener(() => { chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {}) })

// Messages from the content scripts and the side panel.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tabId = sender.tab?.id ?? msg.tabId
  const run = async () => {
    switch (msg.type) {
      case 'page': { // a content script reporting what it sees
        tabs.set(tabId, { ...msg.page, at: Date.now() })
        chrome.runtime.sendMessage({ type: 'page-updated', tabId }).catch(() => {})
        return { ok: true }
      }
      case 'state': { // the side panel asking for everything it needs
        const s = await store.get()
        return { paired: !!s.refresh, profile: s.profile || null, page: tabs.get(tabId) || null }
      }
      case 'profile': { const profile = await api('ext_profile'); await store.set({ profile }); return profile }
      case 'docs': return api('ext_docs')
      case 'fit': return api('ext_fit', msg.job)
      case 'answers': return api('ext_answers', { questions: msg.questions, text: msg.job?.text, title: msg.job?.title, company: msg.job?.company })
      case 'log': return api('ext_log', msg.application)
      case 'capture': { const s = await store.get(); if (!s.profile?.capture) return { stored: 0, reason: 'off' }; return api('ext_capture', { listings: msg.listings }) }
      case 'docx': return docxFor(msg.doc)
      case 'to-tab': return chrome.tabs.sendMessage(tabId, msg.payload) // side panel -> content script
      case 'unpair': await store.clear(); return { ok: true }
      default: return { error: 'Unknown message' }
    }
  }
  run().then(reply).catch(err => reply({ error: err.message, code: err.code }))
  return true
})

chrome.tabs.onRemoved.addListener(id => tabs.delete(id))
