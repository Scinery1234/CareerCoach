import { supabase } from '../../lib/supabase.js'
import { requireAdmin } from '../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAdmin(req, res)) return

  if (req.method === 'GET') {
    const { status, limit = 50, offset = 0 } = req.query

    let query = supabase
      .from('bookings')
      .select(`
        *,
        clients(id, name, email, phone, status),
        session_types(name, duration_mins)
      `, { count: 'exact' })
      .order('date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    if (status) query = query.eq('status', status)

    const { data, error, count } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ bookings: data, total: count })
  }

  if (req.method === 'PUT') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id required' })
    const { data, error } = await supabase
      .from('bookings').update(req.body).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ booking: data })
  }

  res.status(405).end()
}
