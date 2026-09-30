#!/usr/bin/env node
// Test automatico dei permessi dei PDF (pagine di stampa + route /api/pdf/*).
//
// Crea due professionisti di prova (A e B) con un cliente e una misurazione
// ciascuno, poi verifica che:
//   - A scarichi i PDF dei propri clienti (misurazione e report periodico);
//   - A riceva un errore sui clienti di B, e viceversa;
//   - la pagina di stampa accetti un token valido una sola volta e rifiuti
//     token scaduti, riusati, contraffatti o di un altro utente;
//   - la sola lettura di un cliente altrui funzioni solo per il superadmin.
// Alla fine cancella tutto quello che ha creato (salvo --keep).
//
// Uso (sito in esecuzione, es. `PORT=3778 npm run dev`):
//   node scripts/test-pdf-permessi.mjs --base http://localhost:3778 [--superadmin email] [--secret PDF_TOKEN_SECRET] [--keep]
//
// Il segreto dei token: --secret, oppure PDF_TOKEN_SECRET da .env.local, oppure
// il fallback di sviluppo (derivato dalla service role, come in print-token.ts).
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'])
  return acc
}, []))
const base = args.base ?? 'http://localhost:3000'
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const url = env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const ref = new URL(url).hostname.split('.')[0]
const secret = args.secret ?? env.PDF_TOKEN_SECRET ?? createHmac('sha256', 'stressindex-print-dev').update(env.SUPABASE_SERVICE_ROLE_KEY).digest('hex')

let pass = 0
let fail = 0
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`✓ ${name}`) } else { fail++; console.log(`✗ ${name}${detail ? ` (${detail})` : ''}`) }
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
const stamp = Date.now()
const created = { users: [], clients: [], sessions: [] }

async function ensureUser(tag) {
  const email = `pdf-test-${tag}-${stamp}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Pdf-${stamp}-${tag}!`,
    email_confirm: true,
    user_metadata: { nome: 'Test', cognome: `Pro ${tag.toUpperCase()}`, professione: 'fisioterapista' },
  })
  if (error) throw new Error(`createUser ${tag}: ${error.message}`)
  const id = data.user.id
  created.users.push(id)
  await admin.from('profiles').upsert({ id, email, nome: 'Test', cognome: `Pro ${tag.toUpperCase()}`, role: 'professional' })
  await admin.from('professional_profiles').upsert({ id, nome: 'Test', cognome: `Pro ${tag.toUpperCase()}`, professione: 'fisioterapista', trial_expires_at: new Date(Date.now() + 30 * 86400000).toISOString() })
  return { id, email }
}

async function seedClient(pro, tag) {
  const clientId = `pdftest-${tag}-${stamp}`
  const { error: cErr } = await admin.from('clients').insert({ id: clientId, professionista_id: pro.id, nome: 'Cliente', cognome: `Test ${tag.toUpperCase()}`, data_nascita: '1985-03-04', sesso: 'F' })
  if (cErr) throw new Error(`clients insert ${tag}: ${cErr.message}`)
  created.clients.push(clientId)
  const sessionId = `${stamp}${tag === 'a' ? 1 : 2}`
  const startedAt = new Date().toISOString()
  const hrv = { meanBpm: 66, rmssd: 42, sdnn: 55, pnn50: 20, sd1: 30, sd2: 70, lfPower: 700, hfPower: 600, vlfPower: 400, totalPower: 1700, lfHfRatio: 1.17, dfaAlpha1: 0.95, sampleCount: 330 }
  const { error: sErr } = await admin.from('sessions').insert({ id: sessionId, professionista_id: pro.id, client_id: clientId, client_nome: `Cliente Test ${tag.toUpperCase()}`, started_at: startedAt, duration_seconds: 300, sample_count: 330, hrv_data: hrv, test_type: 'standard', tz_offset_minutes: 120 })
  if (sErr) throw new Error(`sessions insert ${tag}: ${sErr.message}`)
  created.sessions.push(sessionId)
  // Un trigger del database crea già la riga di measurement_analytics dalla
  // sessione: qui si completano score e parametri (upsert su session_id).
  const { error: mErr } = await admin.from('measurement_analytics').upsert({
    session_id: sessionId, user_id: pro.id, client_id: clientId, measured_at: startedAt, duration_seconds: 300, test_type: 'standard', tz_offset_minutes: 120,
    mean_hr: 66, rmssd: 42, sdnn: 55, pnn50: 20, sd1: 30, sd2: 70, lf_power: 700, hf_power: 600, vlf_power: 400, total_power: 1700, lf_hf_ratio: 1.17, dfa_alpha1: 0.95,
    score_stress: 40, score_recupero: 66, score_equilibrio: 62, score_energia: 58, score_modulazione_infiammatoria: 64, score_composito: 63.5,
    rr_intervals: Array.from({ length: 330 }, (_, i) => Math.round(900 + Math.sin(i / 3) * 40)),
  }, { onConflict: 'session_id' })
  if (mErr) throw new Error(`measurement_analytics insert ${tag}: ${mErr.message}`)
  return { clientId, sessionId }
}

async function sessionCookie(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(`generateLink ${email}: ${error.message}`)
  const { data: v, error: e2 } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (e2) throw new Error(`verifyOtp ${email}: ${e2.message}`)
  return `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`
}

function makeToken(claims, sig) {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const good = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig ?? good}`
}

async function get(path, cookie) {
  const res = await fetch(`${base}${path}`, { headers: cookie ? { cookie } : {}, redirect: 'manual' })
  return { status: res.status, type: res.headers.get('content-type') ?? '', body: res.headers.get('content-type')?.includes('json') ? await res.json().catch(() => null) : null }
}

async function cleanup() {
  if (args.keep === 'true') { console.log('(--keep: dati di prova lasciati nel database)'); return }
  if (created.sessions.length) {
    await admin.from('measurement_analytics').delete().in('session_id', created.sessions)
    await admin.from('sessions').delete().in('id', created.sessions)
  }
  if (created.clients.length) await admin.from('clients').delete().in('id', created.clients)
  for (const id of created.users) {
    await admin.from('professional_profiles').delete().eq('id', id)
    await admin.from('profiles').delete().eq('id', id)
    await admin.auth.admin.deleteUser(id)
  }
  console.log('Pulizia completata: utenti, clienti e misurazioni di prova rimossi.')
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------
try {
  const A = await ensureUser('a')
  const B = await ensureUser('b')
  const dataA = await seedClient(A, 'a')
  const dataB = await seedClient(B, 'b')
  const cookieA = await sessionCookie(A.email)
  const cookieB = await sessionCookie(B.email)
  const today = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  console.log(`Account di prova creati: ${A.email}, ${B.email}\n`)

  // 1. Ogni professionista scarica i PDF dei propri clienti
  let r = await get(`/api/pdf/misurazione/${dataA.sessionId}?clientId=${dataA.clientId}&locale=it`, cookieA)
  check('A scarica il PDF misurazione del proprio cliente', r.status === 200 && r.type.includes('pdf'), `status ${r.status}`)
  r = await get(`/api/pdf/misurazione/${dataA.sessionId}?clientId=${dataA.clientId}&locale=en&variant=client`, cookieA)
  check('A scarica la versione cliente del PDF misurazione', r.status === 200 && r.type.includes('pdf'), `status ${r.status}`)
  r = await get(`/api/pdf/report-periodico?clientId=${dataA.clientId}&from=${from}&to=${today}&locale=it`, cookieA)
  check('A scarica il report periodico del proprio cliente', r.status === 200 && r.type.includes('pdf'), `status ${r.status}`)
  r = await get(`/api/pdf/misurazione/${dataB.sessionId}?clientId=${dataB.clientId}&locale=it`, cookieB)
  check('B scarica il PDF misurazione del proprio cliente', r.status === 200 && r.type.includes('pdf'), `status ${r.status}`)

  // 2. Nessun accesso ai clienti dell'altro professionista
  r = await get(`/api/pdf/misurazione/${dataB.sessionId}?clientId=${dataB.clientId}&locale=it`, cookieA)
  check('A riceve errore sul PDF misurazione di un cliente di B', r.status >= 400 && r.status < 500, `status ${r.status}`)
  r = await get(`/api/pdf/report-periodico?clientId=${dataB.clientId}&from=${from}&to=${today}`, cookieA)
  check('A riceve errore sul report periodico di un cliente di B', r.status >= 400 && r.status < 500, `status ${r.status}`)
  r = await get(`/api/pdf/misurazione/${dataA.sessionId}?clientId=${dataA.clientId}&locale=it`, cookieB)
  check('B riceve errore sul PDF misurazione di un cliente di A', r.status >= 400 && r.status < 500, `status ${r.status}`)
  r = await get(`/api/pdf/misurazione/${dataA.sessionId}?clientId=${dataA.clientId}`)
  check('Senza sessione la route risponde 401', r.status === 401, `status ${r.status}`)
  r = await get(`/stampa/misurazione/${dataA.sessionId}?clientId=${dataA.clientId}`)
  check('Senza sessione né token la pagina di stampa risponde 404', r.status === 404, `status ${r.status}`)
  r = await get(`/stampa/misurazione/${dataB.sessionId}?clientId=${dataB.clientId}`, cookieA)
  check('A con sessione non vede la pagina di stampa di un cliente di B', r.status === 404, `status ${r.status}`)

  // 3. Token firmati: validi una volta sola, scaduti e contraffatti rifiutati
  const now = Math.floor(Date.now() / 1000)
  const valid = makeToken({ kind: 'measurement', id: dataA.sessionId, userId: A.id, exp: now + 60 })
  r = await get(`/stampa/misurazione/${dataA.sessionId}?clientId=${dataA.clientId}&token=${valid}`)
  check('Token valido senza sessione apre la pagina di stampa', r.status === 200, `status ${r.status}`)
  r = await get(`/stampa/misurazione/${dataA.sessionId}?clientId=${dataA.clientId}&token=${valid}`)
  check('Lo stesso token riusato viene rifiutato', r.status === 404, `status ${r.status}`)
  const expired = makeToken({ kind: 'measurement', id: dataA.sessionId, userId: A.id, exp: now - 5 })
  r = await get(`/stampa/misurazione/${dataA.sessionId}?clientId=${dataA.clientId}&token=${expired}`)
  check('Token scaduto rifiutato', r.status === 404, `status ${r.status}`)
  const forged = makeToken({ kind: 'measurement', id: dataA.sessionId, userId: A.id, exp: now + 60 }, 'firma-falsa')
  r = await get(`/stampa/misurazione/${dataA.sessionId}?clientId=${dataA.clientId}&token=${forged}`)
  check('Token con firma non valida rifiutato', r.status === 404, `status ${r.status}`)
  const otherRes = makeToken({ kind: 'measurement', id: dataB.sessionId, userId: A.id, exp: now + 60 })
  r = await get(`/stampa/misurazione/${dataB.sessionId}?clientId=${dataB.clientId}&token=${otherRes}`)
  check('Token di A su una misurazione di B rifiutato (non proprietario)', r.status === 404, `status ${r.status}`)
  const tokenA2 = makeToken({ kind: 'measurement', id: dataA.sessionId, userId: A.id, exp: now + 60 })
  r = await get(`/stampa/misurazione/${dataA.sessionId}?clientId=${dataA.clientId}&token=${tokenA2}`, cookieB)
  check('Token di A usato con la sessione di B rifiutato', r.status === 404, `status ${r.status}`)

  // 4. Sola lettura ?professionista=: solo il superadmin
  r = await get(`/api/pdf/misurazione/${dataB.sessionId}?clientId=${dataB.clientId}&professionista=${B.id}&locale=it`, cookieA)
  check('A con ?professionista=B non ottiene il PDF di B', r.status >= 400 && r.status < 500, `status ${r.status}`)
  if (args.superadmin) {
    const cookieS = await sessionCookie(args.superadmin)
    r = await get(`/api/pdf/misurazione/${dataB.sessionId}?clientId=${dataB.clientId}&professionista=${B.id}&locale=it`, cookieS)
    check('Il superadmin in sola lettura scarica il PDF di un cliente di B', r.status === 200 && r.type.includes('pdf'), `status ${r.status}`)
    r = await get(`/api/pdf/report-periodico?clientId=${dataA.clientId}&from=${from}&to=${today}&professionista=${A.id}`, cookieS)
    check('Il superadmin in sola lettura scarica il report di un cliente di A', r.status === 200 && r.type.includes('pdf'), `status ${r.status}`)
  } else {
    console.log('(superadmin non indicato: passa --superadmin <email> per il test di sola lettura)')
  }
} catch (err) {
  fail++
  console.error('✗ errore durante i test:', err.message)
} finally {
  await cleanup()
}

console.log(`\n${pass} test superati, ${fail} falliti.`)
process.exit(fail ? 1 : 0)
