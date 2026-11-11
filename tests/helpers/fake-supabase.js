// An in-memory stand-in for the Supabase client, covering the chained calls the
// handlers use: from().select/insert/update/upsert/delete().eq/neq/is/in/lte/gte
// .order().limit().maybeSingle()/.single(), awaited for { data, error }.
// Install it with `globalThis.__fakeSupabase = fakeSupabase()` before importing
// anything that imports lib/supabase.js. It records every call in `calls`.
import { randomUUID } from 'node:crypto'

// Tables whose id is a numbered identity column in the real database, so ordering by id means "oldest first".
const IDENTITY = new Set(['newpage_messages', 'newpage_access_log', 'newpage_events'])

export function fakeSupabase(seed = {}) {
  let nextId = 1000
  const tables = new Map(Object.entries(seed).map(([k, v]) => [k, v.map(r => ({ ...r }))]))
  const calls = []
  const rows = t => { if (!tables.has(t)) tables.set(t, []); return tables.get(t) }

  function builder(table) {
    const q = { table, op: 'select', filters: [], order: null, limit: null, mode: 'many', payload: null, columns: '*', onConflict: null, head: false }
    const api = {
      select(cols = '*', opts = {}) { if (q.op === 'select') { q.columns = cols; q.head = !!opts.head } else q.returning = true; return api },
      insert(payload) { q.op = 'insert'; q.payload = payload; return api },
      update(payload) { q.op = 'update'; q.payload = payload; return api },
      upsert(payload, opts = {}) { q.op = 'upsert'; q.payload = payload; q.onConflict = opts.onConflict || null; return api },
      delete() { q.op = 'delete'; return api },
      eq(k, v) { q.filters.push(r => r[k] === v); return api },
      neq(k, v) { q.filters.push(r => r[k] !== v); return api },
      is(k, v) { q.filters.push(r => (v === null ? r[k] == null : r[k] === v)); return api },
      in(k, vs) { q.filters.push(r => vs.includes(r[k])); return api },
      lte(k, v) { q.filters.push(r => r[k] != null && r[k] <= v); return api },
      gte(k, v) { q.filters.push(r => r[k] != null && r[k] >= v); return api },
      lt(k, v) { q.filters.push(r => r[k] != null && r[k] < v); return api },
      gt(k, v) { q.filters.push(r => r[k] != null && r[k] > v); return api },
      order(k, opts = {}) { q.order = { k, asc: opts.ascending !== false }; return api },
      limit(n) { q.limit = n; return api },
      maybeSingle() { q.mode = 'maybe'; return api },
      single() { q.mode = 'single'; return api },
      then(res, rej) { return Promise.resolve().then(run).then(res, rej) }
    }
    function matching() { return rows(table).filter(r => q.filters.every(f => f(r))) }
    function shape(list) {
      if (q.order) list = [...list].sort((a, b) => { const x = a[q.order.k], y = b[q.order.k]; const c = x == null ? 0 : y == null ? 0 : x < y ? -1 : x > y ? 1 : 0; return q.asc === false ? -c : (q.order.asc ? c : -c) })
      if (q.limit != null) list = list.slice(0, q.limit)
      // Like a real database, hand back copies: changing a row you read must not change the stored row.
      list = list.map(r => ({ ...r }))
      if (q.mode === 'maybe') return list[0] ?? null
      if (q.mode === 'single') { if (list.length !== 1) throw Object.assign(new Error('single() expects one row'), { code: 'PGRST116' }); return list[0] }
      return list
    }
    function run() {
      calls.push({ table, op: q.op, payload: q.payload, filters: q.filters.length })
      try {
        if (q.op === 'select') { const m = matching(); return { data: q.head ? null : shape(m), error: null, count: m.length } }
        if (q.op === 'insert' || q.op === 'upsert') {
          const list = Array.isArray(q.payload) ? q.payload : [q.payload]
          const out = []
          for (const p of list) {
            let existing = null
            if (q.op === 'upsert') {
              const keys = (q.onConflict || 'id').split(',').map(s => s.trim())
              existing = rows(table).find(r => keys.every(k => r[k] === p[k]))
            }
            if (existing) { Object.assign(existing, p); out.push(existing) } else { const row = { id: IDENTITY.has(table) ? ++nextId : randomUUID(), created_at: new Date().toISOString(), ...p }; rows(table).push(row); out.push(row) }
          }
          return { data: q.returning ? shape(out) : null, error: null }
        }
        if (q.op === 'update') { const m = matching(); for (const r of m) Object.assign(r, q.payload); return { data: q.returning ? shape(m) : null, error: null } }
        if (q.op === 'delete') { const m = new Set(matching()); tables.set(table, rows(table).filter(r => !m.has(r))); return { data: q.returning ? [...m] : null, error: null } }
      } catch (error) { return { data: null, error: { message: error.message, code: error.code } } }
    }
    return api
  }

  return { from: builder, tables, calls, rows }
}
