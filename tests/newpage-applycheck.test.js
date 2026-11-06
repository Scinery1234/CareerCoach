// The Sunday note: only members who switched it on, never demos, one line about the week.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fakeSupabase } from './helpers/fake-supabase.js'

process.env.SUPABASE_URL = 'http://supabase.test'; process.env.SUPABASE_SERVICE_KEY = 'k'; process.env.SUPABASE_ANON_KEY = 'k'
process.env.RESEND_API_KEY = 're_test'; process.env.STRIPE_SECRET_KEY ||= 'sk_test'; process.env.CRON_SECRET = 'cron-secret'; process.env.FROM_EMAIL = 'hello@example.com'
delete process.env.ANTHROPIC_API_KEY

const today = new Date().toISOString()
globalThis.__fakeSupabase = fakeSupabase({
  newpage_members: [
    { id: 'm1', email: 'on@example.com', name: 'On Person', status: 'active', source: 'purchase' },
    { id: 'm2', email: 'off@example.com', status: 'active', source: 'purchase' },
    { id: 'm3', email: 'demo@example.com', status: 'active', source: 'demo' },
    { id: 'm4', email: 'paused@example.com', status: 'paused', source: 'purchase' }
  ],
  newpage_tools: [
    { member_id: 'm1', tool: 'apply', data: { emails: true, weeklyTarget: 2 } },
    { member_id: 'm2', tool: 'apply', data: { emails: false, weeklyTarget: 5 } },
    { member_id: 'm3', tool: 'apply', data: { emails: true } },
    { member_id: 'm4', tool: 'apply', data: { emails: true } }
  ],
  newpage_applications: [{ member_id: 'm1', title: 'Cook', status: 'applied', applied_at: today.slice(0, 10), status_at: today, created_at: today }]
})
const sent = []
const origFetch = globalThis.fetch
globalThis.fetch = async (url, opts) => { sent.push(JSON.parse(opts.body)); return new Response(JSON.stringify({ id: 'e1' }), { status: 200, headers: { 'content-type': 'application/json' } }) }
const { default: handler } = await import('../api/newpage/applycheck.js')
const { applyCheckinEmail } = await import('../lib/newpage-emails.js')
const run = async auth => { const r = { code: 200, status(c) { r.code = c; return r }, json(b) { r.body = b; return r }, end() { return r } }; await handler({ method: 'POST', headers: { authorization: auth } }, r); return r }

test('needs the cron secret', async () => { assert.equal((await run('Bearer wrong')).code, 401) })

test('one note to the member who asked; off, demo and paused members hear nothing', async () => {
  const r = await run('Bearer cron-secret')
  assert.deepEqual(r.body, { ok: true, total: 1, skipped: 3, failed: 0 })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, 'on@example.com')
  assert.equal(sent[0].subject, 'Your week in applications')
  assert.match(sent[0].html, /Hi On\. 1 of 2 this week\./)
  assert.match(sent[0].html, /Talk to Sky about this week/)
  assert.match(sent[0].html, /Turn it off any time under Tools, Applications/)
  globalThis.fetch = origFetch
})

test('the email builder escapes what it is given', () => {
  const m = applyCheckinEmail({ name: '<b>X</b>', line: 'A <script>line</script>', thisWeek: 0, target: null })
  assert.ok(!m.html.includes('<script>'))
  assert.match(m.html, /0 this week/)
})
