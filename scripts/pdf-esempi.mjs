#!/usr/bin/env node
// Genera PDF di prova con la nuova pipeline (pagina di stampa + Chrome
// headless) in IT, EN e DE e li salva in docs/pdf-esempi/ (ignorati da git:
// possono contenere dati reali).
//
// Uso (con il sito in esecuzione, es. `npm run build && PORT=3777 npm start`):
//   node scripts/pdf-esempi.mjs --email info@example.com --base http://localhost:3777 \
//     --measurement <sessionId>:<clientId> --report <clientId>:<from>:<to> --monitoring <id>
//
// L'accesso avviene con un magic link generato dalla Admin API di Supabase
// (SUPABASE_SERVICE_ROLE_KEY in .env.local): niente password nel comando.
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'])
  return acc
}, []))
const base = args.base ?? 'http://localhost:3000'
const email = args.email
if (!email) { console.error('--email obbligatorio'); process.exit(1) }

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const url = env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
if (error) { console.error(error); process.exit(1) }
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { data: v, error: e2 } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
if (e2) { console.error(e2); process.exit(1) }
const ref = new URL(url).hostname.split('.')[0]
const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`

mkdirSync('docs/pdf-esempi', { recursive: true })
const jobs = []
if (args.measurement) {
  const [sessionId, clientId] = args.measurement.split(':')
  jobs.push({ name: 'misurazione', path: `/api/pdf/misurazione/${sessionId}?clientId=${clientId}` })
}
if (args.report) {
  const [clientId, from, to] = args.report.split(':')
  jobs.push({ name: 'report-periodico', path: `/api/pdf/report-periodico?clientId=${clientId}&from=${from}&to=${to}` })
}
if (args.monitoring) jobs.push({ name: 'monitoraggio', path: `/api/pdf/monitoraggio/${args.monitoring}?variant=pro` })

for (const job of jobs) {
  for (const locale of ['it', 'en', 'de']) {
    const t0 = Date.now()
    const res = await fetch(`${base}${job.path}${job.path.includes('?') ? '&' : '?'}locale=${locale}`, { headers: { cookie } })
    const ms = Date.now() - t0
    if (!res.ok) {
      console.log(`✗ ${job.name} ${locale}: ${res.status} ${await res.text()}`)
      continue
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const file = `docs/pdf-esempi/${job.name}-${locale}.pdf`
    writeFileSync(file, buf)
    console.log(`✓ ${file} (${(buf.length / 1024).toFixed(0)} kB, ${ms} ms, render ${res.headers.get('x-pdf-render-ms') ?? '?'} ms)`)
  }
}
