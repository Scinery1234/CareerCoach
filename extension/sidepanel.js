// The side panel: what this page is, how well it fits, which documents to carry in,
// and the answers to read before pressing Apply on the page. The panel asks; the
// page's content script does the filling; the member does the submitting.
const APP = 'https://aicareercoach.net/app'
const S = { paired: false, profile: null, page: null, tabId: null, fit: null, docs: null, answers: null, fill: null, busy: '', err: '', note: '', resumeId: '', coverId: '', logged: null, fitFor: '' }

const h = (tag, attrs, ...kids) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v) } for (const kid of kids.flat(Infinity)) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))) } return el }
const bg = msg => chrome.runtime.sendMessage({ ...msg, tabId: S.tabId }).then(r => { if (r?.error) throw Object.assign(new Error(r.error), { code: r.code }); return r })
const toTab = payload => bg({ type: 'to-tab', payload })

async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  S.tabId = tab?.id ?? null
  const st = await bg({ type: 'state' })
  S.paired = st.paired; S.profile = st.profile; S.page = st.page
  const jobKey = S.page?.job?.url || ''
  if (jobKey !== S.fitFor) { S.fit = null; S.answers = null; S.fill = null; S.logged = null; S.fitFor = jobKey }
  render()
}

async function act(name, fn) {
  if (S.busy) return
  S.busy = name; S.err = ''; render()
  try { await fn() } catch (e) { S.err = e.code === 'unpaired' ? 'Not connected. Open the app, Tools, Applications, and connect this browser.' : e.message }
  S.busy = ''; render()
}

const docs = async () => { if (!S.docs) S.docs = (await bg({ type: 'docs' })).docs; return S.docs }
const pick = kind => (S.docs || []).filter(d => d.kind === kind)
const chosen = kind => (S.docs || []).find(d => d.id === (kind === 'resume' ? S.resumeId : S.coverId)) || pick(kind)[0]

function jobCard() {
  const j = S.page?.job
  if (!j?.title) return h('div', { class: 'card' }, h('span', { class: 'label' }, 'This page'), h('p', { class: 'muted small' }, 'Open a job on Seek or Indeed and the fit, your documents and your answers appear here.'))
  return h('div', { class: 'card' },
    h('span', { class: 'label' }, S.page.site === 'seek' ? 'Seek' : 'Indeed'),
    h('h1', {}, j.title), j.company && h('p', { class: 'muted' }, [j.company, j.location].filter(Boolean).join(' · ')),
    S.fit ? h('div', {}, h('p', {}, h('b', {}, S.fit.words + '. '), S.fit.fit.verdict),
      S.fit.fit.reasons?.length > 0 && h('ul', { class: 'small' }, S.fit.fit.reasons.map(r => h('li', {}, r))),
      S.fit.fit.concerns?.length > 0 && h('ul', { class: 'small muted' }, S.fit.fit.concerns.map(r => h('li', {}, r))))
      : h('button', { class: 'btn secondary', disabled: !!S.busy, onclick: () => act('fit', async () => { S.fit = await bg({ type: 'fit', job: j }) }) }, S.busy === 'fit' ? 'Reading the ad…' : 'How well does this fit me?'),
    h('div', { class: 'row' }, h('a', { class: 'link', href: `${APP}#tools`, target: '_blank', rel: 'noopener' }, 'Tailor my resume for this job in the app')))
}

function docsCard() {
  const step = S.page?.step
  if (!['resume', 'cover', 'questions', 'review', 'form', 'apply'].includes(step)) return null
  const r = chosen('resume'), c = chosen('cover')
  const attach = (kind, which) => act('attach', async () => {
    const d = chosen(kind); if (!d) throw new Error('No document chosen.')
    const f = await bg({ type: 'docx', doc: d })
    const res = await toTab({ type: 'attach', which, b64: f.b64, name: f.name })
    if (!res.ok) throw new Error(res.error || 'The page did not take the file.')
    S.note = `${d.title} is in the form. Check it on the page.`
  })
  return h('div', { class: 'card' },
    h('span', { class: 'label' }, 'Your documents'),
    !S.docs ? h('button', { class: 'btn secondary', disabled: !!S.busy, onclick: () => act('docs', docs) }, S.busy === 'docs' ? 'Loading…' : 'Load my resumes and letters')
      : [
        h('label', { class: 'small' }, 'Resume', h('select', { onchange: e => { S.resumeId = e.target.value } }, pick('resume').map(d => h('option', { value: d.id, selected: d.id === r?.id }, d.title)))),
        h('div', { class: 'row' },
          h('button', { class: 'btn', disabled: !!S.busy || !r || !S.page.fileInputs, onclick: () => attach('resume', 'resume') }, S.busy === 'attach' ? 'Attaching…' : 'Put my resume in the form'),
          !S.page.fileInputs && h('span', { class: 'small muted' }, 'Choose “Upload” on the page first.')),
        pick('cover').length > 0 && [
          h('label', { class: 'small' }, 'Cover letter', h('select', { onchange: e => { S.coverId = e.target.value } }, pick('cover').map(d => h('option', { value: d.id, selected: d.id === c?.id }, d.title)))),
          h('div', { class: 'row' },
            h('button', { class: 'btn secondary', disabled: !!S.busy || !c || !S.page.fileInputs, onclick: () => attach('cover', 'cover') }, 'Attach the letter as a file'),
            S.page.site === 'seek' && h('button', { class: 'btn secondary', disabled: !!S.busy || !c, onclick: () => act('paste', async () => { const res = await toTab({ type: 'paste-cover', text: (c.content.paragraphs || []).join('\n\n') }); if (!res.ok) throw new Error(res.error) ; S.note = 'The letter text is in the box.' }) }, 'Paste the letter text'))]
      ])
}

function answersCard() {
  const qs = S.page?.questions || []
  const step = S.page?.step
  if (!['questions', 'form', 'review', 'resume', 'cover', 'apply'].includes(step)) return null
  const run = () => act('answers', async () => {
    S.answers = await bg({ type: 'answers', questions: qs, job: S.page.job })
    S.fill = await toTab({ type: 'fill', profile: S.profile, answers: S.answers.answers })
    S.note = ''
  })
  return h('div', { class: 'card' },
    h('span', { class: 'label' }, 'Fill the form'),
    h('p', { class: 'small muted' }, `${S.page.profileFields || 0} contact field${S.page.profileFields === 1 ? '' : 's'} and ${qs.length} question${qs.length === 1 ? '' : 's'} on this step. Standard answers you wrote in the app go in first; the rest are drafted from your resume and marked for you to read.`),
    h('button', { class: 'btn', disabled: !!S.busy || (!qs.length && !S.page.profileFields), onclick: run }, S.busy === 'answers' ? 'Filling…' : S.fill ? 'Fill again' : 'Fill what you can'),
    S.fill && h('div', {},
      h('p', { class: 'small ok' }, `${S.fill.profile} contact field${S.fill.profile === 1 ? '' : 's'} and ${S.fill.filled.length} answer${S.fill.filled.length === 1 ? '' : 's'} filled.`),
      S.fill.degraded && h('p', { class: 'small err' }, 'This form hides most of its fields from the helper. Copy the answers below into the page.'),
      S.answers?.drafted === false && h('p', { class: 'small muted' }, S.answers.why || 'Drafting is off, so only your standard answers were used.'),
      S.fill.filled.map(f => h('div', { class: 'answer' }, h('b', {}, f.label), h('span', { class: 'small' }, f.answer), ' ', h('span', { class: 'pill' }, f.source === 'standard' ? 'yours' : 'drafted: read it'))),
      S.fill.left.map(f => h('div', { class: 'answer' }, h('b', {}, f.label), h('span', { class: 'small muted' }, f.note || 'Needs your own answer.'))),
      (S.answers?.answers || []).filter(a => a.source !== 'ask' && !S.fill.filled.some(f => f.label === a.question)).map(a => h('div', { class: 'answer' }, h('b', {}, a.question), h('textarea', { rows: 2, readonly: true }, a.answer), h('button', { class: 'link small', onclick: e => navigator.clipboard.writeText(a.answer).then(() => { e.target.textContent = 'Copied' }) }, 'Copy')))))
}

function statusCard() {
  const step = S.page?.step
  const msg = { job: 'Press Apply on the page when you are ready; the steps appear here.', resume: 'Choose your resume above, then continue on the page.', cover: 'Attach or paste the letter above, then continue on the page.', questions: 'Fill, then read every answer on the page before you continue.', form: 'Fill, read every answer on the page, then continue there. The helper never advances a step on Indeed.', review: 'Everything is filled. Check it on the page and press Submit there.', done: 'Sent. Logged for you below.' }[step]
  const logIt = () => act('log', async () => { const j = S.page.job; S.logged = await bg({ type: 'log', application: { title: j.title, company: j.company, url: j.url, board: j.board, resume_doc_id: chosen('resume')?.id, cover_doc_id: chosen('cover')?.id } }) })
  if (step === 'done' && !S.logged && !S.busy && S.page?.job?.title) logIt()
  return h('div', { class: 'card status' },
    msg && h('p', { class: 'small' }, msg),
    S.logged && h('p', { class: 'small ok' }, S.logged.duplicate ? 'Already in your applications.' : `Logged: ${S.logged.application.title}. Sky can see it if you want to talk it through.`),
    step !== 'done' && S.page?.job?.title && h('button', { class: 'link small', disabled: !!S.busy, onclick: logIt }, 'I applied another way, log it'),
    S.note && h('p', { class: 'small ok' }, S.note),
    S.err && h('p', { class: 'small err' }, S.err))
}

function render() {
  const root = document.getElementById('app')
  root.replaceChildren()
  if (!S.paired) {
    root.append(h('div', { class: 'card' }, h('h1', {}, 'Connect to your account'),
      h('p', { class: 'small' }, 'In the app, open Tools, Applications, and press “Connect this browser”. Your resumes, letters and standard answers then appear here on Seek and Indeed job pages.'),
      h('a', { class: 'btn', href: `${APP}#tools`, target: '_blank', rel: 'noopener' }, 'Open the app'),
      h('p', { class: 'small muted' }, 'The helper fills forms. You read and you press Submit. It never submits for you.')))
    return
  }
  root.append(jobCard(), docsCard(), answersCard(), statusCard(),
    h('p', { class: 'small muted' }, 'Connected as ', S.profile?.name || 'you', '. ', h('button', { class: 'link small', onclick: () => act('unpair', async () => { await bg({ type: 'unpair' }); S.paired = false }) }, 'Disconnect')))
}

chrome.runtime.onMessage.addListener(msg => { if (msg?.type === 'page-updated' && msg.tabId === S.tabId) refresh() })
chrome.tabs.onActivated.addListener(refresh)
chrome.tabs.onUpdated.addListener((id, info) => { if (id === S.tabId && info.status === 'complete') refresh() })
refresh()
