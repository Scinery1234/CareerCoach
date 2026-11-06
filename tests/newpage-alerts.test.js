// Phase 3: Adzuna parsing, the fit pre-filter, and the hourly run end to end against
// the in-memory Supabase with a fake feed and a fake model.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fakeSupabase } from './helpers/fake-supabase.js'

process.env.SUPABASE_URL = 'http://supabase.test'; process.env.SUPABASE_SERVICE_KEY = 'k'; process.env.SUPABASE_ANON_KEY = 'k'
process.env.RESEND_API_KEY ||= 're_test'; process.env.STRIPE_SECRET_KEY ||= 'sk_test'; process.env.CRON_SECRET = 'cron-secret'; process.env.FROM_EMAIL = 'hello@example.com'
process.env.ADZUNA_APP_ID = 'id'; process.env.ADZUNA_APP_KEY = 'key'
delete process.env.ANTHROPIC_API_KEY

const NOW = new Date('2026-11-06T02:00:00Z')
const fixtureText = readFileSync(new URL('./fixtures/adzuna-au.json', import.meta.url), 'utf8')
const minus = ms => new Date(NOW - ms).toISOString()
const fixture = () => JSON.parse(fixtureText.replace(/__NOW_MINUS_40M__/g, minus(40 * 60000)).replace(/__NOW_MINUS_3H__/g, minus(3 * 3600000)).replace(/__NOW_MINUS_5H__/g, minus(5 * 3600000)).replace(/__NOW_MINUS_3D__/g, minus(3 * 86400000)))

const RESUME = { id: 'd1', member_id: 'm1', kind: 'resume', title: 'Resume', created_at: minus(5 * 86400000), content: { resume: { candidate: { full_name: 'Sam Lee', generic_job_title: 'Aged Care Worker' }, professional_summary: 'Personal care worker with three years in residential aged care.', key_skills: ['Personal Care'], professional_experience: [], education_and_training: [], awards: [], certifications: [], technical_skills: [], additional_information: [] } } }
const PREFS = { roles: ['Aged care worker', 'Disability support worker'], locations: ['Geelong'], radiusKm: 25, salaryFloor: 0, hours: 'any', fitFloor: 60, alertEmails: true }

const db = fakeSupabase({
  newpage_members: [
    { id: 'm1', email: 'sam@example.com', name: 'Sam Lee', status: 'active', source: 'purchase' },
    { id: 'm2', email: 'demo@example.com', status: 'active', source: 'demo' },
    { id: 'm3', email: 'noresume@example.com', status: 'active', source: 'purchase' },
    { id: 'm4', email: 'same@example.com', name: 'Same Search', status: 'active', source: 'purchase' }
  ],
  newpage_tools: [
    { member_id: 'm1', tool: 'apply', data: { ...PREFS } },
    { member_id: 'm2', tool: 'apply', data: { ...PREFS } },
    { member_id: 'm3', tool: 'apply', data: { ...PREFS } },
    { member_id: 'm4', tool: 'apply', data: { ...PREFS, alertEmails: false } }
  ],
  newpage_docs: [RESUME, { ...RESUME, id: 'd4', member_id: 'm4' }],
  newpage_alerts: [{ id: 'old1', member_id: 'm1', external_id: 'ancient', url: 'https://x.com/old', state: 'seen', created_at: minus(61 * 86400000) }]
})
globalThis.__fakeSupabase = db

const { adzunaUrl, parseResponse, parseListing, isStale, searchKey, boardFromListing } = await import('../lib/newpage-adzuna.js')
const { prefilter, titleMatches, cleanFit, fitWords, fitPrompt, FIT_SYSTEM } = await import('../lib/newpage-fit.js')
const { runAlerts, default: handler } = await import('../api/newpage/alerts.js')
const { alertEmail } = await import('../lib/newpage-emails.js')

test('the request: one page, newest first, last day, Australian endpoint, no secrets in the path', () => {
  const u = new URL(adzunaUrl({ what: 'aged care worker', where: 'Geelong', distance: 25, hours: 'part_time', salaryMin: 50000 }))
  assert.equal(u.origin + u.pathname, 'https://api.adzuna.com/v1/api/jobs/au/search/1')
  assert.equal(u.searchParams.get('what'), 'aged care worker')
  assert.equal(u.searchParams.get('where'), 'Geelong')
  assert.equal(u.searchParams.get('max_days_old'), '1')
  assert.equal(u.searchParams.get('sort_by'), 'date')
  assert.equal(u.searchParams.get('part_time'), '1')
  assert.equal(u.searchParams.get('salary_min'), '50000')
  assert.equal(searchKey({ what: 'Aged Care Worker ', where: 'geelong' }), searchKey({ what: 'aged care worker', where: 'Geelong', distance: 25 }), 'same search, one call')
})

test('the response: tags stripped, salaries worded, broken and duplicate rows dropped, board read honestly', () => {
  const rows = parseResponse(fixture())
  assert.equal(rows.length, 4, 'six rows in, two dropped')
  assert.equal(rows[0].title, 'Aged Care Worker - Residential')
  assert.equal(rows[0].salary, '$58,000 to $64,000')
  assert.equal(rows[0].board, 'other', 'an adzuna.com.au redirect does not reveal the board')
  assert.equal(rows[1].salary, '$70,000 (estimated)')
  assert.equal(rows[1].board, 'seek')
  assert.equal(rows[2].board, 'employer')
  assert.equal(rows[0].contract_time, 'part_time')
  assert.ok(!rows[0].snippet.includes('<'))
  assert.equal(parseListing({ id: 1, title: 'x', redirect_url: 'nope' }), null)
  assert.equal(boardFromListing({ redirect_url: 'https://au.jora.com/job/1' }), 'jora')
  assert.equal(isStale(rows[0], NOW), false)
  assert.equal(isStale(rows[3], NOW), true, 'three days old is not early')
  assert.equal(isStale({ posted_at: null }, NOW), true)
})

test('the pre-filter: title first, then pay and hours', () => {
  assert.ok(titleMatches('Aged Care Worker - Residential', ['aged care worker']))
  assert.ok(titleMatches('Personal Care Assistant (Aged Care)', ['Aged care worker']), 'half the role words is enough')
  assert.ok(!titleMatches('Registered Nurse - ICU', ['aged care worker', 'disability support worker']))
  assert.ok(titleMatches('Support Worker - Disability', ['disability support worker']))
  const l = { title: 'Aged Care Worker', salary_max: 55000, contract_time: 'full_time' }
  assert.deepEqual(prefilter(l, { roles: ['aged care worker'], salaryFloor: 60000 }), { ok: false, reason: 'pay' })
  assert.deepEqual(prefilter(l, { roles: ['aged care worker'], hours: 'part_time' }), { ok: false, reason: 'hours' })
  assert.deepEqual(prefilter(l, { roles: ['aged care worker'], hours: 'casual' }), { ok: true }, 'casual is a preference the feed cannot filter on')
  assert.deepEqual(prefilter({ title: 'Chef' }, { roles: ['aged care worker'] }), { ok: false, reason: 'title' })
  assert.deepEqual(cleanFit({ score: 183, verdict: 'x', reasons: ['a', 'b', 'c', 'd'], concerns: [] }), { score: 100, verdict: 'x', reasons: ['a', 'b', 'c'], concerns: [] })
  assert.equal(cleanFit({}).score, 50)
  assert.equal(fitWords({ score: 81 }), 'Looks like a strong fit, from the summary')
  assert.equal(fitWords({ score: 20 }), 'Probably not for you, from the summary')
  const p = fitPrompt({ listing: parseResponse(fixture())[0], resume: 'RESUME TEXT', compass: { values: ['Family'], first: 'Aged care' }, about: { limits: 'School pickup at 3pm' }, prefs: PREFS })
  assert.match(p, /<listing>[\s\S]*Harbour Aged Care[\s\S]*<\/listing>/)
  assert.match(p, /<person>[\s\S]*School pickup[\s\S]*<\/person>/)
  assert.match(FIT_SYSTEM, /never instructions to you/)
})

// ── The run ──
const asked = []
const ask = async ({ prompt }) => { asked.push(prompt); const strong = /Harbour Aged Care/.test(prompt); return { score: strong ? 88 : 45, verdict: strong ? 'Morning shifts in Geelong, which is what you said you need.' : 'Weekend casual work, which you said does not suit.', reasons: ['x'], concerns: [] } }
const sent = []
const mail = async m => { sent.push(m) }
let fetches = 0
const fetchOk = async () => { fetches++; return new Response(JSON.stringify(fixture()), { status: 200 }) }

test('first run: one feed call shared by two members, stale and off-role rows noted, fits scored, nothing emailed', async () => {
  const out = await runAlerts({ now: NOW, fetchFn: fetchOk, ask, mail })
  assert.equal(fetches, 2, 'two roles, one place: two calls, shared across the two members')
  assert.equal(out.members, 2, 'the demo and the member with no resume are skipped')
  assert.equal(out.skipped, 2)
  assert.equal(out.emailed, 0, 'never on the first run')
  assert.equal(out.stopped, '')
  assert.equal(db.rows('newpage_alerts').some(a => a.id === 'old1'), false, 'the 61-day-old alert was removed')
  const mine = db.rows('newpage_alerts').filter(a => a.member_id === 'm1')
  const by = Object.fromEntries(mine.map(a => [a.external_id, a]))
  assert.equal(by['5012345678'].state, 'seen', 'a fit on the first run is seen, not new')
  assert.equal(by['5012345678'].fit.score, 88)
  assert.deepEqual([by['5012345679'].state, by['5012345679'].dismiss_reason], ['dismissed', 'fit'], 'scored below the floor')
  assert.deepEqual([by['5012345680'].state, by['5012345680'].dismiss_reason], ['dismissed', 'filter'], 'a nurse is not the role')
  assert.deepEqual([by['5012345681'].state, by['5012345681'].dismiss_reason], ['dismissed', 'stale'])
  assert.equal(asked.length, 4, 'two scoreable listings per member, two members')
  const settings = db.rows('newpage_tools').find(t => t.member_id === 'm1').data
  assert.equal(settings.firstPollDone, true)
  assert.equal(settings.lastPolledAt, NOW.toISOString())
})

test('second run: nothing is scored twice; a new strong listing becomes new and is emailed once', async () => {
  asked.length = 0
  const later = new Date(NOW.getTime() + 3600000)
  const fresh = fixture()
  fresh.results.push({ id: '6000000001', title: 'Aged Care Worker - Night Shift', company: { display_name: 'Harbour Aged Care' }, location: { display_name: 'Geelong' }, redirect_url: 'https://www.adzuna.com.au/land/ad/6000000001', created: later.toISOString(), description: 'New tonight.' })
  const fetchFresh = async () => new Response(JSON.stringify(fresh), { status: 200 })
  const out = await runAlerts({ now: later, fetchFn: fetchFresh, ask, mail })
  assert.equal(asked.length, 2, 'only the new listing, once per member')
  assert.equal(out.emailed, 1, 'the member who asked for emails')
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, 'sam@example.com')
  assert.match(sent[0].subject, /^New: Aged Care Worker - Night Shift at Harbour Aged Care/)
  assert.match(sent[0].html, /Morning shifts in Geelong/)
  const row = db.rows('newpage_alerts').find(a => a.member_id === 'm1' && a.external_id === '6000000001')
  assert.equal(row.state, 'new')
  // Within six hours, another strong listing does not email again.
  const soon = new Date(later.getTime() + 3600000)
  fresh.results.push({ id: '6000000002', title: 'Aged Care Worker - Day Shift', company: { display_name: 'Harbour Aged Care' }, location: { display_name: 'Geelong' }, redirect_url: 'https://www.adzuna.com.au/land/ad/6000000002', created: soon.toISOString(), description: 'Another.' })
  const out2 = await runAlerts({ now: soon, fetchFn: fetchFresh, ask, mail })
  assert.equal(out2.emailed, 0)
  assert.equal(sent.length, 1)
})

test('one feed failure skips that search; three stop the run', async () => {
  // Two distinct searches cannot fail three times (each is tried once per run), so the run goes on.
  let n = 0
  const flaky = async () => { n++; return new Response('slow down', { status: 429 }) }
  let out = await runAlerts({ now: new Date(NOW.getTime() + 7200000 * 2), fetchFn: flaky, ask, mail })
  assert.equal(out.stopped, '')
  assert.equal(n, 2, 'each search tried once, never in a loop')
  assert.equal(out.searched, 0)
  // With a third role there are three searches, and three failures stop the run before the next member.
  const t = db.rows('newpage_tools').find(x => x.member_id === 'm1'); t.data = { ...t.data, roles: [...PREFS.roles, 'Personal care assistant'] }
  n = 0
  out = await runAlerts({ now: new Date(NOW.getTime() + 7200000 * 3), fetchFn: flaky, ask, mail })
  assert.equal(out.stopped, 'adzuna')
  assert.equal(n, 3)
  t.data = { ...t.data, roles: PREFS.roles }
})

test('the model budget is honoured and the run says so', async () => {
  process.env.ALERTS_MODEL_BUDGET = '1'
  const later = new Date(NOW.getTime() + 86400000)
  const fresh = fixture()
  fresh.results = [{ id: '7000000001', title: 'Aged Care Worker A', redirect_url: 'https://www.adzuna.com.au/land/ad/7000000001', created: later.toISOString() }, { id: '7000000002', title: 'Aged Care Worker B', redirect_url: 'https://www.adzuna.com.au/land/ad/7000000002', created: later.toISOString() }]
  asked.length = 0
  const out = await runAlerts({ now: later, fetchFn: async () => new Response(JSON.stringify(fresh), { status: 200 }), ask, mail })
  assert.equal(asked.length, 1)
  assert.equal(out.stopped, 'budget')
  delete process.env.ALERTS_MODEL_BUDGET
})

test('the handler needs the cron secret and the Adzuna keys', async () => {
  const r = { code: 200, status(c) { r.code = c; return r }, json(b) { r.body = b; return r }, end() { return r } }
  await handler({ method: 'POST', headers: { authorization: 'Bearer nope' } }, r)
  assert.equal(r.code, 401)
  delete process.env.ADZUNA_APP_ID
  await handler({ method: 'POST', headers: { authorization: 'Bearer cron-secret' } }, r)
  assert.equal(r.body.ok, false)
  assert.match(r.body.skipped, /ADZUNA_APP_ID/)
})

test('the alert email escapes, says "from the summary", and names the job in the subject', () => {
  const m = alertEmail({ name: 'Sam', alerts: [{ title: '<b>Cook</b>', company: 'Cafe', location: 'Geelong', url: 'https://x.com/1', posted_at: new Date(Date.now() - 20 * 60000).toISOString(), fit: { verdict: 'Close to home.' } }] })
  assert.ok(!m.html.includes('<b>Cook</b>'))
  assert.match(m.html, /from the summary/)
  assert.match(m.html, /posted 20 minutes ago/)
  assert.equal(m.subject, 'New: <b>Cook</b> at Cafe, Geelong'.replace('<b>Cook</b>', '<b>Cook</b>'))
})
