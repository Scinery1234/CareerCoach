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
      const d = await ctx.call('/api/newpage/app', { action: 'apply_add', title: state.title ?? job.title, company: state.company ?? job.company, url: state.url ?? job.url, board: state.board || undefined, job: job.job, resume_doc_id: job.resume_doc_id, cover_doc_id: job.cover_doc_id, status })
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
    targetCard(ctx),
    skyCard(ctx))
}
