// Adzuna's job search API for Australia: the one licensed way to find new listings
// across Seek, Indeed, Jora and employer sites. This file builds the request and
// reads the response; it never fetches a job board page, and it never follows the
// redirect link (that is for the member to open).
// Docs: https://developer.adzuna.com/overview. Free tier is small, so the cron in
// api/newpage/alerts.js shares one call between every member who wants the same
// role in the same place.
import { normaliseUrl } from './newpage-apply.js'

const BASE = 'https://api.adzuna.com/v1/api/jobs/au/search'
const str = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '')

export const adzunaReady = () => !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY)

// One search. `what` is a role title, `where` a suburb or city, `distance` in km.
export function adzunaUrl({ what, where, distance = 25, maxDaysOld = 1, page = 1, perPage = 50, salaryMin = 0, hours = 'any' }) {
  const u = new URL(`${BASE}/${Math.max(1, Math.min(10, Number(page) || 1))}`)
  u.searchParams.set('app_id', process.env.ADZUNA_APP_ID || '')
  u.searchParams.set('app_key', process.env.ADZUNA_APP_KEY || '')
  u.searchParams.set('results_per_page', String(Math.max(1, Math.min(50, perPage))))
  u.searchParams.set('what', str(what, 100))
  if (where) { u.searchParams.set('where', str(where, 100)); u.searchParams.set('distance', String(Math.max(5, Math.min(200, Number(distance) || 25)))) }
  u.searchParams.set('max_days_old', String(Math.max(1, Math.min(30, Number(maxDaysOld) || 1))))
  u.searchParams.set('sort_by', 'date')
  u.searchParams.set('content-type', 'application/json')
  if (salaryMin > 0) u.searchParams.set('salary_min', String(Math.round(salaryMin)))
  if (hours === 'full_time') u.searchParams.set('full_time', '1')
  if (hours === 'part_time') u.searchParams.set('part_time', '1')
  return u.toString()
}

// The key for sharing one call between members: same role, same place, same radius.
export const searchKey = ({ what, where, distance = 25 }) => `${str(what, 100).toLowerCase()}|${str(where, 100).toLowerCase()}|${Math.round(Number(distance) || 25)}`

// A listing in our shape. Anything odd is dropped rather than guessed.
export function parseListing(r) {
  if (!r || typeof r !== 'object') return null
  const id = str(String(r.id ?? ''), 40)
  const url = str(r.redirect_url, 1000)
  const title = str(r.title, 200).replace(/<\/?strong>/g, '')
  if (!id || !url || !title || !normaliseUrl(url)) return null
  const min = Number(r.salary_min) || 0, max = Number(r.salary_max) || 0
  const salary = min || max ? (min && max && min !== max ? `$${Math.round(min).toLocaleString('en-AU')} to $${Math.round(max).toLocaleString('en-AU')}` : `$${Math.round(max || min).toLocaleString('en-AU')}`) + (r.salary_is_predicted === '1' || r.salary_is_predicted === 1 ? ' (estimated)' : '') : ''
  const posted = r.created ? new Date(r.created) : null
  return {
    external_id: id,
    title,
    company: str(r.company?.display_name, 200),
    location: str(r.location?.display_name, 200),
    salary, salary_min: min || null, salary_max: max || null,
    url,
    board: boardFromListing(r),
    posted_at: posted && !Number.isNaN(posted.getTime()) ? posted.toISOString() : null,
    snippet: str(r.description, 1000).replace(/<\/?strong>/g, ''),
    category: str(r.category?.label, 80),
    contract_time: r.contract_time === 'full_time' || r.contract_time === 'part_time' ? r.contract_time : '',
    contract_type: r.contract_type === 'permanent' || r.contract_type === 'contract' ? r.contract_type : ''
  }
}

// Adzuna's redirect link goes through adzuna.com.au, so the board usually cannot be
// read from it. When the link is a board's own, say so; otherwise "other", honestly.
export function boardFromListing(r) {
  let host = ''
  try { host = new URL(String(r?.redirect_url || '')).hostname.toLowerCase() } catch { return 'other' }
  if (/(^|\.)seek\.(com\.au|co\.nz|com)$/.test(host)) return 'seek'
  if (/(^|\.)indeed\.com$/.test(host)) return 'indeed'
  if (/(^|\.)jora\.com$/.test(host)) return 'jora'
  if (/(^|\.)linkedin\.com$/.test(host)) return 'linkedin'
  if (/(^|\.)adzuna\./.test(host)) return 'other'
  return 'employer'
}

export function parseResponse(json) {
  const rows = Array.isArray(json?.results) ? json.results : []
  const out = [], seen = new Set()
  for (const r of rows) {
    const l = parseListing(r)
    if (!l || seen.has(l.external_id)) continue
    seen.add(l.external_id)
    out.push(l)
  }
  return out
}

// Older than this and it is not "early" any more: stored as stale, never scored.
export const STALE_HOURS = 36
export const isStale = (listing, now = new Date()) => !listing.posted_at || (now - new Date(listing.posted_at)) / 3600000 > STALE_HOURS

// One call, with the failure shape the cron expects. `fetchFn` is swapped in tests.
export async function searchAdzuna(params, fetchFn = fetch) {
  const res = await fetchFn(adzunaUrl(params), { headers: { accept: 'application/json' } })
  if (res.status === 429) throw Object.assign(new Error('Adzuna rate limit'), { status: 429, retryable: true })
  if (!res.ok) throw Object.assign(new Error(`Adzuna ${res.status}`), { status: res.status, retryable: res.status >= 500 })
  return parseResponse(await res.json())
}
