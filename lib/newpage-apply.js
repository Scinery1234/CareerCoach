// The application log: what a member has applied for, what came back, and the
// week-by-week picture Sky and the Today tab show. Pure functions only, so the
// handler in api/newpage/app.js stays thin and everything here runs in tests
// without a database.
//
// Which fields are personal and sealed with the member's key (see newpage-vault.js):
// title, company, url, job_description, notes. Everything the pipeline summary and
// the crons filter on stays plain: status, board, applied_at, status_at, fit, source.

export const BOARDS = ['seek', 'indeed', 'linkedin', 'jora', 'employer', 'other']
export const STATUSES = ['saved', 'applied', 'viewed', 'screening', 'interview', 'offer', 'rejected', 'withdrawn', 'no_reply']
// Counted as "an application went out". Saved and withdrawn are not.
export const SENT = new Set(['applied', 'viewed', 'screening', 'interview', 'offer', 'rejected', 'no_reply'])
// Still waiting on the employer.
export const OPEN = new Set(['applied', 'viewed', 'screening', 'interview'])
export const SOURCES = ['member', 'alert', 'extension']
export const SEALED_FIELDS = ['title', 'company', 'url', 'job_description', 'notes']
export const STATUS_LABEL = { saved: 'Saved', applied: 'Applied', viewed: 'Viewed', screening: 'Screening call', interview: 'Interview', offer: 'Offer', rejected: 'Rejected', withdrawn: 'Withdrawn', no_reply: 'No reply' }
export const BOARD_LABEL = { seek: 'Seek', indeed: 'Indeed', linkedin: 'LinkedIn', jora: 'Jora', employer: 'Employer site', other: 'Other' }

const TZ = 'Australia/Sydney'
const str = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '')
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ── Dates, Sydney time ──
// Weeks run Monday to Sunday in Sydney, like the month in newpage-usage.js.
export const sydneyDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now)

const toUTC = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
const fromUTC = ms => new Date(ms).toISOString().slice(0, 10)
const DAY = 86400000

// { start, end } of the Monday-to-Sunday week holding `date` (a YYYY-MM-DD string).
export function weekOf(date) {
  const ms = toUTC(date)
  const dow = (new Date(ms).getUTCDay() + 6) % 7 // Monday = 0
  const start = ms - dow * DAY
  return { start: fromUTC(start), end: fromUTC(start + 6 * DAY) }
}
export const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / DAY)
export const cleanDate = v => (typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(toUTC(v)) ? v : null)

// ── Boards and URLs ──
export function boardFromUrl(url) {
  let host
  try { host = new URL(String(url)).hostname.toLowerCase() } catch { return 'other' }
  if (/(^|\.)seek\.(com\.au|co\.nz|com)$/.test(host)) return 'seek'
  if (/(^|\.)indeed\.com$/.test(host)) return 'indeed'
  if (/(^|\.)linkedin\.com$/.test(host)) return 'linkedin'
  if (/(^|\.)jora\.com$/.test(host)) return 'jora'
  return 'employer'
}

// host + path, lower case, no www, no query or hash, no trailing slash. Two links
// to the same ad with different tracking parameters come out the same.
export function normaliseUrl(url) {
  let u
  try { u = new URL(String(url || '').trim()) } catch { return '' }
  if (!/^https?:$/.test(u.protocol)) return ''
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  const path = u.pathname.replace(/\/+$/, '').toLowerCase()
  return host + path
}

const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Two log entries are the same application if they point at the same ad, or
// name the same role at the same organisation.
export function dedupeKeys(a) {
  const keys = []
  const u = normaliseUrl(a.url)
  if (u) keys.push('url:' + u)
  const t = slug(a.title), c = slug(a.company)
  if (t && c) keys.push('tc:' + t + '|' + c)
  return keys
}

// The entry in `existing` that is the same application as `candidate`, logged
// within `days` of it, or null.
export function findDuplicate(existing, candidate, days = 7) {
  const keys = new Set(dedupeKeys(candidate))
  if (!keys.size) return null
  const when = candidate.applied_at || sydneyDate()
  for (const e of existing || []) {
    if (!dedupeKeys(e).some(k => keys.has(k))) continue
    const d = e.applied_at ? Math.abs(daysBetween(e.applied_at, when)) : 0
    if (d <= days) return e
  }
  return null
}

// ── Cleaning ──
// The fields a member (or Sky, or the extension) may set on an entry. Unknown
// values are dropped, not guessed. Returns null when there is nothing to log.
export function cleanApplication(b, { now = new Date() } = {}) {
  b = b && typeof b === 'object' ? b : {}
  const title = str(b.title, 200)
  if (!title) return null
  const url = normaliseUrl(b.url) ? str(b.url, 1000) : ''
  const board = BOARDS.includes(b.board) ? b.board : url ? boardFromUrl(url) : 'other'
  const status = STATUSES.includes(b.status) ? b.status : 'applied'
  const today = sydneyDate(now)
  let applied_at = cleanDate(b.applied_at) || (SENT.has(status) ? today : null)
  if (applied_at && applied_at > today) applied_at = today // nothing is logged in the future
  return {
    title, company: str(b.company, 200), board, url,
    job_description: typeof b.job === 'string' ? b.job.trim().slice(0, 20000) : typeof b.job_description === 'string' ? b.job_description.trim().slice(0, 20000) : '',
    status, applied_at, notes: str(b.notes, 2000),
    source: SOURCES.includes(b.source) ? b.source : 'member'
  }
}

// What may change on an existing entry.
export function cleanApplicationPatch(b, { now = new Date() } = {}) {
  b = b && typeof b === 'object' ? b : {}
  const patch = {}
  if (STATUSES.includes(b.status)) { patch.status = b.status; patch.status_at = now.toISOString() }
  if (b.applied_at !== undefined) { const d = cleanDate(b.applied_at); if (d && d <= sydneyDate(now)) patch.applied_at = d }
  if (b.notes !== undefined) patch.notes = str(b.notes, 2000)
  if (b.title !== undefined) { const t = str(b.title, 200); if (t) patch.title = t }
  if (b.company !== undefined) patch.company = str(b.company, 200)
  if (BOARDS.includes(b.board)) patch.board = b.board
  return patch
}

// Settings the member keeps for applying. Phase 1: the weekly target only.
// 0 or null means no target. Later phases add boards, roles and locations.
export function cleanApplySettings(raw) {
  raw = raw && typeof raw === 'object' ? raw : {}
  const n = Number(raw.weeklyTarget)
  const o = raw.offer && typeof raw.offer === 'object' && ['yes', 'no', 'later'].includes(raw.offer.answer) ? {
    answer: raw.offer.answer, at: cleanDate(raw.offer.at) || null, stage: typeof raw.offer.stage === 'string' ? raw.offer.stage.slice(0, 20) : null,
    patterns: Array.isArray(raw.offer.patterns) ? raw.offer.patterns.map(x => String(x).slice(0, 40)).slice(0, 8) : [], count: Number.isInteger(raw.offer.count) ? raw.offer.count : 0
  } : null
  const list = (v, max, len) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\n]/) : []).map(x => str(x, len)).filter(Boolean).filter((x, i, a) => a.findIndex(y => y.toLowerCase() === x.toLowerCase()) === i).slice(0, max)
  const int = (v, lo, hi, dflt) => { const x = Number(v); return Number.isInteger(x) && x >= lo && x <= hi ? x : dflt }
  const iso = v => (typeof v === 'string' && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toISOString() : null)
  return {
    weeklyTarget: Number.isInteger(n) && n > 0 && n <= 50 ? n : null,
    offer: o, // what Sky offered and what they said (Phase 2)
    emails: raw.emails === true, // the Sunday check-in note, off until chosen
    // Early alerts (Phase 3): what to look for, and the record of looking.
    roles: list(raw.roles, 5, 80),
    locations: list(raw.locations, 3, 80),
    radiusKm: int(raw.radiusKm, 5, 200, 25),
    salaryFloor: int(raw.salaryFloor, 0, 1000000, 0),
    hours: ['any', 'full_time', 'part_time', 'casual'].includes(raw.hours) ? raw.hours : 'any',
    fitFloor: int(raw.fitFloor, 0, 100, 60),
    alertEmails: raw.alertEmails === true,
    lastPolledAt: iso(raw.lastPolledAt),
    firstPollDone: raw.firstPollDone === true,
    lastAlertEmailAt: iso(raw.lastAlertEmailAt)
  }
}
export const wantsAlerts = s => !!(s && s.roles.length)

// Alert states and the reasons a member can dismiss with.
export const ALERT_STATES = ['new', 'seen', 'opened', 'dismissed', 'applied']
export const DISMISS_REASONS = ['pay', 'location', 'hours', 'level', 'not_for_me', 'fit', 'stale', 'filter']
export const DISMISS_LABEL = { pay: 'Pay', location: 'Location', hours: 'Hours', level: 'Level', not_for_me: 'Not for me' }

// ── Fit, from a tailored resume ──
// The tailor step leaves a match table on the document. The fit copied onto the
// log entry is a summary of it, so the entry still makes sense if the document is
// deleted. Null when the document has no match table (a base resume, a cover letter).
export function fitFromDoc(content) {
  const m = content?.tailored?.match
  if (!Array.isArray(m) || !m.length) return null
  const n = s => m.filter(x => x?.status === s).length
  const strong = n('strong'), partial = n('partial'), missing = n('missing'), total = strong + partial + missing
  if (!total) return null
  return { score: Math.round((100 * (strong + 0.5 * partial)) / total), strong, partial, missing, total }
}

// ── The pipeline ──
// Counts for the Today card and for Sky. `apps` are opened rows (titles readable).
export function pipelineSummary(apps, { now = new Date(), target = null } = {}) {
  apps = Array.isArray(apps) ? apps : []
  const today = sydneyDate(now)
  const week = weekOf(today)
  const last = weekOf(fromUTC(toUTC(week.start) - DAY))
  const sent = apps.filter(a => SENT.has(a.status) && a.applied_at)
  const inWeek = (a, w) => a.applied_at >= w.start && a.applied_at <= w.end
  const byStatus = {}
  for (const a of apps) byStatus[a.status] = (byStatus[a.status] || 0) + 1
  const open = apps.filter(a => OPEN.has(a.status))
  const sinceDays = a => daysBetween(a.applied_at || today, today)
  const recentOutcome = s => apps.filter(a => a.status === s && a.status_at && (now - new Date(a.status_at)) / DAY <= 30).length
  // Most recently logged first (the order the member added them, newest at the top).
  const recent = [...apps].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 5)
    .map(a => ({ id: a.id, title: a.title, company: a.company, board: a.board, status: a.status, applied_at: a.applied_at }))
  return {
    week, today, target,
    thisWeek: sent.filter(a => inWeek(a, week)).length,
    lastWeek: sent.filter(a => inWeek(a, last)).length,
    total: sent.length,
    open: open.length,
    waiting: open.filter(a => a.status === 'applied' && sinceDays(a) >= 10).length,
    interviews: apps.filter(a => a.status === 'interview').length,
    byStatus,
    last30: { viewed: recentOutcome('viewed'), interview: recentOutcome('interview'), rejected: recentOutcome('rejected'), offer: recentOutcome('offer') },
    recent
  }
}

// One short line for Sky's system prompt. Facts only; what to do with them is
// the prompt's business.
export function pipelineLine(p) {
  if (!p || (!p.total && !p.byStatus?.saved)) return ''
  const parts = [`${p.thisWeek} application${p.thisWeek === 1 ? '' : 's'} this week${p.target ? ` (their target is ${p.target})` : ''}`, `${p.lastWeek} last week`]
  if (p.open) parts.push(`${p.open} open`)
  if (p.waiting) parts.push(`${p.waiting} waiting 10+ days with no reply`)
  if (p.interviews) parts.push(`${p.interviews} at interview stage`)
  const o = p.last30
  const outs = [o.offer && `${o.offer} offer${o.offer === 1 ? '' : 's'}`, o.interview && `${o.interview} interview${o.interview === 1 ? '' : 's'}`, o.rejected && `${o.rejected} rejection${o.rejected === 1 ? '' : 's'}`].filter(Boolean)
  if (outs.length) parts.push(`in the last 30 days: ${outs.join(', ')}`)
  if (p.byStatus?.saved) parts.push(`${p.byStatus.saved} saved but not applied`)
  return `Their applications (logged in the app): ${parts.join('; ')}.`
}

// ── Where they are with applying (Phase 2) ──
// Worked out in code from what is already in the account, so Sky is told a fact
// rather than asked to guess one.
//   not_yet    no approved resume
//   ready      a resume, or a tailored resume or letter in the last 14 days, and nothing sent
//   applying   something sent in the last 14 days
//   stalled    documents made in the last 14 days but nothing sent for 7+ days, or
//              nothing sent in the 7 days after a rejection
//   waiting    open applications 10+ days old and nothing sent for 7+ days
export const STAGES = ['not_yet', 'ready', 'applying', 'stalled', 'waiting']

export function applyStage({ docs = [], apps = [], now = new Date() } = {}) {
  const today = sydneyDate(now)
  const ago = d => (d ? daysBetween(String(d).slice(0, 10), today) : Infinity)
  const hasResume = docs.some(d => d.kind === 'resume')
  if (!hasResume) return 'not_yet'
  const sent = apps.filter(a => SENT.has(a.status) && a.applied_at)
  const lastSent = sent.length ? Math.min(...sent.map(a => ago(a.applied_at))) : Infinity
  const recentDocs = docs.some(d => ago(d.created_at) <= 14)
  const rejected = apps.filter(a => a.status === 'rejected' && a.status_at)
  const lastRejection = rejected.length ? Math.min(...rejected.map(a => ago(a.status_at))) : Infinity
  if (lastSent >= 7 && ((recentDocs && sent.length) || (lastRejection >= 7 && lastRejection <= 28 && lastSent > lastRejection))) return 'stalled'
  if (lastSent >= 7 && apps.some(a => OPEN.has(a.status) && ago(a.applied_at) >= 10)) return 'waiting'
  if (lastSent <= 14) return 'applying'
  if (recentDocs && lastSent >= 7 && !sent.length) return 'ready'
  return 'ready'
}

// Things worth naming, each with a stable key so an offer can remember which it saw.
// Thresholds are deliberate: one quiet day is not a pattern.
export function applyPatterns({ apps = [], matches = [], dismissals = [], now = new Date() } = {}) {
  const today = sydneyDate(now)
  const ago = d => (d ? daysBetween(String(d).slice(0, 10), today) : Infinity)
  const out = []
  const sent = apps.filter(a => SENT.has(a.status) && a.applied_at)
  const rejected = apps.filter(a => a.status === 'rejected' && a.status_at)
  if (rejected.length) {
    const last = Math.min(...rejected.map(a => ago(a.status_at)))
    const sinceThen = sent.filter(a => ago(a.applied_at) < last).length
    if (last >= 7 && last <= 28 && !sinceThen) out.push({ key: 'silent_after_rejection', line: `Nothing has gone out in the ${last} days since a rejection.` })
  }
  const saved = apps.filter(a => a.status === 'saved' && ago(a.created_at) >= 7)
  if (saved.length >= 3) out.push({ key: 'saved_not_applied', line: `${saved.length} jobs were saved more than a week ago and never applied for.` })
  const heard = apps.filter(a => ['viewed', 'screening', 'interview', 'offer'].includes(a.status)).length
  if (sent.length >= 8 && !heard) out.push({ key: 'nothing_viewed', line: `${sent.length} applications sent and none marked as viewed or taken further.` })
  // The same requirement missing across several tailored resumes.
  const missing = new Map()
  for (const m of matches.slice(0, 6)) for (const r of m || []) if (r?.status === 'missing' && r.requirement) { const k = slug(r.requirement); if (k) missing.set(k, (missing.get(k) || { n: 0, text: r.requirement })); missing.get(k).n++ }
  const gap = [...missing.values()].filter(x => x.n >= 3).sort((a, b) => b.n - a.n)[0]
  if (gap) out.push({ key: 'same_gap', line: `"${gap.text}" is missing from ${gap.n} of their recent tailored resumes.` })
  // Several alerts dismissed for the same reason in a fortnight: the search may be off.
  const reasons = new Map()
  for (const d of dismissals) if (d?.reason && ['pay', 'location', 'hours', 'level', 'not_for_me'].includes(d.reason) && ago(d.created_at) <= 14) reasons.set(d.reason, (reasons.get(d.reason) || 0) + 1)
  const top = [...reasons.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])[0]
  if (top) out.push({ key: 'dismissed_' + top[0], line: `${top[1]} suggested jobs dismissed for ${DISMISS_LABEL[top[0]].toLowerCase()} in the last fortnight.` })
  return out
}

// What Sky should do about offering help with applying. `offer` is the record kept
// in the apply settings: { answer: 'yes'|'no'|'later', at: 'YYYY-MM-DD', stage, patterns: [keys], count }.
//   offer     never offered, and they are at a stage where it would help
//   reoffer   said no or later a fortnight or more ago, and something has changed since
//   none      otherwise (they said yes and are using it, said no twice, or nothing has changed)
export function offerDecision({ stage, patterns = [], offer = null, now = new Date() } = {}) {
  if (stage === 'not_yet') return 'none'
  if (!offer || !offer.answer) return 'offer'
  if (offer.answer === 'yes') return 'none'
  const since = offer.at ? daysBetween(offer.at, sydneyDate(now)) : Infinity
  if (since < 14) return 'none'
  if (offer.answer === 'no' && (offer.count || 1) >= 2) return 'none'
  const newPattern = patterns.some(p => !(offer.patterns || []).includes(p.key))
  const worse = ['stalled', 'waiting'].includes(stage) && stage !== offer.stage
  if (offer.answer === 'later') return 'reoffer'
  return newPattern || worse ? 'reoffer' : 'none'
}

export const OFFER_ANSWERS = ['yes', 'no', 'later']
export function recordOffer(prev, { answer, stage, patterns = [], now = new Date() }) {
  if (!OFFER_ANSWERS.includes(answer)) return prev || null
  return { answer, at: sydneyDate(now), stage: STAGES.includes(stage) ? stage : 'ready', patterns: patterns.map(p => p.key || p).filter(Boolean).slice(0, 8), count: answer === 'no' ? ((prev?.answer === 'no' ? prev.count || 1 : 0) + 1) : (prev?.count || 0) }
}

// The block for Sky's system prompt in the general focuses: the stage as a fact, the
// patterns as things it may raise, and what to do about offering.
export function applyPromptLines({ stage, patterns = [], offer = null, decision = 'none', coach = 'career' }) {
  if (stage === 'not_yet' || !stage) return ''
  const lines = []
  const STAGE_TEXT = {
    ready: 'They have a resume ready but have not logged an application yet.',
    applying: 'They have been applying in the last fortnight.',
    stalled: 'They made documents recently but nothing has gone out for a week or more.',
    waiting: 'They have applications out for 10 or more days with no word, and nothing new has gone out this week.'
  }
  lines.push(`Where they are with applying: ${STAGE_TEXT[stage]}`)
  if (patterns.length) lines.push(`Patterns in their applications (you may name one, in one plain sentence, and ask how it sits with them; never as a verdict): ${patterns.slice(0, 3).map(p => p.line).join(' ')}`)
  if (coach === 'applying') return lines.join('\n')
  if (decision === 'offer') {
    lines.push('You have not yet offered help with the applying side. Bring it up once, briefly, in your own voice, when there is a natural moment (not as your opening line if they came with something else). Say in one sentence what you can do: see their applications, help them log and track what goes out, talk through what gets in the way, and set a weekly rhythm if they want one. Then follow their answer, and record it with record_apply_offer (yes, no or later). If yes, suggest the Applying focus or simply carry on here.')
  } else if (decision === 'reoffer') {
    lines.push(`You offered help with applying on ${offer?.at} and they said ${offer?.answer === 'no' ? 'no' : 'not now'}. Something has changed since, so you may raise it once more: name what you noticed in one plain sentence and ask, do not push. Record their answer with record_apply_offer. If they say no again, do not offer again unless they ask.`)
  } else if (offer?.answer === 'no') {
    lines.push(`You offered help with applying on ${offer.at} and they said no. Do not offer again unless they ask. Mention their applications only if they raise them.`)
  } else if (offer?.answer === 'yes') {
    lines.push('They have said yes to help with applying. Refer to their applications when relevant, log one with log_application when they say they have applied, and update one with update_application when they tell you what happened.')
  } else {
    lines.push('Mention their applications only if they raise them, ask how it is going, or ask you to log one.')
  }
  return lines.join('\n')
}
