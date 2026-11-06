// Onboarding in the member app: three small pieces, reused by every screen.
//   spotlight  one sentence above the thing it points at, until that module is done
//   winCard    one card with one prefilled action and "Not now"; shown at most twice
//   strip      the first four wins for this member's intent, ticking itself off
// What is done lives on the server (member.onboarding), so it survives devices.
import { h } from './ui.js'
import { nextModule, stripFor, isDone, isSpent, moduleReady, markOnboarding, CARDS, STRIP_LABELS, INTENT_FOCUS, cleanIntent } from './onboarding-logic.js'

const EMPTY = { intent: 'resume', done: {}, dismissed: {}, seen: {} }
export const ob = ctx => ctx.S.me?.onboarding || EMPTY
export const done = (ctx, module) => isDone(ob(ctx), module)
export const intentFocus = ctx => INTENT_FOCUS[cleanIntent(ob(ctx).intent)] || 'career'

// Record a step, optimistically, then on the server. Re-renders only when asked.
export async function mark(ctx, kind, module, { render = false } = {}) {
  const me = ctx.S.me
  if (!me) return
  if (kind === 'done' && isDone(me.onboarding, module)) return
  me.onboarding = markOnboarding(me.onboarding, kind, module)
  if (render) ctx.render()
  try { const r = await ctx.call('/api/newpage/app', { action: 'onboarding_set', kind, module }); if (r?.onboarding) me.onboarding = r.onboarding } catch { /* kept locally for this session */ }
}

// A view of a card counts once per session, so a card shown twice without a win steps aside.
const viewed = new Set()
function countView(ctx, module) {
  if (viewed.has(module)) return
  viewed.add(module)
  mark(ctx, 'seen', module)
}

export function spotlight(ctx, module, text) {
  if (done(ctx, module)) return null
  return h('p', { class: 'spot', role: 'note' }, text)
}

export function winCard(ctx, module, { title, body, button, onAct, secondary } = {}) {
  const c = CARDS[module] || {}
  countView(ctx, module)
  return h('div', { class: 'tool-callout win', 'data-module': module },
    h('div', {}, h('b', {}, title || c.title), h('p', { class: 'small' }, body || c.body)),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', type: 'button', onclick: onAct || (() => ctx.go(...c.go)) }, button || c.button),
      secondary,
      h('button', { class: 'link-btn', type: 'button', onclick: () => mark(ctx, 'dismissed', module, { render: true }) }, 'Not now')))
}

// The one card Today shows: the next unmet, ready module for this member.
export function todayCard(ctx) {
  const me = ctx.S.me
  const demo = !!me.member.demo
  const state = ob(ctx)
  const order = stripFor(state, { demo }).map(x => x.module)
  const first = nextModule(state, { demo })
  if (first === 'app') return null // the first-line card is its own screen
  const module = order.find(m => !isSpent(state, m) && moduleReady(m, me.facts || {}))
  if (!module || !CARDS[module]) return null
  return winCard(ctx, module)
}

export function strip(ctx) {
  const me = ctx.S.me
  const state = ob(ctx)
  const items = stripFor(state, { demo: !!me.member.demo })
  if (items.every(i => i.done)) return null
  const n = items.filter(i => i.done).length
  return h('div', { class: 'card strip' },
    h('div', { class: 'week-head' }, h('span', { class: 'label' }, 'Your first wins'), h('span', { class: 'small muted' }, `${n} of ${items.length}`)),
    h('ol', { class: 'strip-list' }, items.map(i => {
      const c = CARDS[i.module]
      const ready = moduleReady(i.module, me.facts || {})
      return h('li', { class: i.done ? 'won' : ready ? '' : 'later' },
        h('span', { class: 'tick', 'aria-hidden': 'true' }, i.done ? '✓' : '○'),
        h('span', {}, STRIP_LABELS[i.module] || i.module),
        !i.done && ready && c && h('button', { class: 'link-btn blue', type: 'button', onclick: () => ctx.go(...c.go) }, 'Go'))
    })))
}

// "What are you going for?" The one line that seeds Sky's memory and the planner.
export function firstLineCard(ctx) {
  const S = ctx.S
  const first = (S.me.member.name || '').split(' ')[0]
  const save = async skip => {
    if (S.busy) return
    S.busy = true; S.error = ''; ctx.render()
    try {
      const d = await ctx.call('/api/newpage/app', { action: 'first_line', text: skip ? '' : (S.firstLine || '').trim() })
      S.me = { ...S.me, ...d }
      S.busy = false
      if (!skip) { S.coach = intentFocus(ctx); ctx.go('coach') } else ctx.render()
    } catch (e) { S.error = e.message; S.busy = false; ctx.render() }
  }
  return h('form', { class: 'week-card first-line', onsubmit: e => { e.preventDefault(); save(false) } },
    h('span', { class: 'note' }, 'one question to start'),
    h('h2', {}, first ? `Hi ${first}. What are you going for?` : 'What are you going for?'),
    h('p', { class: 'muted' }, 'A role, a change, a decision, a rest. One line is plenty. Sky remembers it, and it becomes your first goal.'),
    h('div', { class: 'field' }, h('label', { for: 'first-line', class: 'sr-only' }, 'What are you going for?'),
      h('input', { id: 'first-line', type: 'text', maxlength: '200', placeholder: 'e.g. A policy officer role in state government by March', value: S.firstLine || '', oninput: e => { S.firstLine = e.target.value } })),
    S.error && h('p', { class: 'error', role: 'alert' }, S.error),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', type: 'submit', disabled: S.busy }, S.busy ? 'One moment…' : 'Save and meet Sky'),
      h('button', { class: 'link-btn', type: 'button', disabled: S.busy, onclick: () => save(true) }, 'Skip')))
}

// The first line they gave, if any, from Sky's notes.
export function firstLine(ctx) {
  const n = (ctx.S.me?.memory || []).find(m => /^Going for: /.test(m.note))
  return n ? n.note.replace(/^Going for: /, '') : ''
}
