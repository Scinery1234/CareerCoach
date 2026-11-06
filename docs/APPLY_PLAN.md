# Apply: plan in four phases

What this adds to AI Career Coach: an application log that Sky can see and offer to coach on, early alerts for new Seek and Indeed jobs that fit, and a browser extension that carries the tailored resume and cover letter into Seek Quick Apply and Indeed Apply with the member clicking Submit.

The product already has the hard parts: the resume agent (`api/_py/resume_agent`), the tailor step (`lib/newpage-tailor.js`, `resume_tailor` in `api/newpage/app.js`), the two-pass cover letter writer (`lib/newpage-cover.js`) and Sky with memory and tools (`lib/newpage-coach.js`). Every phase below builds on those patterns and nothing here changes how they write.

Principles that hold through all four phases:

- Nothing is submitted to an employer by software. A person clicks Apply or Submit every time.
- Indeed and LinkedIn get autofill only, ever. Seek gets pre-fill with the member on the page. No unattended mode on any board.
- The server never fetches a Seek, Indeed, Jora or LinkedIn page. Discovery is the licensed Adzuna feed plus what the member sees in their own browser.
- Fewer, better applications. Sky coaches toward fit and follow-through, not volume. It offers the help; the member decides.
- Member data stays under the member's key where it is personal (same as the resume and "about you" today).

---

## Phase 1: the application log (about 1 week)

**Goal.** Every tailored resume or cover letter can be marked as applied, with the job it went to, and the member can update what happened. The Today tab shows the pipeline. This is the data Phase 2 and Phase 3 run on.

### Data

New table in `sql/newpage.sql`:

```sql
CREATE TABLE IF NOT EXISTS newpage_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES newpage_members(id) ON DELETE CASCADE,
  title text NOT NULL,                 -- role title as the member knows it
  company text,
  board text CHECK (board IN ('seek','indeed','linkedin','jora','employer','other')),
  url text,                            -- the ad, if there is one
  job_description text,                -- the ad text (so Sky and the fit score can read it later)
  resume_doc_id uuid REFERENCES newpage_docs(id) ON DELETE SET NULL,
  cover_doc_id uuid REFERENCES newpage_docs(id) ON DELETE SET NULL,
  fit jsonb,                           -- {score, strong, partial, missing} copied from the tailor match table
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('saved','applied','viewed','screening','interview','offer','rejected','withdrawn','no_reply')),
  applied_at date,
  status_at timestamptz DEFAULT now(),
  notes text,
  source text DEFAULT 'member' CHECK (source IN ('member','alert','extension')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON newpage_applications (member_id, applied_at DESC);
```

Plus a member setting for the weekly target, on `newpage_tools` as tool `apply` (data `{ weeklyTarget: 3, boards: [...], roles: [...], locations: [...] }`). This avoids a members-table migration and is the same place other tool state lives. `apply` goes in `PRIVATE_TOOLS` so it is sealed with the member's key.

`title`, `company`, `notes` and `job_description` are personal, so they are stored sealed with `sealText` the way messages and memory are, and opened on read. Status, dates and board stay plain so the cron and the pipeline summary can query them.

### Server (`api/newpage/app.js`)

New actions, same shape as the task actions:

| Action | Body | Does |
|---|---|---|
| `apply_list` | | Last 200 applications, opened, newest first |
| `apply_add` | `title, company, board, url, job, resume_doc_id, cover_doc_id, status, applied_at` | Validates ids belong to the member, copies `fit` from the resume doc's `content.tailored.match` if present |
| `apply_update` | `id, status, applied_at, notes` | Status change sets `status_at` |
| `apply_delete` | `id` | |
| `apply_settings_get` / `apply_settings_set` | `weeklyTarget, boards, roles, locations` | Via `getTool`/`setTool('apply')` |

`me()` gains `pipeline`: `{ weeklyTarget, thisWeek, lastWeek, open, byStatus, recent: [last 5] }` computed in a new `lib/newpage-apply.js` (pure functions, tested without a database). Weeks are Monday to Sunday, Sydney time, matching `monthKey` in `lib/newpage-usage.js`.

### Member app

- **End of the tailor flow** (`app/resume.js`, `tailorView`): a card under the match table, "Did you apply?" with board picker, optional URL, and an "I applied" button. Pre-fills title and company from `content.tailored`. On save, the card becomes "Logged. Update it when you hear back."
- **End of the cover flow** (`app/cover.js`, after the review card): same card. If the cover was handed over from a tailored resume (`L.resumeId`), the log entry links both documents.
- **New tool screen** `apply` under "Get hired" in `TOOL_GROUPS` (`app/app.js`): "Applications". A list grouped by status with one-tap status changes (Viewed, Interview, Rejected, No reply), a manual "Add one I applied for elsewhere" form, and the weekly target setting.
- **Today tab** (`toolsToday` in `app/app.js`): a Pipeline card. "2 of 3 this week. 1 interview coming up. 4 waiting to hear." Links to the Applications tool.

### Sky

Minimal in Phase 1: `coachSystem` gets one line when `pipeline` exists: applications this week against target and the open count, so Sky can refer to it. Full coaching behaviour is Phase 2.

### Tests

- `tests/newpage-apply.test.js`: week boundaries in Sydney time, pipeline summary from a list, status transitions, `fit` copied from a tailored doc.
- Extend `tests/newpage-app.test.js`: `buildMe` carries `pipeline`.

### Done when

A member tailors a resume, writes the letter, marks it applied, sees it on Today, and a week later marks it "Interview". Sky mentions it unprompted.

---

## Phase 2: Sky offers help with applying (about 1 week)

**Goal.** Sky notices when a member is at the applying stage, offers to help with it, and coaches them through it if they say yes. Members rarely know Sky can do this, so Sky brings it up. A no is respected, and Sky may return to it later when the pipeline shows something worth naming. The help itself is person-centred in the Action focus style, never a scorecard.

### Stage detection (code, not the model)

`lib/newpage-apply.js#applyStage` returns one of `not_yet`, `ready`, `applying`, `stalled`, `waiting` from data already in the account:

| Stage | Signal |
|---|---|
| `not_yet` | No approved resume |
| `ready` | An approved resume, or a tailored resume or cover letter made in the last 14 days, and no application logged |
| `applying` | At least one application logged in the last 14 days |
| `stalled` | Documents made or alerts opened in the last 14 days but nothing logged for 7 or more days, or nothing logged in the 7 days after a rejection |
| `waiting` | Applications open and more than 10 days old, nothing new |

The stage and a short pipeline line (this week's count, target if set, open count, last outcome) go into `coachSystem` for every focus.

### The offer

Sky's prompt, Career focus and the other general focuses, gains:

- When the stage is `ready`, `applying`, `stalled` or `waiting` and you have not yet offered, bring it up once, briefly, in your own voice, and ask whether they would like help with the applying side: finding the right ads, getting a tailored resume and letter out the door, or keeping going when it is hard. Tell them in one sentence what you can do (see their applications, help them log and track, talk through what gets in the way, set a weekly rhythm if they want one). Then follow their answer.
- If they say no, let it go. Save that with `save_memory` ("Does not want help with applying for now, said on <date>").
- You may raise it again, once, when something has changed: the stage moves to `stalled` or `waiting`, a pattern line appears (below), or they mention applying, rejection or interviews themselves. Name what you noticed in one plain sentence and ask, do not push. If they say no again, stop offering unless they ask.
- If they say yes, suggest switching to the Applying focus, or just carry on in the current conversation using the same approach.

Whether an offer has been made, and the answer, lives in memory (the existing encrypted `newpage_memory`) so it survives across focuses and sessions and the member can see and delete it in Your context.

### Discoverability outside the chat

- A one-time card on Today when the stage first becomes `ready`: "Sky can help with applying. Track what you send, see what comes back, and talk it through." Buttons: Talk to Sky, Not now.
- The Applying focus appears in the focus list with the others, so it can be found without being offered.
- The "Did you apply?" card at the end of the tailor and cover flows (Phase 1) has a line: "Logged applications show up for Sky, so you can talk them through."

### The Applying focus

A new entry in `COACHES` (`lib/newpage-coaches.js`), next to Action and in the same register:

- **name** Applying. **blurb** "Getting applications out, and keeping going." **when** "You have the resume and the ad and still haven't pressed Apply, you've gone quiet after a rejection, or you want a rhythm." **how** "Looks at your applications with you, asks what's getting in the way, and helps you find your own next step."
- **prompt**, modelled on Action: person-centred, grounded in self-determination theory, ACT and solution-focused coaching. Avoid advice; listen, reflect, ask one question. The pipeline is shared ground: Sky may name what it shows in one plain sentence and ask how that sits with them. The work is the resistance: fear of rejection, imposter feelings about a stretch role, perfectionism on the letter, avoidance after a bad interview, and the practical side of a weekly rhythm when the member wants one. When they find their own next step, offer to add it to the list. If nothing is being viewed after eight or ten applications, Sky may say so and wonder aloud with them whether the targeting, the Seek Profile or the base resume is the thing to look at, rather than more applications.
- **Pattern lines**, computed in code and available in every focus (they are also re-offer triggers): silence for N days after a rejection, the same "missing" requirement across several tailor match tables, saved jobs never moved to applied, several alerts dismissed for the same reason, many applications and nothing viewed.
- **Tools**: `log_application` and `update_application` (after the member says it happened), `set_weekly_target` (after they choose one). Added to `COACH_TOOLS` and run through `tools.run` in the `coach` action. Available in every focus.

### Check-in email

Offered by Sky in the Applying focus when the member wants something to keep them going, and a switch in the Applications tool. Off until chosen. One line from Sky in the Applying voice from the pipeline line, a button to continue the conversation. New cron `api/newpage/applycheck.js`, Sundays around 5pm Sydney.

### Tests

- `tests/newpage-apply.test.js`: `applyStage` for each stage with fixture data; pipeline line; pattern detectors.
- `tests/newpage-coach.test.js`: the offer rules are in the general prompts; the Applying focus carries the never-propose-a-target-unasked rule; tools present.
- Persona eval (the script on `claude/keen-sagan-rh269f`): (a) `ready` member talking about something else, Sky offers once and follows their answer; (b) member who said no last week, now `stalled`, Sky names what changed and asks once; (c) `applying` member who accepts, Sky reflects the pipeline once and asks one question.

### Done when

A member who has just approved a resume hears from Sky, once, that it can help with applying. If they decline, the next conversation is about whatever they bring. If they later go quiet after a rejection, Sky mentions it once more and asks. If they accept at any point, they leave the conversation with their own next step on the list.

## Phase 3: early alerts (about 2 weeks)

**Goal.** New Seek and Indeed jobs that fit the member appear on Today and by email within an hour of being indexed, with a fit verdict in the member's own terms, and one tap opens the tailor step with the ad already loaded.

### Source

Adzuna API, Australia (`https://api.adzuna.com/v1/api/jobs/au/search/{page}`), with `app_id`/`app_key` in `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`. It indexes Seek, Indeed, Jora and employer sites and returns a `redirect_url` to the original listing. Rate limits are low on the free tier, so one poll per member per hour is the budget, and polling is batched by distinct (role, location) pairs across members so two members in Brisbane wanting "disability support worker" share a call. Confirm the tier limits at sign-up; paid tiers exist if volume needs them.

### Data

```sql
CREATE TABLE IF NOT EXISTS newpage_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES newpage_members(id) ON DELETE CASCADE,
  external_id text NOT NULL,           -- adzuna id
  title text, company text, location text, salary text,
  url text NOT NULL,                   -- redirect_url
  board text,                          -- guessed from the redirect host: seek, indeed, jora, employer
  posted_at timestamptz,
  snippet text,
  fit jsonb,                           -- {score 0-100, verdict, reasons[], concerns[]}
  state text DEFAULT 'new' CHECK (state IN ('new','seen','opened','dismissed','applied')),
  dismiss_reason text,                 -- pay, location, hours, level, not_for_me
  created_at timestamptz DEFAULT now(),
  UNIQUE (member_id, external_id)
);
```

Member search preferences live in the `apply` tool setting from Phase 1: roles (up to 5 titles), locations (suburb or city plus a radius), salary floor, hours (full time, part time, casual), and a fit floor (default 60).

### The poll

Cron `api/newpage/alerts.js`, hourly (`vercel.json`). Steps:

1. Load active members with alert preferences and an approved resume.
2. Group by (role, location). One Adzuna call per group, `max_days_old=1`, sorted by date.
3. For each new (member, job) pair not already in `newpage_alerts`, score fit.
4. Insert alerts above the member's floor as `new`. Insert the rest as `dismissed` with reason `fit`, so they are not re-scored.

### Fit score

`lib/newpage-fit.js`. One `askJson` call per job per member at low effort on Sonnet, with a strict schema `{score, verdict, reasons[3], concerns[2]}`. Inputs: the ad snippet and title, the member's resume text (`resumeText`, trimmed), their Compass top values and North Star if present, their `limits` and `goals` from "about you". The prompt asks for fit in the member's terms ("you said mornings matter; this is rotating shifts"), never a keyword count. Cost control: a cheap pre-filter in code (title similarity to the member's roles, salary floor, location) runs first so most jobs never reach the model.

Adzuna gives a snippet, not the full ad. Scoring uses the snippet. When the member taps through and pastes the full ad into the tailor step, the match table is the real verdict.

### Member app

- **Today**: an Alerts card above the Pipeline card. "3 new fits since yesterday." Each row: title, company, board, posted-ago, fit verdict in one line. Buttons: Open (the listing in a new tab, state `opened`), Tailor (jumps to the Resume writer in tailor mode with role and company filled and a prompt to paste the ad; state stays `opened` until logged), Dismiss with a one-tap reason.
- **Applications tool** gains a "Search preferences" section: roles, locations, salary floor, hours, fit floor, alert emails on or off.
- Dismiss reasons feed `pipelineLines` in Phase 2 so Sky can say "you dismissed five for pay this week; is the floor right?"

### Email

In the hourly cron, after inserting: for members with alert emails on, if there are new alerts above 75 and no alert email in the last 6 hours, send one email with up to 3 jobs (`alertEmail` in `lib/newpage-emails.js`). Subject: "New on Seek: Disability Support Worker, Logan, posted 40 minutes ago". The point is to be early, so the 6-hour throttle is per member, not per day.

### Why this is "early"

Adzuna indexes new listings within hours. Polling hourly and emailing immediately puts the member in front of the ad on the day it opens, with a tailored resume thirty seconds away. That is the measurable edge. Phase 4 shortens it further with passive capture.

### Tests

- `tests/newpage-fit.test.js`: pre-filter logic, schema cleaning, score clamping.
- `tests/newpage-alerts.test.js`: grouping by (role, location), dedupe against existing alerts, throttle logic, board guessed from the redirect host.
- A recorded Adzuna response as a fixture so the parser is tested without the network.

### Done when

A member sets "Aged care worker, Geelong", and within an hour of a new Seek listing being indexed they have a Today card and an email, tap Tailor, paste the ad, and apply the same morning.

---

## Phase 4: the browser extension (4 to 5 weeks)

**Goal.** A Chrome and Edge extension, paired to the member's account in one click, that pre-fills Seek Quick Apply and Indeed Apply from the member's tailored resume and cover letter, drafts answers to employer questions, shows the fit verdict beside the form, logs the application when the member submits, and quietly captures the member's own Seek, Indeed and Jora searches into the alert queue.

### Folder and build

`extension/` in this repo. Manifest V3, plain JS, no bundler (consistent with the app). Files:

```
extension/
  manifest.json
  background.js          service worker: pairing, token refresh, queue, passive capture store
  sidepanel.html/.js     the review panel: fit, documents, answers, Log it
  content/seek.js        Seek adapter
  content/indeed.js      Indeed adapter (autofill only)
  content/capture.js     passive capture of search results pages
  content/common.js      form helpers: label matching, fill, detect submit
  pair.html              first-run page
```

Host permissions limited to `*.seek.com.au`, `*.seek.co.nz`, `*.indeed.com`, `au.indeed.com`, `au.jora.com` and `aicareercoach.net`. No `<all_urls>`. Web Store listing describes it as an assistant that fills forms you then submit yourself.

### Pairing and auth

- Member opens Tools, Applications, "Set up the browser helper". The page shows an Install button (Web Store link) and, once the extension is present (detected by `chrome.runtime.sendMessage` to the known extension id), a "Connect" button.
- Connect calls a new action `extension_pair` which issues a long-lived refresh token scoped to the extension (stored in a new `newpage_extension_tokens` table with a hash, member id, created, last used, revoked). The app posts it to the extension via `externally_connectable`.
- The extension exchanges it for short-lived access tokens through `api/newpage/extension.js`, a new endpoint that exposes a narrow set of actions: `ext_profile` (sealed-opened resume text, contact, standard answers), `ext_docs` (the member's tailored resumes and covers, titles and ids), `ext_docx` (one document's bytes), `ext_answers` (draft answers to employer questions for one ad), `ext_fit` (fit verdict for one ad), `ext_log` (create the application), `ext_capture` (post captured listings). Per-member rate limits on each, same `rateLimit` helper.
- Revocation from the Applications tool and from Your context. Sign-out revokes.

### Standard answers

A new "Standard answers" section in the Applications tool, stored in the `apply` tool setting, sealed: work rights, notice period, salary expectation, licence, right to work documents, availability, willingness to relocate, and up to 10 custom question-and-answer pairs the member writes once. The Seek and Indeed adapters match questionnaire labels to these first; only unmatched free-text questions go to the model.

### Seek adapter

Seek Quick Apply is a signed-in, mostly pre-filled flow: choose resume, choose or write a cover letter, answer employer questions, review, submit. The adapter:

1. On a job page (`/job/{id}`), reads the title, company, location and ad text, posts to `ext_fit`, shows the verdict in the side panel with "Tailor for this job" (opens the app's tailor step with the ad text and a return link) and a list of the member's tailored documents.
2. On the Quick Apply steps, when the member picks "Upload" for the resume or cover letter, offers the chosen tailored `.docx` from `ext_docx` through a file input injection (user gesture required; the panel button triggers it). Where Seek offers "write a cover letter", it pastes the cover text instead.
3. On employer questions, fills from standard answers by label match, drafts the rest via `ext_answers` (the cover letter writer's evidence and the member's resume as context, in the member's voice, hard rule: no claim not in the resume), and marks each drafted answer for the member to read.
4. On the review step, the panel says "Everything is filled. Check it and press Submit." The adapter never clicks Submit.
5. On the confirmation page, `ext_log` creates the application (`source: 'extension'`, board `seek`, status `applied`, with doc ids) and the panel shows "Logged. Sky will see it."
6. "Apply with SEEK" link-outs to an employer ATS: the panel keeps the documents available for drag-and-drop and standard answers for copy. Generic ATS adapters are out of scope for this phase.

### Indeed adapter

Indeed's terms prohibit automated applications and permit only Indeed's own tooling to apply. The adapter fills visible fields and screening questions from standard answers and the member's profile, offers the tailored documents for upload via the same user-gesture path, and stops. It never advances steps, never clicks Continue or Submit. Logging happens when the member reaches Indeed's confirmation page, same as Seek. If Indeed's markup makes even autofill unreliable, the adapter degrades to "copy to clipboard" buttons in the panel rather than fighting the page.

### Passive capture

`content/capture.js` runs on Seek, Indeed and Jora search results pages the member visits. It reads the listing cards on screen (title, company, location, posted-ago, URL) and posts them to `ext_capture`, which scores them with the Phase 3 fit pipeline and adds the strong ones to `newpage_alerts` with `board` set. Nothing is fetched beyond the page the member is looking at. This catches small-employer Jora listings and anything Adzuna has not indexed yet, and it makes the alert queue reflect what the member actually searches for.

### Side panel content

Compact and calm, in the app's visual language (`BRAND.md`): fit verdict in two lines, three reasons, two concerns; the documents available for this job; standard answers that matched; drafted answers in an editable list; a single status line at the bottom ("Fill the form, then press Submit on the page"). No application count, no streaks.

### Review and maintenance

- Web Store review takes one to two weeks and will ask about data handling: the privacy policy on the site needs a section for the extension.
- Seek and Indeed each have one apply form, so two adapters cover most Australian jobs. Each adapter has a self-test: a fixture HTML of the current form and a test that the label matcher finds every expected field. When a board changes its markup, the test fails before members notice. A weekly check in `admin/` ("Is everything working?") can run the adapters against saved fixtures.
- Telemetry, opt-in and counted only: fields filled, fields unmatched, drafted answers edited before submit, logged applications. No page content leaves the browser except what the member asks the panel to send.

### Legal and terms

- Seek: pre-fill with the member present and clicking Apply is the same posture as Karmik and AutoApply.com.au. One hour with a lawyer on Seek's current Terms of Use before launch.
- Indeed: autofill only, no advancing, no submit. Compliant with the published guidelines as read.
- LinkedIn: not in this phase. If added later, autofill-only exactly like Indeed.
- Nothing in any phase supports unattended submission, and the product copy says so.

### Tests

- `extension/tests/`: label matching against saved Seek and Indeed form fixtures; answer selection from standard answers; capture parser against saved results pages.
- `tests/newpage-extension.test.js`: token issue and revoke, scope of `ext_*` actions, rate limits.

### Done when

A member on a Seek job page sees the fit verdict, picks their tailored resume and letter, has every employer question filled or drafted, reads them, presses Submit, and finds the application logged in the app with Sky aware of it, without having typed anything twice.

---

## Order and dependencies

```
Phase 1 (log)  ──►  Phase 2 (Sky offers)  ──►  Phase 3 (alerts)  ──►  Phase 4 (extension)
                          ▲                     │
                          └── dismiss reasons ──┘
```

Phase 1 ships value on its own and is a week. Phases 1 to 3 are all inside the member app and serverless functions, in the patterns already there. Phase 4 is new ground and the only part with a maintenance tail.

## Environment variables added

| Variable | Phase | What |
|---|---|---|
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | 3 | Adzuna API credentials |
| `NEWPAGE_FIT_MODEL` | 3 | Optional, defaults to the coach model |
| `EXTENSION_ID` | 4 | The Web Store id the app pairs with |

## Usage caps

`TOOLS_CAPS` in `lib/newpage-usage.js` gains `fit: 600` a month (alerts plus extension verdicts) and `answers: 300` (drafted employer answers). Applications logged and alerts stored are not capped.

## What is deliberately not in the plan

- Unattended or hybrid auto-submit on any board.
- LinkedIn automation.
- Server-side scraping of any job board.
- Interview "copilot" tools that listen to live calls.
- Generic ATS adapters (Greenhouse, Workday and so on). Worth a later phase if members hit Apply-with-SEEK link-outs often; the log will show that.

---

# Bugs to pre-empt, and the test plan

Written before the code, from reading the branch. Each item is a failure that is likely in this codebase specifically, the design decision that prevents it, and the test that proves it. The test conventions already in the repo apply: pure logic in `lib/`, handlers thin, Node tests under `tests/*.test.js` with fake env and no network, Python tests with a fake Claude. New handler code should follow the same split so it can be tested without Supabase.

## Cross-cutting

| Likely bug | Decision | Test |
|---|---|---|
| **Member deletes their data and the new tables survive.** `eraseMemory` (`lib/newpage-memory-store.js`) lists tables by name. Applications, alerts, apply settings and extension tokens are not in it. Worse: it nulls `data_key`, so sealed application titles become permanently unreadable instead of deleted. | Add `newpage_applications`, `newpage_alerts`, `newpage_extension_tokens` and the `apply` tool row to `eraseMemory`. Add them to `exportMemory` so "Download my data" is complete. | `tests/newpage-memory-store.test.js`: a fake Supabase records every `delete().eq('member_id')` call; assert the full table list. Same for export. |
| **Retention purge leaves orphans.** `api/newpage/retention.js` calls `eraseMemory` at 12 months; covered by the fix above, but `newpage_alerts` can grow large per member and the purge loop runs inside one function invocation. | Delete alerts older than 60 days in the hourly alerts cron regardless of member state. | Alerts cron test: an alert dated 61 days ago is removed; 59 days is kept. |
| **Sealed fields that need querying.** Messages and memory are sealed whole. If `status`, `applied_at` or `board` were sealed, the pipeline summary and crons could not filter. If `title` were plain, personal data leaks into logs and admin. | Seal `title`, `company`, `notes`, `job_description`, `url`. Keep `status`, `board`, dates, `fit` plain. Document which is which in the schema comment. | `tests/newpage-apply.test.js`: `cleanApplication` output has exactly the sealed set encrypted when a vault is present; the pipeline summary is computed from plain fields only. |
| **Vault unavailable.** `writeVault` throws 503 when crypto is on and the key cannot be opened. New write actions that forget this store plaintext. | Every new write goes through `writeVault`; reads through `openVault` with `UNREADABLE` fallback, like memory. | Handler-level test with a fake vault that throws: `apply_add` returns 503 and inserts nothing. |
| **Sydney time.** Weeks, "today", "posted 40 minutes ago" and the Sunday cron all need `Australia/Sydney`. `applied_at` is a date; a member logging at 11pm Sunday in Perth lands on Monday in Sydney. | One helper in `lib/newpage-apply.js`: `weekOf(dateOrNow)` using `Intl.DateTimeFormat` with the timezone, same approach as `monthKey`. `applied_at` defaults to the Sydney date on the server, never the browser date. | Fixed timestamps at DST boundaries (first Sunday in October, first Sunday in April) and Sunday 23:59 / Monday 00:01 Sydney. |
| **Demo members.** `source: 'demo'` members have message and doc caps and are swept. New features either work inside the demo caps or are hidden. | Alerts and the extension are hidden for demo; the log is allowed but counted toward the demo doc cap. Crons skip `source = 'demo'` as `reminders.js` already does. | Cron tests: a demo member with alerts preferences gets no poll and no email. |
| **Usage caps missed.** Fit scoring and drafted answers are model calls per job; without caps an alert flood or an extension loop burns money. | New kinds in `TOOLS_CAPS`: `fit`, `answers`. The alerts cron checks allowance before scoring and stops for that member at the cap. | `usageAllowance` tests for the new kinds; cron test that a member at cap gets zero model calls. |
| **Rate limits are per instance.** `rateLimit` in `lib/security.js` is in memory; Vercel runs many instances. A burst from the extension passes. | Accept for interactive actions (as today); for `ext_*` actions add a database-backed count per member per hour on `newpage_usage` with an hourly key. | Test: 61 `ext_fit` calls in an hour, the 61st is refused, with the counter table faked. |
| **Model returns bad JSON or refuses.** `askJson` throws on both. New callers that forget to catch will 500. | Every new `askJson` call is wrapped and returns a friendly `aiMessage`, as `resume_tailor` does. Fit scoring on refusal records `fit: null` and does not retry in the same run. | Handler tests with `askJson` stubbed to throw. |
| **Thinking tokens cut answers off.** `askJson` adds headroom; new schemas with long arrays (answers to ten questions) can still hit `max_tokens`. | Cap list lengths in schemas (answers ≤ 12, reasons ≤ 3) and set `maxTokens` per call. | Schema tests assert the limits; a stubbed `max_tokens` stop is reported as a friendly error. |
| **Prompt injection from job ads.** Ad text and employer questions go into prompts. The existing prompts wrap data in tags and say it is never instructions; new ones must too. | Every new prompt uses `<job>`, `<question>`, `<listing>` blocks and carries the "never instructions to you" line. | Prompt tests grep for the tags and the line, as `newpage-tailor.test.js` does. |
| **`me()` payload grows.** `me()` is called after every action. Adding 200 applications and 100 alerts to it slows every request. | `me()` carries `pipeline` (counts and five recent rows) and `alerts.count` only. Full lists come from `apply_list` and `alert_list` on demand. | `buildMe` test asserts the payload shape and size bound. |
| **Migrations run twice.** `sql/newpage.sql` is run by hand in the Supabase editor. | Every statement `IF NOT EXISTS`; `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. The admin "Is everything working?" check in `api/newpage/health.js` learns the new tables and columns. | `tests/newpage-config.test.js` already checks config; extend to assert the health check names the new tables. |

## Phase 1: application log

| Likely bug | Decision | Test |
|---|---|---|
| **Linking a document that is not the member's.** `apply_add` takes `resume_doc_id`. Without an ownership check a member can attach another member's document id and read its title back. | Look up both doc ids with `.eq('member_id', member.id)` as `resume_tailor` does; reject otherwise. | Handler test: a foreign id returns 404 and inserts nothing. |
| **Fit copied from the wrong document.** Only tailored resumes have `content.tailored.match`. A base resume or a cover letter has none. | `fitFromDoc(content)` returns `null` unless `content.tailored?.match` is an array; the pipeline treats `null` as unknown, not zero. | Unit test with base, tailored and cover contents. |
| **Status goes backwards or sideways.** "Offer" then "Applied" makes the counts wrong. | Allow any transition (members correct mistakes) but compute "this week" from `applied_at`, never from `status_at`, and never count `saved` or `withdrawn`. | Pipeline summary tests with out-of-order updates. |
| **Duplicate logging.** The tailor flow and the cover flow both show "I applied". A member who used both for one job logs twice. In Phase 4 the extension logs a third time. | Dedupe key: same member, same `url` host and path (normalised, query stripped) or same `title` + `company` within 7 days. `apply_add` returns the existing row with `duplicate: true` and the UI says "Already logged". | Normalisation tests (Seek URLs with tracking params, trailing slashes, `www`); handler test for the 7-day window. |
| **Week target off by one.** Monday-to-Sunday weeks, Sydney. `this week` on Monday 00:30 Sydney must be zero. | `weekOf` as above; the Pipeline card shows the week's date range so a member can see what is being counted. | Boundary tests as in cross-cutting. |
| **Pipeline card shows stale counts after logging.** The app re-renders from `me` after an action; the tailor flow calls `resume_save` and the card is a separate call. | `apply_add` returns the fresh `pipeline`; the client patches `S.me.pipeline` before re-render. | Client-side: a small test of the state patch in `tests/` using the pure `pipelineSummary` on the returned list. |
| **A deleted document leaves a dangling link.** `resume_doc_id` has `ON DELETE SET NULL`, but the UI tries to open it. | UI shows "Document removed" when the id is null; the row survives. | Render test of the row with `resume_doc_id: null`. |

## Phase 2: Sky offers help

| Likely bug | Decision | Test |
|---|---|---|
| **Sky offers every conversation.** The model cannot remember an offer across sessions unless told. | The offer state lives in memory as a structured note (`apply_offer: declined 2026-11-09`) written by code in the `coach` action when Sky calls `save_memory` with the apply tag, and read by `applyStage` to set `offered` and `declinedAt`. The prompt gets "You offered on <date>, they said <answer>" as a fact, not a hope. | `coachSystem` test: with `offered: true` the prompt carries the "do not offer again unless" rule; without it, the offer rule. |
| **Re-offer loops.** Each stall re-triggers. | At most one re-offer per 14 days and only on a change of stage or a new pattern that was not present at the last offer; patterns carry a stable key and the last offer stores which keys it saw. | `shouldReoffer(state, now)` unit tests: same pattern twice does not re-offer; new pattern does; 13 days does not, 15 does. |
| **Sky logs an application the member did not make.** "I'm going to apply tomorrow" read as applied. | Tool description: only after they say it has happened; `log_application` requires `applied_at` and the handler rejects a future date. The reply shows "Logged: X at Y" so a wrong log is visible and undoable. | Persona eval (c) checks Sky asks "did you send it?" before logging; handler rejects future dates. |
| **Memory duplicates.** `isDuplicateNote` exists for free-text notes; structured offer notes need the same. | Offer notes replace by key, not append. | Memory store test. |
| **Pattern detectors fire on thin data.** One rejection and one quiet day is not a pattern. | Minimums in code: rejection then ≥ 7 days silence; ≥ 3 tailor tables sharing a missing requirement; ≥ 3 dismissals for one reason in 14 days; ≥ 8 applied and 0 viewed. | Fixture pipelines just under and just over each threshold. |
| **Prompt length.** Pipeline lines plus patterns plus memory plus the resume can push the system prompt past what is sensible. | `pipelineLines` capped at 600 characters, patterns at 3, oldest dropped. | Length assertion with a large fixture. |
| **The Today card nags.** "Not now" must stick. | `localStorage` key like `GS_KEY` for the getting-started card, plus the server-side declined flag so it does not come back on another device. | Client test of the hide logic; `buildMe` carries `apply.offerCard` false when declined. |
| **Crisis safety bypassed in the new focus.** `detectCrisis` runs in the `coach` action for every focus, so nothing to add, but the Applying prompt must carry `coachSafety`. | Applying focus uses the same `special` path as Action, which appends `coachSafety`. | Test: `coachSystem({coach: 'applying'})` contains the safety text. |

## Phase 3: early alerts

| Likely bug | Decision | Test |
|---|---|---|
| **Cron exceeds the function limit.** `app.js` is 60 seconds. One Adzuna call plus N model calls per member does not fit. | `alerts.js` gets `maxDuration: 300` in `vercel.json`; the poll is budgeted: at most 25 model calls per run, members in round-robin order by `last_polled_at`, and the run records where it stopped. | Cron test with 10 members and a budget of 3: the right 3 are scored, `last_polled_at` advances, the next run picks up the rest. |
| **Adzuna 429 or outage takes the cron down.** | One call failure skips that group and continues; three failures in a run stop the run and log once. Exponential back-off between retries, never a tight loop. | Fake fetch returning 429 then 200. |
| **Duplicate alerts.** Same job appears in several (role, location) groups, or Adzuna re-lists it with a new id. | Unique `(member_id, external_id)` in the table, plus a normalised `url` dedupe against the last 30 days before insert. | Fixture with the same job under two ids and two groups: one alert. |
| **Board guessed wrong.** `redirect_url` goes through Adzuna; the final host is not visible without following it. | Board from the listing's `redirect_url` host when it is a board domain, else from the `company.display_name`/`source` field if Adzuna gives one, else `other`. Never fetch the redirect server-side. | Parser tests on a recorded Adzuna response with Seek, Indeed, Jora and employer rows. |
| **Scoring stale jobs.** Adzuna includes listings days old on page 1. | `max_days_old=1` and a `posted_at` check; anything older than 36 hours is stored `dismissed: stale` without a model call. | Parser and filter tests. |
| **Fit score on a snippet reads as certainty.** The snippet is 200 characters; a confident "87" misleads. | Verdict shown as words ("looks like a good fit, from the summary"), score used only for sorting and the floor; the card says the full ad decides. | Copy test: the card never shows a bare number. |
| **Email storm.** Hourly cron plus a new-member backlog sends ten emails on day one. | First poll for a member stores alerts as `seen` without email; afterwards one email per 6 hours with at most 3 jobs. | Throttle tests: first run no email; second run one email; third run within 6 hours none. |
| **Unsubscribe.** Alert emails must honour the existing reminders switch and the unsubscribe link. | Reuse `reminders` and `alert_emails` flags; `layout` gets an unsubscribe URL that flips `alert_emails`. | Email builder test asserts the link; handler test flips the flag. |
| **Preferences parsing.** "Brisbane" vs "Brisbane QLD" vs a suburb; Adzuna wants `where` and `distance`. | `cleanApplySettings` normalises locations to a list of strings and a radius in km (default 25), roles to ≤ 5 trimmed strings; invalid input is dropped, not guessed. | Cleaner tests with messy input. |
| **Dismiss reasons lost on re-score.** A job dismissed for pay comes back from another group. | Dedupe check includes `dismissed` rows; they are never re-inserted or re-scored. | Dedupe test with a dismissed row. |
| **Open tracking marks "applied" wrongly.** Opening a listing is not applying. | Alert states are separate from the application log; `applied` is set only when `apply_add` links the alert id. | State machine test. |

## Phase 4: browser extension

| Likely bug | Decision | Test |
|---|---|---|
| **Seek is a single-page app.** Content scripts run once per full load; Seek changes the URL with `pushState` and the Quick Apply steps render in place. The adapter misses step changes. | A `MutationObserver` plus `navigation`/`popstate` listener drives a small state machine (`job`, `step:resume`, `step:cover`, `step:questions`, `step:review`, `done`) keyed on stable landmarks (headings and `data-automation` attributes), not CSS classes. | Fixture HTML for each step; tests that the detector names the right step and that a class rename does not break it. |
| **File upload cannot be set programmatically.** `input.files` is read-only. | Build a `File` from the `.docx` bytes, put it in a `DataTransfer`, assign `input.files = dt.files`, dispatch `change`. Requires a user gesture, so the panel button triggers it. Fallback: a download button and "drag it onto the page". | Playwright test against the fixture page: the input ends up with one file of the right name and type. |
| **Label matching false positives.** "Expected salary" and "Current salary" both match `salary`; "Do you have a licence?" vs "Which licence?" | Match on a normalised label plus the input type and options; ambiguous matches are left blank and flagged in the panel rather than guessed. A small table of known Seek and Indeed question phrasings is kept with the fixtures. | Table-driven tests: each fixture question maps to the expected standard answer or to "ask". |
| **Drafted answers claim things.** Free-text questions sent to the model with the resume; the model embellishes. | Same hard rule and integrity lint as the resume agent: figures and employers in an answer must appear in the resume or standard answers; otherwise the answer is returned as a question to the member. | `ext_answers` test with a stubbed model answer containing a new figure: it is rejected and the member is asked. |
| **Submit clicked by accident.** A generic "click the primary button" helper could hit Submit. | No code path clicks any button on the apply steps. Filling and uploading only. The review step is read-only for the extension. Lint rule in `extension/tests`: no `.click()` on any element whose text matches submit/apply/send/continue. | Static test greps the adapters. |
| **Indeed Cloudflare and markup churn.** Indeed challenges automation and rewrites its DOM often. | Autofill degrades to clipboard buttons when fewer than half the expected fields are found; the panel says so. No retries, no hidden requests. | Fixture of a changed form: degraded mode is chosen. |
| **Token leakage.** A long-lived token in `chrome.storage` is readable by anyone with the profile. | Refresh token hashed in the database, bound to a device id the extension generates, rotated on each refresh, revocable from the app; access tokens 15 minutes. `ext_*` actions cannot read messages, memory or notes. | Handler tests: a revoked token fails; an access token cannot call `coach` or `memory_*`; rotation invalidates the old refresh token. |
| **Pairing hijack.** The app posts the token to the extension id; a look-alike extension could receive it. | `externally_connectable` on the extension side limits senders to the app origin; the app sends only to the configured `EXTENSION_ID`, never to a wildcard. | Manifest test asserts `externally_connectable.matches` is the app origin only. |
| **CORS and CSP.** The app's CSP `connect-src` does not include the extension; the extension's own fetches to `aicareercoach.net` need the API's CORS header (already `*`). | No change for the extension's fetches. For the app to detect the extension, `chrome.runtime.sendMessage` from the page needs the extension's `externally_connectable`, not CSP. Document both. | Manual check in the release checklist. |
| **Double logging.** Member logs from the extension confirmation page and again from the app. | Same dedupe as Phase 1; the extension sends the normalised URL. | Covered by the Phase 1 URL dedupe tests, plus a Seek confirmation URL fixture. |
| **Passive capture scrapes more than the screen.** A content script could read hidden or paginated results. | Capture only cards inside the viewport-rendered results container on the current page; no fetches, no pagination, no background tabs. Capture is off by default and switched on in the Applications tool with a plain explanation. | Static test: `capture.js` contains no `fetch`; fixture test captures only the visible result list. |
| **Service worker dies mid-upload.** MV3 workers stop after 30 seconds idle. | Document bytes are fetched by the content script via the worker on demand and held in the page only for the gesture; nothing long-lived in the worker. | Playwright test with a forced worker restart between steps. |
| **Side panel API not on Edge.** `chrome.sidePanel` is Chromium 114+; Edge supports it, Firefox does not. | Chrome and Edge only for this phase; the panel falls back to a popup if `sidePanel` is undefined. | Feature-detection unit test. |
| **Store review rejects data handling.** | Privacy policy section, a clear single-purpose description, host permissions limited, no remote code. | Release checklist. |

## Test infrastructure to add

- **Fake Supabase** for handler tests: a small in-memory implementation of the chained `from().select().eq().order().limit()` surface the handlers use, recording calls, so `api/newpage/app.js` actions and the crons can run under `node --test`. Today only `lib/` is tested; the actions are not. This is the biggest gap and the first thing to build in Phase 1.
- **Fake Anthropic** for `askJson` and `runCoach`: an environment switch that routes `callApi` to a local stub returning canned JSON per schema, as the Python tests already do with `FakeClaude`.
- **Fixtures**: a recorded Adzuna response (Phase 3); saved Seek job, Quick Apply steps and confirmation pages, saved Indeed Apply modal and results pages (Phase 4), refreshed on a schedule.
- **Playwright** for the extension against fixture pages served locally, trace off by default.
- **Persona evals** for Sky, extending the live persona script on `claude/keen-sagan-rh269f`, run manually before each release of Phase 2 and recorded in `tests/reports/`.
- **CI**: `npm test` and the Python tests already exist; add `extension/tests` to the Node run and a fixture-staleness check that fails if a Seek or Indeed fixture is older than 60 days.

## Release checklists

**Phase 1.** Migration applied; health check green for the new table; export and delete include applications; a member can log, update, delete; Pipeline card counts match a hand count across a Sunday night.

**Phase 2.** Persona evals (a), (b), (c) pass; a declined member gets no offer for 14 days; memory note visible and deletable in Your context; crisis reply fires in the Applying focus.

**Phase 3.** Adzuna keys in Vercel; cron budgeted and under 300 seconds with 100 members of fixture data; first-run no-email rule verified; unsubscribe link works; alert older than 60 days removed.

**Phase 4.** Store listing approved on Chrome and Edge; privacy policy updated; adapter fixtures under 60 days old; token revoke works from the app and on sign-out; no `.click()` on submit-like elements (static test); passive capture off by default; Seek terms review done.
