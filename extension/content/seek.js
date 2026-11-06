// Seek: read the job page, then follow Quick Apply step by step. The helper fills and
// attaches; the member reads and presses Apply. Nothing here clicks a button.
;(function () {
  const F = globalThis.NPForms
  if (!F || globalThis.__npSeek) return
  globalThis.__npSeek = true

  const q = (sel, root = document) => root.querySelector(sel)
  const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const jobId = () => (location.pathname.match(/\/job\/(\d+)/) || [])[1] || ''

  // Landmarks, most stable first. Seek's data-automation attributes change less than its classes.
  function readJob() {
    const title = text(q('[data-automation="job-detail-title"]') || q('h1'))
    const company = text(q('[data-automation="advertiser-name"]') || q('[data-automation="job-detail-advertiser"]'))
    const loc = text(q('[data-automation="job-detail-location"]'))
    const salary = text(q('[data-automation="job-detail-salary"]'))
    const body = q('[data-automation="jobAdDetails"]') || q('main')
    return { title, company, location: loc, salary, text: text(body).slice(0, 12000), url: location.href.split('?')[0], board: 'seek', id: jobId() }
  }

  // Which step of Quick Apply is on screen, from what the page says, not where it says it.
  function step() {
    const p = location.pathname
    if (/\/apply\/success|\/success\b/.test(p) || /application (has been )?(sent|submitted)|you'?ve applied|thanks for applying/i.test(text(q('h1, h2')))) return 'done'
    if (!/\/apply/.test(p)) return jobId() ? 'job' : 'other'
    const h = F.norm(text(q('h1, h2')) + ' ' + text(q('[data-automation="step-heading"], legend')))
    if (/review|check your application|ready to send/.test(h)) return 'review'
    if (/question|employer|about you|a few questions/.test(h) || F.collectFields(document).some(f => !F.profileKey(f.label) && !/resume|cover/.test(f.key))) return 'questions'
    if (/cover letter/.test(h) || q('textarea[data-automation*="cover"], [data-automation*="coverLetter"]')) return 'cover'
    if (/resume|cv/.test(h) || F.fileInputs(document).length) return 'resume'
    return 'apply'
  }

  let last = ''
  function report() {
    const s = step()
    const page = { site: 'seek', step: s, job: readJob() }
    if (s === 'questions' || s === 'resume' || s === 'cover' || s === 'review') {
      const fields = F.collectFields(document)
      page.questions = F.questionsFrom(fields)
      page.profileFields = fields.filter(f => F.profileKey(f.label)).length
      page.fileInputs = F.fileInputs(document).length
      page.hasCoverBox = !!q('textarea')
    }
    const key = JSON.stringify([s, page.job.id, page.questions?.length, page.fileInputs])
    if (key === last) return
    last = key
    chrome.runtime.sendMessage({ type: 'page', page }).catch(() => {})
  }

  // Seek is a single-page app: the URL and the form change without a load. A content
  // script cannot see the page's pushState (isolated world), but every step change
  // redraws the DOM, so the observer is what follows Quick Apply; report() reads the
  // URL fresh each time.
  let t
  const schedule = () => { clearTimeout(t); t = setTimeout(report, 400) }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true })
  addEventListener('popstate', schedule)
  report()

  // Requests from the side panel.
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    const run = async () => {
      if (msg.type === 'fill') {
        const fields = F.collectFields(document)
        const profile = msg.profile ? F.fillProfile(fields, msg.profile) : 0
        const { filled, left } = msg.answers ? F.fillAnswers(fields, msg.answers) : { filled: [], left: [] }
        return { profile, filled, left, fields: fields.length }
      }
      if (msg.type === 'attach') {
        const inputs = F.fileInputs(document)
        const input = inputs[msg.which === 'cover' ? Math.min(1, inputs.length - 1) : 0]
        if (!input) return { ok: false, error: 'No file box on this step. Choose "Upload" on the page first.' }
        const bytes = Uint8Array.from(atob(msg.b64), c => c.charCodeAt(0))
        return { ok: F.attachFile(input, bytes, msg.name, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') }
      }
      if (msg.type === 'paste-cover') {
        const box = q('textarea[data-automation*="cover"], [data-automation*="coverLetter"] textarea') || [...document.querySelectorAll('textarea')].find(t => /cover/i.test(F.fieldLabel(t)))
        if (!box) return { ok: false, error: 'No cover letter box on this step. Choose "Write a cover letter" on the page first.' }
        return { ok: F.fillField({ el: box, kind: 'textarea', label: 'cover' }, msg.text) }
      }
      if (msg.type === 'read') { last = ''; report(); return { ok: true } }
      return { error: 'Unknown request' }
    }
    run().then(reply).catch(err => reply({ error: err.message }))
    return true
  })
})()
