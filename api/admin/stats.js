import { supabase } from '../../lib/supabase.js'
import { requireAdmin } from '../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAdmin(req, res)) return
  if (req.method !== 'GET') return res.status(405).end()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)

  const [
    { data: thisMonthBookings },
    { data: lastMonthBookings },
    { count: totalClients },
    { count: totalSubscribers },
    { data: upcomingBookings }
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('amount_cents, session_type_id, status, session_types(is_free)')
      .gte('date', monthStart)
      .eq('status', 'completed'),
    supabase
      .from('bookings')
      .select('amount_cents, status')
      .gte('date', lastMonthStart)
      .lt('date', monthStart)
      .eq('status', 'completed'),
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('subscribers').select('*', { count: 'exact', head: true }),
    supabase
      .from('bookings')
      .select('*, clients(name, email), session_types(name, is_free)')
      .gte('date', now.toISOString().slice(0, 10))
      .in('status', ['confirmed', 'pending'])
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(10)
  ])

  const thisRevenue = (thisMonthBookings || []).reduce((s, b) => s + (b.amount_cents || 0), 0)
  const lastRevenue = (lastMonthBookings || []).reduce((s, b) => s + (b.amount_cents || 0), 0)
  const thisSessionsBooked = (thisMonthBookings || []).length
  const thisDiscoveryCalls = (thisMonthBookings || []).filter(b => b.session_types?.is_free).length

  res.json({
    thisMonthRevenueCents: thisRevenue,
    lastMonthRevenueCents: lastRevenue,
    thisMonthSessions: thisSessionsBooked,
    thisMonthDiscoveryCalls: thisDiscoveryCalls,
    totalClients: totalClients || 0,
    totalSubscribers: totalSubscribers || 0,
    upcomingBookings: upcomingBookings || []
  })
}
