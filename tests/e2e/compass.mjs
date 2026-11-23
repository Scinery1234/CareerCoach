// The Compass landing page in a real browser, at a phone and a computer width: the quiz, the
// result, the questions written from the answers (scripted here), the goal and the offer, and
// through to the checkout carrying the member who holds the answers.
// Run: node tests/e2e/server.mjs &   then   node tests/e2e/compass.mjs
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:4173', SHOTS = new URL('./shots/', import.meta.url).pathname
mkdirSync(SHOTS, { recursive: true })
const b = await chromium.launch()
for (const [name, width, height] of [['phone', 390, 844], ['desk', 1280, 800]]) {
  const p = await b.newPage({ viewport: { width, height } })
  const errors = []; p.on('pageerror', e => errors.push(e.message))
  await p.goto(BASE + '/compass/'); await p.click('#start')
  // Low clarity, good energy: Explore. "Employed" adds the job-satisfaction question.
  for (const k of [1, 4, 2, 1, 2, 4, 1, 4, 1, 2, 2]) { await p.waitForTimeout(350); await p.keyboard.press(String(k)) }
  await p.waitForSelector('#r-head')
  assert.match(await p.textContent('#r-head'), /time to explore/)
  await p.getByRole('button', { name: 'Shape it around me' }).click()
  await p.waitForSelector('#intake .opt')
  assert.equal(await p.locator('#intake .opt').count(), 4)
  await p.waitForTimeout(600); await p.screenshot({ path: `${SHOTS}compass-${name}-question.png` })
  await p.locator('#intake .opt').nth(1).click()
  await p.waitForFunction(() => /Work that means something/.test(document.querySelector('#i-q')?.textContent || ''))
  await p.fill('#intake .other', 'I taught for nine years and I am worn out by the hours'); await p.keyboard.press('Enter')
  await p.waitForFunction(() => /worn out by the hours/.test(document.querySelector('#i-q')?.textContent || ''))
  await p.keyboard.press('1')
  await p.waitForFunction(() => /More time for my life/.test(document.querySelector('#i-q')?.textContent || ''))
  await p.locator('#intake .opt').nth(0).click()
  await p.waitForSelector('#o-head')
  assert.match(await p.textContent('#o-head'), /uses my teaching/)
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no sideways scroll')
  await p.waitForTimeout(600); await p.screenshot({ path: `${SHOTS}compass-${name}-offer.png` })
  await p.fill('#o-name', 'Sam'); await p.fill('#o-email', `sam-${name}@example.com`)
  await p.locator('#offer button[type=submit]').click()
  await p.waitForURL(/__stripe\?demo=[0-9a-f-]{8,}/)
  assert.deepEqual(errors, [])
  console.log(name, 'ok:', p.url())
  await p.close()
}
await b.close()
