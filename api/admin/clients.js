import { supabase } from '../../lib/supabase.js'
import { requireAdmin } from '../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAdmin(req, res)) return

  if (req.method === 'GET') {
    const { status, search } = req.query

    let query = supabase
      .from('clients')
      .select(`*, bookings(id, date, amount_cents, status)`)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    const clients = data.map(c => ({
      ...c,
      session_count: c.bookings?.length ?? 0,
      total_revenue_cents: c.bookings?.reduce(
        (sum, b) => b.status === 'completed' ? sum + (b.amount_cents ?? 0) : sum, 0
      ) ?? 0,
      last_session_date: c.bookings
        ?.sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date ?? null
    }))

    return res.json({ clients })
  }

  if (req.method === 'PUT') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id required' })
    const { data, error } = await supabase
      .from('clients').update(req.body).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ client: data })
  }

  res.status(405).end()
}
