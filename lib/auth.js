import jwt from 'jsonwebtoken'

export function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return null
  }
}

export function requireAdmin(req, res) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  const token = verifyToken(auth.slice(7))
  if (!token) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return null
  }
  return token
}
