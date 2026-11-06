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
  return { weeklyTarget: Number.isInteger(n) && n > 0 && n <= 50 ? n : null }
}

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
