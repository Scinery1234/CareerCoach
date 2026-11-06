// Browser smoke test: walks all ten steps with AI off and checks the fixes
// from the November 2026 reviews. Needs Playwright with Chromium installed:
//   npx playwright install chromium && npm run test:ui
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createApp } from "../server.js";

delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;
const server = createApp().listen(0);
await new Promise(r => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(["ok", name]);
  } catch (e) {
    results.push(["FAIL", name + ": " + (e.message || e)]);
  }
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(base);

  const bar = () => page.locator("#barhint").innerText();
  const h2 = () => page.locator("#wbody h2").innerText();
  const addTo = async (id, items) => {
    for (const t of items) {
      await page.fill("#" + id, t);
      await page.press("#" + id, "Enter");
    }
  };

  await check(`${viewport.width}px consent: Tab stays inside the dialog and Escape does not dismiss it`, async () => {
    await page.waitForSelector("#consent:not([hidden])");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#consent").isHidden(), false);
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => document.getElementById("consent").contains(document.activeElement));
    assert.ok(inside, "focus left the consent dialog");
    for (const id of ["c1", "c2", "c3", "c4"]) await page.check("#" + id);
    await page.click("#consentGo");
  });

  await check("values step", async () => {
    for (const v of ["Calm", "Care", "Family", "Growth", "Nature"]) await page.click(`.chip:has-text("${v}")`);
    await page.click("text=Next: put them in order");
    await page.click("text=Save my values");
    assert.equal(await h2(), "Who are you?");
  });

  await check("no literal null in the step heading", async () => {
    assert.doesNotMatch(await page.locator("#wbody").innerText(), /\bnull\b/);
  });

  await check('"I am" keeps the words as typed, lower-cases a lone capitalised word', async () => {
    await addTo("iInp", ["a mum", "curious", "Learner", "someone who cares"]);
    const tags = await page.locator(".tag").allInnerTexts();
    assert.deepEqual(tags.map(t => t.replace(/×$/, "").trim()), ["I am a mum", "I am curious", "I am learner", "I am someone who cares"]);
    await page.click("text=Next: put them in order");
    await page.click("#barbtns >> text=Save");
    assert.equal(await h2(), "Your North Star");
  });

  await check("north star, needs, strengths", async () => {
    await page.fill("#nsText", "I am outside in the garden with my kids most days, calm and unhurried, teaching people how to grow their own food and feeling useful.");
    await page.click("text=Save my North Star");
    await page.fill("#nPay", "60000");
    await page.fill("#nHrs", "30");
    await page.click(".opt:has-text('Low')");
    await page.click(".opt:has-text('On-site')");
    await page.click("#barbtns >> text=Save");
    await addTo("s-know", ["Gardening", "Permaculture", "Soil"]);
    await addTo("s-do", ["Teach", "Fix things", "Listen"]);
    await addTo("s-love", ["Kids", "Being outside", "Fairness"]);
    await page.click("text=Save my strengths");
    assert.equal(await h2(), "Mix and match");
  });

  await check("mix, choose, plan, steps", async () => {
    await page.fill("#trio0", "Garden educator");
    await page.press("#trio0", "Enter");
    await page.fill("#mHad", "Park ranger");
    await page.press("#mHad", "Enter");
    await page.click("text=Next: choose");
    await page.click("text=Save my order");
    await page.fill("#p-now", "Visit the community garden and ask about volunteering.");
    await page.click("text=Save my plan");
    for (const [j, t] of ["Call the community garden", "Sign up for the soil course", "Write a list of five schools"].entries()) await page.fill("#a" + j, t);
    await page.click("text=Save my steps");
    assert.equal(await h2(), "Put them in your calendar");
  });

  await check("calendar can be edited again after locking in", async () => {
    await page.click("text=Lock it in");
    assert.equal(await h2(), "Your Compass map");
    await page.click("text=Change days or times");
    assert.equal(await h2(), "Put them in your calendar");
    assert.equal(await page.locator("input[type=time]").count(), 3);
    await page.click("text=Back to my map");
    assert.equal(await h2(), "Your Compass map");
  });

  await check("summary lists values one per line", async () => {
    const txt = await page.locator(".sum:has(h3:text('Values')) p").innerText();
    assert.match(txt, /1\. Calm\n2\. Care/);
  });

  await check("re-saving an earlier step returns to the map, not the next step", async () => {
    await page.click("#steps button:has-text('Values')");
    assert.equal(await h2(), "Put your values in order");
    await page.click("text=Save my values");
    assert.equal(await h2(), "Your Compass map");
  });

  await check("Enter does not post a chat message when AI is off", async () => {
    if (viewport.width < 900) await page.click("#tabTalk");
    await page.fill("#box", "hello there");
    await page.press("#box", "Enter");
    assert.equal(await page.locator(".msg.me").count(), 0);
    assert.equal(await page.locator("#box").inputValue(), "hello there");
  });

  await check("crisis dialog: Escape closes it and focus returns", async () => {
    await page.click("#helpBtn");
    await page.waitForSelector("#crisis:not([hidden])");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#crisis").isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "helpBtn");
  });

  await check("no horizontal scroll, no page errors", async () => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(over, false, "horizontal overflow");
    assert.deepEqual(errors, []);
  });

  await page.close();
}

// Crisis matching, checked directly against the page's regexes via the chat path.
{
  const page = await browser.newPage();
  await page.goto(base);
  await page.evaluate(() => localStorage.setItem("purposefields_consent_v1", JSON.stringify({ timestamp: Date.now() })));
  await page.reload();
  // With AI off nothing is sent, so test the two matchers lifted straight from app.js.
  await check("crisis matching ignores ordinary frustration", async () => {
    const src = await (await fetch(base + "/app.js")).text();
    const mk = new Function(src.slice(src.indexOf("const phraseRe"), src.indexOf("const RESOURCES")) + ";return {CRISIS_RE,HEAVY_RE};");
    const { CRISIS_RE, HEAVY_RE } = mk();
    assert.equal(CRISIS_RE.test("I can't go on working nights"), false);
    assert.equal(HEAVY_RE.test("I can't go on working nights"), true);
    assert.equal(CRISIS_RE.test("cutting myself off from the team"), false);
    assert.equal(CRISIS_RE.test("I just want to disappear and never wake up"), true);
    assert.equal(CRISIS_RE.test("I don’t want to live like this"), true);
    assert.equal(CRISIS_RE.test("suicide prevention is her job"), true);
    assert.equal(CRISIS_RE.test("the overdosed server"), false);
  });
  await page.close();
}

await browser.close();
server.close();
for (const [s, n] of results) console.log(s.padEnd(5), n);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
