import { supabase } from '../../lib/supabase.js'
import { sydneyInstant, MIN_NOTICE_HOURS } from '../../lib/newpage-members.js'
import { sendMail, fromAddress } from '../../lib/newpage-mail.js'

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const page = (title, text) => `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · AI Career Coach</title>
<link rel="stylesheet" href="/styles.css"></head><body><div class="paper"><main class="col"><section class="screen"><span class="note">your session</span><h1>${esc(title)}</h1><p class="lead">${esc(text)}</p>
<p><a href="/app">Open AI Career Coach</a></p></section></main></div></body></html>`

// Cancel a session from the link in the confirmation email. Outside 24 hours the slot is
// freed and the hour stays the member's to rebook; inside 24 hours it counts as used,
// so the page says to reply instead.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const token = String(req.query?.t || '')
  if (!/^[a-f0-9]{32}$/.test(token)) return res.status(400).send(page('That link isn’t right', 'Open the confirmation email again and use the cancel link there, or reply to it.'))

  const { data: booking } = await supabase.from('bookings').select('id, date, start_time, status, clients(name, email), session_types(name)').eq('cancel_token', token).maybeSingle()
  if (!booking) return res.status(404).send(page('We can’t find that session', 'It may already be cancelled. Reply to your confirmation email if you’re not sure.'))
  if (booking.status === 'cancelled') return res.send(page('Already cancelled', 'That session was already cancelled. Book another from the app whenever you like.'))
  if (booking.status === 'completed') return res.send(page('That session has happened', 'Nothing to cancel. Book another from the app whenever you like.'))

  const [hh, mm = 0] = String(booking.start_time).split(':').map(Number)
  const start = sydneyInstant(booking.date, hh) + mm * 60000
  if (start - Date.now() < MIN_NOTICE_HOURS * 3600e3) {
    return res.send(page('Too close to cancel online', `Sessions need ${MIN_NOTICE_HOURS} hours’ notice to cancel without being counted. Reply to your confirmation email and we’ll see what we can do.`))
  }

  const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
  if (error) return res.status(500).send(page('That didn’t work', 'Please try the link again in a minute, or reply to your confirmation email.'))

  if (process.env.ADMIN_EMAIL && process.env.FROM_EMAIL) {
    try {
      await sendMail({ from: fromAddress(), to: process.env.ADMIN_EMAIL, subject: `Cancelled: ${booking.clients?.name || 'a client'} on ${booking.date} ${String(booking.start_time).slice(0, 5)}`, html: `<p>${esc(booking.clients?.name)} (${esc(booking.clients?.email)}) cancelled their ${esc(booking.session_types?.name)} on ${esc(booking.date)} at ${esc(String(booking.start_time).slice(0, 5))} from the email link. The slot is open again and their hour is still theirs.</p>` })
    } catch (err) { console.error('Cancel notice failed:', err.message) }
  }
  return res.send(page('Your session is cancelled', 'The time is free again and your hour is still yours. Book another from the app whenever you like.'))
}
