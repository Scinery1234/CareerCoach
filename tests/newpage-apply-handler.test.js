// The apply_* actions of the member endpoint, run against the in-memory Supabase.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fakeSupabase } from './helpers/fake-supabase.js'

process.env.JWT_SECRET = 'test-secret'
process.env.SUPABASE_URL = 'http://supabase.test'
process.env.SUPABASE_SERVICE_KEY = 'k'
process.env.SUPABASE_ANON_KEY = 'k'
process.env.RESEND_API_KEY ||= 're_test'
process.env.STRIPE_SECRET_KEY ||= 'sk_test'
delete process.env.ANTHROPIC_API_KEY

const ME = { id: '11111111-1111-4111-8111-111111111111', email: 'sam@example.com', name: 'Sam', status: 'active', source: 'purchase', plan_started_at: new Date().toISOString() }
const OTHER = { id: '22222222-2222-4222-8222-222222222222', email: 'x@example.com', name: 'X', status: 'active', source: 'purchase', plan_started_at: new Date().toISOString() }
const TAILORED = { id: '33333333-3333-4333-8333-333333333333', member_id: ME.id, kind: 'resume', title: 'Resume: Support Worker at Acme', content: { resume: { candidate: { full_name: 'Sam' } }, tailored: { role: 'Support Worker', company: 'Acme', match: [{ status: 'strong' }, { status: 'missing' }] } }, created_at: '2026-11-01T00:00:00Z' }
const THEIRS = { id: '44444444-4444-4444-8444-444444444444', member_id: OTHER.id, kind: 'resume', title: 'Not yours', content: { resume: { candidate: { full_name: 'X' } } }, created_at: '2026-11-01T00:00:00Z' }

const db = fakeSupabase({ newpage_members: [ME, OTHER], newpage_docs: [TAILORED, THEIRS], newpage_content: [] })
globalThis.__fakeSupabase = db

const { signSession } = await import('../lib/newpage-auth.js')
const { default: handler } = await import('../api/newpage/app.js')
const { eraseMemory, exportMemory } = await import('../lib/newpage-memory-store.js')
const { coachSystem } = await import('../lib/newpage-coach.js')

function res() {
  const r = { code: 200, body: null, status(c) { r.code = c; return r }, json(b) { r.body = b; return r }, end() { return r } }
  return r
}
async function act(body, member = ME) {
  const r = res()
  await handler({ method: 'POST', headers: { authorization: `Bearer ${signSession(member.id)}` }, body }, r)
  return r
}

test('log an application from a tailored resume: the fit comes along and the pipeline moves', async () => {
  const r = await act({ action: 'apply_add', title: 'Support Worker', company: 'Acme', url: 'https://www.seek.com.au/job/77?ref=a', resume_doc_id: TAILORED.id })
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.equal(r.body.duplicate, false)
  assert.equal(r.body.application.board, 'seek')
  assert.deepEqual(r.body.application.fit, { score: 50, strong: 1, partial: 0, missing: 1, total: 2 })
  assert.equal(r.body.application.resume_doc_id, TAILORED.id)
  assert.equal(r.body.pipeline.thisWeek, 1, 'the same response carries the fresh pipeline')
  assert.equal(r.body.pipeline.recent[0].title, 'Support Worker')
})

test('the same ad is not logged twice', async () => {
  const r = await act({ action: 'apply_add', title: 'Different wording', url: 'https://seek.com.au/job/77/' })
  assert.equal(r.code, 200)
  assert.equal(r.body.duplicate, true)
  assert.equal(r.body.application.title, 'Support Worker', 'the existing entry comes back')
  assert.equal(db.rows('newpage_applications').length, 1)
})

test('a document that is not the member’s cannot be attached', async () => {
  const r = await act({ action: 'apply_add', title: 'Sneaky', company: 'Z', resume_doc_id: THEIRS.id })
  assert.equal(r.code, 404)
  assert.equal(db.rows('newpage_applications').length, 1)
})

test('a title is required', async () => {
  const r = await act({ action: 'apply_add', company: 'Acme' })
  assert.equal(r.code, 400)
})

test('status changes, notes, and the list; another member sees nothing', async () => {
  const id = db.rows('newpage_applications')[0].id
  let r = await act({ action: 'apply_update', id, status: 'interview', notes: 'Tuesday' })
  assert.equal(r.code, 200)
  assert.equal(r.body.pipeline.interviews, 1)
  r = await act({ action: 'apply_list' })
  assert.equal(r.body.applications.length, 1)
  assert.equal(r.body.applications[0].status, 'interview')
  assert.equal(r.body.applications[0].notes, 'Tuesday')
  assert.equal(r.body.settings.weeklyTarget, null)
  assert.equal(r.body.settings.offer, null)
  assert.equal(r.body.settings.emails, false)
  r = await act({ action: 'apply_list' }, OTHER)
  assert.equal(r.body.applications.length, 0)
  r = await act({ action: 'apply_update', id, status: 'rejected' }, OTHER)
  assert.equal(db.rows('newpage_applications')[0].status, 'interview', 'another member cannot change it')
  r = await act({ action: 'apply_update', id, nothing: true })
  assert.equal(r.code, 400)
})

test('the weekly target is saved and shows in the pipeline', async () => {
  let r = await act({ action: 'apply_settings_set', weeklyTarget: 3 })
  assert.equal(r.body.applySettings.weeklyTarget, 3)
  assert.equal(r.body.pipeline.target, 3)
  r = await act({ action: 'apply_settings_set', weeklyTarget: 0 })
  assert.equal(r.body.pipeline.target, null)
})

test('me() carries the pipeline summary, not the full list', async () => {
  const r = await act({ action: 'me' })
  assert.ok(r.body.pipeline)
  assert.equal(r.body.pipeline.total, 1)
  assert.ok(!('applications' in r.body), 'the full list is fetched on demand')
})

test('Sky’s prompt gets one line about applications and where they live', () => {
  const sys = coachSystem({ member: ME, tasks: [], memory: [], pipeline: { total: 1, thisWeek: 1, lastWeek: 0, open: 1, waiting: 0, interviews: 1, byStatus: { interview: 1 }, last30: { viewed: 0, interview: 1, rejected: 0, offer: 0 } } })
  assert.match(sys, /Their applications \(logged in the app\): 1 application this week/)
  assert.match(sys, /Tools, Applications/)
  assert.ok(!coachSystem({ member: ME, tasks: [], memory: [], pipeline: null }).includes('Their applications'))
})

test('export includes applications; delete removes them and the apply settings', async () => {
  await act({ action: 'apply_settings_set', weeklyTarget: 2 })
  const out = await exportMemory(ME)
  assert.equal(out.applications.length, 1)
  assert.equal(out.applications[0].title, 'Support Worker')
  assert.equal(out.applications[0].status, 'interview')
  await eraseMemory(ME.id)
  assert.equal(db.rows('newpage_applications').length, 0)
  assert.equal(db.rows('newpage_tools').filter(t => t.member_id === ME.id && t.tool === 'apply').length, 0)
})

test('delete removes an entry, and the pipeline goes with it', async () => {
  const a = await act({ action: 'apply_add', title: 'Chef', company: 'Bistro' })
  const r = await act({ action: 'apply_delete', id: a.body.application.id })
  assert.equal(r.code, 200)
  assert.equal(r.body.pipeline.total, 0)
})

// ── Phase 2 ──
test('me() says where they are and whether Sky should offer; the Today card’s answers are kept', async () => {
  await act({ action: 'apply_add', title: 'Cook', company: 'Cafe' })
  let r = await act({ action: 'me' })
  assert.equal(r.body.apply.stage, 'applying')
  assert.equal(r.body.apply.decision, 'offer')
  assert.equal(r.body.apply.offer, null)
  r = await act({ action: 'apply_offer_set', answer: 'later' })
  assert.equal(r.body.apply.offer.answer, 'later')
  assert.equal(r.body.apply.decision, 'none', 'not now: quiet for a fortnight')
  r = await act({ action: 'apply_settings_set', weeklyTarget: 2 })
  assert.equal(r.body.apply.offer.answer, 'later', 'setting the target does not wipe the offer record')
  assert.equal(r.body.applySettings.weeklyTarget, 2)
  r = await act({ action: 'apply_offer_set', answer: 'no' })
  assert.equal(r.body.apply.offer.count, 1)
  r = await act({ action: 'apply_offer_set', answer: 'reset' })
  assert.equal(r.body.apply.offer, null)
  assert.equal(r.body.apply.decision, 'offer')
  r = await act({ action: 'apply_settings_set', emails: true })
  assert.equal(r.body.applySettings.emails, true)
  assert.equal(r.body.apply.emails, true)
})

test('Sky’s tools log, update, set the target and record the offer', async () => {
  // Drive the coach action's tool runner directly, the way runCoach would, with the model stubbed.
  const { runCoach } = await import('../lib/newpage-coach.js')
  assert.equal(typeof runCoach, 'function')
  process.env.ANTHROPIC_API_KEY = 'sk-test'
  const calls = [{ name: 'log_application', input: { title: 'Barista', company: 'Beanz', board: 'seek' } }, { name: 'log_application', input: { title: 'Barista', company: 'Beanz' } },
    { name: 'update_application', input: { title: 'barista', status: 'interview' } }, { name: 'update_application', input: { title: 'Nothing like this', status: 'rejected' } },
    { name: 'set_weekly_target', input: { n: 3 } }, { name: 'record_apply_offer', input: { answer: 'yes' } }, { name: 'record_apply_offer', input: { answer: 'maybe' } }]
  // runCoach allows three tool rounds per reply, so the calls go in batches of three, one coach message each.
  const batches = [calls.slice(0, 3), calls.slice(3, 6), calls.slice(6)]
  let batch = null, n = 0
  const results = []
  const origFetch = globalThis.fetch
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body)
    const last = body.messages[body.messages.length - 1]
    if (Array.isArray(last.content) && last.content[0]?.type === 'tool_result') results.push(...last.content.map(c => c.content))
    const c = batch.shift()
    if (c) return new Response(JSON.stringify({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't' + (++n), name: c.name, input: c.input }] }), { status: 200 })
    return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done.' }] }), { status: 200 })
  }
  try {
    for (const b of batches) { batch = [...b]; const r = await act({ action: 'coach', message: 'I applied for the barista job at Beanz' }); assert.equal(r.code, 200, JSON.stringify(r.body)) }
  } finally { globalThis.fetch = origFetch; delete process.env.ANTHROPIC_API_KEY }
  assert.match(results[0], /^Logged: Barista at Beanz, applied \d{4}-\d{2}-\d{2}\.$/)
  assert.match(results[1], /^Already logged: Barista at Beanz/)
  assert.match(results[2], /^Updated: Barista at Beanz is now interview\.$/)
  assert.match(results[3], /No logged application matches/)
  assert.match(results[4], /Target recorded: 3 a week/)
  assert.equal(results[5], 'Recorded.')
  assert.match(results[6], /yes, no or later/)
  const r = await act({ action: 'apply_list' })
  const b = r.body.applications.find(a => a.title === 'Barista')
  assert.equal(b.status, 'interview')
  assert.equal(b.board, 'seek')
  assert.equal(r.body.settings.weeklyTarget, 3)
  assert.equal(r.body.settings.offer.answer, 'yes')
})

// ── Phase 3 ──
test('search preferences save and merge; alerts are listed, opened, dismissed and marked applied', async () => {
  let r = await act({ action: 'apply_settings_set', roles: 'Aged care worker, Cook', locations: ['Geelong'], radiusKm: 40, salaryFloor: 55000, hours: 'part_time', fitFloor: 75 })
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.deepEqual(r.body.applySettings.roles, ['Aged care worker', 'Cook'])
  assert.equal(r.body.applySettings.radiusKm, 40)
  assert.equal(r.body.applySettings.fitFloor, 75)
  assert.equal(r.body.applySettings.weeklyTarget, 3, 'the target set earlier survives')
  r = await act({ action: 'apply_settings_set', alertEmails: true })
  assert.equal(r.body.applySettings.alertEmails, true)
  assert.deepEqual(r.body.applySettings.roles, ['Aged care worker', 'Cook'])
  // Alerts planted by the cron.
  const mk = (id, state, extra = {}) => ({ id, member_id: ME.id, external_id: 'x' + id.slice(-1), title: 'Pastry Cook', company: 'Cafe Two', url: 'https://www.seek.com.au/job/9' + id.slice(-1), state, fit: { score: 80, verdict: 'Close to home.' }, created_at: new Date().toISOString(), ...extra })
  db.rows('newpage_alerts').push(mk('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'new'), mk('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'seen'), mk('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'dismissed', { dismiss_reason: 'stale' }), { ...mk('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'new'), member_id: OTHER.id })
  r = await act({ action: 'me' })
  assert.equal(r.body.alerts.count, 1)
  assert.equal(r.body.alerts.open, 2)
  assert.equal(r.body.alerts.top[0].words, 'Looks like a strong fit, from the summary')
  r = await act({ action: 'alert_list' })
  assert.equal(r.body.alerts.length, 2, 'stale and filtered rows are not shown')
  r = await act({ action: 'alert_state', id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', state: 'opened' })
  assert.equal(db.rows('newpage_alerts').find(a => a.id.endsWith('a1')).state, 'opened')
  r = await act({ action: 'alert_state', id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', state: 'dismissed', reason: 'pay' })
  assert.deepEqual([db.rows('newpage_alerts').find(a => a.id.endsWith('a2')).state, db.rows('newpage_alerts').find(a => a.id.endsWith('a2')).dismiss_reason], ['dismissed', 'pay'])
  r = await act({ action: 'alert_state', id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', state: 'dismissed', reason: 'pay' })
  assert.equal(db.rows('newpage_alerts').find(a => a.id.endsWith('a4')).state, 'new', 'another member’s alert is untouched')
  r = await act({ action: 'alert_state', id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', state: 'applied' })
  assert.equal(r.code, 400, 'applied is set by logging, not by hand')
  r = await act({ action: 'apply_add', title: 'Pastry Cook', company: 'Cafe Two', url: 'https://www.seek.com.au/job/91', alert_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' })
  assert.equal(r.body.duplicate, false)
  assert.equal(db.rows('newpage_alerts').find(a => a.id.endsWith('a1')).state, 'applied')
  r = await act({ action: 'alerts_seen' })
  assert.equal(db.rows('newpage_alerts').filter(a => a.member_id === ME.id && a.state === 'new').length, 0)
})

// ── Review fixes ──
test('a job that was saved and is then applied for becomes the application, not a duplicate', async () => {
  let r = await act({ action: 'apply_add', title: 'Night Fill', company: 'Grocer', status: 'saved' })
  assert.equal(r.body.application.status, 'saved')
  assert.equal(r.body.pipeline.byStatus.saved, 1)
  const before = r.body.pipeline.thisWeek
  r = await act({ action: 'apply_add', title: 'Night Fill', company: 'Grocer', url: 'https://www.seek.com.au/job/4242', resume_doc_id: TAILORED.id })
  assert.equal(r.body.duplicate, false)
  assert.equal(r.body.updated, true)
  assert.equal(r.body.application.status, 'applied')
  assert.equal(r.body.pipeline.thisWeek, before + 1, 'it counts as sent this week')
  assert.equal(db.rows('newpage_applications').filter(a => a.member_id === ME.id && a.resume_doc_id === TAILORED.id).length >= 1, true)
  r = await act({ action: 'apply_add', title: 'Night Fill', company: 'Grocer' })
  assert.equal(r.body.duplicate, true, 'a second apply for the same job is still a duplicate')
})
