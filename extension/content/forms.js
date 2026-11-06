// Shared form logic for the content scripts: find the fields on an application form,
// work out what each one asks, fill it, attach a file. Plain script (content scripts
// are not modules); everything hangs off globalThis.NPForms so the adapters and the
// tests can use it. Nothing in here clicks anything: filling is setting values and
// dispatching the events a typed value would.
;(function () {
  const norm = s => String(s || '').toLowerCase().replace(/[’'"]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

  // Contact details the member's resume supplies, by what the field asks.
  const PROFILE = [
    ['firstName', [/^(first|given) ?name/, /^first$/]],
    ['lastName', [/^(last|family|sur) ?name/, /^last$/]],
    ['name', [/^(full |your )?name$/, /^name \(/, /^full name/]],
    ['email', [/e-?mail/]],
    ['phone', [/phone|mobile|contact number|telephone/]],
    ['location', [/^(suburb|city|town|location|where (do you|are you) (live|based)|home suburb|postcode|post code)/]],
    ['linkedin', [/linkedin/]]
  ]
  const SUBMIT_LIKE = /\b(submit|apply|send|continue|next|finish|complete application)\b/i

  function visible(el) {
    if (!el || el.type === 'hidden') return false
    const cs = el.ownerDocument.defaultView?.getComputedStyle?.(el)
    if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false
    return !el.disabled && !el.readOnly
  }

  // The text that tells a person what a field is for. Several places, most specific first.
  function fieldLabel(el) {
    const doc = el.ownerDocument
    const id = el.getAttribute('id')
    const parts = []
    if (id) for (const l of doc.querySelectorAll(`label[for="${CSS.escape ? CSS.escape(id) : id}"]`)) parts.push(l.textContent)
    const by = el.getAttribute('aria-labelledby')
    if (by) for (const i of by.split(/\s+/)) { const n = doc.getElementById(i); if (n) parts.push(n.textContent) }
    if (el.getAttribute('aria-label')) parts.push(el.getAttribute('aria-label'))
    const wrap = el.closest('label')
    if (wrap) parts.push(wrap.textContent)
    if (!parts.join('').trim()) {
      const fs = el.closest('fieldset'); const lg = fs?.querySelector('legend'); if (lg) parts.push(lg.textContent)
    }
    if (!parts.join('').trim()) {
      // The nearest heading or paragraph just above the field: how most question lists are built.
      let n = el.closest('div, li, section') || el
      for (let i = 0; i < 4 && n; i++) {
        const t = n.querySelector?.('legend, h1, h2, h3, h4, h5, h6, p, span, strong, label')
        if (t && t.textContent.trim().length > 2 && !t.contains(el)) { parts.push(t.textContent); break }
        n = n.parentElement
      }
    }
    if (!parts.join('').trim() && el.getAttribute('placeholder')) parts.push(el.getAttribute('placeholder'))
    if (!parts.join('').trim() && el.getAttribute('name')) parts.push(el.getAttribute('name').replace(/[_\-\[\]]+/g, ' '))
    return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 400)
  }

  function optionsOf(el, group) {
    if (el.tagName === 'SELECT') return [...el.options].map(o => o.textContent.trim()).filter(t => t && !/^(select|choose|please)/i.test(t))
    if (group) return group.map(g => g.label).filter(Boolean)
    return []
  }

  // Every answerable field on the page, radios and checkboxes grouped by name.
  function collectFields(root) {
    const doc = root.ownerDocument || root
    const els = [...(root.querySelectorAll ? root : doc).querySelectorAll('input, textarea, select')].filter(el => visible(el) && !['submit', 'button', 'image', 'reset', 'file'].includes(el.type))
    const fields = [], groups = new Map()
    for (const el of els) {
      if (el.type === 'radio' || el.type === 'checkbox') {
        const key = el.name || el.getAttribute('aria-labelledby') || fieldLabel(el.closest('fieldset') ? el.closest('fieldset').querySelector('legend') || el : el)
        if (!groups.has(key)) { groups.set(key, { el, kind: el.type, items: [] }); fields.push(groups.get(key)) }
        const lbl = (el.labels && el.labels[0]?.textContent) || el.closest('label')?.textContent || el.getAttribute('aria-label') || el.value
        groups.get(key).items.push({ el, label: String(lbl || '').trim() })
        continue
      }
      fields.push({ el, kind: el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : (el.type || 'text') })
    }
    for (const f of fields) {
      if (f.items) {
        const fs = f.el.closest('fieldset')
        f.label = fs?.querySelector('legend')?.textContent?.trim() || fieldLabel(f.el).replace(f.items[0]?.label || '', '').trim() || f.items.map(i => i.label).join(' / ')
        f.options = optionsOf(f.el, f.items)
      } else {
        f.label = fieldLabel(f.el)
        f.options = optionsOf(f.el)
      }
      f.key = norm(f.label)
    }
    return fields.filter(f => f.key)
  }

  function profileKey(label) {
    const n = norm(label)
    for (const [key, pats] of PROFILE) if (pats.some(p => p.test(n))) return key
    return null
  }

  // Fields that ask the applicant something, as the server's ext_answers expects them.
  const questionsFrom = fields => fields.filter(f => !profileKey(f.label) && !/^(upload|attach|resume|cv|cover letter)/.test(f.key)).map(f => ({ label: f.label, options: f.options || [] }))

  function fire(el, type) { el.dispatchEvent(new (el.ownerDocument.defaultView || globalThis).Event(type, { bubbles: true })) }

  // Sets a value the way typing would, so frameworks notice. Returns true when something was set.
  function fillField(f, value) {
    if (value == null || value === '') return false
    const v = String(value)
    if (f.items) {
      const want = norm(v)
      const hit = f.items.find(i => norm(i.label) === want) || f.items.find(i => norm(i.label).startsWith(want) || want.startsWith(norm(i.label))) || (f.kind === 'radio' && /^(yes|no)$/.test(want) ? f.items.find(i => norm(i.label).startsWith(want)) : null)
      if (!hit) return false
      if (!hit.el.checked) { hit.el.checked = true; fire(hit.el, 'input'); fire(hit.el, 'change') }
      return true
    }
    if (f.kind === 'select') {
      const want = norm(v)
      const opt = [...f.el.options].find(o => norm(o.textContent) === want) || [...f.el.options].find(o => norm(o.textContent).includes(want) || want.includes(norm(o.textContent)))
      if (!opt) return false
      // Three ways to say the same thing, because frameworks and DOMs read different ones.
      try { f.el.value = opt.value } catch { /* read-only in some DOMs */ }
      try { opt.selected = true } catch { /* same */ }
      for (const o of f.el.options) { if (o === opt) o.setAttribute('selected', ''); else o.removeAttribute('selected') }
      fire(f.el, 'input'); fire(f.el, 'change')
      return true
    }
    if (f.kind === 'number' && !/^\d/.test(v)) return false
    const proto = Object.getPrototypeOf(f.el)
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(f.el, v); else f.el.value = v
    fire(f.el, 'input'); fire(f.el, 'change')
    return true
  }

  // A file into a file input, as a drop would. Needs the page's own File and DataTransfer.
  function attachFile(input, bytes, name, type) {
    const w = input.ownerDocument.defaultView
    const file = new w.File([bytes], name, { type })
    const dt = new w.DataTransfer()
    dt.items.add(file)
    input.files = dt.files
    fire(input, 'input'); fire(input, 'change')
    return input.files.length === 1
  }

  const isSubmitLike = el => SUBMIT_LIKE.test(String(el?.textContent || el?.value || el?.getAttribute?.('aria-label') || ''))

  // Profile values for the fields that ask for them.
  function fillProfile(fields, profile) {
    const c = profile?.contact || {}
    const [first, ...rest] = String(c.name || profile?.name || '').trim().split(/\s+/)
    const values = { firstName: first, lastName: rest.join(' '), name: c.name || profile?.name, email: c.email, phone: c.phone, location: c.location, linkedin: c.linkedin }
    let n = 0
    for (const f of fields) { const k = profileKey(f.label); if (k && fillField(f, values[k])) n++ }
    return n
  }

  // Answers from the server, matched back to fields by label.
  function fillAnswers(fields, answers) {
    const filled = [], left = []
    for (const a of answers || []) {
      const f = fields.find(x => norm(x.label) === norm(a.question))
      if (!f) continue
      if (a.answer && fillField(f, a.answer)) filled.push({ label: f.label, answer: a.answer, source: a.source }); else left.push({ label: f.label, note: a.note || '' })
    }
    return { filled, left }
  }

  const fileInputs = root => [...root.querySelectorAll('input[type="file"]')].filter(el => !el.disabled)
  const heading = root => (root.querySelector('h1, h2')?.textContent || '').trim()

  globalThis.NPForms = { norm, fieldLabel, collectFields, profileKey, questionsFrom, fillField, fillProfile, fillAnswers, attachFile, isSubmitLike, fileInputs, heading, SUBMIT_LIKE }
})()
