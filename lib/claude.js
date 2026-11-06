import Anthropic from "@anthropic-ai/sdk";
import { GUIDE, TASKS } from "./prompts.js";

export const CHAT_MODEL = process.env.COMPASS_MODEL || "claude-opus-5-5";
export const QUICK_MODEL = process.env.COMPASS_QUICK_MODEL || "claude-haiku-5-5";

// Server-side refusal fallback ("default" routes by refusal category).
// Haiku has no server-side fallback, so it's left off there.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const withFallback = (model, params) =>
  /haiku/.test(model) || process.env.COMPASS_FALLBACKS === "off"
    ? { ...params, model }
    : { ...params, model, betas: [FALLBACK_BETA], fallbacks: "default" };

let client = null;
export function getClient() {
  if (!client) client = new Anthropic();
  return client;
}
export function setClient(c) {
  client = c;
}

// Map SDK errors to the short codes the browser knows how to explain.
export function errorCode(e) {
  if (e instanceof Anthropic.APIUserAbortError) return "cancelled";
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return "unavailable";
  if (e instanceof Anthropic.RateLimitError) return "rate_limited";
  if (e instanceof Anthropic.APIError && e.status === 413) return "prompt_too_large";
  if (e instanceof Anthropic.BadRequestError && /too long|tokens|too large/i.test(e.message || "")) return "prompt_too_large";
  if (e instanceof Anthropic.APIError && e.status === 529) return "overloaded";
  if (e instanceof Anthropic.APIConnectionError) return "connection";
  if (e?.code && typeof e.code === "string" && !(e instanceof Anthropic.APIError)) return e.code;
  return "error";
}

const fail = code => Object.assign(new Error(code), { code });

/**
 * Stream a chat reply. `turns` is the conversation (user/assistant strings);
 * the last turn must be the person's newest message, already carrying the
 * [Where they are] note. Calls onText(fullTextSoFar) as text arrives.
 */
export async function streamChat(turns, { onText, signal } = {}) {
  const messages = turns.map(t => ({ role: t.role, content: t.content }));
  // The conversation opens with the app's own intro (an assistant turn); the
  // API needs a user turn first.
  if (messages[0]?.role !== "user") messages.unshift({ role: "user", content: "(I've opened the Compass.)" });

  const stream = getClient().beta.messages.stream(
    withFallback(CHAT_MODEL, {
      // Replies are two to five sentences; this is plenty and caps a runaway reply.
      max_tokens: 1000,
      system: GUIDE,
      output_config: { effort: "low" },
      messages,
    }),
    { signal },
  );
  let text = "";
  stream.on("text", delta => {
    text += delta;
    onText?.(text);
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw Object.assign(fail("refused"), { text: "" });
  if (!text.trim()) throw fail("empty_completion");
  return text;
}

/** Clean and check the data for a task. Returns null when there isn't enough to work with. */
export function prepareTask(kind, data) {
  const task = TASKS[kind];
  if (!task || !data || typeof data !== "object") return null;
  return task.clean(data);
}

async function callTask(task, data, signal) {
  const model = task.quick ? QUICK_MODEL : CHAT_MODEL;
  const msg = await getClient().beta.messages.create(
    withFallback(model, {
      max_tokens: 4000,
      output_config: { effort: task.quick ? "low" : "medium", format: { type: "json_schema", schema: task.schema } },
      messages: [{ role: "user", content: task.prompt(data) }],
    }),
    { signal },
  );
  if (msg.stop_reason === "refusal") throw fail("refused");
  if (msg.stop_reason === "max_tokens") throw fail("cut_off");
  const textBlock = msg.content.find(b => b.type === "text");
  if (!textBlock?.text) throw fail("empty_completion");
  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw fail("empty_completion");
  }
  return task.read(parsed || {}, data);
}

/**
 * Run one of the structured suggestion tasks on data already passed through
 * prepareTask(). If the answer comes back empty (for example every idea was a
 * repeat), ask once more before giving up.
 */
export async function runTask(kind, data, { signal } = {}) {
  const task = TASKS[kind];
  if (!task || !data) throw fail("bad_request");
  let result = await callTask(task, data, signal);
  if (task.empty?.(result)) result = await callTask(task, data, signal);
  if (task.empty?.(result)) throw fail("empty_completion");
  return result;
}
