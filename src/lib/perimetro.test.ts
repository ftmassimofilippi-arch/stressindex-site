// Test del perimetro del professionista (src/lib/perimetro.ts): quali righe di
// `measurement_analytics` entrano nelle sue pagine, qualunque cosa conceda la RLS.
// Si esegue con `npm test` (node --test, senza dipendenze aggiuntive).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aBlocchi,
  misurataDalCliente,
  nelPerimetro,
  perimetroDaLink,
  utentiDelPerimetro,
  type LinkPerimetro,
} from './perimetro.ts'

const PRO = 'pro-loggato'
const CLIENTE = 'cliente-collegato'
const ALTRO_PRO = 'altro-professionista'

const link = (over: Partial<LinkPerimetro>): LinkPerimetro => ({
  professional_id: PRO,
  status: 'active',
  client_user_id: CLIENTE,
  client_id: null,
  ...over,
})

test('entrano solo i link active del professionista', () => {
  const p = perimetroDaLink(PRO, [
    link({}),
    link({ client_user_id: 'in-attesa', status: 'pending' }),
    link({ client_user_id: 'revocato', status: 'revoked' }),
    link({ client_user_id: 'di-un-altro', professional_id: ALTRO_PRO }),
  ])
  assert.deepEqual(p.clientiCollegati, [CLIENTE])
  assert.deepEqual(utentiDelPerimetro(p), [PRO, CLIENTE])
})

test('link legacy: l\'uid del cliente si legge da client_id se client_user_id manca', () => {
  const p = perimetroDaLink(PRO, [link({ client_user_id: null, client_id: 'cliente-legacy' })])
  assert.deepEqual(p.clientiCollegati, ['cliente-legacy'])
})

test('lo stesso cliente su due link conta una volta, e il professionista non è cliente di sé', () => {
  const p = perimetroDaLink(PRO, [link({}), link({}), link({ client_user_id: PRO })])
  assert.deepEqual(p.clientiCollegati, [CLIENTE])
})

// Il caso del 7 ottobre 2026 (docs/DIAGNOSI_ASSEGNAZIONE.md in hrv_app): con
// l'account superadmin la RLS restituiva 43 righe di oggi. Sue 4, 1 del cliente
// collegato, 38 di altri: 23 automisurazioni di clienti di altri professionisti
// e 15 misurazioni di altri professionisti sulle loro schede.
test('home del 07/10: di 43 righe concesse dalla RLS ne restano 5', () => {
  const righe = [
    ...Array.from({ length: 4 }, (_, i) => ({ user_id: PRO, client_id: `scheda-${i}` })),
    { user_id: CLIENTE, client_id: null },
    ...Array.from({ length: 23 }, (_, i) => ({ user_id: `cliente-altrui-${i}`, client_id: null })),
    ...Array.from({ length: 15 }, (_, i) => ({ user_id: `${ALTRO_PRO}-${i % 3}`, client_id: `scheda-altrui-${i}` })),
  ]
  assert.equal(righe.length, 43)
  const p = perimetroDaLink(PRO, [link({})])
  const mie = righe.filter((r) => nelPerimetro(r, p))
  assert.equal(mie.length, 5)
  assert.equal(mie.filter((r) => !misurataDalCliente(r, PRO)).length, 4)
  assert.equal(mie.filter((r) => misurataDalCliente(r, PRO)).length, 1)
})

test('una riga senza user_id non è di nessuno', () => {
  const p = perimetroDaLink(PRO, [link({})])
  assert.equal(nelPerimetro({ user_id: null }, p), false)
  assert.equal(nelPerimetro({}, p), false)
  assert.equal(misurataDalCliente({ user_id: null }, PRO), false)
})

test('aBlocchi non perde e non ripete valori', () => {
  const valori = Array.from({ length: 250 }, (_, i) => i)
  const blocchi = aBlocchi(valori, 100)
  assert.deepEqual(blocchi.map((b) => b.length), [100, 100, 50])
  assert.deepEqual(blocchi.flat(), valori)
  assert.deepEqual(aBlocchi([], 100), [])
})
