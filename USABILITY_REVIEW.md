# AI Career Coach: usability review

Date: 6 November 2026
Branch reviewed: `claude/fervent-gates-ejr1dq` at commit 27ca6ac
Scope: the landing page and ad variants, `/join`, `/demo`, sign-in, and every screen of the member app (Today, Coach, Tools, Me, and all eleven tools), plus the server code that shapes what members see.
Method: read every front-end file and the member API, then ran the real front end against a small mock backend (no Supabase or Stripe) in headless Chromium at 390×844 and 1280×800, screenshotting each screen and testing specific behaviours. Findings marked **confirmed** were reproduced in the browser or verified in code.

## Summary

This is a strong product with an unusually honest voice. The landing page says one thing and says it well, the join flow is short, the resume tailoring result (what changed, how you match, gaps named) is the best screen in the app, and the privacy model (encrypted memory, three levels of coach visibility, download and delete) is clearer than most paid tools. The code is careful about XSS, rate limits and crisis handling.

The problems fall into four groups:

1. **Trust gaps on a paid product.** The Privacy and Terms links go to 404 pages. Every email still carries the old "new page" brand.
2. **The $500 four-week program still leaks through.** A $25 member sees program-era wording in a dozen places, and "your coach" is referred to as if they already have one.
3. **Two things the landing page promises are not what a new member gets.** Tailoring "in about a minute" needs the full multi-stage resume agent first, and "cancel in two taps" is a trip to the Stripe portal.
4. **A handful of real bugs**: Sky's bold markdown shows as raw asterisks, the context page numbers its sections 1, 5, 2, 3, 4 on a phone, failed AI calls still burn monthly allowance, and the three-step cover letter costs two of the hundred letters.

Nothing here is hard to fix. Most items are copy or a few lines of code.

## 1. Confirmed bugs

| # | Bug | Where | Fix |
|---|-----|-------|-----|
| 1 | **Privacy and Terms pages don't exist.** Every footer, the join page and the sign-in page link to `/privacy` and `/terms`; both return 404. On a page that takes card details this is the first thing a cautious buyer checks. | `index.html`, `join/index.html`, `demo/index.html`, `memory/index.html` | Write both pages. The crypto notes in `lib/newpage-crypto.js` already say what the privacy page should state about encryption. |
| 2 | **Sky's bold text shows as raw `**asterisks**`.** The CBT and Clarity compass focuses are told to label steps `**Step N: Title**`, and the coach screen renders messages as plain text. Members in those two focuses see asterisks on every turn. | `app/app.js` line 424; prompts in `lib/newpage-coaches.js` | Render chat messages through the existing `inline()` helper (line 140), which already turns `**bold**` into real bold without HTML. |
| 3 | **"Your context" sections are numbered 1, 5, 2, 3, 4 on a phone.** The two desktop columns stack, so the "5. Your data" card lands between 1 and 2. | `app/context.js` line 125 | Number the cards in stacked order, or drop the numbers. |
| 4 | **A failed AI call still spends the member's monthly allowance.** Usage is counted before the action runs, so a 502 from the model costs a Sky message, a tailored resume or a cover letter. The demo does this on purpose; paying members should not. | `api/newpage/app.js` lines 135–140 | Spend after success, or refund on a 5xx. |
| 5 | **The three-step cover letter costs two letters.** Both `cover_draft` (the first draft shown in step 2) and the final `doc_generate` count as a cover. The join page promises "100 cover letters". | `api/newpage/app.js` line 135 | Count only the final letter, or say "50 letters with the three-step flow". |
| 6 | **"I am" statements get mangled in the Compass.** "curious" becomes "I am a curious", "honest person" becomes "I am a honest person", "uni student" becomes "I am an uni student". Sam's own sample data ("I am someone people come to…") could not be typed in by a real member. | `app/compass.js` line 10 | Drop the automatic article and make the fixed prefix "I am". |
| 7 | **Every render re-announces the whole page to screen readers.** `<main aria-live="polite">` wraps the entire app, and the app re-renders on every keystroke in some screens. | `app/index.html` line 30 | Remove `aria-live` from `main`; the status and alert roles already in place are enough. |
| 8 | **Task and progress errors on Today are swallowed.** Ticking a task sets `S.error`, but neither Today screen renders it. | `app/app.js` lines 132, 197, 315–334 | Show `S.error` on Today, or use a toast. |
| 9 | **Compass "Add to my planner" can duplicate tasks.** `T.placed` lives in memory only, so a member who returns later and presses it again gets the three steps twice. | `app/compass.js` lines 198–204 | Persist the placed flag in the Compass data, or check for existing titles. |
| 10 | **Demo visitors can run unlimited Opus calls.** The demo caps count `coach`, `doc_generate` and `compass_suggest`, but not `resume_tailor`, `cover_analyse`, `cover_draft`, `cover_review` or `cover_revise`. The demo page promises "2 documents". | `api/newpage/app.js` line 152 | Count those actions against the docs cap. |

## 2. Landing page and join

The page is good: one promise, one button, product shown in HTML, proof next to the button, objections answered. Two claims need care.

- **"Tailor to a job in about a minute" is only true once a resume has been built in the writer.** Tailoring needs a resume the agent made (`isBuilt`). A new member who uploads a resume cannot tailor it; they must first run the full writer, which drafts, asks questions, needs approval, shows raw JSON and then runs a Python script. The "How it works" step 1 says "Upload your resume once" as if that is enough. Either let tailoring work from an uploaded resume, or say on the landing page that the first resume is built with you in a few minutes and then every tailoring takes a minute.
- **"Cancel in two taps" is Me, then "Change card or cancel", then the Stripe portal, then Stripe's own confirm.** Four steps on another site. Say "cancel any time from the app" or add a one-tap cancel that calls Stripe server-side.
- **The two survey statistics need sources you can stand behind.** "Resume Genius survey of 1,000 active job seekers, 2026" and "MyPerfectResume survey, 2025" will be read by ad reviewers and by sceptics. Link them, or drop them.
- **Join page flashes the old program form.** The static HTML still has "Four weeks with a coach in your corner", a stepper for extra coach hours, a scholarship-code field and "Do the four weeks and don't move forward? Your next month is on us." JavaScript hides them a moment later, and if the quote request fails they stay. Remove them from the HTML.
- **No way back from join to the landing page except the brand link.** Fine on desktop, easy to miss on a phone. Add "What's included?" as a small link above the form.
- **The sticky phone bar says "$0 today · $25 a month after" and "Start free".** Good. It also hides the footer links on a phone when it is showing, which matters once Privacy and Terms exist.

## 3. Sign-in and first run

- **"Open it on this device" after a magic link is the right instruction** and the 15-minute window is stated. Good.
- **Typo:** "If that email isn't a AI Career Coach member". Also "a AI Career Coach member" in Sky's system prompt.
- **The first thing a new member sees is "Do the 2-minute check-in under Me".** The check-in is eight statements on a four-point scale, and its result is a quadrant name ("You're in Launch") built for the four-week program. For a $25 member that quadrant drives nothing visible except a sentence on Today. Either explain what the check-in changes ("Sky adjusts how it coaches you"), or make it optional and lead with "Say hello to Sky" and "Upload your resume", which unlock the two things they paid for.
- **"Meet Sky" opens as a full-screen modal the first time the Coach tab is tapped.** It is well built (focus trap, Escape, bottom sheet on phones), but it interrupts before the member has typed anything. Consider a dismissible card at the top of the chat instead, with the focus picker still in the chip.
- **The Coach screen puts a lot above the first message.** Heading, focus chip, "What can Sky help with?", a two-line blurb and a large yellow "Set up Sky" callout. On a phone the conversation starts below the fold. Collapse the blurb into the drawer and shrink the callout to one line once dismissed.

## 4. The old program shows through

For a `tools` member (everyone now), these still appear:

- Planner: "Email me your coach's nudges during the four weeks", with the explanation "A note at the start of weeks 2 to 4, a reminder to book your session, and a check-in if you go quiet."
- Planner: the calendar export file is named `new-page-planner.ics`.
- Tools hub: "Progress Report: A short report on your four weeks…" (the generator's lead text).
- Demo bar: "sample member "Sam", Launch program".
- Sky drawer: "It is not your coach, and it can't replace your 60-minute session with him."
- Your context: "When he does, it shows here." and "1. What can your coach see?" shown before the member has any coach.
- Me: "Your coach can also see your plan, progress and check-ins to prepare for your session."
- Server messages: "Your AI Career Coach program has ended."
- Email layout: every email is branded "new page · by Purposefields" (`lib/newpage-emails.js` line 38).
- Email footer and the plan email still link to `/newpage`, `/#scholarship` and `/#book-call`, none of which exist on this site.

Two decisions would clear most of this: (a) say "a human coach" everywhere the member has not booked one, and "your coach" only after a booking; (b) grep for "four weeks", "program", "him", "he does" and "new page" and rewrite each.

## 5. Sky

- **Replies don't stream.** The member sees "···" for the full generation (Sonnet, low effort, up to 3 tool rounds). Streaming the text would make it feel twice as fast. The Compass on `main` already does this with NDJSON.
- **The composer is disabled while Sky replies**, which drops keyboard focus and prevents typing the next thought. Keep it enabled and queue, or at least keep focus.
- **Switching focus clears the visible chat and reloads.** `openCoach` empties `me.messages` before the fetch, so the screen flashes empty. Keep the old list until the new one arrives.
- **Crisis handling is good**: server-side keyword check on every message, a stored gentle reply, a banner in the chat, international wording. The keyword list is narrower than the Compass one on `main` and avoids the "can't go on" false positive. Keep it that way.
- **Sky's self-check steers** (every 5th and 10th message) are invisible to the member. That is fine, but the usage cap counts those messages too; make sure the "300 messages" promise is about the member's messages only (it is, but worth a test).
- **No way to see older messages.** Only the last 40 load and there is no "earlier" link. Add one, or say "Sky remembers the gist; older messages are kept".

## 6. Tools

### Resume writer
- **Raw JSON is shown to the member** ("Phase 2, Prepare" with a "Copy JSON" button) and the result card lists Word-file validation checks and a "visual check". These are developer artefacts. Hide the JSON phase and fold the checks into one line: "Checked: 2 pages, no blank pages."
- **The approval regex** (`y`, `yes`, `looks good`, `go ahead`…) decides whether the busy message says "Building your Word file". A reply like "yes but change the title" shows the wrong busy text. Minor.
- **Only three new resumes a month.** With one failed run counted (see bug 4) a member could lose a third of their allowance to an error. Say "3 resumes" next to the Draft button so it is not a surprise.
- **Tailoring is hidden until a resume exists.** The path picker (Tailor / Write new) only appears after a built resume. New members never learn tailoring exists inside the app. Show both paths from the start with the tailor path explaining what it needs.
- **The tailored result is excellent.** Change list with before/after, match list with honest gaps, "Big gaps on this one" nudging toward a new resume or the Compass, and a handoff to the cover letter. Keep it.

### Cover letter writer
- **Step 2 is text-heavy.** Three paragraphs of instructions before the first competency, plus a long first paragraph inside each card. Cut each to one sentence and move the rest behind "How to answer these".
- **The quick letter and the three-step flow both save a letter, but only the three-step flow sets `L.themes`**, so "Review this letter" on a quick letter sends no evidence. Acceptable, but say "Review works best after the three steps".
- **"Edit the words" is a collapsed details block under the review**; members looking to fix a sentence may not find it. Put "Edit" next to "Download Word file".
- **Good**: recruiter review with a score, and "Respond to the review" revising from the member's own answers only.

### The Compass
- Same findings as the standalone review of `main` apply to `app/compass.js`: the "I am" article bug (bug 6), Remix discards typed-but-not-added ideas, ten mix cards is a long scroll on a phone, and no drag ordering (arrows only, which is fine).
- The in-app version saves as you go and says so. Good.
- The final step is "Put it in your planner" and the summary only appears after that. A member who never presses "Add to my planner" never sees their summary. Show the summary from step 9 regardless.

### Planner
- Date inputs render as the browser's native control, which on a phone is fine. On desktop the add form shows "Start (optional)" only after a date is chosen, which is a nice progressive reveal.
- The goals form on a phone puts the date input and Add button on a second line with no label. Add "Target date (optional)" as visible text.
- "Your calendar copy won't update if you change a task here" is honest. Good.

### Notes
- Autosave, beacon on page hide, two-pane on desktop and a back link on phones. Nothing to change.

### Your context
- Section numbering bug (bug 3).
- The page is long on a phone: privacy, share, data, resume, ten "about you" questions, Sky's notes. Consider tabs or collapsible cards, and move "Delete everything" to the bottom so it is not the fourth thing on the page.
- "Until you choose, your coach can see nothing" is the right default, stated. Good.

### Book a session
- For a member with no sessions, the page shows a buy stepper first and the diary second. Clear. The only confusion is the heading "Choose a time · 0 sessions paid for" never appears, since the stepper replaces it. Fine.

## 7. Me and billing

- The check-in dominates the Me tab (eight statements, each with four chips) and pushes membership, memory and sign-out far down. On a phone the membership card is about two screens down. Put "Your membership" first for a paying member and collapse the check-in behind "Retake the check-in" once it has been done.
- "Your next payment is around 1 December" uses `accessUntil`, which is right for a subscription, but during a trial it should say "Your free week ends on…, then $25".
- The usage line ("12 of 300 Sky messages…") appears on Today and on Me. One is enough; on Me it belongs next to "Change card or cancel".
- "Forget everything" sits as a plain link under the memory list with no confirm. Give it the same two-tap pattern as "Delete everything".

## 8. Accessibility and small things

- `aria-live` on `main` (bug 7).
- Tab bar labels are 12px. Raise to 13px; everything else in the app is 15px or larger.
- The ruled-paper background runs behind long prose and form fields. It is a brand choice, but on the reading screens (lessons, cover letter step 2, context) it competes with the text. Consider turning the rules off inside `.card` and `.prose`.
- Chat bubbles: user messages are lime with a dark border, Sky's are white. Contrast is fine in both.
- No dark mode. Fine for now; the brand is "paper".
- Landing page CSP allows `'unsafe-inline'` scripts for the inline variant script. Move that script to `track.js` and drop the allowance.
- Tests cover the server logic well (15 Node suites, 2 Python). There are no browser tests. The mock-backend walkthrough used for this review is a good base for one.

## 9. Suggested order of work

1. **Trust**: write the Privacy and Terms pages; rebrand the email layout; remove the stale program copy from `join/index.html`.
2. **Bugs 2 to 9** in section 1. Each is a few lines.
3. **Promise matching**: let tailoring work from an uploaded resume, or change the landing page's step 1 and "about a minute" wording; change "cancel in two taps".
4. **Program leak sweep** (section 4): "your coach" → "a human coach" until booked; grep for "four weeks", "program", "him", "new page".
5. **Sky feel**: stream replies, keep the composer enabled, don't blank the chat on focus switch, lighten the top of the Coach screen.
6. **Resume writer polish**: hide the JSON phase and the validation detail; show the tailor path to new members.
7. **Me tab order** and the cover letter step 2 copy cut.
