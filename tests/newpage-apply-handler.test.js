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
  assert.deepEqual(r.body.settings, { weeklyTarget: null })
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
