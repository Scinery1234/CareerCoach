import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cronAuthorised } from '../lib/security.js'
import { sydneyInstant } from '../lib/newpage-members.js'

test('cron auth fails closed when the secret is unset, and compares exactly', () => {
  const req = h => ({ headers: { authorization: h } })
  delete process.env.CRON_SECRET
  assert.equal(cronAuthorised(req('Bearer undefined')), false)
  assert.equal(cronAuthorised(req(undefined)), false)
  process.env.CRON_SECRET = 's3cret'
  assert.equal(cronAuthorised(req('Bearer s3cret')), true)
  assert.equal(cronAuthorised(req('Bearer s3cre')), false)
  assert.equal(cronAuthorised(req('Bearer s3cret!')), false)
  assert.equal(cronAuthorised(req('s3cret')), false)
  assert.equal(cronAuthorised({ headers: {} }), false)
})

test('a Sydney 10:00 session is not the same instant as 10:00 UTC', () => {
  const summer = sydneyInstant('2026-01-15', 10) // AEDT, UTC+11
  assert.equal(new Date(summer).toISOString(), '2026-01-14T23:00:00.000Z')
  const winter = sydneyInstant('2026-07-15', 10) // AEST, UTC+10
  assert.equal(new Date(winter).toISOString(), '2026-07-15T00:00:00.000Z')
})
