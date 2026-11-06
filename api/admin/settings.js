import { supabase } from '../../lib/supabase.js'
import { requireAdmin } from '../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAdmin(req, res)) return

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('admin_settings').select('*')
    if (error) return res.status(500).json({ error: error.message })
    const settings = Object.fromEntries(data.map(r => [r.key, r.value]))
    return res.json({ settings })
  }

  if (req.method === 'PUT') {
    const { updates } = req.body
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'updates object required' })
    }
    const rows = Object.entries(updates).map(([key, value]) => ({ key, value }))
    const { error } = await supabase.from('admin_settings').upsert(rows)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  res.status(405).end()
}
