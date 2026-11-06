// Ad conversion tracking. Put your IDs here and the tags load; leave them empty and nothing
// loads. Events: 'cta' when a start button is pressed, 'start_trial' on the thank-you page.
// Google Ads conversions: set ga4 to your GA4 id and import the GA4 events into Google Ads,
// or set gadsLabel to 'AW-XXXXXXXX/yyyyyyy' to fire a conversion directly.
window.ACC = window.ACC || { ga4: '', meta: '', gadsLabel: '' }
;(function () {
  const A = window.ACC
  const add = (src, cb) => { const s = document.createElement('script'); s.async = true; s.src = src; s.onload = cb; document.head.append(s) }
  if (A.ga4 || A.gadsLabel) {
    window.dataLayer = window.dataLayer || []
    window.gtag = function () { window.dataLayer.push(arguments) }
    gtag('js', new Date())
    if (A.ga4) gtag('config', A.ga4)
    if (A.gadsLabel) gtag('config', A.gadsLabel.split('/')[0])
    add('https://www.googletagmanager.com/gtag/js?id=' + (A.ga4 || A.gadsLabel.split('/')[0]))
  }
  if (A.meta) {
    !(function (f, b, e, v, n, t) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; f._fbq = n; n.push = n; n.loaded = true; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = true; t.src = v; b.head.append(t) })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
    fbq('init', A.meta); fbq('track', 'PageView')
  }
  // Which ad angle brought them, kept for the thank-you page.
  const v = new URLSearchParams(location.search).get('v')
  if (v) { try { sessionStorage.setItem('acc_v', v) } catch {} }
  window.track = function (name, params = {}) {
    let variant = v; try { variant = variant || sessionStorage.getItem('acc_v') } catch {}
    const p = { ...params, variant: variant || 'default' }
    if (window.gtag) {
      gtag('event', name === 'cta' ? 'begin_checkout' : name === 'start_trial' ? 'purchase' : name, p)
      if (A.gadsLabel && name === 'start_trial') gtag('event', 'conversion', { send_to: A.gadsLabel, value: p.value || 0, currency: p.currency || 'AUD' })
    }
    if (window.fbq) fbq('track', name === 'cta' ? 'InitiateCheckout' : name === 'start_trial' ? 'StartTrial' : name, p)
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-track]')
    if (a) window.track(a.dataset.track, { place: a.dataset.place || '' })
  })
})()
