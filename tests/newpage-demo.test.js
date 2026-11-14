// The demo: an empty member that Sky opens the conversation with, memory the visitor can watch
// fill, and the way to keep it by paying. Runs the real endpoints over the in-memory database.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fakeSupabase } from './helpers/fake-supabase.js'

process.env.JWT_SECRET = 'test-secret'
process.env.SUPABASE_URL = 'http://supabase.test'; process.env.SUPABASE_SERVICE_KEY = 'k'; process.env.SUPABASE_ANON_KEY = 'k'
process.env.RESEND_API_KEY ||= 're_test'; process.env.STRIPE_SECRET_KEY ||= 'sk_test'
process.env.NEWPAGE_MEMORY_KEY ||= randomBytes(32).toString('base64')
process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
process.env.NEXT_PUBLIC_URL = 'https://app.test'

const db = fakeSupabase({ newpage_members: [], newpage_content: [] })
globalThis.__fakeSupabase = db

const { default: demoApi } = await import('../api/newpage/demo.js')
const { default: app } = await import('../api/newpage/app.js')
const { default: checkout } = await import('../api/newpage/checkout.js')
const { setStripe } = await import('../lib/newpage-stripe.js')
const { applyCheckout } = await import('../lib/newpage-payments.js')
const { keepDemoAlive, DEMO, DEMO_OPENER, demoAllowance, demoSpend } = await import('../lib/newpage-demo.js')
const { readToken, signSession } = await import('../lib/newpage-auth.js')
const { isEncrypted } = await import('../lib/newpage-crypto.js')
const { coachSystem, DEMO_INTAKE } = await import('../lib/newpage-coach.js')

let ip = 0
const res = () => { const r = { code: 200, body: null, status(c) { r.code = c; return r }, json(b) { r.body = b; return r }, end() { return r } }; return r }
async function start() { const r = res(); await demoApi({ method: 'POST', headers: { 'x-forwarded-for': `10.0.0.${++ip}` }, body: { action: 'start', code: '', website: '' } }, r); assert.equal(r.code, 200, JSON.stringify(r.body)); return r.body.session }
async function act(session, body) { const r = res(); await app({ method: 'POST', headers: { authorization: `Bearer ${session}` }, body }, r); return r }
async function pay(body, demo) { const r = res(); await checkout({ method: 'POST', headers: { 'x-forwarded-for': `10.1.0.${++ip}` }, body: { ...body, ...(demo ? { demo } : {}) } }, r); return r }
const memberOf = session => db.rows('newpage_members').find(m => m.id === readToken(session, 'session').sub)

test('a demo is an empty member that Sky opens the conversation with: no Sam, no sample data', async () => {
  const session = await start()
  const m = memberOf(session)
  assert.equal(m.source, 'demo')
  assert.equal(m.name, null)
  assert.ok(!m.quadrant && !m.answers, 'no pretend check-in result')
  assert.ok(m.email.endsWith('@' + DEMO.domain))
  assert.ok(Math.abs(new Date(m.access_until) - Date.now() - 24 * 3600e3) < 60000, 'lasts 24 hours')
  for (const t of ['newpage_tasks', 'newpage_goals', 'newpage_memory', 'newpage_progress', 'newpage_tools', 'newpage_checkins']) assert.equal(db.rows(t).filter(r => r.member_id === m.id).length, 0, t + ' starts empty')
  const msgs = db.rows('newpage_messages').filter(x => x.member_id === m.id)
  assert.equal(msgs.length, 1)
  assert.equal(msgs[0].role, 'assistant')
  assert.ok(isEncrypted(msgs[0].content), 'the opener is stored encrypted like any message')
  const me = (await act(session, { action: 'me' })).body
  assert.equal(me.messages[0].content, DEMO_OPENER)
  assert.deepEqual(me.memory, [])
  assert.deepEqual(me.member.demo.caps, { messages: 15, docs: 2 })
  assert.equal(me.plan, null)
  assert.match(DEMO_OPENER, /what should I call you/i)
})

test('Sky runs the getting-to-know-you conversation and the notes it saves are the visitor’s memory', async () => {
  const session = await start()
  const sent = []
  const origFetch = globalThis.fetch
  let round = 0
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body); sent.push(body)
    round++
    if (round === 1) return new Response(JSON.stringify({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'save_memory', input: { note: 'Is called Sam and has worked in aged care for four years.' } }] }), { status: 200 })
    return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Good to meet you, Sam. What is getting in the way of a change?' }] }), { status: 200 })
  }
  try {
    const r = await act(session, { action: 'coach', coach: 'career', message: 'Hi, I’m Sam. I’ve been in aged care for four years and I’m thinking of a change.' })
    assert.equal(r.code, 200, JSON.stringify(r.body))
    assert.deepEqual(r.body.usedTools, ['save_memory'])
    assert.deepEqual(r.body.memory.map(n => n.note), ['Is called Sam and has worked in aged care for four years.'], 'the panel’s data comes back with every reply')
    assert.equal(r.body.messages.at(-1).role, 'assistant')
    assert.equal(r.body.member.demo.messagesUsed, 1, 'one message sent counts as one, not two')
    assert.equal(memberOf(session).demo_messages, 1)
  } finally { globalThis.fetch = origFetch }
  assert.match(sent[0].system, /THIS IS A FREE DEMO/)
  assert.ok(sent[0].system.includes(DEMO_OPENER), 'Sky knows what it opened with')
  assert.equal(sent[0].messages[0].role, 'user', 'the API conversation starts with the visitor, not Sky’s opener')
  assert.ok(sent[0].tools.some(t => t.name === 'save_memory'), 'memory is on in the demo')
  assert.ok(!/check-in on the Me tab/.test(sent[0].system), 'no sending a stranger to a form')
  assert.equal(db.rows('newpage_memory').filter(x => x.member_id === memberOf(session).id).every(x => isEncrypted(x.note)), true, 'notes are encrypted at rest')
})

test('the demo prompt only applies to a demo, and says what matters', () => {
  const member = { name: '', plan_started_at: new Date().toISOString(), source: 'demo' }
  const on = coachSystem({ member, tasks: [], memory: [], demo: true })
  const off = coachSystem({ member: { ...member, source: 'tools', name: 'Ana' }, tasks: [], memory: [] })
  for (const line of DEMO_INTAKE) assert.ok(on.includes(line))
  assert.match(on, /one short question at a time/)
  assert.match(on, /do not mention the Compass/)
  assert.match(on, /never save a guess/)
  assert.match(on, /Never pressure them to join/)
  assert.ok(!off.includes('THIS IS A FREE DEMO'))
  assert.match(off, /check-in on the Me tab/, 'a normal new member is still pointed at the check-in')
})

test('Sky stops at the demo’s message limit', async () => {
  const session = await start()
  const id = memberOf(session).id
  for (let i = 0; i < DEMO.caps.messages; i++) await demoSpend(id, 'messages')
  assert.equal((await demoAllowance(id, 'messages')).ok, false)
  const r = await act(session, { action: 'coach', coach: 'career', message: 'one more' })
  assert.equal(r.code, 429)
  assert.equal(r.body.code, 'demo_cap')
})

test('keeping a demo alive while someone pays: extends a live demo, never an old one, never a real member', async () => {
  const s = await start(); const m = memberOf(s)
  m.access_until = new Date(Date.now() + 20 * 60000).toISOString() // 20 minutes left
  assert.equal((await keepDemoAlive(m.id)).id, m.id)
  assert.ok(new Date(m.access_until) - Date.now() > 2.9 * 3600e3, 'pushed out to about three hours')
  const old = memberOf(await start())
  old.created_at = new Date(Date.now() - 40 * 3600e3).toISOString(); old.access_until = new Date(Date.now() + 10 * 60000).toISOString()
  const before = old.access_until
  assert.ok(await keepDemoAlive(old.id))
  assert.equal(old.access_until, before, 'a demo past its keep window is not extended')
  const gone = memberOf(await start()); gone.access_until = new Date(Date.now() - 1000).toISOString()
  assert.equal(await keepDemoAlive(gone.id), null, 'an expired demo is not revived')
  const real = { id: '99999999-9999-4999-8999-999999999999', email: 'real@x.co', source: 'tools', status: 'active', created_at: new Date().toISOString(), access_until: new Date(Date.now() + 1000).toISOString() }
  db.rows('newpage_members').push(real)
  assert.equal(await keepDemoAlive(real.id), null)
})

// ── Keeping it ──
let created = []
setStripe({ checkout: { sessions: { create: async p => { created.push(p); return { url: 'https://stripe.test/pay' } }, retrieve: async id => stripeSessions[id] } } })
const stripeSessions = {}

test('starting checkout from a demo carries the demo member into the Stripe session, and cancelling returns to Sky', async () => {
  const s = await start(); const id = memberOf(s).id
  const r = await pay({ action: 'start', name: 'Sam Lee', email: 'Sam@Example.com' }, s)
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.equal(r.body.url, 'https://stripe.test/pay')
  const p = created.at(-1)
  assert.equal(p.metadata.demo_member, id)
  assert.equal(p.metadata.kind, 'newpage_tools')
  assert.equal(p.customer_email, 'sam@example.com')
  assert.equal(p.cancel_url, 'https://app.test/app#coach')
  assert.equal(p.subscription_data.metadata.demo_member, id, 'the subscription carries it too')
  const plain = await pay({ action: 'start', name: 'Ana', email: 'ana@example.com' })
  assert.equal(plain.code, 200)
  assert.ok(!('demo_member' in created.at(-1).metadata), 'an ordinary join is unchanged')
  assert.equal(created.at(-1).cancel_url, 'https://app.test/?cancelled=1')
})

test('keeping is refused for an ended demo, a forged token, or an email that already has an account', async () => {
  const s = await start(); const m = memberOf(s)
  const taken = await pay({ action: 'start', name: 'X', email: 'real@x.co' }, s)
  assert.equal(taken.code, 409); assert.equal(taken.body.code, 'email_taken')
  m.access_until = new Date(Date.now() - 1000).toISOString()
  const ended = await pay({ action: 'start', name: 'X', email: 'new@x.co' }, s)
  assert.equal(ended.code, 400); assert.equal(ended.body.code, 'demo_over')
  const forged = await pay({ action: 'start', name: 'X', email: 'new@x.co' }, 'not.a.token')
  assert.equal(forged.code, 400)
  const notDemo = await pay({ action: 'start', name: 'X', email: 'new@x.co' }, signSession('99999999-9999-4999-8999-999999999999'))
  assert.equal(notDemo.code, 400, 'a real member’s session is not a demo to keep')
})

test('paying turns the demo member into the paid member: same member, same memory, signed straight back in', async () => {
  const s = await start(); const id = memberOf(s).id
  // The visitor talks, Sky saves what it learns.
  const origFetch = globalThis.fetch; let n = 0
  globalThis.fetch = async () => (++n === 1
    ? new Response(JSON.stringify({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't', name: 'save_memory', input: { note: 'Wants a role with school-hours shifts near Geelong.' } }] }), { status: 200 })
    : new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Noted.' }] }), { status: 200 }))
  try { await act(s, { action: 'coach', coach: 'career', message: 'I need school hours, near Geelong.' }) } finally { globalThis.fetch = origFetch }
  const keyBefore = memberOf(s).data_key
  assert.ok(keyBefore, 'the demo member has its own encryption key')

  const session = { id: 'cs_test_keepdemo000001', payment_status: 'no_payment_required', customer: 'cus_1', subscription: 'sub_1', metadata: { kind: 'newpage_tools', email: 'sam@example.com', name: 'Sam Lee', trial: '7', demo_member: id } }
  stripeSessions[session.id] = session
  const out = await applyCheckout(session)
  assert.equal(out.granted, 'sam@example.com')
  const m = memberOf(s)
  assert.equal(m.id, id, 'the very same member')
  assert.equal(m.email, 'sam@example.com'); assert.equal(m.name, 'Sam Lee'); assert.equal(m.source, 'tools')
  assert.equal(m.stripe_subscription_id, 'sub_1')
  assert.equal(m.demo_messages, 0); assert.equal(m.demo_code, null)
  assert.equal(m.data_key, keyBefore, 'same key, so the memory still opens')
  assert.ok(new Date(m.access_until) - Date.now() > 7 * 24 * 3600e3, 'trial plus a day of grace, not the 24 hours of the demo')
  assert.equal(db.rows('newpage_members').filter(x => x.email === 'sam@example.com').length, 1, 'no second member')
  // Everything Sky learned is still there, through the same session the visitor already holds.
  const me = (await act(s, { action: 'me' })).body
  assert.equal(me.member.demo, null, 'no longer a demo')
  assert.equal(me.member.plan, 'tools')
  assert.deepEqual(me.memory.map(x => x.note), ['Wants a role with school-hours shifts near Geelong.'])
  assert.equal(me.messages.length, 3, 'Sky’s opener and the conversation so far')
  // The page they land on after Stripe signs them in as that member.
  const c = res(); await checkout({ method: 'POST', headers: { 'x-forwarded-for': '10.2.0.1' }, body: { action: 'claim', sid: session.id } }, c)
  assert.equal(c.code, 200, JSON.stringify(c.body))
  assert.equal(readToken(c.body.session, 'session').sub, id)
})

test('if the demo was swept before payment, they simply join as a new member', async () => {
  const session = { id: 'cs_test_swept00000001', payment_status: 'no_payment_required', customer: 'cus_2', subscription: 'sub_2', metadata: { kind: 'newpage_tools', email: 'late@example.com', name: 'Late', trial: '7', demo_member: '12345678-1234-4234-8234-123456789012' } }
  const out = await applyCheckout(session)
  assert.equal(out.granted, 'late@example.com')
  const m = db.rows('newpage_members').find(x => x.email === 'late@example.com')
  assert.equal(m.source, 'tools')
  assert.notEqual(m.id, '12345678-1234-4234-8234-123456789012')
})

test('a converted member is never swept, and an unconverted demo past its time is', async () => {
  const { sweepDemos } = await import('../lib/newpage-demo.js')
  const keep = db.rows('newpage_members').find(m => m.email === 'sam@example.com'); keep.access_until = new Date(Date.now() - 1000).toISOString() // even if their date were somehow behind them
  const stale = memberOf(await start()); stale.access_until = new Date(Date.now() - 1000).toISOString()
  const removed = await sweepDemos()
  assert.ok(removed >= 1)
  assert.ok(db.rows('newpage_members').some(m => m.id === keep.id), 'the paid member stays')
  assert.ok(!db.rows('newpage_members').some(m => m.id === stale.id), 'the expired demo goes')
})

test('the demo does not start while Sky is switched off, and says so instead of opening a dead chat', async () => {
  const key = process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  const before = db.rows('newpage_members').length
  try {
    const info = res(); await demoApi({ method: 'POST', headers: { 'x-forwarded-for': '10.9.0.1' }, body: { action: 'info' } }, info)
    assert.equal(info.body.available, false)
    const r = res(); await demoApi({ method: 'POST', headers: { 'x-forwarded-for': '10.9.0.2' }, body: { action: 'start', code: '', website: '' } }, r)
    assert.equal(r.code, 503)
    assert.equal(r.body.code, 'unavailable')
    assert.match(r.body.error, /Sky isn’t switched on yet/)
    assert.equal(db.rows('newpage_members').length, before, 'no member was created')
  } finally { process.env.ANTHROPIC_API_KEY = key }
  const ok = res(); await demoApi({ method: 'POST', headers: { 'x-forwarded-for': '10.9.0.3' }, body: { action: 'info' } }, ok)
  assert.equal(ok.body.available, true)
})
