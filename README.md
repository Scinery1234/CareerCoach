# AI Career Coach (aicareercoach.net)

Sky, an AI career coach that remembers you, with the tools around it (resume writer and tailoring, cover letter writer, the Compass, LinkedIn and outreach writers, planner, notes, a career direction report), sold as a $25-a-month membership. Members can add paid 60-minute online sessions with a human career coach, booked from inside the app. By Purposefields.

This branch is a standalone product. It carries the Sky and tools stack from the New Page program (the `vikashan` repo) with the four-week program, the quiz funnel and the scholarship path removed, and the human coach sold by the hour instead of included. `main` still holds The Compass, the earlier standalone tool.

## What's here

| Path | What it does |
|---|---|
| `index.html` | The landing page the ads point at. `/join` pays, `/demo` is the no-sign-up demo. |
| `app/` | The member app: Today, Coach (Sky), Tools, Me. Plain HTML, CSS and JS, no build step. |
| `join/`, `demo/`, `memory/`, `admin/` | Paying, the demo, the memory page linked from retention emails, and the admin (members, demo feedback, the content editor, "Is everything working?"). `admin/bookings.html` manages the human coach's availability and bookings. |
| `api/newpage/*.js` | Serverless endpoints (Vercel). `app.js` is the member endpoint; `checkout.js` sells the membership; `members.js`, `health.js` are admin. Crons: `reminders`, `retention`, `programmail`, `applycheck` (Sunday note about the week's applications, for members who turned it on), `alerts` (hourly: new listings from Adzuna scored for fit, see below). |
| `lib/newpage-apply.js`, `app/apply.js` | The application log: what a member applied for and what came back. Logged from the end of the tailor and cover letter flows or by hand under Tools, Applications; the week's count is on Today. Sky knows where the member is with applying (worked out in code, not guessed), offers help once at the right moment, respects a no, and has an Applying focus plus tools to log and update applications when the member says so. Plan for the rest of this work: `docs/APPLY_PLAN.md`. |
| `api/newpage/resume.py`, `docx.py`, `api/_py/` | Python: the resume agent, the Word builders, usage limits. |
| `api/bookings`, `api/availability.js`, `api/session-types.js`, `api/admin/*` | The booking engine for sessions with the human coach. |
| `api/webhooks/stripe.js` | Stripe: membership paid, renewed, cancelled; sessions bought. |
| `lib/` | Everything shared: Sky's prompts and principles, memory encryption, usage caps, emails, Stripe. |
| `content/` | The program content modules Sky and the content editor still reference. The program itself is not sold here. |
| `sql/` | Supabase schema: `schema.sql` (bookings) then `newpage.sql` (members, docs, memory, usage). |
| `tests/` | `npm test` (Node) and `python3 -m unittest discover -s tests/py`. |

## Deploy

1. **Vercel.** New project from this repo, production branch set to this branch. Root is the repo. Python functions need the Python runtime (Vercel picks it up from the `.py` files).
2. **Supabase.** New project. Run `sql/schema.sql`, then `sql/newpage.sql`, in the SQL editor.
3. **Stripe.** A webhook to `https://aicareercoach.net/api/webhooks/stripe` for `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`. Turn on the Customer Portal (Settings, Billing, Customer portal).
4. **Resend.** Verify `aicareercoach.net` and set `FROM_EMAIL` on it.
5. **Environment variables** (Vercel, Production):

| Variable | What |
|---|---|
| `NEXT_PUBLIC_URL` | `https://aicareercoach.net` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY` | From the Supabase project |
| `JWT_SECRET` | Long random string; signs member and admin sessions |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` | Admin sign-in. Hash with `npm run generate-hash -- 'your password'` |
| `ANTHROPIC_API_KEY` | Sky and the writers |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Early alerts: new job listings from Adzuna's Australian API, checked hourly for members who set roles under Tools, Applications. Without them the alerts cron does nothing. `ALERTS_MODEL_BUDGET` (default 25) caps fit-scoring model calls per run; `NEWPAGE_FIT_MODEL` picks the model (default: the coach model). |
| `NEWPAGE_WRITER_MODEL`, `RESUME_MODEL` | Optional. `claude-sonnet-5-5` keeps the writers cheap; default is Opus |
| `TRIAL_DAYS` | Free trial on the membership, card taken at checkout. Default 7; 0 switches it off and the pages say $25 a month |
| `NEWPAGE_MEMORY_KEY` | 32 random bytes, base64. Encrypts Sky's memory. `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | From Stripe |
| `RESEND_API_KEY`, `FROM_EMAIL`, `FROM_NAME` | Email |
| `CRON_SECRET` | Vercel sets this for crons |
| `GOOGLE_*` | Optional: the human coach's Google Calendar, for busy times and invites (see `lib/google-calendar.js`) |

6. In the admin, press **Is everything working?** It checks every table, column, key and service and names what's missing.

## The landing page and ads

`index.html` is the page ads land on. It carries one message, one button and the product drawn in HTML, with proof next to the button and the objections answered under it. Each ad angle has its own headline: send traffic to `/?v=resume` (default), `/?v=direction`, `/?v=stuck` or `/?v=interview`, so the ad's promise and the headline match. The variant travels to the thank-you page and is sent with the conversion event.

Conversion tracking: put your ids in `track.js` (`ga4`, `meta`, or a Google Ads `gadsLabel`). It fires `begin_checkout`/`InitiateCheckout` on the start buttons and `purchase`/`StartTrial` on the join thank-you page. With the ids empty nothing loads.

## Prices

In `lib/newpage-pricing.js`: `toolsCents` is the membership ($25), `hourCents` the human coach session ($250 an hour, up to `maxHours` at a time). Caps per month are in `lib/newpage-usage.js`.

## Tests

```bash
npm install
npm test
python3 -m unittest discover -s tests/py
```

Handler tests run against an in-memory Supabase (`tests/helpers/fake-supabase.js`), installed on `globalThis.__fakeSupabase` before `lib/supabase.js` is imported, so no database or network is needed.
