import { supabase } from '../../lib/supabase.js'
import { sendMail, fromAddress } from '../../lib/newpage-mail.js'
import { alertEmail } from '../../lib/newpage-emails.js'
import { openVault, openJson } from '../../lib/newpage-vault.js'
import { cleanApplySettings, wantsAlerts, normaliseUrl } from '../../lib/newpage-apply.js'
import { adzunaReady, searchAdzuna, searchKey, isStale } from '../../lib/newpage-adzuna.js'
import { prefilter, FIT_SYSTEM, FIT_SCHEMA, fitPrompt, cleanFit } from '../../lib/newpage-fit.js'
import { askJson, COACH_MODEL } from '../../lib/newpage-coach.js'
import { resumeText } from '../../lib/newpage-resume.js'
import { cleanCompass } from '../../lib/newpage-tools.js'
import { cleanAbout } from '../../lib/newpage-context.js'
import { isTools, usageAllowance, usageSpend } from '../../lib/newpage-usage.js'

// Hourly cron (vercel.json). For every member who set roles under Tools, Applications:
// ask Adzuna for listings posted in the last day, one call per distinct role-and-place
// shared across members, drop what is stale or plainly not the role, score the rest
// against the member's resume and what they said matters, and store the good ones as
// alerts. Emails go only to members who asked, never on the first run, and at most
// once every six hours. Nothing here fetches a job board page.
//
// Budgets keep one run inside the function limit and the free API tier:
const MODEL_BUDGET = () => Math.max(1, Number(process.env.ALERTS_MODEL_BUDGET) || 25) // model calls per run
const PER_MEMBER = 8            // listings scored per member per run
const MAX_FAILURES = 3          // Adzuna failures before the run stops
const EMAIL_GAP_MS = 6 * 3600000
const EMAIL_MIN_SCORE = 75
const KEEP_DAYS = 60

const DAY = 86400000

async function readTool(member, vault, tool, sealed) {
  const { data } = await supabase.from('newpage_tools').select('data').eq('member_id', member.id).eq('tool', tool).maybeSingle()
  return sealed ? openJson(vault, `tool:${tool}`, data?.data) : data?.data
}

// The core, separated from the request so tests can drive it with a fake fetch and a fake model.
export async function runAlerts({ now = new Date(), fetchFn = fetch, ask = askJson, mail = sendMail } = {}) {
  const out = { members: 0, searched: 0, scored: 0, alerts: 0, emailed: 0, skipped: 0, failed: 0, stopped: '' }
  // Old alerts go, whatever state they are in.
  await supabase.from('newpage_alerts').delete().lt('created_at', new Date(now - KEEP_DAYS * DAY).toISOString())
  // The browser helper's hourly counters (api/newpage/extension.js) are only needed for the current hour.
  await supabase.from('newpage_usage').delete().eq('kind', 'ext').lt('month', 'h:' + new Date(now - 2 * DAY).toISOString().slice(0, 13))

  const { data: rows, error } = await supabase.from('newpage_tools').select('member_id, data').eq('tool', 'apply').limit(5000)
  if (error) throw error
  const members = []
  for (const t of rows || []) {
    const { data: m } = await supabase.from('newpage_members').select('*').eq('id', t.member_id).maybeSingle()
    if (!m || m.status !== 'active' || m.source === 'demo') { out.skipped++; continue }
    const vault = await openVault(m)
    const settings = cleanApplySettings(openJson(vault, 'tool:apply', t.data))
    if (!wantsAlerts(settings)) { out.skipped++; continue }
    members.push({ m, vault, settings })
  }
  // Least recently polled first, so a budget that runs out still gets to everyone over a few runs.
  members.sort((a, b) => String(a.settings.lastPolledAt || '').localeCompare(String(b.settings.lastPolledAt || '')))

  const cache = new Map()
  let budget = MODEL_BUDGET(), failures = 0
  const search = async params => {
    const key = searchKey(params)
    if (!cache.has(key)) {
      try { cache.set(key, await searchAdzuna(params, fetchFn)); out.searched++ } catch (err) {
        failures++
        console.error('Adzuna search failed:', key, err.message)
        cache.set(key, null)
      }
    }
    return cache.get(key)
  }

  for (const { m, vault, settings } of members) {
    if (budget <= 0) { out.stopped = 'budget'; break }
    if (failures >= MAX_FAILURES) { out.stopped = 'adzuna'; break }
    try {
      const { data: resumeDoc } = await supabase.from('newpage_docs').select('content').eq('member_id', m.id).eq('kind', 'resume').order('created_at', { ascending: false }).limit(1)
      if (!resumeDoc?.length) { out.skipped++; continue } // nothing to judge fit against yet
      out.members++
      const since = new Date(now - 30 * DAY).toISOString()
      const { data: have } = await supabase.from('newpage_alerts').select('external_id, url').eq('member_id', m.id).gte('created_at', since).limit(2000)
      const seenIds = new Set((have || []).map(a => a.external_id)), seenUrls = new Set((have || []).map(a => normaliseUrl(a.url)).filter(Boolean))

      const fresh = []
      for (const role of settings.roles) for (const where of settings.locations.length ? settings.locations : ['']) {
        const listings = await search({ what: role, where, distance: settings.radiusKm, salaryMin: settings.salaryFloor, hours: settings.hours })
        if (!listings) continue
        for (const l of listings) {
          const u = normaliseUrl(l.url)
          if (seenIds.has(l.external_id) || (u && seenUrls.has(u))) continue
          seenIds.add(l.external_id); if (u) seenUrls.add(u)
          fresh.push(l)
        }
      }
      const rowsToInsert = [], toScore = []
      for (const l of fresh) {
        if (isStale(l, now)) { rowsToInsert.push(alertRow(m, l, 'dismissed', 'stale', null)); continue }
        const f = prefilter(l, settings)
        if (!f.ok) { rowsToInsert.push(alertRow(m, l, 'dismissed', 'filter', null)); continue }
        toScore.push(l)
      }
      // Newest first, a few per member per run; the rest are picked up next hour.
      toScore.sort((a, b) => String(b.posted_at).localeCompare(String(a.posted_at)))
      let ctx = null
      const good = []
      for (const l of toScore.slice(0, PER_MEMBER)) {
        if (budget <= 0) break
        if (isTools(m)) { const a = await usageAllowance(m, 'fit', now); if (!a.ok) break }
        ctx = ctx || await fitContext(m, vault, resumeDoc[0].content)
        let fit = null
        try {
          budget--
          out.scored++
          fit = cleanFit(await ask({ system: FIT_SYSTEM, prompt: fitPrompt({ listing: l, ...ctx, prefs: settings }), schema: FIT_SCHEMA, maxTokens: 500, model: process.env.NEWPAGE_FIT_MODEL || COACH_MODEL(), effort: 'low' }))
          if (isTools(m)) await usageSpend(m, 'fit', now)
        } catch (err) { console.error('Fit scoring failed:', m.id, err.message); fit = null }
        if (!fit) { rowsToInsert.push(alertRow(m, l, 'dismissed', 'fit', null)); continue } // not retried this run; the listing is noted
        const keep = fit.score >= settings.fitFloor
        rowsToInsert.push(alertRow(m, l, keep ? (settings.firstPollDone ? 'new' : 'seen') : 'dismissed', keep ? null : 'fit', fit))
        if (keep) good.push({ ...l, fit })
      }
      if (rowsToInsert.length) { await supabase.from('newpage_alerts').insert(rowsToInsert); out.alerts += good.length }

      const patch = { lastPolledAt: now.toISOString(), firstPollDone: true }
      const strong = good.filter(g => g.fit.score >= EMAIL_MIN_SCORE).sort((a, b) => b.fit.score - a.fit.score)
      const recentlyMailed = settings.lastAlertEmailAt && now - new Date(settings.lastAlertEmailAt) < EMAIL_GAP_MS
      if (settings.alertEmails && settings.firstPollDone && strong.length && !recentlyMailed) {
        const mailData = alertEmail({ name: m.name, alerts: strong.slice(0, 3) })
        await mail({ from: fromAddress(), to: m.email, reply_to: process.env.ADMIN_EMAIL, subject: mailData.subject, html: mailData.html })
        patch.lastAlertEmailAt = now.toISOString()
        out.emailed++
      }
      await saveSettings(m, vault, { ...settings, ...patch })
    } catch (err) {
      console.error('Alerts failed for', m.id, err.message)
      out.failed++
    }
  }
  return out
}

function alertRow(m, l, state, reason, fit) {
  return { member_id: m.id, external_id: l.external_id, title: l.title, company: l.company, location: l.location, salary: l.salary, url: l.url, board: l.board, posted_at: l.posted_at, snippet: l.snippet, fit, state, dismiss_reason: reason, source: 'adzuna' }
}

async function fitContext(m, vault, resumeContent) {
  const [compassRaw, aboutRaw] = await Promise.all([readTool(m, vault, 'compass', false), readTool(m, vault, 'about', true)])
  return { resume: resumeText(resumeContent), compass: compassRaw ? cleanCompass(compassRaw) : null, about: cleanAbout(aboutRaw) }
}

async function saveSettings(m, vault, settings) {
  const data = vault ? vault.json('tool:apply', settings) : settings
  await supabase.from('newpage_tools').upsert({ member_id: m.id, tool: 'apply', data, updated_at: new Date().toISOString() }, { onConflict: 'member_id,tool' })
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' })
  if (!adzunaReady()) return res.json({ ok: false, skipped: 'ADZUNA_APP_ID and ADZUNA_APP_KEY are not set' })
  try { res.json({ ok: true, ...(await runAlerts()) }) } catch (err) { console.error('Alerts cron failed:', err); res.status(500).json({ error: err.message }) }
}
