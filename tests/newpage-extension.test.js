// The browser helper's endpoint: pairing, token rotation, the narrow set of actions,
// the hourly limit, and the answer matcher.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fakeSupabase } from './helpers/fake-supabase.js'

process.env.JWT_SECRET = 'test-secret'
process.env.SUPABASE_URL = 'http://supabase.test'; process.env.SUPABASE_SERVICE_KEY = 'k'; process.env.SUPABASE_ANON_KEY = 'k'
process.env.RESEND_API_KEY ||= 're_test'; process.env.STRIPE_SECRET_KEY ||= 'sk_test'
delete process.env.ANTHROPIC_API_KEY

const ME = { id: '66666666-6666-4666-8666-666666666666', email: 'sam@example.com', name: 'Sam Lee', status: 'active', source: 'purchase', plan_started_at: new Date().toISOString() }
const RESUME = { id: '77777777-7777-4777-8777-777777777777', member_id: ME.id, kind: 'resume', title: 'Resume: Support Worker at Acme', created_at: '2026-11-01T00:00:00Z', content: { resume: { candidate: { full_name: 'Sam Lee', phone: '0400 000 000', email: 'sam@example.com', location: 'Geelong VIC', linkedin: '', generic_job_title: 'Support Worker' }, professional_summary: 'Support worker with four years in disability services.', key_skills: ['Personal Care'], professional_experience: [{ job_title: 'Support Worker', employer: 'Acme Care', location: '', start_date: 'March 2022', end_date: 'Present', scope_statement: '', achievements: ['Supported 12 participants'] }], education_and_training: [], awards: [], certifications: [], technical_skills: [], additional_information: [] }, tailored: { role: 'Support Worker', company: 'Acme', match: [{ status: 'strong' }] } } }
const db = fakeSupabase({ newpage_members: [ME], newpage_docs: [RESUME], newpage_content: [], newpage_tools: [{ member_id: ME.id, tool: 'apply', data: { roles: ['Support worker'], answers: { workRights: 'Australian citizen', notice: 'Two weeks', licence: 'Full licence, own car', checks: 'NDIS Worker Screening, WWCC', custom: [{ q: 'Why do you want to work with us?', a: 'Your community model matches how I like to work.' }] } } }] })
globalThis.__fakeSupabase = db

const { signSession, signExt, readToken } = await import('../lib/newpage-auth.js')
const { default: app } = await import('../api/newpage/app.js')
const { default: ext } = await import('../api/newpage/extension.js')
const { matchStandard, matchCustom, groundedIn, cleanAnswers } = await import('../lib/newpage-answers.js')

const res = () => { const r = { code: 200, body: null, status(c) { r.code = c; return r }, json(b) { r.body = b; return r }, end() { return r } }; return r }
const viaApp = async body => { const r = res(); await app({ method: 'POST', headers: { authorization: `Bearer ${signSession(ME.id)}` }, body }, r); return r }
const viaExt = async body => { const r = res(); await ext({ method: 'POST', headers: {}, body }, r); return r }

let pairing, access
test('pairing from the app gives a token once; only its hash is stored; the list shows the browser', async () => {
  const r = await viaApp({ action: 'extension_pair', device: 'Chrome on laptop' })
  assert.equal(r.code, 200, JSON.stringify(r.body))
  pairing = r.body.token
  assert.ok(pairing.length > 30)
  assert.equal(db.rows('newpage_extension_tokens').length, 1)
  assert.notEqual(db.rows('newpage_extension_tokens')[0].token_hash, pairing)
  assert.equal(r.body.extensions[0].device, 'Chrome on laptop')
})

test('the pairing token is exchanged for a 15-minute access token and rotated; the old one dies', async () => {
  const r = await viaExt({ action: 'ext_refresh', refresh: pairing })
  assert.equal(r.code, 200, JSON.stringify(r.body))
  access = r.body.access
  assert.equal(readToken(access, 'ext').sub, ME.id)
  assert.equal(readToken(access, 'session'), null, 'never a session')
  assert.equal(r.body.expires_in, 900)
  const again = await viaExt({ action: 'ext_refresh', refresh: pairing })
  assert.equal(again.code, 401, 'the used pairing token is revoked')
  pairing = r.body.refresh
  const live = db.rows('newpage_extension_tokens').filter(t => !t.revoked_at)
  assert.equal(live.length, 1)
  assert.equal((await viaApp({ action: 'extension_list' })).body.extensions.length, 1)
})

test('the helper reads profile, documents and applications, and nothing else', async () => {
  let r = await viaExt({ action: 'ext_profile', access })
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.equal(r.body.contact.phone, '0400 000 000')
  assert.equal(r.body.answers.workRights, 'Australian citizen')
  assert.ok(r.body.standard.some(s => s.id === 'notice'))
  r = await viaExt({ action: 'ext_docs', access })
  assert.equal(r.body.docs.length, 1)
  assert.equal(r.body.docs[0].tailored.company, 'Acme')
  assert.ok(r.body.docs[0].content.resume, 'content comes along so the Word file can be built')
  r = await viaExt({ action: 'coach', access, message: 'hi' })
  assert.equal(r.code, 400, 'no coaching, memory or notes through this door')
  r = await viaExt({ action: 'ext_profile', access: signSession(ME.id) })
  assert.equal(r.code, 401, 'a member session is not an access token')
})

test('answers: standard ones match by what the question says; ambiguity and the rest are left to the member', async () => {
  const a = { workRights: 'Australian citizen', notice: 'Two weeks', licence: 'No licence', salary: '$65,000', hoursAvailable: 'Weekdays, school hours', checks: 'WWCC' }
  assert.deepEqual(matchStandard('Which of the following statements best describes your right to work in Australia?', a, { options: ["I'm an Australian citizen", 'I require sponsorship'] }), { answer: "I'm an Australian citizen", source: 'standard', from: 'workRights' })
  assert.equal(matchStandard('Do you have a current driver’s licence?', a).answer, 'No')
  assert.equal(matchStandard('What is your notice period?', a).answer, 'Two weeks')
  assert.equal(matchStandard('What are your salary expectations?', a).answer, '$65,000')
  assert.equal(matchStandard('Do you have a Working with Children Check?', a).answer, 'Yes')
  assert.equal(matchStandard('Tell us about a time you handled conflict', a), null, 'a real question is not a standard one')
  assert.equal(matchStandard('When can you start, and what salary do you expect?', a), null, 'two matches: ask the member')
  assert.equal(matchStandard('Your availability to start', { ...a, hoursAvailable: 'x' }).from, 'notice', '"availability to start" is notice, not hours')
  assert.equal(matchCustom('Why would you like to work for Acme?', [{ q: 'Why do you want to work with us?', a: 'Because' }]), null, 'different enough to ask')
  assert.equal(matchCustom('Why do you want to work with us', [{ q: 'Why do you want to work with us?', a: 'Because' }]).answer, 'Because')
  const r = await viaExt({ action: 'ext_answers', access, questions: ['Do you have the right to work in Australia?', { label: 'Do you hold an NDIS Worker Screening check?', options: ['Yes', 'No'] }, 'Why do you want to work with us?', 'Describe a time you supported a participant through a difficult day.'] })
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.deepEqual(r.body.answers.map(x => x.source), ['standard', 'standard', 'standard', 'ask'])
  assert.equal(r.body.answers[1].answer, 'Yes')
  assert.equal(r.body.drafted, false, 'no model key: nothing drafted, nothing invented')
})

test('a drafted answer that claims a figure the record does not show is set aside', () => {
  const sources = 'Supported 12 participants across three houses. Budget $40,000.'
  assert.equal(groundedIn('I supported 12 participants and managed a $40,000 budget.', sources), true)
  assert.equal(groundedIn('I supported 12 participants and managed a $90,000 budget.', sources), false)
  assert.equal(groundedIn('I improved outcomes by 35%.', sources), false)
  assert.equal(groundedIn('Over two years I worked 3 shifts a week, since 2022.', sources), true, 'small counts and years are not claims')
  const out = cleanAnswers({ answers: [{ question: 'Q1', answer: 'I cut costs by 40%.', grounded: true }, { question: 'Q2', answer: "You'll need to answer this one: they want your WWCC number.", grounded: false }, { question: 'Q3', answer: 'Yes, I hold a current WWCC.', grounded: true }] }, ['Q1', 'Q2', 'Q3'], sources + ' WWCC')
  assert.equal(out[0].source, 'ask'); assert.match(out[0].note, /set aside/)
  assert.equal(out[1].source, 'ask'); assert.match(out[1].note, /WWCC number/)
  assert.equal(out[2].source, 'drafted')
})

test('logging from the helper goes through the same rules as the app', async () => {
  let r = await viaExt({ action: 'ext_log', access, title: 'Support Worker', company: 'Acme', url: 'https://www.seek.com.au/job/5?ref=x', board: 'seek', resume_doc_id: RESUME.id })
  assert.equal(r.code, 200, JSON.stringify(r.body))
  assert.equal(r.body.duplicate, false)
  assert.equal(r.body.application.source, 'extension')
  assert.equal(r.body.application.fit.strong, 1)
  r = await viaExt({ action: 'ext_log', access, title: 'Same job', url: 'https://seek.com.au/job/5/' })
  assert.equal(r.body.duplicate, true)
  r = await viaExt({ action: 'ext_applications', access })
  assert.equal(r.body.applications.length, 1)
  assert.ok(!('notes' in r.body.applications[0]))
  const seen = await viaApp({ action: 'apply_list' })
  assert.equal(seen.body.applications[0].source, 'extension')
})

test('capture is off until the member turns it on, and stores only what looks like their roles', async () => {
  let r = await viaExt({ action: 'ext_capture', access, listings: [{ title: 'Support Worker - Lara', url: 'https://www.seek.com.au/job/900' }] })
  assert.deepEqual(r.body, { stored: 0, reason: 'off' })
  await viaApp({ action: 'apply_answers_set', answers: { workRights: 'Australian citizen' }, capture: true })
  r = await viaExt({ action: 'ext_capture', access, listings: [{ title: 'Support Worker - Lara', url: 'https://www.seek.com.au/job/900' }, { title: 'Forklift Driver', url: 'https://www.seek.com.au/job/901' }] })
  assert.equal(r.body.stored, 0, 'no model key: nothing is scored, so nothing is stored as a fit')
  assert.equal(db.rows('newpage_alerts').length, 0)
})

test('revoking from the app ends the helper’s access on its next refresh; sign-out everywhere revokes all', async () => {
  const list = (await viaApp({ action: 'extension_list' })).body.extensions
  await viaApp({ action: 'extension_revoke', id: list[0].id })
  const r = await viaExt({ action: 'ext_refresh', refresh: pairing })
  assert.equal(r.code, 401)
  assert.equal(r.body.code, 'unpaired')
  await viaApp({ action: 'extension_pair' }); await viaApp({ action: 'extension_pair' })
  await viaApp({ action: 'extension_revoke', id: 'all' })
  assert.equal((await viaApp({ action: 'extension_list' })).body.extensions.length, 0)
})

test('the hourly limit is counted in the database, not in memory', async () => {
  const token = signExt(ME.id)
  const month = 'h:' + new Date().toISOString().slice(0, 13)
  const row = db.rows('newpage_usage').find(u => u.member_id === ME.id && u.month === month && u.kind === 'ext')
  if (row) row.count = 119; else db.rows('newpage_usage').push({ member_id: ME.id, month, kind: 'ext', count: 119 })
  let r = await viaExt({ action: 'ext_docs', access: token })
  assert.equal(r.code, 200)
  r = await viaExt({ action: 'ext_docs', access: token })
  assert.equal(r.code, 429)
  assert.equal(r.body.code, 'ext_limit')
})
