import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('long jobs (resume, cover letter, Sky) are allowed to run for a minute, not the default 10 seconds', () => {
  const v = JSON.parse(readFileSync('vercel.json', 'utf8'))
  assert.ok(v.functions['api/newpage/app.js'].maxDuration >= 60)
  assert.ok(v.functions['api/newpage/docx.py'].maxDuration >= 30)
  assert.ok(v.functions['api/newpage/resume.py'].maxDuration >= 300)
  assert.match(v.functions['api/newpage/docx.py'].includeFiles, /api\/_py/)
  assert.ok(v.crons.some(c => c.path === '/api/newpage/retention'))
})

test('the Python function has what it needs to install', () => {
  const r = readFileSync('requirements.txt', 'utf8')
  assert.match(r, /python-docx/); assert.match(r, /pypdf/)
})

test('the resume file picker has no accept filter (phones can offer only the camera), and there is one style', () => {
  for (const f of ['app/resume.js', 'app/context.js', 'app/cover.js']) {
    const s = readFileSync(f, 'utf8')
    assert.ok(!/type: 'file'[^}]*accept/.test(s), `${f}: no accept attribute on the file input`)
  }
  assert.ok(!/templatePicker|tmpl-opt/.test(readFileSync('app/resume.js', 'utf8')), 'the resume writer has no style picker')
})

test('vercel.json pins the framework to none, so the api/*.py files stay separate functions', async () => {
  // Without it, a project whose dashboard preset is Python (auto-detected from requirements.txt)
  // fails to build with PYTHON_ENTRYPOINT_NOT_FOUND, because Vercel wants one app entrypoint.
  const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.ok('framework' in v && v.framework === null)
})

test('the member endpoints load with only the core variables: no Resend, Stripe or Adzuna key needed to start', async () => {
  const { spawnSync } = await import('node:child_process')
  const code = `
    for (const k of Object.keys(process.env)) if (/^(SUPABASE|RESEND|STRIPE|ADZUNA|JWT|CRON|NEWPAGE|ADMIN|FROM|ANTHROPIC)/.test(k)) delete process.env[k]
    Object.assign(process.env, { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k', SUPABASE_ANON_KEY: 'k', JWT_SECRET: 'j' })
    const bad = []
    for (const f of ['app', 'demo', 'auth', 'checkout', 'extension', 'alerts', 'applycheck', 'reminders', 'retention', 'health']) {
      try { await import('./api/newpage/' + f + '.js') } catch (e) { bad.push(f + ': ' + e.message.split('\\n')[0]) }
    }
    console.log(JSON.stringify(bad))`
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: new URL('../', import.meta.url).pathname, encoding: 'utf8' })
  assert.deepEqual(JSON.parse(r.stdout.trim().split('\n').pop()), [], r.stderr)
})
