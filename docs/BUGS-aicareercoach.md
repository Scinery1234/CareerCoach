# Known bugs and risks: AI Career Coach (branch `claude/fervent-gates-ejr1dq`)

From the November 2026 audits at commit 27ca6ac (full notes in `docs/market-research-notes-sky/`). File:line references are to that branch. Tests on the branch pass (Node 92/92, Python 22/22); none of these are caught by tests. `docs/BUGS.md` covers the older standalone Compass on `main` and does not apply here.

## Launch blockers (before taking money)

1. **`/privacy` and `/terms` are linked from every footer and do not exist** (`index.html:196`, `join/index.html:64`, `demo/index.html:50`, `memory/index.html:18`, `app/index.html:33`). Also no refund policy, ABN, entity name or contact. Privacy Act gaps: no collection notice, no APP 8 offshore disclosure (Vercel, Supabase, Anthropic, Resend, Stripe), no automated-decision-making disclosure ahead of the 10 Dec 2026 requirement, no no-training statement.
2. **Trial grant is 30 days for a 7-day trial, and no failed-payment handling.** `lib/newpage-payments.js:32` grants `access: '1m'`; `api/webhooks/stripe.js:46-57` handles no `invoice.payment_failed`, `past_due` or `charge.refunded`. A declined card at day 7 keeps full access to day 30.
3. **Legacy booking and packages API is live, public and unauthenticated**, creating PaymentIntents and attaching cards at the old $65-250 tiers (`api/packages/create.js`, `api/packages/setup-plan.js`, `api/bookings/create.js`, `lib/booking-price.js:7-9`). Remove or guard.
4. **`start_trial` conversion never fires.** `track.js:29-31` expects it; `join/join.js` never calls `window.track` and the submit button has no `data-track` (`join/index.html:46`). Only `begin_checkout` reaches GA4 and Meta.
5. **Wrong brand on everything that leaves the app.** Email header and unsubscribe page say "new page / by Purposefields" (`lib/newpage-emails.js:39-40`, `api/newpage/unsubscribe.js:33`); `og.png` is the old New Page quiz with a vikashan URL (`index.html:10`). Program-era copy still reachable: admin launch email ($500, refund, scholarship), program mails, welcome-email refund line, and the pre-JS join page showing the $500 program with scholarship fields (`lib/newpage-emails.js:143,184-199,244`, `lib/newpage-program-mail.js:15-62`, `join/index.html:32,38-47`, `join/join.js:4,11-23,53-64`).
6. **AI cost at the usage caps is about A$75-80 a month against a A$25 price.** Caps: 300 messages, 3 resumes, 150 tailored, 100 covers (`lib/newpage-usage.js:6`); writers and resume agent on Opus by default; no `cache_control`; 40-message history resent each turn (`lib/newpage-coach.js:20,151,156`, `api/_py/resume_agent/claude.py:27,65`). Same caps apply during the free trial. Typical engaged member is nearer A$6-7, so this is an abuse exposure more than an average-cost problem.
7. **Rate limits and admin lockout are in-memory per serverless instance**, so largely ineffective on Vercel (`lib/security.js:1-45`; used by checkout, auth, demo and admin login).
8. **Marketing says "everything Sky learns is encrypted" but only memory notes are.** Generated resumes, cover letters, Compass answers and tasks are plaintext in Supabase (`index.html:156,181`; vault used only at `api/newpage/app.js:689`). Either encrypt docs or correct the claim. "Delete everything" also leaves the member row, docs and Stripe customer (`api/newpage/app.js:700-704`).
9. **Crisis detection is a substring match** (`lib/newpage-app.js:38-46`): "suicide prevention officer" in a job title triggers the crisis reply; "no point going on", "can't do this anymore" are missed. The landing page lists only findahelpline.com, not two 24/7 services as Mindframe and BRAND.md section 9 ask (`index.html:195`).
10. **Human-coach claims unverifiable and GST unstated.** "Qualified career counsellor and psychotherapist" is unnamed (`index.html:158`); $250 sessions and receipts carry no ABN and no inc/ex GST.

## Coaching and tools

11. **Memory limit mismatch.** Memory loaded with `.limit(60)` (`api/newpage/app.js:85`) but `MEMORY_LIMIT` is 80 (`lib/newpage-context.js:142`); notes 61-80 are shown in Your context but never reach Sky, and eviction at `app.js:706` never fires.
12. **Cover letter template dropped.** `cleanCover` hard-codes `template: 'classic'` (`lib/newpage-cover.js:308`), so the chosen style is lost and "Edit the words → Save" resets it.
13. **Cover flow double-counts usage.** `cover_draft` and the final `doc_generate` both debit "covers" (`api/newpage/app.js:138`), so one letter costs two of the monthly 100. Usage is also debited before the AI call and the counter is a non-atomic read-then-upsert (`app.js:135-140`, `lib/newpage-usage.js:33-38`).
14. **Program-era copy inside the member app:** "can't replace your 60-minute session with him" (`app/sky.js:47`); "your coach's nudges during the four weeks" (`app/planner.js:431-434`); Progress Report written "for the end of their four weeks" but offered to all (`app/app.js:113`, `lib/newpage-tools.js:155`); Notes empty state "open a template from your program" (`app/notes.js:509`); Compass summary "Bring this to your session with your coach" (`app/compass.js:243`).
15. **"a AI Career Coach member"** should be "an" (`lib/newpage-coach.js:59`, `app/app.js:93`). Writers told to spell "programme" against BRAND.md (`lib/newpage-tools.js:4`, `lib/newpage-cover.js:161`).
16. **Coaching-style preference not acted on.** Gently / Straight talk / Challenge me is passed as a raw About line with no instruction (`lib/newpage-context.js:123`, `lib/newpage-coach.js:68`). The "name a strength every few replies" nudge only applies when a program week exists (`lib/newpage-coach.js:56`), so paying members never get it.
17. **Self-check results discarded.** The 5th/10th-message reviewer output is returned as `selfCheck` but never rendered or logged for admin (`app/app.js:764-769`).
18. **Prompt-injection exposure.** Resume text and memory notes go into the system prompt without the "data, not instructions" framing the writers use (`lib/newpage-coach.js:70-71`).
19. **Resume writer surface is raw.** Approved resume shown as JSON with "Copy JSON"; draft is a `<pre>` dump; no layout preview (`app/resume.js:258-261`). LinkedIn, outreach and report tools download HTML with a `.doc` extension, which Word warns about (`app/sections.js:127-128,184`).
20. **Compass regressions vs the standalone version:** Mix step renders all ten cards at once in lime, ~4,000px tall on a phone (`app/compass.js:121-124,158-165`); the one-page map only appears after "Add to my planner" and cannot be printed or downloaded (`app/compass.js:198-205`); in-step chat was lost.

## UX and accessibility

21. Sticky composer overlaps the last reply after send until the next scroll (`app/app.css:64`, `app/app.js:465`).
22. `aria-live="polite"` on `<main>` re-announces every re-render; chat has no dedicated live region (`app/index.html:30`).
23. Browser back button leaves the app because navigation uses `history.replaceState` (`app/app.js:582`).
24. Your context section numbers read out of order on desktop (`app/context.js:111-181`). Today's "Work out your direction" row shows unticked after reload even when the Compass is done (`app/app.js:310`).
25. Checkout cancel URL `/?cancelled=1` is not handled (`lib/newpage-stripe.js:54`). Landing page is `lang="en"` while the rest is `en-AU` (`index.html:2`).
26. Opt-out page says "he'll sort it out"; trial-ending email is signed by nobody (`api/newpage/optout.js:8`, `lib/newpage-program-mail.js:132`).

## Security and ops

27. `Access-Control-Allow-Origin: *` on `/api/*` and `'unsafe-inline'` scripts in CSP (`vercel.json:36-50,82`).
28. Demo ids come from `Math.random()` and the demo JWT lives 30 days for 24-hour access (`lib/newpage-demo.js:73-75`, `lib/newpage-auth.js:29-31`).
29. Single shared admin login, no MFA. Supabase RLS on with no policies (service key only).
30. Checkout tests still assert the $500 program params; nothing tests the trial subscription, `invoice.paid`, `trial_will_end` or the claim path (`tests/newpage-checkout.test.js:28-48`).
