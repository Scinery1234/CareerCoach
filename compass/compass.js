// The Compass landing page: the two-minute bearing quiz, scored in the browser with the same
// logic the server uses (quiz-logic.js), a dial that moves as you answer, and a taste of step one.
import { buildQuestions, validateAnswers, score, planTweaks, QUADRANTS, STATEMENTS } from '/quiz-logic.js'

const $ = id => document.getElementById(id)
const h = (tag, props = {}, ...kids) => {
  const el = Object.assign(document.createElement(tag), props)
  el.append(...kids.filter(k => k != null && k !== false))
  return el
}
const track = (name, params) => { try { window.track?.(name, params) } catch {} }
const KEY = 'compass_bearing'
const load = () => { try { return validateAnswers(JSON.parse(localStorage.getItem(KEY))) } catch { return null } }
const store = a => { try { a ? localStorage.setItem(KEY, JSON.stringify(a)) : localStorage.removeItem(KEY) } catch {} }

const S = { i: 0, answers: {} }
const dial = $('dial')

// ── The dial ─────────────────────────────────────────────────────
const NS = 'http://www.w3.org/2000/svg'
const ticks = $('ticks')
for (let i = 0; i < 60; i++) {
  const big = i % 5 === 0
  const l = document.createElementNS(NS, 'line')
  l.setAttribute('x1', 0); l.setAttribute('x2', 0); l.setAttribute('y1', -91); l.setAttribute('y2', big ? -83 : -86)
  l.setAttribute('transform', `rotate(${i * 6})`)
  if (big) l.classList.add('big')
  ticks.append(l)
}
// Where the answers so far point. Unanswered statements count as the middle of the scale.
function bearing(answers) {
  let clarity = 0, capacity = 0, n = 0
  for (const s of STATEMENTS) {
    const v = answers[s.key]
    if (v) n++
    const pts = v ? (s.reverse ? 5 - v : v) : 2.5
    if (s.axis === 'clarity') clarity += pts; else capacity += pts
  }
  return { dx: (capacity - 10) / 6, dy: (clarity - 10) / 6, n }
}
function pointNeedle(answers) {
  const { dx, dy, n } = bearing(answers)
  const still = n === 0 || Math.abs(dx) + Math.abs(dy) < 0.05
  dial.classList.toggle('seeking', still)
  if (!still) dial.style.setProperty('--deg', (Math.atan2(dx, dy) * 180 / Math.PI).toFixed(1) + 'deg')
}
function lightTicks(frac) {
  const lit = Math.round(frac * 60)
  ;[...ticks.children].forEach((l, i) => l.classList.toggle('lit', i < lit))
}

const VIEWS = ['intro', 'quiz', 'result', 'intake', 'offer']
// ── Views ────────────────────────────────────────────────────────
function show(view) {
  for (const id of VIEWS) $(id).hidden = id !== view
  document.body.classList.toggle('quizzing', view === 'quiz')
  document.body.classList.toggle('done', ['result', 'intake', 'offer'].includes(view))
  document.body.classList.toggle('asking', view === 'intake' || view === 'offer')
  if (view === 'intro' || view === 'quiz') {
    document.body.classList.remove('nosell')
    $('dot').toggleAttribute('hidden', true)
    document.querySelectorAll('#wedges .me, #names .me').forEach(e => e.classList.remove('me'))
    $('dial-cap').textContent = 'The needle settles as you answer.'
  }
  setSticky()
}
function toTop() { window.scrollTo({ top: 0, behavior: 'instant' }) }

// ── The quiz ─────────────────────────────────────────────────────
function startQuiz() {
  S.i = 0; S.answers = {}
  track('quiz_start')
  show('quiz'); renderQuestion(); toTop()
}
function renderQuestion(focus = true) {
  const qs = buildQuestions(S.answers)
  const q = qs[S.i]
  $('count').textContent = `${S.i + 1} of ${qs.length}`
  $('bar').style.width = (S.i / qs.length * 100) + '%'
  $('back').disabled = S.i === 0
  $('q-section').textContent = q.section
  $('q-prompt').textContent = q.prompt
  $('q-text').textContent = q.text
  $('opts').replaceChildren(...q.opts.map((o, n) => {
    const b = h('button', { type: 'button', className: 'opt' + (S.answers[q.key] === o.v ? ' on' : '') }, h('kbd', { ariaHidden: 'true' }, String(n + 1)), o.l)
    b.setAttribute('aria-pressed', String(S.answers[q.key] === o.v))
    b.onclick = () => choose(q, o.v, b)
    return b
  }))
  pointNeedle(S.answers); lightTicks(S.i / qs.length)
  if (focus) $('q-text').focus({ preventScroll: true })
}
let advancing = false
function choose(q, v, btn) {
  if (advancing) return
  S.answers[q.key] = v
  // The job-satisfaction question only belongs to some situations.
  if (q.key === 'sit') delete S.answers.sat
  $('opts').querySelectorAll('.opt').forEach(b => { b.classList.toggle('on', b === btn); b.setAttribute('aria-pressed', String(b === btn)) })
  pointNeedle(S.answers)
  advancing = true
  setTimeout(() => {
    advancing = false
    const qs = buildQuestions(S.answers)
    if (S.i + 1 < qs.length) { S.i++; renderQuestion() } else finish()
  }, 260)
}
$('back').onclick = () => { if (S.i > 0) { S.i--; renderQuestion() } }
document.addEventListener('keydown', e => {
  if ($('quiz').hidden || e.metaKey || e.ctrlKey || e.altKey) return
  const n = Number(e.key)
  const btn = n >= 1 && $('opts').children[n - 1]
  if (btn) { e.preventDefault(); btn.click() }
})

function finish() {
  const answers = validateAnswers(S.answers)
  if (!answers) return startQuiz()
  store(answers)
  const r = score(answers)
  track('quiz_done', { quadrant: r.quadrant })
  renderResult(answers, r)
  toTop()
}

// ── The result ───────────────────────────────────────────────────
// The quarter names are verbs, so the headline uses them as verbs: "It's time to explore."
const DO = { recharge: 'recharge', explore: 'explore', unstick: 'get unstuck', launch: 'launch' }
function renderResult(answers, r = score(answers)) {
  const Q = QUADRANTS[r.quadrant]
  document.documentElement.style.setProperty('--q', Q.color)
  document.body.classList.toggle('nosell', r.struggling)
  const tweaks = planTweaks(answers, {}, r)
  const compassWeek = Q.weeks.findIndex(w => w.tool === 'compass') + 1

  const support = (r.struggling || r.lowMood) && h('div', { className: 'panel support' },
    h('h3', {}, r.struggling ? 'First, this' : 'One thing first'),
    h('p', {}, r.struggling
      ? 'Thank you for saying so. Careers can wait. If things feel like too much, please talk to someone today: call your local emergency number, or find a free helpline near you at '
      : 'It sounds like it’s been a heavy couple of weeks. If that goes on, it’s worth talking to your doctor or a counsellor. You can find a free helpline near you at ',
    h('a', { href: 'https://findahelpline.com' }, 'findahelpline.com'), '.'),
    r.struggling && h('p', {}, 'Your result is below for when you want it. There’s no rush, and nothing here to buy.'))

  $('result').replaceChildren(...[
    r.struggling && support,
    h('p', { className: 'eyebrow' }, 'Your bearing, right now'),
    h('h2', { tabIndex: -1, id: 'r-head' }, 'It’s time to ', h('em', {}, DO[r.quadrant]), '.'),
    h('p', { className: 'tag' }, Q.tag),
    h('p', { className: 'lead' }, Q.meaning),
    !r.struggling && support,
    h('div', { className: 'panel week' }, h('h3', {}, 'Your one step this week'), h('p', {}, Q.week1)),
    tweaks.length > 0 && h('div', { className: 'panel' }, h('h3', {}, 'Because of what you told us'), h('ul', {}, ...tweaks.map(t => h('li', {}, t)))),
    h('div', { className: 'panel' }, h('h3', {}, 'The four weeks from here'),
      h('ol', { className: 'weeks' }, ...Q.weeks.map((w, i) => h('li', {}, h('b', {}, w.title, i + 1 === compassWeek && h('i', {}, 'The Compass')), h('span', {}, w.why))))),
    h('div', { className: 'panel sell' },
      h('h3', {}, 'Where the Compass comes in'),
      h('p', {}, compassWeek
        ? `On this plan, the Compass comes in week ${compassWeek}: ten short steps from your values to a direction and three first steps. You can start it tonight, and it remembers where you’re at.`
        : 'The Compass is ten short steps from your values to a direction and three first steps.'),
      h('div', { className: 'cta-row' },
        h('button', { type: 'button', className: 'btn btn-north', onclick: () => startIntake(answers, r) }, 'Shape it around me'),
        cta('/demo', 'btn btn-ghost', 'demo', 'Talk to Sky first, no sign-up')),
      h('p', { className: 'fine' }, 'About six quick questions, written for you as you answer. Still no sign-up.')),
    h('p', { className: 'fine' }, 'This is where you are right now, not a label. It moves, so come back in a few weeks.'),
    h('button', { type: 'button', className: 'linkbtn', onclick: () => { store(null); startQuiz() } }, 'Take it again')
  ].filter(Boolean))

  show('result')
  // The dot lands on the dial: clarity runs up, energy runs right.
  dial.classList.remove('seeking')
  const dx = r.x - 50, dy = r.y - 50
  dial.style.setProperty('--deg', (Math.atan2(dx || .01, dy || .01) * 180 / Math.PI).toFixed(1) + 'deg')
  dial.style.setProperty('--px', (dx / 50 * 56).toFixed(1) + 'px')
  dial.style.setProperty('--py', (-dy / 50 * 56).toFixed(1) + 'px')
  $('dot').toggleAttribute('hidden', false)
  lightTicks(1)
  document.querySelectorAll('#wedges path, #names text').forEach(e => e.classList.toggle('me', e.dataset.q === r.quadrant))
  dial.setAttribute('aria-label', `Your bearing: ${Q.name}. Clarity ${r.y} out of 100, energy ${r.x} out of 100.`)
  $('dial-cap').textContent = 'Clarity runs up. Energy runs right.'
  $('r-head').focus({ preventScroll: true })
}
function cta(href, className, ev, trial, noTrial) {
  const a = h('a', { href, className })
  a.dataset.track = ev; a.dataset.place = 'compass-result'
  if (noTrial) a.append(h('span', { className: 't7' }, trial), h('span', { className: 't0' }, noTrial)); else a.append(trial)
  return a
}

// ── The questions written for you ────────────────────────────────
async function api(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { code: data.code, status: res.status })
  return data
}
const I = { quadrant: '', sit: '', turns: [], goal: '', busy: false }
const mark = () => { const d = h('span', { className: 'guide', ariaHidden: 'true' }); d.innerHTML = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 4.5l3.4 11.5L16 27.5 12.6 16z" fill="currentColor" opacity=".28"/><path d="M16 4.5L19.4 16h-6.8z" fill="#FF7A45"/></svg>'; return d }
const says = (text, id) => h('div', { className: 'says' }, mark(), h('h2', { className: 'bubble', tabIndex: -1, id }, text))

function startIntake(answers, r) {
  Object.assign(I, { quadrant: r.quadrant, sit: answers.sit, turns: [], goal: '', busy: false })
  track('intake_start', { quadrant: r.quadrant })
  show('intake'); nextQuestion(); toTop()
}
async function nextQuestion() {
  if (I.busy) return
  I.busy = true
  const box = $('intake')
  const bar = h('div', { className: 'bar' }, h('i', { style: `width:${Math.min(100, I.turns.length / 7 * 100)}%` }))
  const top = h('div', { className: 'q-top' },
    h('button', { type: 'button', className: 'back', onclick: () => { if (I.busy) return; if (I.turns.length) { I.turns.pop(); nextQuestion() } else show('result') } }, '← Back'),
    h('span', { className: 'count' }, I.turns.length ? `${I.turns.length} answered` : ''))
  box.replaceChildren(top, bar, says('One moment…', 'i-q'))
  box.querySelector('.bubble').classList.add('thinking')
  let step
  try { step = await api('/api/newpage/demo', { action: 'intake', quadrant: I.quadrant, sit: I.sit, turns: I.turns }) } catch (e) {
    I.busy = false
    // No questions on this site (or they are switched off): the page still leads somewhere.
    if (!I.turns.length && e.status !== 429) { location.href = '/join'; return }
    box.replaceChildren(top, bar, says(e.message, 'i-q'), h('button', { type: 'button', className: 'btn btn-ghost', onclick: nextQuestion }, 'Try again'))
    return
  }
  I.busy = false
  if (step.support) {
    document.body.classList.add('nosell'); setSticky()
    box.replaceChildren(h('div', { className: 'panel support' }, h('h3', {}, 'First, this'),
      h('p', {}, 'Thank you for saying so. Careers can wait. If things feel like too much, please talk to someone today: call your local emergency number, or find a free helpline near you at ', h('a', { href: 'https://findahelpline.com' }, 'findahelpline.com'), '.'),
      h('p', {}, 'Your result will be here when you want it. There’s no rush, and nothing here to buy.')),
    h('button', { type: 'button', className: 'linkbtn', onclick: () => show('result') }, 'Back to my result'))
    return
  }
  if (step.done) { I.goal = step.goal; track('intake_done'); renderOffer(); return }
  const answer = a => { a = String(a || '').trim(); if (!a || I.busy) return; I.turns.push({ q: step.question, a }); nextQuestion() }
  const other = h('input', { type: 'text', className: 'other', placeholder: 'Something else', maxLength: 240, ariaLabel: 'Something else: type your own answer' })
  const form = h('form', { className: 'other-row', onsubmit: e => { e.preventDefault(); answer(other.value) } }, other, h('button', { type: 'submit', className: 'send', ariaLabel: 'Send my answer' }, '→'))
  box.replaceChildren(top, bar, says(step.question, 'i-q'),
    h('div', { className: 'opts', role: 'group', ariaLabel: step.question }, ...step.options.map((o, n) =>
      h('button', { type: 'button', className: 'opt two', onclick: () => answer(o.label) }, h('kbd', { ariaHidden: 'true' }, String(n + 1)), h('span', {}, h('b', {}, o.label), o.sub && h('small', {}, o.sub))))),
    form)
  if (scrollY > 80) toTop()
  $('i-q').focus({ preventScroll: true })
}
document.addEventListener('keydown', e => {
  if ($('intake').hidden || e.metaKey || e.ctrlKey || e.altKey || e.target.matches?.('input, textarea')) return
  const btn = Number(e.key) >= 1 && $('intake').querySelectorAll('.opt')[Number(e.key) - 1]
  if (btn) { e.preventDefault(); btn.click() }
})

// ── The offer, under their own goal ──────────────────────────────
function renderOffer() {
  const name = h('input', { type: 'text', id: 'o-name', autocomplete: 'given-name', required: true, maxLength: 80 })
  const email = h('input', { type: 'email', id: 'o-email', autocomplete: 'email', required: true, maxLength: 200 })
  const trap = h('input', { type: 'text', name: 'website', tabIndex: -1, autocomplete: 'off', className: 'trap', ariaHidden: 'true' })
  const err = h('p', { className: 'err', role: 'alert', hidden: true })
  const go = h('button', { type: 'submit', className: 'btn btn-north' }, h('span', { className: 't7' }, 'Try for $0'), h('span', { className: 't0' }, 'Start for $25 a month'))
  const form = h('form', { className: 'join', noValidate: true },
    h('label', { htmlFor: 'o-name' }, 'Your first name'), name,
    h('label', { htmlFor: 'o-email' }, 'Your email'), email, trap, err, go,
    h('p', { className: 'fine' }, h('span', { className: 't7' }, 'Card details on the next page, nothing charged today. Then $25 a month until you cancel, in two taps from the app. '), h('span', { className: 't0' }, 'Pay by card on the next page. $25 a month until you cancel, in two taps from the app. '), 'Australian dollars. Sky is an AI. Coaching, not therapy. For people 18 and over.'))
  form.onsubmit = async e => {
    e.preventDefault(); err.hidden = true
    const fail = (m, el) => { err.textContent = m; err.hidden = false; el?.focus() }
    if (!name.value.trim()) return fail('Add your name.', name)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return fail('Add the email you want to use.', email)
    go.disabled = true
    track('cta', { place: 'compass-offer' })
    try {
      // The answers become Sky's notes on a 24-hour member, which the free week then keeps.
      const kept = await api('/api/newpage/demo', { action: 'intake_keep', quadrant: I.quadrant, sit: I.sit, turns: I.turns, goal: I.goal, website: trap.value }).catch(() => null)
      if (kept?.session) { try { if (!localStorage.getItem('np_app_session')) localStorage.setItem('np_app_session', kept.session) } catch {} }
      const d = await api('/api/newpage/checkout', { action: 'start', plan: 'tools', name: name.value.trim(), email: email.value.trim(), website: trap.value, ...(kept?.session ? { demo: kept.session } : {}) })
      if (!d.url) throw new Error('Something went wrong. Please try again.')
      location.href = d.url
    } catch (ex) { go.disabled = false; fail(ex.message) }
  }
  $('offer').replaceChildren(
    h('p', { className: 'eyebrow' }, 'Your goal, in your words'),
    h('h2', { className: 'goal', tabIndex: -1, id: 'o-head' }, h('em', {}, I.goal), '.'),
    h('h3', { className: 'offer-h' }, h('span', { className: 't7' }, 'Try the Compass free for 7 days, built around that.'), h('span', { className: 't0' }, 'Start the Compass, built around that.')),
    h('ul', { className: 'unlocks' },
      h('li', {}, h('b', {}, 'The Compass'), 'Ten short steps from your values to a direction and three first steps.'),
      h('li', {}, h('b', {}, 'Sky, your AI coach'), 'Starts from the answers you just gave, so you don’t explain it twice.'),
      h('li', {}, h('b', {}, 'A Career Direction Report'), 'Everything you find, on one page.')),
    h('div', { className: 'panel remind t7' }, h('h3', {}, 'No surprises'), h('p', {}, 'We email you three days before your free week ends. Cancel in two taps and you’re never charged.')),
    h('div', { className: 'plan' }, h('b', {}, 'Compass membership'), h('span', {}, '$25 a month', h('span', { className: 't7' }, ' after 7 days free'))),
    form,
    h('button', { type: 'button', className: 'linkbtn', onclick: () => { I.turns = []; show('intake'); nextQuestion() } }, 'Change my answers'))
  show('offer'); toTop()
  $('o-head').focus({ preventScroll: true })
}

// ── Sticky bar (phones) ──────────────────────────────────────────
function setSticky() {
  const done = document.body.classList.contains('done'), nosell = document.body.classList.contains('nosell')
  $('sticky').hidden = done && nosell
  $('sticky-text').textContent = done ? 'Next: the Compass' : '2 minutes · no sign-up'
  $('sticky-btn').textContent = done ? 'Start the Compass' : 'Find my bearing'
  $('sticky-btn').onclick = done ? () => { track('cta', { place: 'compass-sticky' }); location.href = '/join' } : startQuiz
}
new IntersectionObserver(e => $('sticky').classList.toggle('on', !e[0].isIntersecting), { threshold: 0 }).observe(document.querySelector('.hero'))

// ── The ten steps ────────────────────────────────────────────────
const STEPS = [
  ['Values', 'Choose the five that matter most, and put them in order.'],
  ['Who I am', 'Three “I am” statements about the whole of you.'],
  ['North Star', 'An ordinary week with your first value fully lived.'],
  ['What I need', 'Hours, stress, place, pay: what work has to leave room for.'],
  ['Strengths', 'What you know, what you do well and what you love.'],
  ['Mix ideas', 'Ideas built by combining your strengths in threes.'],
  ['Choose', 'Hold each idea against your North Star and pick one to test.'],
  ['Plan', 'What would need to be true, and what’s in the way.'],
  ['First steps', 'Three steps small enough to start this week.'],
  ['Calendar', 'Dates on each one, sent to your planner.']
]
$('trail').append(...STEPS.map(([t, d], i) => h('li', {}, h('span', {}, String(i + 1).padStart(2, '0')), h('b', {}, t), h('p', {}, d))))

// ── Try step one ─────────────────────────────────────────────────
const VALUES = ['Adventure', 'Balance', 'Belonging', 'Calm', 'Care', 'Creativity', 'Curiosity', 'Fairness', 'Family', 'Freedom', 'Fun', 'Growth', 'Honesty', 'Independence', 'Learning', 'Making a difference', 'Money', 'Nature', 'Purpose', 'Security', 'Stability', 'Teamwork']
const picked = new Set()
$('chips').append(...VALUES.map(v => {
  const b = h('button', { type: 'button', className: 'chip' }, v)
  b.setAttribute('aria-pressed', 'false')
  b.onclick = () => {
    if (picked.has(v)) picked.delete(v); else if (picked.size < 5) picked.add(v); else return
    b.setAttribute('aria-pressed', String(picked.has(v)))
    const full = picked.size === 5
    $('tally').textContent = full ? [...picked].join(' · ') : `${picked.size} of 5 chosen`
    $('chips').classList.toggle('full', full)
    if (full && $('try-done').hidden) track('values_picked')
    $('try-done').hidden = !full
  }
  return b
}))

// ── Start ────────────────────────────────────────────────────────
document.querySelectorAll('#start, [data-start]').forEach(b => b.addEventListener('click', startQuiz))
const saved = load()
if (saved) { $('resume').hidden = false; $('resume').onclick = () => { renderResult(saved); toTop() } }
setSticky()
// If the trial is switched off on the server, the page says $25 a month instead.
fetch('/api/newpage/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"action":"quote"}' }).then(r => r.json()).then(q => { if (!q.trialDays) document.body.classList.add('notrial') }).catch(() => {})
