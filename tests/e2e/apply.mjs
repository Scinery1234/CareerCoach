// The member app in a real browser, against the real member endpoint over the in-memory
// database (server.mjs). Not part of `npm test`: needs Playwright. Run:
//   node tests/e2e/server.mjs &   then   node tests/e2e/apply.mjs
// Screenshots land in tests/e2e/shots/.
import { chromium } from 'playwright'
const token = await (await fetch('http://localhost:4173/__token')).text()
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } }); const p = await ctx.newPage()
const errors = []
p.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()) })
p.on('response', r => { if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`HTTP ${r.status()} ${r.url()}`) })
await ctx.addInitScript(t => { try { localStorage.setItem('np_app_session', t) } catch {} }, token)
const shot = async name => p.screenshot({ path: new URL(`./shots/${name}.png`, import.meta.url).pathname, fullPage: true })
const text = async () => (await p.evaluate(() => document.body.textContent)).replace(/\s+/g, ' ')
const nav = async hash => { await p.goto('http://localhost:4173/app/index.html' + hash); await p.reload() }
const step = async (name, fn) => { try { await fn(); console.log('ok  ', name) } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); await shot('fail-' + name.replace(/\W+/g, '-')) } }

await step('Today loads with the alerts card and Sky’s offer', async () => {
  await nav('#today'); await p.waitForSelector('.ap-alerts', { timeout: 8000 })
  const t = await text()
  if (!/(1 new job that look|Jobs that looked like a fit)/.test(t)) throw new Error('alerts heading missing: ' + t.slice(0, 300))
  if (!/Looks like a strong fit, from the summary/.test(t)) throw new Error('verdict words missing')
  if (!/Sky can help with applying/.test(t)) throw new Error('offer card missing')
  await shot('today')
})
await step('Not now hides the offer and is remembered', async () => {
  await p.click('text=Not now'); await p.waitForTimeout(500)
  if (/Sky can help with applying/.test(await text())) throw new Error('offer still shown')
  await p.reload(); await p.waitForSelector('.ap-alerts'); if (/Sky can help with applying/.test(await text())) throw new Error('offer came back after reload')
})
await step('Applications tool renders every card', async () => {
  await nav('#tools/apply'); await p.waitForSelector('text=Add one I applied for elsewhere', { timeout: 8000 })
  const t = await text()
  for (const s of ['New jobs, early', 'Standard answers', 'The browser helper', 'A weekly rhythm', 'Sky and your applications', 'Nothing logged yet']) if (!t.includes(s)) throw new Error('missing card: ' + s)
  await shot('applications-empty')
})
await step('Add an application by hand, then change its status', async () => {
  await p.click('text=Add one I applied for elsewhere')
  await p.fill('form.doc-form input[required]', 'Cook'); await p.fill('form.doc-form .ap-fields label:nth-child(2) input', 'Cafe')
  await p.selectOption('form.doc-form .ap-fields label:nth-child(3) select', 'seek')
  await p.click('form.doc-form button[type="submit"]'); await p.waitForSelector('.ap-row', { timeout: 8000 })
  let t = await text(); if (!/Waiting to hear \(1\)/.test(t)) throw new Error('not listed: ' + t.slice(0, 400))
  if (!/1 this week/.test(t)) throw new Error('pipeline card did not update: ' + t.slice(0, 300))
  await p.click('.ap-row >> text=Interview'); await p.waitForTimeout(500)
  t = await text(); if (!/Interview/.test(t) || !/1 at interview stage/.test(t)) throw new Error('status change not reflected: ' + t.slice(0, 400))
  await shot('applications-one')
})
await step('Weekly target and search preferences save and merge', async () => {
  await p.fill('.ap-target input', '3'); await p.locator('.card:has(.ap-target) button:has-text("Save")').click()
  await p.waitForTimeout(400)
  await p.fill('input[placeholder*="Aged care worker"]', 'Aged care worker, Cook'); await p.fill('input[placeholder*="Geelong"]', 'Geelong')
  await p.click('form.doc-form:has(input[placeholder*="Aged care worker"]) button[type="submit"]'); await p.waitForTimeout(600)
  const t = await text()
  if (!/New listings are checked every hour/.test(t)) throw new Error('search save note missing: ' + t.slice(0, 300))
  await p.reload(); await p.waitForSelector('text=Add one I applied for elsewhere')
  const roles = await p.inputValue('input[placeholder*="Aged care worker"]'); if (roles !== 'Aged care worker, Cook') throw new Error('roles not persisted: ' + roles)
  const target = await p.inputValue('.ap-target input'); if (target !== '3') throw new Error('target lost after search save: ' + target)
})
await step('Standard answers save', async () => {
  await p.fill('input[placeholder*="Australian citizen"]', 'Australian citizen'); await p.locator('button:text-is("Add one")').click(); await p.waitForTimeout(200)
  const qs = p.locator('form.doc-form:has(input[placeholder*="Australian citizen"]) .ap-fields').last()
  await qs.locator('input').first().fill('Why do you want to work with us?'); await qs.locator('textarea').first().fill('Because of the community model.')
  await p.click('form.doc-form:has(input[placeholder*="Australian citizen"]) button[type="submit"]'); await p.waitForTimeout(500)
  await p.reload(); await p.waitForSelector('text=Add one I applied for elsewhere')
  const v = await p.inputValue('input[placeholder*="Australian citizen"]'); if (v !== 'Australian citizen') throw new Error('answer not persisted')
})
await step('Tailor my resume from an alert hands the role into the resume writer', async () => {
  await nav('#today'); await p.waitForSelector('.ap-alerts')
  const popup = ctx.waitForEvent('page')
  await p.click('text=Tailor my resume'); const pop = await popup; await pop.close()
  await p.waitForSelector('#tl-role', { timeout: 8000 })
  const role = await p.inputValue('#tl-role'); if (role !== 'Aged Care Worker - Nights') throw new Error('role not handed over: ' + role)
  const co = await p.inputValue('#tl-co'); if (co !== 'Harbour Aged Care') throw new Error('company not handed over: ' + co)
  if (!/Copy the whole ad and paste it below/.test(await text())) throw new Error('handoff note missing')
  await shot('tailor-handoff')
})
await step('A tailored resume shows the Did-you-apply card; logging it works and links the alert', async () => {
  await nav('#tools/resume'); await p.waitForSelector('text=Resume: Aged Care Worker at Harbour', { timeout: 8000 })
  await p.click('text=Resume: Aged Care Worker at Harbour'); await p.waitForSelector('.ap-card', { timeout: 8000 })
  const t = await text(); if (!/Did you apply\?/.test(t)) throw new Error('card missing')
  await p.click('.ap-card >> text=I applied'); await p.waitForSelector('.ap-done', { timeout: 8000 })
  if (!/It’s in your applications now|saved entry is now marked/.test(await text())) throw new Error('logged copy missing')
  await shot('tailor-logged')
})
await step('Cover letter screen renders', async () => {
  await nav('#tools/cover'); await p.waitForSelector('text=Cover letter', { timeout: 8000 })
})
await step('Coach tab lists the Applying focus', async () => {
  await nav('#coach'); await p.waitForTimeout(800); await p.click('text=What can Sky help with?'); await p.waitForTimeout(500); await shot('coach-focuses')
  if (!/Applying/.test(await text())) throw new Error('Applying focus not listed')
})
console.log('\nerrors:', errors.length ? errors : 'none')
await b.close()
