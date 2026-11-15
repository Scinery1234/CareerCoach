// A smoke test for a deployed site. It makes real requests, so it creates one throwaway demo member
// (deleted automatically after 24 hours) and, unless told not to, sends Sky one message.
//
//   node tests/smoke/live.mjs https://your-site.example
//   node tests/smoke/live.mjs https://your-site.example --no-ai        (skip the message to Sky)
//
// Optional, to also check the admin side and the scheduled jobs:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... CRON_SECRET=... node tests/smoke/live.mjs https://your-site.example
//
// Each line says ok, WARN (works but something is not set up yet) or FAIL, and what to check when it is not ok.
// Behind a proxy, run it with NODE_USE_ENV_PROXY=1. Exit code 1 if anything FAILed.

const args = process.argv.slice(2)
const base = (args.find(a => /^https?:\/\//.test(a)) || '').replace(/\/+$/, '')
const noAi = args.includes('--no-ai')
if (!base) { console.error('Usage: node tests/smoke/live.mjs https://your-site [--no-ai]'); process.exit(2) }

let fails = 0, warns = 0
const out = (tag, name, why = '') => console.log(`${tag.padEnd(4)} ${name}${why ? '\n       ' + why : ''}`)
const ok = (name, why) => out('ok', name, why)
const warn = (name, why) => { warns++; out('WARN', name, why) }
const fail = (name, why) => { fails++; out('FAIL', name, why) }

async function http(path, { method = 'GET', body, token, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method, redirect: 'manual', signal: AbortSignal.timeout(60000),
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let json = null; try { json = JSON.parse(text) } catch { /* not JSON */ }
  return { status: res.status, text, json, ms: 0 }
}
async function check(name, fn) { try { await fn() } catch (e) { fail(name, `Could not reach it: ${e.cause?.code || e.message}`) } }

console.log(`Testing ${base}\n`)

// ── Pages ──
for (const [path, must, hint] of [
  ['/', /AI Career Coach/i, 'The home page. A 404 means the deploy is not serving the repo root.'],
  ['/demo', /Sky/, 'The demo start page.'],
  ['/app', /AI Career Coach/, 'The member app shell.'],
  ['/privacy', /./, 'The privacy page.'],
  ['/terms', /./, 'The terms page.'],
  ['/app/app.js', /import|function/, 'The app script. If this fails the app cannot start.']
]) await check(`page ${path}`, async () => {
  const r = await http(path)
  if (r.status !== 200) return fail(`page ${path}`, `HTTP ${r.status}. ${hint}`)
  if (!must.test(r.text)) return fail(`page ${path}`, `It loaded but did not look right. ${hint}`)
  ok(`page ${path}`)
})

// ── The demo ──
let session = null
await check('demo: info', async () => {
  const r = await http('/api/newpage/demo', { method: 'POST', body: { action: 'info' } })
  if (r.status >= 500 || !r.json) return fail('demo: info', `HTTP ${r.status}: ${r.text.slice(0, 160)}. The function crashes on load: check SUPABASE_URL, SUPABASE_SERVICE_KEY and the deploy log.`)
  if (r.json.available === false) return fail('demo: info', 'Sky is switched off, so the demo will not start. Set ANTHROPIC_API_KEY in Vercel (Production) and redeploy.')
  ok('demo: info', r.json.needsCode ? 'The demo needs an invite code, so the rest of the demo checks are skipped.' : `${r.json.caps?.messages} messages, ${r.json.hours} hours`)
  if (r.json.needsCode) session = 'needs-code'
})
if (session !== 'needs-code') await check('demo: start', async () => {
  const r = await http('/api/newpage/demo', { method: 'POST', body: { action: 'start', code: '', website: '' } })
  if (r.status === 429) return warn('demo: start', 'Rate limited (5 demo starts an hour per address). Try again later.')
  if (r.status !== 200 || !r.json?.session) {
    const msg = r.json?.error || r.text.slice(0, 160)
    const hint = /isn.t set up/i.test(msg) ? 'The database refused the write. Check SUPABASE_SERVICE_KEY is the service_role key (the legacy one starting eyJ), and that both SQL files ran.' : /switched on/i.test(msg) ? 'Set ANTHROPIC_API_KEY.' : 'Check the deploy log for api/newpage/demo.'
    return fail('demo: start', `HTTP ${r.status}: ${msg} ${hint}`)
  }
  session = r.json.session
  ok('demo: start', 'A throwaway demo member was created.')
})
if (session && session !== 'needs-code') {
  await check('app: me (demo member)', async () => {
    const r = await http('/api/newpage/app', { method: 'POST', token: session, body: { action: 'me' } })
    if (r.status !== 200 || !r.json) return fail('app: me (demo member)', `HTTP ${r.status}: ${r.text.slice(0, 160)}. The member endpoint crashes or rejects the session: check JWT_SECRET and the deploy log for api/newpage/app.`)
    const m = r.json
    if (!m.member?.demo) return fail('app: me (demo member)', 'The member is not marked as a demo.')
    if (!m.coachOn) warn('app: Sky switched on', 'The app says Sky is off: ANTHROPIC_API_KEY is not reaching the member endpoint.'); else ok('app: Sky switched on')
    const opener = m.messages?.[0]?.content || ''
    if (/what should I call you/i.test(opener)) ok('demo: opens with Sky’s question'); else fail('demo: opens with Sky’s question', `First message was: ${String(opener).slice(0, 100) || '(none)'}`)
    if (m.messages?.[0]?.content === '[unreadable]' || /unreadable/i.test(opener)) fail('demo: encryption', 'Messages are stored but unreadable: NEWPAGE_MEMORY_KEY is wrong or changed.')
    if ((m.memory || []).length === 0) ok('demo: memory starts empty'); else warn('demo: memory starts empty', `It has ${m.memory.length} notes already.`)
    if (m.alerts !== undefined && m.pipeline !== undefined) ok('app: new payload (alerts, pipeline)'); else warn('app: new payload', 'The response lacks the apply fields: an older build may be live.')
  })
  if (!noAi) await check('Sky answers and saves a note', async () => {
    const r = await http('/api/newpage/app', { method: 'POST', token: session, body: { action: 'coach', coach: 'career', message: 'Hi, I’m Alex. I work in retail, the hours are wearing me out, and I want a change.' } })
    if (r.status !== 200) return fail('Sky answers and saves a note', `HTTP ${r.status}: ${r.json?.error || r.text.slice(0, 160)}. ${r.status === 502 ? 'The AI call failed: check ANTHROPIC_API_KEY is valid and the account has credit.' : r.status === 503 ? 'Sky is not switched on.' : ''}`)
    const last = r.json.messages?.at(-1)
    if (last?.role !== 'assistant' || !last.content || last.content.length < 10) return fail('Sky answers and saves a note', 'No reply came back.')
    ok('Sky answers', `“${last.content.slice(0, 110).replace(/\s+/g, ' ')}${last.content.length > 110 ? '…' : ''}”`)
    const notes = (r.json.memory || []).map(n => n.note)
    if (notes.length) ok('Sky saves what it learns', notes.map(n => `• ${n}`).join('\n       ')); else warn('Sky saves what it learns', 'Sky replied but saved no notes this time. Try again: it should after the first answer. If it never does, memory may be switched off (NEWPAGE_MEMORY_KEY).')
    if (r.json.member?.demo?.messagesUsed !== 1) warn('demo: message count', `Expected 1 message used, saw ${r.json.member?.demo?.messagesUsed}.`)
  })
  await check('Python: Word-file builder', async () => {
    const r = await http('/api/newpage/docx', { method: 'POST', body: { action: 'templates', token: session } })
    if (r.status !== 200 || !Array.isArray(r.json?.templates)) return fail('Python: Word-file builder', `HTTP ${r.status}: ${r.text.slice(0, 140)}. The Python functions are not deployed or crash: check the deploy log for api/newpage/docx.py (and that vercel.json has "framework": null).`)
    ok('Python: Word-file builder', `${r.json.templates.length} templates`)
  })
  await check('checkout: quote', async () => {
    const r = await http('/api/newpage/checkout', { method: 'POST', body: { action: 'quote' } })
    if (r.status !== 200 || r.json?.plan !== 'tools') return fail('checkout: quote', `HTTP ${r.status}: ${r.text.slice(0, 120)}`)
    ok('checkout: quote', `$${(r.json.totalCents / 100).toFixed(0)} a month, ${r.json.trialDays}-day trial`)
  })
  await check('checkout: Keep what Sky knows', async () => {
    const r = await http('/api/newpage/checkout', { method: 'POST', body: { action: 'start', name: 'Smoke Test', email: `smoke+${Date.now()}@example.com`, demo: session } })
    if (r.status === 200 && /^https:\/\/checkout\.stripe\.com\//.test(r.json?.url || '')) return ok('checkout: Keep what Sky knows', 'Stripe gave a checkout address. Nothing was charged.')
    if (r.status === 502) return warn('checkout: Keep what Sky knows', 'Stripe is not set up yet (STRIPE_SECRET_KEY). Expected until you add it.')
    fail('checkout: Keep what Sky knows', `HTTP ${r.status}: ${r.json?.error || r.text.slice(0, 140)}`)
  })
}

// ── Protection: these must refuse a stranger ──
for (const [path, body] of [['/api/newpage/health', {}], ['/api/newpage/members', {}], ['/api/newpage/alerts', {}], ['/api/newpage/applycheck', {}], ['/api/newpage/retention', {}]]) {
  await check(`locked: ${path}`, async () => {
    const r = await http(path, { method: 'POST', body })
    if (r.status === 401 || r.status === 403) return ok(`locked: ${path}`)
    fail(`locked: ${path}`, `A stranger got HTTP ${r.status}. This must be 401. ${r.status === 200 ? 'SECURITY: it is open.' : ''}`)
  })
}
await check('locked: member endpoint without a sign-in', async () => {
  const r = await http('/api/newpage/app', { method: 'POST', body: { action: 'me' } })
  r.status === 401 ? ok('locked: member endpoint without a sign-in') : fail('locked: member endpoint without a sign-in', `HTTP ${r.status}, expected 401.`)
})

// ── Admin and cron, when given the credentials ──
const { ADMIN_EMAIL, ADMIN_PASSWORD, CRON_SECRET } = process.env
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  await check('admin: sign in', async () => {
    const r = await http('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
    if (r.status !== 200 || !r.json?.token) return fail('admin: sign in', `HTTP ${r.status}: ${r.json?.error || r.text.slice(0, 100)}. Check ADMIN_EMAIL matches exactly and ADMIN_PASSWORD_HASH is the full 60-character hash.`)
    ok('admin: sign in')
    const h = await http('/api/newpage/health', { method: 'POST', token: r.json.token, body: {} })
    if (h.status !== 200 || !h.json?.results) return fail('admin: Is everything working?', `HTTP ${h.status}: ${h.text.slice(0, 160)}`)
    for (const c of h.json.results) c.ok ? ok(`admin check: ${c.name}`, c.detail) : fail(`admin check: ${c.name}`, c.detail)
  })
} else console.log('\n(skipped the admin checks: set ADMIN_EMAIL and ADMIN_PASSWORD to include them)')
if (CRON_SECRET) {
  await check('cron: early alerts', async () => {
    const r = await http('/api/newpage/alerts', { method: 'POST', token: CRON_SECRET, body: {} })
    if (r.status !== 200) return fail('cron: early alerts', `HTTP ${r.status}: ${r.text.slice(0, 140)}`)
    r.json?.ok === false ? warn('cron: early alerts', r.json.skipped || 'It ran but reported a problem.') : ok('cron: early alerts', JSON.stringify(r.json))
  })
}

console.log(`\n${fails ? 'FAILED' : 'PASSED'}: ${fails} failed, ${warns} warnings.`)
process.exit(fails ? 1 : 0)
