import { supabase } from '../../lib/supabase.js'
import { rateLimit, isBot } from '../../lib/security.js'
import { PRICE, TRIAL_DAYS } from '../../lib/newpage-pricing.js'
import { stripe, toolsSessionParams } from '../../lib/newpage-stripe.js'
import { applyCheckout } from '../../lib/newpage-payments.js'
import { signSession } from '../../lib/newpage-auth.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

// Public. Joining AI Career Coach: the $25-a-month membership, paid by card on Stripe.
//   POST { action: 'quote' }                -> the price
//   POST { action: 'start', name, email }   -> { url } to pay
// Prices are decided here. Nothing the browser sends changes them.
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()
  if (!rateLimit(req, res, { max: 20, windowMs: 60 * 60 * 1000, key: 'np-checkout' })) return
  const b = req.body || {}
  if (isBot(b)) return res.json({ ok: true })

  // After paying, Stripe sends the buyer back with their session id. We check with Stripe that it
  // was paid, make sure access has been given (the webhook may not have arrived yet), and sign
  // brand-new members straight in. People who already have an account must use the emailed link.
  if (b.action === 'claim') {
    const sid = typeof b.sid === 'string' ? b.sid : ''
    if (!/^cs_(test_|live_)?[A-Za-z0-9]{10,200}$/.test(sid)) return res.status(400).json({ error: 'That payment link doesn’t look right.' })
    try {
      const session = await stripe().checkout.sessions.retrieve(sid)
      const started = session.payment_status === 'paid' || (session.payment_status === 'no_payment_required' && Number(session.metadata?.trial) > 0)
      if (session.metadata?.kind !== 'newpage_tools' || !started) return res.status(402).json({ error: 'We haven’t seen that payment come through yet. Give it a minute and refresh this page.', code: 'not_paid' })
      await applyCheckout(session)
      const email = (session.metadata.email || session.customer_email || '').toLowerCase()
      const { data: member } = await supabase.from('newpage_members').select('id, status, last_login_at, created_at').eq('email', email).maybeSingle()
      const fresh = member && member.status === 'active' && !member.last_login_at && Date.now() - new Date(member.created_at).getTime() < 3 * 60 * 60 * 1000
      if (fresh) await supabase.from('newpage_members').update({ last_login_at: new Date().toISOString() }).eq('id', member.id)
      return res.json({ ok: true, email, plan: 'tools', ...(fresh ? { session: signSession(member.id) } : {}) })
    } catch (err) {
      console.error('Claim failed:', err)
      return res.status(502).json({ error: 'We couldn’t check your payment just now. Your welcome email will arrive shortly with a link.' })
    }
  }

  // One plan: the monthly membership. Sessions with a human coach are bought inside the app.
  if (b.action === 'quote') return res.json({ plan: 'tools', totalCents: PRICE.toolsCents, monthly: true, trialDays: TRIAL_DAYS() })
  if (b.action !== 'start') return res.status(400).json({ error: 'Unknown action' })

  const email = clip(b.email, 200).toLowerCase()
  const name = clip(b.name, 80)
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Add the email you want to use for AI Career Coach.' })
  if (!name) return res.status(400).json({ error: 'Add your name.' })
  try {
    const session = await stripe().checkout.sessions.create(toolsSessionParams({ email, name }))
    return res.json({ url: session.url })
  } catch (err) {
    console.error('Checkout failed:', err)
    return res.status(502).json({ error: 'We couldn’t start the payment. Please try again in a minute.' })
  }
}
