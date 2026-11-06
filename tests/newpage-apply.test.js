import { test } from 'node:test'
import assert from 'node:assert/strict'

const {
  weekOf, sydneyDate, daysBetween, normaliseUrl, boardFromUrl, dedupeKeys, findDuplicate,
  cleanApplication, cleanApplicationPatch, cleanApplySettings, fitFromDoc, pipelineSummary, pipelineLine, SEALED_FIELDS
} = await import('../lib/newpage-apply.js')

// ── Sydney weeks ──
test('weeks run Monday to Sunday', () => {
  assert.deepEqual(weekOf('2026-11-06'), { start: '2026-11-02', end: '2026-11-08' }) // a Friday
  assert.deepEqual(weekOf('2026-11-02'), { start: '2026-11-02', end: '2026-11-08' }) // Monday is its own start
  assert.deepEqual(weekOf('2026-11-08'), { start: '2026-11-02', end: '2026-11-08' }) // Sunday is the end
  assert.deepEqual(weekOf('2026-11-09'), { start: '2026-11-09', end: '2026-11-15' })
})

test('"today" is the Sydney date, across the DST change and at midnight', () => {
  // Sunday 23:30 Sydney (AEDT, UTC+11) is 12:30 UTC the same day; Monday 00:30 Sydney is 13:30 UTC Sunday.
  assert.equal(sydneyDate(new Date('2026-11-08T12:30:00Z')), '2026-11-08')
  assert.equal(sydneyDate(new Date('2026-11-08T13:30:00Z')), '2026-11-09')
  // First Sunday in April 2026 (clocks go back): 3am AEDT becomes 2am AEST. Still the 5th either side.
  assert.equal(sydneyDate(new Date('2026-04-04T15:30:00Z')), '2026-04-05')
  assert.equal(sydneyDate(new Date('2026-04-05T13:30:00Z')), '2026-04-05') // 23:30 AEST
  assert.equal(sydneyDate(new Date('2026-04-05T14:30:00Z')), '2026-04-06') // 00:30 AEST Monday
  assert.equal(daysBetween('2026-10-01', '2026-10-11'), 10)
})

// ── URLs and boards ──
test('the same ad with different tracking comes out the same', () => {
  const a = normaliseUrl('https://www.seek.com.au/job/81234567?type=standard&ref=search#top')
  const b = normaliseUrl('https://seek.com.au/job/81234567/')
  assert.equal(a, 'seek.com.au/job/81234567')
  assert.equal(a, b)
  assert.equal(normaliseUrl('not a url'), '')
  assert.equal(normaliseUrl('javascript:alert(1)'), '')
  assert.equal(normaliseUrl(''), '')
})

test('the board is read from the link', () => {
  assert.equal(boardFromUrl('https://www.seek.com.au/job/1'), 'seek')
  assert.equal(boardFromUrl('https://au.indeed.com/viewjob?jk=abc'), 'indeed')
  assert.equal(boardFromUrl('https://www.linkedin.com/jobs/view/1'), 'linkedin')
  assert.equal(boardFromUrl('https://au.jora.com/job/x'), 'jora')
  assert.equal(boardFromUrl('https://careers.acme.com.au/roles/12'), 'employer')
  assert.equal(boardFromUrl('nope'), 'other')
})

// ── Duplicates ──
test('one application is not logged twice within a week, by link or by role and organisation', () => {
  const existing = [
    { id: '1', title: 'Support Worker', company: 'Acme Care', url: 'https://www.seek.com.au/job/1?x=1', applied_at: '2026-11-03' },
    { id: '2', title: 'Chef', company: 'Bistro', url: '', applied_at: '2026-10-01' }
  ]
  assert.equal(findDuplicate(existing, { title: 'Anything', url: 'https://seek.com.au/job/1/', applied_at: '2026-11-06' })?.id, '1', 'same link')
  assert.equal(findDuplicate(existing, { title: 'support worker', company: 'ACME CARE', applied_at: '2026-11-06' })?.id, '1', 'same role and organisation')
  assert.equal(findDuplicate(existing, { title: 'Chef', company: 'Bistro', applied_at: '2026-11-06' }), null, 'same role, but five weeks later: a new application')
  assert.equal(findDuplicate(existing, { title: 'Support Worker', company: 'Other Co', applied_at: '2026-11-06' }), null, 'same title, different organisation')
  assert.equal(findDuplicate(existing, { title: 'Support Worker', applied_at: '2026-11-06' }), null, 'no organisation and no link: nothing to match on')
  assert.deepEqual(dedupeKeys({ title: 'A', company: 'B', url: 'https://x.com/y' }), ['url:x.com/y', 'tc:a|b'])
})

// ── Cleaning ──
test('a new entry needs a title; dates never land in the future; unknown values are dropped', () => {
  const now = new Date('2026-11-06T02:00:00Z') // Friday 13:00 Sydney
  assert.equal(cleanApplication({}), null)
  const a = cleanApplication({ title: '  Aged Care Worker ', company: 'Bupa', url: 'https://www.seek.com.au/job/9?ref=1', status: 'nonsense', applied_at: '2030-01-01', board: 'mars', source: 'hacker', notes: 'x'.repeat(5000) }, { now })
  assert.equal(a.title, 'Aged Care Worker')
  assert.equal(a.board, 'seek', 'board read from the link when the given one is unknown')
  assert.equal(a.status, 'applied')
  assert.equal(a.applied_at, '2026-11-06', 'a future date becomes today')
  assert.equal(a.source, 'member')
  assert.equal(a.notes.length, 2000)
  assert.equal(cleanApplication({ title: 'X', status: 'saved' }, { now }).applied_at, null, 'saved means not applied yet')
  assert.equal(cleanApplication({ title: 'X', url: 'garbage' }, { now }).url, '', 'a bad link is dropped, not kept')
  assert.equal(cleanApplication({ title: 'X', job: 'the ad' }, { now }).job_description, 'the ad')
})

test('a patch only carries what was asked for', () => {
  const now = new Date('2026-11-06T02:00:00Z')
  assert.deepEqual(cleanApplicationPatch({}, { now }), {})
  const p = cleanApplicationPatch({ status: 'interview', notes: 'Tuesday 10am', applied_at: '2030-01-01', title: '' }, { now })
  assert.equal(p.status, 'interview')
  assert.ok(p.status_at)
  assert.equal(p.notes, 'Tuesday 10am')
  assert.equal(p.applied_at, undefined, 'a future date is ignored')
  assert.equal(p.title, undefined, 'an empty title is ignored')
})

test('settings: the weekly target is a whole number from 1 to 50, or none', () => {
  assert.deepEqual(cleanApplySettings({ weeklyTarget: 3 }), { weeklyTarget: 3 })
  assert.deepEqual(cleanApplySettings({ weeklyTarget: '4' }), { weeklyTarget: 4 })
  assert.deepEqual(cleanApplySettings({ weeklyTarget: 0 }), { weeklyTarget: null })
  assert.deepEqual(cleanApplySettings({ weeklyTarget: 500 }), { weeklyTarget: null })
  assert.deepEqual(cleanApplySettings(null), { weeklyTarget: null })
})

test('the personal fields are the ones that get sealed', () => {
  assert.deepEqual(SEALED_FIELDS, ['title', 'company', 'url', 'job_description', 'notes'])
})

// ── Fit from a tailored resume ──
test('fit comes only from a tailored resume’s match table', () => {
  assert.equal(fitFromDoc({ resume: { candidate: {} } }), null, 'a base resume has no match table')
  assert.equal(fitFromDoc({ paragraphs: ['a letter'] }), null)
  assert.equal(fitFromDoc({ tailored: { match: [] } }), null)
  const f = fitFromDoc({ tailored: { match: [{ status: 'strong' }, { status: 'strong' }, { status: 'partial' }, { status: 'missing' }] } })
  assert.deepEqual(f, { score: 63, strong: 2, partial: 1, missing: 1, total: 4 })
})

// ── The pipeline ──
const now = new Date('2026-11-06T02:00:00Z') // Friday 6 Nov, 13:00 Sydney; week is Mon 2 to Sun 8
const apps = [
  { id: 'a', title: 'A', status: 'applied', applied_at: '2026-11-03', status_at: '2026-11-03T00:00:00Z', created_at: '2026-11-03T00:00:00Z' },
  { id: 'b', title: 'B', status: 'interview', applied_at: '2026-11-04', status_at: '2026-11-05T00:00:00Z', created_at: '2026-11-04T00:00:00Z' },
  { id: 'c', title: 'C', status: 'saved', applied_at: null, status_at: '2026-11-05T00:00:00Z', created_at: '2026-11-05T00:00:00Z' },
  { id: 'd', title: 'D', status: 'rejected', applied_at: '2026-10-28', status_at: '2026-11-02T00:00:00Z', created_at: '2026-10-28T00:00:00Z' },
  { id: 'e', title: 'E', status: 'applied', applied_at: '2026-10-20', status_at: '2026-10-20T00:00:00Z', created_at: '2026-10-20T00:00:00Z' },
  { id: 'f', title: 'F', status: 'withdrawn', applied_at: '2026-11-05', status_at: '2026-11-05T00:00:00Z', created_at: '2026-11-05T02:00:00Z' },
  { id: 'g', title: 'G', status: 'rejected', applied_at: '2026-08-01', status_at: '2026-08-10T00:00:00Z', created_at: '2026-08-01T00:00:00Z' }
]

test('the week’s picture: sent counts, open, waiting, outcomes', () => {
  const p = pipelineSummary(apps, { now, target: 3 })
  assert.deepEqual(p.week, { start: '2026-11-02', end: '2026-11-08' })
  assert.equal(p.thisWeek, 2, 'saved and withdrawn are not applications that went out')
  assert.equal(p.lastWeek, 1, 'the rejection applied on 28 Oct counts for last week')
  assert.equal(p.total, 5)
  assert.equal(p.open, 3, 'applied, interview and the old applied')
  assert.equal(p.waiting, 1, 'the one applied 17 days ago with no word')
  assert.equal(p.interviews, 1)
  assert.deepEqual(p.last30, { viewed: 0, interview: 1, rejected: 1, offer: 0 }, 'the August rejection is too old to count')
  assert.equal(p.byStatus.saved, 1)
  assert.equal(p.target, 3)
  assert.equal(p.recent.length, 5)
  assert.equal(p.recent[0].id, 'f', 'most recently logged first')
  assert.ok(!('notes' in p.recent[0]), 'the summary carries no notes or job text')
})

test('the Monday-morning count is zero even with applications on Sunday night', () => {
  const monday0030 = new Date('2026-11-08T13:30:00Z')
  const p = pipelineSummary([{ status: 'applied', applied_at: '2026-11-08', status_at: '2026-11-08T12:00:00Z' }], { now: monday0030 })
  assert.equal(p.thisWeek, 0)
  assert.equal(p.lastWeek, 1)
})

test('one line for Sky, facts only, and nothing when there is nothing', () => {
  assert.equal(pipelineLine(pipelineSummary([], { now })), '')
  const line = pipelineLine(pipelineSummary(apps, { now, target: 3 }))
  assert.match(line, /2 applications this week \(their target is 3\)/)
  assert.match(line, /1 last week/)
  assert.match(line, /3 open/)
  assert.match(line, /1 waiting 10\+ days/)
  assert.match(line, /1 at interview stage/)
  assert.match(line, /in the last 30 days: 1 interview, 1 rejection/)
  assert.match(line, /1 saved but not applied/)
  assert.ok(!/A|B|C/.test(line.replace(/Their applications|They/g, '')), 'no titles in the line')
  assert.match(pipelineLine(pipelineSummary([{ status: 'applied', applied_at: '2026-11-06', status_at: '' }], { now })), /^Their applications \(logged in the app\): 1 application this week; 0 last week; 1 open\.$/)
})
