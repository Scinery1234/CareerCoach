// The public demo of AI Career Coach. Anyone with the link gets a throwaway member for
// 24 hours. It starts empty: Sky opens the conversation, gets to know the visitor, and
// saves what it learns where they can see it. No sign-in, no booking, no emails.
// Everything they type is deleted after 24 hours unless they pay to keep it, in which case
// the same member carries on (see applyCheckout in newpage-payments.js), so Sky's
// memory of them is the thing they keep. The feedback they leave is kept either way.
import { supabase } from './supabase.js'
import { signSession } from './newpage-auth.js'
import { DEMO, DEMO_OPENER, isDemo } from './newpage-demo-config.js'

export { DEMO, DEMO_OPENER, isDemo }

// Makes a fresh, empty demo member with Sky's opening question, and returns a session token for it.
export async function createDemoMember({ code = null, seal = null } = {}) {
  const id = cryptoId()
  const { data: m, error } = await supabase.from('newpage_members').insert({
    email: `${id}@${DEMO.domain}`, name: null, source: 'demo', status: 'active',
    plan_started_at: new Date().toISOString(),
    access_until: new Date(Date.now() + DEMO.hours * 3600e3).toISOString(), sessions_included: 0,
    privacy: 'private', learn: true, program_emails: false, reminders: false, demo_code: code
  }).select('id').single()
  if (error || !m) throw new Error(error?.message || 'Could not create the demo')
  const opener = seal ? seal('msg', DEMO_OPENER) : DEMO_OPENER
  await supabase.from('newpage_messages').insert({ member_id: m.id, coach: 'career', role: 'assistant', content: opener })
  return { id: m.id, session: signSession(m.id) }
}

function cryptoId() {
  return 'demo-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
}

// While someone is paying to keep their demo, it must not be swept away under them. Runs when
// they start checkout: pushes the end of the demo out to three hours from now, but never for a
// demo older than keepWindowHours, so this cannot be used to run a demo forever.
// Returns the member row, or null when this is not a live demo.
export async function keepDemoAlive(memberId, { hours = 3 } = {}) {
  const { data: m } = await supabase.from('newpage_members').select('id, source, created_at, access_until').eq('id', memberId).maybeSingle()
  if (!m || m.source !== 'demo') return null
  const now = Date.now()
  if (new Date(m.access_until).getTime() < now) return null
  if (now - new Date(m.created_at).getTime() <= DEMO.keepWindowHours * 3600e3) {
    const want = now + hours * 3600e3
    if (new Date(m.access_until).getTime() < want) await supabase.from('newpage_members').update({ access_until: new Date(want).toISOString() }).eq('id', m.id).eq('source', 'demo')
  }
  return m
}

// How much of the AI a demo visitor has used, and whether they may use more.
export async function demoAllowance(memberId, kind) {
  const col = kind === 'docs' ? 'demo_docs' : 'demo_messages'
  const { data: m } = await supabase.from('newpage_members').select('demo_messages, demo_docs').eq('id', memberId).maybeSingle()
  const used = m?.[col] || 0
  const cap = DEMO.caps[kind]
  if (used >= cap) return { ok: false, used, cap, why: kind === 'docs' ? `The demo lets you make ${cap} documents. Join AI Career Coach for unlimited.` : `The demo lets you send Sky ${cap} messages. Join AI Career Coach to keep talking.` }
  const since = new Date(Date.now() - 864e5).toISOString()
  const { data: all } = await supabase.from('newpage_members').select('demo_messages, demo_docs').eq('source', 'demo').gte('created_at', since)
  const total = (all || []).reduce((t, r) => t + (r[col] || 0), 0)
  if (total >= DEMO.dailyCap[kind]) return { ok: false, used, cap, why: 'The demo is busy today. Please try again tomorrow, or join AI Career Coach.' }
  return { ok: true, used, cap }
}

export async function demoSpend(memberId, kind) {
  const col = kind === 'docs' ? 'demo_docs' : 'demo_messages'
  const { data: m } = await supabase.from('newpage_members').select(col).eq('id', memberId).maybeSingle()
  await supabase.from('newpage_members').update({ [col]: (m?.[col] || 0) + 1 }).eq('id', memberId)
}

// Removes demo members whose 24 hours are up. Everything they made goes with
// them (the tables cascade on delete). Feedback is kept.
export async function sweepDemos() {
  const { data } = await supabase.from('newpage_members').select('id').eq('source', 'demo').lt('access_until', new Date().toISOString())
  const ids = (data || []).map(r => r.id)
  if (ids.length) await supabase.from('newpage_members').delete().in('id', ids)
  return ids.length
}
