// Passive capture: on a search results page the member is already looking at, read the
// listing cards on screen and hand them to the app, which scores the ones that look
// like their roles and adds the good ones to Today. Off until the member turns it on
// (the background checks the setting before sending). Nothing is fetched, no page is
// paginated, no tab is opened: only what is on this page, now.
;(function () {
  const F = globalThis.NPForms
  if (!F || globalThis.__npCapture) return
  globalThis.__npCapture = true

  const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const abs = href => { try { return new URL(href, location.href).href } catch { return '' } }

  // One reader per board, each returning { title, company, location, salary, url, snippet, posted_at } per card.
  const READERS = {
    seek: () => [...document.querySelectorAll('article[data-card-type="JobCard"], article[data-automation="normalJob"], article[data-automation="premiumJob"]')].map(card => {
      const a = card.querySelector('a[data-automation="jobTitle"], h3 a, a[href*="/job/"]')
      return a && { title: text(a), company: text(card.querySelector('[data-automation="jobCompany"]')), location: text(card.querySelector('[data-automation="jobLocation"]')), salary: text(card.querySelector('[data-automation="jobSalary"]')), url: abs(a.getAttribute('href')), snippet: text(card.querySelector('[data-automation="jobShortDescription"]')).slice(0, 600), posted_at: null }
    }),
    indeed: () => [...document.querySelectorAll('.job_seen_beacon, [data-testid="slider_item"], .result')].map(card => {
      const a = card.querySelector('h2.jobTitle a, a[data-jk], a[id^="job_"]')
      return a && { title: text(a), company: text(card.querySelector('[data-testid="company-name"], .companyName')), location: text(card.querySelector('[data-testid="text-location"], .companyLocation')), salary: text(card.querySelector('[data-testid="attribute_snippet_testid"], .salary-snippet')), url: abs(a.getAttribute('href')), snippet: text(card.querySelector('.job-snippet, [data-testid="belowJobSnippet"]')).slice(0, 600), posted_at: null }
    }),
    jora: () => [...document.querySelectorAll('article.job-card, .job-card, article[data-job-id]')].map(card => {
      const a = card.querySelector('a.job-link, h3 a, a[href*="/job/"]')
      return a && { title: text(a), company: text(card.querySelector('.job-company, .company')), location: text(card.querySelector('.job-location, .location')), salary: text(card.querySelector('.job-salary, .salary')), url: abs(a.getAttribute('href')), snippet: text(card.querySelector('.job-abstract, .snippet')).slice(0, 600), posted_at: null }
    })
  }
  const site = /seek\./.test(location.hostname) ? 'seek' : /indeed\./.test(location.hostname) ? 'indeed' : /jora\./.test(location.hostname) ? 'jora' : null
  const isResults = () => site === 'seek' ? /-jobs|\/jobs/.test(location.pathname) : site === 'indeed' ? /^\/jobs/.test(location.pathname) : site === 'jora' ? /^\/j\b|\/jobs/.test(location.pathname) : false

  const sent = new Set()
  function capture() {
    if (!site || !isResults()) return
    const listings = (READERS[site]() || []).filter(Boolean).filter(l => l.title && l.url && !sent.has(l.url))
    if (!listings.length) return
    for (const l of listings) sent.add(l.url)
    chrome.runtime.sendMessage({ type: 'capture', listings: listings.slice(0, 40) }).catch(() => {})
  }

  let t
  const schedule = () => { clearTimeout(t); t = setTimeout(capture, 1200) }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true })
  addEventListener('popstate', schedule)
  schedule()

  globalThis.NPCapture = { READERS, isResults }
})()
