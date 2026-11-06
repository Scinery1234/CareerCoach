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
