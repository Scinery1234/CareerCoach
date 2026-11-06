import bcrypt from 'bcryptjs'
import { signToken } from '../../lib/auth.js'
import { checkLockout, recordFailedLogin, clearLoginAttempts } from '../../lib/security.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'

  if (checkLockout(ip)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' })
  }

  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  const emailMatch = email === process.env.ADMIN_EMAIL
  const hashToCheck = emailMatch ? process.env.ADMIN_PASSWORD_HASH : '$2a$10$invalidhashpadding000000000000000000000000000000000000'
  const valid = await bcrypt.compare(password, hashToCheck)

  if (!emailMatch || !valid) {
    recordFailedLogin(ip)
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  clearLoginAttempts(ip)
  const token = signToken({ email, role: 'admin' })
  res.json({ token })
}
