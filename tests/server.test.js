// End-to-end tests against a mock Anthropic API (no real key needed).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const calls = [];
let next = null; // (body, res) => void, set per test

const mock = http.createServer((req, res) => {
  let raw = "";
  req.on("data", c => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    calls.push({ url: req.url, headers: req.headers, body });
    next(body, res);
  });
});

function sse(res, text, stopReason = "end_turn") {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send("message_start", {
    type: "message_start",
    message: { id: "msg_1", type: "message", role: "assistant", model: "m", content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 0 } },
  });
  send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
  for (const part of text.match(/.{1,5}/gs) || []) {
    send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: part } });
  }
  send("content_block_stop", { type: "content_block_stop", index: 0 });
  send("message_delta", { type: "message_delta", delta: { stop_reason: stopReason }, usage: { output_tokens: 5 } });
  send("message_stop", { type: "message_stop" });
  res.end();
}

function json(res, text, stopReason = "end_turn", status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify(
      status === 200
        ? { id: "msg_2", type: "message", role: "assistant", model: "m", content: text ? [{ type: "text", text }] : [], stop_reason: stopReason, usage: { input_tokens: 1, output_tokens: 1 } }
        : { type: "error", error: { type: "rate_limit_error", message: "slow down" } },
    ),
  );
}

let server, base;

before(async () => {
  await new Promise(r => mock.listen(0, r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${mock.address().port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  process.env.RATE_LIMIT_PER_MIN = "1000";
  const { createApp } = await import("../server.js");
  const { setClient } = await import("../lib/claude.js");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  setClient(new Anthropic({ maxRetries: 0 }));
  server = createApp().listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  mock.close();
});

const post = (path, body) =>
  fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("serves the app shell and vendor script", async () => {
  const page = await fetch(base + "/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /The Compass/);
  assert.match(page.headers.get("content-security-policy"), /default-src 'self'/);
  const sortable = await fetch(base + "/vendor/Sortable.min.js");
  assert.equal(sortable.status, 200);
  const status = await (await fetch(base + "/api/status")).json();
  assert.deepEqual(status, { ai: true });
});

test("chat streams NDJSON and sends the guide as the system prompt", async () => {
  calls.length = 0;
  next = (body, res) => sse(res, "Tell me more about **calm**.");
  const res = await post("/api/chat", {
    turns: [
      { role: "assistant", content: "Let's start with values." },
      { role: "user", content: "I like calm.\n\n[Where they are] Step 1" },
    ],
  });
  assert.equal(res.status, 200);
  const lines = (await res.text()).trim().split("\n").map(l => JSON.parse(l));
  assert.deepEqual(lines.at(-1), { done: true, text: "Tell me more about **calm**." });
  assert.ok(lines.length > 2, "expected incremental text lines");

  const { body, headers } = calls[0];
  assert.match(body.system, /You are the Compass/);
  assert.equal(body.stream, true);
  assert.equal(body.messages[0].role, "user", "first message must be a user turn");
  assert.equal(body.messages.at(-1).content, "I like calm.\n\n[Where they are] Step 1");
  assert.equal(body.fallbacks, "default");
  assert.match(headers["anthropic-beta"], /server-side-fallback-2026-07-01/);
});

test("chat rejects malformed turns", async () => {
  for (const turns of [undefined, [], [{ role: "system", content: "x" }], [{ role: "assistant", content: "hi" }], [{ role: "user", content: "x".repeat(50000) }]]) {
    const res = await post("/api/chat", { turns });
    assert.equal(res.status, 400);
  }
});

test("chat reports a refusal as an error line", async () => {
  next = (body, res) => sse(res, "", "refusal");
  const res = await post("/api/chat", { turns: [{ role: "user", content: "hi" }] });
  const lines = (await res.text()).trim().split("\n").map(l => JSON.parse(l));
  assert.equal(lines.at(-1).error, "refused");
});

test("mixIdea uses the quick model with a JSON schema", async () => {
  calls.length = 0;
  next = (body, res) => json(res, JSON.stringify({ idea: "  Community garden educator " }));
  const res = await post("/api/suggest/mixIdea", { data: { know: "Gardening", do: "Teach", love: "Kids", avoid: ["Florist"] } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { idea: "Community garden educator" });
  const { body } = calls[0];
  assert.match(body.model, /haiku/);
  assert.equal(body.fallbacks, undefined, "no server-side fallback on haiku");
  assert.equal(body.output_config.format.type, "json_schema");
  assert.match(body.messages[0].content, /Gardening/);
  assert.match(body.messages[0].content, /Florist/);
});

test("ideas, plan and steps return cleaned results", async () => {
  const profile = { values: ["Calm"], iAm: ["I am a gardener"], north: "x", needs: { pay: "1" }, strengths: { know: ["a"], do: ["b"], love: ["c"] }, first: "Gardener", ideas: [] };

  next = (body, res) => json(res, JSON.stringify({ ideas: [{ title: " Park ranger ", know: "a", do: "b", love: "c", why: "Calm" }, { title: "" }] }));
  assert.deepEqual(await (await post("/api/suggest/ideas", { data: profile })).json(), {
    ideas: [{ title: "Park ranger", know: "a", do: "b", love: "c", why: "Calm" }],
  });

  next = (body, res) => json(res, JSON.stringify({ now: "Start", building: "Build", move: "Move", longer: "Later" }));
  assert.deepEqual(await (await post("/api/suggest/plan", { data: profile })).json(), { now: "Start", building: "Build", move: "Move", longer: "Later" });

  next = (body, res) => json(res, JSON.stringify({ step1: " Call Sam", step2: "Write a list", step3: "Visit a nursery " }));
  assert.deepEqual(await (await post("/api/suggest/steps", { data: { ...profile, planNow: "Start" } })).json(), {
    steps: ["Call Sam", "Write a list", "Visit a nursery"],
  });
  assert.deepEqual(Object.keys(calls.at(-1).body.output_config.format.schema.properties), ["step1", "step2", "step3"]);
});

test("ideas get the needs as a fit filter, without pay, and repeats are dropped", async () => {
  calls.length = 0;
  const profile = {
    values: ["Family"], iAm: ["I am a dad"], north: "School pick-up at three", ideas: ["Solar trainer"],
    needs: { pay: "90000", hours: "38", stress: "Low", mode: "On-site", location: "Gold Coast", other: "School pick-up on Wednesdays" },
    strengths: { know: ["Solar"], do: ["Teach"], love: ["Kids"] },
  };
  next = (body, res) => json(res, JSON.stringify({ ideas: [
    { title: "solar trainer", know: "Solar", do: "Teach", love: "Kids", why: "x" },
    { title: "School electrician", know: "Solar", do: "Teach", love: "Kids", why: "y" },
    { title: "school electrician", know: "Solar", do: "Teach", love: "Kids", why: "z" },
  ] }));
  const out = await (await post("/api/suggest/ideas", { data: profile })).json();
  assert.deepEqual(out.ideas.map(i => i.title), ["School electrician"]);
  const prompt = calls[0].body.messages[0].content;
  assert.match(prompt, /Things the work has to fit: up to 38 hours a week, low stress, on-site, Gold Coast. Also: School pick-up on Wednesdays/);
  assert.doesNotMatch(prompt, /90000/);
});

test("suggestions are checked and capped before anything reaches Claude", async () => {
  calls.length = 0;
  next = (body, res) => json(res, JSON.stringify({ now: "a", building: "b", move: "c", longer: "d" }));
  // Not enough to work with: no strengths for ideas, no top pick for plan, no plan for steps.
  assert.equal((await post("/api/suggest/ideas", { data: { strengths: { know: ["a"] } } })).status, 400);
  assert.equal((await post("/api/suggest/plan", { data: {} })).status, 400);
  assert.equal((await post("/api/suggest/steps", { data: { first: "Gardener" } })).status, 400);
  assert.equal((await post("/api/suggest/mixIdea", { data: { know: "a", do: "b" } })).status, 400);
  assert.equal(calls.length, 0, "nothing was sent upstream");

  // Oversized and junk fields are capped and dropped; blank profile lines are left out.
  const res = await post("/api/suggest/plan", { data: { first: "Gardener", north: "x".repeat(5000), values: [1, { a: 1 }, "Calm"], strengths: { know: Array.from({ length: 50 }, (_, i) => "k" + i) } } });
  assert.equal(res.status, 200);
  const prompt = calls[0].body.messages[0].content;
  assert.ok(prompt.length < 4000, "north star was capped");
  assert.doesNotMatch(prompt, /object Object/);
  assert.doesNotMatch(prompt, /k49/);
  assert.doesNotMatch(prompt, /\$ a year/);
  assert.doesNotMatch(prompt, /Second choice/);
});

test("an empty or repeated answer is asked for once more, then reported", async () => {
  calls.length = 0;
  let n = 0;
  next = (body, res) => json(res, JSON.stringify({ idea: n++ ? "Garden educator" : "Florist" }));
  const res = await post("/api/suggest/mixIdea", { data: { know: "a", do: "b", love: "c", avoid: ["florist"] } });
  assert.deepEqual(await res.json(), { idea: "Garden educator" });
  assert.equal(calls.length, 2);

  calls.length = 0;
  next = (body, res) => json(res, JSON.stringify({ step1: "Only one", step2: "", step3: "" }));
  const short = await post("/api/suggest/steps", { data: { first: "Gardener", planNow: "Start" } });
  assert.equal(short.status, 502);
  assert.deepEqual(await short.json(), { error: "empty_completion" });
  assert.equal(calls.length, 2);
});

test("a reply cut off at max_tokens has its own code", async () => {
  next = (body, res) => json(res, "{\"now\": \"Sta", "max_tokens");
  const res = await post("/api/suggest/plan", { data: { first: "Gardener" } });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: "cut_off" });
});

test("suggest maps errors and unknown tasks", async () => {
  assert.equal((await post("/api/suggest/nope", { data: {} })).status, 404);
  assert.equal((await post("/api/suggest/plan", {})).status, 400);

  next = (body, res) => json(res, "", "end_turn", 429);
  const limited = await post("/api/suggest/plan", { data: { first: "Gardener" } });
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: "rate_limited" });

  next = (body, res) => json(res, "", "refusal");
  assert.deepEqual(await (await post("/api/suggest/plan", { data: { first: "Gardener" } })).json(), { error: "refused" });
});
