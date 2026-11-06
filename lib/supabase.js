import { createClient } from '@supabase/supabase-js'

// Tests set globalThis.__fakeSupabase (tests/helpers/fake-supabase.js) before
// importing anything that imports this file, so handlers run without a database.
const fake = globalThis.__fakeSupabase

export const supabase = fake || createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export const supabasePublic = fake || createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)
