# Product/UX audit: The Compass by Purposefields

Local code audit + live walkthrough of `/home/user/CareerCoach` on 2026-11-06. App run without an API key (so the AI chat and "Suggest…" buttons were switched off; coaching quality is judged from the prompts and flow design). `npm test`: **7/7 pass** (API-level tests against a mock Anthropic server; no front-end tests). No repo files modified.

Headline: a tightly scoped, well-crafted, *single-session reflection worksheet* with an AI thinking partner bolted alongside. The coaching methodology is coherent and deliberately non-directive; the craft (copy, typography, friction design, safety) is above most indie AI tools. But it is a one-shot tool: no accounts, no return loop, no reality-testing, no market data, no commercial layer, and several small bugs that would be visible to a first-time user within two minutes.

---

## 1. Coaching methodology and quality

**Framework (as built, `public/app.js:3-14`, `lib/prompts.js`):** values → identity ("I am a…") → vision (North Star = #1 value lived by #1 "I am") → constraints (pay/hours/stress/mode/location) → strengths (know/do/love) → combinatorial ideation (random know+do+love trios) → ranked choice → 4-horizon plan (now/3-9/9-18/18+ months) → three <2h actions in 2 weeks → calendar commitment. This is essentially a values-first, Ikigai-adjacent "life design" sequence (Burnett/Evans-style prototyping energy in the "mix" step, plus implementation-intention theory in the calendar step). It is a *direction* tool, not a job-search tool, and that scope is held consistently.

**How the AI coach behaves (`lib/prompts.js:5-18` GUIDE):**
- Strictly non-directive: "The person does the thinking… Never tell them what to choose" (l.8); "Never give your opinion on whether an idea is realistic, achievable, well paid or in demand. Don't rank or judge their ideas" (l.10); won't write values/North Star for the person, only offers wording "built only from words they've already used" (l.11).
- Register: plain Australian English, short, no business jargon with an explicit banned-word list (l.9). 2-5 sentences + at most one question (l.13). Plain text with bold only.
- Context: every user turn carries a `[Where they are]` note with the current step intro and the *entire* answer snapshot as JSON (`app.js:409-413`), so the coach is always grounded in the person's own words. Nice touch: it is told to point people back to the panel if they put answers in chat (l.14).
- Suggestion tasks (`prompts.js:58-120`) are all constrained to "ONLY their own words", combine exact know/do/love strings, and repeat the no-realism rule (`AI_RULES` l.20). `ideas` explicitly widens the field list to trades/care/community/outdoors/government/self-employment (l.73) — real evidence of the "everyday people, not office workers" positioning.
- Safety instruction inside the system prompt (l.16) duplicates the client-side crisis list.

**Quality judgement:** As a *reflective* coach design it is strong and unusually disciplined: it resists the universal LLM failure mode of over-advising. The intros in `app.js:16-27` are warm and specific ("What makes your heart sing, or your blood boil"). The constraint "two to five sentences, one question" will make it feel like a coach rather than a chatbot.

**What is missing from a good coaching journey (and is mostly a *deliberate* stance, but a competitive gap):**
- **No reality-testing at all.** The coach is forbidden to say anything about demand, pay, qualifications or feasibility. A "community garden teacher" with a $70k floor gets zero friction. The "What I need" step collects pay/hours constraints but *nothing ever checks ideas against them*; the needs are just passed as text in `profileText` (`prompts.js:37`). Competitors with labour-market data will look more "useful" even if less respectful.
- **No labour-market information, no training/pathway data, no AU occupation taxonomy** (ANZSCO, Jobs and Skills Australia, TAFE). Ideas are free-text strings.
- **No follow-up, accountability or reflection over time.** Journey ends at "Copy my map" + .ics files. Nothing returns the person after the 2 weeks to ask "did you call Sam?" (`saveGoals()` at `app.js:130-135` writes a `purposefields_goals` localStorage key that *nothing in this app reads* — a vestige of or hook for a companion tracker that doesn't exist).
- **No second pass / iteration design.** The step strip allows editing, but the methodology has no "revisit after prototyping" loop; the first idea that wins the ranking becomes "the" direction.
- **No human-in-the-loop.** No way to share the map with a coach, partner, or employment-services case worker beyond copying text.
- **Chat is optional and parallel, not woven in.** On a phone the coach is a separate tab; on desktop a side panel. The coach never initiates (intros are static strings pushed into the log, `app.js:127`). It cannot "see" the person struggling (e.g. 10 minutes on North Star with 4 words) and nudge.
- **Ideation is thin without AI.** With AI off the "mix" step is 10 random trios + blank inputs; many trios are near-duplicates (in my run trios 3 and 4 were both "Gardening + Build things + …"; `makeTrios` balances by usage count but with 3×3×3=27 combos repeats are inevitable).
- **No psychometrics / validated instruments** (Holland/RIASEC, strengths inventories) — fine for the brand stance, but a gap vs. competitors who lead with assessments.
- **"I am" and "values" are forced-rank single-winner** (only #1 feeds the North Star). People with two equally strong identities get no model for that.

## 2. Onboarding and first impression

- **No landing page.** `/` loads the app shell directly (`index.html`), with the step-1 workspace rendered *behind* a modal consent dialog (screenshot `01_consent_desktop.png`). There is no explanation of what the Compass is, how long it takes, who it is for, or what you get at the end. The only positioning copy is the `<meta description>` (`index.html:7`).
- **Consent friction is real: four mandatory checkboxes before anything.** "Tick each one to continue" with a greyed Begin (`index.html:65-78`, `app.js:437-441`). On mobile the dialog fills the viewport (`30_consent_mobile.png`). The content is honest and plain, but 4 required ticks on first visit for a free tool is heavy; a single "I understand" plus linked detail would convert better. Consent is re-asked every 90 days (`app.js:441`).
- **The "Help now" button in red mono type is the most visually prominent control on the page** on every step (`02_step1_values_desktop.png`). Appropriate for safety, but it frames the product as a mental-health-adjacent tool before the person has even read the first question.
- The first step itself is a good first impression: a clean question ("What matters most to you?"), 45 tappable chips, clear limit copy ("Choose between 5 and 10"), and the chat panel pre-seeded with a warm intro.
- With no key configured, the right-hand panel says "Chat isn't switched on for this site" — the degraded mode is handled gracefully (`index.html:50`, `app.js:466-470`).

## 3. UX flow, time to complete, mobile, accessibility

**Flow mechanics (good):**
- "Still needed: …" pattern instead of disabled buttons (`needBtn`, `app.js:154`; screenshot `03_values_still_needed_desktop.png`, `09_north_star_filled_desktop.png` showing the red warning). This is genuinely better than greying out.
- Live bar hints ("7 chosen", "Your #1 value: Making a difference", "Ready to mix").
- Linear gating via `S.reached` (`app.js:104-110`) with a step strip that unlocks completed steps for revisiting; strip auto-scrolls to current step.
- Everything autosaves to localStorage on every keystroke; reload restores state and consent (verified).
- "Start over" and AI "replace what's here" both require a second tap (`app.js:300-307`, `454-458`) — thoughtful against accidental loss.
- Enter adds a tag; focus returns to the input after adding (`app.js:181,236`).
- Calendar step defaults three sensible slots (+1, +4, +8 days at 10:00, 1h) and produces Google Calendar deep links and RFC 5545 .ics with a 15-min alarm and TZID (`app.js:338-349, 359-371`).

**Bugs and awkwardness hit in the walkthrough:**
1. **Literal "null" rendered on the "Who are you?" step** (desktop `06_identity_tags_desktop.png`, mobile `34_identity_mobile.png`). Cause: `heading(i,"Who are you?")` has no lead, so `heading()` returns `null` as the third element (`app.js:155`) and `w.append(...heading(...))` at `app.js:183` appends the string "null" (DOM `append` stringifies null). Visible to every user on step 2.
2. **"I am" statements are not case-normalised**: typing "Learner" gives "I am a Learner" (`iam()` at `app.js:79`). Minor but visible in the summary.
3. **Summary "Values" line collapses into one run-on sentence** ("1. Making a difference 2. Family 3. Freedom…") because items are joined with three spaces that HTML collapses (`app.js:389`; `20_summary_bottom_desktop.png`). The "I am" section right below uses `white-space:pre-line` and looks fine, so this is just inconsistency.
4. Strengths card placeholders truncate at the 210px column minimum ("e.g. Gardening, N", `12_strengths_filled_desktop.png`) — placeholders are too long for the three-column layout.
5. After adding a strength the workspace scrolls so the h2 "Your strengths" is clipped under the header (`12_strengths_filled_desktop.png`) — focus-driven scroll with no `scroll-margin`.
6. The Mix step is long: ~2,330px of content on desktop (measured `wbody.scrollHeight`), i.e. ~3.5 screens of ten identical-looking cards before you reach "Ideas you already had", "More ideas from Claude" and "My ideas". Someone who only wants to type their existing ideas has to scroll past all ten mixes. On mobile this is 5+ screens (`38_mix_mobile.png`, `39_mix_bottom_mobile.png`).
7. Pay is a required numeric "lowest pay I can accept per year before tax" — many "everyday people" think in hourly or weekly terms and may not know; there is no "not sure" option (`app.js:208`).
8. No "time to complete" is ever stated. Realistic estimate from the content requirements (5-10 values ranked, ≥3 identities ranked, ≥15-word vision, 5 needs, ≥9 strengths, ≥2 ideas across 10 mixes, ranking, plan, 3 steps, 3 time slots): **40-60 minutes in one sitting**, with the North Star and Mix steps the likely drop-off points. Nothing in the UI prepares the person for that.
9. Ranking by drag uses SortableJS on a `⋮⋮` grip with `aria-hidden` and `tabindex=-1` (`app.js:143`); arrow buttons are the accessible fallback and work, but on the 390px phone the arrows and grip are small (~32px) and close together (`33_values_rank_mobile.png`).
10. The chat and the workspace cannot be seen together on a phone; the coach's step intro is only in the hidden "Talk it through" tab (`32_chat_tab_mobile.png`), so phone users effectively never meet the coach unless they go looking.

**Mobile usability:** Layout is responsive with no horizontal scroll (measured). But fixed chrome is heavy: header (brand + step strip + tab row) is **167px** and the pinned action bar **64px**, so ~27% of an iPhone-sized viewport is chrome before the keyboard appears (`31_step1_values_mobile.png`). The step strip truncates to ~3.5 visible steps and scrolls horizontally. Tap targets: chips 37px, step pills 31px (below the 44px Apple guideline), rank arrows 32px.

**Accessibility signals (measured + code):** `lang="en-AU"`; one h1, h2 per step; all buttons have names (0 unnamed); inputs are labelled via `label for`/`aria-label` (only the consent checkboxes are wrapped-label only, which is fine); `aria-pressed` on chips/options; `aria-current="step"` on the strip; `aria-live="polite"` on the chat log; `role="dialog" aria-modal` on both overlays; `:focus-visible` outline; `prefers-reduced-motion` honoured; `prefers-color-scheme` dark theme with `color-scheme:dark` (`styles.css:15-26`; `23_mix_dark_desktop.png` renders well). Gaps: no focus trap in the modals; the crisis dialog closes only via a button (no Esc handling); body `overflow:hidden` + inner scroll regions can confuse screen-reader navigation; colour contrast of `--faint` (#8aa3ad on #eef4f6) used for hints/kickers is roughly 2.6:1 — below AA for small text.

## 4. Visual design and brand

- **Distinctive and calm.** Newsreader serif body + IBM Plex Mono eyebrows/kickers, teal accent, soft sunk panels, pill chips, 720px measure. It reads as editorial/"considered" rather than SaaS, which fits "whole life, not job title" and differentiates from the blue-gradient LinkedIn-clone aesthetic of most AI career tools.
- Hierarchy is consistent: STEP N OF 10 kicker → h2 question → muted lead → content → pinned bar. Anchor cards ("#1 VALUE / #1 I AM") carry the thread from step to step (`09_north_star_filled_desktop.png`, `15_choose_desktop.png`).
- Density is low-to-moderate on desktop; the chat panel occupies 320-400px of the right side and mostly shows the same intros that already appear in the lead text, so with AI off it is wasted space. The workspace never uses more than 720px of a 1280px screen.
- Weak spots: the summary ("Your Compass map") is plain stacked text, not something anyone would screenshot or share; no illustration, logo mark or wordmark beyond the favicon; brand name "Purposefields" appears only as a tiny eyebrow; no empty-state art. The red "Help now" button clashes with the otherwise monochrome palette on every screen.
- Google Fonts are loaded from Google's CDN (`index.html:12-14`) — a third-party request on a product that promises nothing is stored on "our" server (privacy nit, see below).

## 5. Trust, privacy, safety design

**Strong, and unusually explicit for an indie product:**
- Consent screen states plainly: not therapy; replies are from Claude/Anthropic; answers live in this browser; what you write is sent to Claude when you chat; 18+ (`index.html:70-73`).
- Prompts and API key stay server-side; browser can only request `chat` or four named tasks (`server.js:150-152`). Input validation on turns (`server.js:56-67`), 256kb body limit, per-IP rate limit (`server.js:28-49`), abort upstream on client disconnect (`server.js:70-76`).
- Security headers: strict CSP (`script-src 'self'`, `frame-ancestors 'none'`, `form-action 'none'`), nosniff, no-referrer, Permissions-Policy (`server.js:83-100`). All user text is inserted via `textContent` or escaped `rich()` (`app.js:64-65`).
- Crisis handling at two layers: client keyword list of 22 phrases (`app.js:28`) opens a dialog with Lifeline, Beyond Blue, 000, SANE, 13YARN with `tel:` links (`21_crisis_dialog_desktop.png`), "Help now" always visible, "Need support now?" on the consent screen, "Not therapy · In crisis call Lifeline" footer under the chat; plus the system-prompt instruction (`prompts.js:16`).
- Server-side refusal fallback beta enabled for the main model (`lib/claude.js:9-13`); refusal is surfaced to the user as "Claude couldn't answer that" (`app.js:414`).

**Gaps:**
- "It isn't stored on our server" is true, but the whole answer snapshot (values, identity, North Star, pay floor, location, strengths, ideas, plan) is sent to Anthropic on *every* chat turn (`app.js:409-413`) and the chat history (up to 30 turns) is kept in localStorage in plain text. No privacy policy, terms, data-retention statement, or mention of Anthropic's retention; no ABN/company identity anywhere in the product.
- Keyword crisis detection is substring-based: "end it all", "can't go on" will false-positive on ordinary career frustration ("I can't go on in this job"), and the message is still sent to Claude after the dialog opens (`send()` `app.js:417-418` does not pause). Misspellings or non-English won't trigger.
- No age verification beyond a tick; no moderation of what the user writes; no logging/audit trail of AI outputs (arguably a feature given the privacy stance, but a liability if an output is ever challenged).
- Rate limiting is in-memory per instance and keyed on `req.ip`; behind a proxy without `TRUST_PROXY` all users share one bucket (README notes this).
- No `robots`/`noindex`, no cookie banner needed (none used) — fine.

## 6. Retention and engagement mechanics

Essentially **none**. Evidence:
- State lives only in `localStorage` keys `purposefields_compass_v1`, `purposefields_consent_v1`, `purposefields_goals` (`app.js:30`). Clearing site data, switching browser or device, or private browsing loses everything; there is no export besides "Copy my map" (plain text to clipboard) and the .ics files.
- No email capture, no account, no magic link, no push/PWA notifications (the manifest exists, `public/manifest.webmanifest`, but there is no service worker — it is installable but not offline-capable and cannot notify).
- The only "come back" mechanism is the calendar event's description, which contains the top pick and North Star text (`evt()` `app.js:356`) — a clever low-tech re-engagement, but it points nowhere (no URL back into the app).
- Nothing differentiates a return visit: the app reopens at the last step; no "it's been two weeks, how did the calls go?" state; `S.done` just shows the summary again.
- No sharing, no community, no coach handoff, no streaks/progress beyond the step strip.

## 7. Commercial readiness

- **Pre-commercial.** No accounts, authentication, payments, pricing page, plan tiers, or usage metering. The only cost control is the per-IP limiter; a public deployment runs Opus-class calls (`claude-opus-5-5`, `max_tokens:8000`, `lib/claude.js:4,51`) for every chat and three of the four suggestion tasks with no per-user cap, no daily budget, and no key rotation story. Cost per completed journey could be material.
- **No analytics or telemetry** of any kind (no events, no funnel, no step drop-off measurement, no error reporting). The team cannot currently know where people abandon.
- **No B2B surface**: no coach/case-worker view, no org/tenant, no white-label, no export to employment-services systems, no admin. Yet the obvious AU buyers for "everyday people" career direction are Workforce Australia providers, TAFEs, unions, community orgs and EAPs — all of whom need reporting and a practitioner view.
- Licence `UNLICENSED`, `private: true` (`package.json`); Docker image and `.env.example` exist, so a single-instance deploy is one command away; but no CI config, no staging, no domain/branding assets, no legal pages.
- Localisation: hard-coded to Australia (en-AU copy, AUD assumption in pay, AU crisis lines, default TZ `Australia/Sydney`). Expanding markets means touching copy, resources list and prompts.
- Positioning line is good ("fits your whole life") and the "not for office workers only" stance is a real wedge, but there is no place in the product where that promise is made to the user before they are inside step 1.

## 8. Technical quality and extensibility

**Quality:** High for its size. ~1,070 lines total; zero-build vanilla HTML/CSS/JS; one runtime dependency beyond Express and the SDK (SortableJS served from node_modules, `server.js:104-106`). Code is dense but legible, with small helpers (`h()`, `needBtn`, `rankList`, `aiControl`) reused consistently. Server is clean: NDJSON streaming for chat, structured JSON-schema output for suggestions (`lib/claude.js:72-85`), explicit error-code mapping (`claude.js:24-34`) mirrored in friendly client messages (`app.js:414`, `aiErr` `app.js:155`). Tests cover the API contract including refusal, malformed turns, model selection and error mapping, using a mock SSE server — a sensible, fast suite. Walkthrough produced **zero console or page errors** across desktop and mobile.

**Extensibility concerns:**
- All step logic, content (values list, intros, crisis keywords, resources) and rendering live in one 473-line IIFE (`public/app.js`) with a single global `S` state object; adding a step means editing `STEPS`, `blank()`, `INTROS`, `renderWork()`'s dispatch map, `context()`, `summaryText()` and `renderSummary()` by hand. No component boundaries, no typed state, no front-end tests.
- Persistence schema is versioned only by key name (`_v1`); `load()` does ad-hoc patching (`app.js:97`). Migrating to accounts/server storage would mean designing the data model from scratch.
- Prompts are plain template strings; no versioning, eval set, or logging to iterate coaching quality. The chat sends the full state as JSON every turn with `effort:"low"` on an Opus-class model; no prompt caching is configured even though the system prompt and profile are stable.
- Rate limiter and all state are per-process; horizontal scaling needs an external store.
- Google Fonts and calendar deep-links are the only third-party integrations; there is no plugin point for labour-market data or external tools.
- Dark mode is implemented twice (media query + `data-theme`) but there is no UI toggle, so `data-theme` is dead code (`styles.css:21-26`).

---

## Strengths (summary list)

1. Coherent, deliberately non-directive coaching method that respects the user's own words; prompts are tight, humane and jargon-free (`lib/prompts.js`).
2. Scope discipline: career *direction* only, "whole life" framing, trades/care/community explicitly included in ideation.
3. Excellent small-friction design: "Still needed" hints, two-tap destructive actions, autosave, keyboard Enter-to-add, arrow fallback for drag.
4. Distinctive, calm editorial visual identity with working dark mode; consistent hierarchy; good copy throughout.
5. Trust and safety handled seriously: explicit four-point consent, server-held prompts/key, strict CSP, double-layer crisis handling with AU services, graceful degradation without AI.
6. Concrete ending: three dated actions with Google Calendar links and .ics with alarms — most competitors end at a report.
7. Solid engineering for the size: zero-build, streamed chat, structured outputs, error mapping, passing API tests, no runtime errors observed.

## Weaknesses (summary list)

1. One-shot product with no retention: localStorage only, no accounts, no follow-up, no accountability loop, no cross-device, no sharing with a coach.
2. No reality-testing or labour-market/training information by design; the "What I need" constraints are collected but never applied to ideas.
3. No landing page or value proposition before a four-checkbox consent wall; time-to-complete (~40-60 min) is never disclosed.
4. Visible bugs: literal "null" on step 2; un-normalised "I am a Learner"; summary values line collapses; truncated placeholders; header clipping after adding tags.
5. Mobile: 27% of viewport is fixed chrome; small tap targets; the coach lives in a hidden tab; Mix step is 5+ screens of near-identical cards.
6. Without an API key the ideation step is weak (random trios + blank boxes); with one, cost is uncontrolled (Opus for chat and three suggestion tasks, no per-user budget, no caching).
7. No analytics, no error reporting, no privacy policy/terms/company identity, no B2B/practitioner view, AU-only hard-coding — pre-commercial on every axis.
8. Monolithic front-end with no component structure or front-end tests; adding steps or changing the data model is manual across six places.

---

## Screenshots (`/tmp/claude-0/-home-user-CareerCoach/d4fff7ac-e95a-58db-917a-bd076ed5dc45/scratchpad/screenshots/`)

| File | What it shows |
|---|---|
| `01_consent_desktop.png` | First load at 1280x800: four-checkbox consent modal over the step-1 workspace; no landing page. |
| `02_step1_values_desktop.png` | Step 1 Values after consent: 45 chips, custom-value input, chat panel with intro and "Chat isn't switched on" notice. |
| `03_values_still_needed_desktop.png` | Pressing Next with 0 chosen: red "Still needed: choose 5 more values" hint in the pinned bar. |
| `04_values_rank_desktop.png` | Values ranking list (7 incl. custom "Craft") with arrows and drag grips; #1 highlighted. |
| `05_identity_write_desktop.png` | Step 2 "Who are you?" empty state — shows the literal "null" bug under the heading. |
| `06_identity_tags_desktop.png` | Step 2 with five "I am" tags; "null" bug and un-normalised "I am a Learner" visible. |
| `07_identity_rank_desktop.png` | Ranking the "I am" statements. |
| `08_north_star_empty_desktop.png` | Step 3 North Star empty: anchor cards for #1 value / #1 I am, four prompt questions, textarea, word count. |
| `09_north_star_filled_desktop.png` | North Star filled; the "Still needed: at least 15 words" warning from the earlier short attempt still showing. |
| `10_needs_desktop.png` | Step 4 What I need: pay, hours, stress and work-mode options, location, other. |
| `11_strengths_empty_desktop.png` | Step 5 Strengths empty: four cards with 0/3 counters. |
| `12_strengths_filled_desktop.png` | Strengths filled (3/3 green); truncated placeholders and clipped h2 visible. |
| `13_mix_top_desktop.png` | Step 6 Mix top: numbered know+do+love trio cards with idea inputs; AI buttons absent (no key). |
| `14_mix_bottom_desktop.png` | Mix bottom: "Ideas you already had", "More ideas from Claude" (not switched on), "My ideas" list with source labels. |
| `15_choose_desktop.png` | Step 7 Choose: anchors + North Star quote + ranked ideas with TOP PICK / SECOND badges. |
| `16_plan_desktop.png` | Step 8 Plan: "Drawing a blank? Suggest a path" control and four horizon textareas. |
| `17_actions_desktop.png` | Step 9 First steps: "Working towards" goal card, "Suggest 3 steps", three inputs with examples. |
| `18_calendar_desktop.png` | Step 10 Calendar: external calendar links, per-step day/time/duration pickers. |
| `19_summary_desktop.png` | Compass map top: three first steps with Google Calendar links and .ics downloads. |
| `20_summary_bottom_desktop.png` | Compass map bottom: North Star, run-on values line, I am list, plan, strengths; "Copy my map". |
| `21_crisis_dialog_desktop.png` | "Help now" crisis dialog with five AU services and tel: numbers. |
| `22_back_to_values_after_done_desktop.png` | Revisiting step 1 from the strip after completion (all steps ticked). |
| `23_mix_dark_desktop.png` | Mix step in dark mode (prefers-color-scheme). |
| `30_consent_mobile.png` | Consent modal at 390x844: fills the viewport. |
| `31_step1_values_mobile.png` | Step 1 on mobile: tall fixed header (brand + strip + tabs), chips, pinned bar. |
| `32_chat_tab_mobile.png` | "Talk it through" tab on mobile: coach intro, disabled Send, unavailable notice. |
| `33_values_rank_mobile.png` | Mobile ranking list; small arrow/grip targets. |
| `34_identity_mobile.png` | Mobile step 2 with the "null" bug and tags. |
| `35_north_mobile.png` | Mobile North Star: anchors stack, textarea mostly below the fold. |
| `36_needs_mobile.png` | Mobile What I need with options selected. |
| `37_strengths_mobile.png` | Mobile Strengths: cards stacked, scrolled. |
| `38_mix_mobile.png` | Mobile Mix top: trio chips wrap to two lines. |
| `39_mix_bottom_mobile.png` | Mobile Mix bottom after scrolling ~5 screens. |
| `run_notes.txt` | Raw walkthrough log (a11y metrics, hints, timings, zero errors). |
