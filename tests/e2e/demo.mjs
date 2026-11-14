// The demo in a real browser, against the real endpoints over the in-memory database (server.mjs, with a
// scripted Sky and a stub Stripe). Start the server first:  node tests/e2e/server.mjs &   then   node tests/e2e/demo.mjs
// Runs at a computer width and at a phone width. Screenshots land in tests/e2e/shots/.
import { chromium } from 'playwright'

const base = 'http://localhost:4173'
const b = await chromium.launch()
let failed = 0
const errors = []

async function run(label, viewport, steps) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 600 }); const p = await ctx.newPage()
  p.on('pageerror', e => errors.push(`[${label}] PAGEERROR ` + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(`[${label}] CONSOLE ` + m.text()) })
  p.on('response', r => { if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`[${label}] HTTP ${r.status()} ${r.url()}`) })
  const shot = name => p.screenshot({ path: new URL(`./shots/${label}-${name}.png`, import.meta.url).pathname, fullPage: false })
  const text = async () => (await p.evaluate(() => document.body.textContent)).replace(/\s+/g, ' ')
  const need = async (re, what) => { const t = await text(); if (!re.test(t)) throw new Error(`${what} missing. Page says: ${t.slice(0, 240)}`) }
  const visible = sel => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 }, sel)
  const step = async (name, fn) => { try { await fn(); console.log(`ok   [${label}] ${name}`) } catch (e) { failed++; console.log(`FAIL [${label}] ${name} - ${e.message.split('\n')[0]}`); await shot('fail-' + name.replace(/\W+/g, '-')).catch(() => {}) } }
  await steps({ p, shot, text, need, visible, step })
  await ctx.close()
}

const common = ({ computer }) => async ({ p, shot, text, need, visible, step }) => {
  await step('the demo page is about Sky, not a sample member', async () => {
    await p.goto(base + '/demo/index.html'); await p.waitForSelector('#start-form')
    await need(/Meet Sky, your AI career coach/, 'headline'); await need(/Yours to keep or lose/, 'keep-or-lose card')
    if (/Sam\b/.test(await text())) throw new Error('still mentions Sam')
    if (await p.$eval('#d-start', e => e.disabled)) throw new Error('start button is disabled')
  })
  await step('Start opens on Sky: its question, starters, an empty panel, and nothing else competing', async () => {
    await p.click('#d-start'); await p.waitForURL(/\/app/, { timeout: 15000 }); await p.waitForSelector('.demo-screen', { timeout: 15000 })
    await need(/what should I call you/i, 'Sky’s opening question'); await need(/clears in \d+ hours?/, 'demo bar')
    if (!/#coach/.test(p.url())) throw new Error('did not land on the Coach: ' + p.url())
    if (await visible('#tabbar')) throw new Error('the tab bar is showing')
    if (await visible('#signout')) throw new Error('Sign out is showing')
    if (await p.$('.focus-btn')) throw new Error('the focus chip is showing')
    if (await visible('#foot')) throw new Error('the page footer is doubling the safety line')
    if (/Sam\b/.test(await text())) throw new Error('Sam is still in the demo')
    const starters = await p.$$eval('.starters .chip', els => els.map(e => e.textContent))
    if (starters.length !== 4) throw new Error('starters: ' + starters.join(' | '))
    if (computer) { if (!(await visible('.demo-know'))) throw new Error('the panel is not beside the chat'); await need(/nothing yet/, 'empty panel'); await need(/What Sky learns will appear here/, 'empty hint') }
    else { if (await visible('.demo-know')) throw new Error('the sheet is open on a phone at the start'); if (!(await visible('.demo-pill'))) throw new Error('no pill'); await need(/Sky knows nothing yet/, 'pill text') }
    if (await p.$eval('#coach-send', e => e.disabled) === false) throw new Error('Send should be disabled with an empty box')
    await shot('1-start')
  })
  await step('one tap on a starter sends it and Sky replies; the note appears and is highlighted', async () => {
    await p.click('.starters .chip:has-text("I want a change")')
    await p.waitForFunction(() => /Good to meet you, Sam/.test(document.body.textContent), null, { timeout: 15000 })
    await need(/Good to meet you, Sam/, 'Sky’s reply')
    if (await p.$('.starters')) throw new Error('the starters should go once the visitor has answered')
    if (computer) {
      await p.waitForSelector('.dk-notes li:not(.ph)', { timeout: 15000 })
      await need(/Is called Sam and has worked in aged care/, 'the saved note'); await need(/1 thing/, 'count')
    } else { await p.waitForFunction(() => /Sky knows 1 thing/.test(document.body.textContent), null, { timeout: 15000 }) }
    await shot('2-after-a-reply')
  })
  if (!computer) await step('the pill opens the notes as a sheet with Keep in it, and closes again', async () => {
    await p.click('.demo-pill'); await p.waitForSelector('.demo-know.open', { timeout: 5000 }); await p.waitForTimeout(400)
    if (!(await visible('.demo-know'))) throw new Error('sheet not visible')
    await need(/Is called Sam and has worked in aged care/, 'the note in the sheet')
    if (!(await visible('.dk-keep .btn'))) throw new Error('Keep is not in the sheet')
    await shot('3-sheet')
    await p.click('.sheet-close'); await p.waitForTimeout(400)
    if (await visible('.demo-know')) throw new Error('sheet did not close')
    await p.click('.demo-pill'); await p.waitForSelector('.demo-know.open'); await p.waitForTimeout(300)
  })
  await step('Keep asks for a name and email, states the price and terms, and goes to Stripe carrying the demo member', async () => {
    await p.click('.dk-keep .btn'); await p.waitForSelector('#keep-email', { timeout: 8000 })
    await need(/Free for 7 days, then \$25 a month/, 'price'); await need(/Terms/, 'terms link')
    await p.fill('#keep-name', 'Sam Lee'); await p.fill('#keep-email', 'visitor@example.com')
    await shot('4-keep-form')
    await p.click('.keep-form button[type="submit"]'); await p.waitForURL(/__stripe/, { timeout: 15000 })
    const u = new URL(p.url()); if (!u.searchParams.get('demo')) throw new Error('no demo member in the checkout: ' + p.url())
  })
}

await run('computer', { width: 1240, height: 860 }, common({ computer: true }))
await run('phone', { width: 390, height: 780 }, common({ computer: false }))

// The way into the tools and back, from the computer layout
await run('tools', { width: 1240, height: 860 }, async ({ p, need, visible, step }) => {
  await step('the tools are one link away, with a way back to Sky', async () => {
    await p.goto(base + '/demo/index.html'); await p.click('#d-start'); await p.waitForSelector('.demo-screen', { timeout: 15000 })
    await p.click('.dk-tools'); await p.waitForSelector('.toolgrid', { timeout: 8000 })
    await need(/Back to Sky/, 'back link')
    const groups = await p.$$eval('h3.group', els => els.map(e => e.textContent.trim()))
    if (groups[0] !== 'Get hired') throw new Error('Get hired should come first: ' + groups.join(' | '))
    const held = await p.$eval('.toolcard.held', e => e.textContent)
    if (!/Career Direction Report/.test(held) || !/Start the Compass first/.test(held)) throw new Error('report not held: ' + held)
    if (await visible('#tabbar')) throw new Error('tab bar on the tools screen')
    await p.click('.demo-back'); await p.waitForSelector('.demo-screen', { timeout: 8000 })
  })
})

console.log('\nerrors:', errors.length ? errors : 'none')
await b.close()
process.exit(failed || errors.length ? 1 : 0)
