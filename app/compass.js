// The Compass: eleven short steps from values to first steps, saved to the
// member's account. Suggestions come from the server (Claude).
import { h, todayStr, addDays, words, copyText } from './ui.js'
import { WHEN, whenLabel, isGroup, syncBoard, stack, takeOut, unstack, itemName, pickText, sortMissing } from './compass-sort.js'

const VALUES = ['Achievement', 'Adventure', 'Balance', 'Beauty', 'Belonging', 'Calm', 'Care', 'Community', 'Courage', 'Creativity', 'Culture', 'Curiosity', 'Faith', 'Fairness', 'Family', 'Freedom', 'Friendship', 'Fun', 'Growth', 'Health', 'Home', 'Honesty', 'Hope', 'Humour', 'Independence', 'Joy', 'Justice', 'Kindness', 'Learning', 'Love', 'Loyalty', 'Making a difference', 'Money', 'Nature', 'Peace', 'Purpose', 'Respect', 'Security', 'Simplicity', 'Spirituality', 'Stability', 'Success', 'Teamwork', 'Trust', 'Wisdom']
// Starters for "I am": work and the rest of life, so nobody faces a blank box.
const IAM_EXAMPLES = ['an electrician', 'an engineer', 'an organiser', 'an early riser', 'an introvert', 'an extrovert', 'a nurse', 'a teacher', 'a tradie', 'a carer', 'a team leader', 'a manager', 'a problem solver', 'a good listener', 'a fast learner', 'a hard worker', 'a people person', 'a numbers person', 'a planner', 'a maker', 'a creative', 'a mentor', 'a volunteer', 'a parent', 'curious', 'calm in a crisis', 'detail-minded', 'starting again']
export const COMPASS_STEPS = ['Values', 'Who I am', 'North Star', 'What I need', 'Strengths', 'Mix ideas', 'Sort', 'Choose', 'Plan', 'First steps', 'Calendar']

const T = { C: null, loading: false, err: '', busy: '', trios: [], seen: new Set(), inp: {}, sched: [], placed: false, notice: '', round: null, lift: null, focus: '', angles: [], phase: 'pick' }
const LAST = COMPASS_STEPS.length - 1

// "I am" + whatever they typed. A leading article is lower-cased, and so is a single
// capitalised word ("Learner"); longer input is left as typed so names keep their capitals.
const iam = s => {
  s = String(s || '').trim().replace(/^i\s*am\s*/i, '').replace(/[.\s]+$/, '').trim()
  if (!s) return ''
  if (/^(a|an)\s/i.test(s)) s = s.replace(/^(a|an)\s+/i, m => m.toLowerCase())
  else if (/^[A-Z][a-z]+$/.test(s)) s = s.toLowerCase()
  return 'I am ' + s
}

let saveTimer = null
let dirty = false
function send(ctx, keepalive) {
  clearTimeout(saveTimer); dirty = false
  syncBoard(T.C) // so what's saved always matches the idea list
  const req = { action: 'tool_save', tool: 'compass', data: T.C }
  return keepalive ? ctx.beacon('/api/newpage/app', req) : ctx.call('/api/newpage/app', req).catch(() => {})
}
// Typing is saved after a short pause; clicks and step changes save at once.
function save(ctx, now = true) {
  dirty = true
  clearTimeout(saveTimer)
  if (now) send(ctx, false)
  else saveTimer = setTimeout(() => send(ctx, false), 600)
}
let hooked = false
function hook(ctx) {
  if (hooked) return
  hooked = true
  const flush = () => { if (dirty && T.C) send(ctx, true) }
  addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
}

// For Sky: send anything typed but not yet saved, so Sky sees the Compass as it is on screen.
export async function compassFlush(ctx) {
  if (dirty && T.C) await send(ctx, false)
}
// Where they are in the Compass, when it's on screen beside the chat.
export const compassWhere = () => (T.C ? { compassStep: T.C.step } : null)
// Sky added ideas: bring them in without touching anything else on screen. They come with
// Sky's reply, so a save made while Sky was answering can't lose them.
export function compassMerge(ctx, ideas) {
  if (!T.C || !Array.isArray(ideas)) return
  try {
    let n = 0
    for (const v of ideas) if (!T.C.ideas.includes(v) && T.C.ideas.length < 30) { T.C.ideas.push(v); n++ }
    if (n) { T.notice = `Sky added ${n} idea${n === 1 ? '' : 's'} to your list.`; syncBoard(T.C); save(ctx) }
  } catch {}
}

export async function compassStatus(ctx) {
  if (!T.C) { try { T.C = (await ctx.call('/api/newpage/app', { action: 'tool_get', tool: 'compass' })).data } catch {} }
  return T.C
}

async function ensureLoaded(ctx) {
  if (T.C || T.loading) return
  T.loading = true
  try { T.C = (await ctx.call('/api/newpage/app', { action: 'tool_get', tool: 'compass' })).data } catch (e) { T.err = e.message }
  T.loading = false
  ctx.render()
}

async function suggest(ctx, kind, data, key) {
  T.busy = key; T.err = ''; ctx.render()
  try { return (await ctx.call('/api/newpage/app', { action: 'compass_suggest', kind, data, compass: T.C })).result }
  catch (e) { T.err = e.code === 'coach_off' ? 'Suggestions aren’t switched on yet. You can still do every step yourself.' : e.message; return null }
  finally { T.busy = ''; ctx.render() }
}

function makeTrios(G, n = 10) {
  const all = []
  for (const k of G.know) for (const d of G.do) for (const l of G.love) all.push({ know: k, do: d, love: l })
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]] }
  const key = t => `${t.know}|${t.do}|${t.love}`
  let fresh = all.filter(t => !T.seen.has(key(t)))
  if (fresh.length < n) { T.seen.clear(); fresh = all }
  const out = fresh.slice(0, n).map(t => ({ ...t, idea: '', added: [] }))
  out.forEach(t => T.seen.add(key(t)))
  return out
}

function rankList(arr, onChange, label) {
  return h('ol', { class: 'rank', 'aria-label': label }, arr.map((v, i) => h('li', {},
    h('span', { class: 'n' }, String(i + 1)), h('span', { class: 'v' }, v),
    h('button', { class: 'mv', type: 'button', disabled: i === 0, 'aria-label': `Move ${v} up`, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; onChange() } }, '↑'),
    h('button', { class: 'mv', type: 'button', disabled: i === arr.length - 1, 'aria-label': `Move ${v} down`, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; onChange() } }, '↓'),
    h('button', { class: 'mv', type: 'button', 'aria-label': `Remove ${v}`, onclick: () => { arr.splice(i, 1); onChange() } }, '×'))))
}

function tagList(arr, onChange) {
  return arr.length ? h('div', { class: 'tags' }, arr.map((v, i) => h('span', { class: 'tag' }, v, h('button', { type: 'button', 'aria-label': `Remove ${v}`, onclick: () => { arr.splice(i, 1); onChange() } }, '×')))) : null
}

function addRow(ctx, id, placeholder, onAdd, prefix) {
  const go = () => { const v = (T.inp[id] || '').trim(); if (!v) return; T.inp[id] = ''; onAdd(v); ctx.render(); document.getElementById(id)?.focus() }
  return h('div', { class: 'add-row' },
    prefix && h('span', { class: 'pre' }, prefix),
    h('input', { id, type: 'text', maxlength: '100', placeholder, 'aria-label': placeholder, value: T.inp[id] || '', oninput: e => { T.inp[id] = e.target.value }, onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); go() } } }),
    h('button', { class: 'btn btn-secondary', type: 'button', onclick: go }, 'Add'))
}

// What's still needed to leave each step.
function missing(C, step) {
  const m = []
  const need = (n, have, what) => { if (have < n) m.push(`${n - have} more ${what}`) }
  if (step === 0) need(5, C.values.length, 'value' + (5 - C.values.length === 1 ? '' : 's'))
  if (step === 1) need(3, C.iAm.length, '“I am” statement' + (3 - C.iAm.length === 1 ? '' : 's'))
  if (step === 2 && words(C.north) < 15) m.push('a few more sentences (15 words or more)')
  if (step === 3) { const n = C.needs; if (n.pay === '') m.push('lowest pay'); if (!n.hours) m.push('hours a week'); if (!n.stress) m.push('how much stress is OK'); if (!n.mode) m.push('where you want to work') }
  if (step === 4) { for (const [k, l] of [['know', 'thing you know'], ['do', 'thing you can do'], ['love', 'thing you love']]) if (C.strengths[k].length < 3) m.push(`${3 - C.strengths[k].length} more ${l}${3 - C.strengths[k].length === 1 ? '' : 's'}`) }
  if (step === 5 && C.ideas.length < 1) m.push('at least one idea')
  if (step === 6) { syncBoard(C); m.push(...sortMissing(C)) }
  if (step === 7 && !C.first) m.push('your top pick')
  return m
}

export function compassScreen(ctx) {
  ensureLoaded(ctx)
  const back = h('button', { class: 'link-btn back', type: 'button', onclick: () => ctx.go('tools') }, '← Tools')
  if (!T.C) return h('section', { class: 'screen' }, back, h('h2', {}, 'The Compass'), T.err ? h('p', { class: 'error' }, T.err) : h('p', { class: 'loading' }, 'Loading…'))

  hook(ctx)
  const C = T.C
  const step = C.step
  const rr = () => { save(ctx); ctx.render() }
  const quiet = () => save(ctx, false)
  const go = n => { T.phase = n < C.step ? 'rank' : 'pick'; C.step = Math.max(0, Math.min(LAST, n)); T.err = ''; T.round = null; T.lift = null; save(ctx); ctx.render(); window.scrollTo({ top: 0 }) }
  const body = []

  // Values and "I am" come in two parts: first get them all down, then put them in order.
  const ordering = (step === 0 || step === 1) && T.phase === 'rank'
  const partLine = n => h('p', { class: 'small part' }, `Part ${n} of 2: ${n === 1 ? 'get them all down' : 'put them in order'}`)
  if (step === 0) {
    const full = C.values.length >= 10
    if (!ordering) body.push(h('h3', {}, 'What matters most to you?'), partLine(1), h('p', { class: 'muted' }, 'Tap the values that feel like you. Choose between 5 and 10. Don’t worry about the order yet.'),
      h('p', { class: 'small', 'aria-live': 'polite' }, h('b', {}, `${C.values.length} of 10 chosen.`), full ? ' That’s the most. To choose another, tap one you’ve chosen to remove it first.' : ''),
      h('div', { class: 'chips' }, [...VALUES, ...C.values.filter(v => !VALUES.includes(v))].map(v => {
        const on = C.values.includes(v)
        return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(on), disabled: !on && full, onclick: () => { if (on) C.values = C.values.filter(x => x !== v); else C.values.push(v); rr() } }, v)
      })),
      !full && addRow(ctx, 'cp-value', 'Missing one? Add your own', v => { if (C.values.length < 10 && !C.values.includes(v)) C.values.push(v); save(ctx) }))
    else body.push(h('h3', {}, 'Put your values in order'), partLine(2), h('p', { class: 'muted' }, 'Move the one that matters most to the top. It becomes your #1, and the Compass builds on it.'),
      rankList(C.values, rr, 'Your values in order'))
  } else if (step === 1) {
    const MAX = 20, full = C.iAm.length >= MAX
    const addIam = v => { const t = iam(v); if (t && !C.iAm.includes(t) && C.iAm.length < MAX) C.iAm.push(t); save(ctx) }
    if (!ordering) body.push(h('h3', {}, 'Who are you?'), partLine(1), h('p', { class: 'muted' }, 'Finish the sentence “I am…” as many times as you like: who you’ve been, who you are now, or who you’d love to be. Think about work and the rest of your life. Don’t worry about the order yet.'),
      full ? h('p', { class: 'soft' }, `That’s ${MAX}, the most you can have. To add another, remove one first.`)
        : addRow(ctx, 'cp-iam', 'e.g. an electrician, a team leader, curious', addIam, 'I am'),
      h('p', { class: 'small', 'aria-live': 'polite' }, h('b', {}, `${C.iAm.length} of ${MAX}.`), ' Three or more to go on.'),
      tagList(C.iAm, rr),
      !full && h('div', { class: 'card' }, h('span', { class: 'label' }, 'Stuck? Tap any that fit'),
        h('div', { class: 'chips' }, IAM_EXAMPLES.filter(x => !C.iAm.includes(iam(x))).map(x => h('button', { class: 'chip small', type: 'button', onclick: () => { addIam(x); ctx.render() } }, x)))))
    else body.push(h('h3', {}, 'Put them in order'), partLine(2), h('p', { class: 'muted' }, 'Order them by what feels most true today. Your #1 shapes your North Star in the next step.'),
      rankList(C.iAm, rr, 'Your I am statements in order'))
  } else if (step === 2) {
    const wc = h('div', { class: 'small muted', id: 'cp-wc' }, `${words(C.north)} words`)
    body.push(h('h3', {}, 'Your North Star'), h('p', { class: 'muted' }, 'Picture your #1 value fully lived by your #1 “I am”. Describe the most exciting version you can imagine, in any part of life. Work is there to support it.'),
      h('div', { class: 'anchor' }, h('div', {}, h('span', {}, '#1 value'), h('b', {}, C.values[0] || '—')), h('div', {}, h('span', {}, '#1 I am'), h('b', {}, C.iAm[0] || '—'))),
      h('ul', { class: 'prompts' }, ['Where are you, and who’s with you?', 'What does an ordinary day look like?', 'What are you doing, making or giving?', 'How does it feel?'].map(t => h('li', {}, t))),
      h('div', { class: 'field' }, h('textarea', { id: 'cp-north', rows: '8', maxlength: '3000', 'aria-label': 'Your North Star', placeholder: 'Write in your own words…', oninput: e => { C.north = e.target.value; wc.textContent = `${words(C.north)} words`; quiet(); refreshFooter() } }, C.north)), wc)
  } else if (step === 3) {
    const N = C.needs
    const opts = (key, list) => h('div', { class: 'chips' }, list.map(v => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(N[key] === v), onclick: () => { N[key] = v; rr() } }, v)))
    body.push(h('h3', {}, 'What do you need from work?'), h('p', { class: 'muted' }, 'The practical things a job has to have for it to work in your life.'),
      h('div', { class: 'two' },
        h('div', { class: 'field' }, h('label', { for: 'cp-pay' }, 'Lowest pay I can accept (per year, before tax)'), h('input', { id: 'cp-pay', type: 'text', inputmode: 'numeric', maxlength: '12', placeholder: 'e.g. 75000', value: N.pay, oninput: e => { N.pay = e.target.value.replace(/[^\d]/g, ''); quiet(); refreshFooter() } })),
        h('div', { class: 'field' }, h('label', { for: 'cp-hours' }, 'Most hours I want to work a week'), h('input', { id: 'cp-hours', type: 'text', inputmode: 'numeric', maxlength: '2', placeholder: 'e.g. 38', value: N.hours, oninput: e => { N.hours = e.target.value.replace(/[^\d]/g, ''); quiet(); refreshFooter() } }))),
      h('div', { class: 'field' }, h('span', { class: 'flabel' }, 'How much stress is OK?'), opts('stress', ['Low', 'Some', 'A lot is fine'])),
      h('div', { class: 'field' }, h('span', { class: 'flabel' }, 'Where do you want to work?'), opts('mode', ['From home', 'Mix of home and on-site', 'On-site', 'Don’t mind'])),
      h('div', { class: 'field' }, h('label', { for: 'cp-loc' }, 'Location (optional)'), h('input', { id: 'cp-loc', type: 'text', maxlength: '100', placeholder: 'e.g. Parramatta, no long drives', value: N.location, oninput: e => { N.location = e.target.value; quiet() } })),
      h('div', { class: 'field' }, h('label', { for: 'cp-other' }, 'Anything else that has to be true? (optional)'), h('textarea', { id: 'cp-other', rows: '2', maxlength: '300', placeholder: 'e.g. School pick-up on Wednesdays', oninput: e => { N.other = e.target.value; quiet() } }, N.other)))
  } else if (step === 4) {
    const G = C.strengths
    const cats = [['know', 'Things I know', 'Topics, places, cultures, industries, life experience', 'e.g. Gardening, NDIS'], ['do', 'Things I can do', 'Skills, practical or people-based', 'e.g. Fix bikes, write'], ['love', 'Things I love', 'What makes your heart sing, or your blood boil', 'e.g. Live music, fairness'], ['other', 'Other things I bring (optional)', 'People you know, places you can access, things you own', 'e.g. A ute, a big network']]
    body.push(h('h3', {}, 'Your strengths'), h('p', { class: 'muted' }, 'Three groups: what you know, what you can do, and what you love. At least three in each. More is better.'),
      h('div', { class: 'mixgrid' }, cats.map(([k, label, hint, ph]) => h('div', { class: 'card' }, h('span', { class: 'label' }, label, k !== 'other' && h('small', {}, ` ${G[k].length}/3`)), h('p', { class: 'small muted' }, hint), tagList(G[k], rr), addRow(ctx, 'cp-s-' + k, ph, v => { if (G[k].length < 20 && !G[k].includes(v)) G[k].push(v); save(ctx) })))))
  } else if (step === 5) {
    const G = C.strengths
    if (!T.trios.length || T.trios.some(t => !G.know.includes(t.know) || !G.do.includes(t.do) || !G.love.includes(t.love))) T.trios = makeTrios(G)
    const addIdea = (v, t) => { if (v && !C.ideas.includes(v) && C.ideas.length < 30) { C.ideas.push(v); if (t) t.added.push(v) } }
    // Remix keeps anything typed but not yet added, so nothing is lost.
    const remix = () => { for (const t of T.trios) { const v = t.idea.trim(); if (v) addIdea(v, t) } T.trios = makeTrios(G); T.showAll = false; save(ctx); ctx.render(); window.scrollTo({ top: 0 }) }
    const shown = T.showAll ? T.trios : T.trios.slice(0, 5)
    body.push(h('h3', {}, 'Mix and match'), h('p', { class: 'muted' }, 'Each card mixes one thing you know, one you can do and one you love. Ask: how could these fit into my working life? It doesn’t have to be one job. One could be a side job, something you learn, where you work, or who you work for. Skip any that don’t spark anything. Add the ideas you already had too.'),
      h('div', { class: 'card' }, h('span', { class: 'label' }, 'Ideas you already had'), h('p', { class: 'small muted' }, 'Any job or career you’ve thought about before, even years ago. Bank them first.'),
        addRow(ctx, 'cp-idea', 'e.g. Paramedic, opening a café', v => { addIdea(v); save(ctx) })),
      h('div', { class: 'mixgrid' }, shown.map((t, j) => h('div', { class: 'card mix' },
        h('div', { class: 'trio' }, h('span', {}, t.know), '+', h('span', {}, t.do), '+', h('span', {}, t.love)),
        t.added.length > 0 && h('div', { class: 'tags' }, t.added.map(v => h('span', { class: 'tag got' }, '✓ ' + v))),
        h('div', { class: 'add-row' },
          h('input', { id: 'cp-mix-' + j, type: 'text', maxlength: '100', placeholder: t.added.length ? 'Another idea?' : 'What work could this be?', 'aria-label': `Idea for mix ${j + 1}`, value: t.idea, oninput: e => { t.idea = e.target.value }, onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); addIdea(t.idea.trim(), t); t.idea = ''; t.how = ''; rr() } } }),
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { addIdea(t.idea.trim(), t); t.idea = ''; t.how = ''; rr() } }, 'Add')),
        t.how && t.idea && h('p', { class: 'small muted' }, t.how),
        h('button', { class: 'link-btn blue', type: 'button', disabled: !!T.busy, onclick: async () => { const r = await suggest(ctx, 'mixIdea', { know: t.know, do: t.do, love: t.love, avoid: [...t.added, ...C.ideas], skip: T.angles }, 'mix' + j); if (r?.angles) T.angles = [...r.angles, ...T.angles].slice(0, 8); if (r?.idea) { t.idea = r.idea; t.how = r.how; ctx.render() } } }, T.busy === 'mix' + j ? 'Thinking…' : 'Suggest an idea for this mix')))),
      h('div', { class: 'row' },
        !T.showAll && T.trios.length > 5 && h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { T.showAll = true; ctx.render() } }, `Show ${T.trios.length - 5} more`),
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: remix }, 'Remix: 10 new mixes')),
      h('div', { class: 'card' }, h('span', { class: 'label' }, `Your ideas (${C.ideas.length})`),
        tagList(C.ideas, rr) || h('p', { class: 'muted small' }, 'Ideas you add appear here.'),
        h('button', { class: 'btn btn-secondary', type: 'button', disabled: !!T.busy, onclick: async () => { const r = await suggest(ctx, 'ideas', {}, 'ideas'); if (r?.ideas) { T.sugg = r.ideas; ctx.render() } } }, T.busy === 'ideas' ? 'Thinking…' : 'Suggest 5 more ideas from my answers'),
        (T.sugg || []).map(s => h('div', { class: 'sugg' }, h('b', {}, s.title), h('p', { class: 'small muted' }, `${s.know} + ${s.do} + ${s.love}. ${[s.how, s.why].filter(Boolean).join(' ')}`),
          h('button', { class: 'chip', type: 'button', disabled: C.ideas.includes(s.title), onclick: () => { addIdea(s.title); rr() } }, C.ideas.includes(s.title) ? 'Added' : 'Add to my ideas'),
          h('button', { class: 'link-btn', type: 'button', 'aria-label': `Dismiss ${s.title}`, onclick: () => { T.sugg = T.sugg.filter(x => x !== s); ctx.render() } }, 'No thanks')))))
  } else if (step === 6) {
    body.push(sortStep(ctx, C, rr, quiet))
  } else if (step === 7) {
    body.push(chooseStep(ctx, C, rr))
  } else if (step === 8) {
    const P = C.plan
    const fields = [['now', 'Now (the next 3 months)'], ['building', 'Building (3 to 9 months)'], ['move', 'The move (9 to 18 months)'], ['longer', 'Longer term (18 months and beyond)']]
    body.push(h('h3', {}, 'Sketch your path'), h('p', { class: 'muted' }, `A few sentences each toward ${C.first || 'your direction'}. Rough is fine.`),
      fields.map(([k, label]) => h('div', { class: 'field' }, h('label', { for: 'cp-p-' + k }, label), h('textarea', { id: 'cp-p-' + k, rows: '3', maxlength: '1200', oninput: e => { P[k] = e.target.value; quiet() } }, P[k]))),
      h('button', { class: 'btn btn-secondary', type: 'button', disabled: !!T.busy, onclick: async () => { const r = await suggest(ctx, 'plan', {}, 'plan'); if (r) { for (const [k] of fields) if (!P[k].trim() && r[k]) P[k] = r[k]; rr() } } }, T.busy === 'plan' ? 'Thinking…' : 'Suggest a path for the empty boxes'))
  } else if (step === 9) {
    const A = C.actions
    while (A.length < 3) A.push('')
    body.push(h('h3', {}, 'Three small first steps'), h('p', { class: 'muted' }, 'Things you can do in the next two weeks. Each takes under two hours and starts with a doing word: call, write, visit, sign up.'),
      A.slice(0, 3).map((a, i) => h('div', { class: 'field' }, h('label', { for: 'cp-a-' + i }, `Step ${i + 1}`), h('input', { id: 'cp-a-' + i, type: 'text', maxlength: '200', value: a, oninput: e => { A[i] = e.target.value; quiet() } }))),
      h('button', { class: 'btn btn-secondary', type: 'button', disabled: !!T.busy, onclick: async () => { const r = await suggest(ctx, 'steps', {}, 'steps'); if (r?.steps) { let j = 0; for (let i = 0; i < 3; i++) if (!A[i].trim() && r.steps[j]) A[i] = r.steps[j++]; rr() } } }, T.busy === 'steps' ? 'Thinking…' : 'Suggest steps for the empty ones'))
  } else {
    const steps = C.actions.filter(a => a.trim())
    if (T.sched.length !== steps.length) T.sched = steps.map((a, i) => ({ title: a, date: addDays(todayStr(), 2 + i * 3), time: '10:00', mins: 60 }))
    body.push(h('h3', {}, 'Put it in your planner'), h('p', { class: 'muted' }, 'Give each first step a time so it actually happens. They go into your planner, and you can add them to your calendar from there.'),
      T.sched.map((s, i) => h('div', { class: 'card' }, h('p', {}, h('b', {}, s.title)),
        h('div', { class: 'when' }, h('input', { type: 'date', value: s.date, 'aria-label': `Date for step ${i + 1}`, oninput: e => { s.date = e.target.value } }), h('input', { type: 'time', value: s.time, 'aria-label': `Time for step ${i + 1}`, oninput: e => { s.time = e.target.value } })))),
      !steps.length && h('p', { class: 'muted' }, 'Go back and add your first steps.'),
      steps.length > 0 && (C.placed
        ? h('p', { class: 'soft' }, 'Added to your planner. ', h('button', { class: 'link-btn blue', type: 'button', onclick: () => ctx.go('tools', 'planner') }, 'Open the planner'))
        : h('button', { class: 'btn btn-primary', type: 'button', disabled: T.busy === 'place', onclick: async () => {
            T.busy = 'place'; ctx.render()
            // Each step is marked once it's in, so trying again after an error doesn't add it twice.
            try { for (const s of T.sched) if (!s.added) { await ctx.act('task_add', { title: s.title, due: s.date, start: s.time, mins: s.mins }); s.added = true } C.placed = true; C.done = true; save(ctx) } catch (e) { T.err = e.message + (T.sched.some(s => s.added) ? ' The steps already added are in your planner.' : '') }
            T.busy = ''; ctx.render()
          } }, T.busy === 'place' ? 'Adding…' : 'Add to my planner')),
      summary(ctx, C, go))
  }

  const footer = h('div', { class: 'cp-footer' }, h('p', { class: 'small muted', id: 'cp-hint', 'aria-live': 'polite' }),
    h('div', { class: 'row' },
      (step > 0 || ordering) && h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { if (ordering) { T.phase = 'pick'; ctx.render(); window.scrollTo({ top: 0 }) } else go(step - 1) } }, 'Back'),
      step < LAST && h('button', { id: 'cp-next', class: 'btn btn-primary', type: 'button', onclick: () => { if (missing(C, step).length) { refreshFooter(true); return } if ((step === 0 || step === 1) && !ordering) { T.phase = 'rank'; ctx.render(); window.scrollTo({ top: 0 }); return } go(step + 1) } }, ordering || (step !== 0 && step !== 1) ? 'Next' : 'Next: put them in order')))
  function refreshFooter(force) {
    const m = missing(C, step)
    const hint = document.getElementById('cp-hint'), next = document.getElementById('cp-next')
    if (hint) hint.textContent = m.length ? 'Still needed: ' + m.join(', ') : ''
    if (next) next.setAttribute('aria-disabled', String(m.length > 0))
  }
  setTimeout(refreshFooter, 0)

  return h('section', { class: 'screen compass' },
    h('div', {}, back, h('span', { class: 'note' }, 'the compass'), h('h2', {}, COMPASS_STEPS[step])),
    h('div', { class: 'cp-steps', role: 'list', 'aria-label': 'Steps' }, COMPASS_STEPS.map((s, i) => h('span', { role: 'listitem', class: i === step ? 'on' : i < step ? 'past' : '', 'aria-current': i === step ? 'step' : null, 'aria-label': `Step ${i + 1}: ${s}` }))),
    h('p', { class: 'small muted' }, `Step ${step + 1} of ${COMPASS_STEPS.length} · saved as you go`),
    T.err && h('p', { class: 'error', role: 'alert' }, T.err),
    T.notice && h('p', { class: 'soft', role: 'status' }, T.notice, ' ', h('button', { class: 'link-btn', type: 'button', onclick: () => { T.notice = ''; ctx.render() } }, 'OK')),
    h('div', { class: 'cp-body' }, body),
    footer)
}

// Keep the top pick and second pointing at the same item when its saved text changes.
function repick(C, b, change) {
  const old = pickText(b)
  change()
  const now = pickText(b)
  if (C.first === old) C.first = now
  if (C.second === old) C.second = now
}
// After groups are made or undone, a pick that no longer matches anything is cleared.
function dropStalePicks(C) {
  const texts = new Set(C.board.map(pickText))
  if (C.first && !texts.has(C.first)) C.first = ''
  if (C.second && !texts.has(C.second)) C.second = ''
}

const ROUNDS = ['Group', 'Rank', 'Time', 'Overview']

// The Sort step: group and label, rank by pull, then place in time.
function sortStep(ctx, C, rr, quiet) {
  const B = syncBoard(C)
  if (T.round == null) T.round = B.length && B.every(b => b.when) ? 3 : 0
  const to = n => { T.round = n; T.lift = null; T.err = ''; ctx.render(); window.scrollTo({ top: 0 }) }
  const out = [h('h3', {}, 'Sort your ideas')]
  if (!B.length) return [...out, h('p', { class: 'muted' }, 'Go back and add some ideas first.')]
  if (C.ideas.length <= 3) out.push(h('p', { class: 'soft small' }, 'With only a few ideas you can skip this and go straight to choosing. Press Next whenever you like.'))
  out.push(h('div', { class: 'sort-rounds', role: 'list', 'aria-label': 'Sorting rounds' }, ROUNDS.map((r, i) => h('button', { role: 'listitem', type: 'button', class: 'chip', 'aria-current': T.round === i ? 'step' : null, 'aria-pressed': String(T.round === i), onclick: () => to(i) }, `${i < 3 ? i + 1 + '. ' : ''}${r}`))))
  const ideasLine = b => isGroup(b) && h('p', { class: 'small muted' }, b.ideas.join(' · '))
  const timeTag = b => b.when && h('span', { class: 'tag got' }, whenLabel(b.when))

  if (T.round === 0) {
    const held = T.lift != null ? B[T.lift] : null
    if (T.focus) { const id = T.focus; T.focus = ''; setTimeout(() => document.getElementById(id)?.focus(), 0) }
    const put = to => {
      const target = B[to], wasGroup = isGroup(target)
      stack(B, T.lift, to)
      const at = B.indexOf(target)
      if (!wasGroup || !target.label) T.focus = 'cp-g-' + at
      T.lift = null; dropStalePicks(C); rr()
    }
    out.push(h('p', { class: 'muted' }, 'Like post-its on a table: put ideas that belong together in one pile. Press Move on an idea, then Put it here on another idea or group. Then give each group a name that says what they have in common. It can be a new idea of its own.'),
      h('p', { class: held ? 'soft' : '', 'aria-live': 'polite' }, held ? `Moving “${itemName(held)}”. Choose where it goes.` : ''),
      h('div', { class: 'sort-list' }, B.map((b, i) => {
        const lifted = T.lift === i
        return h('div', { class: 'card sort-item' + (isGroup(b) ? ' group' : '') + (lifted ? ' lifted' : '') },
          isGroup(b)
            ? [h('label', { class: 'flabel', for: 'cp-g-' + i }, `Group of ${b.ideas.length}`),
                h('input', { id: 'cp-g-' + i, type: 'text', maxlength: '60', placeholder: 'What do these have in common?', value: b.label, oninput: e => { repick(C, b, () => { b.label = e.target.value }); quiet() } }),
                h('div', { class: 'tags' }, b.ideas.map(v => h('span', { class: 'tag' }, v, b.ideas.length > 1 && h('button', { type: 'button', 'aria-label': `Take ${v} out of the group`, onclick: () => { takeOut(B, i, v); dropStalePicks(C); rr() } }, '×'))))]
            : h('p', { class: 'v' }, b.ideas[0]),
          h('div', { class: 'row' },
            T.lift == null ? h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { T.lift = i; ctx.render() } }, 'Move')
              : lifted ? h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { T.lift = null; ctx.render() } }, 'Cancel')
              : h('button', { class: 'btn btn-primary', type: 'button', 'aria-label': `Put “${itemName(held)}” with ${itemName(b)}`, onclick: () => put(i) }, 'Put it here'),
            isGroup(b) && T.lift == null && h('button', { class: 'link-btn', type: 'button', onclick: () => { unstack(B, i); dropStalePicks(C); rr() } }, 'Undo group')))
      })),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => {
        const unnamed = B.filter(b => b.ideas.length > 1 && !b.label).length
        if (unnamed) { T.err = `Give ${unnamed === 1 ? 'your group a name' : 'each group a name'} first.`; ctx.render(); return }
        to(1)
      } }, 'Next: rank them')))
  } else if (T.round === 1) {
    out.push(h('p', { class: 'muted' }, 'Put them in order of how much they pull you. The one that feels most alive goes at the top. Don’t think about how practical it is yet.'),
      h('ol', { class: 'rank', 'aria-label': 'Your ideas in order of pull' }, B.map((b, i) => h('li', {},
        h('span', { class: 'n' }, String(i + 1)),
        h('span', { class: 'v' }, isGroup(b) ? [h('b', {}, itemName(b)), ideasLine(b)] : b.ideas[0]),
        h('button', { class: 'mv', type: 'button', disabled: i === 0, 'aria-label': `Move ${itemName(b)} up`, onclick: () => { [B[i - 1], B[i]] = [B[i], B[i - 1]]; rr() } }, '↑'),
        h('button', { class: 'mv', type: 'button', disabled: i === B.length - 1, 'aria-label': `Move ${itemName(b)} down`, onclick: () => { [B[i + 1], B[i]] = [B[i], B[i + 1]]; rr() } }, '↓')))),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => to(0) }, 'Back to groups'), h('button', { class: 'btn btn-primary', type: 'button', onclick: () => to(2) }, 'Next: when')))
  } else if (T.round === 2) {
    out.push(h('p', { class: 'muted' }, 'When could each one happen in your life? There’s no wrong answer. Long term is just as good as short term.'),
      B.map((b, i) => h('div', { class: 'card' }, h('p', {}, h('b', {}, itemName(b))), ideasLine(b),
        h('div', { class: 'chips', role: 'group', 'aria-label': `When for ${itemName(b)}` }, WHEN.map(([k, l, hint]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(b.when === k), onclick: () => { b.when = b.when === k ? '' : k; rr() } }, `${l} · ${hint}`))))),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => to(1) }, 'Back to ranking'), h('button', { class: 'btn btn-primary', type: 'button', onclick: () => to(3) }, 'See it all')))
  } else {
    out.push(h('p', { class: 'muted' }, 'Here’s your table of ideas: most alive at the top. Notice what stands out. You can still change anything.'),
      h('ol', { class: 'rank sort-over' }, B.map((b, i) => h('li', {}, h('span', { class: 'n' }, String(i + 1)), h('span', { class: 'v' }, h('b', {}, itemName(b)), ideasLine(b)), timeTag(b) || h('span', { class: 'small muted' }, 'No time yet')))),
      h('div', { class: 'row' }, ['Change groups', 'Change order', 'Change times'].map((l, i) => h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => to(i) }, l))))
  }
  return out
}

// Choose: the sorted items, most alive first. A group can be picked as a whole,
// with one idea starred to try first.
function chooseStep(ctx, C, rr) {
  const B = syncBoard(C)
  const pick = (b, which) => {
    const t = pickText(b)
    if (which === 'first') { C.first = C.first === t ? '' : t; if (C.second === t) C.second = '' } else C.second = C.second === t ? '' : t
    rr()
  }
  return [h('h3', {}, 'Choose your direction'), h('p', { class: 'muted' }, 'Here are your ideas in the order you ranked them. Notice which ones light you up. Choose your top pick, and a second if you like. If you pick a group, you can star the idea in it to try first. You can always change your mind.'),
    B.length ? h('div', { class: 'card' }, B.map(b => {
      const t = pickText(b)
      return h('div', { class: 'pick' + (isGroup(b) ? ' group' : '') },
        h('span', {}, isGroup(b) ? h('b', {}, itemName(b)) : b.ideas[0], b.when ? h('span', { class: 'tag got when-tag' }, whenLabel(b.when)) : null),
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String(C.first === t), 'aria-label': `Top pick: ${itemName(b)}`, onclick: () => pick(b, 'first') }, 'Top pick'),
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String(C.second === t), 'aria-label': `Second: ${itemName(b)}`, disabled: C.first === t, onclick: () => pick(b, 'second') }, 'Second'),
        isGroup(b) && h('div', { class: 'stars', role: 'group', 'aria-label': `Which to try first in ${itemName(b)}` }, h('span', { class: 'small muted' }, 'Try first:'), b.ideas.map(v => h('button', { class: 'chip small', type: 'button', 'aria-pressed': String(b.star === v), 'aria-label': `Try ${v} first`, onclick: () => { repick(C, b, () => { b.star = b.star === v ? '' : v }); rr() } }, (b.star === v ? '★ ' : '☆ ') + v))))
    })) : h('p', { class: 'muted' }, 'Go back and add some ideas first.'),
    addRow(ctx, 'cp-idea2', 'Add another idea', v => { if (!C.ideas.includes(v) && C.ideas.length < 30) C.ideas.push(v); save(ctx) }),
    h('button', { class: 'link-btn blue', type: 'button', onclick: () => ctx.askCoach('clarity', 'I’m choosing between some career ideas and I’d like help thinking it through. ') }, 'Stuck? Talk it through with the Clarity Compass coach')]
}

function needsLine(n) {
  const parts = [n.pay ? `at least $${Number(n.pay).toLocaleString('en-AU')} a year` : '', n.hours ? `up to ${n.hours} hours a week` : '', n.stress ? `${n.stress.toLowerCase()} stress` : '', n.mode ? n.mode.toLowerCase() : '', n.location].filter(Boolean)
  return parts.join(', ') + (n.other ? `. ${n.other}` : '')
}
function summary(ctx, C, go) {
  const sorted = syncBoard(C)
  const ideaLine = b => `${itemName(b)}${isGroup(b) ? ` (${b.ideas.join(', ')})` : ''}${b.when ? `, ${whenLabel(b.when).toLowerCase()}` : ''}`
  const P = C.plan
  const stages = [['Now', P.now], ['Building', P.building], ['The move', P.move], ['Longer term', P.longer]].filter(([, v]) => v.trim())
  const firstSteps = C.actions.filter(a => a.trim())
  const text = [
    `My values: ${C.values.join(', ')}`, `I am: ${C.iAm.join('; ')}`, `My North Star: ${C.north}`,
    `What I need from work: ${needsLine(C.needs)}`,
    sorted.length ? `My ideas, most alive first: ${sorted.map(ideaLine).join('; ')}` : '',
    `Direction: ${C.first}${C.second ? ` (second: ${C.second})` : ''}`,
    ...stages.map(([l, v]) => `${l}: ${v}`),
    `First steps: ${firstSteps.join('; ')}`
  ].filter(Boolean).join('\n\n')
  // Each part links back to the step where it was made.
  const edit = (n, what) => h('button', { class: 'link-btn blue', type: 'button', 'aria-label': `Change ${what}`, onclick: () => go(n) }, 'Change')
  const part = (label, n, content) => [h('dt', {}, label, ' ', edit(n, label.toLowerCase())), h('dd', {}, content)]
  return h('div', { class: 'card summary' }, h('span', { class: 'label' }, 'Your Compass'),
    h('dl', { class: 'kv' },
      part('Values', 0, C.values.slice(0, 5).join(', ')),
      part('I am', 1, C.iAm.slice(0, 3).join('; ')),
      part('North Star', 2, C.north || '—'),
      part('I need', 3, needsLine(C.needs) || '—'),
      sorted.length > 0 && part('My ideas', 6, h('ol', { class: 'sum-list' }, sorted.map(b => h('li', {}, ideaLine(b))))),
      part('Direction', 7, [h('b', {}, C.first || '—'), C.second ? h('span', { class: 'small muted' }, ` Second: ${C.second}`) : null]),
      part('My plan', 8, stages.length ? h('ul', { class: 'sum-list' }, stages.map(([l, v]) => h('li', {}, h('b', {}, l + ': '), v))) : '—'),
      part('First steps', 9, firstSteps.length ? h('ul', { class: 'sum-list' }, firstSteps.map(a => h('li', {}, a))) : '—')),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: e => copyText(text, e.currentTarget) }, 'Copy my Compass'),
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = 'my-compass.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) } }, 'Download as text')),
    h('p', { class: 'small muted' }, 'Sky knows your direction and values. If you book a session with a human coach, bring this along.'))
}
