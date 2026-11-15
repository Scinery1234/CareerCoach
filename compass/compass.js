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

// ── Views ────────────────────────────────────────────────────────
function show(view) {
  for (const id of ['intro', 'quiz', 'result']) $(id).hidden = id !== view
  document.body.classList.toggle('quizzing', view === 'quiz')
  document.body.classList.toggle('done', view === 'result')
  if (view !== 'result') {
    document.body.classList.remove('nosell')
    $('dot').toggleAttribute('hidden', true)
    document.querySelectorAll('#wedges .me, #names .me').forEach(e => e.classList.remove('me'))
    $('dial-cap').textContent = 'The needle settles as you answer.'
  }
  setSticky()
}
function toTop() { $('top').scrollIntoView({ block: 'start' }) }

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
    h('h2', { tabIndex: -1, id: 'r-head' }, 'You’re in ', h('em', {}, Q.name), '.'),
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
        ? `From ${Q.name}, the Compass belongs in week ${compassWeek}: ten short steps from your values to a direction and three first steps. You can start it tonight, and it remembers where you’re at.`
        : 'The Compass is ten short steps from your values to a direction and three first steps.'),
      h('div', { className: 'cta-row' },
        cta('/join', 'btn btn-north', 'cta', 'Start the Compass, free for 7 days', 'Start the Compass for $25 a month'),
        cta('/demo', 'btn btn-ghost', 'demo', 'Talk to Sky first, no sign-up')),
      h('p', { className: 'fine t7' }, 'Nothing charged for 7 days, then $25 a month. Cancel in two taps.')),
    h('p', { className: 'fine' }, 'This is a place you’re in right now, not a label. It moves, so come back in a few weeks.'),
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

// ── Sticky bar (phones) ──────────────────────────────────────────
function setSticky() {
  const done = !$('result').hidden, nosell = document.body.classList.contains('nosell')
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
