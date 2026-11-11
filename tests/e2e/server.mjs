// Serves the member app from the repo and routes /api/newpage/app to the real handler over
// the fake database, seeded with a member, a base and a tailored resume, and one alert.
// Serves the member app from the repo and routes /api/newpage/app to the real handler over the fake database.
import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fakeSupabase } from '../helpers/fake-supabase.js'
process.env.JWT_SECRET = 'e2e'; process.env.SUPABASE_URL = 'http://x'; process.env.SUPABASE_SERVICE_KEY = 'k'; process.env.SUPABASE_ANON_KEY = 'k'; process.env.RESEND_API_KEY = 're'; process.env.STRIPE_SECRET_KEY = 'sk'
process.env.NEWPAGE_MEMORY_KEY ||= Buffer.from(Array.from({ length: 32 }, (_, i) => i * 7 % 256)).toString('base64') // member data is only stored encrypted
process.env.ANTHROPIC_API_KEY = 'sk-ant-e2e'  // Sky is scripted below; nothing leaves this machine
process.env.STRIPE_SECRET_KEY ||= 'sk_test_e2e'
process.env.NEXT_PUBLIC_URL = 'http://localhost:4173'
const ME = { id: '11111111-1111-4111-8111-111111111111', email: 'sam@example.com', name: 'Sam Lee', status: 'active', source: 'tools', plan_started_at: new Date().toISOString(), sessions_included: 0 }
const now = new Date().toISOString()
const RES = { id: '33333333-3333-4333-8333-333333333333', member_id: ME.id, kind: 'resume', title: 'Resume: Aged Care Worker', created_at: now, content: { format: 'au-ats-v1', filename: 'r.docx', target_title: 'Aged Care Worker', job_description: '', resume: { candidate: { full_name: 'Sam Lee', generic_job_title: 'Aged Care Worker', location: 'Geelong', phone: '0400', email: 'sam@example.com', linkedin: '' }, professional_summary: 'Carer.', key_skills: ['Personal Care', 'Medication Support', 'Documentation', 'Teamwork', 'Empathy'], professional_experience: [{ job_title: 'Carer', employer: 'Home', location: '', start_date: 'March 2022', end_date: 'Present', scope_statement: '', achievements: ['Cared well'] }], education_and_training: [], awards: [], certifications: [], technical_skills: [], additional_information: [] } } }
const TAIL = { ...RES, id: '44444444-4444-4444-8444-444444444444', title: 'Resume: Aged Care Worker at Harbour', created_at: now, content: { ...RES.content, tailored: { base_id: RES.id, role: 'Aged Care Worker', company: 'Harbour Aged Care', summary: 'I moved the care work up.', changes: [{ section: 'professional_summary', kind: 'rewritten', what: 'Rewritten', before: 'a', after: 'b' }], match: [{ requirement: 'Cert III', status: 'strong', evidence: 'Has it', note: '' }, { requirement: 'Forklift', status: 'missing', evidence: '', note: 'Add if true' }] } } }
const db = fakeSupabase({ newpage_members: [ME], newpage_docs: [RES, TAIL], newpage_content: [],
  newpage_alerts: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', member_id: ME.id, external_id: 'x1', title: 'Aged Care Worker - Nights', company: 'Harbour Aged Care', location: 'Geelong', salary: '$60,000', url: 'https://www.seek.com.au/job/1', board: 'seek', posted_at: now, state: 'new', fit: { score: 86, verdict: 'Morning shifts near home, which you said you need.', reasons: ['Cert III'], concerns: [] }, created_at: now }] })
globalThis.__fakeSupabase = db
const realFetch = globalThis.fetch
globalThis.fetch = async (url, opts) => {
  if (!String(url).startsWith('https://api.anthropic.com')) return realFetch(url, opts)
  const body = JSON.parse(opts.body)
  const last = body.messages.at(-1)
  const ok = o => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } })
  if (Array.isArray(last.content) && last.content[0]?.type === 'tool_result') return ok({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Good to meet you, Sam. Four years in aged care is real experience. What would a good change look like for you?' }] })
  if (body.tools?.some(t => t.name === 'save_memory') && !body.messages.some(m => Array.isArray(m.content))) return ok({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu1', name: 'save_memory', input: { note: 'Is called Sam and has worked in aged care for four years.' } }] })
  return ok({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Thanks. Tell me more.' }] })
}
const { setStripe } = await import('../../lib/newpage-stripe.js')
setStripe({ checkout: { sessions: { create: async p => ({ url: 'http://localhost:4173/__stripe?demo=' + (p.metadata.demo_member || '') + '&email=' + encodeURIComponent(p.customer_email) }) } } })
const { signSession } = await import('../../lib/newpage-auth.js')
const handlers = {
  '/api/newpage/app': (await import('../../api/newpage/app.js')).default,
  '/api/newpage/demo': (await import('../../api/newpage/demo.js')).default,
  '/api/newpage/checkout': (await import('../../api/newpage/checkout.js')).default
}
const ROOT = new URL('../../', import.meta.url).pathname
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }
http.createServer(async (req, res) => {
  const api = Object.keys(handlers).find(k => req.url.split('?')[0] === k)
  if (api) {
    let body = ''; for await (const c of req) body += c
    const r = { code: 200, status(c) { r.code = c; return r }, json(b) { res.writeHead(r.code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); return r }, end() { res.writeHead(r.code); res.end(); return r } }
    try { await handlers[api]({ method: req.method, headers: req.headers, body: JSON.parse(body || '{}') }, r) } catch (e) { console.error('HANDLER THREW', e); res.writeHead(500); res.end(JSON.stringify({ error: e.message })) }
    return
  }
  if (req.url.startsWith('/__stripe')) { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<h1>Stripe checkout (stub)</h1>'); return }
  if (req.url === '/__token') { res.end(signSession(ME.id)); return }
  // Open http://localhost:4173/__login in a browser to click around as the seeded member.
  if (req.url === '/__login') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(`<!doctype html><script>localStorage.setItem('np_app_session', ${JSON.stringify(signSession(ME.id))}); location.replace('/app/index.html#today')</script>`); return }
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0])
  if (p === '/app' || p === '/app/') p = '/app/index.html'
  const f = join(ROOT, p)
  if (existsSync(f) && !f.endsWith('/')) { res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); return }
  res.writeHead(404); res.end('nope ' + p)
}).listen(4173, () => console.log('ready: open http://localhost:4173/__login to use the app as the seeded member (no AI key: Sky and the writers are off, everything else works)'))
