// Applications: the log of what went out and what came back.
//   appliedCard   "Did you apply?" at the end of the tailor and cover letter flows.
//   pipelineCard  The week at a glance, on Today.
//   applyScreen   The Applications tool: the list, status changes, a manual add, the weekly target.
// Everything is saved through apply_* actions in api/newpage/app.js; nothing here invents data.
import { h, todayStr } from './ui.js'

const BOARDS = [['seek', 'Seek'], ['indeed', 'Indeed'], ['linkedin', 'LinkedIn'], ['jora', 'Jora'], ['employer', 'Employer’s site'], ['other', 'Somewhere else']]
const STATUS = { saved: 'Saved', applied: 'Applied', viewed: 'Viewed', screening: 'Screening call', interview: 'Interview', offer: 'Offer', rejected: 'Rejected', withdrawn: 'Withdrawn', no_reply: 'No reply' }
const NEXT = { applied: ['viewed', 'screening', 'interview', 'rejected', 'no_reply'], viewed: ['screening', 'interview', 'rejected', 'no_reply'], screening: ['interview', 'rejected'], interview: ['offer', 'rejected'], offer: ['withdrawn'], saved: ['applied', 'withdrawn'], rejected: [], withdrawn: ['applied'], no_reply: ['viewed', 'interview'] }
const OPEN = new Set(['applied', 'viewed', 'screening', 'interview'])
const fmt = d => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '')
const boardName = b => (BOARDS.find(([k]) => k === b) || [])[1] || 'Somewhere else'

const L = { list: null, loading: false, err: '', note: '', adding: false, add: {}, target: '', editing: null, notes: {} }

async function refresh(ctx) {
  if (L.loading) return
  L.loading = true; L.err = ''
  try { const d = await ctx.call('/api/newpage/app', { action: 'apply_list' }); L.list = d.applications; L.target = d.settings.weeklyTarget || '' } catch (e) { L.err = e.message; L.list = L.list || [] }
  L.loading = false; ctx.render()
}

// After any apply_* action the server returns the whole `me` payload: keep the app's copy fresh.
function absorb(ctx, d) { if (d && d.pipeline !== undefined) { ctx.S.me.pipeline = d.pipeline; ctx.S.me.applySettings = d.applySettings; ctx.S.me.apply = d.apply } }

async function setStatus(ctx, app, status) {
  try { const d = await ctx.call('/api/newpage/app', { action: 'apply_update', id: app.id, status }); absorb(ctx, d); app.status = status; L.note = `${app.title}: ${STATUS[status]}.` } catch (e) { L.err = e.message }
  ctx.render()
}

// ── "Did you apply?" ──
// `job` is { title, company, url, job, resume_doc_id, cover_doc_id }. `state` is the caller's
// own object so the card remembers its answer while the parent re-renders.
export function appliedCard(ctx, job, state) {
  if (state.logged) {
    return h('div', { class: 'card ap-card ap-done' }, h('span', { class: 'label' }, 'Logged'),
      h('p', { class: 'small' }, state.duplicate ? 'You’d already logged this one. ' : 'It’s in your applications now. ', 'Update it when you hear back, and Sky can see it if you want to talk it through.'),
      h('button', { class: 'link-btn blue', type: 'button', onclick: () => ctx.go('tools', 'apply') }, 'See your applications'))
  }
  if (state.skipped) return null
  const board = state.board || (job.url ? '' : 'seek')
  const send = async status => {
    if (state.busy) return
    state.busy = true; state.err = ''; ctx.render()
    try {
      const d = await ctx.call('/api/newpage/app', { action: 'apply_add', title: state.title ?? job.title, company: state.company ?? job.company, url: state.url ?? job.url, board: state.board || undefined, job: job.job, resume_doc_id: job.resume_doc_id, cover_doc_id: job.cover_doc_id, alert_id: job.alert_id, status })
      absorb(ctx, d); state.logged = true; state.duplicate = d.duplicate
    } catch (e) { state.err = e.message }
    state.busy = false; ctx.render()
  }
  return h('div', { class: 'card ap-card' },
    h('span', { class: 'label' }, 'Did you apply?'),
    h('p', { class: 'small muted' }, 'Keep track of what went out, so you can see what comes back. Logged applications show up for Sky, so you can talk them through.'),
    h('div', { class: 'ap-fields' },
      h('label', { class: 'field' }, h('span', {}, 'Role'), h('input', { value: state.title ?? job.title ?? '', oninput: e => { state.title = e.target.value } })),
      h('label', { class: 'field' }, h('span', {}, 'Organisation'), h('input', { value: state.company ?? job.company ?? '', oninput: e => { state.company = e.target.value } })),
      h('label', { class: 'field' }, h('span', {}, 'Where'), h('select', { onchange: e => { state.board = e.target.value } }, BOARDS.map(([k, n]) => h('option', { value: k, ...(k === board ? { selected: '' } : {}) }, n)))),
      h('label', { class: 'field' }, h('span', {}, 'Link to the ad (optional)'), h('input', { type: 'url', placeholder: 'https://', value: state.url ?? job.url ?? '', oninput: e => { state.url = e.target.value } }))),
    state.err && h('p', { class: 'error', role: 'alert' }, state.err),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', type: 'button', disabled: state.busy, onclick: () => send('applied') }, state.busy ? 'Saving…' : 'I applied'),
      h('button', { class: 'btn btn-secondary', type: 'button', disabled: state.busy, onclick: () => send('saved') }, 'Not yet, save it'),
      h('button', { class: 'link-btn', type: 'button', onclick: () => { state.skipped = true; ctx.render() } }, 'Skip')))
}

// ── Early alerts, on Today ──
const DISMISS = [['pay', 'Pay'], ['location', 'Location'], ['hours', 'Hours'], ['level', 'Level'], ['not_for_me', 'Not for me']]
const agoText = iso => { if (!iso) return ''; const m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000)); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : m < 2880 ? 'yesterday' : `${Math.round(m / 1440)} days ago` }

// Hands an alert's ad details to the Resume writer's tailor step. The ad text itself is
// not ours to copy (Adzuna gives a snippet), so the member pastes it from the open tab.
export function tailorFrom(ctx, a) {
  try { sessionStorage.setItem('np-tailor-handoff', JSON.stringify({ role: a.title, company: a.company, url: a.url, alert_id: a.id })) } catch { /* private mode */ }
  ctx.call('/api/newpage/app', { action: 'alert_state', id: a.id, state: 'opened' }).then(d => absorb(ctx, d)).catch(() => {})
  window.open(a.url, '_blank', 'noopener')
  ctx.go('tools', 'resume')
}

export function alertsCard(ctx) {
  const me = ctx.S.me, al = me.alerts
  if (!al || !al.open) return null
  const dismiss = async (a, reason) => { try { const d = await ctx.call('/api/newpage/app', { action: 'alert_state', id: a.id, state: 'dismissed', reason }); absorb(ctx, d) } catch (e) { L.err = e.message } ctx.render() }
  const open = a => { ctx.call('/api/newpage/app', { action: 'alert_state', id: a.id, state: 'opened' }).then(d => absorb(ctx, d)).catch(() => {}); window.open(a.url, '_blank', 'noopener') }
  if (al.count) ctx.beacon('/api/newpage/app', { action: 'alerts_seen' })
  return h('div', { class: 'card ap-alerts' },
    h('div', { class: 'row review-head' }, h('span', { class: 'label' }, al.count ? `${al.count} new job${al.count === 1 ? '' : 's'} that look like a fit` : 'Jobs that looked like a fit'), h('span', { class: 'small muted' }, 'from the summary; the ad decides')),
    h('ul', { class: 'ap-list' }, al.top.map(a => h('li', { class: 'ap-row ap-alert' + (a.state === 'new' ? ' ap-new' : '') },
      h('div', { class: 'ap-main' },
        h('div', {}, h('b', {}, a.title), a.company && h('span', { class: 'muted' }, ` · ${a.company}`)),
        h('div', { class: 'small muted' }, [a.location, a.salary, a.posted_at && `posted ${agoText(a.posted_at)}`].filter(Boolean).join(' · ')),
        a.fit?.verdict && h('p', { class: 'small ap-verdict' }, h('b', {}, a.words + '. '), a.fit.verdict),
        h('div', { class: 'ap-status' },
          h('button', { class: 'btn btn-primary small', type: 'button', onclick: () => tailorFrom(ctx, a) }, 'Tailor my resume'),
          h('button', { class: 'link-btn blue small', type: 'button', onclick: () => open(a) }, 'Open the ad'),
          h('select', { class: 'ap-dismiss', 'aria-label': 'Dismiss', onchange: e => { if (e.target.value) dismiss(a, e.target.value) } }, h('option', { value: '' }, 'Not this one…'), DISMISS.map(([k, n]) => h('option', { value: k }, n)))))))),
    h('button', { class: 'link-btn blue', type: 'button', onclick: () => ctx.go('tools', 'apply') }, 'Change what to look for'))
}

// ── Today ──
export function pipelineCard(me, go) {
  const p = me.pipeline
  if (!p || (!p.total && !p.byStatus?.saved)) return null
  const bits = []
  if (p.interviews) bits.push(`${p.interviews} at interview stage`)
  if (p.waiting) bits.push(`${p.waiting} waiting 10+ days`)
  else if (p.open) bits.push(`${p.open} waiting to hear`)
  if (p.byStatus?.saved) bits.push(`${p.byStatus.saved} saved to apply for`)
  return h('div', { class: 'card ap-pipe' },
    h('div', { class: 'row review-head' }, h('span', { class: 'label' }, 'Applications'), h('span', { class: 'small muted' }, `${fmt(p.week.start)} to ${fmt(p.week.end)}`)),
    h('p', { class: 'ap-big' }, p.target ? `${p.thisWeek} of ${p.target} this week` : `${p.thisWeek} this week`, h('span', { class: 'small muted' }, ` · ${p.lastWeek} last week`)),
    bits.length > 0 && h('p', { class: 'small' }, bits.join(' · ')),
    h('button', { class: 'link-btn blue', type: 'button', onclick: () => go('tools', 'apply') }, 'See all applications'))
}

// ── Sky's offer, on Today ──
// Shown once when they reach the applying stage and Sky has not offered yet. "Not now"
// is remembered on the server, so it stays away on every device; Sky may raise it again
// later if something changes.
export function offerCard(ctx) {
  const me = ctx.S.me, a = me.apply
  if (!a || a.decision !== 'offer' || a.offer) return null
  const answer = async ans => { try { const d = await ctx.call('/api/newpage/app', { action: 'apply_offer_set', answer: ans }); absorbAll(ctx, d) } catch (e) { L.err = e.message } ctx.render() }
  return h('div', { class: 'card ap-offer' },
    h('span', { class: 'label' }, 'Sky can help with applying'),
    h('p', { class: 'small' }, 'Track what you send, see what comes back, and talk through what gets in the way. Only if you want it.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { await answer('yes'); ctx.askCoach('applying', 'I’d like help with the applying side. ') } }, 'Talk to Sky'),
      h('button', { class: 'link-btn', type: 'button', onclick: () => answer('later') }, 'Not now')))
}
function absorbAll(ctx, d) { if (d && d.me !== undefined) return; if (d && d.pipeline !== undefined) { ctx.S.me.pipeline = d.pipeline; ctx.S.me.applySettings = d.applySettings; ctx.S.me.apply = d.apply } }

// ── The tool ──
function row(ctx, a) {
  const open = L.editing === a.id
  const next = NEXT[a.status] || []
  return h('li', { class: 'ap-row' + (OPEN.has(a.status) ? '' : ' ap-closed') },
    h('div', { class: 'ap-main' },
      h('div', {}, h('b', {}, a.title), a.company && h('span', { class: 'muted' }, ` · ${a.company}`)),
      h('div', { class: 'small muted' }, [boardName(a.board), a.applied_at && `applied ${fmt(a.applied_at)}`, a.fit && `${a.fit.strong} of ${a.fit.total} requirements clearly met`].filter(Boolean).join(' · ')),
      h('div', { class: 'ap-status' }, h('span', { class: 'st s-' + a.status }, STATUS[a.status] || a.status),
        next.map(s => h('button', { class: 'link-btn blue small', type: 'button', onclick: () => setStatus(ctx, a, s) }, STATUS[s])),
        h('button', { class: 'link-btn small', type: 'button', onclick: () => { L.editing = open ? null : a.id; ctx.render() } }, open ? 'Close' : 'More'))),
    open && h('div', { class: 'ap-more' },
      a.url && h('a', { href: a.url, target: '_blank', rel: 'noopener' }, 'Open the ad'),
      h('label', { class: 'field' }, h('span', {}, 'Notes'), h('textarea', { rows: 2, value: L.notes[a.id] ?? a.notes ?? '', oninput: e => { L.notes[a.id] = e.target.value } })),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: async () => { try { const d = await ctx.call('/api/newpage/app', { action: 'apply_update', id: a.id, notes: L.notes[a.id] ?? a.notes ?? '' }); absorb(ctx, d); a.notes = L.notes[a.id] ?? a.notes; L.note = 'Saved.' } catch (e) { L.err = e.message } ctx.render() } }, 'Save notes'),
        h('select', { 'aria-label': 'Set status', onchange: e => setStatus(ctx, a, e.target.value) }, h('option', { value: '' }, 'Set status…'), Object.entries(STATUS).map(([k, n]) => h('option', { value: k }, n))),
        h('button', { class: 'link-btn danger small', type: 'button', onclick: async () => { if (!confirm('Remove this application from your list?')) return; try { const d = await ctx.call('/api/newpage/app', { action: 'apply_delete', id: a.id }); absorb(ctx, d); L.list = L.list.filter(x => x.id !== a.id); L.editing = null } catch (e) { L.err = e.message } ctx.render() } }, 'Remove'))))
}

function addForm(ctx) {
  const a = L.add
  if (!L.adding) return h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { L.adding = true; L.add = { status: 'applied', applied_at: todayStr() }; ctx.render() } }, 'Add one I applied for elsewhere')
  const save = async () => {
    try {
      const d = await ctx.call('/api/newpage/app', { action: 'apply_add', title: a.title, company: a.company, url: a.url, board: a.board || undefined, status: a.status, applied_at: a.applied_at })
      absorb(ctx, d); L.adding = false; L.note = d.duplicate ? 'That one was already in your list.' : 'Added.'
      if (!d.duplicate) L.list = [d.application, ...(L.list || [])]
    } catch (e) { L.err = e.message }
    ctx.render()
  }
  return h('form', { class: 'card doc-form', onsubmit: e => { e.preventDefault(); save() } },
    h('span', { class: 'label' }, 'Add an application'),
    h('div', { class: 'ap-fields' },
      h('label', { class: 'field' }, h('span', {}, 'Role'), h('input', { required: true, value: a.title || '', oninput: e => { a.title = e.target.value } })),
      h('label', { class: 'field' }, h('span', {}, 'Organisation'), h('input', { value: a.company || '', oninput: e => { a.company = e.target.value } })),
      h('label', { class: 'field' }, h('span', {}, 'Where'), h('select', { onchange: e => { a.board = e.target.value } }, h('option', { value: '' }, 'Choose…'), BOARDS.map(([k, n]) => h('option', { value: k }, n)))),
      h('label', { class: 'field' }, h('span', {}, 'Link to the ad (optional)'), h('input', { type: 'url', placeholder: 'https://', value: a.url || '', oninput: e => { a.url = e.target.value } })),
      h('label', { class: 'field' }, h('span', {}, 'Status'), h('select', { onchange: e => { a.status = e.target.value } }, Object.entries(STATUS).map(([k, n]) => h('option', { value: k, ...(k === a.status ? { selected: '' } : {}) }, n)))),
      h('label', { class: 'field' }, h('span', {}, 'Date applied'), h('input', { type: 'date', max: todayStr(), value: a.applied_at || '', oninput: e => { a.applied_at = e.target.value } }))),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Add'), h('button', { class: 'link-btn', type: 'button', onclick: () => { L.adding = false; ctx.render() } }, 'Cancel')))
}

function skyCard(ctx) {
  const a = ctx.S.me.apply, s = ctx.S.me.applySettings || {}
  const set = async body => { try { const d = await ctx.call('/api/newpage/app', body); absorb(ctx, d); L.note = 'Saved.' } catch (e) { L.err = e.message } ctx.render() }
  const o = a?.offer
  const said = o ? (o.answer === 'yes' ? `You said yes on ${fmt(o.at)}.` : o.answer === 'no' ? `You said no on ${fmt(o.at)}${(o.count || 1) >= 2 ? ', twice, so Sky has stopped offering' : ''}.` : `You said not now on ${fmt(o.at)}.`) : 'Sky hasn’t offered yet.'
  return h('div', { class: 'card' }, h('span', { class: 'label' }, 'Sky and your applications'),
    h('p', { class: 'small muted' }, 'Sky can see this list and may offer to help with the applying side: what gets in the way, keeping going after a rejection, a rhythm if you want one. ', said),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => ctx.askCoach('applying', 'I’d like to talk about my applications. ') }, 'Talk to Sky about applying'),
      o && o.answer !== 'yes' && h('button', { class: 'link-btn blue', type: 'button', onclick: () => set({ action: 'apply_offer_set', answer: 'reset' }) }, 'Let Sky offer again'),
      (!o || o.answer !== 'no') && h('button', { class: 'link-btn', type: 'button', onclick: () => set({ action: 'apply_offer_set', answer: 'no' }) }, 'Don’t offer')),
    h('label', { class: 'row ap-switch' }, h('input', { type: 'checkbox', ...(s.emails ? { checked: '' } : {}), onchange: e => set({ action: 'apply_settings_set', emails: e.target.checked }) }), h('span', { class: 'small' }, 'A short note from Sky on Sunday evenings about the week’s applications. Off unless you turn it on.')))
}

function searchCard(ctx) {
  const s = ctx.S.me.applySettings || {}
  const f = (L.search ||= { roles: (s.roles || []).join(', '), locations: (s.locations || []).join(', '), radiusKm: s.radiusKm || 25, salaryFloor: s.salaryFloor || '', hours: s.hours || 'any', fitFloor: s.fitFloor ?? 60 })
  const save = async () => {
    try { const d = await ctx.call('/api/newpage/app', { action: 'apply_settings_set', roles: f.roles, locations: f.locations, radiusKm: Number(f.radiusKm), salaryFloor: f.salaryFloor === '' ? 0 : Number(f.salaryFloor), hours: f.hours, fitFloor: Number(f.fitFloor) }); absorb(ctx, d); L.note = d.applySettings.roles.length ? 'Saved. New listings are checked every hour; the first ones show on Today.' : 'Saved. Add a role to start getting new listings.' } catch (e) { L.err = e.message }
    ctx.render()
  }
  const emails = async on => { try { const d = await ctx.call('/api/newpage/app', { action: 'apply_settings_set', alertEmails: on }); absorb(ctx, d) } catch (e) { L.err = e.message } ctx.render() }
  return h('form', { class: 'card doc-form', onsubmit: e => { e.preventDefault(); save() } },
    h('span', { class: 'label' }, 'New jobs, early'),
    h('p', { class: 'small muted' }, 'Tell us what you’re looking for and new listings are checked every hour against your resume and what you’ve said matters. The good ones show on Today, within the hour they appear, so you can be one of the first to apply.'),
    h('div', { class: 'ap-fields' },
      h('label', { class: 'field' }, h('span', {}, 'Roles (up to 5, comma separated)'), h('input', { value: f.roles, placeholder: 'e.g. Aged care worker, Disability support worker', oninput: e => { f.roles = e.target.value } })),
      h('label', { class: 'field' }, h('span', {}, 'Where (up to 3)'), h('input', { value: f.locations, placeholder: 'e.g. Geelong, Werribee', oninput: e => { f.locations = e.target.value } })),
      h('label', { class: 'field' }, h('span', {}, 'Within (km)'), h('input', { type: 'number', min: 5, max: 200, value: f.radiusKm, oninput: e => { f.radiusKm = e.target.value } })),
      h('label', { class: 'field' }, h('span', {}, 'Pay at least ($ a year, optional)'), h('input', { type: 'number', min: 0, step: 1000, value: f.salaryFloor, oninput: e => { f.salaryFloor = e.target.value } })),
      h('label', { class: 'field' }, h('span', {}, 'Hours'), h('select', { onchange: e => { f.hours = e.target.value } }, [['any', 'Any'], ['full_time', 'Full time'], ['part_time', 'Part time'], ['casual', 'Casual']].map(([k, n]) => h('option', { value: k, ...(k === f.hours ? { selected: '' } : {}) }, n)))),
      h('label', { class: 'field' }, h('span', {}, 'Only show fits above'), h('select', { onchange: e => { f.fitFloor = e.target.value } }, [[40, 'Show me more'], [60, 'A fair fit (default)'], [75, 'Only strong fits']].map(([k, n]) => h('option', { value: k, ...(Number(k) === Number(f.fitFloor) ? { selected: '' } : {}) }, n))))),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save')),
    h('label', { class: 'row ap-switch' }, h('input', { type: 'checkbox', ...(s.alertEmails ? { checked: '' } : {}), onchange: e => emails(e.target.checked) }), h('span', { class: 'small' }, 'Email me when a strong fit appears (at most one email every six hours, never on the first check).')))
}

// ── The browser helper ──
const EXTENSION_ID = window.NP_EXTENSION_ID || ''   // set in app/index.html once the Web Store id is known
const STORE_URL = window.NP_EXTENSION_STORE || ''
const STANDARD = [
  ['workRights', 'Right to work in Australia', 'e.g. Australian citizen, permanent resident, or your visa and its work conditions'],
  ['notice', 'Notice period or when you can start', 'e.g. Two weeks, or Immediately'],
  ['salary', 'Salary expectation', 'A figure or range, or Negotiable'],
  ['licence', 'Driver licence and vehicle', 'e.g. Full licence, own car'],
  ['hoursAvailable', 'Hours and days you can work', 'e.g. Weekdays, school hours'],
  ['relocate', 'Willing to relocate or travel', ''],
  ['checks', 'Checks you hold', 'e.g. Working with Children Check, NDIS Worker Screening, Police Check (2025)'],
  ['qualifications', 'Qualifications and tickets', 'e.g. Certificate III Individual Support, First Aid, White Card']
]
const ping = () => new Promise(r => { try { if (!EXTENSION_ID || !window.chrome?.runtime?.sendMessage) return r(null); chrome.runtime.sendMessage(EXTENSION_ID, { type: 'ping' }, x => r(chrome.runtime.lastError ? null : x)) } catch { r(null) } })
const pairWith = token => new Promise(r => { try { chrome.runtime.sendMessage(EXTENSION_ID, { type: 'pair', token, device: navigator.userAgentData?.brands?.[0]?.brand || 'Browser' }, x => r(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : x)) } catch (e) { r({ ok: false, error: e.message }) } })

function helperCard(ctx) {
  const H = (L.helper ||= { ext: undefined, list: null, busy: false })
  if (H.ext === undefined) { H.ext = null; ping().then(x => { H.ext = x; ctx.render() }) }
  if (H.list === null) { H.list = []; ctx.call('/api/newpage/app', { action: 'extension_list' }).then(d => { H.list = d.extensions; ctx.render() }).catch(() => {}) }
  const connect = async () => {
    if (H.busy) return
    H.busy = true; L.err = ''; ctx.render()
    try {
      const d = await ctx.call('/api/newpage/app', { action: 'extension_pair', device: navigator.userAgentData?.brands?.[0]?.brand || 'Browser' })
      const r = await pairWith(d.token)
      if (!r?.ok) throw new Error(r?.error || 'The helper did not accept the connection. Is it installed and enabled?')
      H.list = d.extensions; L.note = 'Connected. Open a job on Seek or Indeed and the helper’s panel will show your documents and answers.'
    } catch (e) { L.err = e.message }
    H.busy = false; ctx.render()
  }
  const revoke = async id => { try { const d = await ctx.call('/api/newpage/app', { action: 'extension_revoke', id }); H.list = d.extensions; L.note = 'Disconnected.' } catch (e) { L.err = e.message } ctx.render() }
  return h('div', { class: 'card' }, h('span', { class: 'label' }, 'The browser helper'),
    h('p', { class: 'small muted' }, 'A small Chrome or Edge extension that carries your tailored resume, cover letter and standard answers into Seek and Indeed application forms, and shows how well each job fits you. It fills; you read and press Submit. It never submits for you, and it never opens job pages on its own.'),
    !EXTENSION_ID ? h('p', { class: 'small' }, 'The helper isn’t published yet.')
      : H.ext ? h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', disabled: H.busy, onclick: connect }, H.busy ? 'Connecting…' : 'Connect this browser'), h('span', { class: 'small muted' }, `Helper ${H.ext.version} is installed.`))
        : h('div', { class: 'row' }, STORE_URL && h('a', { class: 'btn btn-secondary', href: STORE_URL, target: '_blank', rel: 'noopener' }, 'Install the helper'), h('span', { class: 'small muted' }, 'Not detected in this browser. Install it, then come back here and press Connect.')),
    (H.list || []).length > 0 && h('div', {}, h('span', { class: 'small' }, 'Connected browsers:'), h('ul', { class: 'small' }, H.list.map(x => h('li', {}, `${x.device || 'Browser'}, connected ${fmt(String(x.created_at).slice(0, 10))}${x.last_used_at ? `, last used ${fmt(String(x.last_used_at).slice(0, 10))}` : ''} `, h('button', { class: 'link-btn danger small', type: 'button', onclick: () => revoke(x.id) }, 'Disconnect')))),
      H.list.length > 1 && h('button', { class: 'link-btn small', type: 'button', onclick: () => revoke('all') }, 'Disconnect all')))
}

function answersCard(ctx) {
  const s = ctx.S.me.applySettings || {}
  const A = (L.answers ||= { ...(s.answers || {}), custom: [...((s.answers || {}).custom || [])] })
  const save = async () => { try { const d = await ctx.call('/api/newpage/app', { action: 'apply_answers_set', answers: A, capture: L.capture ?? s.capture }); absorb(ctx, d); L.note = 'Saved.' } catch (e) { L.err = e.message } ctx.render() }
  return h('form', { class: 'card doc-form', onsubmit: e => { e.preventDefault(); save() } },
    h('span', { class: 'label' }, 'Standard answers'),
    h('p', { class: 'small muted' }, 'The questions nearly every application asks. Write them once; the helper puts them in for you, and Sky’s drafted answers never contradict them. Leave blank anything you’d rather answer each time.'),
    h('div', { class: 'ap-fields' }, STANDARD.map(([id, label, hint]) => h('label', { class: 'field' }, h('span', {}, label), h('input', { value: A[id] || '', placeholder: hint, oninput: e => { A[id] = e.target.value } })))),
    h('div', {}, h('span', { class: 'small' }, h('b', {}, 'Your own questions and answers'), ' (for the ones you keep seeing, like “Why do you want to work with us?”)'),
      A.custom.map((c, i) => h('div', { class: 'ap-fields' }, h('label', { class: 'field' }, h('span', {}, 'Question'), h('input', { value: c.q, oninput: e => { c.q = e.target.value } })), h('label', { class: 'field' }, h('span', {}, 'Answer'), h('textarea', { rows: 2, value: c.a, oninput: e => { c.a = e.target.value } })), h('button', { class: 'link-btn danger small', type: 'button', onclick: () => { A.custom.splice(i, 1); ctx.render() } }, 'Remove'))),
      A.custom.length < 12 && h('button', { class: 'link-btn blue', type: 'button', onclick: () => { A.custom.push({ q: '', a: '' }); ctx.render() } }, 'Add one')),
    h('label', { class: 'row ap-switch' }, h('input', { type: 'checkbox', ...((L.capture ?? s.capture) ? { checked: '' } : {}), onchange: e => { L.capture = e.target.checked } }), h('span', { class: 'small' }, 'When I search on Seek, Indeed or Jora myself, let the helper read the results on my screen and add the good fits to Today. Only the page I’m looking at, never more.')),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save')))
}

function targetCard(ctx) {
  const save = async v => { try { const d = await ctx.call('/api/newpage/app', { action: 'apply_settings_set', weeklyTarget: v }); absorb(ctx, d); L.target = d.applySettings?.weeklyTarget || ''; L.note = L.target ? `Target set: ${L.target} a week.` : 'No weekly target.' } catch (e) { L.err = e.message } ctx.render() }
  return h('div', { class: 'card' }, h('span', { class: 'label' }, 'A weekly rhythm, if you want one'),
    h('p', { class: 'small muted' }, 'A number you choose, shown on Today. Fewer, well-matched applications usually beat many. Leave it blank for none.'),
    h('div', { class: 'row' },
      h('label', { class: 'field ap-target' }, h('span', {}, 'Applications a week'), h('input', { type: 'number', min: 0, max: 50, value: L.target, oninput: e => { L.target = e.target.value } })),
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => save(L.target === '' ? null : Number(L.target)) }, 'Save')))
}

export function applyScreen(ctx) {
  if (L.list === null && !L.loading) refresh(ctx)
  const list = L.list || []
  const groups = [['Waiting to hear', list.filter(a => OPEN.has(a.status))], ['Saved to apply for', list.filter(a => a.status === 'saved')], ['Closed', list.filter(a => !OPEN.has(a.status) && a.status !== 'saved')]]
  return h('section', { class: 'screen docs' },
    h('div', {}, h('span', { class: 'note' }, 'get hired'), h('h2', {}, 'Applications'),
      h('p', { class: 'muted' }, 'What you’ve applied for and what came back. The resume writer and cover letter writer ask to log each one; add the rest here.')),
    pipelineCard(ctx.S.me, ctx.go),
    L.err && h('p', { class: 'error', role: 'alert' }, L.err),
    L.note && h('p', { class: 'small ok' }, L.note),
    addForm(ctx),
    L.loading && !L.list ? h('p', { class: 'muted' }, 'Loading…')
      : !list.length ? h('div', { class: 'card' }, h('p', { class: 'small muted' }, 'Nothing logged yet. Tailor a resume or write a cover letter and you’ll be asked whether you applied.'),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => ctx.go('tools', 'resume') }, 'Open the resume writer')))
      : groups.filter(([, g]) => g.length).map(([name, g]) => h('div', { class: 'ap-group' }, h('h3', { class: 'group' }, `${name} (${g.length})`), h('ul', { class: 'ap-list' }, g.map(a => row(ctx, a))))),
    searchCard(ctx),
    answersCard(ctx),
    helperCard(ctx),
    targetCard(ctx),
    skyCard(ctx))
}
