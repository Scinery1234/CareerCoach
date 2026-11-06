import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET = 'test-secret'
process.env.NEXT_PUBLIC_URL = 'https://example.org'
process.env.STRIPE_SECRET_KEY = 'sk_test_x'
process.env.SUPABASE_URL = 'http://supabase.test'
process.env.SUPABASE_SERVICE_KEY = 'k'
process.env.SUPABASE_ANON_KEY = 'k'

const { cleanOnboarding, markOnboarding, nextModule, stripFor, isSpent, moduleReady, cleanIntent, ORDER, CARDS, STRIP_LABELS, MODULES } = await import('../lib/newpage-onboarding.js')
const { toolsSessionParams } = await import('../lib/newpage-stripe.js')
const { buildMe } = await import('../lib/newpage-app.js')
const { pickSampleAd, SAMPLE_ADS } = await import('../app/sample-ads.js')

const NOW = new Date(Date.UTC(2026, 10, 6, 3))

test('onboarding state is cleaned: unknown modules, bad dates and junk are dropped', () => {
  const s = cleanOnboarding({ intent: 'hack', done: { sky: '2026-11-06T01:02:03Z', nope: '2026-11-06', tailor: 'yesterday' }, dismissed: 'x', seen: { app: 2, sky: -1, cover: 'lots' } })
  assert.deepEqual(s, { intent: 'resume', done: { sky: '2026-11-06' }, dismissed: {}, seen: { app: 2 } })
  assert.equal(cleanOnboarding(null).intent, 'resume')
  assert.equal(cleanOnboarding(null, 'interview').intent, 'interview', 'the member column is the fallback')
  assert.equal(cleanOnboarding({ intent: 'stuck' }, 'interview').intent, 'stuck', 'but the state wins once set')
  assert.equal(cleanIntent('direction'), 'direction')
  assert.equal(cleanIntent('DIRECTION'), 'resume')
})

test('marking done, dismissed and seen builds the state, and reset clears a module', () => {
  let s = markOnboarding(null, 'done', 'sky', NOW)
  assert.equal(s.done.sky, '2026-11-06')
  s = markOnboarding(s, 'seen', 'tailor', NOW); s = markOnboarding(s, 'seen', 'tailor', NOW)
  assert.equal(s.seen.tailor, 2)
  s = markOnboarding(s, 'dismissed', 'cover', NOW)
  assert.equal(s.dismissed.cover, '2026-11-06')
  assert.deepEqual(markOnboarding(s, 'done', 'not-a-module', NOW), s, 'unknown modules change nothing')
  s = markOnboarding(s, 'reset', 'tailor', NOW)
  assert.equal(s.seen.tailor, undefined)
})

test('the first-line card comes first, then the intent order, skipping spent modules', () => {
  assert.equal(nextModule(cleanOnboarding(null)), 'app')
  const afterLine = markOnboarding(null, 'done', 'app', NOW)
  assert.equal(nextModule(afterLine), 'resume_in', 'resume is the default intent')
  assert.equal(nextModule(markOnboarding(afterLine, 'done', 'resume_in', NOW)), 'tailor')
  const dismissed = markOnboarding(markOnboarding(afterLine, 'dismissed', 'resume_in', NOW), 'dismissed', 'tailor', NOW)
  assert.equal(nextModule(dismissed), 'sky')
  const twice = markOnboarding(markOnboarding(afterLine, 'seen', 'resume_in', NOW), 'seen', 'resume_in', NOW)
  assert.equal(nextModule(twice), 'tailor', 'a card shown twice without a win steps aside')
  assert.ok(isSpent(twice, 'resume_in') && !isSpent(afterLine, 'resume_in'))
  const direction = cleanOnboarding({ intent: 'direction', done: { app: '2026-11-06' } })
  assert.equal(nextModule(direction), 'sky')
  assert.equal(nextModule({ intent: 'resume', done: { app: 'x' } }, { demo: true }), 'sky', 'the demo has its own order and no first-line card')
  const all = ORDER.resume.reduce((s, m) => markOnboarding(s, 'done', m, NOW), afterLine)
  assert.equal(nextModule(all), null)
})

test('the strip follows the intent and knows what is done', () => {
  const s = cleanOnboarding({ intent: 'interview', done: { sky: '2026-11-06' } })
  assert.deepEqual(stripFor(s), [{ module: 'sky', done: true }, { module: 'resume_in', done: false }, { module: 'session', done: false }, { module: 'tailor', done: false }])
  for (const intent of Object.keys(ORDER)) for (const m of ORDER[intent]) { assert.ok(CARDS[m], `${m} has a card`); assert.ok(STRIP_LABELS[m], `${m} has a label`); assert.ok(MODULES.includes(m)) }
})

test('modules that need something to exist wait for it', () => {
  assert.equal(moduleReady('tailor', {}), false)
  assert.equal(moduleReady('tailor', { hasResume: true }), true)
  assert.equal(moduleReady('cover', { hasResume: false }), false)
  assert.equal(moduleReady('report', { checkins: 1 }), false)
  assert.equal(moduleReady('report', { compassDone: true }), true)
  assert.equal(moduleReady('planner', { tasks: 0 }), false)
  assert.equal(moduleReady('sky', {}), true)
})

test('the ad angle rides along in Stripe metadata and comes back on the member', () => {
  const p = toolsSessionParams({ email: 'a@b.co', name: 'Sam', intent: 'stuck' })
  assert.equal(p.metadata.intent, 'stuck')
  assert.equal(p.subscription_data.metadata.intent, 'stuck')
  assert.equal(toolsSessionParams({ email: 'a@b.co', name: 'Sam' }).metadata.intent, undefined, 'no angle, no key')
  const member = { id: 'm1', email: 'a@b.co', name: 'Sam', source: 'tools', plan_started_at: NOW.toISOString(), intent: 'stuck', onboarding: { done: { app: '2026-11-06' } } }
  const me = buildMe({ member, progress: [], tasks: [], checkins: [], memory: [], messages: [], now: NOW.getTime() })
  assert.deepEqual(me.onboarding, { intent: 'stuck', done: { app: '2026-11-06' }, dismissed: {}, seen: {} })
  assert.equal(buildMe({ member: { ...member, intent: null, onboarding: null }, progress: [], tasks: [], checkins: [], memory: [], messages: [], now: NOW.getTime() }).onboarding.intent, 'resume')
})

test('a sample ad is chosen from the words in the resume, and every sample is a real ad', () => {
  assert.equal(pickSampleAd('Support worker, NDIS participants, care plans').id, 'care')
  assert.equal(pickSampleAd('Policy officer at the department, stakeholder consultation').id, 'policy')
  assert.equal(pickSampleAd('').id, 'ops', 'nothing to go on: the first one')
  for (const s of SAMPLE_ADS) { assert.ok(s.ad.length > 400 && s.role && s.company, s.id); assert.ok(/About you|What you bring|looking for/.test(s.ad)) }
})
