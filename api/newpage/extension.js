import { createHash, randomBytes } from 'node:crypto'
import { supabase } from '../../lib/supabase.js'
import { signExt, readToken } from '../../lib/newpage-auth.js'
import { openVault } from '../../lib/newpage-vault.js'
import { writeVault, getApplySettings, listApplications, addApplication, listDocsForHelper } from '../../lib/newpage-apply-store.js'
import { cleanApplication, normaliseUrl, boardFromUrl, wantsAlerts } from '../../lib/newpage-apply.js'
import { matchStandard, matchCustom, ANSWERS_SYSTEM, ANSWERS_SCHEMA, answersPrompt, cleanAnswers } from '../../lib/newpage-answers.js'
import { prefilter, FIT_SYSTEM, FIT_SCHEMA, fitPrompt, cleanFit, fitWords } from '../../lib/newpage-fit.js'
import { askJson, aiMessage, COACH_MODEL, WRITER_MODEL } from '../../lib/newpage-coach.js'
import { resumeText, resumeContact } from '../../lib/newpage-resume.js'
import { cleanCompass } from '../../lib/newpage-tools.js'
import { cleanAbout } from '../../lib/newpage-context.js'
import { isTools, usageAllowance, usageSpend } from '../../lib/newpage-usage.js'
import { STANDARD_ANSWERS } from '../../lib/newpage-apply.js'

// The browser helper's endpoint. POST { action, ... } with a short-lived access token,
// minted here from a pairing token the member created in the app. The helper can read
// the member's documents and standard answers, ask for a fit verdict or drafted
// answers, log an application and hand over listings it saw on the member's screen.
// It cannot read chats, memory or notes, and it cannot change settings.
//
// Rate limit: counted in the database per member per hour (newpage_usage, kind 'ext'),
// because the in-memory limiter is per instance and the helper runs in a loop of pages.
const HOURLY = 120
const hourKey = (now = new Date()) => now.toISOString().slice(0, 13)
const sha = s => createHash('sha256').update(String(s)).digest('hex')
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const ID_RE = /^[0-9a-f-]{36}$/i

async function hourlyAllowance(member, now = new Date()) {
  const month = 'h:' + hourKey(now)
  const { data } = await supabase.from('newpage_usage').select('count').eq('member_id', member.id).eq('month', month).eq('kind', 'ext').maybeSingle()
  const count = (data?.count || 0) + 1
  await supabase.from('newpage_usage').upsert({ member_id: member.id, month, kind: 'ext', count }, { onConflict: 'member_id,month,kind' })
  return count <= HOURLY
}

// Pairing token -> access token, and a fresh pairing token (the old one is revoked).
async function refresh(b, res) {
  const token = clip(b.refresh, 200)
  if (!token) return res.status(400).json({ error: 'No pairing token.' })
  const { data: row } = await supabase.from('newpage_extension_tokens').select('id, member_id, revoked_at').eq('token_hash', sha(token)).maybeSingle()
  if (!row || row.revoked_at) return res.status(401).json({ error: 'This browser is no longer connected. Connect it again from the app.', code: 'unpaired' })
  const { data: member } = await supabase.from('newpage_members').select('id, status, access_until').eq('id', row.member_id).maybeSingle()
  if (!member || member.status !== 'active' || (member.access_until && new Date(member.access_until) < new Date())) return res.status(403).json({ error: 'Your membership isn’t active.', code: 'inactive' })
  const next = randomBytes(32).toString('base64url')
  const now = new Date().toISOString()
  await supabase.from('newpage_extension_tokens').update({ revoked_at: now }).eq('id', row.id)
  await supabase.from('newpage_extension_tokens').insert({ member_id: row.member_id, token_hash: sha(next), device: clip(b.device, 80) || 'Browser', last_used_at: now })
  return res.json({ access: signExt(row.member_id), refresh: next, expires_in: 15 * 60 })
}

async function fitContext(member, vault) {
  const [{ data: resumeDoc }, { data: compassRaw }, { data: aboutRaw }] = await Promise.all([
    supabase.from('newpage_docs').select('content').eq('member_id', member.id).eq('kind', 'resume').order('created_at', { ascending: false }).limit(1),
    supabase.from('newpage_tools').select('data').eq('member_id', member.id).eq('tool', 'compass').maybeSingle(),
    supabase.from('newpage_tools').select('data').eq('member_id', member.id).eq('tool', 'about').maybeSingle()
  ])
  const { openJson } = await import('../../lib/newpage-vault.js')
  const content = resumeDoc?.[0]?.content || null
  return { content, resume: content ? resumeText(content) : '', compass: compassRaw?.data ? cleanCompass(compassRaw.data) : null, about: cleanAbout(openJson(vault, 'tool:about', aboutRaw?.data)) }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()
  const b = req.body || {}
  if (b.action === 'ext_refresh') return refresh(b, res)

  const claims = readToken(clip(b.access, 2000), 'ext')
  if (!claims) return res.status(401).json({ error: 'Please reconnect the helper.', code: 'expired' })
  const { data: member } = await supabase.from('newpage_members').select('*').eq('id', claims.sub).maybeSingle()
  if (!member || member.status !== 'active') return res.status(403).json({ error: 'Your membership isn’t active.', code: 'inactive' })
  if (!(await hourlyAllowance(member))) return res.status(429).json({ error: 'The helper has been busy. Try again in a little while.', code: 'ext_limit' })
  const vault = await openVault(member)

  switch (b.action) {
    case 'ext_profile': {
      const settings = await getApplySettings(member, vault)
      const { data: resumeDoc } = await supabase.from('newpage_docs').select('content').eq('member_id', member.id).eq('kind', 'resume').order('created_at', { ascending: false }).limit(1)
      return res.json({ name: member.name || '', contact: resumeDoc?.[0] ? resumeContact(resumeDoc[0].content) : null, answers: settings.answers, roles: settings.roles, capture: settings.capture, standard: STANDARD_ANSWERS.map(q => ({ id: q.id, label: q.label })) })
    }
    case 'ext_docs':
      return res.json({ docs: (await listDocsForHelper(member)).filter(d => d.built) })
    case 'ext_applications':
      return res.json({ applications: (await listApplications(member, vault)).slice(0, 50).map(a => ({ id: a.id, title: a.title, company: a.company, url: a.url, status: a.status, applied_at: a.applied_at })) })

    case 'ext_fit': {
      const listing = { title: clip(b.title, 200), company: clip(b.company, 200), location: clip(b.location, 200), salary: clip(b.salary, 120), snippet: clip(b.text, 6000), posted_at: null, contract_time: '', contract_type: '', url: clip(b.url, 1000) }
      if (!listing.title) return res.status(400).json({ error: 'No job title on this page.' })
      if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Fit checks aren’t switched on yet.', code: 'coach_off' })
      if (isTools(member)) { const a = await usageAllowance(member, 'fit'); if (!a.ok) return res.status(429).json({ error: a.why, code: 'usage_cap' }) }
      const ctx = await fitContext(member, vault)
      if (!ctx.content) return res.status(400).json({ error: 'Make a resume in the app first, so there is something to judge fit against.', code: 'no_resume' })
      const settings = await getApplySettings(member, vault)
      try {
        const fit = cleanFit(await askJson({ system: FIT_SYSTEM, prompt: fitPrompt({ listing, resume: ctx.resume, compass: ctx.compass, about: ctx.about, prefs: settings }), schema: FIT_SCHEMA, maxTokens: 500, model: process.env.NEWPAGE_FIT_MODEL || COACH_MODEL(), effort: 'low' }))
        if (isTools(member)) await usageSpend(member, 'fit')
        return res.json({ fit, words: fitWords(fit).replace(', from the summary', b.text && b.text.length > 600 ? '' : ', from the summary') })
      } catch (err) { console.error('ext_fit failed:', err); return res.status(502).json({ error: aiMessage(err) }) }
    }

    case 'ext_answers': {
      // Standard answers first, matched by what the question says; the rest drafted, then checked against the record.
      const questions = (Array.isArray(b.questions) ? b.questions : []).map(q => (typeof q === 'string' ? { label: q } : q || {})).map(q => ({ label: clip(q.label, 400), options: (Array.isArray(q.options) ? q.options : []).map(o => clip(String(o), 120)).filter(Boolean).slice(0, 30) })).filter(q => q.label).slice(0, 20)
      if (!questions.length) return res.status(400).json({ error: 'No questions found on this page.' })
      const settings = await getApplySettings(member, vault)
      const out = questions.map(q => ({ question: q.label, ...(matchStandard(q.label, settings.answers, { options: q.options }) || matchCustom(q.label, settings.answers.custom) || { answer: '', source: 'ask' }) }))
      const todo = out.filter(o => o.source === 'ask' && !o.question.match(/^(first|last|full) name|email|phone|mobile|postcode|suburb|address/i))
      if (todo.length && b.draft !== false) {
        if (!process.env.ANTHROPIC_API_KEY) return res.json({ answers: out, drafted: false })
        if (isTools(member)) { const a = await usageAllowance(member, 'answers'); if (!a.ok) return res.json({ answers: out, drafted: false, why: a.why }) }
        const ctx = await fitContext(member, vault)
        const facts = settings.answers
        const sources = [ctx.resume, ...STANDARD_ANSWERS.map(q => facts[q.id] || ''), ...(facts.custom || []).map(c => c.a)].join('\n')
        try {
          const drafted = cleanAnswers(await askJson({ system: ANSWERS_SYSTEM, prompt: answersPrompt({ questions: todo.map(t => t.question), job: clip(b.text, 8000), title: clip(b.title, 200), company: clip(b.company, 200), resume: ctx.resume, facts }), schema: ANSWERS_SCHEMA, maxTokens: 2500, model: WRITER_MODEL(), effort: 'medium' }), todo.map(t => t.question), sources)
          if (isTools(member)) await usageSpend(member, 'answers')
          for (const d of drafted) { const o = out.find(x => x.question === d.question && x.source === 'ask'); if (o) Object.assign(o, d) }
        } catch (err) { console.error('ext_answers failed:', err); return res.json({ answers: out, drafted: false, why: aiMessage(err) }) }
      }
      return res.json({ answers: out, drafted: true })
    }

    case 'ext_log': {
      const row = cleanApplication({ ...b, source: 'extension' })
      if (!row) return res.status(400).json({ error: 'No role title.' })
      let wv
      try { wv = await writeVault(member) } catch (err) { return res.status(err.status || 500).json({ error: err.message }) }
      try { return res.json(await addApplication(member, wv, row, { resume_doc_id: b.resume_doc_id, cover_doc_id: b.cover_doc_id })) } catch (err) { return res.status(err.status || 500).json({ error: err.message }) }
    }

    case 'ext_capture': {
      // Listings the member saw on their own screen. Only with the setting on, only the
      // ones that look like their roles, scored a few at a time; the rest are not stored.
      const settings = await getApplySettings(member, vault)
      if (!settings.capture || !wantsAlerts(settings)) return res.json({ stored: 0, reason: settings.capture ? 'no_roles' : 'off' })
      const items = (Array.isArray(b.listings) ? b.listings : []).slice(0, 40).map(l => ({ title: clip(l?.title, 200), company: clip(l?.company, 200), location: clip(l?.location, 200), salary: clip(l?.salary, 120), url: clip(l?.url, 1000), snippet: clip(l?.snippet, 600), posted_at: typeof l?.posted_at === 'string' && !Number.isNaN(new Date(l.posted_at).getTime()) ? new Date(l.posted_at).toISOString() : null, contract_time: '', contract_type: '' })).filter(l => l.title && normaliseUrl(l.url))
      if (!items.length) return res.json({ stored: 0 })
      const { data: have } = await supabase.from('newpage_alerts').select('external_id, url').eq('member_id', member.id).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()).limit(2000)
      const seen = new Set((have || []).flatMap(a => [a.external_id, normaliseUrl(a.url)]).filter(Boolean))
      const fresh = items.filter(l => { const u = normaliseUrl(l.url); if (seen.has(u) || seen.has('cap:' + sha(u).slice(0, 24))) return false; seen.add(u); return prefilter(l, settings).ok })
      if (!fresh.length) return res.json({ stored: 0 })
      let ctx = null, scored = 0
      const rows = []
      for (const l of fresh.slice(0, 5)) {
        if (!process.env.ANTHROPIC_API_KEY) break
        if (isTools(member)) { const a = await usageAllowance(member, 'fit'); if (!a.ok) break }
        ctx = ctx || await fitContext(member, vault)
        if (!ctx.content) break
        try {
          const fit = cleanFit(await askJson({ system: FIT_SYSTEM, prompt: fitPrompt({ listing: l, resume: ctx.resume, compass: ctx.compass, about: ctx.about, prefs: settings }), schema: FIT_SCHEMA, maxTokens: 500, model: process.env.NEWPAGE_FIT_MODEL || COACH_MODEL(), effort: 'low' }))
          if (isTools(member)) await usageSpend(member, 'fit')
          scored++
          const keep = fit.score >= settings.fitFloor
          rows.push({ member_id: member.id, external_id: 'cap:' + sha(normaliseUrl(l.url)).slice(0, 24), title: l.title, company: l.company, location: l.location, salary: l.salary, url: l.url, board: boardFromUrl(l.url), posted_at: l.posted_at, snippet: l.snippet, fit, state: keep ? 'new' : 'dismissed', dismiss_reason: keep ? null : 'fit', source: 'capture' })
        } catch (err) { console.error('capture fit failed:', err.message) }
      }
      if (rows.length) await supabase.from('newpage_alerts').insert(rows)
      return res.json({ stored: rows.filter(r => r.state === 'new').length, scored })
    }

    default:
      return res.status(400).json({ error: 'Unknown action.' })
  }
}
