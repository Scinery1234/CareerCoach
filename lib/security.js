import { timingSafeEqual } from 'node:crypto'

// ── Cron endpoints ───────────────────────────────────────────────
// True only when CRON_SECRET is set and the bearer token matches it exactly.
// With the secret unset nothing is allowed: a missing secret must not open the door.
export function cronAuthorised(req) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers?.authorization || ''
  if (!secret || !auth.startsWith('Bearer ')) return false
  const given = Buffer.from(auth.slice(7)), want = Buffer.from(secret)
  return given.length === want.length && timingSafeEqual(given, want)
}

// ── Rate limiting (in-memory, resets on cold start) ──────────────
const rateLimitStore = new Map()

export function rateLimit(req, res, { max = 5, windowMs = 60 * 60 * 1000, key = null } = {}) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  const id = key ? `${key}:${ip}` : ip
  const now = Date.now()
  const entry = rateLimitStore.get(id) || { count: 0, resetAt: now + windowMs }

  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + windowMs
  }

  entry.count++
  rateLimitStore.set(id, entry)

  if (entry.count > max) {
    res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000))
    res.status(429).json({ error: 'Too many requests. Please try again later.' })
    return false
  }
  return true
}

// ── Brute-force lockout ──────────────────────────────────────────
const lockoutStore = new Map()

export function checkLockout(ip) {
  const entry = lockoutStore.get(ip)
  if (!entry) return false
  if (Date.now() > entry.lockedUntil) { lockoutStore.delete(ip); return false }
  return true
}

export function recordFailedLogin(ip, { maxAttempts = 5, lockoutMs = 15 * 60 * 1000 } = {}) {
  const entry = lockoutStore.get(ip) || { attempts: 0, lockedUntil: 0 }
  entry.attempts++
  if (entry.attempts >= maxAttempts) entry.lockedUntil = Date.now() + lockoutMs
  lockoutStore.set(ip, entry)
}

export function clearLoginAttempts(ip) {
  lockoutStore.delete(ip)
}

// ── Input sanitisation ───────────────────────────────────────────
export function sanitise(value) {
  if (typeof value !== 'string') return value
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
}

export function sanitiseObject(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? sanitise(v) : v
  }
  return out
}

// ── Honeypot check ───────────────────────────────────────────────
export function isBot(body) {
  // Reject if honeypot field is filled
  return !!(body._hp || body.website || body.url)
}
