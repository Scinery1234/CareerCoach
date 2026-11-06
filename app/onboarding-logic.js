// Onboarding: the shortest path from "I just joined" to one real result per tool,
// shown once each and never after it's done. Shared by the server (which stores
// the state on the member) and the browser (which imports this file directly),
// so it must stay free of Node imports.
//
// State, kept in newpage_members.onboarding (jsonb):
//   { intent, done: { module: date }, dismissed: { module: date }, seen: { module: n } }
// `intent` is the ad angle the member came from (index.html ?v=), carried through
// join and Stripe metadata, and it decides which module runs first.

export const INTENTS = ['resume', 'direction', 'stuck', 'interview']
export const cleanIntent = v => (INTENTS.includes(v) ? v : 'resume')

// Every module the app knows. `card` modules can be the one card on Today; the rest are
// spotlights inside their tool and only count towards the strip.
export const MODULES = ['app', 'sky', 'resume_in', 'tailor', 'resume_new', 'cover', 'cover_review', 'compass_start', 'compass', 'report', 'linkedin', 'outreach', 'planner', 'notes', 'context', 'checkin', 'session', 'progress']

// The first four things a member does, in the order their intent suggests. Only these
// go on the progress strip and queue as Today cards.
export const ORDER = {
  resume: ['resume_in', 'tailor', 'sky', 'cover'],
  direction: ['sky', 'compass_start', 'resume_in', 'report'],
  stuck: ['sky', 'resume_in', 'tailor', 'planner'],
  interview: ['sky', 'resume_in', 'session', 'tailor'],
  demo: ['sky', 'tailor', 'compass_start']
}

// Which Sky focus the intent opens on.
export const INTENT_FOCUS = { resume: 'career', direction: 'career', stuck: 'action', interview: 'interview' }

const DATE_RE = /^\d{4}-\d{2}-\d{2}/
const dateOnly = v => (typeof v === 'string' && DATE_RE.test(v) ? v.slice(0, 10) : null)

export function cleanOnboarding(raw, fallbackIntent = null) {
  const o = raw && typeof raw === 'object' ? raw : {}
  const map = (src, keep) => Object.fromEntries(Object.entries(src && typeof src === 'object' ? src : {}).filter(([k]) => MODULES.includes(k)).map(([k, v]) => [k, keep(v)]).filter(([, v]) => v !== null))
  return {
    intent: cleanIntent(o.intent || fallbackIntent),
    done: map(o.done, dateOnly),
    dismissed: map(o.dismissed, dateOnly),
    seen: map(o.seen, v => (Number.isInteger(v) && v > 0 ? Math.min(v, 99) : null))
  }
}

export const today = (now = new Date()) => new Date(now).toISOString().slice(0, 10)

// A new state with one change applied: done, dismissed, or one more view.
export function markOnboarding(state, kind, module, now = new Date()) {
  const s = cleanOnboarding(state)
  if (!MODULES.includes(module)) return s
  if (kind === 'done') s.done[module] = today(now)
  else if (kind === 'dismissed') s.dismissed[module] = today(now)
  else if (kind === 'seen') s.seen[module] = (s.seen[module] || 0) + 1
  else if (kind === 'reset') { delete s.done[module]; delete s.dismissed[module]; delete s.seen[module] }
  return s
}

export const isDone = (state, module) => !!state?.done?.[module]
// A module has had its go: done, dismissed, or shown its card twice without a win.
export const isSpent = (state, module) => isDone(state, module) || !!state?.dismissed?.[module] || (state?.seen?.[module] || 0) >= 2

// What the strip shows for this member, in order, with what's done.
export function stripFor(state, { demo = false } = {}) {
  const order = ORDER[demo ? 'demo' : cleanIntent(state?.intent)]
  return order.map(m => ({ module: m, done: isDone(state, m) }))
}

// The one module whose card Today should show now, or null. The first-line card ("app")
// always comes first; after that, the intent order, skipping anything spent.
export function nextModule(state, { demo = false } = {}) {
  if (!demo && !isSpent(state, 'app')) return 'app'
  return stripFor(state, { demo }).map(x => x.module).find(m => !isSpent(state, m)) || null
}

// Some modules only make sense once something exists. `facts` comes from the `me` payload.
export function moduleReady(module, facts = {}) {
  if (module === 'tailor' || module === 'cover' || module === 'linkedin') return !!facts.hasResume
  if (module === 'report') return !!facts.compassDone || (facts.checkins || 0) >= 2
  if (module === 'planner') return (facts.tasks || 0) > 0
  return true
}

// The card copy. Kept here so the strip, the cards and the tests agree.
export const CARDS = {
  resume_in: { title: 'Put your resume in once.', body: 'Upload a Word or PDF file, or paste the text. Every writer uses it from then on, and nothing goes to an employer.', button: 'Add my resume', go: ['tools', 'resume'] },
  tailor: { title: 'Tailor it to a job in about a minute.', body: 'Paste an ad and see your resume adjusted for it, with every change shown and the gaps named honestly. No ad handy? Try a sample.', button: 'Tailor my resume', go: ['tools', 'resume'] },
  sky: { title: 'Say one thing to Sky.', body: 'Sky is your AI coach. It remembers what you tell it, so every conversation starts where the last one ended.', button: 'Talk to Sky', go: ['coach'] },
  cover: { title: 'Write the cover letter from your own proof.', body: 'Sky reads the ad for what they’ll assess, asks you for real examples, then writes the letter and reviews it like a recruiter would.', button: 'Write a cover letter', go: ['tools', 'cover'] },
  compass_start: { title: 'Start with what matters to you.', body: 'The Compass is ten short steps from your values to a direction and three first steps. The first three steps take one sitting.', button: 'Open the Compass', go: ['tools', 'compass'] },
  report: { title: 'Your Career Direction Report is ready to write.', body: 'One page that pulls your Compass, check-ins and notes together: where you are, what matters, and your next 30 days.', button: 'Create my report', go: ['tools', 'report'] },
  planner: { title: 'Give your first task a day.', body: 'Tasks with a day get a morning email, and one tap puts them in your calendar.', button: 'Open the planner', go: ['tools', 'planner'] },
  session: { title: 'Practise with a person when you’re ready.', body: 'Sky runs mock interviews any time. For a real panel feel, members can book a 60-minute session with a human career coach.', button: 'See how sessions work', go: ['tools', 'session'] }
}

export const STRIP_LABELS = { resume_in: 'Put your resume in', tailor: 'Tailor it to a job', sky: 'Say hello to Sky', cover: 'Write a cover letter', compass_start: 'Start the Compass', report: 'Create your report', planner: 'Give a task a day', session: 'See how sessions work' }
