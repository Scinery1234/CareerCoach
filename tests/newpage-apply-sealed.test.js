// With a memory key set, the personal fields of an application are stored sealed
// and come back readable; status and dates stay plain so the pipeline can filter.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fakeSupabase } from './helpers/fake-supabase.js'

process.env.JWT_SECRET = 'test-secret'
process.env.SUPABASE_URL = 'http://supabase.test'
process.env.SUPABASE_SERVICE_KEY = 'k'
process.env.SUPABASE_ANON_KEY = 'k'
process.env.RESEND_API_KEY ||= 're_test'
process.env.STRIPE_SECRET_KEY ||= 'sk_test'
process.env.NEWPAGE_MEMORY_KEY = randomBytes(32).toString('base64')
delete process.env.ANTHROPIC_API_KEY

const ME = { id: '55555555-5555-4555-8555-555555555555', email: 'sam@example.com', name: 'Sam', status: 'active', source: 'purchase', plan_started_at: new Date().toISOString() }
const db = fakeSupabase({ newpage_members: [ME], newpage_content: [] })
globalThis.__fakeSupabase = db

const { signSession } = await import('../lib/newpage-auth.js')
const { isEncrypted } = await import('../lib/newpage-crypto.js')
const { default: handler } = await import('../api/newpage/app.js')

async function act(body) {
  const r = { code: 200, body: null, status(c) { r.code = c; return r }, json(b) { r.body = b; return r }, end() { return r } }
  await handler({ method: 'POST', headers: { authorization: `Bearer ${signSession(ME.id)}` }, body }, r)
  return r
}

test('personal fields are sealed at rest and readable through the app; plain fields stay plain', async () => {
  const r = await act({ action: 'apply_add', title: 'Support Worker', company: 'Acme', url: 'https://www.seek.com.au/job/1', job: 'The whole ad', notes: 'private' })
  assert.equal(r.code, 200, JSON.stringify(r.body))
  const row = db.rows('newpage_applications')[0]
  for (const f of ['title', 'company', 'url', 'job_description', 'notes']) assert.ok(isEncrypted(row[f]), `${f} is sealed`)
  assert.equal(row.status, 'applied')
  assert.equal(row.board, 'seek')
  assert.match(row.applied_at, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(r.body.application.title, 'Support Worker')
  assert.equal(r.body.application.notes, 'private')
  const list = await act({ action: 'apply_list' })
  assert.equal(list.body.applications[0].company, 'Acme')
  // The duplicate check reads the sealed link, so the same ad is still caught.
  const again = await act({ action: 'apply_add', title: 'Other words', url: 'https://seek.com.au/job/1/' })
  assert.equal(again.body.duplicate, true)
  // Settings go through the member's key too.
  await act({ action: 'apply_settings_set', weeklyTarget: 4 })
  const tool = db.rows('newpage_tools').find(t => t.tool === 'apply')
  assert.ok(tool.data && tool.data.enc, 'the apply settings are sealed')
  assert.equal((await act({ action: 'me' })).body.pipeline.target, 4)
})
