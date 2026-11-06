// Indeed: read the job page and fill what Indeed Apply asks, from the member's profile
// and standard answers. Indeed's terms allow only its own tooling to apply, so this
// adapter fills visible fields and stops: it never advances a step and never submits.
// When it can see fewer than half the fields it expects, it says so and the side panel
// offers the answers to copy instead.
;(function () {
  const F = globalThis.NPForms
  if (!F || globalThis.__npIndeed) return
  globalThis.__npIndeed = true

  const q = (sel, root = document) => root.querySelector(sel)
  const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '')

  function readJob() {
    const title = text(q('h1[data-testid="jobsearch-JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title, h1'))
    const company = text(q('[data-testid="inlineHeader-companyName"], [data-company-name], .jobsearch-InlineCompanyRating a'))
    const loc = text(q('[data-testid="inlineHeader-companyLocation"], [data-testid="job-location"]'))
    const salary = text(q('#salaryInfoAndJobType, [data-testid="attribute_snippet_testid"]'))
    const body = q('#jobDescriptionText') || q('main')
    return { title, company, location: loc, salary, text: text(body).slice(0, 12000), url: location.href.split('&')[0], board: 'indeed', id: new URL(location.href).searchParams.get('jk') || (location.pathname.match(/\/job\/[^/]+-([a-z0-9]+)$/) || [])[1] || '' }
  }

  function step() {
    const h = F.norm(text(q('h1, h2')))
    if (/application (has been )?(sent|submitted)|you'?ve applied|your application was sent/.test(h)) return 'done'
    if (/smartapply|\/apply/.test(location.hostname + location.pathname) || /apply/.test(location.pathname)) {
      if (/review/.test(h)) return 'review'
      return 'form'
    }
    return readJob().title ? 'job' : 'other'
  }

  let last = ''
  function report() {
    const s = step()
    const page = { site: 'indeed', step: s, job: readJob() }
    if (s === 'form' || s === 'review') {
      const fields = F.collectFields(document)
      page.questions = F.questionsFrom(fields)
      page.profileFields = fields.filter(f => F.profileKey(f.label)).length
      page.fileInputs = F.fileInputs(document).length
      page.fieldCount = fields.length
    }
    const key = JSON.stringify([s, page.job.id, page.questions?.length, page.fieldCount])
    if (key === last) return
    last = key
    chrome.runtime.sendMessage({ type: 'page', page }).catch(() => {})
  }

  let t
  const schedule = () => { clearTimeout(t); t = setTimeout(report, 400) }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true })
  addEventListener('popstate', schedule)
  report()

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    const run = async () => {
      if (msg.type === 'fill') {
        const fields = F.collectFields(document)
        const expected = (msg.answers?.length || 0) + 3 // name, email, phone at least
        const profile = msg.profile ? F.fillProfile(fields, msg.profile) : 0
        const { filled, left } = msg.answers ? F.fillAnswers(fields, msg.answers) : { filled: [], left: [] }
        const degraded = fields.length < expected / 2
        return { profile, filled, left, fields: fields.length, degraded }
      }
      if (msg.type === 'attach') {
        const input = F.fileInputs(document)[0]
        if (!input) return { ok: false, error: 'No file box on this step. Choose "Upload resume" on the page first.' }
        const bytes = Uint8Array.from(atob(msg.b64), c => c.charCodeAt(0))
        return { ok: F.attachFile(input, bytes, msg.name, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') }
      }
      if (msg.type === 'read') { last = ''; report(); return { ok: true } }
      return { error: 'Unknown request' }
    }
    run().then(reply).catch(err => reply({ error: err.message }))
    return true
  })
})()
