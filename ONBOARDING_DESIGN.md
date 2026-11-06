# AI Career Coach: onboarding design

Date: 6 November 2026
Applies to: `claude/fervent-gates-ejr1dq` (the member app under `app/`, the join and demo pages)
Companion to: `USABILITY_REVIEW.md`
Status: sections 3, 4.1 to 4.4, 4.6 (handoff) and 4.7 (intro and pause) are implemented in `app/onboarding.js`, `app/onboarding-logic.js` and the tools; the rest are designed, not built.

## 1. The idea in one paragraph

Onboarding is not a tour. It is the shortest path from "I just paid" to "I got something I could not have got on my own", repeated once per tool, and it should never show a member something they have already done. Every module below has the same shape: a **trigger** (when it appears), a **first win** (the one thing the member does in under three minutes), a **nudge** (the single sentence or card that gets them there), and an **exit** (what happens so it never shows again). The app adapts the order to what it already knows about the member: which ad they came from, whether they have a resume, whether they have done the check-in, whether they are the demo.

## 2. Principles

1. **Do, don't tell.** No slide decks, no five-step tours. Each module is a prefilled first action with the Send or Go button already lit.
2. **One thing per screen.** A new member sees exactly one onboarding element at a time. Modules queue; they never stack.
3. **Value before setup.** Sky talks before Sky is "set up". Tailoring happens before the member learns the resume writer exists. Setup is asked for at the moment it would improve the result, not before.
4. **Earned, not timed.** Modules are triggered by state (no resume yet, first visit to this tool), never by day counts.
5. **Always skippable, always findable.** Every module has "Not now" and shows up again only from a "Show me around" link under Me.
6. **Remember on the server.** Progress lives in `member.onboarding` (JSON), not `localStorage`, so it survives devices and the magic link flow.
7. **Measure the win, not the view.** Each module reports one event: the first win happened. Nothing else.

## 3. Mechanics the modules share

### 3.1 State
Add one JSON column, `onboarding`, to `newpage_members`:

```json
{ "intent": "resume", "done": { "app": "2026-11-06", "sky": "...", "tailor": "..." }, "dismissed": { "compass": "2026-11-06" }, "seen": { "planner": 2 } }
```

- `intent` is the ad variant from the landing page (`resume`, `direction`, `stuck`, `interview`) carried through `/join` into Stripe metadata and onto the member. It decides which module runs first.
- `done[module]` is set when the first win happens, `dismissed[module]` when "Not now" is tapped twice, `seen[module]` counts views so a module can escalate from a one-liner to a card and then stop.

`me` returns `onboarding` and the front end decides what to show. One new action, `onboarding_set`, writes a key.

### 3.2 Three UI pieces, reused everywhere
- **Spotlight line.** One sentence in the muted style directly above the thing it points at, with a lime underline on the key word. Dismisses on first interaction with that thing. No close button needed.
- **First-win card.** A `.tool-callout` card (already styled) with a bold title, one sentence, one primary button that performs the action with something prefilled, and a "Not now" link. Shown at most twice.
- **Progress strip.** The existing "Getting started" card on Today, reworked into a four-item strip that reorders by intent and ticks itself from `done`. It hides itself when all four are done, not after seven days.

### 3.3 Queueing
`nextModule(me)` returns the first unmet module in intent order. Only that module renders its card. Spotlight lines inside a tool are independent of the queue because they only appear when the member is already in that tool.

### 3.4 Intent orders
| Intent | Order of the first four |
|---|---|
| resume (default) | Resume in → Tailor → Sky → Cover letter |
| direction | Sky → Compass → Resume in → Report |
| stuck | Sky (Action focus) → Resume in → Tailor → Planner |
| interview | Sky (Interview focus) → Resume in → Session brief → Tailor |
| demo | Sky → Tailor (prefilled) → Compass → Join |

## 4. The modules

Each module: trigger, first win, what the member sees, exit, metric.

### 4.1 App: the first ninety seconds
**Trigger.** First sign-in after joining (`!onboarding.done.app`).
**First win.** The member has typed one real thing and seen it used.
**What they see.** Today opens with a single full-width card instead of the normal grid:

> **Hi Sam. One question to start.**
> What are you going for right now? A role, a change, a decision, a rest. One line is plenty.
> [ text field, placeholder: "e.g. A policy officer role in state government by March" ]
> [ Save and meet Sky ]  Skip

On Save: the line is stored as Sky's first memory note ("Going for: …"), the planner gets a goal with the same title, and the app opens Coach with Sky's opening message already referencing it: "Policy officer by March. Good, that's concrete. What's the first thing in the way?" The member's one line has already shown up in three places.
**Exit.** `done.app` on Save or Skip. The Today card is replaced by the progress strip.
**Metric.** `app_first_line_saved`.

### 4.2 Sky, the AI coach
**Trigger.** First visit to Coach (`!done.sky`). Replaces the "Meet Sky" modal, which moves to the "What can Sky help with?" link and stays as the focus picker.
**First win.** One real reply from Sky to something the member said.
**What they see.**
- The chat opens on Sky's message, not a blurb. For intent `interview` or `stuck`, Sky is already in that focus and says so in one line ("I've started in Interview focus because that's what you came for. Change it any time up there.").
- The composer is prefilled with a draft the member can send or overwrite, built from the first line: "I'm going for [first line]. The hard part is " with the cursor at the end. People finish sentences more readily than they start them.
- Under the composer, one spotlight line: "Sky keeps short notes as you talk. You can see and delete them under Me."
- After the first reply, a single chip appears above the composer: **"Add that to my list"** when Sky has suggested a step, which calls `add_task`. That is the member's first taste of Sky doing something, not just saying something.
**Exit.** `done.sky` after the first reply. The drawer never auto-opens.
**Metric.** `sky_first_reply`, and `sky_first_task_added` as the deeper win.

### 4.3 Resume in (the gateway for everything in "Get hired")
**Trigger.** Any of: intent `resume`, first visit to Resume writer, Cover letter, LinkedIn, or Tailor without a saved resume. This module is shared so the member is asked once.
**First win.** A resume on file, confirmed by the member in one glance.
**What they see.** A card that works anywhere it appears:

> **Put your resume in once.**
> Upload a Word or PDF file, or paste the text. We read it, show you what we found, and every writer uses it from then on.
> [ Upload ]  [ Paste ]
> Nothing is sent to an employer. You can replace or delete it under Me.

After upload, instead of a wall of extracted text, show a **three-line confirmation**: name found, most recent role and employer, number of roles. "Look right? [Yes, keep it] [Let me check the text]". Most people tap Yes; the full text is one tap away.
**Exit.** `done.resume_in` when the profile is saved. The card never shows again anywhere.
**Metric.** `resume_saved`, and the time from sign-in to it.

### 4.4 Tailor for a job
**Trigger.** Resume on file and `!done.tailor`. For intent `resume` this is the second thing the member sees after sign-in.
**First win.** A tailored resume with the change list on screen.
**What they see.** The tailor form with two changes:
- The job-ad box has a spotlight line: "Paste the whole ad, including the 'about you' part. That's what we match against."
- Under the form: **"No ad handy? Try it on a sample ad"** which pastes a realistic ad for a role close to the member's most recent title (pick from five bundled sample ads by sector keyword) and sets Role and Organisation. The member sees the full result in about a minute without having to go and find an ad. The sample result is saved and labelled "Sample".
- On the result screen, the first time only, a spotlight on the match list: "Gaps are named honestly. If the same gap keeps appearing, that's a signal, not a failure." and one on the cover letter button: "This ad and this resume carry across."

**Prerequisite to make this real.** Tailoring must accept an uploaded resume, not only one built by the writer (see the usability review, section 2). The onboarding module cannot work otherwise. The simplest route: on first tailor from an uploaded resume, run a silent structuring pass to the agreed JSON shape, save it as the base resume, and tailor from that. The member sees one busy message: "Reading your resume, then tailoring it."
**Exit.** `done.tailor` on the first saved tailored resume.
**Metric.** `tailor_first_result`, split by sample vs own ad.

### 4.5 Write a new resume (the agent)
**Trigger.** Member chooses "Write a new resume", or tailoring has shown "Big gaps" twice, or the Compass has produced a direction that differs from the resume's title.
**First win.** An approved draft (not the Word file; the approval is the win).
**What they see.**
- Before starting: one card. "This takes about ten minutes with you in the loop. You'll read a draft, answer a few questions, and approve it. You have 3 a month." The allowance is stated before the button, not after.
- The agent's phases are renamed for members and the JSON phase is hidden: "Draft", "Your answers", "Approved", "Making the Word file", "Checked". A thin step strip shows where they are (reuse `.stepper`).
- The draft message gets a spotlight on the "To confirm" box: "These are the only places the writer wasn't sure. Everything else is from your own words."
- The approval button reads "Looks right, make the Word file" instead of "Yes".
**Exit.** `done.resume_new` on the first result with `ok: true`.
**Metric.** `resume_approved`, and abandonment by phase.

### 4.6 Cover letter writer
**Trigger.** Arrival from a tailored resume (handoff) or first visit with a resume on file.
**First win.** A letter on screen, then a recruiter review score.
**What they see.**
- If handed over from Tailor, step 1 is already complete and the screen opens on step 2 with a one-line banner: "Using the resume tailored for Acme and the ad you pasted. Skip to a quick letter, or answer a few questions for a stronger one."
- Step 2's instructions collapse to one sentence and one example card showing a filled-in answer ("Example: *Ran the Tuesday clinic roster for 14 staff for two years, cut no-shows by a third.*"). The example is dismissible and never returns.
- The first time a letter is produced, the "Review this letter" button pulses once and has a spotlight: "A recruiter's read, with a score. Most letters go up two points after one round of answers."
**Exit.** `done.cover` on the first saved letter; `done.cover_review` on the first review.
**Metric.** `cover_first_letter`, `cover_first_review`, and the score delta after revision.

### 4.7 The Compass
**Trigger.** Intent `direction`; or Sky has detected a direction question (the Career focus can set a flag via a `suggest_tool` tool result); or the member opens it from Tools.
**First win.** Five values in order (step 1 complete). Not the whole Compass.
**What they see.**
- An intro card in place of the Tools blurb: "Ten short steps. Most people do the first three in one sitting and the rest over a week. It saves as you go, and Sky will know what you find." [Start with your values]
- Step 1 gets a spotlight on the ranked list: "Your top one shapes everything after this. Drag it, or use the arrows."
- At the end of step 3 (North Star), a soft card: "That's the heart of it. The next steps turn it into a direction and three first steps. Come back any time; it's saved." [Keep going] [Back to Today]. This is the planned pause, so stopping does not feel like quitting.
- Sky's Career focus gets one line in its system prompt when `compass.step` is between 1 and 8: "They are partway through the Compass (step N). If direction comes up, offer to pick it up there rather than redo it in chat."
**Exit.** `done.compass_start` after step 1; `done.compass` when actions are placed in the planner.
**Metric.** `compass_step1_done`, `compass_finished`, days between them.

### 4.8 Career Direction Report
**Trigger.** Compass finished, or two check-ins and twenty Sky messages. Never before there is material.
**First win.** The report on screen.
**What they see.** The tool card on the hub is greyed with a line until the trigger is met: "Ready after the Compass or a couple of weeks with Sky." When ready, the card gains a lime badge "Ready" and Today shows a one-time card: "Your Career Direction Report is ready to write. Takes a minute." [Create it]
**Exit.** `done.report` on first document.
**Metric.** `report_created`.

### 4.9 LinkedIn profile writer
**Trigger.** Resume on file and (tailor done or `done.cover`). It belongs after the application tools, not beside them.
**First win.** A headline and About section the member copies.
**What they see.** The form opens with the work history prefilled from the resume on file and the role field prefilled from the most recent tailor's role. Spotlight on the result: "Copy the headline first. It's the one line recruiters search."
**Exit.** `done.linkedin` on first document.
**Metric.** `linkedin_created`, copy-button use.

### 4.10 Outreach messages
**Trigger.** Sky's Career or Action focus has suggested talking to someone (a `suggest_tool` flag), or the planner has a task starting with "Ask" or "Call". Otherwise reachable from Tools with no card.
**First win.** Three messages for one real person.
**What they see.** If triggered from a task ("Ask Priya what her week really looks like"), the "Who" and "What would you like to learn" fields are prefilled from the task title. Spotlight: "The first message asks for 15 minutes. The other two are for after."
**Exit.** `done.outreach`.
**Metric.** `outreach_created`.

### 4.11 Planner
**Trigger.** First task exists from any source (Sky, Compass, the first-line goal). Never shown empty.
**First win.** One task with a date and a calendar export or Google link used.
**What they see.** First visit: a spotlight on the first undated task, "Give it a day. Tasks with a day get a morning email." and on the Google link, "One tap puts it in your calendar." The reminder checkbox is on by default (it is) and the program-emails checkbox is gone for members.
**Exit.** `done.planner` on the first dated task.
**Metric.** `planner_first_dated_task`, `planner_calendar_export`.

### 4.12 Notes
**Trigger.** First visit, or Sky offers "Want to save that as a note?" after a long member message (over 400 characters).
**First win.** One note with a title.
**What they see.** The empty state is a real note already open, titled "What I know so far", with a two-line prompt in the body as placeholder text: "What I want · What's in the way · What I'll try this week". Typing replaces it. Spotlight: "Private. Sky and your coach can't read notes."
**Exit.** `done.notes` on first save with content.
**Metric.** `notes_first_saved`.

### 4.13 Your context (privacy, resume, about you, Sky's notes)
**Trigger.** Not a first-run module. It is offered at the two moments it matters: when Sky's memory reaches five notes ("Sky has learned five things about you. Have a look, fix anything wrong."), and when the member first opens Book a session ("Decide what the human coach can see before you book.").
**First win.** The privacy level chosen, or one note edited.
**What they see.** The page reordered for stacking: Privacy, Resume, About you, Sky's notes, Your data. Each "About you" question is collapsed to its label with "Answer" links so ten empty boxes are not the first impression. The MBTI field moves to the end.
**Exit.** `done.context` when privacy is set.
**Metric.** `privacy_set`, `memory_note_edited`.

### 4.14 Me and the check-in
**Trigger.** Not first. The check-in is offered on day three or after ten Sky messages, whichever is first, as a Today card: "Two minutes: how are you going? Sky adjusts how it coaches you from this." It also appears before the Report.
**First win.** A check-in saved and its effect visible.
**What they see.** The result card says what changed, not just the quadrant: "You're in Launch: clear direction, good energy. Sky will push a little harder and keep things practical." For Recharge: "Sky will slow down and start in Recovery focus." That line is the reason to do it.
**Exit.** `done.checkin`.
**Metric.** `checkin_first`, retake rate at 30 days.

### 4.15 Book a session and session brief
**Trigger.** Sky's `suggest_session` flag (already in the prompt rules: a big decision, a repeating pattern, interview practice with a person) or the member opens Tools. Never a sales card on Today.
**First win.** Understanding what a session is and what it costs, in one screen. Booking is the second win.
**What they see.** The Tools card for a session includes the price and "Sky will suggest one if it would help". The session screen opens on a three-line explainer with a real example ("Sam booked one to decide between two offers. Sky's notes and the Compass went ahead of her, so the hour started on the decision."). After booking, the brief is offered immediately with the four questions prefilled from Sky's memory where it can ("Your biggest worry right now: *not sure my background counts*. Edit if that's changed.").
**Exit.** `done.session_explained` on first view; `done.session_booked`; `done.brief`.
**Metric.** `session_booked`, `brief_before_session`.

### 4.16 Progress report
**Trigger.** Thirty days after joining, or two check-ins. Renamed for members from "your four weeks" to "your first month".
**First win.** The report, and the one line it ends with: the next 30 days.
**What they see.** A Today card on day 30: "A month in. Want a one-page report of what you did and what changed?" [Create it]. The report's last section becomes three tasks the member can add to the planner with one button.
**Exit.** `done.progress`.
**Metric.** `progress_report_created`, tasks added from it.

### 4.17 The demo
**Trigger.** `member.demo`.
**First win.** A tailored resume result, which is the product's best screen, inside the ten-message and two-document caps.
**What they see.** The demo opens on Coach with Sam's conversation and a prefilled draft, then the demo bar's progress strip reads: Say hello to Sky → See a resume tailored (prefilled with Sam's resume and a sample ad; one tap) → Try the Compass → Join. The Join button in the bar changes to "Keep this: start free" after the second win, and the join page pre-sets `intent` from whichever tool they used most.
**Exit.** The demo ends at 24 hours.
**Metric.** `demo_tailor_seen`, demo-to-join rate by last tool used.

## 5. Copy rules for every module

- Second person, present tense, Australian spelling. No "Welcome to", no "Let's get started", no exclamation marks.
- Each nudge states a benefit in the member's terms ("Tasks with a day get a morning email"), never a feature name.
- Numbers only where they change behaviour: "3 a month", "about a minute", "two minutes".
- Never say "AI-powered". Say what it does.
- "Not now" is the skip label everywhere. Never "Skip tour" or "Dismiss".

## 6. What to build, in order

1. `onboarding` column, `onboarding_set` action, `intent` carried from `?v=` through join and Stripe metadata. One afternoon.
2. The three UI pieces (spotlight line, first-win card, progress strip) and `nextModule()`. Replace the Today "Getting started" card and the auto-opening Sky drawer.
3. Modules 4.1 to 4.4 (first ninety seconds, Sky, Resume in, Tailor). These cover the `resume` intent, which is the default ad. Tailor needs the uploaded-resume prerequisite.
4. Modules 4.6 and 4.7 (Cover letter handoff, Compass pause card).
5. The rest, each a small change inside its tool.
6. Events to the existing tracking (`track.js` already fires to GA4 or Meta): one event per first win, named as above.

## 7. How to know it worked

Three numbers, read weekly:

| Measure | Now (guess) | Target after modules 1 to 4 |
|---|---|---|
| Members with a resume on file within 24 hours of joining | unknown | 70% |
| Members who see a tailored result during the trial week | unknown | 50% |
| Trial-to-paid conversion | unknown | up by a third |

The first two are leading indicators you can read on day one. If the first number is low, the Resume in module is the problem; if the second is low with the first high, it is Tailor.
