# Purposefields Wayfinder

A guided, ten-step career-direction tool for everyday people, with an AI thinking partner ("Talk it through") powered by Claude.

The steps are: Values → Who I am → North Star → What I need → Strengths → Mix ideas → Choose → Plan → First steps → Calendar. The last screen gives a one-page map plus Google Calendar links and `.ics` downloads for the three first steps.

## Run it

Requires Node.js 20+.

```bash
npm install
cp .env.example .env        # then add your ANTHROPIC_API_KEY
npm run dev                 # http://localhost:3000 (reloads on change, reads .env)
```

In production, set the environment variables yourself and run `npm start`. Or use Docker:

```bash
docker build -t wayfinder .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... wayfinder
```

If `ANTHROPIC_API_KEY` isn't set, the app still works end to end. Only the chat and the "Suggest…" buttons are switched off.

## How it's built

| Path | What it does |
|---|---|
| `server.js` | Express server: static files, security headers, `/api/chat` (streams NDJSON), `/api/suggest/:kind`, per-IP rate limit |
| `lib/prompts.js` | The Wayfinder guide (system prompt), the four suggestion prompts and their JSON schemas |
| `lib/claude.js` | Calls Claude through the Anthropic SDK. Chat streams; suggestions use structured JSON output |
| `public/` | The app itself: plain HTML, CSS and JS, no build step. SortableJS is served from `node_modules` |
| `tests/` | `npm test` runs end-to-end API tests against a mock Anthropic server (no key needed) |

Notes:

- **Prompts stay on the server.** The browser can ask only for the chat or for one of the four suggestion types (`mixIdea`, `ideas`, `plan`, `steps`). It can't send its own prompt, and the API key never reaches the browser.
- **Answers are stored in the browser** (`localStorage`) until the person presses Start over. The server doesn't store anything. It passes what the person wrote to Claude when they chat or ask for a suggestion, and the consent screen says so.
- **Safety.** Crisis keywords open the support dialog (Australian services) on the client. The guide prompt also tells Claude to step out of the career conversation and share the same services.
- **Models.** The default is `claude-opus-5-5` (effort `low` for chat, `medium` for suggestions) and `claude-haiku-5-5` for the quick single-mix idea. Change them with `WAYFINDER_MODEL` / `WAYFINDER_QUICK_MODEL`. Server-side refusal fallback (`fallbacks: "default"`) is on for non-Haiku models; turn it off with `WAYFINDER_FALLBACKS=off`.
- **Rate limit.** 20 AI requests per IP per minute by default (`RATE_LIMIT_PER_MIN`). The limit is kept in memory, so it covers a single instance only. Set `TRUST_PROXY` when you run behind a reverse proxy.
