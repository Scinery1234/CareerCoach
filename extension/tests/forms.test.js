// The form logic against saved pages, in a small DOM. When Seek or Indeed change their
// markup, these fail before a member finds out. The fixtures are hand-written from the
// public shape of each form; refresh them from a real page when one changes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import vm from 'node:vm'
import { parseHTML } from 'linkedom'

const here = new URL('.', import.meta.url)
const read = f => readFileSync(new URL(f, here), 'utf8')
const src = { forms: readFileSync(new URL('../content/forms.js', here), 'utf8'), capture: readFileSync(new URL('../content/capture.js', here), 'utf8') }

// Load a content script into a page the way the browser would: a plain script with the page's globals.
function load(html, url, scripts) {
  const dom = parseHTML(html)
  const { window, document } = dom
  const { HTMLElement } = window
  // The things the scripts reach for that linkedom does not define.
  window.getComputedStyle = () => ({ display: 'block', visibility: 'visible' })
  window.CSS = { escape: s => s.replace(/([^\w-])/g, '\\$1') }
  class DataTransfer { constructor() { this.items = { add: f => this.files.push(f) }; this.files = [] } }
  window.DataTransfer = DataTransfer
  window.File = class File { constructor(parts, name, opts) { this.parts = parts; this.name = name; this.type = opts?.type || '' } }
  window.location = new URL(url)
  const sent = []
  const ctx = { window, document, location: window.location, URL, history: { pushState() {}, replaceState() {} }, addEventListener() {}, setTimeout, clearTimeout, atob: s => Buffer.from(s, 'base64').toString('binary'), Uint8Array, Event: window.Event, MutationObserver: class { observe() {} }, console, HTMLElement, chrome: { runtime: { sendMessage: m => { sent.push(m); return Promise.resolve() }, onMessage: { addListener() {} } } } }
  ctx.globalThis = ctx
  Object.defineProperty(ctx, 'CSS', { value: window.CSS })
  vm.createContext(ctx)
  for (const s of scripts) vm.runInContext(src[s], ctx)
  // file inputs: linkedom does not implement .files; give the attach test somewhere to land
  for (const i of document.querySelectorAll('input[type="file"]')) Object.defineProperty(i, 'files', { writable: true, value: [] })
  return { window, document, F: ctx.NPForms, C: ctx.NPCapture, sent }
}

test('the Seek questions step: every field is found, labels come from the right place', () => {
  const { document, F } = load(read('fixtures/seek-questions.html'), 'https://www.seek.com.au/job/81234567/apply', ['forms'])
  const fields = F.collectFields(document)
  const labels = Array.from(fields, f => f.label) // Array.from: the sandbox's arrays are from another realm
  assert.deepEqual(labels, [
    'First name', 'Last name', 'Email address', 'Mobile phone',
    'Which of the following statements best describes your right to work in Australia?',
    "Do you have a current driver's licence?",
    'What is your notice period?',
    'Which of the following Certificate III qualifications do you hold?',
    'Tell us about a time you supported a resident through a difficult day.'
  ])
  assert.equal(fields.find(f => f.label.startsWith('Which of the following statements')).options.length, 3)
  assert.deepEqual(Array.from(fields.find(f => f.label.startsWith('What is your notice')).options), ['Available immediately', '1 week', '2 weeks', '4 weeks'])
  assert.ok(!labels.some(l => /token/i.test(l)), 'hidden inputs are not fields')
  assert.deepEqual(Array.from(fields.filter(f => F.profileKey(f.label)), f => F.profileKey(f.label)), ['firstName', 'lastName', 'email', 'phone'])
  assert.equal(F.questionsFrom(fields).length, 5)
  assert.deepEqual(Array.from(F.questionsFrom(fields)[0].options), ["I'm an Australian citizen", "I'm a permanent resident", 'I require sponsorship to work for a new employer'])
})

test('filling: contact details, a radio by option text, a select by option text, a textarea; unknown answers are left', () => {
  const { document, F } = load(read('fixtures/seek-questions.html'), 'https://www.seek.com.au/job/81234567/apply', ['forms'])
  const fields = F.collectFields(document)
  assert.equal(F.fillProfile(fields, { name: 'Sam Lee', contact: { email: 'sam@example.com', phone: '0400 000 000', location: 'Geelong' } }), 4)
  assert.equal(document.getElementById('q-first').value, 'Sam')
  assert.equal(document.getElementById('q-last').value, 'Lee')
  assert.equal(document.getElementById('q-phone').value, '0400 000 000')
  const r = F.fillAnswers(fields, [
    { question: 'Which of the following statements best describes your right to work in Australia?', answer: "I'm an Australian citizen", source: 'standard' },
    { question: "Do you have a current driver's licence?", answer: 'Yes', source: 'standard' },
    { question: 'What is your notice period?', answer: '2 weeks', source: 'standard' },
    { question: 'Tell us about a time you supported a resident through a difficult day.', answer: 'One morning a resident refused breakfast...', source: 'drafted' },
    { question: 'Which of the following Certificate III qualifications do you hold?', answer: '', source: 'ask', note: 'Needs your own answer.' }
  ])
  assert.equal(r.filled.length, 4)
  assert.equal(r.left.length, 1)
  assert.equal(document.querySelector('input[name="rtw"][value="citizen"]').checked, true)
  assert.equal(document.querySelector('input[name="licence"][value="yes"]').checked, true)
  assert.equal(document.querySelector('#q-notice option[selected]')?.value, '2w')
  assert.match(document.getElementById('q-story').value, /^One morning/)
  assert.equal(document.getElementById('q-cert').value, '')
})

test('the form logic never clicks: no .click() anywhere in the content scripts, and submit-like buttons are recognised', () => {
  const dir = new URL('../content/', here)
  for (const f of readdirSync(dir)) {
    const s = readFileSync(new URL(f, dir), 'utf8')
    assert.ok(!/\.click\(/.test(s), `${f} must not click anything`)
    assert.ok(!/\.submit\(/.test(s), `${f} must not submit a form`)
    assert.ok(!/requestSubmit/.test(s), `${f} must not submit a form`)
  }
  const { document, F } = load(read('fixtures/seek-questions.html'), 'https://www.seek.com.au/job/81234567/apply', ['forms'])
  assert.equal(F.isSubmitLike(document.querySelector('button[type="submit"]')), true)
  assert.equal(F.isSubmitLike(document.querySelector('[data-automation="continue-button"]')), true)
  assert.equal(F.isSubmitLike(document.querySelector('label')), false)
})

test('the Seek results page: visible cards become listings, a card with no link is skipped, links are made absolute', () => {
  const { C } = load(read('fixtures/seek-results.html'), 'https://www.seek.com.au/aged-care-worker-jobs/in-Geelong-VIC', ['forms', 'capture'])
  assert.ok(C.isResults())
  const rows = C.READERS.seek().filter(Boolean)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].title, 'Aged Care Worker - Residential')
  assert.equal(rows[0].company, 'Harbour Aged Care')
  assert.equal(rows[0].url, 'https://www.seek.com.au/job/81234567?type=standard')
  assert.equal(rows[0].salary, '$58,000 - $64,000')
  assert.equal(rows[1].url, 'https://www.seek.com.au/job/81234568?type=promoted')
})

test('capture does not fetch and does not paginate', () => {
  assert.ok(!/fetch\(/.test(src.capture))
  assert.ok(!/window\.open|location\.(href|assign)\s*=/.test(src.capture))
  assert.ok(!/fetch\(/.test(src.forms))
})

test('the manifest asks for the boards and the app only, and the app is the only pairing sender', () => {
  const m = JSON.parse(read('../manifest.json'))
  assert.equal(m.manifest_version, 3)
  for (const hp of m.host_permissions) assert.match(hp, /^https:\/\/(www\.seek\.com\.au|www\.seek\.co\.nz|au\.indeed\.com|www\.indeed\.com|au\.jora\.com|aicareercoach\.net)\/\*$/, hp)
  assert.ok(!m.host_permissions.some(h => h.includes('<all_urls>')))
  assert.deepEqual(m.externally_connectable.matches, ['https://aicareercoach.net/*'])
  assert.ok(!m.permissions.includes('tabs') && !m.permissions.includes('webRequest') && !m.permissions.includes('scripting'))
  for (const cs of m.content_scripts) assert.equal(cs.js[0], 'content/forms.js', 'the shared logic loads first')
})
