// The demo in a real browser, against the real endpoints over the in-memory database (server.mjs, with a
// scripted Sky and a stub Stripe). Start the server first:  node tests/e2e/server.mjs &   then   node tests/e2e/demo.mjs
import { chromium } from 'playwright'

const base = 'http://localhost:4173'
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } }); const p = await ctx.newPage()
const errors = []
p.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()) })
p.on('response', r => { if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`HTTP ${r.status()} ${r.url()}`) })
const shot = name => p.screenshot({ path: new URL(`./shots/${name}.png`, import.meta.url).pathname, fullPage: true })
const text = async () => (await p.evaluate(() => document.body.textContent)).replace(/\s+/g, ' ')
let failed = 0
const step = async (name, fn) => { try { await fn(); console.log('ok  ', name) } catch (e) { failed++; console.log('FAIL', name, '-', e.message.split('\n')[0]); await shot('fail-' + name.replace(/\W+/g, '-')).catch(() => {}) } }
const need = async (re, what) => { const t = await text(); if (!re.test(t)) throw new Error(`${what} missing. Page says: ${t.slice(0, 260)}`) }

await step('the demo page is about Sky, not a sample member', async () => {
  await p.goto(base + '/demo/index.html'); await p.waitForSelector('#start-form')
  await need(/Meet Sky, your AI career coach/, 'headline'); await need(/Yours to keep or lose/, 'keep-or-lose card')
  if (/Sam\b/.test(await text())) throw new Error('still mentions Sam')
  await shot('demo-start')
})
await step('Start the demo opens on Sky, with Sky’s question and an empty memory panel', async () => {
  await p.click('#d-start'); await p.waitForURL(/\/app/, { timeout: 15000 }); await p.waitForSelector('#demo-memory', { timeout: 15000 })
  await need(/what should I call you/i, 'Sky’s opening question'); await need(/What Sky knows about you.*nothing yet/, 'empty memory panel')
  await need(/clears in \d+h unless you keep it/, 'demo bar'); await need(/15 of 15 messages left/, 'message allowance')
  if (/Sam\b/.test(await text())) throw new Error('Sam is still in the demo')
  if (!/#coach/.test(p.url())) throw new Error('did not land on the Coach: ' + p.url())
  await shot('demo-coach')
})
await step('talking to Sky fills the memory panel as it learns', async () => {
  await p.fill('#coach-box', 'Hi, I’m Sam. I’ve worked in aged care for four years and I’m thinking of a change.'); await p.click('#coach-send')
  await p.waitForSelector('.demo-notes li', { timeout: 15000 })
  await need(/Is called Sam and has worked in aged care for four years/, 'the saved note'); await need(/1 thing/, 'count'); await need(/Good to meet you, Sam/, 'Sky’s reply'); await need(/14 of 15 messages left/, 'message count down')
  await shot('demo-memory')
})
await step('Tools: Get hired comes first and the report is held back', async () => {
  await p.click('button.tab:has-text("Tools"), .tab:has-text("Tools")'); await p.waitForSelector('.toolgrid')
  const groups = await p.$$eval('h3.group', els => els.map(e => e.textContent.trim()))
  if (groups[0] !== 'Get hired') throw new Error('groups: ' + groups.join(' | '))
  if (!groups.includes('Not sure where you’re heading?')) throw new Error('direction group not reworded: ' + groups.join(' | '))
  const held = await p.$eval('.toolcard.held', e => e.textContent)
  if (!/Career Direction Report/.test(held) || !/Start the Compass first/.test(held)) throw new Error('report not held: ' + held)
  await shot('demo-tools')
})
await step('Keep what Sky knows asks for a name and email and goes to Stripe, carrying the demo member', async () => {
  await p.click('.demobar-btn.solid'); await p.waitForSelector('#keep-email', { timeout: 8000 })
  await p.fill('#keep-name', 'Sam Lee'); await p.fill('#keep-email', 'visitor@example.com')
  await shot('demo-keep-form')
  await p.click('.keep-form button[type="submit"]'); await p.waitForURL(/__stripe/, { timeout: 15000 })
  const u = new URL(p.url()); if (!u.searchParams.get('demo')) throw new Error('no demo member in the checkout: ' + p.url())
  if (u.searchParams.get('email') !== 'visitor@example.com') throw new Error('email not passed: ' + p.url())
})
console.log('\nerrors:', errors.length ? errors : 'none')
await b.close()
process.exit(failed ? 1 : 0)
