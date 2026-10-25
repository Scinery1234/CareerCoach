import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { streamChat, runTask, errorCode } from "./lib/claude.js";
import { TASKS } from "./lib/prompts.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const MAX_TURNS = 30;
const MAX_TURN_CHARS = 40000;
const MAX_CHAT_CHARS = 160000;

const STATUS = {
  bad_request: 400,
  unavailable: 503,
  rate_limited: 429,
  prompt_too_large: 413,
  overloaded: 503,
  refused: 422,
  empty_completion: 502,
  connection: 502,
  error: 500,
};

const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

// A small in-memory limiter: N AI requests per IP per minute.
function rateLimiter(perMinute) {
  const hits = new Map();
  setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [ip, times] of hits) {
      const kept = times.filter(t => t > cutoff);
      if (kept.length) hits.set(ip, kept);
      else hits.delete(ip);
    }
  }, 60_000).unref();
  return (req, res, next) => {
    const now = Date.now();
    const times = (hits.get(req.ip) || []).filter(t => t > now - 60_000);
    if (times.length >= perMinute) {
      res.set("Retry-After", "30");
      return res.status(429).json({ error: "rate_limited" });
    }
    times.push(now);
    hits.set(req.ip, times);
    next();
  };
}

function requireAi(req, res, next) {
  if (!aiConfigured()) return res.status(503).json({ error: "unavailable" });
  next();
}

function validTurns(turns) {
  if (!Array.isArray(turns) || !turns.length) return null;
  const recent = turns.slice(-MAX_TURNS);
  let total = 0;
  for (const t of recent) {
    if (!t || (t.role !== "user" && t.role !== "assistant") || typeof t.content !== "string") return null;
    if (!t.content.trim() || t.content.length > MAX_TURN_CHARS) return null;
    total += t.content.length;
  }
  if (total > MAX_CHAT_CHARS || recent.at(-1).role !== "user") return null;
  return recent;
}

// Abort the upstream request if the browser goes away.
function abortOnClose(req, res) {
  const ctl = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) ctl.abort();
  });
  return ctl.signal;
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);

  app.use((req, res, next) => {
    res.set({
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join("; "),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    next();
  });

  app.use(express.static(path.join(here, "public"), { extensions: ["html"] }));
  app.get("/vendor/Sortable.min.js", (req, res) =>
    res.sendFile(path.join(here, "node_modules/sortablejs/Sortable.min.js")),
  );

  app.get("/healthz", (req, res) => res.json({ ok: true }));
  app.get("/api/status", (req, res) => res.json({ ai: aiConfigured() }));

  const limit = rateLimiter(Number(process.env.RATE_LIMIT_PER_MIN) || 20);
  const api = express.Router();
  api.use(express.json({ limit: "256kb" }));

  // Chat replies stream back as newline-delimited JSON:
  // {"text": "...so far"} lines, then {"done": true, "text": "..."} or {"error": "code"}.
  api.post("/chat", requireAi, limit, async (req, res) => {
    const turns = validTurns(req.body?.turns);
    if (!turns) return res.status(400).json({ error: "bad_request" });
    const signal = abortOnClose(req, res);
    res.status(200).set({
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    const line = o => {
      if (!res.writableEnded) res.write(JSON.stringify(o) + "\n");
    };
    let last = "";
    try {
      const text = await streamChat(turns, {
        signal,
        onText: t => {
          last = t;
          line({ text: t });
        },
      });
      line({ done: true, text });
    } catch (e) {
      const code = errorCode(e);
      if (code !== "cancelled") {
        if (code === "error") console.error("chat failed:", e);
        line({ error: code, text: code === "refused" ? "" : last });
      }
    }
    res.end();
  });

  api.post("/suggest/:kind", requireAi, limit, async (req, res) => {
    const { kind } = req.params;
    if (!Object.hasOwn(TASKS, kind)) return res.status(404).json({ error: "bad_request" });
    const data = req.body?.data;
    if (!data || typeof data !== "object") return res.status(400).json({ error: "bad_request" });
    try {
      res.json(await runTask(kind, data, { signal: abortOnClose(req, res) }));
    } catch (e) {
      const code = errorCode(e);
      if (code === "cancelled") return;
      if (code === "error") console.error(`suggest/${kind} failed:`, e);
      res.status(STATUS[code] || 500).json({ error: code });
    }
  });

  api.use((err, req, res, next) => {
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "prompt_too_large" });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "bad_request" });
    next(err);
  });

  app.use("/api", api);
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => {
    console.log(`Wayfinder running at http://localhost:${port}`);
    if (!aiConfigured()) console.log("ANTHROPIC_API_KEY is not set: the steps work, but chat and suggestions are off.");
  });
}
