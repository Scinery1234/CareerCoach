# Test report: the AI coaching tools in The Compass

Date: 6 November 2026. Scope: the "Talk it through" chat and the four suggestion tools (`mixIdea`, `ideas`, `plan`, `steps`), plus the step flow that feeds them.

## How it was tested

| Method | What it covered |
|---|---|
| `npm test` | Existing 7 API tests. All pass. |
| Playwright, full 10-step walkthrough, AI off | A person without a key: every step, summary, `.ics` download, Google Calendar link, going back to edit after finishing. |
| Playwright, full walkthrough, AI on (mock Anthropic server) | Chat streaming, chat failures (500, refusal, 529), markdown in replies, crisis keywords, the per-mix suggest button, "Suggest ideas", "Suggest a path", "Suggest 3 steps", the tap-again guard, truncated JSON, phone width (390px). |
| Direct API probes | Empty profiles, 200 KB fields, tampered types, upstream 400 mapping. |
| Prompt inspection | The exact prompt text built for four personas: a tradie dad, a Tamil mum on NDIS work, an empty profile, and a tampered client. |

What was **not** tested: real model output. No API key is available in this environment. `scripts/eval-live.mjs` (new) runs four personas through every tool and the chat against the real API and checks replies against the guide's own rules. Run it with a key before and after any prompt change:

```bash
ANTHROPIC_API_KEY=sk-ant-... node scripts/eval-live.mjs
```

## What works well

- The steps work end to end with or without a key, state survives reloads, and the layout holds at phone width with no horizontal scroll.
- Prompts stay on the server; the browser can only ask for the five fixed jobs. The CSP is tight and the key never reaches the client.
- Structured outputs with a strict JSON schema mean the suggestion tools can't return the wrong shape.
- The chat context note (`[Where they are]`) is attached only to the newest message, so stored history stays clean.
- The chat sends the message to Claude even when the crisis dialog opens, so the model also gets to respond with care.
- A suggestion for a mix goes into the input, not the list: the person still has to press Add. That matches the "the person does the thinking" principle.

## Problems found

Severity: **High** = wrong or misleading result for a real person. **Medium** = degrades the experience or wastes money. **Low** = polish.

### 1. The idea generator ignores "What I need" (High)

The person spends a whole step saying what work has to look like (hours, home or on-site, location, "school pick-up on Wednesdays"), but the `ideas` prompt in `lib/prompts.js` never receives any of it. Only `plan` and `steps` get the needs line. In the mock run the model could return "FIFO mine electrician" for a dad whose North Star is school pick-up at three, and nothing stops it.

**Fix.** Add the needs to the `ideas` prompt as a fit filter, not a judgement, keeping the "don't comment on pay or demand" rule:

```
Things the work has to fit: up to 38 hours a week, on-site, Gold Coast, no long drives. Also: school pick-up on Wednesdays.
Only suggest ideas that could fit those. Don't mention pay or how in demand anything is.
```

Leave pay out of the filter if you want to keep the no-pay-talk rule simple, or include it only as "lowest pay they can accept" without asking the model to judge.

### 2. Suggestions that come back short or duplicated are shown as-is (High)

- `steps`: when the model returns two steps, the third input is left blank with no notice (seen in the mock run). The schema allows any array length.
- `ideas`: a suggested idea that matches one the person already has ("Solar trainer") is shown again, and so is one already in the suggestions list. There is no de-duplication on the server or in `public/app.js`.
- `mixIdea`: "Suggest another" can return the same idea that was just added, since the only guard is the prompt's "don't repeat" sentence.
- `ideas` asks for five but `read` keeps up to six.

**Fix.**
- Make the `steps` schema an object with three required fields (`step1`, `step2`, `step3`) instead of an array, so the schema guarantees exactly three. Do the same for `ideas` if five is a hard requirement (`idea1`..`idea5`).
- In `TASKS.ideas.read` and `TASKS.mixIdea.read`, drop results whose title matches an existing idea or suggestion, case-insensitively, and retry once if the result is empty.
- In the client, when fewer than three steps come back, show "Only two steps came back. Add a third yourself or try again."

### 3. Empty or junk profiles are sent to Claude (Medium)

`/api/suggest/plan` with `{ data: {} }` makes a full Opus call with a prompt that reads "lowest pay $ a year, up to  hours a week, stress: , where: " and "Top pick direction: ". A 200 KB `know` field is passed straight into the prompt (HTTP 200, 200,313 characters sent upstream). Objects become `[object Object]`. The UI prevents most of this, but the API doesn't, and the endpoint is unauthenticated apart from the per-IP limit.

**Fix.** Validate per task in `server.js` or `lib/prompts.js` before calling Claude:
- `ideas`: at least one entry in each of know, do, love.
- `plan` and `steps`: `first` non-empty; `steps` also needs `planNow`.
- Cap every string (say 300 characters for list items, 2,000 for the North Star and plan text) and every list (say 30 items), and drop non-string list items. Return 400 `bad_request` otherwise.
- Omit blank lines from `profileText` instead of printing "$ a year".

### 4. Upstream errors show the wrong message (Medium)

Observed in the mock run:

| Upstream | What the person sees |
|---|---|
| 500 from Anthropic in chat | "The connection dropped. Try sending again." |
| 400 `invalid_request_error` (for example prompt too long) on a suggestion | HTTP 500, "That didn't work. Try again." |
| 529 overloaded on a suggestion | "That didn't work. Try again." |
| Truncated JSON (`stop_reason: max_tokens`) | "That didn't work. Try again." |

The chat `ERR` map in `public/app.js` has no entry for the generic `error` code, so it falls through to the "connection dropped" text, which sends people to check their Wi-Fi. `aiErr` for suggestions only knows three codes, so `overloaded` and `refused` both read as "That didn't work."

**Fix.**
- Add `error: "Something went wrong on our side. Try again in a moment."` to `ERR`, and handle `overloaded` and `refused` in `aiErr` with the same wording the chat uses.
- In `lib/claude.js`, map `BadRequestError` whose message contains "too long" or "tokens" to `prompt_too_large`, and `stop_reason === "max_tokens"` to its own code (for example `cut_off`) rather than `empty_completion`.

### 5. Crisis detection is keyword-only and fires on ordinary phrases (Medium)

"I can't go on doing night shifts, it's wrecking me" opens the full crisis dialog (the list includes "can't go on"). "I just want to disappear and never wake up" does not. The model is also told to respond, so the real safety net is the guide prompt, but the dialog is the visible one.

**Fix.**
- Treat the keyword list as a hint, not a verdict: for the softer phrases ("can't go on", "end it all", "overdose") show an inline, dismissable line under the chat ("If things are feeling heavy, Lifeline is 13 11 14") rather than a modal, and keep the modal for explicit phrases.
- Add a tiny server-side flag: ask the chat model to begin a crisis reply with a fixed marker (for example `[support]`) that the client strips and uses to open the dialog. That catches phrasing the list misses without a second model call.
- Add a few phrases the list misses: "never wake up", "disappear", "better off without me", "no point".

### 6. The chat stores messages that were never sent (Low)

With chat off, the Send button is disabled but Enter still works: `go()` in `public/app.js` calls `send()` which pushes the message into `turns` and returns at `if(!aiOn)`. The message sits in the log with no reply and no notice, and is later sent as history if the site gains a key.

**Fix.** In `go()`, return early when `!aiOn` and show the existing "Chat isn't switched on" line, or let the keydown handler check `aiOn`.

### 7. After a failed reply, the next request has two user turns in a row (Low)

When a chat call fails with no partial text, the user turn stays in history. The next request is `…, user, user`. The API merges consecutive same-role turns, so it works, but the first message is never answered and the model sees both as one. If the model refuses, the orphaned turn is resent every time.

**Fix.** On a failed reply with no text, either pop the user turn from `turns` and put the text back in the box, or mark it `unsent` and skip it when building the request.

### 8. Markdown from the model is shown raw (Low)

The guide asks for plain text with bold only, but if the model returns a list or heading the bubble shows `- Nurse` and `# Heading` literally. Seen with the mock; the live script checks whether it happens with the real model.

**Fix.** Either render a small safe subset (lists, line breaks) in `rich()`, or strip leading list markers before display.

### 9. The rate limit is shared by everything and is easy to hit on the Mix step (Low)

20 requests per IP per minute covers chat and all four suggestion kinds. The Mix step shows ten "Suggest an idea for this mix" buttons, each with a "Suggest another" follow-up, next to a chat. A curious person can hit 20 in a minute, and the message they get on the mix button is the error text in the button itself ("Too many requests just now…" becomes the button label). Shared household or office IPs behind NAT share one bucket.

**Fix.** Raise the default to 40 and give `mixIdea` (Haiku, cheap) its own, higher bucket. Show rate-limit errors in the status span, not the button label.

### 10. Things the model is told that aren't true, and gaps in the guide (Low)

- The guide says "Every message from the person ends with a [Where they are] note". Only the latest one does; older user turns in history have none. Change to "The newest message from the person ends with…".
- The context note includes the step's full intro text every time (about 560 characters at step 1, more later). Harmless, but the model already said those words; the step name and answers are enough.
- The guide says nothing about what to do when the person asks "is this realistic?" beyond "help them explore what they think". It should also tell the model it can say plainly that the app doesn't judge ideas, so the refusal doesn't feel evasive.
- The guide forbids writing the North Star but allows "a few options built only from words they've already used". The client has no way to move chat text into the panel, so the person retypes it. A "Use these words" button on the AI bubble that copies text into the current step's field would close the loop.
- Services are Australian only. The app is built for Australia, so this is fine, but the `TZ` detection shows the app knows when it's elsewhere. Consider a one-line note on the consent screen.

### 11. Things to verify with the real API (Unknown)

These can't be confirmed without a key. `scripts/eval-live.mjs` will show the first two straight away.

- `output_config.effort` is sent to `claude-haiku-5-5` for `mixIdea`. Confirm Haiku accepts it; if not, every mix suggestion fails with a 400 that shows as "That didn't work."
- `output_config.format: json_schema` is sent without the `structured-outputs-2025-11-13` beta header, while the server-side fallback beta header is sent. Confirm structured outputs is GA for the models used or add the header.
- With the `fallbacks: "default"` setting, a refused request may be served by another model with a different voice. Check that the fallback model still follows the guide's tone.
- `max_tokens: 8000` on a chat that asks for two to five sentences. Fine for cost since output is short, but a runaway reply would be long and expensive. 1,000 is plenty.
- Opus 5.5 on every chat turn is the most expensive option. Sonnet 5.5 is likely enough for this reflective style; try it via `COMPASS_MODEL` and compare with the live script.

### 12. Smaller things noticed along the way

- `npm run dev` uses `--env-file-if-exists`, which arrived in Node 22.9. The README says Node 20+. Either bump the README or use `--env-file`.
- The `.ics` files use `TZID=<zone>` without a `VTIMEZONE` block. Google and Apple cope; some Outlook builds show the wrong time. Either emit UTC `DTSTART` or include a VTIMEZONE.
- Adding a strength after the Mix step doesn't change the ten mixes until the person presses Remix, so a new strength can go unused. A hint ("You added Plumbing. Press Remix to mix it in.") would help.
- After finishing, every step shows a tick and the person can go back and change answers that later steps depend on (for example remove the top pick), and the summary still shows the old pick. Re-run `sync()` on the summary or warn when a dependency changes.
- Chat history grows without limit in `localStorage` (about 7 KB after one run, so no practical problem for a long while).
- The per-mix button turns into the error message text on failure. Use the status span pattern the other controls use.

## Suggested order of work

1. Add needs to the `ideas` prompt (item 1) and fixed-size schemas plus de-duplication (item 2). These change what people get.
2. Server-side validation and field caps (item 3). Cheap, protects the bill.
3. Error wording (item 4) and the Enter-key case (item 6). Small client changes.
4. Run `scripts/eval-live.mjs` with a key, read the raw replies in `eval-results.json`, and tune the guide (items 10 and 11).
5. Crisis handling (item 5) once the model-side marker is in place.
