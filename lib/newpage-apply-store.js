// Reading and writing the application log and the apply settings, shared by the
// member endpoint (api/newpage/app.js) and the browser helper's endpoint
// (api/newpage/extension.js). Sealing rules are in newpage-apply.js.
import { supabase } from './supabase.js'
import { openVault, sealText, openText, sealJson, openJson } from './newpage-vault.js'
import { cryptoReady } from './newpage-crypto.js'
import { cleanApplySettings, fitFromDoc, findDuplicate, SEALED_FIELDS, SENT } from './newpage-apply.js'

export const APP_COLS = 'id, title, company, board, url, status, applied_at, status_at, fit, source, notes, resume_doc_id, cover_doc_id, created_at'
const ID_RE = /^[0-9a-f-]{36}$/i

export const sealApplication = (vault, row) => { const out = { ...row }; for (const f of SEALED_FIELDS) if (typeof out[f] === 'string' && out[f]) out[f] = sealText(vault, 'app', out[f]); return out }
export const openApplication = (vault, row) => { const out = { ...row }; for (const f of SEALED_FIELDS) if (typeof out[f] === 'string') out[f] = openText(vault, 'app', out[f]); return out }

// A vault to write with. If there is no usable key (encryption not set up, or this
// member's key can't be opened), refuse rather than store anything unencrypted.
export async function writeVault(member) {
  const v = cryptoReady() ? await openVault(member, { create: true }) : null
  if (!v) throw Object.assign(new Error('Private storage isn’t available right now. Please try again later.'), { status: 503 })
  return v
}

export async function getApplySettings(member, vault) {
  const { data } = await supabase.from('newpage_tools').select('data').eq('member_id', member.id).eq('tool', 'apply').maybeSingle()
  return cleanApplySettings(openJson(vault === undefined ? await openVault(member) : vault, 'tool:apply', data?.data))
}
export async function patchApplySettings(member, patch) {
  const v = await writeVault(member)
  const next = cleanApplySettings({ ...(await getApplySettings(member, v)), ...patch })
  await supabase.from('newpage_tools').upsert({ member_id: member.id, tool: 'apply', data: sealJson(v, 'tool:apply', next), updated_at: new Date().toISOString() }, { onConflict: 'member_id,tool' })
  return next
}

export async function listApplications(member, vault) {
  const { data } = await supabase.from('newpage_applications').select(APP_COLS).eq('member_id', member.id).order('created_at', { ascending: false }).limit(500)
  return (data || []).map(a => openApplication(vault, a))
}

// Log one application. `row` is a cleanApplication() result. Documents must be the
// member's own; a tailored resume brings its match table along as the fit. The same ad,
// or the same role at the same organisation within a week, is not logged twice.
// Returns { application, duplicate } or throws { status, message }.
export async function addApplication(member, vault, row, { resume_doc_id, cover_doc_id, alert_id } = {}) {
  const wanted = Object.entries({ resume_doc_id, cover_doc_id }).filter(([, v]) => ID_RE.test(String(v || '')))
  if (wanted.length) {
    const { data: docs } = await supabase.from('newpage_docs').select('id, kind, content').eq('member_id', member.id).in('id', wanted.map(([, v]) => v))
    for (const [k, v] of wanted) {
      const d = (docs || []).find(x => x.id === v)
      if (!d) throw Object.assign(new Error('That document isn’t in your account.'), { status: 404 })
      row[k] = d.id
      if (k === 'resume_doc_id') row.fit = fitFromDoc(d.content)
    }
  }
  const existing = await listApplications(member, vault)
  const dup = findDuplicate(existing, row)
  if (dup) {
    // A job they saved and have now applied for: the saved entry becomes the application.
    if (dup.status === 'saved' && SENT.has(row.status)) {
      const patch = { status: row.status, applied_at: row.applied_at, status_at: new Date().toISOString() }
      for (const k of ['resume_doc_id', 'cover_doc_id', 'fit']) if (row[k] !== undefined) patch[k] = row[k]
      if (row.url && !dup.url) patch.url = row.url
      await supabase.from('newpage_applications').update(sealApplication(vault, patch)).eq('id', dup.id).eq('member_id', member.id)
      if (ID_RE.test(String(alert_id || ''))) await supabase.from('newpage_alerts').update({ state: 'applied' }).eq('id', alert_id).eq('member_id', member.id)
      return { application: { ...dup, ...patch }, duplicate: false, updated: true }
    }
    return { application: dup, duplicate: true }
  }
  const { data: saved, error } = await supabase.from('newpage_applications').insert({ member_id: member.id, ...sealApplication(vault, row), status_at: new Date().toISOString() }).select(APP_COLS).single()
  if (error || !saved) throw Object.assign(new Error('That didn’t save. Please try again.'), { status: 500 })
  if (ID_RE.test(String(alert_id || ''))) await supabase.from('newpage_alerts').update({ state: 'applied' }).eq('id', alert_id).eq('member_id', member.id)
  return { application: openApplication(vault, saved), duplicate: false }
}

// The member's documents the helper can carry into a form: resumes (with content, so the
// Word file can be built) and cover letters.
export async function listDocsForHelper(member) {
  const { data } = await supabase.from('newpage_docs').select('id, kind, title, content, created_at').eq('member_id', member.id).in('kind', ['resume', 'cover']).order('created_at', { ascending: false }).limit(40)
  return (data || []).map(d => ({
    id: d.id, kind: d.kind, title: d.title, created_at: d.created_at,
    tailored: d.content?.tailored ? { role: d.content.tailored.role || '', company: d.content.tailored.company || '', base_id: d.content.tailored.base_id || '' } : null,
    built: d.kind === 'resume' ? !!d.content?.resume?.candidate?.full_name : !!d.content?.paragraphs?.length,
    content: d.content
  }))
}
