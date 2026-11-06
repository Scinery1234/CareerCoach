// Phase 2: where a member is with applying, the patterns worth naming, and whether
// Sky should offer help. All in code, so Sky is told facts rather than asked to guess.
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL ||= 'http://supabase.test'
process.env.SUPABASE_SERVICE_KEY ||= 'k'
process.env.SUPABASE_ANON_KEY ||= 'k'

const { applyStage, applyPatterns, offerDecision, recordOffer, applyPromptLines } = await import('../lib/newpage-apply.js')
const { coachSystem, COACH_TOOLS } = await import('../lib/newpage-coach.js')
const { COACHES, coachList } = await import('../lib/newpage-coaches.js')

const now = new Date('2026-11-06T02:00:00Z') // Friday 6 Nov, 13:00 Sydney
const d = n => { const x = new Date(now); x.setUTCDate(x.getUTCDate() - n); return x.toISOString() }
const day = n => d(n).slice(0, 10)
const resume = (n = 3) => ({ kind: 'resume', created_at: d(n) })
const sent = (n, status = 'applied') => ({ status, applied_at: day(n), status_at: d(n), created_at: d(n) })
const member = { id: 'm', name: 'Sam', plan_started_at: now.toISOString() }

test('stages', () => {
  assert.equal(applyStage({ docs: [], apps: [sent(1)], now }), 'not_yet', 'no resume, whatever the log says')
  assert.equal(applyStage({ docs: [resume()], apps: [], now }), 'ready')
  assert.equal(applyStage({ docs: [resume(40)], apps: [], now }), 'ready', 'an old resume and nothing sent is still ready')
  assert.equal(applyStage({ docs: [resume()], apps: [sent(2)], now }), 'applying')
  assert.equal(applyStage({ docs: [resume(3)], apps: [sent(12)], now }), 'stalled', 'a fresh document, nothing sent for 12 days')
  assert.equal(applyStage({ docs: [resume(40)], apps: [sent(20), { ...sent(20), status: 'rejected', status_at: d(10) }], now }), 'stalled', 'quiet for 10 days after a rejection')
  assert.equal(applyStage({ docs: [resume(40)], apps: [sent(12)], now }), 'waiting', 'one out for 12 days, nothing since')
  assert.equal(applyStage({ docs: [resume(40)], apps: [sent(12), sent(3)], now }), 'applying', 'still sending, so not waiting')
})

test('patterns need real data behind them', () => {
  assert.deepEqual(applyPatterns({ apps: [], now }), [])
  // One rejection five days ago: not yet a pattern. Eight days: it is.
  assert.deepEqual(applyPatterns({ apps: [{ ...sent(15), status: 'rejected', status_at: d(5) }], now }), [])
  const p = applyPatterns({ apps: [{ ...sent(15), status: 'rejected', status_at: d(8) }], now })
  assert.equal(p[0]?.key, 'silent_after_rejection')
  assert.match(p[0].line, /8 days since a rejection/)
  // Something sent after the rejection clears it.
  assert.deepEqual(applyPatterns({ apps: [{ ...sent(15), status: 'rejected', status_at: d(8) }, sent(2)], now }), [])
  // Saved and never applied: two is not a pattern, three is.
  const saved = n => ({ status: 'saved', applied_at: null, status_at: d(n), created_at: d(n) })
  assert.deepEqual(applyPatterns({ apps: [saved(10), saved(9)], now }), [])
  assert.equal(applyPatterns({ apps: [saved(10), saved(9), saved(8), saved(1)], now })[0].key, 'saved_not_applied')
  assert.match(applyPatterns({ apps: [saved(10), saved(9), saved(8), saved(1)], now })[0].line, /^3 jobs/)
  // Nothing viewed: seven sent is not enough, eight is; one "viewed" clears it.
  const many = n => Array.from({ length: n }, (_, i) => sent(i + 1))
  assert.deepEqual(applyPatterns({ apps: many(7), now }), [])
  assert.equal(applyPatterns({ apps: many(8), now })[0].key, 'nothing_viewed')
  assert.deepEqual(applyPatterns({ apps: [...many(8), sent(9, 'viewed')], now }), [])
  // The same requirement missing across three tailored resumes.
  const m = req => [{ requirement: req, status: 'missing' }, { requirement: 'Other', status: 'strong' }]
  assert.deepEqual(applyPatterns({ apps: [], matches: [m('Forklift licence'), m('Forklift licence')], now }), [])
  const g = applyPatterns({ apps: [], matches: [m('Forklift licence'), m('forklift licence'), m('Forklift Licence'), m('Budget')], now })
  assert.equal(g[0].key, 'same_gap')
  assert.match(g[0].line, /Forklift licence.*3 of their recent/)
})

test('offering: once, then only when something changes, and never after a second no', () => {
  assert.equal(offerDecision({ stage: 'not_yet', now }), 'none')
  assert.equal(offerDecision({ stage: 'ready', offer: null, now }), 'offer')
  assert.equal(offerDecision({ stage: 'ready', offer: { answer: 'yes', at: day(30) }, now }), 'none', 'they said yes: nothing to offer')
  const no = recordOffer(null, { answer: 'no', stage: 'ready', patterns: [], now: new Date(d(20)) })
  assert.deepEqual(no, { answer: 'no', at: day(20), stage: 'ready', patterns: [], count: 1 })
  assert.equal(offerDecision({ stage: 'ready', offer: no, now }), 'none', 'nothing changed')
  assert.equal(offerDecision({ stage: 'stalled', offer: no, now }), 'reoffer', 'stage got worse')
  assert.equal(offerDecision({ stage: 'ready', offer: no, patterns: [{ key: 'saved_not_applied' }], now }), 'reoffer', 'a new pattern')
  assert.equal(offerDecision({ stage: 'stalled', offer: { ...no, at: day(5) }, now }), 'none', 'too soon, even though worse')
  assert.equal(offerDecision({ stage: 'stalled', offer: { ...no, patterns: ['saved_not_applied'] }, patterns: [{ key: 'saved_not_applied' }], now }), 'reoffer', 'same pattern but a worse stage')
  assert.equal(offerDecision({ stage: 'ready', offer: { ...no, patterns: ['saved_not_applied'] }, patterns: [{ key: 'saved_not_applied' }], now }), 'none', 'same pattern, same stage')
  const second = recordOffer(no, { answer: 'no', stage: 'stalled', patterns: [{ key: 'x' }], now })
  assert.equal(second.count, 2)
  assert.deepEqual(second.patterns, ['x'])
  assert.equal(offerDecision({ stage: 'waiting', offer: { ...second, at: day(60) }, patterns: [{ key: 'y' }], now }), 'none', 'two nos: stop')
  const later = recordOffer(null, { answer: 'later', stage: 'ready', now: new Date(d(15)) })
  assert.equal(later.count, 0)
  assert.equal(offerDecision({ stage: 'ready', offer: later, now }), 'reoffer', '"not now" comes back after a fortnight regardless')
  assert.equal(offerDecision({ stage: 'ready', offer: { ...later, at: day(13) }, now }), 'none')
  assert.equal(recordOffer({ answer: 'no' }, { answer: 'maybe' })?.answer, 'no', 'a bad answer leaves the record alone')
})

test('the prompt block: stage as a fact, patterns as things Sky may raise, and the offer rule', () => {
  assert.equal(applyPromptLines({ stage: 'not_yet', decision: 'offer' }), '')
  const offer = applyPromptLines({ stage: 'ready', decision: 'offer' })
  assert.match(offer, /have a resume ready but have not logged an application/)
  assert.match(offer, /Bring it up once, briefly/)
  assert.match(offer, /not as your opening line/)
  assert.match(offer, /record_apply_offer/)
  const re = applyPromptLines({ stage: 'stalled', decision: 'reoffer', offer: { answer: 'no', at: '2026-10-20' } })
  assert.match(re, /offered help with applying on 2026-10-20 and they said no/)
  assert.match(re, /raise it once more/)
  assert.match(re, /do not offer again unless they ask/)
  const declined = applyPromptLines({ stage: 'applying', decision: 'none', offer: { answer: 'no', at: '2026-10-20' } })
  assert.match(declined, /Do not offer again unless they ask/)
  assert.match(declined, /only if they raise them/)
  const quiet = applyPromptLines({ stage: 'ready', decision: 'none', offer: null })
  assert.match(quiet, /only if they raise them/)
  assert.ok(!/Bring it up/.test(quiet))
  const yes = applyPromptLines({ stage: 'applying', decision: 'none', offer: { answer: 'yes' } })
  assert.match(yes, /said yes to help with applying/)
  const withP = applyPromptLines({ stage: 'ready', decision: 'none', patterns: [{ key: 'k', line: 'Three saved.' }] })
  assert.match(withP, /you may name one, in one plain sentence.*never as a verdict.*Three saved\./)
  // In the Applying focus the offer rules are left out: they are already there.
  const inFocus = applyPromptLines({ stage: 'ready', decision: 'offer', coach: 'applying' })
  assert.ok(!/Bring it up/.test(inFocus) && /resume ready/.test(inFocus))
})

test('Sky’s system prompt carries the block in every focus, and the Applying focus has its rules', () => {
  const apply = { stage: 'ready', decision: 'offer', offer: null, patterns: [] }
  const career = coachSystem({ member, tasks: [], memory: [], apply })
  assert.match(career, /Where they are with applying/)
  assert.match(career, /Bring it up once/)
  const action = coachSystem({ member, tasks: [], memory: [], apply, coach: 'action' })
  assert.match(action, /Bring it up once/)
  const applying = coachSystem({ member, tasks: [], memory: [], apply, coach: 'applying' })
  assert.match(applying, /Focus: Applying/)
  assert.match(applying, /Never propose a target/)
  assert.match(applying, /Avoid advice/)
  assert.match(applying, /suicide, self-harm or crisis/, 'the safety line is there')
  assert.ok(!/Bring it up once/.test(applying))
  assert.ok(coachList().some(c => c.id === 'applying' && c.starters.length >= 3))
  assert.match(COACHES.applying.prompt, /log_application/)
  for (const t of ['log_application', 'update_application', 'set_weekly_target', 'record_apply_offer']) assert.ok(COACH_TOOLS.some(x => x.name === t), t)
  assert.match(COACH_TOOLS.find(t => t.name === 'log_application').description, /Only after they say it happened/)
  assert.match(COACH_TOOLS.find(t => t.name === 'set_weekly_target').description, /never propose one/)
  assert.ok(!coachSystem({ member, tasks: [], memory: [], apply: { stage: 'not_yet', decision: 'none', patterns: [] } }).includes('Where they are with applying'))
})
