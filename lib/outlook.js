async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default'
    })
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`)
  return data.access_token
}

function toISOLocal(dateStr, timeStr, durationMins) {
  // dateStr = 'YYYY-MM-DD', timeStr = 'HH:MM'
  const start = new Date(`${dateStr}T${timeStr}:00+10:00`)
  const end = new Date(start.getTime() + durationMins * 60000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function createOutlookEvent({ booking, client, meetLink }) {
  if (!process.env.MICROSOFT_CLIENT_ID) return // skip if not configured

  const token = await getAccessToken()
  const { start, end } = toISOLocal(booking.date, booking.start_time, booking.duration_mins)

  const event = {
    subject: `${client.name} — ${booking.session_type_name}`,
    body: {
      contentType: 'HTML',
      content: `<p>Client: <strong>${client.name}</strong> (${client.email})</p>
        <p>Session: ${booking.session_type_name}</p>
        <p><a href="${meetLink}">Join Google Meet</a></p>`
    },
    start: { dateTime: start, timeZone: 'Australia/Sydney' },
    end: { dateTime: end, timeZone: 'Australia/Sydney' },
    location: { displayName: meetLink },
    attendees: [
      {
        emailAddress: { address: client.email, name: client.name },
        type: 'required'
      }
    ],
    isOnlineMeeting: false
  }

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${process.env.ADMIN_EMAIL}/calendar/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    }
  )

  if (!res.ok) {
    const err = await res.json()
    console.error('Outlook calendar error:', err)
  }
}
