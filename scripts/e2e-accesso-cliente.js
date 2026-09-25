// =============================================================================
// Prova end-to-end di "nuovo cliente" e "accesso all'app del cliente"
// =============================================================================
//
// Verifica i flussi che contano, comprese le due regole di sicurezza:
//   • impostare una password su un account GIÀ IN USO deve essere rifiutato
//     dall'API (409), non solo nascosto nella UI;
//   • agire sulla scheda di un altro professionista deve dare 403.
//
// ⚠️  SCRIVE SUL DATABASE CONFIGURATO IN .env.local, che è quello di produzione.
//     Crea quattro account usa-e-getta sul dominio @claude-e2e.test e alla fine
//     li cancella, verificando che non resti nulla. Nessun dato reale viene
//     toccato: ogni operazione è filtrata sugli id appena creati.
//
// USO
//   1. npm run build && PORT=3101 npm run start      (in un altro terminale)
//   2. node scripts/e2e-accesso-cliente.js --confirm
//
// Il rate limit e il registro delle azioni passano SOLO dopo aver applicato la
// migration 027: senza `professional_access_log` il test lo dice e lo salta.
const { createClient } = require('@supabase/supabase-js')
const { createServerClient } = require('@supabase/ssr')
const fs = require('fs')
const path = require('path')

if (!process.argv.includes('--confirm')) {
  console.error(
    'Questo script crea e cancella account sul database di .env.local (produzione).\n' +
    'Rilancialo con --confirm se è quello che vuoi.',
  )
  process.exit(2)
}

const ROOT = path.resolve(__dirname, '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const BASE = 'http://localhost:3101'

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
const TS = Date.now()
const dom = 'claude-e2e.test'
const PW = 'ProvaClaude!' + TS

const creati = { users: [], cards: [] }
let pass = 0, fail = 0
function ok(nome, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${nome}`) }
  else { fail++; console.log(`  ✗ ${nome} ${extra}`) }
}

async function nuovoUtente(prefix, role) {
  const email = `${prefix}-${TS}@${dom}`
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PW, email_confirm: true, user_metadata: { role },
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  creati.users.push(data.user.id)
  const { error: pe } = await admin.from('profiles').upsert({
    id: data.user.id, email, nome: prefix, cognome: 'E2E', role,
  })
  if (pe) throw new Error(`profiles ${email}: ${pe.message}`)
  return { id: data.user.id, email }
}

async function card(professionalId, clientUserId, email, nome) {
  const id = String(Date.now() + creati.cards.length)
  const { error } = await admin.from('clients').insert({
    id, professionista_id: professionalId, nome, cognome: 'E2E', email, client_user_id: clientUserId,
  })
  if (error) throw new Error(`clients ${id}: ${error.message}`)
  creati.cards.push(id)
  return id
}

async function link(professionalId, clientUserId) {
  const { error } = await admin.from('client_professional_links').insert({
    client_user_id: clientUserId, client_id: clientUserId, professional_id: professionalId, status: 'active',
  })
  if (error) throw new Error(`link: ${error.message}`)
}

/** Cookie di sessione nel formato esatto di @supabase/ssr. */
async function cookieHeader(email) {
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PW })
  if (error) throw new Error(`signIn ${email}: ${error.message}`)
  const raccolti = []
  const srv = createServerClient(URL, ANON, {
    cookies: { getAll: () => [], setAll: (cs) => raccolti.push(...cs) },
  })
  await srv.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
  if (raccolti.length === 0) throw new Error('nessun cookie prodotto')
  return raccolti.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ')
}

async function req(cookie, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try { json = await res.json() } catch {}
  return { status: res.status, json }
}

async function pulizia() {
  console.log('\nPulizia:')
  for (const id of creati.cards) await admin.from('clients').delete().eq('id', id)
  for (const uid of creati.users) {
    await admin.from('professional_access_log').delete().eq('professional_id', uid)
    await admin.from('client_professional_links').delete().eq('client_user_id', uid)
    await admin.from('client_professional_links').delete().eq('professional_id', uid)
    await admin.from('clients').delete().eq('professionista_id', uid)
    await admin.from('clients').delete().eq('client_user_id', uid)
    await admin.from('profiles').delete().eq('id', uid)
    const { error } = await admin.auth.admin.deleteUser(uid)
    if (error) console.log(`  ⚠ utente ${uid} NON eliminato: ${error.message}`)
  }
  // Verifica che non resti niente col nostro dominio di prova.
  const { data: resti } = await admin.from('profiles').select('id, email').ilike('email', `%@${dom}`)
  const { data: restiC } = await admin.from('clients').select('id, email').ilike('email', `%@${dom}`)
  const n = (resti ?? []).length + (restiC ?? []).length
  console.log(n === 0 ? '  ✓ nessun residuo' : `  ✗ residui: ${JSON.stringify({ profiles: resti, clients: restiC })}`)
  return n === 0
}

async function main() {
  console.log('Setup account usa-e-getta…')
  const profA = await nuovoUtente('profa', 'professional')
  const profB = await nuovoUtente('profb', 'professional')
  const cliNuovo = await nuovoUtente('clinuovo', 'client')     // mai entrato
  const cliAttivo = await nuovoUtente('cliattivo', 'client')   // farà login

  // cliAttivo entra una volta: last_sign_in_at valorizzato.
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error: siErr } = await anon.auth.signInWithPassword({ email: cliAttivo.email, password: PW })
  if (siErr) throw new Error(`login cliAttivo: ${siErr.message}`)

  const cardNuovo = await card(profA.id, cliNuovo.id, cliNuovo.email, 'ClienteNuovo')
  const cardAttivo = await card(profA.id, cliAttivo.id, cliAttivo.email, 'ClienteAttivo')
  const cardDiB = await card(profB.id, null, `altrui-${TS}@${dom}`, 'ClienteDiB')
  await link(profA.id, cliNuovo.id)
  await link(profA.id, cliAttivo.id)
  console.log('  setup completato')

  const ckA = await cookieHeader(profA.email)
  console.log('  sessione del professionista A ottenuta')

  console.log('\n— PARTE 2: creazione cliente —')
  const nuovaEmail = `creato-${TS}@${dom}`
  let r = await req(ckA, 'POST', '/api/clienti', {
    nome: 'Giulia', cognome: 'Verdi', email: nuovaEmail, peso: '62,5', altezza: '168',
    sesso: 'F', livello_attivita: 'moderato', fumatore: false, accessMode: 'nessuno',
  })
  ok('cliente nuovo creato (200)', r.status === 200 && r.json?.ok, JSON.stringify(r.json))
  if (r.json?.client_id) creati.cards.push(r.json.client_id)

  r = await req(ckA, 'POST', '/api/clienti', { nome: 'Giulia', cognome: 'Verdi', email: nuovaEmail, accessMode: 'nessuno' })
  ok('stessa email -> 409 duplicate_client', r.status === 409 && r.json?.error === 'duplicate_client', JSON.stringify(r.json))
  ok('il 409 indica la scheda esistente', !!r.json?.client_id, JSON.stringify(r.json))

  r = await req(ckA, 'POST', '/api/clienti', { nome: 'X', cognome: 'Y', email: 'non-una-email', accessMode: 'nessuno' })
  ok('email non valida -> 400 con errore sul campo', r.status === 400 && r.json?.errors?.email === 'Email non valida', JSON.stringify(r.json))

  r = await req(ckA, 'POST', '/api/clienti', { nome: '', cognome: 'Y', email: `a-${TS}@${dom}`, accessMode: 'nessuno' })
  ok('nome mancante -> 400', r.status === 400 && r.json?.errors?.nome === 'Il nome è obbligatorio', JSON.stringify(r.json))

  r = await req(ckA, 'POST', '/api/clienti', { nome: 'Z', cognome: 'W', email: `pw-${TS}@${dom}`, accessMode: 'password', password: 'corta1' })
  ok('password troppo corta -> 400', r.status === 400 && !!r.json?.errors?.password, JSON.stringify(r.json))

  // Email già di un utente registrato: collega, non duplica.
  const primaUtenti = (await admin.from('profiles').select('id').ilike('email', cliAttivo.email)).data?.length ?? 0
  r = await req(ckA, 'POST', '/api/clienti', { nome: 'Doppio', cognome: 'Account', email: cliAttivo.email, accessMode: 'invito' })
  const dopoUtenti = (await admin.from('profiles').select('id').ilike('email', cliAttivo.email)).data?.length ?? 0
  ok('email già registrata -> 409 (scheda già presente per questo professionista)',
     r.status === 409 && r.json?.error === 'duplicate_client', JSON.stringify(r.json))
  ok('nessun utente auth duplicato', primaUtenti === dopoUtenti, `${primaUtenti} -> ${dopoUtenti}`)

  // Stesso caso ma senza scheda preesistente: deve collegare l'account esistente.
  const { data: delCard } = await admin.from('clients').delete().eq('id', cardAttivo).select()
  r = await req(ckA, 'POST', '/api/clienti', { nome: 'Cliente', cognome: 'Attivo', email: cliAttivo.email, accessMode: 'invito' })
  ok('senza scheda: account esistente collegato, nessun invito',
     r.status === 200 && r.json?.emailAlreadyRegistered === true && r.json?.inviteSent === false, JSON.stringify(r.json))
  const cardAttivo2 = r.json?.client_id
  if (cardAttivo2) creati.cards.push(cardAttivo2)

  console.log('\n— PARTE 3: accesso cliente —')
  r = await req(ckA, 'GET', `/api/clienti/${cardNuovo}/accesso`)
  ok('stato: account mai usato', r.status === 200 && r.json?.state?.hasAccount === true && r.json?.state?.neverUsed === true, JSON.stringify(r.json))

  r = await req(ckA, 'POST', `/api/clienti/${cardNuovo}/accesso`, { action: 'set_temp_password', password: 'Abc' })
  ok('password troppo corta -> 400', r.status === 400, JSON.stringify(r.json))

  const tempPw = 'TempClaude' + TS
  r = await req(ckA, 'POST', `/api/clienti/${cardNuovo}/accesso`, { action: 'set_temp_password', password: tempPw })
  ok('password temporanea su account mai usato -> 200', r.status === 200 && r.json?.ok, JSON.stringify(r.json))
  const anon2 = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data: loginNuovo, error: lnErr } = await anon2.auth.signInWithPassword({ email: cliNuovo.email, password: tempPw })
  ok('il cliente entra davvero con la password temporanea', !!loginNuovo?.session && !lnErr, lnErr?.message ?? '')

  if (cardAttivo2) {
    r = await req(ckA, 'GET', `/api/clienti/${cardAttivo2}/accesso`)
    ok('stato: account attivo con ultimo accesso',
       r.status === 200 && r.json?.state?.neverUsed === false && !!r.json?.state?.lastSignInAt, JSON.stringify(r.json))

    r = await req(ckA, 'POST', `/api/clienti/${cardAttivo2}/accesso`, { action: 'set_temp_password', password: 'QualsiasiCosa123' })
    ok('>>> password su account ATTIVO rifiutata dall\'API (409 account_in_use)',
       r.status === 409 && r.json?.error === 'account_in_use', JSON.stringify(r.json))
    const { data: ancoraDentro } = await createClient(URL, ANON, { auth: { persistSession: false } })
      .auth.signInWithPassword({ email: cliAttivo.email, password: PW })
    ok('la password del cliente attivo NON è stata cambiata', !!ancoraDentro?.session)

    r = await req(ckA, 'POST', `/api/clienti/${cardAttivo2}/accesso`, { action: 'copy_reset_link' })
    ok('link di reset generato', r.status === 200 && typeof r.json?.link === 'string' && r.json.link.includes('token'), JSON.stringify(r.json).slice(0, 200))
    ok('messaggio pronto da incollare presente', typeof r.json?.message === 'string' && r.json.message.includes(r.json.link))
  }

  console.log('\n— Autorizzazione —')
  r = await req(ckA, 'GET', `/api/clienti/${cardDiB}/accesso`)
  ok('>>> scheda di un ALTRO professionista -> 403', r.status === 403, JSON.stringify(r.json))
  r = await req(ckA, 'POST', `/api/clienti/${cardDiB}/accesso`, { action: 'send_reset_email' })
  ok('>>> azione su scheda non propria -> 403', r.status === 403, JSON.stringify(r.json))
  r = await req(ckA, 'POST', `/api/clienti/999999999999/accesso`, { action: 'send_reset_email' })
  ok('scheda inesistente -> 403 (non rivela l\'esistenza)', r.status === 403, JSON.stringify(r.json))

  // Cliente (role='client') che prova a usare le route dei professionisti.
  const ckCli = await cookieHeader(cliAttivo.email)
  r = await req(ckCli, 'POST', '/api/clienti', { nome: 'A', cognome: 'B', email: `hack-${TS}@${dom}`, accessMode: 'nessuno' })
  ok('>>> un cliente non può creare clienti -> 403', r.status === 403, JSON.stringify(r.json))

  console.log('\n— Rate limit —')
  const { error: logErr } = await admin.from('professional_access_log').select('id').limit(1)
  // PostgREST dice PGRST205 per una tabella che non è nella cache dello schema;
  // 42P01 è il codice di Postgres. Serve accettarli entrambi.
  if (logErr && (logErr.code === '42P01' || logErr.code === 'PGRST205')) {
    console.log('  ⊘ professional_access_log non esiste: migration 027 NON applicata,')
    console.log('    rate limit e registro delle azioni non verificabili. Applicala e rilancia.')
  } else {
    let ultimo = null
    for (let i = 0; i < 7; i++) {
      ultimo = await req(ckA, 'POST', `/api/clienti/${cardNuovo}/accesso`, { action: 'copy_reset_link' })
      if (ultimo.status === 429) break
    }
    ok('oltre il limite -> 429 rate_limited', ultimo?.status === 429 && ultimo.json?.error === 'rate_limited', JSON.stringify(ultimo?.json))
  }
}

main()
  .catch((e) => { fail++; console.log('\n!! errore nel test:', e.message) })
  .finally(async () => {
    const pulito = await pulizia()
    console.log(`\nRisultato: ${pass} passati, ${fail} falliti${pulito ? '' : ' — ATTENZIONE: residui da rimuovere a mano'}`)
    process.exit(fail === 0 && pulito ? 0 : 1)
  })
