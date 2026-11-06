import { supabase } from '../../lib/supabase.js'
import { requireAdmin } from '../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAdmin(req, res)) return

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('availability')
      .select('day_of_week, hour, is_available')
      .order('day_of_week')
      .order('hour')
    if (error) return res.status(500).json({ error: error.message })

    // Shape into { 0: [hours...], 1: [hours...], ... }
    const avail = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    for (const row of data) {
      if (row.is_available) avail[row.day_of_week].push(row.hour)
    }
    return res.json({ availability: avail })
  }

  if (req.method === 'PUT') {
    // Expects { availability: { 0: [hours], 1: [hours], ... } }
    const { availability } = req.body
    if (!availability) return res.status(400).json({ error: 'availability object required' })

    // Build upsert rows for all day/hour combos we track (hours 6–22)
    const rows = []
    for (let dow = 0; dow <= 6; dow++) {
      for (let h = 6; h <= 22; h++) {
        rows.push({
          day_of_week: dow,
          hour: h,
          is_available: (availability[dow] || []).includes(h)
        })
      }
    }
    const { error } = await supabase
      .from('availability')
      .upsert(rows, { onConflict: 'day_of_week,hour' })
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  res.status(405).end()
}
