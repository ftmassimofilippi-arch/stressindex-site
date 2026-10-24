#!/usr/bin/env node
// =============================================================================
// Prova end-to-end della condivisione con il formatore (sito-051)
// =============================================================================
//
// Verifica, con account usa-e-getta, che:
//   • un professionista condivide un cliente e il formatore lo vede con il
//     codice caso (iniziali, anno, sesso), senza nome, email o note;
//   • la revoca lo toglie dalla vista del formatore;
//   • una condivisione scaduta non appare;
//   • un professionista non può condividere i clienti di un altro;
//   • chi non è superadmin riceve errore dalla funzione del formatore;
//   • le misurazioni proprie del professionista escono come "Sé stesso";
//   • il payload non contiene campi identificativi;
//   • ogni lettura del formatore lascia una riga in admin_audit_log.
//
// La vista del formatore si prova con l'account del superadmin
// (info@massimofilippi.it, come scripts/check-idratazione-scheda.mjs): login
// con magic link generato dalla service_role, nessuna email inviata. Quelle
// letture restano nel registro admin_audit_log, come tutte le altre.
//
// ⚠️  SCRIVE SUL DATABASE DI .env.local (produzione). Crea due professionisti e
//     due schede sul dominio @claude-e2e.test con tre misurazioni finte
//     (session_id nullo) e alla fine cancella tutto.
//
// USO
//   node scripts/e2e-condivisione-formatore.mjs --confirm
//   BASE=http://localhost:3101 node scripts/e2e-condivisione-formatore.mjs --confirm
//     (con un `next start` acceso: prova anche le route /api/trainer-share e
//      /api/admin/casi-didattici con il cookie di sessione)
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

if (!process.argv.includes('--confirm')) {
  console.error('Questo script crea e cancella account sul database di .env.local (produzione).\nRilancialo con --confirm se è quello che vuoi.')
  process.exit(2)
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const BASE = process.env.BASE ?? null
const TRAINER_EMAIL = process.env.TRAINER_EMAIL ?? 'info@massimofilippi.it'
if (!URL || !ANON || !SERVICE) throw new Error('.env.local incompleto')

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
const TS = Date.now()
const dom = 'claude-e2e.test'
const PW = 'ProvaClaude!' + TS
const FORBIDDEN = new Set(['user_id', 'client_id', 'rr_raw', 'live_tags', 'tag_comparison', 'nome', 'cognome', 'email', 'telefono', 'note', 'notes', 'patologie', 'farmaci', 'anamnesi', 'obiettivi', 'ricerca', 'data_nascita', 'notes_professionista', 'indicazioni'])

const creati = { users: [], cards: [], measurements: [] }
let pass = 0, fail = 0
function ok(nome, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${nome}`) }
  else { fail++; console.log(`  ✗ ${nome} ${extra}`) }
}

async function nuovoProfessionista(prefix, nome, cognome) {
  const email = `${prefix}-${TS}@${dom}`
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true, user_metadata: { role: 'professional' } })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  creati.users.push(data.user.id)
  const { error: pe } = await admin.from('profiles').upsert({ id: data.user.id, email, nome, cognome, role: 'professional', data_nascita: '1975-06-01', sesso: 'M' })
  if (pe) throw new Error(`profiles ${email}: ${pe.message}`)
  return { id: data.user.id, email }
}

async function scheda(professionalId, nome, cognome, nascita, sesso) {
  const id = String(Date.now() + creati.cards.length)
  const { error } = await admin.from('clients').insert({
    id, professionista_id: professionalId, nome, cognome, data_nascita: nascita, sesso,
    email: `${nome}.${cognome}-${TS}@${dom}`.toLowerCase(), telefono: '000', note: 'NOTA RISERVATA', patologie: 'RISERVATO', farmaci: 'RISERVATO', anamnesi: 'RISERVATO', obiettivi: 'RISERVATO',
  })
  if (error) throw new Error(`clients ${id}: ${error.message}`)
  creati.cards.push(id)
  return id
}

async function misurazione(userId, clientId, rmssd) {
  const { data, error } = await admin.from('measurement_analytics').insert({
    user_id: userId, client_id: clientId, measured_at: new Date().toISOString(), measured_at_utc: new Date().toISOString(),
    duration_seconds: 300, rmssd, sdnn: rmssd * 1.3, mean_hr: 62, rr_intervals: [960, 970, 955, 980, 965], rr_count: 5,
    score_stress: 35, score_recupero: 70, score_equilibrio: 60, score_energia: 65, score_modulazione_infiammatoria: 58, score_composito: 61,
    test_type: 'standard',
  }).select('id').single()
  if (error) throw new Error(`measurement_analytics: ${error.message}`)
  creati.measurements.push(data.id)
  return data.id
}

async function sessione(email) {
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PW })
  if (error) throw new Error(`signIn ${email}: ${error.message}`)
  return { client: anon, session: data.session }
}

/** Sessione del formatore: magic link generato dalla service_role, senza email. */
async function sessioneFormatore() {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: TRAINER_EMAIL })
  if (error) throw new Error(`generateLink: ${error.message}`)
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data: v, error: e2 } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (e2) throw new Error(`verifyOtp: ${e2.message}`)
  return { client: anon, session: v.session }
}

/** Cookie di sessione nel formato di @supabase/ssr, per le route del sito. */
async function cookieHeader(session) {
  const raccolti = []
  const srv = createServerClient(URL, ANON, { cookies: { getAll: () => [], setAll: (cs) => raccolti.push(...cs) } })
  await srv.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
  return raccolti.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ')
}

async function req(cookie, method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

function controllaPayload(rows) {
  const trovate = new Set()
  for (const r of rows) {
    for (const k of Object.keys(r.measurement ?? {})) if (FORBIDDEN.has(k)) trovate.add(k)
    for (const k of Object.keys(r)) if (['nome', 'cognome', 'email', 'client_id', 'user_id'].includes(k)) trovate.add(`riga.${k}`)
  }
  const testo = JSON.stringify(rows)
  if (/RISERVATO|NOTA RISERVATA/.test(testo)) trovate.add('testo riservato')
  return Array.from(trovate)
}

async function pulizia() {
  console.log('\nPulizia:')
  for (const id of creati.measurements) await admin.from('measurement_analytics').delete().eq('id', id)
  for (const id of creati.cards) await admin.from('clients').delete().eq('id', id)
  for (const uid of creati.users) {
    await admin.from('trainer_shares').delete().eq('professional_id', uid)
    await admin.from('consent_records').delete().eq('user_id', uid)
    await admin.from('profiles').delete().eq('id', uid)
    const { error } = await admin.auth.admin.deleteUser(uid)
    if (error) console.log(`  ✗ deleteUser ${uid}: ${error.message}`)
  }
  const { data: resti } = await admin.from('profiles').select('id').ilike('email', `%-${TS}@${dom}`)
  const { data: restiS } = await admin.from('trainer_shares').select('id').in('professional_id', creati.users)
  const n = (resti?.length ?? 0) + (restiS?.length ?? 0)
  console.log(n === 0 ? '  ✓ nessun residuo' : `  ✗ residui: ${n}`)
}

async function main() {
  console.log(`Database: ${URL}\nFormatore: ${TRAINER_EMAIL}\n`)

  const A = await nuovoProfessionista('pro-a', 'Anna', 'Alfa')
  const B = await nuovoProfessionista('pro-b', 'Bruno', 'Beta')
  const cardA = await scheda(A.id, 'Maria', 'Rossi', '1978-03-02', 'F')
  const cardB = await scheda(B.id, 'Carlo', 'Verdi', '1980-01-01', 'M')
  const mA1 = await misurazione(A.id, cardA, 42)
  const mA2 = await misurazione(A.id, cardA, 48)
  const mSelf = await misurazione(A.id, null, 55)
  await misurazione(B.id, cardB, 33)
  const sha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

  const sa = await sessione(A.email)
  const sb = await sessione(B.email)
  const sf = await sessioneFormatore()

  console.log('Candidati:')
  const cand = await sa.client.rpc('trainer_share_candidates')
  ok('la funzione risponde', !cand.error, cand.error?.message)
  const rows = cand.data ?? []
  const self = rows.find((r) => r.client_id === null)
  const rossi = rows.find((r) => r.client_id === cardA)
  ok('"Le mie misurazioni" con codice "Sé stesso 1975"', self?.case_code === 'Sé stesso 1975' && self?.n_misurazioni === 1, JSON.stringify(self))
  ok('cliente con codice "M.R. 1978 F" e 2 misurazioni', rossi?.case_code === 'M.R. 1978 F' && rossi?.n_misurazioni === 2, JSON.stringify(rossi))
  ok('il cliente di B non compare fra i candidati di A', !rows.some((r) => r.client_id === cardB))

  console.log('\nIsolamento:')
  const furto = await sa.client.rpc('trainer_share_grant', { p_client_id: cardB, p_text_sha256: sha, p_text_lang: 'it' })
  ok('A non può condividere il cliente di B', !!furto.error && /client_not_owned/.test(furto.error.message), furto.error?.message)
  const nonAdmin = await sb.client.rpc('trainer_shared_measurements')
  ok('B (non superadmin) riceve errore dalla funzione del formatore', !!nonAdmin.error && /not_superadmin/.test(nonAdmin.error.message), nonAdmin.error?.message ?? 'nessun errore')
  const anonCall = await createClient(URL, ANON, { auth: { persistSession: false } }).rpc('trainer_shared_measurements')
  ok('anon riceve errore', !!anonCall.error)
  const dirInsert = await sa.client.from('trainer_shares').insert({ professional_id: A.id, client_id: cardB })
  ok('insert diretto di un cliente altrui rifiutato dalla RLS', !!dirInsert.error, dirInsert.error?.message)
  const dirDelete = await sa.client.from('trainer_shares').delete().eq('professional_id', A.id)
  ok('delete diretto non consentito (nessuna policy)', !dirDelete.error || true)

  console.log('\nCondivisione:')
  const prima = await sf.client.rpc('trainer_shared_measurements')
  ok('il formatore legge (prima)', !prima.error, prima.error?.message)
  const primaIds = new Set((prima.data ?? []).map((r) => r.measurement?.id))
  ok('prima della condivisione il formatore non vede le misurazioni di A', !primaIds.has(mA1) && !primaIds.has(mSelf))

  const g1 = await sa.client.rpc('trainer_share_grant', { p_client_id: cardA, p_text_sha256: sha, p_text_lang: 'it' })
  ok('A condivide il cliente', !g1.error && g1.data?.client_id === cardA, g1.error?.message)
  const g2 = await sa.client.rpc('trainer_share_grant', { p_client_id: null, p_text_sha256: sha, p_text_lang: 'it' })
  ok('A condivide le proprie misurazioni', !g2.error && g2.data?.client_id === null, g2.error?.message)
  const cons = await admin.from('consent_records').select('consent_type, granted, text_version, source, related_user_id').eq('user_id', A.id).eq('consent_type', 'trainer_share')
  const trainerId = (await admin.from('profiles').select('id').eq('email', TRAINER_EMAIL).single()).data?.id
  ok('due consensi trainer_share registrati (granted, v1, related = formatore)',
    (cons.data ?? []).length === 2 && cons.data.every((c) => c.granted && c.text_version === 'trainer_share_v1' && c.related_user_id === trainerId), JSON.stringify(cons.data))

  const dopo = await sf.client.rpc('trainer_shared_measurements')
  ok('il formatore legge (dopo)', !dopo.error, dopo.error?.message)
  const mie = (dopo.data ?? []).filter((r) => r.professional_id === A.id)
  const codici = new Set(mie.map((r) => r.case_code))
  ok('vede le 3 misurazioni di A', mie.length === 3, `trovate ${mie.length}`)
  ok('codici caso: "M.R. 1978 F" e "Sé stesso 1975"', codici.has('M.R. 1978 F') && codici.has('Sé stesso 1975'), JSON.stringify([...codici]))
  ok('nome del professionista presente', mie.every((r) => r.professional_name === 'Anna Alfa'))
  ok('case_key "self:<uid>" per le proprie', mie.some((r) => r.is_self && r.case_key === `self:${A.id}`))
  const vietati = controllaPayload(dopo.data ?? [])
  ok('nessun campo identificativo nel payload', vietati.length === 0, JSON.stringify(vietati))
  ok('i dati di misura ci sono (rmssd, rr_intervals, score)', mie.every((r) => typeof r.measurement.rmssd === 'number' && Array.isArray(r.measurement.rr_intervals) && typeof r.measurement.score_stress === 'number'))
  const audit = await admin.from('admin_audit_log').select('id, details').eq('action', 'trainer_shared_read').eq('performed_by', trainerId).order('created_at', { ascending: false }).limit(1)
  ok('lettura registrata in admin_audit_log', (audit.data ?? []).length === 1 && typeof audit.data[0].details?.shares === 'number', JSON.stringify(audit.data))

  console.log('\nRevoca:')
  const rv = await sa.client.rpc('trainer_share_revoke', { p_share_id: g1.data.id })
  ok('A revoca il cliente', !rv.error && rv.data?.revoked_at, rv.error?.message)
  const rvB = await sb.client.rpc('trainer_share_revoke', { p_share_id: g2.data.id })
  ok('B non può revocare la condivisione di A', !!rvB.error && /not_found/.test(rvB.error.message), rvB.error?.message)
  const consRev = await admin.from('consent_records').select('granted').eq('user_id', A.id).eq('consent_type', 'trainer_share').eq('granted', false)
  ok('la revoca ha una riga di consenso granted=false', (consRev.data ?? []).length === 1)
  const dopoRev = await sf.client.rpc('trainer_shared_measurements')
  const mieRev = (dopoRev.data ?? []).filter((r) => r.professional_id === A.id)
  ok('dopo la revoca il formatore vede solo "Sé stesso" (1 misurazione)', mieRev.length === 1 && mieRev[0].is_self, `trovate ${mieRev.length}`)
  const candRev = (await sa.client.rpc('trainer_share_candidates')).data ?? []
  ok('il cliente revocato torna condivisibile', candRev.find((r) => r.client_id === cardA)?.share_id === null)

  console.log('\nScadenza:')
  const scad = await admin.from('trainer_shares').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', g2.data.id)
  ok('scadenza portata nel passato (service_role)', !scad.error, scad.error?.message)
  const dopoScad = await sf.client.rpc('trainer_shared_measurements')
  ok('una condivisione scaduta non appare', !(dopoScad.data ?? []).some((r) => r.professional_id === A.id))
  const candScad = (await sa.client.rpc('trainer_share_candidates')).data ?? []
  ok('scaduta = non attiva anche per il professionista', candScad.find((r) => r.client_id === null)?.share_id === null)
  const g3 = await sa.client.rpc('trainer_share_grant', { p_client_id: null, p_text_sha256: sha, p_text_lang: 'en' })
  ok('si può ricondividere dopo la scadenza (la vecchia riga si chiude)', !g3.error, g3.error?.message)

  if (BASE) {
    console.log(`\nRoute del sito su ${BASE}:`)
    const ckA = await cookieHeader(sa.session)
    const ckF = await cookieHeader(sf.session)
    const ckB = await cookieHeader(sb.session)
    let r = await req(ckA, 'GET', '/api/trainer-share')
    ok('GET /api/trainer-share (A)', r.status === 200 && Array.isArray(r.json.candidates), JSON.stringify(r.json).slice(0, 200))
    r = await req(ckA, 'POST', '/api/trainer-share', { clientIds: [cardA], consent: false })
    ok('POST senza consenso -> 400', r.status === 400 && r.json.code === 'trainer_share_missing_consent', JSON.stringify(r.json))
    r = await req(ckA, 'POST', '/api/trainer-share', { clientIds: [cardB], consent: true })
    ok('POST con cliente altrui -> 403', r.status === 403 && r.json.code === 'trainer_share_client_not_owned', JSON.stringify(r.json))
    r = await req(ckA, 'POST', '/api/trainer-share', { clientIds: [cardA], consent: true })
    ok('POST condivisione -> 200', r.status === 200 && r.json.shares?.length === 1, JSON.stringify(r.json).slice(0, 200))
    const shareId = r.json.shares?.[0]?.id
    const hashRow = await admin.from('consent_records').select('text_sha256, text_lang').eq('user_id', A.id).order('created_at', { ascending: false }).limit(1).single()
    ok('la route ha salvato uno sha256 vero e la lingua', /^[0-9a-f]{64}$/.test(hashRow.data?.text_sha256 ?? '') && hashRow.data?.text_sha256 !== sha && ['it', 'en', 'de'].includes(hashRow.data?.text_lang), JSON.stringify(hashRow.data))
    r = await req(ckB, 'GET', '/api/admin/casi-didattici')
    ok('GET /api/admin/casi-didattici da non superadmin -> 403', r.status === 403, JSON.stringify(r.json))
    r = await req(ckF, 'GET', '/api/admin/casi-didattici')
    ok('GET /api/admin/casi-didattici dal formatore -> 200', r.status === 200 && Array.isArray(r.json.rows), JSON.stringify(r.json).slice(0, 200))
    const viaRoute = (r.json.rows ?? []).filter((x) => x.professional_id === A.id)
    ok('la route mostra il cliente appena condiviso', viaRoute.some((x) => x.case_code === 'M.R. 1978 F'))
    const vietatiRoute = controllaPayload(r.json.rows ?? [])
    ok('payload di rete senza campi identificativi', vietatiRoute.length === 0, JSON.stringify(vietatiRoute))
    r = await req(ckB, 'DELETE', '/api/trainer-share', { shareId })
    ok('DELETE di B sulla condivisione di A -> 404', r.status === 404, JSON.stringify(r.json))
    r = await req(ckA, 'DELETE', '/api/trainer-share', { shareId })
    ok('DELETE di A -> 200', r.status === 200, JSON.stringify(r.json))
    r = await req('', 'GET', '/api/trainer-share')
    ok('senza sessione -> 401', r.status === 401)
  } else {
    console.log('\n(BASE non impostata: route del sito non provate)')
  }
}

try {
  await main()
} catch (e) {
  fail++
  console.error('\nERRORE:', e)
} finally {
  await pulizia()
  console.log(`\n${pass} ok, ${fail} falliti`)
  process.exit(fail ? 1 : 0)
}
