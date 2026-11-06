import { supabase } from '../../../../lib/supabase.js'
import { requireAdmin } from '../../../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAdmin(req, res)) return

  const { id, noteId } = req.query

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ notes: data })
  }

  if (req.method === 'POST') {
    const { note_text } = req.body
    if (!note_text?.trim()) return res.status(400).json({ error: 'Note text required' })
    const { data, error } = await supabase
      .from('client_notes')
      .insert({ client_id: id, note_text })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ note: data })
  }

  if (req.method === 'DELETE') {
    if (!noteId) return res.status(400).json({ error: 'noteId required' })
    const { error } = await supabase.from('client_notes').delete().eq('id', noteId)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  res.status(405).end()
}
